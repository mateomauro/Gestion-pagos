import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type SubscriptionStatus = {
  state: 'loading' | 'active' | 'expired' | 'none'
  tipo: 'trial' | 'pago' | 'cancelado' | null
  daysLeft: number | null
  venceEl: string | null
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  subscription: SubscriptionStatus
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const calcDaysLeft = (iso: string): number => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = iso.split('-').map(Number)
  const due = new Date(y, m - 1, d); due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    state: 'loading', tipo: null, daysLeft: null, venceEl: null,
  })

  // Bootstrap: cargar sesión inicial + escuchar cambios
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  // Cada vez que cambia el user, refrescar suscripción
  useEffect(() => {
    const user = session?.user
    if (!user) {
      setSubscription({ state: 'loading', tipo: null, daysLeft: null, venceEl: null })
      return
    }

    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('suscripciones')
        .select('tipo, vence_el')
        .eq('usuario_id', user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        console.error('Error checking subscription', error)
        // Fail-open: permitir uso en caso de error transitorio
        setSubscription({ state: 'active', tipo: null, daysLeft: null, venceEl: null })
        return
      }

      if (!data) {
        setSubscription({ state: 'none', tipo: null, daysLeft: 0, venceEl: null })
        return
      }

      if (data.tipo === 'cancelado') {
        setSubscription({ state: 'expired', tipo: 'cancelado', daysLeft: 0, venceEl: data.vence_el })
        return
      }

      const daysLeft = calcDaysLeft(data.vence_el)
      setSubscription({
        state: daysLeft <= 0 ? 'expired' : 'active',
        tipo: data.tipo as 'trial' | 'pago',
        daysLeft,
        venceEl: data.vence_el,
      })
    })()

    return () => { cancelled = true }
  }, [session?.user])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      subscription,
      loading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
