import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, MessageCircle, ChevronRight, Check } from 'lucide-react'
import { useClientes } from '@/lib/useClientes'
import { useTemplates, buildWhatsapp } from '@/lib/useTemplates'
import { daysUntil, getInitials, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { WhatsAppQueueDialog } from '@/components/WhatsAppQueueDialog'

const MAX_VISIBLES = 4

/**
 * Lista de clientes cuyo proximo vencimiento cae en los proximos 7 dias.
 * Solo incluye estados 'pendiente' y 'al_dia' (vencidos ya tienen su KPI propio).
 * Si la lista esta vacia muestra un estado "todo al dia" optimista.
 */
export function ProximosVencimientos() {
  const { clientes, loading } = useClientes()
  const { templates } = useTemplates()
  const navigate = useNavigate()
  const [queueOpen, setQueueOpen] = useState(false)

  // Clientes que vencen hoy o en los proximos 7 dias, ordenados por urgencia
  const proximos = useMemo(() => {
    return clientes
      .map(c => ({ cliente: c, dias: daysUntil(c.fecha_vencimiento) }))
      .filter(({ cliente, dias }) =>
        cliente.estado !== 'vencido' &&    // los vencidos ya tienen el KPI rojo
        dias >= 0 && dias <= 7,
      )
      .sort((a, b) => a.dias - b.dias)
  }, [clientes])

  const visibles = proximos.slice(0, MAX_VISIBLES)
  const sobrantes = Math.max(0, proximos.length - MAX_VISIBLES)
  const conTelefono = proximos.filter(p => p.cliente.telefono)

  if (loading) {
    return (
      <Card>
        <Header total={0} loading />
        <div className="px-4 pb-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="h-2.5 w-1/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (proximos.length === 0) {
    return (
      <Card>
        <Header total={0} />
        <div className="px-4 pb-5 pt-2 flex flex-col items-center gap-2 text-center">
          <div className="grid place-items-center h-12 w-12 rounded-full bg-success/15 text-success">
            <Check className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Sin vencimientos esta semana</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Cuando algún cliente esté por vencer, lo vas a ver acá para recordarle.
          </p>
        </div>
      </Card>
    )
  }

  const remindAll = () => {
    if (conTelefono.length === 0) return
    setQueueOpen(true)
  }

  return (
    <>
      <Card>
        <Header total={proximos.length} />

        <ul className="px-2 pb-2">
          {visibles.map(({ cliente, dias }) => (
            <li key={cliente.id}>
              <RowItem cliente={cliente} dias={dias} templates={templates} />
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          {sobrantes > 0 ? (
            <button
              type="button"
              onClick={() => navigate('/clientes?filter=pendiente')}
              className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline"
            >
              Ver los {sobrantes} más <ChevronRight className="h-3 w-3" />
            </button>
          ) : <span />}

          {conTelefono.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              onClick={remindAll}
              className="min-h-[36px]"
              title={`Mandar recordatorio a ${conTelefono.length} clientes`}
            >
              <MessageCircle className="h-4 w-4" />
              Recordar a {conTelefono.length}
            </Button>
          )}
        </div>
      </Card>

      <WhatsAppQueueDialog
        open={queueOpen}
        onOpenChange={setQueueOpen}
        queue={conTelefono.map(p => p.cliente)}
      />
    </>
  )
}

/* ─────────────────── Subcomponentes ─────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
      {children}
    </div>
  )
}

function Header({ total, loading }: { total: number; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="grid place-items-center h-8 w-8 rounded-lg bg-warning/15 text-warning shrink-0">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold leading-tight">Próximos vencimientos</h3>
          <p className="text-[11px] text-muted-foreground">
            {loading ? 'Cargando…' :
              total === 0 ? 'Próximos 7 días' :
              total === 1 ? '1 cliente esta semana' :
              `${total} clientes esta semana`
            }
          </p>
        </div>
      </div>
    </div>
  )
}

function RowItem({
  cliente, dias, templates,
}: {
  cliente: ReturnType<typeof useClientes>['clientes'][number]
  dias: number
  templates: ReturnType<typeof useTemplates>['templates']
}) {
  const chipTone =
    dias === 0 ? 'bg-destructive/15 text-destructive border-destructive/30' :
    dias <= 2 ? 'bg-warning/15 text-warning border-warning/30' :
    'bg-muted/50 text-foreground/70 border-border'

  const chipLabel =
    dias === 0 ? 'Vence hoy' :
    dias === 1 ? 'Mañana' :
    `En ${dias} días`

  const remind = () => {
    if (!cliente.telefono) return
    const { url } = buildWhatsapp(cliente, templates)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-accent/40 transition-colors">
      <div className="grid place-items-center h-9 w-9 rounded-full bg-primary/15 text-primary text-xs font-semibold shrink-0">
        {getInitials(cliente.nombre)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{cliente.nombre}</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {formatCurrency(cliente.monto)}
        </div>
      </div>
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chipTone} tabular-nums whitespace-nowrap`}>
        {chipLabel}
      </span>
      <Button
        variant="ghost" size="icon"
        onClick={remind}
        disabled={!cliente.telefono}
        className="h-9 w-9 text-primary hover:text-primary hover:bg-primary/10 shrink-0"
        title={cliente.telefono ? 'Recordar por WhatsApp' : 'Sin teléfono cargado'}
        aria-label={`Recordar a ${cliente.nombre} por WhatsApp`}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>
    </div>
  )
}
