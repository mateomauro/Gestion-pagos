import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useReceiptBusiness } from '@/lib/useNegocio'
import { formatCurrency } from '@/lib/utils'
import { shareReceiptViaWhatsApp } from '@/lib/shareReceipt'
import type { Cliente } from '@/data/mock'
import { toast } from 'sonner'

interface Props {
  client: Cliente | null
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}

export function PaymentDialog({ client, onOpenChange, onPaid }: Props) {
  const { user } = useAuth()
  const { business } = useReceiptBusiness()
  const [metodo, setMetodo] = useState('Efectivo')
  const [busy, setBusy] = useState(false)
  const open = client !== null

  const confirmPayment = async () => {
    if (!user || !client) return
    if (busy) return  // doble-click guard adicional
    setBusy(true)

    // Llamada atomica: el RPC inserta el pago Y actualiza el cliente en una
    // sola transaccion. Si cualquier paso falla, ambos se revierten.
    const { data, error } = await supabase.rpc('registrar_pago', {
      p_cliente_id: client.id,
      p_monto: client.monto,
      p_metodo: metodo,
    })

    setBusy(false)

    if (error) {
      toast.error('No se pudo registrar el pago: ' + error.message)
      return
    }

    // El RPC devuelve { pago_id, fecha_pago, nueva_fecha_vencimiento }
    const result = (data ?? {}) as {
      pago_id?: string
      fecha_pago?: string
      nueva_fecha_vencimiento?: string
    }
    const clienteSnap = client
    const pagoId = result.pago_id
    const fechaPago = result.fecha_pago ? new Date(result.fecha_pago) : new Date()
    const nuevoVenc = result.nueva_fecha_vencimiento ?? null

    toast.success(`Pago de ${clienteSnap.nombre} registrado`, {
      duration: 8000,
      action: {
        label: 'Enviar recibo',
        onClick: async () => {
          const t = toast.loading('Generando recibo…')
          const shareResult = await shareReceiptViaWhatsApp({
            receipt: {
              clientName: clienteSnap.nombre,
              service: clienteSnap.servicio,
              amount: clienteSnap.monto,
              method: metodo,
              paymentDate: fechaPago,
              nextDueDate: nuevoVenc,
              receiptId: pagoId,
              business,
            },
            phone: clienteSnap.telefono || undefined,
          })
          toast.dismiss(t)
          if (shareResult === 'native') toast.success('Recibo compartido')
          else if (shareResult === 'whatsapp-fallback') toast.success('PDF descargado · adjuntalo en WhatsApp Web')
          else if (shareResult === 'download-only') toast.info('PDF descargado (cargá un teléfono para abrir WhatsApp)')
          else if (shareResult === 'error') toast.error('No se pudo generar el recibo')
        },
      },
    })

    onOpenChange(false)
    onPaid()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Vas a confirmar el cobro de <strong className="text-foreground">{client?.nombre}</strong>{' '}
            por <strong className="text-success">{client ? formatCurrency(client.monto) : ''}</strong>.
            Se suma un mes al vencimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="metodo" className="text-sm font-medium">Método de pago</label>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger id="metodo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="success" onClick={confirmPayment} disabled={busy}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Confirmar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
