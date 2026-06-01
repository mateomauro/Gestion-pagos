import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Tag, Users, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react'
import { useNegocio } from '@/lib/useNegocio'
import { useServicios } from '@/lib/useServicios'
import { useClientes } from '@/lib/useClientes'

interface Step {
  id: 'negocio' | 'servicio' | 'cliente'
  done: boolean
  icon: typeof Building2
  title: string
  description: string
  cta: string
  onAction: () => void
}

/**
 * Card de onboarding que muestra los 3 pasos minimos para arrancar.
 * Se oculta automaticamente cuando todos los pasos estan completos.
 * El estado se deriva de datos existentes, no usa columna nueva en DB.
 */
export function OnboardingChecklist() {
  const navigate = useNavigate()
  const { negocio, loading: negocioLoading } = useNegocio()
  const { servicios, loading: serviciosLoading } = useServicios()
  const { clientes, loading: clientesLoading } = useClientes()

  const loading = negocioLoading || serviciosLoading || clientesLoading

  const steps: Step[] = useMemo(() => [
    {
      id: 'negocio',
      done: !!negocio.nombre_negocio?.trim(),
      icon: Building2,
      title: 'Personalizá tu negocio',
      description: 'Tu logo y nombre van a aparecer en cada recibo. Demora 2 minutos.',
      cta: 'Configurar',
      onAction: () => navigate('/configuracion'),
    },
    {
      id: 'servicio',
      done: servicios.length > 0,
      icon: Tag,
      title: 'Creá tu primer servicio',
      description: 'Los planes que ofrecés (ej: Cuota mensual, Pase libre). Lo vas a elegir al cargar clientes.',
      cta: 'Crear',
      onAction: () => navigate('/configuracion'),
    },
    {
      id: 'cliente',
      done: clientes.length > 0,
      icon: Users,
      title: 'Cargá tu primer cliente',
      description: 'Empezá a controlar quién pagó y quién está vencido.',
      cta: 'Agregar',
      onAction: () => navigate('/clientes?new=1'),
    },
  ], [negocio.nombre_negocio, servicios.length, clientes.length, navigate])

  const completed = steps.filter(s => s.done).length
  const total = steps.length
  const allDone = completed === total
  const progress = (completed / total) * 100

  // No mostramos nada hasta tener data + ocultamos cuando esta todo hecho
  if (loading || allDone) return null

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 md:p-6 overflow-hidden">
      {/* Glow decorativo */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/20 blur-3xl pointer-events-none" aria-hidden />

      <div className="relative flex items-start gap-3 mb-4">
        <div className="grid place-items-center h-10 w-10 rounded-xl bg-primary/20 text-primary shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold tracking-tight">Empezá en 3 pasos</h2>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {completed} de {total}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configurá lo básico para que la app trabaje a full por vos.
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-secondary/60 overflow-hidden mb-5">
        <div
          className="h-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex flex-col gap-2">
        {steps.map((step, idx) => (
          <StepItem key={step.id} step={step} index={idx + 1} />
        ))}
      </div>
    </div>
  )
}

function StepItem({ step, index }: { step: Step; index: number }) {
  const { done, icon: Icon, title, description, cta, onAction } = step

  return (
    <button
      type="button"
      onClick={done ? undefined : onAction}
      disabled={done}
      className={`group flex items-center gap-3 md:gap-4 rounded-xl border p-3 md:p-4 text-left transition-all min-h-[64px] ${
        done
          ? 'border-success/30 bg-success/5 cursor-default'
          : 'border-border bg-background/40 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]'
      }`}
    >
      {/* Icon column */}
      <div className="shrink-0">
        {done ? (
          <div className="grid place-items-center h-10 w-10 rounded-full bg-success/20 text-success">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        ) : (
          <div className="relative grid place-items-center h-10 w-10 rounded-full bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-4 w-4 grid place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {index}
            </span>
          </div>
        )}
      </div>

      {/* Text column */}
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${done ? 'text-success line-through decoration-success/40' : 'text-foreground'}`}>
          {title}
        </div>
        {!done && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>

      {/* CTA */}
      {!done && (
        <div className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
          <span className="hidden sm:inline">{cta}</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </button>
  )
}
