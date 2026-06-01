import { useMemo, useState } from 'react'
import { Download, Receipt, Search, Send } from 'lucide-react'
import { toast } from 'sonner'
import { usePagos } from '@/lib/usePagos'
import { useReceiptBusiness } from '@/lib/useNegocio'
import { generateReceiptPDF } from '@/lib/receiptPdf'
import { shareReceiptViaWhatsApp } from '@/lib/shareReceipt'
import { formatCurrency, getInitials } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function RecibosView() {
  const { pagos, loading, error, refresh } = usePagos()
  const { business } = useReceiptBusiness()
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return pagos
    const q = search.toLowerCase()
    return pagos.filter(p => (p.cliente_nombre ?? '').toLowerCase().includes(q))
  }, [pagos, search])

  const totalCobrado = filtered.reduce((s, p) => s + p.monto_pagado, 0)

  const buildReceiptInput = (p: typeof pagos[number]) => ({
    clientName: p.cliente_nombre ?? 'Cliente eliminado',
    service: p.cliente_servicio ?? '-',
    amount: p.monto_pagado,
    method: p.metodo_pago || 'Efectivo',
    paymentDate: new Date(p.fecha_pago),
    receiptId: p.id,
    business,
  })

  const downloadPdf = (p: typeof pagos[number]) => {
    generateReceiptPDF(buildReceiptInput(p))
  }

  const sharePdf = async (p: typeof pagos[number]) => {
    const t = toast.loading('Generando recibo…')
    const result = await shareReceiptViaWhatsApp({
      receipt: buildReceiptInput(p),
      phone: p.cliente_telefono ?? undefined,
    })
    toast.dismiss(t)
    if (result === 'native') toast.success('Recibo compartido')
    else if (result === 'whatsapp-fallback') toast.success('PDF descargado · adjuntalo en WhatsApp Web')
    else if (result === 'download-only') toast.info('PDF descargado (el cliente no tiene teléfono cargado)')
    else if (result === 'error') toast.error('No se pudo generar el recibo')
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Recibos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historial completo de cobros · {pagos.length} pago{pagos.length === 1 ? '' : 's'} registrado{pagos.length === 1 ? '' : 's'}
          </p>
        </div>
        {filtered.length > 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-2.5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total cobrado</div>
            <div className="text-lg font-semibold text-success tabular-nums">{formatCurrency(totalCobrado)}</div>
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-center justify-between gap-3">
          <span>Error: {error}</span>
          <Button variant="outline" size="sm" onClick={refresh}>Reintentar</Button>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        {/* Header — solo desktop */}
        <div className="hidden md:grid grid-cols-[1.2fr_minmax(180px,1.5fr)_1fr_1fr_1fr_minmax(180px,auto)] gap-x-4 px-4 py-3 border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <div>Fecha y hora</div>
          <div>Cliente</div>
          <div>Servicio</div>
          <div>Método</div>
          <div>Monto</div>
          <div className="text-right pr-1">Recibo</div>
        </div>

        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i}>
                {/* Skeleton mobile */}
                <div className="md:hidden p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="flex flex-col gap-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1 rounded-md" />
                    <Skeleton className="h-9 flex-1 rounded-md" />
                  </div>
                </div>
                {/* Skeleton desktop */}
                <div className="hidden md:grid grid-cols-[1.2fr_minmax(180px,1.5fr)_1fr_1fr_1fr_minmax(180px,auto)] gap-x-4 items-center px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <div className="flex items-center justify-end gap-1.5">
                    <Skeleton className="h-8 w-20 rounded-md" />
                    <Skeleton className="h-8 w-14 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : pagos.length === 0 ? (
          <div className="px-6 py-16 grid place-items-center gap-3 text-center">
            <div className="grid place-items-center h-14 w-14 rounded-full bg-primary/15 text-primary">
              <Receipt className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold">Todavía no registraste pagos</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Cuando cobres a un cliente, el recibo va a aparecer acá. Vas a poder descargarlo en PDF o reenviarlo por WhatsApp cuando quieras.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No se encontraron pagos para tu búsqueda.
          </div>
        ) : (
          filtered.map(p => {
            const date = new Date(p.fecha_pago)
            const fechaCorta = date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
            const hora = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            const nombre = p.cliente_nombre ?? 'Cliente eliminado'
            const servicio = p.cliente_servicio ?? '-'
            const metodo = p.metodo_pago || '-'

            return (
              <div key={p.id} className="border-b border-border/60 last:border-b-0 hover:bg-accent/30 transition-colors">
                {/* Card — mobile */}
                <div className="md:hidden p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="grid place-items-center h-9 w-9 rounded-full bg-primary/15 text-primary text-xs font-semibold shrink-0">
                        {getInitials(nombre)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{nombre}</div>
                        <div className="text-xs text-muted-foreground truncate">{servicio}</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-success tabular-nums shrink-0">
                      + {formatCurrency(p.monto_pagado)}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{fechaCorta}</span>
                    <span aria-hidden>·</span>
                    <span>{hora} hs</span>
                    <span aria-hidden>·</span>
                    <span>{metodo}</span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline" size="sm" className="flex-1 h-9 text-xs"
                      onClick={() => sharePdf(p)}
                    >
                      <Send className="h-3.5 w-3.5" /> Enviar
                    </Button>
                    <Button
                      variant="outline" size="sm" className="flex-1 h-9 text-xs"
                      onClick={() => downloadPdf(p)}
                    >
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                  </div>
                </div>

                {/* Row — desktop */}
                <div className="hidden md:grid grid-cols-[1.2fr_minmax(180px,1.5fr)_1fr_1fr_1fr_minmax(180px,auto)] gap-x-4 items-center px-4 py-3">
                  <div className="text-sm">
                    <div className="font-medium">{fechaCorta}</div>
                    <div className="text-xs text-muted-foreground">{hora} hs</div>
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="grid place-items-center h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold shrink-0">
                      {getInitials(nombre)}
                    </div>
                    <span className="text-sm font-medium truncate">{nombre}</span>
                  </div>
                  <div className="text-sm text-foreground/80 truncate">{servicio}</div>
                  <div className="text-sm text-muted-foreground">{metodo}</div>
                  <div className="text-sm font-semibold text-success tabular-nums">+ {formatCurrency(p.monto_pagado)}</div>
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline" size="sm" className="h-8 text-xs"
                      onClick={() => sharePdf(p)}
                      title={p.cliente_telefono ? 'Enviar por WhatsApp' : 'Enviar (cliente sin teléfono)'}
                    >
                      <Send className="h-3.5 w-3.5" /> Enviar
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => downloadPdf(p)} title="Descargar PDF">
                      <Download className="h-3.5 w-3.5" /> PDF
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
