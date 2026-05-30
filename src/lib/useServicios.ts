import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export interface Servicio {
  id: string
  nombre: string
}

export function useServicios() {
  const { user } = useAuth()
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) { setServicios([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('servicios')
      .select('id, nombre')
      .eq('usuario_id', user.id)
      .order('fecha_creacion', { ascending: true })
    if (error) console.error('Error cargando servicios:', error)
    setServicios((data ?? []) as Servicio[])
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return { servicios, loading, refresh }
}
