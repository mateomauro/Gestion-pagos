import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export interface Pago {
  id: string
  cliente_id: string
  monto_pagado: number
  metodo_pago: string | null
  fecha_pago: string // ISO timestamp
  cliente_nombre: string | null
  cliente_servicio: string | null
  cliente_telefono: string | null
}

// Todos los pagos del usuario (para vista Recibos)
export function usePagos() {
  const { user } = useAuth()
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) { setPagos([]); setLoading(false); return }
    setLoading(true); setError(null)

    const { data, error: err } = await supabase
      .from('pagos')
      .select(`
        id, cliente_id, monto_pagado, metodo_pago, fecha_pago,
        clientes ( nombre, servicio, telefono )
      `)
      .eq('usuario_id', user.id)
      .order('fecha_pago', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    const mapped: Pago[] = (data ?? []).map((row: any) => ({
      id: row.id,
      cliente_id: row.cliente_id,
      monto_pagado: Number(row.monto_pagado),
      metodo_pago: row.metodo_pago,
      fecha_pago: row.fecha_pago,
      cliente_nombre: row.clientes?.nombre ?? null,
      cliente_servicio: row.clientes?.servicio ?? null,
      cliente_telefono: row.clientes?.telefono ?? null,
    }))

    setPagos(mapped); setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return { pagos, loading, error, refresh }
}

// Pagos de UN cliente (para el modal de historial)
export function usePagosByClient(clienteId: string | null) {
  const { user } = useAuth()
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !clienteId) { setPagos([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data, error } = await supabase
        .from('pagos')
        .select('id, cliente_id, monto_pagado, metodo_pago, fecha_pago')
        .eq('cliente_id', clienteId)
        .eq('usuario_id', user.id)
        .order('fecha_pago', { ascending: false })
      if (cancelled) return
      if (error) console.error('Error pagos por cliente:', error)
      setPagos((data ?? []).map((r: any) => ({
        id: r.id, cliente_id: r.cliente_id,
        monto_pagado: Number(r.monto_pagado),
        metodo_pago: r.metodo_pago, fecha_pago: r.fecha_pago,
        cliente_nombre: null, cliente_servicio: null, cliente_telefono: null,
      })))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user, clienteId])

  return { pagos, loading }
}
