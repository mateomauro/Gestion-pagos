import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  LoaderCircle, Plus, Save, Trash2, Upload, ImageIcon, ExternalLink, Eye,
  Building2, Tag, MessageSquare, CheckCheck,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useServicios } from '@/lib/useServicios'
import { useTemplates, renderTemplate } from '@/lib/useTemplates'
import { useNegocio, useLogoDataURL } from '@/lib/useNegocio'
import { buildReceiptPDF, type BusinessConfig } from '@/lib/receiptPdf'
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

// Sample data compartido por las previews
const SAMPLE_CLIENT = {
  nombre: 'Mateo Mauro',
  servicio: 'Cuota mensual Gym 3 días',
  monto: 20000,
  vencimiento: (() => {
    const d = new Date(); d.setDate(d.getDate() + 5)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })(),
}
const SAMPLE_CLIENT_VENCIDO = {
  ...SAMPLE_CLIENT,
  vencimiento: (() => {
    const d = new Date(); d.setDate(d.getDate() - 3)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })(),
}

export function ConfiguracionView() {
  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Personalizá tu negocio, los servicios que ofrecés y los mensajes que mandás por WhatsApp.
        </p>
      </div>

      <MiNegocioSection />
      <ServiciosSection />
      <TemplatesSection />
    </div>
  )
}

/* ─────────────────────────── Layout helpers ─────────────────────────── */

function SectionShell({
  icon: Icon, title, description, children,
}: {
  icon: typeof Building2
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/15 text-primary shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card/30 p-4 md:p-6">
        {children}
      </div>
    </section>
  )
}

/**
 * Chip flotante que aparece solo en mobile y al tocarlo hace smooth scroll
 * al elemento target. Le permite al usuario ver la previa sin scrollear a mano.
 */
