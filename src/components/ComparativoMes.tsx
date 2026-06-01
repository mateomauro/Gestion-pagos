import { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { usePagos } from '@/lib/usePagos'
import { formatCurrency } from '@/lib/utils'

const NUM_MESES_SPARKLINE = 6

/**
 * Card chico que muestra: cuanto cobraste este mes vs el anterior + sparkline
 * de los ultimos 6 meses. Sin libreria de charts — SVG inline.
 */
export function ComparativoMes() {
  const { pagos, loading } = usePagos()

  const data = useMemo(() => {
    const ahora = new Date()
    const buckets = new Map<string, number>() // 'YYYY-MM' -> total

    // Inicializar ultimos N meses en 0
    for (let i = NUM_MESES_SPARKLINE - 1; i >= 0; i--) {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      buckets.set(key, 0)
    }

    // Agregar pagos
    for (const p of pagos) {
      const d = new Date(p.fecha_pago)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + p.monto_pagado)
    }

    const ordered = Array.from(buckets.entries()) // ya en orden por inserción
    const valores = ordered.map(([, v]) => v)
    const esteMes = valores[valores.length - 1] ?? 0
    const mesPasado = valores[valores.length - 2] ?? 0
    const delta = mesPasado === 0 ? null : ((esteMes - mesPasado) / mesPasado) * 100

    const mesNombre = (offsetFromCurrent: number) => {
      const d = new Date(ahora.getFullYear(), ahora.getMonth() + offsetFromCurrent, 1)
      return d.toLocaleDateString('es-AR', { month: 'long' })
    }

    return {
      valores,
      esteMes,
      mesPasado,
      delta,
      nombreEsteMes: mesNombre(0),
      nombreMesPasado: mesNombre(-1),
    }
  }, [pagos])

  if (loading) {
    return (
      <Card>
        <div className="space-y-2 animate-pulse">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-8 w-32 rounded bg-muted" />
          <div className="h-2.5 w-40 rounded bg-muted" />
        </div>
      </Card>
    )
  }

  const isPositive = data.delta !== null && data.delta > 0
  const isNegative = data.delta !== null && data.delta < 0

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Cobrado en {data.nombreEsteMes}
          </p>
          <p className="text-2xl md:text-3xl font-bold tabular-nums tracking-tight text-success mt-0.5">
            {formatCurrency(data.esteMes)}
          </p>
        </div>

        {data.delta !== null && (
          <DeltaPill value={data.delta} positive={isPositive} negative={isNegative} />
        )}
      </div>

      <Sparkline valores={data.valores} />

      <p className="text-xs text-muted-foreground mt-2 leading-snug">
        {data.delta === null
          ? `Empezás a comparar con ${data.nombreMesPasado} a partir del próximo mes.`
          : isPositive
          ? `${formatCurrency(data.esteMes - data.mesPasado)} más que en ${data.nombreMesPasado} (${formatCurrency(data.mesPasado)}).`
          : isNegative
          ? `${formatCurrency(data.mesPasado - data.esteMes)} menos que en ${data.nombreMesPasado} (${formatCurrency(data.mesPasado)}).`
          : `Igual que en ${data.nombreMesPasado}.`
        }
      </p>
    </Card>
  )
}

/* ─────────────────── Subcomponentes ─────────────────── */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5 flex flex-col h-full">
      {children}
    </div>
  )
}

function DeltaPill({
  value, positive, negative,
}: {
  value: number
  positive: boolean
  negative: boolean
}) {
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus
  const cls = positive
    ? 'bg-success/15 text-success border-success/30'
    : negative
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : 'bg-muted text-muted-foreground border-border'
  const abs = Math.abs(value)
  const display = abs >= 1000 ? '>999%' : `${abs.toFixed(0)}%`
  const sign = positive ? '+' : negative ? '−' : ''
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${cls}`}>
      <Icon className="h-3 w-3" />
      {sign}{display}
    </div>
  )
}

/**
 * Sparkline SVG super simple. Sin lib externa.
 * Muestra los ultimos N meses como una linea. El ultimo punto destacado.
 */
function Sparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) {
    return <div className="h-12 rounded-md bg-muted/30 grid place-items-center text-[11px] text-muted-foreground">Aún no hay historial</div>
  }

  const max = Math.max(...valores, 1)
  const w = 100, h = 36
  const stepX = w / (valores.length - 1)

  const points = valores.map((v, i) => {
    const x = i * stepX
    const y = h - (v / max) * (h - 4) - 2
    return [x, y] as const
  })

  const pathD = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaD = `${pathD} L${w},${h} L0,${h} Z`
  const [lastX, lastY] = points[points.length - 1]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#spark-fill)" />
        <path d={pathD} fill="none" stroke="hsl(var(--success))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <circle cx={lastX} cy={lastY} r="2" fill="hsl(var(--success))" stroke="hsl(var(--card))" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
