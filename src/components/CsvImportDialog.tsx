import { useState } from 'react'
import { CheckCircle2, AlertCircle, LoaderCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useServicios } from '@/lib/useServicios'
import { parseCsv, type ParseResult } from '@/lib/csvImport'
import { formatCurrency, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function CsvImportDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth()
  const { servicios, refresh: refreshServicios } = useServicios()
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File) => {
    setParseError(null); setPreview(null)
    const text = await file.text()
    const result = parseCsv(text)
    if ('error' in result) { setParseError(result.error); return }
    setPreview(result)
  }

  const close = () => {
    setPreview(null); setParseError(null)
    onOpenChange(false)
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
    if (fail > 0) toast.error(`Importados ${ok}, ${fail} fallaron`)
    else toast.success(`¡${ok} cliente${ok === 1 ? '' : 's'} importado${ok === 1 ? '' : 's'}!`)
    onImported()
  }

  const okCount = preview ? preview.rows.filter(r => r.valid).length : 0
  const errCount = preview ? preview.rows.length - okCount : 0

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close() }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar clientes desde CSV</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background/40 px-6 py-12 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
              <span className="text-sm font-medium">Elegí tu archivo CSV</span>
              <span className="text-xs text-muted-foreground text-center max-w-sm">
                Detecta separadores `,` o `;`, fechas en formato DD/MM/YYYY y montos con `$`. <br />
                Si tu Excel tiene los encabezados en otro idioma, también los entiende.
              </span>
              <input
                type="file" accept=".csv" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (f) await onFile(f)
                  e.target.value = ''
                }}
              />
            </label>
            {parseError && (
              <div role="alert" className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2">{parseError}</div>
            )}
          </div>
        ) : (
          <>
            {/* Mapping detectado */}
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-xs">
              <div className="uppercase tracking-wider text-muted-foreground mb-1.5">Columnas detectadas</div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-foreground">
                {Object.entries(preview.mapping).map(([key, idx]) => (
                  <span key={key}>
                    <strong className="text-primary capitalize">{key}</strong>{' '}
                    {idx === -1
                      ? <em className="text-muted-foreground">no detectado</em>
                      : <>← "{preview.headers[idx]}"</>}
                  </span>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 text-success px-4 py-3">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm"><strong className="text-lg mr-1">{okCount}</strong> listos para importar</span>
              </div>
              {errCount > 0 && (
                <div className="flex-1 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-sm"><strong className="text-lg mr-1">{errCount}</strong> con errores (se saltean)</span>
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
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close}>Cancelar</Button>
          {preview && (
            <Button onClick={handleImport} disabled={busy || okCount === 0}>
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {okCount === 0 ? 'Nada para importar' : `Importar ${okCount} cliente${okCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
