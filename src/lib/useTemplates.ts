import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { Cliente } from '@/data/mock'
import { formatDate } from './utils'

export interface Templates {
  pending: string
  overdue: string
}

const DEFAULT_TEMPLATES: Templates = {
  pending: 'Hola {nombre}, te recuerdo que tu pago por "{servicio}" (${monto}) vence el {vencimiento}. ¡Gracias!',
  overdue: 'Hola {nombre}, te escribo para recordarte que tu pago por "{servicio}" (${monto}) venció el {vencimiento}. Por favor avísame cuando puedas regularizarlo. ¡Gracias!',
}

export function useTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Templates>(DEFAULT_TEMPLATES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('configuraciones')
        .select('wp_pendiente, wp_vencido')
        .eq('usuario_id', user.id)
        .maybeSingle()
      if (cancelled) return
      setTemplates({
        pending: data?.wp_pendiente || DEFAULT_TEMPLATES.pending,
        overdue: data?.wp_vencido || DEFAULT_TEMPLATES.overdue,
      })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  return { templates, loading }
}

// Helper para construir el mensaje + URL de WhatsApp
export const buildWhatsapp = (client: Cliente, templates: Templates): { text: string; url: string } => {
  let text = client.estado === 'vencido' ? templates.overdue : templates.pending
  const dateStr = formatDate(client.fecha_vencimiento)
  const montoFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(client.monto)
  text = text
    .replace(/{nombre}/g, client.nombre)
    .replace(/{servicio}/g, client.servicio)
    .replace(/{monto}/g, montoFmt)
    .replace(/{vencimiento}/g, dateStr)
  const url = `https://wa.me/${encodeURIComponent(client.telefono || '')}?text=${encodeURIComponent(text)}`
  return { text, url }
}
