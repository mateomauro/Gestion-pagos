import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Cliente } from '@/data/mock'

const promoteIfDue = (c: Cliente): Cliente => {
  if (!c.fecha_vencimiento) return c
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [y, m, d] = c.fecha_vencimiento.split('-').map(Number)
  const due = new Date(y, m - 1, d); due.setHours(0, 0, 0, 0)
  if (due >= today) return c
  if (c.estado === 'al_dia')    return { ...c, estado: 'pendiente' }
  if (c.estado === 'pendiente') return { ...c, estado: 'vencido' }
  return c
}

export function useClientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) { setClientes([]); setLoading(false); return }
    setLoading(true); setError(null)

    const { data, error: err } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, servicio, monto_mensual, fecha_vencimiento, estado, fecha_creacion')
      .eq('usuario_id', user.id)
      .order('fecha_creacion', { ascending: false })

    if (err) { setError(err.message); setLoading(false); return }

    // Mapear shape Supabase → shape del frontend (monto_mensual → monto)
    const mapped: Cliente[] = (data ?? []).map((row: any) => ({
      id: row.id,
      nombre: row.nombre,
      telefono: row.telefono ?? '',
      servicio: row.servicio,
      monto: Number(row.monto_mensual),
      fecha_vencimiento: row.fecha_vencimiento,
      estado: row.estado,
    })).map(promoteIfDue)

    setClientes(mapped)
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return { clientes, loading, error, refresh }
}
