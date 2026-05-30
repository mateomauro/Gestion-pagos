import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sigma, TrendingUp, Clock, AlertCircle, Plus, Users } from 'lucide-react'
import { useClientes } from '@/lib/useClientes'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardView() {
  const { clientes, loading } = useClientes()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    let cobrado = 0, pendiente = 0, vencido = 0
    for (const c of clientes) {
      if (c.estado === 'al_dia')     cobrado += c.monto
      else if (c.estado === 'pendiente') pendiente += c.monto
      else if (c.estado === 'vencido')   vencido += c.monto
    }
    const total = cobrado + pendiente + vencido
    return { cobrado, pendiente, vencido, total }
  }, [clientes])

  const monthName = new Date().toLocaleDateString('es-AR', { month: 'long' })

  // Loading skeleton — antes de que llegue la primera respuesta
  if (loading && clientes.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 min-h-[160px]">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-1.5 w-full mt-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state cuando aún no hay clientes
  if (!loading && clientes.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-display italic text-base text-foreground/80 capitalize">{monthName}</span> de {new Date().getFullYear()}
          </p>
        </div>

        <div className="rounded-xl border border-border grid place-items-center gap-3 py-20 px-6 text-center">
          <div className="grid place-items-center h-16 w-16 rounded-full bg-primary/15 text-primary">
            <Users className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">¡Bienvenido a CobroGest!</h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Todavía no cargaste ningún cliente. Empezá por agregar tu primer alumno para ver tus métricas.
          </p>
          <Button className="mt-2" onClick={() => navigate('/clientes')}>
            <Plus className="h-4 w-4" /> Cargar mi primer cliente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-display italic text-base text-foreground/80 capitalize">{monthName}</span> de {new Date().getFullYear()} · {clientes.length} alumno{clientes.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<Sigma />}
          label="Total a cobrar"
          value={loading ? '...' : formatCurrency(stats.total)}
          hint="Si te pagan todos este mes"
          tone="primary"
        />
        <KpiCard
          icon={<TrendingUp />}
          label="Cobrado este mes"
          value={loading ? '...' : formatCurrency(stats.cobrado)}
          hint={stats.total > 0 ? `${Math.round((stats.cobrado / stats.total) * 100)}% del total` : ''}
          progress={stats.total > 0 ? (stats.cobrado / stats.total) * 100 : 0}
          tone="success"
          onClick={() => navigate('/clientes?filter=al_dia')}
        />
        <KpiCard
          icon={<Clock />}
          label="Pendiente"
          value={loading ? '...' : formatCurrency(stats.pendiente)}
          hint={stats.total > 0 ? `${Math.round((stats.pendiente / stats.total) * 100)}% del total` : ''}
          progress={stats.total > 0 ? (stats.pendiente / stats.total) * 100 : 0}
          tone="warning"
          onClick={() => navigate('/clientes?filter=pendiente')}
        />
        <KpiCard
          icon={<AlertCircle />}
          label="Vencido"
          value={loading ? '...' : formatCurrency(stats.vencido)}
          hint={stats.total > 0 ? `${Math.round((stats.vencido / stats.total) * 100)}% del total` : ''}
          progress={stats.total > 0 ? (stats.vencido / stats.total) * 100 : 0}
          tone="destructive"
          onClick={() => navigate('/clientes?filter=vencido')}
        />
      </div>
    </div>
  )
}

function KpiCard({
  icon, label, value, hint, progress, tone, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  progress?: number
  tone: 'primary' | 'success' | 'warning' | 'destructive'
  onClick?: () => void
}) {
  const toneClasses = {
    primary:     { bg: 'bg-primary/15',     text: 'text-primary',     fill: 'bg-primary' },
    success:     { bg: 'bg-success/15',     text: 'text-success',     fill: 'bg-success' },
    warning:     { bg: 'bg-warning/15',     text: 'text-warning',     fill: 'bg-warning' },
    destructive: { bg: 'bg-destructive/15', text: 'text-destructive', fill: 'bg-destructive' },
  }[tone]

  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border border-border bg-card p-5 flex flex-col gap-4 text-left transition-all ${
        onClick ? 'hover:bg-accent/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`grid place-items-center h-9 w-9 rounded-lg ${toneClasses.bg} ${toneClasses.text} [&_svg]:h-4 [&_svg]:w-4`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="text-3xl font-bold tabular-nums tracking-tight">{value}</div>
      {progress !== undefined ? (
        <div className="flex flex-col gap-1.5 mt-auto">
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full ${toneClasses.fill} transition-[width] duration-500`} style={{ width: `${progress}%` }} />
          </div>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      ) : hint ? (
        <span className="text-xs text-muted-foreground mt-auto">{hint}</span>
      ) : null}
    </Tag>
  )
}