function MobilePreviewChip({ targetId, label = 'Ver previa' }: { targetId: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const el = document.getElementById(targetId)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      className="lg:hidden inline-flex items-center gap-1.5 self-start h-9 px-3 rounded-full bg-primary/15 text-primary border border-primary/30 text-xs font-medium hover:bg-primary/25 active:scale-95 transition"
    >
      <Eye className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

/* ─────────────────────────── Mi Negocio ─────────────────────────── */

function MiNegocioSection() {
  const { negocio, loading, save, uploadLogo, deleteLogo } = useNegocio()
  const { dataURL: logoDataURL } = useLogoDataURL(negocio.logo_url)
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)

  const [nombre, setNombre] = useState('')
  const [contacto, setContacto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const hydratedRef = useRef(false)

  // Hidratar inputs UNA VEZ desde la DB. Después de eso, el state local
  // es la fuente de verdad mientras el user edita. Si re-hidratáramos en
  // cada cambio de `negocio`, pisaríamos lo que el user está tipeando.
  useEffect(() => {
    if (loading || hydratedRef.current) return
    setNombre(negocio.nombre_negocio)
    setContacto(negocio.contacto)
    setMensaje(negocio.mensaje_recibo)
    hydratedRef.current = true
  }, [loading, negocio])

  const previewBusiness: BusinessConfig = {
    name: nombre,
    contacto,
    mensaje,
    logoDataURL,
  }

  const onSave = async () => {
    setBusy(true)
    const { error } = await save({
      nombre_negocio: nombre.trim(),
      contacto: contacto.trim(),
      mensaje_recibo: mensaje.trim(),
    })
    setBusy(false)
    if (error) toast.error('No se pudo guardar: ' + error)
    else toast.success('Datos del negocio guardados')
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Solo imágenes (PNG, JPG, WebP)'); return }
    if (file.size > 2 * 1024 * 1024) { toast.error('Imagen muy grande (máx. 2 MB)'); return }
    setUploadingLogo(true)
    const { error } = await uploadLogo(file)
    setUploadingLogo(false)
    if (error) toast.error('No se pudo subir el logo: ' + error)
    else toast.success('Logo actualizado')
  }

  const onDeleteLogo = async () => {
    const ok = await confirm({
      title: 'Quitar logo',
      description: 'El recibo va a quedar solo con el nombre del negocio. ¿Seguro?',
      confirmText: 'Sí, quitar',
      variant: 'destructive',
    })
    if (!ok) return
    const { error } = await deleteLogo()
    if (error) toast.error('No se pudo quitar: ' + error)
    else toast.success('Logo eliminado')
  }

  return (
    <SectionShell
      icon={Building2}
      title="Mi negocio"
      description="Cómo aparece tu marca en los recibos PDF que enviás a los clientes."
    >
      <div className="grid lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
        {/* Form */}
        <div className="flex flex-col gap-5">
          <MobilePreviewChip targetId="preview-recibo" label="Ver previa del recibo" />

          <div className="grid sm:grid-cols-[170px_1fr] gap-5 items-start">
            {/* Logo */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Logo</label>
              <div className="aspect-square w-full max-w-[170px] rounded-xl border border-dashed border-border bg-muted/30 grid place-items-center overflow-hidden">
                {negocio.logo_url ? (
                  <img src={negocio.logo_url} alt="Logo del negocio" className="w-full h-full object-contain p-3" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-muted-foreground text-xs text-center px-3">
                    <ImageIcon className="h-7 w-7" />
                    <span>Sin logo cargado</span>
                  </div>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={onFile}
              />
              <div className="flex gap-2">
                <Button
                  type="button" variant="outline" size="sm" className="flex-1 min-h-[40px]"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {negocio.logo_url ? 'Cambiar' : 'Subir'}
                </Button>
                {negocio.logo_url && (
                  <Button
                    type="button" variant="ghost" size="icon"
                    onClick={onDeleteLogo}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[40px] min-w-[40px]"
                    aria-label="Quitar logo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                PNG, JPG o WebP. Cuadrado funciona mejor. Máx. 2 MB.
              </p>
            </div>

            {/* Inputs */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="negocio-nombre" className="text-sm font-medium">Nombre del negocio</label>
                <Input
                  id="negocio-nombre" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Gimnasio Olimpia" maxLength={80}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="negocio-contacto" className="text-sm font-medium">Contacto</label>
                <Input
                  id="negocio-contacto" value={contacto} onChange={e => setContacto(e.target.value)}
                  placeholder="Av. Siempreviva 742 · IG @migym · 11-1234-5678"
                  maxLength={120}
                />
                <p className="text-[11px] text-muted-foreground">Una línea libre. Aparece debajo del nombre en el recibo.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="negocio-mensaje" className="text-sm font-medium">Mensaje al pie del recibo</label>
                <textarea
                  id="negocio-mensaje" value={mensaje} onChange={e => setMensaje(e.target.value)}
                  rows={2} maxLength={200}
                  className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                  placeholder="¡Gracias por entrenar con nosotros!"
                />
              </div>

              <Button onClick={onSave} disabled={busy} className="self-start min-h-[44px]">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </div>
          </div>
        </div>

        {/* Preview live */}
        <div id="preview-recibo" className="scroll-mt-6">
          <ReceiptPreview business={previewBusiness} />
        </div>
      </div>
    </SectionShell>
  )
}

function ReceiptPreview({ business }: { business: BusinessConfig }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)

  useEffect(() => {
    let cancelled = false
    setBuilding(true)
    const handle = setTimeout(async () => {
      try {
        const today = new Date()
        const next = new Date(today)
        next.setMonth(next.getMonth() + 1)
        const nextIso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`

        const { blob } = await buildReceiptPDF({
          clientName: 'Mateo Mauro',
          service: 'Cuota mensual Gym 3 días',
          amount: 20000,
          method: 'Efectivo',
          paymentDate: today,
          nextDueDate: nextIso,
          receiptId: 'PREVIEW0',
          business,
        })
        if (cancelled) return
        // #toolbar=0&navpanes=0&scrollbar=0 oculta los controles del PDF viewer
        // (descarga / imprimir / panel lateral) en Chromium-based browsers.
        const url = URL.createObjectURL(blob) + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'
        setBlobUrl(url)
        setBuilding(false)
      } catch {
        if (!cancelled) setBuilding(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(handle) }
  }, [business.name, business.contacto, business.mensaje, business.logoDataURL])

  useEffect(() => {
    return () => {
      if (blobUrl) {
        // Sacar el hash antes de revoke (revoke no acepta URLs con fragment)
        URL.revokeObjectURL(blobUrl.split('#')[0])
      }
    }
  }, [blobUrl])

  return (
    <div className="flex flex-col gap-2 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium">Previa del recibo</label>
        {blobUrl && (
          <a
            href={blobUrl.split('#')[0]} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Abrir
          </a>
        )}
      </div>
      <div className="aspect-[148/210] w-full rounded-xl border border-border bg-white overflow-hidden relative shadow-lg">
        {building && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-white/60 backdrop-blur-sm">
            <LoaderCircle className="h-5 w-5 animate-spin text-primary/70" />
          </div>
        )}
        {blobUrl ? (
          <iframe
            src={blobUrl}
            title="Previa del recibo"
            className="w-full h-full border-0"
          />
        ) : (
          <div className="grid place-items-center h-full text-xs text-muted-foreground">
            Generando previa…
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Los datos del cliente y del servicio son de ejemplo.
      </p>
    </div>
  )
}

/* ─────────────────────────── Servicios ─────────────────────────── */

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
    <SectionShell
      icon={Tag}
      title="Servicios"
      description='Los planes o servicios que ofrecés (ej: "Cuota mensual", "Clase suelta") para elegirlos al cargar un cliente.'
    >
      <div className="flex flex-col gap-4 max-w-2xl">
        <form onSubmit={addServicio} className="flex gap-2">
          <Input
            value={nuevo}
            onChange={e => setNuevo(e.target.value)}
            placeholder="Ej: Pase libre deportivo"
            className="min-h-[44px]"
          />
          <Button type="submit" disabled={busy || !nuevo.trim()} className="min-h-[44px]">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar
          </Button>
        </form>

        <div className="flex flex-col gap-2">
          {servicios.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Todavía no creaste ningún servicio.
            </div>
          ) : (
            servicios.map(s => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5">
                <span className="text-sm font-medium">{s.nombre}</span>
                <Button
                  variant="ghost" size="icon" onClick={() => remove(s.id, s.nombre)}
                  className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Eliminar servicio ${s.nombre}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </SectionShell>
  )
}

/* ─────────────────────────── Plantillas WhatsApp ─────────────────────────── */

function TemplatesSection() {
  const { user } = useAuth()
  const { templates, loading: tplLoading } = useTemplates()
  const [pending, setPending] = useState('')
  const [overdue, setOverdue] = useState('')
  const [busy, setBusy] = useState(false)
  const pendingRef = useRef<HTMLTextAreaElement>(null)
  const overdueRef = useRef<HTMLTextAreaElement>(null)
  const lastFocused = useRef<HTMLTextAreaElement | null>(null)
  // Cuál preview se muestra prominente (la última que el user enfocó)
  const [activePreview, setActivePreview] = useState<'pending' | 'overdue'>('pending')

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
    <SectionShell
      icon={MessageSquare}
      title="Plantillas de WhatsApp"
      description="Los mensajes que se mandan al tocar 'WhatsApp' en un cliente. Usá los chips para insertar campos dinámicos."
    >
      <div className="grid lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
        {/* Form */}
        <div className="flex flex-col gap-5">
          <MobilePreviewChip targetId="preview-whatsapp" label="Ver previa del mensaje" />

          <div className="flex flex-wrap gap-2">
            {TAGS.map(t => (
              <button
                key={t.key} type="button" onClick={() => insertTag(t.key)}
                className="min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition"
              >
                + {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="tpl-pending" className="text-sm font-medium text-warning">
                Recordatorio amigable
                <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">Clientes pendientes</span>
              </label>
              <textarea
                id="tpl-pending" ref={pendingRef}
                onFocus={() => { lastFocused.current = pendingRef.current; setActivePreview('pending') }}
                value={pending} onChange={e => setPending(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="Hola {nombre}..."
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="tpl-overdue" className="text-sm font-medium text-destructive">
                Reclamo de pago
                <span className="block text-[11px] text-muted-foreground font-normal mt-0.5">Clientes vencidos</span>
              </label>
              <textarea
                id="tpl-overdue" ref={overdueRef}
                onFocus={() => { lastFocused.current = overdueRef.current; setActivePreview('overdue') }}
                value={overdue} onChange={e => setOverdue(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder="Hola {nombre}..."
              />
            </div>
          </div>

          <Button onClick={save} disabled={busy} className="self-start min-h-[44px]">
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar
          </Button>
        </div>

        {/* Preview */}
        <div id="preview-whatsapp" className="scroll-mt-6">
          <WhatsappPreview
            pendingText={pending}
            overdueText={overdue}
            active={activePreview}
            onChangeActive={setActivePreview}
          />
        </div>
      </div>
    </SectionShell>
  )
}

function WhatsappPreview({
  pendingText, overdueText, active, onChangeActive,
}: {
  pendingText: string
  overdueText: string
  active: 'pending' | 'overdue'
  onChangeActive: (v: 'pending' | 'overdue') => void
}) {
  const text = active === 'pending'
    ? renderTemplate(pendingText, SAMPLE_CLIENT)
    : renderTemplate(overdueText, SAMPLE_CLIENT_VENCIDO)

  const now = new Date()
  const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col gap-2 lg:sticky lg:top-6">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium">Previa del mensaje</label>
      </div>

      {/* Toggle entre pendiente / vencido */}
      <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/30 p-1 text-xs">
        <button
          type="button"
          onClick={() => onChangeActive('pending')}
          className={`min-h-[32px] px-2 rounded-md font-medium transition ${
            active === 'pending'
              ? 'bg-warning/20 text-warning shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Pendiente
        </button>
        <button
          type="button"
          onClick={() => onChangeActive('overdue')}
          className={`min-h-[32px] px-2 rounded-md font-medium transition ${
            active === 'overdue'
              ? 'bg-destructive/20 text-destructive shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Vencido
        </button>
      </div>

      {/* Mock pantalla de WhatsApp */}
      <div className="rounded-xl border border-border overflow-hidden shadow-lg bg-[#0B141A]">
        {/* Header tipo WhatsApp */}
        <div className="flex items-center gap-2.5 bg-[#202C33] px-3 py-2.5">
          <div className="grid place-items-center h-9 w-9 rounded-full bg-emerald-500 text-white text-xs font-bold shrink-0">
            {SAMPLE_CLIENT.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white font-medium truncate">{SAMPLE_CLIENT.nombre}</div>
            <div className="text-[10px] text-white/60">en línea</div>
          </div>
        </div>

        {/* Fondo de chat con burbuja saliente */}
        <div
          className="px-3 py-4 min-h-[260px] flex flex-col justify-end"
          style={{
            backgroundColor: '#0B141A',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        >
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#005C4B] text-white px-3 py-2 shadow">
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                {text || <span className="opacity-50 italic">Escribí tu plantilla…</span>}
              </p>
              <div className="flex items-center justify-end gap-1 mt-1 -mb-0.5">
                <span className="text-[10px] text-white/60">{hora}</span>
                <CheckCheck className="h-3 w-3 text-[#53BDEB]" aria-label="Leído" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        Datos de ejemplo. El mensaje real reemplaza los <code className="text-[10px] bg-muted/50 px-1 rounded">{`{tags}`}</code> con los del cliente.
      </p>
    </div>
  )
}
