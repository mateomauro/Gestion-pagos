import { FormEvent, useEffect, useRef, useState } from 'react'
import { LoaderCircle, Plus, Save, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useServicios } from '@/lib/useServicios'
import { useTemplates } from '@/lib/useTemplates'
import { useConfirm } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const TAGS = [
  { key: '{nombre}',      label: 'Nombre' },
  { key: '{servicio}',    label: 'Servicio' },
  { key: '{monto}',       label: 'Monto' },
  { key: '{vencimiento}', label: 'Fecha' },
]

export function ConfiguracionView() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Servicios que ofrecés y plantillas de los mensajes que se mandan por WhatsApp.
        </p>
      </div>

      <ServiciosSection />
      <TemplatesSection />
    </div>
  )
}

function ServiciosSection() {
  const { user } = useAuth()
  const { servicios, refresh } = useServicios()
  const confirm = useConfirm()
  const [nuevo, setNuevo] = useState('')
  const [busy, setBusy] = useState(false)

  const addServicio = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const val = nuevo.trim()
    if (!val) return
    if (val.length > 60) { toast.error('El nombre es muy largo (máx. 60)'); return }
    if (servicios.find(s => s.nombre.toLowerCase() === val.toLowerCase())) {
      toast.info('Ese servicio ya existe'); return
    }

    setBusy(true)
    const { error } = await supabase.from('servicios').insert([{ usuario_id: user.id, nombre: val }])
    setBusy(false)
    if (error) { toast.error('No se pudo agregar: ' + error.message); return }
    setNuevo('')
    toast.success('Servicio agregado')
    refresh()
  }

  const remove = async (id: string, nombre: string) => {
    if (!user) return
    const ok = await confirm({
      title: 'Eliminar servicio',
      description: `Vas a eliminar "${nombre}". Los clientes que ya lo tienen asignado no se ven afectados.`,
      confirmText: 'Sí, eliminar',
      variant: 'destructive',
    })
    if (!ok) return
    const { error } = await supabase.from('servicios').delete().eq('id', id).eq('usuario_id', user.id)
    if (error) toast.error('No se pudo eliminar: ' + error.message)
    else { toast.success('Servicio eliminado'); refresh() }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Servicios</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Creá los planes o servicios que ofrecés (ej: <em>Cuota mensual</em>, <em>Clase suelta</em>) para elegirlos al cargar un cliente.
        </p>
      </div>

      <form onSubmit={addServicio} className="flex gap-2 max-w-xl">
        <Input
          value={nuevo}
          onChange={e => setNuevo(e.target.value)}
          placeholder="Ej: Pase libre deportivo"
        />
        <Button type="submit" disabled={busy || !nuevo.trim()}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar
        </Button>
      </form>

      <div className="flex flex-col gap-2 max-w-xl">
        {servicios.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no creaste ningún servicio.
          </div>
        ) : (
          servicios.map(s => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-4 py-3">
              <span className="text-sm font-medium">{s.nombre}</span>
              <Button
                variant="ghost" size="icon" onClick={() => remove(s.id, s.nombre)}
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label={`Eliminar servicio ${s.nombre}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function TemplatesSection() {
  const { user } = useAuth()
  const { templates, loading: tplLoading } = useTemplates()
  const [pending, setPending] = useState('')
  const [overdue, setOverdue] = useState('')
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef<HTMLTextAreaElement>(null)
  const overdueRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<HTMLTextAreaElement | null>(null)

  // Sync once cuando carga
  useEffect(() => {
    if (tplLoading) return
    setPending(templates.pending)
    setOverdue(templates.overdue)
  }, [tplLoading, templates])

  const insertTag = (tag: string) => {
    const ta = lastFocused.current ?? pendingRef.current
    if (!ta) return
    const start = ta.selectionStart, end = ta.selectionEnd
    const isOverdue = ta === overdueRef.current
    const current = isOverdue ? overdue : pending
    const next = current.substring(0, start) + tag + current.substring(end)
    if (isOverdue) setOverdue(next); else setPending(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + tag.length
    })
  }

  const save = async () => {
    if (!user) return
    setBusy(true)
    const { error } = await supabase.from('configuraciones').upsert({
      usuario_id: user.id,
      wp_pendiente: pending,
      wp_vencido: overdue,
    })
    setBusy(false)
    if (error) toast.error('No se pudo guardar: ' + error.message)
    else toast.success('Plantillas guardadas')
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Plantillas de WhatsApp</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Escribí cómo querés que le llegue el mensaje a tu cliente. Usá los botones de abajo para insertar campos dinámicos.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 max-w-2xl">
        {TAGS.map(t => (
          <button
            key={t.key} type="button" onClick={() => insertTag(t.key)}
            className="px-3 py-1.5 rounded-md text-xs font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            + {t.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        <div className="flex flex-col gap-2">
          <label htmlFor="tpl-pending" className="text-sm font-medium text-warning">Recordatorio amigable (clientes pendientes)</label>
          <textarea
            id="tpl-pending" ref={pendingRef}
            onFocus={() => { lastFocused.current = pendingRef.current }}
            value={pending} onChange={e => setPending(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            placeholder="Hola {nombre}..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="tpl-overdue" className="text-sm font-medium text-destructive">Reclamo de pago (clientes vencidos)</label>
          <textarea
            id="tpl-overdue" ref={overdueRef}
            onFocus={() => { lastFocused.current = overdueRef.current }}
            value={overdue} onChange={e => setOverdue(e.target.value)}
            rows={5}
            className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            placeholder="Hola {nombre}..."
          />
        </div>
      </div>

      <Button onClick={save} disabled={busy} className="self-start">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar plantillas
      </Button>
    </section>
  )
}
