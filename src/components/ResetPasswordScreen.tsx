import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet, LoaderCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Pantalla que se muestra cuando el usuario llega desde el email de
 * "Recuperar contraseña". Supabase ya estableció una sesión de
 * PASSWORD_RECOVERY al procesar el token del link.
 */
export function ResetPasswordScreen() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [hasSession, setHasSession] = useState<boolean | null>(null)

  // Esperar a que Supabase procese el access_token del URL y nos diga si
  // estamos en flujo de recovery valido.
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setHasSession(true)
      }
    })
    // Si ya hay sesión al cargar (por el token del URL ya procesado), también ok.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true)
      else if (hasSession === null) setHasSession(false)
    })
    return () => { sub.data.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) { setError('La contraseña tiene que tener al menos 6 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setBusy(true)

    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) { setError(err.message); return }
    setDone(true)
    // Después de 1.5s, mandar al dashboard
    setTimeout(() => navigate('/dashboard', { replace: true }), 1500)
  }

  if (hasSession === false) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="max-w-sm text-center flex flex-col items-center gap-4">
          <h1 className="text-xl font-semibold">Link inválido o expirado</h1>
          <p className="text-sm text-muted-foreground">
            El link del email no es válido o ya pasó su tiempo de uso. Volvé a pedir uno nuevo.
          </p>
          <Button onClick={() => navigate('/login')}>Ir al login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="grid place-items-center h-12 w-12 rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva contraseña</h1>
          <p className="text-sm text-muted-foreground text-center">Elegí una contraseña nueva para tu cuenta</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="grid place-items-center h-14 w-14 rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-sm">Contraseña actualizada. Te redirigimos al dashboard…</p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pwd" className="text-sm font-medium">Nueva contraseña</label>
              <Input
                id="pwd" type="password" required minLength={6} autoComplete="new-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Al menos 6 caracteres"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pwd2" className="text-sm font-medium">Repetí la contraseña</label>
              <Input
                id="pwd2" type="password" required minLength={6} autoComplete="new-password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="••••••"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy || hasSession === null}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              Guardar nueva contraseña
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
