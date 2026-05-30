import { Lock, MessageCircle, Download, LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { SUPPORT_WHATSAPP } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface Props {
  tipo: 'trial' | 'pago' | 'cancelado' | null
}

export function ExpiredScreen({ tipo }: Props) {
  const { signOut } = useAuth()
  const isCancelado = tipo === 'cancelado'

  const wpUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    isCancelado
      ? 'Hola Mateo, mi cuenta de CobroGest está suspendida y quiero reactivarla.'
      : 'Hola Mateo, se me venció la prueba de CobroGest y quiero seguir usándolo.'
  )}`

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 grid place-items-center h-20 w-20 rounded-full bg-warning/15 text-warning">
          <Lock className="h-9 w-9" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight mb-3">
          {isCancelado ? 'Tu cuenta está pausada' : 'Tu prueba terminó'}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {isCancelado
            ? 'Tu acceso fue suspendido temporalmente. Si pensás que es un error, escribime por WhatsApp y lo revisamos.'
            : 'Esperamos que CobroGest te haya servido para ordenar tus cobros. Si querés seguir usándolo, mandame un WhatsApp y te paso los detalles del plan.'}
        </p>

        <div className="rounded-lg bg-success/10 border border-success/25 text-success text-sm px-4 py-3 mb-6 flex items-start gap-3 text-left">
          <span className="mt-0.5">✓</span>
          <p className="leading-snug">
            Tus datos están guardados intactos. Cuando reactives tu cuenta, vas a encontrar todo como lo dejaste.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild variant="whatsapp">
            <a href={wpUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Hablar con Mateo
            </a>
          </Button>
          <Button variant="outline" disabled title="Próximamente">
            <Download className="h-4 w-4" />
            Descargar mis datos en CSV
          </Button>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  )
}
