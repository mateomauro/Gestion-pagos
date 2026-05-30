import { Component, ReactNode } from 'react'
import { AlertOctagon, RotateCcw, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SUPPORT_WHATSAPP } from '@/lib/supabase'

interface State {
  hasError: boolean
  error: Error | null
}

interface Props {
  children: ReactNode
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (!this.state.hasError) return this.props.children

    const wpUrl = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
      `Hola Mateo, CobroGest me tiró un error: ${this.state.error?.message || 'desconocido'}`
    )}`

    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="max-w-md text-center flex flex-col items-center gap-4">
          <div className="grid place-items-center h-16 w-16 rounded-full bg-destructive/15 text-destructive">
            <AlertOctagon className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Algo se rompió</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            La app encontró un error que no pudo manejar. Probá recargar; si sigue pasando, mandame WhatsApp y lo arreglo.
          </p>
          {this.state.error && (
            <details className="w-full text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">Ver detalle técnico</summary>
              <pre className="mt-2 p-3 rounded-md bg-muted text-xs overflow-auto max-h-40 text-destructive">
                {this.state.error.message}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
          <div className="flex flex-col gap-2 w-full mt-2">
            <Button onClick={() => location.reload()}>
              <RotateCcw className="h-4 w-4" /> Recargar página
            </Button>
            <Button asChild variant="whatsapp">
              <a href={wpUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> Avisar a Mateo
              </a>
            </Button>
            <Button variant="ghost" onClick={this.reset}>Intentar continuar</Button>
          </div>
        </div>
      </div>
    )
  }
}
