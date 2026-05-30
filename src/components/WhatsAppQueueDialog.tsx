import { useEffect, useState } from 'react'
import { CheckCircle2, MessageCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { buildWhatsapp, useTemplates } from '@/lib/useTemplates'
import { getInitials } from '@/lib/utils'
import type { Cliente } from '@/data/mock'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  queue: Cliente[]
}

export function WhatsAppQueueDialog({ open, onOpenChange, queue }: Props) {
  const { templates } = useTemplates()
  const [index, setIndex] = useState(0)

  // Reset al abrir
  useEffect(() => { if (open) setIndex(0) }, [open])

  const total = queue.length
  const done = index >= total

  const next = () => setIndex(i => i + 1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recordatorios por WhatsApp</DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="grid place-items-center h-16 w-16 rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <p className="font-semibold">¡Listo!</p>
            <p className="text-sm text-muted-foreground">Recorriste los {total} recordatorios.</p>
            <Button className="w-full mt-4" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        ) : (
          <QueueStep
            client={queue[index]}
            index={index}
            total={total}
            templates={templates}
            onNext={next}
            onSkip={next}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function QueueStep({
  client, index, total, templates, onNext, onSkip,
}: {
  client: Cliente
  index: number
  total: number
  templates: ReturnType<typeof useTemplates>['templates']
  onNext: () => void
  onSkip: () => void
}) {
  const { text, url } = buildWhatsapp(client, templates)
  const progress = (index / total) * 100
  const firstName = client.nombre.split(' ')[0]

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Recordatorio {index + 1} de {total}</span>
          <span className="uppercase tracking-wider">{client.estado === 'vencido' ? 'Vencido' : 'Pendiente'}</span>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-[#25D366] transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Client */}
      <div className="flex items-center gap-3">
        <div className="grid place-items-center h-10 w-10 rounded-full bg-primary/15 text-primary text-sm font-semibold">
          {getInitials(client.nombre)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{client.nombre}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{client.telefono}</div>
        </div>
      </div>

      {/* Message preview */}
      <div className="rounded-lg border border-border bg-background/40 p-3.5">
        <p className="text-xs text-muted-foreground mb-2">Mensaje:</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button variant="whatsapp" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-4 w-4" />
            Abrir WhatsApp de {firstName}
          </a>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onSkip}>Saltear</Button>
          <Button className="flex-[2]" onClick={onNext}>Enviado, siguiente →</Button>
        </div>
      </div>
    </div>
  )
}
