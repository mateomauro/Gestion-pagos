import { useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { Cliente } from '@/data/mock'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  targets: Cliente[]
  onDone: () => void
}

const addOneMonth = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d); dt.setMonth(dt.getMonth() + 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function BulkPayDialog({ open, onOpenChange, targets, onDone }: Props) {
  const { user } = useAuth()
  const [metodo, setMetodo] = useState('Efectivo')
  const [busy, setBusy] = useState(false)

  const total = targets.reduce((s, c) => s + c.monto, 0)

  const confirm = async () => {
    if (!user || targets.length === 0) return
    setBusy(true)
    let ok = 0, fail = 0

    for (const client of targets) {
      const { error: errPago } = await supabase.from('pagos').insert([{
        cliente_id: client.id, usuario_id: user.id,
        monto_pagado: client.monto, metodo_pago: metodo,
      }])
      if (errPago) { fail++; continue }
      const { error: errCli } = await supabase.from('clientes')
        .update({ estado: 'al_dia', fecha_vencimiento: addOneMonth(client.fecha_vencimiento) })
        .eq('id', client.id).eq('usuario_id', user.id)
      if (errCli) fail++; else ok++
    }

    setBusy(false)
    onOpenChange(false)
    if (fail > 0) toast.error(`${ok} pago(s) registrado(s), ${fail} fallaron`)
    else toast.success(`¡${ok} pago(s) registrado(s)!`)
    onDone()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagos en lote</DialogTitle>
          <DialogDescription>
            Vas a registrar el pago de <strong className="text-foreground">{targets.length} cliente{targets.length === 1 ? '' : 's'}</strong>{' '}
            por un total de <strong className="text-success">{formatCurrency(total)}</strong>.
            A cada uno se le suma un mes al vencimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="metodo-bulk" className="text-sm font-medium">Método de pago</label>
          <Select value={metodo} onValueChange={setMetodo}>
            <SelectTrigger id="metodo-bulk"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Efectivo">Efectivo</SelectItem>
              <SelectItem value="Transferencia">Transferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="success" onClick={confirm} disabled={busy}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Confirmar {targets.length} pago{targets.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
