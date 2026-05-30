import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  daysLeft: number
}

export function TrialBanner({ daysLeft }: Props) {
  const warning = daysLeft <= 7
  return (
    <div
      className={
        'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 mb-6 ' +
        (warning
          ? 'border-warning/40 bg-gradient-to-r from-warning/15 to-transparent'
          : 'border-primary/35 bg-gradient-to-r from-primary/15 to-transparent')
      }
    >
      <Sparkles className={warning ? 'h-5 w-5 text-warning shrink-0' : 'h-5 w-5 text-primary shrink-0'} />
      <p className="text-sm flex-1 min-w-[200px]">
        Te quedan <strong>{daysLeft} días</strong> de prueba gratis.
      </p>
      <Button variant="outline" size="sm" className="text-xs">
        Pasar a plan pago
      </Button>
    </div>
  )
}
