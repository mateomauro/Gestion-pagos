import { FormEvent, useEffect, useMemo, useState } from 'react'
import { LoaderCircle, Check, AlertCircle, Pencil } from 'lucide-react'
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

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const today = () => toISO(new Date())

const addOneMonth = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setMonth(date.getMonth() + 1)
  return toISO(date)
}

const formatFechaCorta = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
}

// Saca todo lo que no sea dígito y los prefijos AR (54, 549, 0 inicial, 15)
// para mostrar al usuario solo "área + número".
const stripPrefix = (saved: string): string => {
  let d = (saved || '').replace(/\D/g, '')
  if (d.startsWith('549')) d = d.slice(3)
  else if (d.startsWith('54')) d = d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  if (d.startsWith('15')) d = d.slice(2)
  return d
}

// Construye el número en formato WhatsApp internacional (sin '+').
// Ej: input "2494 374128" -> "5492494374128"
const buildWhatsappNumber = (rawInput: string): string => {
  let d = rawInput.replace(/\D/g, '')
  if (d.startsWith('549')) return d
  if (d.startsWith('54')) return '549' + d.slice(2)
  if (d.startsWith('0')) d = d.slice(1)
  if (d.startsWith('15')) d = d.slice(2)
  return '549' + d
}

export function ClientFormDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { user } = useAuth()
  const { servicios } = useServicios()

  const [nombre, setNombre] = useState('')
  const [phoneInput, setPhoneInput] = useState('') // sin prefijo, lo que el usuario ve
  const [servicio, setServicio] = useState('')
  const [monto, setMonto] = useState('')

  // Estado de pago — UX simplificada
  // yaPago === true  -> estado = 'al_dia'. Fecha: hoy + 1 mes (auto) o custom si tocó "Cambiar fecha"
  // yaPago === false -> mostrar datepicker; estado = pendiente|vencido según fecha
  const [yaPago, setYaPago] = useState(false)
  const [fecha, setFecha] = useState(today())
  const [customNextDue, setCustomNextDue] = useState(false)
  const [nextDueDate, setNextDueDate] = useState(today())

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  // Reset o precarga al abrir
  useEffect(() => {
    if (!open) return
    if (editing) {
      setNombre(editing.nombre)
      setPhoneInput(stripPrefix(editing.telefono))
      setServicio(editing.servicio)
      setMonto(String(editing.monto))
      const alDia = editing.estado === 'al_dia'
      setYaPago(alDia)
      setFecha(editing.fecha_vencimiento)
      // Si está al_dia y la fecha guardada no coincide con hoy+1mes, asumo que
      // ya fue editada — abro en modo custom para que vea/edite la fecha real.
      setNextDueDate(editing.fecha_vencimiento)
      setCustomNextDue(alDia && editing.fecha_vencimiento !== addOneMonth(today()))
    } else {
      setNombre(''); setPhoneInput(''); setServicio('')
      setMonto(''); setYaPago(false); setFecha(today())
      setCustomNextDue(false); setNextDueDate(addOneMonth(today()))
    }
    setErrors({})
  }, [open, editing])

  // Cuando el usuario marca "ya pagó", el vencimiento es hoy + 1 mes por default
  // (asume "pagó hoy"), pero puede editarlo con "Cambiar fecha" si arrancó antes.
  const fechaAuto = useMemo(() => addOneMonth(today()), [])
  const fechaFinal = yaPago ? (customNextDue ? nextDueDate : fechaAuto) : fecha

  // Estado derivado de la elección + la fecha
  const estadoFinal: Estado = useMemo(() => {
    if (yaPago) return 'al_dia'
    return fecha < today() ? 'vencido' : 'pendiente'
  }, [yaPago, fecha])

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!nombre.trim()) next.nombre = 'Poné el nombre'
    else if (nombre.length > 100) next.nombre = 'Máx. 100 caracteres'

    const phoneDigits = phoneInput.replace(/\D/g, '')
    if (!phoneDigits) next.telefono = 'Ingresá el celular'
    else if (phoneDigits.length < 8) next.telefono = 'Faltan dígitos (mínimo 8)'
    else if (phoneDigits.length > 12) next.telefono = 'Demasiados dígitos'

    if (!servicio) next.servicio = 'Elegí un servicio'

    const m = parseFloat(monto)
    if (isNaN(m) || m <= 0) next.monto = 'El monto debe ser mayor a 0'
    else if (m > 100_000_000) next.monto = 'Demasiado alto'

    if (!yaPago && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) next.fecha = 'Fecha inválida'
    if (yaPago && customNextDue && !/^\d{4}-\d{2}-\d{2}$/.test(nextDueDate)) next.nextDueDate = 'Fecha inválida'

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
      telefono: buildWhatsappNumber(phoneInput),
      servicio,
      monto_mensual: parseFloat(monto),
      fecha_vencimiento: fechaFinal,
      estado: estadoFinal,
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

  const fechaPasada = !yaPago && fecha < today()

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

          <Field
            id="telefono"
            label="Celular (WhatsApp)"
            error={errors.telefono}
            hint="Sin 0 al principio y sin 15. Ej: 2494 374128"
            colSpan={2}
          >
            <div className="flex items-stretch rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
              <span className="grid place-items-center px-3 text-sm font-medium text-muted-foreground bg-muted/40 border-r border-input shrink-0">
                +54 9
              </span>
              <input
                id="telefono"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value.replace(/[^\d\s]/g, ''))}
                placeholder="2494 374128"
                required
                className="flex-1 h-10 px-3 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
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

          <Field id="monto" label="Monto mensual ($)" error={errors.monto}>
            <Input id="monto" type="number" min="0" step="100" value={monto} onChange={e => setMonto(e.target.value)} placeholder="15000" required />
          </Field>

          {/* Bloque de pago: una sola pregunta + (a veces) un date picker */}
          <div className="col-span-2 flex flex-col gap-2.5 rounded-lg border border-border bg-muted/20 p-4">
            <label className="text-sm font-medium">¿Este cliente ya pagó este mes?</label>
            <div className="grid grid-cols-2 gap-2">
              <PayChoice selected={yaPago} onClick={() => setYaPago(true)} label="Sí, ya pagó" tone="success" />
              <PayChoice selected={!yaPago} onClick={() => setYaPago(false)} label="No, todavía no" tone="warning" />
            </div>

            {yaPago ? (
              <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-start gap-2 text-sm text-muted-foreground bg-success/10 border border-success/25 rounded-md px-3 py-2">
                  <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div>
                      Próximo vencimiento: <strong className="text-success">{formatFechaCorta(fechaFinal)}</strong>
                    </div>
                    {!customNextDue && (
                      <div className="text-xs opacity-75 mt-0.5">
                        Asumimos que pagó hoy. ¿Pagó otro día?{' '}
                        <button
                          type="button"
                          onClick={() => setCustomNextDue(true)}
                          className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" /> Cambiar fecha
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {customNextDue && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="nextDue" className="text-sm font-medium">¿Cuándo le toca pagar de nuevo?</label>
                    <Input
                      id="nextDue" type="date"
                      value={nextDueDate}
                      onChange={e => setNextDueDate(e.target.value)}
                      required
                    />
                    {errors.nextDueDate && <p className="text-xs text-destructive">{errors.nextDueDate}</p>}
                    <button
                      type="button"
                      onClick={() => { setCustomNextDue(false); setNextDueDate(fechaAuto) }}
                      className="text-xs text-muted-foreground hover:text-foreground self-start"
                    >
                      ← Volver al cálculo automático
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 mt-1">
                <label htmlFor="fecha" className="text-sm font-medium">¿Cuándo le toca pagar?</label>
                <Input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} required />
                {errors.fecha && <p className="text-xs text-destructive">{errors.fecha}</p>}
                {fechaPasada && (
                  <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-md px-2.5 py-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Fecha pasada — se va a marcar como <strong>Vencido / Deudor</strong>.</span>
                  </div>
                )}
              </div>
            )}
          </div>

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

function Field({ id, label, error, hint, colSpan = 1, children }: {
  id: string; label: string; error?: string; hint?: string; colSpan?: 1 | 2; children: React.ReactNode
}) {
  return (
    <div className={colSpan === 2 ? 'col-span-2 flex flex-col gap-1.5' : 'flex flex-col gap-1.5'}>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
    </div>
  )
}

function PayChoice({ selected, onClick, label, tone }: {
  selected: boolean
  onClick: () => void
  label: string
  tone: 'success' | 'warning'
}) {
  const toneClass = selected
    ? tone === 'success'
      ? 'border-success bg-success/15 text-success'
      : 'border-warning bg-warning/15 text-warning'
    : 'border-border bg-background text-foreground hover:border-foreground/30'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-md border text-sm font-medium transition-colors ${toneClass}`}
    >
      {label}
    </button>
  )
}
