import { Download, LoaderCircle, Receipt } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { usePagosByClient } from '@/lib/usePagos'
import { generateReceiptPDF } from '@/lib/receiptPdf'
import { formatCurrency } from '@/lib/utils'
import type { Cliente } from '@/data/mock'

interface Props {
  client: Cliente | null
  onOpenChange: (open: boolean) => void
}

export function HistoryDialog({ client, onOpenChange }: Props) {
  const { pagos, loading } = usePagosByClient(client?.id ?? null)
  const open = client !== null

  const totalPagado = pagos.reduce((s, p) => s + p.monto_pagado, 0)
  const lastPago = pagos[0]

  const downloadPdf = (pagoId: string, monto: number, metodo: string | null, fechaIso: string) => {
    if (!client) return
    generateReceiptPDF({
      clientName: client.nombre,
      service: client.servicio,
      amount: monto,
      method: metodo || 'Efectivo',
      paymentDate: new Date(fechaIso),
      receiptId: pagoId,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de {client?.nombre}</DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Total pagado" value={formatCurrency(totalPagado)} valueClass="text-success" />
          <Stat label="Pagos" value={String(pagos.length)} />
          <Stat
            label="Último pago"
            value={lastPago ? new Date(lastPago.fecha_pago).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
            small
          />
        </div>

        {/* Próximo vencimiento */}
        {client && (
          <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/25 px-4 py-2.5 text-sm">
            <span className="text-muted-foreground">Próximo vencimiento</span>
            <span className="font-semibold text-primary">
              {new Date(client.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}

        {/* Lista de pagos */}
        {loading ? (
          <div className="grid place-items-center py-10">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : pagos.length === 0 ? (
          <div className="grid place-items-center gap-2 py-10 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Este cliente todavía no tiene pagos registrados.</p>
          </div>
        ) : (
          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border">
            <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 px-4 py-2.5 border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              <div>Fecha</div>
              <div>Monto</div>
              <div>Método</div>
              <div className="text-right pr-1">Recibo</div>
            </div>
            {pagos.map(p => {
              const date = new Date(p.fecha_pago)
              return (
                <div key={p.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center px-4 py-3 border-b border-border/60 last:border-b-0 hover:bg-accent/30 transition-colors">
                  <div className="text-sm">
                    <div className="font-medium">{date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                    <div className="text-xs text-muted-foreground">{date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</div>
                  </div>
                  <div className="text-sm font-semibold text-success tabular-nums">{formatCurrency(p.monto_pagado)}</div>
                  <div className="text-sm text-foreground/80">{p.metodo_pago || '-'}</div>
                  <Button
                    variant="outline" size="sm" className="h-8 text-xs"
                    onClick={() => downloadPdf(p.id, p.monto_pagado, p.metodo_pago, p.fecha_pago)}
                  >
                    <Download className="h-3.5 w-3.5" /> PDF
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value, valueClass = '', small = false }: { label: string; value: string; valueClass?: string; small?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-4 py-3 flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      <span className={`font-bold ${small ? 'text-base' : 'text-xl'} ${valueClass}`}>{value}</span>
    </div>
  )
}
