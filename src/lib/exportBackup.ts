// Backup completo: clientes + pagos del usuario en un solo CSV.
// Usado tanto desde el botón "Exportar" de Clientes como desde la pantalla
// bloqueada (suscripción vencida) — el usuario siempre puede llevarse su data.

import { supabase } from './supabase'

interface UserBackupOptions {
  userId: string
}

export async function downloadFullBackup({ userId }: UserBackupOptions): Promise<{
  ok: boolean
  clientesCount: number
  pagosCount: number
  error?: string
}> {
  const [clientesRes, pagosRes] = await Promise.all([
    supabase.from('clientes')
      .select('id, nombre, telefono, servicio, monto_mensual, fecha_vencimiento, estado, fecha_creacion')
      .eq('usuario_id', userId),
    supabase.from('pagos')
      .select('id, cliente_id, monto_pagado, metodo_pago, fecha_pago')
      .eq('usuario_id', userId),
  ])

  if (clientesRes.error || pagosRes.error) {
    return {
      ok: false,
      clientesCount: 0,
      pagosCount: 0,
      error: (clientesRes.error || pagosRes.error)?.message || 'Error desconocido',
    }
  }

  const clientes = clientesRes.data ?? []
  const pagos = pagosRes.data ?? []
  const statusNames: Record<string, string> = { al_dia: 'Al día', pendiente: 'Pendiente', vencido: 'Vencido' }
  const clientesById = Object.fromEntries(clientes.map((c: any) => [c.id, c.nombre]))

  const csvEscape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const sections: string[] = []
  sections.push('# CLIENTES')
  sections.push(['Nombre', 'Telefono', 'Servicio', 'Monto', 'Vencimiento', 'Estado', 'Creado'].map(csvEscape).join(','))
  clientes.forEach((c: any) => {
    sections.push([
      c.nombre, c.telefono || '', c.servicio, c.monto_mensual, c.fecha_vencimiento,
      statusNames[c.estado] || c.estado, c.fecha_creacion || '',
    ].map(csvEscape).join(','))
  })

  sections.push('')
  sections.push('# HISTORIAL DE PAGOS')
  sections.push(['Cliente', 'Monto', 'Metodo', 'Fecha'].map(csvEscape).join(','))
  pagos.forEach((p: any) => {
    sections.push([
      clientesById[p.cliente_id] || '(cliente eliminado)',
      p.monto_pagado, p.metodo_pago || '', p.fecha_pago,
    ].map(csvEscape).join(','))
  })

  const BOM = '﻿'
  const blob = new Blob([BOM + sections.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cobrogest_backup_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)

  return { ok: true, clientesCount: clientes.length, pagosCount: pagos.length }
}
