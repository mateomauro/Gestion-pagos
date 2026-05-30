import { FormEvent, useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useServicios } from '@/lib/useServicios'
import type { Cliente, Estado } from '@/data/mock'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Cliente | null
  onSaved: () => void
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const estadoFromForm = (s: string): Estado => (s as Estado)

export function ClientFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { user } = useAuth()
  const { servicios } = useServicios()

  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [servicio, setServicio] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(today())
  const [estado, setEstado] = useState<Estado>('pendiente')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // Resetear o precargar al abrir
  useEffect(() => {
    if (!open) return
    if (editing) {
      setNombre(editing.nombre)
      setTelefono(editing.telefono)
      setServicio(editing.servicio)
      setMonto(String(editing.monto))
      setFecha(editing.fecha_vencimiento)
      setEstado(editing.estado)
    } else {
      setNombre(''); setTelefono(''); setServicio('')
      setMonto(''); setFecha(today()); setEstado('pendiente')
    }
    setErrors({})
  }, [open, editing])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!nombre.trim()) next.nombre = 'El nombre no puede estar vacío'
    else if (nombre.length > 100) next.nombre = 'Demasiado largo (máx. 100)'
    const tel = telefono.trim().replace(/\s+/g, '')
    if (!tel) next.telefono = 'Ingresá el teléfono'
    else if (!/^[0-9+\-()]{6,20}$/.test(tel)) next.telefono = '6 a 20 dígitos, sin espacios'
    if (!servicio) next.servicio = 'Elegí un servicio'
    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) next.monto = 'El monto debe ser mayor a 0'
    else if (m > 100_000_000) next.monto = 'Demasiado alto'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) next.fecha = 'Fecha inválida'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!validate()) return
    setBusy(true)

    const payload = {
      usuario_id: user.id,
      nombre: nombre.trim(),
      telefono: telefono.trim().replace(/\s+/g, ''),
      servicio,
      monto_mensual: parseFloat(monto),
      fecha_vencimiento: fecha,
      estado,
    }

    const { error } = editing
      ? await supabase.from('clientes').update(payload).eq('id', editing.id).eq('usuario_id', user.id)
      : await supabase.from('clientes').insert([payload])

    setBusy(false)
    if (error) { toast.error('No se pudo guardar: ' + error.message); return }

    toast.success(editing ? 'Cliente actualizado' : '¡Cliente registrado!')
    onOpenChange(false)
    onSaved()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <Field id="nombre" label="Nombre y apellido" error={errors.nombre} colSpan={2}>
            <Input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan Pérez" required />
          </Field>

          <Field id="telefono" label="Teléfono (WhatsApp)" error={errors.telefono}>
            <Input id="telefono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="5491123456789" required />
          </Field>

          <Field id="servicio" label="Servicio" error={errors.servicio}>
            <Select value={servicio} onValueChange={setServicio}>
              <SelectTrigger id="servicio"><SelectValue placeholder="Elegí uno" /></SelectTrigger>
              <SelectContent>
                {servicios.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Creá servicios desde Configuración</div>
                )}
                {servicios.map(s => <SelectItem key={s.id} value={s.nombre}>{s.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>

          <Field id="monto" label="Monto ($)" error={errors.monto}>
            <Input id="monto" type="number" min="0" step="100" value={monto} onChange={e => setMonto(e.target.value)} placeholder="15000" required />
          </Field>

          <Field id="fecha" label="Vencimiento" error={errors.fecha}>
            <Input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
          </Field>

          <Field id="estado" label="Estado inicial" colSpan={2}>
            <Select value={estado} onValueChange={(v) => setEstado(estadoFromForm(v))}>
              <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente de pago</SelectItem>
                <SelectItem value="al_dia">Ya pagó este mes</SelectItem>
                <SelectItem value="vencido">Vencido / Deudor</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <DialogFooter className="col-span-2 mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {editing ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, error, colSpan = 1, children }: { id: string; label: string; error?: string; colSpan?: 1 | 2; children: React.ReactNode }) {
  return (
    <div className={colSpan === 2 ? 'col-span-2 flex flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  )
}
