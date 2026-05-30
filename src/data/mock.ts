// Tipos compartidos. Lo de "mock" quedó por compatibilidad con el PoC inicial;
// en Fase 2 movemos esto a /lib/types.ts.

export type Estado = 'al_dia' | 'pendiente' | 'vencido'

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  servicio: string
  monto: number
  fecha_vencimiento: string // YYYY-MM-DD
  estado: Estado
}

export const estadoLabel = (e: Estado): string =>
  ({ al_dia: 'Al día', pendiente: 'Pendiente', vencido: 'Vencido' }[e])

export const groupLabel = (e: Estado): string =>
  ({ vencido: 'Vencidos', pendiente: 'Pendientes de cobro', al_dia: 'Cobrados (Al día)' }[e])

export const statusOrder: Record<Estado, number> = { vencido: 1, pendiente: 2, al_dia: 3 }
