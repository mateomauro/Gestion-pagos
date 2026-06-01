import { useState, useRef } from 'react'
import {
  CheckCircle2, AlertCircle, LoaderCircle, ArrowLeft,
  ClipboardPaste, FileSpreadsheet, Download, Upload,
} from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useServicios } from '@/lib/useServicios'
import { parseCsv, generateTemplateXlsx, parseXlsxFile, type ParseResult } from '@/lib/csvImport'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

type Mode = 'choose' | 'paste' | 'upload'

export function CsvImportDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth()
  const { servicios, refresh: refreshServicios } = useServicios()
  const [mode, setMode] = useState<Mode>('choose')
  const [pasted, setPasted] = useState('')
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setMode('choose'); setPasted(''); setPreview(null); setParseError(null)
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const handleParse = (text: string) => {
    setParseError(null); setPreview(null)
    const result = parseCsv(text)
    if ('error' in result) { setParseError(result.error); return }
    setPreview(result)
  }

  const onFile = async (file: File) => {
    setParseError(null); setPreview(null)
    try {
      // .xlsx (Excel nativo) vs .csv/.txt (texto plano)
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx') ||
                     file.type.includes('spreadsheetml') ||
                     file.type.includes('excel')
      const text = isXlsx ? await parseXlsxFile(file) : await file.text()
      handleParse(text)
    } catch (e: any) {
      setParseError('No se pudo leer el archivo: ' + (e?.message || 'formato no soportado'))
    }
  }

  const downloadTemplate = async () => {
    try {
      const blob = await generateTemplateXlsx()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'plantilla_clientes_cobrogest.xlsx'
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.info('Plantilla descargada. Abrila en Excel, llenala con tus clientes y subila acá.', { duration: 6000 })
    } catch (e: any) {
      toast.error('No se pudo generar la plantilla: ' + (e?.message || 'error desconocido'))
    }
  }

  const handleImport = async () => {
    if (!user || !preview) return
    const valid = preview.rows.filter(r => r.valid)
    if (valid.length === 0) return

    setBusy(true)

    // Auto-crear servicios nuevos
    const csvServicios = [...new Set(valid.map(r => r.servicio.trim()).filter(Boolean))]
    const existing = new Set(servicios.map(s => s.nombre))
    const nuevos = csvServicios.filter(s => !existing.has(s))
    if (nuevos.length > 0) {
      const ins = nuevos.map(nombre => ({ usuario_id: user.id, nombre }))
      const { error: errSrv } = await supabase.from('servicios').insert(ins)
      if (errSrv) console.error('Error creando servicios:', errSrv)
      else await refreshServicios()
    }

    // Insertar en chunks de 100
    const payload = valid.map(r => ({
      usuario_id: user.id,
      nombre: r.nombre,
      telefono: r.telefono,
      servicio: r.servicio,
      monto_mensual: r.monto,
      fecha_vencimiento: r.fecha,
      estado: r.estado,
    }))

    let ok = 0, fail = 0
    const chunk = 100
    for (let i = 0; i < payload.length; i += chunk) {
      const slice = payload.slice(i, i + chunk)
      const { error } = await supabase.from('clientes').insert(slice)
      if (error) { fail += slice.length; console.error(error) }
      else ok += slice.length
    }

    setBusy(false)
    close()
    if (fail > 0) toast.error(`Cargados ${ok}, ${fail} no se pudieron`)
    else toast.success(`¡${ok} cliente${ok === 1 ? '' : 's'} cargado${ok === 1 ? '' : 's'}!`)
    onImported()
  }

  const okCount = preview ? preview.rows.filter(r => r.valid).length : 0
  const errCount = preview ? preview.rows.length - okCount : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(mode !== 'choose' && !preview) && (
              <button
                type="button" onClick={reset}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Volver"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            Cargar lista de clientes
          </DialogTitle>
        </DialogHeader>

        {/* Si ya hay preview, mostrarlo (mismo para ambos caminos) */}
        {preview ? (
          <PreviewBlock preview={preview} okCount={okCount} errCount={errCount} />
        ) : mode === 'choose' ? (
          /* PASO 1: elegir camino */
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              ¿Cómo tenés tu lista hoy?
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <ChoiceCard
                icon={ClipboardPaste}
                title="La tengo en Excel o Google Sheets"
                description="Abrí tu planilla, seleccioná todo (Ctrl+A), copiá (Ctrl+C) y pegala acá."
                cta="Pegar"
                onClick={() => setMode('paste')}
              />
              <ChoiceCard
                icon={FileSpreadsheet}
                title="No tengo lista digital"
                description="Te damos una plantilla con ejemplos. La llenás en Excel y la subís acá."
                cta="Plantilla"
                onClick={() => setMode('upload')}
              />
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              💡 Si tenés pocos clientes (1 o 2), conviene cargarlos a mano desde la pantalla de Clientes.
            </p>
          </div>
        ) : mode === 'paste' ? (
          /* PASO 2A: pegar */
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 text-xs leading-relaxed">
              <strong className="text-primary">Cómo copiar de tu planilla:</strong>
              <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-foreground/80">
                <li>Abrí tu Excel o Google Sheets</li>
                <li>Asegurate que la <strong>primera fila</strong> tenga los títulos (Nombre, Teléfono, Servicio, Monto, Vencimiento)</li>
                <li>Seleccioná desde el título hasta el último cliente</li>
                <li>Apretá <kbd className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-mono">Ctrl+C</kbd> y volvé acá</li>
              </ol>
            </div>

            <textarea
              value={pasted}
              onChange={e => {
                setPasted(e.target.value)
                if (e.target.value.trim()) handleParse(e.target.value)
                else { setPreview(null); setParseError(null) }
              }}
              rows={10}
              autoFocus
              placeholder={`Pegá acá (Ctrl+V)

Ejemplo:
Nombre	Telefono	Servicio	Monto	Vencimiento
Juan Pérez	1123456789	Cuota mensual	15000	15/06/2026
María González	1198765432	Pase libre	25000	20/06/2026`}
              className="w-full rounded-md border border-input bg-background/40 px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            />

            {parseError && (
              <div role="alert" className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        ) : (
          /* PASO 2B: plantilla + subir */
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-primary/10 border border-primary/30 px-4 py-3 text-xs leading-relaxed">
              <strong className="text-primary">Cómo usar la plantilla:</strong>
              <ol className="list-decimal pl-5 mt-1.5 space-y-1 text-foreground/80">
                <li>Tocá <strong>Descargar</strong> abajo — viene con 3 ejemplos</li>
                <li>Abrila en Excel o Google Sheets, borrá los ejemplos y poné tus clientes</li>
                <li>Guardá el archivo y subilo con <strong>Subir</strong></li>
              </ol>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Button type="button" variant="outline" onClick={downloadTemplate} className="min-h-[48px]">
                <Download className="h-4 w-4" /> Descargar
              </Button>
              <Button type="button" onClick={() => fileRef.current?.click()} className="min-h-[48px]">
                <Upload className="h-4 w-4" /> Subir
              </Button>
              <input
                ref={fileRef} type="file"
                accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await onFile(f)
                  e.target.value = ''
                }}
              />
            </div>

            {parseError && (
              <div role="alert" className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          {preview && (
            <Button onClick={handleImport} disabled={busy || okCount === 0} className="min-h-[44px]">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {okCount === 0 ? 'Nada para importar' : `Importar ${okCount}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChoiceCard({
  icon: Icon, title, description, cta, onClick,
}: {
  icon: typeof ClipboardPaste
  title: string
  description: string
  cta: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-border bg-background/40 p-4 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99] transition-all flex flex-col gap-2 min-h-[140px]"
    >
      <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/15 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="text-xs text-muted-foreground leading-snug flex-1">{description}</p>
      <span className="text-xs font-medium text-primary mt-1">{cta} →</span>
    </button>
  )
}

function PreviewBlock({
  preview, okCount, errCount,
}: {
  preview: ParseResult
  okCount: number
  errCount: number
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* Mapping detectado */}
      <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-xs">
        <div className="uppercase tracking-wider text-muted-foreground mb-1.5">Columnas que detectamos</div>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-foreground">
          {Object.entries(preview.mapping).map(([key, idx]) => (
            <span key={key}>
              <strong className="text-primary capitalize">{key}</strong>{' '}
              {idx === -1
                ? <em className="text-muted-foreground">no la encontramos</em>
                : <>← "{preview.headers[idx]}"</>}
            </span>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm"><strong className="text-lg mr-1">{okCount}</strong> listos para cargar</span>
        </div>
        {errCount > 0 && (
          <div className="flex-1 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm"><strong className="text-lg mr-1">{errCount}</strong> con problemas (se saltean)</span>
          </div>
        )}
      </div>

      {/* Preview table */}
      <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Tel</th>
              <th className="px-3 py-2 font-medium">Servicio</th>
              <th className="px-3 py-2 font-medium">Monto</th>
              <th className="px-3 py-2 font-medium">Vence</th>
              <th className="px-3 py-2 font-medium">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map(r => (
              <tr key={r.rowNum} className={r.valid ? 'bg-success/[0.04]' : 'bg-destructive/[0.04] text-muted-foreground'}>
                <td className="px-3 py-2">{r.rowNum}</td>
                <td className="px-3 py-2">{r.nombre || <em>vacío</em>}</td>
                <td className="px-3 py-2">{r.telefono || '-'}</td>
                <td className="px-3 py-2">{r.servicio}</td>
                <td className="px-3 py-2">{!isNaN(r.monto) && r.monto > 0 ? formatCurrency(r.monto) : <span className="text-destructive line-through">inválido</span>}</td>
                <td className="px-3 py-2">{r.fecha ? formatDate(r.fecha) : <span className="text-destructive line-through">inválida</span>}</td>
                <td className="px-3 py-2">
                  {r.valid
                    ? <span className="inline-flex items-center gap-1 text-success font-medium"><CheckCircle2 className="h-3 w-3" /> Listo</span>
                    : <div className="flex flex-wrap gap-1">
                        {r.errors.map(e => <span key={e} className="bg-destructive/15 text-destructive px-1.5 py-0.5 rounded text-[10px]">{e}</span>)}
                      </div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
