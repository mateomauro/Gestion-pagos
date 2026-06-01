import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { shareReceiptViaWhatsApp } from '@/lib/shareReceipt'
import type { Cliente } from '@/data/mock'
import { toast } from 'sonner'

interface Props {
  client: Cliente | null
  onOpenChange: (open: boolean) => void
  onPaid: () => void
}

// Calcula la próxima fecha de vencimiento sumando 1 mes
const addOneMonth = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setMonth(date.getMonth() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function PaymentDialog({ client, onOpenChange, onPaid }: Props) {
  const { user } = useAuth()
  const [metodo, setMetodo] = useState('Efectivo')
  const [busy, setBusy] = useState(false)
  const open = client !== null

  const confirmPayment = async () => {
    if (!user || !client) return
    setBusy(true)

    // 1. Insertar el pago primero (dato crítico) y devolver id + fecha_pago
    const { data: pagoData, error: errPago } = await supabase.from('pagos').insert([{
      cliente_id: client.id,
      usuario_id: user.id,
      monto_pagado: client.monto,
      metodo_pago: metodo,
    }]).select('id, fecha_pago').single()
    if (errPago) {
      setBusy(false)
      toast.error('No se pudo registrar el pago: ' + errPago.message)
      return
    }

    // 2. Actualizar cliente: estado al_dia + nueva fecha de vencimiento
    const nuevoVenc = addOneMonth(client.fecha_vencimiento)
    const { error: errCli } = await supabase
      .from('clientes')
      .update({ estado: 'al_dia', fecha_vencimiento: nuevoVenc })
      .eq('id', client.id)
      .eq('usuario_id', user.id)

    setBusy(false)
    if (errCli) {
      toast.error('Pago guardado, pero el estado del cliente no se actualizó. Refrescá la página.')
    } else {
      // Toast con acción "Enviar recibo" -> abre Web Share API o WhatsApp Web
      const clienteSnap = client
      const pagoId = pagoData?.id as string | undefined
      const fechaPago = pagoData?.fecha_pago ? new Date(pagoData.fecha_pago as string) : new Date()
      toast.success(`Pago de ${clienteSnap.nombre} registrado`, {
        duration: 8000,
        action: {
          label: 'Enviar recibo',
          onClick: async () => {
            const t = toast.loading('Generando recibo…')
            const result = await shareReceiptViaWhatsApp({
              receipt: {
                clientName: clienteSnap.nombre,
                service: clienteSnap.servicio,
                amount: clienteSnap.monto,
                method: metodo,
                paymentDate: fechaPago,
                nextDueDate: nuevoVenc,
                receiptId: pagoId,
              },
              phone: clienteSnap.telefono || undefined,
            })
            toast.dismiss(t)
            if (result === 'native') toast.success('Recibo compartido')
            else if (result === 'whatsapp-fallback') toast.success('PDF descargado · adjuntalo en WhatsApp Web')
            else if (result === 'download-only') toast.info('PDF descargado (cargá un teléfono para abrir WhatsApp)')
            else if (result === 'error') toast.error('No se pudo generar el recibo')
          },
        },
      })
    }
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
