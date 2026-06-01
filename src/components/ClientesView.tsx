import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Upload, Download, HandCoins, MessageCircle, Clock, Pencil, Trash2, CheckCircle2, Plus, Users, MoreHorizontal } from 'lucide-react'
import { Cliente, Estado, groupLabel, statusOrder } from '@/data/mock'
import { useClientes } from '@/lib/useClientes'
import { buildWhatsapp, useTemplates } from '@/lib/useTemplates'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/components/ConfirmDialog'
import { ClientFormDialog } from '@/components/ClientFormDialog'
import { PaymentDialog } from '@/components/PaymentDialog'
import { BulkPayDialog } from '@/components/BulkPayDialog'
import { WhatsAppQueueDialog } from '@/components/WhatsAppQueueDialog'
import { HistoryDialog } from '@/components/HistoryDialog'
import { CsvImportDialog } from '@/components/CsvImportDialog'
import { downloadFullBackup } from '@/lib/exportBackup'
import { cn, formatCurrency, formatDate, daysUntil, getInitials } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const estadoBadge = (e: Estado) => {
  if (e === 'al_dia')    return <Badge variant="success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Al día</Badge>
  if (e === 'pendiente') return <Badge variant="warning"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Pendiente</Badge>
  return                        <Badge variant="destructive"><span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Vencido</Badge>
}

const groupDot = (e: Estado) =>
  e === 'al_dia'    ? 'bg-success'
  : e === 'pendiente' ? 'bg-warning'
  :                     'bg-destructive'

export function ClientesView() {
  const { user } = useAuth()
  const { clientes, loading, error, refresh } = useClientes()
  const { templates } = useTemplates()
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Estado>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Diálogos
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [paymentClient, setPaymentClient] = useState<Cliente | null>(null)
  const [bulkPayOpen, setBulkPayOpen] = useState(false)
  const [wpQueueOpen, setWpQueueOpen] = useState(false)
  const [historyClient, setHistoryClient] = useState<Cliente | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  const filtered = useMemo(() => {
    return clientes
      .filter(c => filter === 'all' || c.estado === filter)
      .filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => statusOrder[a.estado] - statusOrder[b.estado])
  }, [clientes, search, filter])

  const grouped = useMemo(() => {
    const map = new Map<Estado, Cliente[]>()
    filtered.forEach(c => {
      if (!map.has(c.estado)) map.set(c.estado, [])
      map.get(c.estado)!.push(c)
    })
    return Array.from(map.entries())
  }, [filtered])

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleGroup = (estado: Estado, allChecked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev)
      filtered.filter(c => c.estado === estado).forEach(c => {
        if (allChecked) next.delete(c.id); else next.add(c.id)
      })
      return next
    })
  }
  const selectAll = () => setSelected(new Set(filtered.map(c => c.id)))
  const clear = () => setSelected(new Set())

  const selectedClients = filtered.filter(c => selected.has(c.id))
  const selectedConDeuda = selectedClients.filter(c => c.estado !== 'al_dia')
  const wpTargets = selectedConDeuda.filter(c => c.telefono)
  const totalSelected = selectedConDeuda.reduce((s, c) => s + c.monto, 0)

  const openNuevo = () => { setEditing(null); setFormOpen(true) }

  // Soporte para deep-link "/clientes?new=1" desde el onboarding -> abre el form
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      openNuevo()
      // limpio el query param para que no re-abra el form al navegar back
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const openEditar = (c: Cliente) => { setEditing(c); setFormOpen(true) }
  const openCobro = (c: Cliente) => setPaymentClient(c)
  const closeCobro = (open: boolean) => { if (!open) setPaymentClient(null) }

  const handleDelete = async (c: Cliente) => {
    if (!user) return
    const ok = await confirm({
      title: 'Eliminar cliente',
      description: `Vas a eliminar a "${c.nombre}" y todo su historial de pagos. Esta acción no se puede deshacer.`,
      confirmText: 'Sí, eliminar',
      variant: 'destructive',
    })
    if (!ok) return
    const { error: err } = await supabase.from('clientes').delete()
      .eq('id', c.id).eq('usuario_id', user.id)
    if (err) toast.error('No se pudo eliminar: ' + err.message)
    else { toast.success('Cliente eliminado'); refresh() }
  }

  const handleRowWhatsapp = (c: Cliente) => {
    const { url } = buildWhatsapp(c, templates)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleBulkPaid = () => {
    if (selectedConDeuda.length === 0) return
    setBulkPayOpen(true)
  }

  const handleBulkWhatsapp = () => {
    if (wpTargets.length === 0) return
    setWpQueueOpen(true)
  }

  const afterBulkAction = () => {
    setSelected(new Set())
    refresh()
  }

  const exportCsv = async () => {
    if (!user) return
    if (clientes.length === 0) { toast.info('No hay clientes para exportar'); return }
    const result = await downloadFullBackup({ userId: user.id })
    if (!result.ok) toast.error('No se pudo exportar: ' + result.error)
    else toast.success(`Exportado: ${result.clientesCount} clientes, ${result.pagosCount} pagos`)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gestión de clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-display italic text-base text-foreground/80">{new Date().toLocaleDateString('es-AR', { month: 'long' })}</span>{' '}
            de {new Date().getFullYear()} · {clientes.length} alumno{clientes.length === 1 ? '' : 's'} cargado{clientes.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={openNuevo}>
          <Plus className="h-4 w-4" /> Nuevo cliente
        </Button>
      </div>

      {/* Error real de Supabase */}
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-center justify-between gap-3">
          <span>Error cargando clientes: {error}</span>
          <Button variant="outline" size="sm" onClick={refresh}>Reintentar</Button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar alumno..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="vencido">Vencidos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="al_dia">Al día</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
            <Upload className="h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-10 flex items-center flex-wrap gap-3 rounded-xl border border-primary/30 bg-primary/10 backdrop-blur-md px-4 py-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-primary text-base">{selected.size}</span>
            seleccionados · total <span className="font-semibold text-success">{formatCurrency(totalSelected)}</span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>Seleccionar todos ({filtered.length})</Button>
            <Button variant="whatsapp" size="sm" disabled={wpTargets.length === 0} onClick={handleBulkWhatsapp}>
              <MessageCircle className="h-4 w-4" />
              Recordar a {wpTargets.length}
            </Button>
            <Button variant="success" size="sm" disabled={selectedConDeuda.length === 0} onClick={handleBulkPaid}>
              <HandCoins className="h-4 w-4" />
              Cobrar a {selectedConDeuda.length}
            </Button>
            <Button variant="ghost" size="sm" onClick={clear}>Deseleccionar</Button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[auto_minmax(180px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(100px,1fr)_auto] gap-x-4 px-4 py-3 border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <div className="w-[18px]" aria-hidden />
          <div>Cliente</div>
          <div>Plan</div>
          <div>Vencimiento</div>
          <div>Monto</div>
          <div>Estado</div>
          <div className="text-right">Acciones</div>
        </div>

        {loading ? (
          <div className="divide-y divide-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[auto_minmax(180px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(100px,1fr)_auto] gap-x-4 items-center px-4 py-3.5">
                <Skeleton className="h-[18px] w-[18px] rounded-[5px]" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))}
          </div>
        ) : clientes.length === 0 ? (
          <div className="px-6 py-16 grid place-items-center gap-3 text-center">
            <div className="grid place-items-center h-14 w-14 rounded-full bg-primary/15 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-base font-semibold">Cargá tu primer cliente</h2>
            <p className="text-sm text-muted-foreground max-w-[360px] leading-relaxed">
              Acá vas a ver el estado de cada alumno: quién pagó, quién debe y a quién reclamarle.
            </p>
            <Button onClick={openNuevo} className="mt-2">
              <Plus className="h-4 w-4" /> Agregar cliente
            </Button>
          </div>
        ) : grouped.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No se encontraron clientes para esos filtros.
          </div>
        ) : (
          grouped.map(([estado, list]) => {
            const allChecked = list.every(c => selected.has(c.id))
            const someChecked = list.some(c => selected.has(c.id))
            return (
              <div key={estado}>
                {/* Group header */}
                <div className="grid grid-cols-[auto_1fr] items-center gap-3 px-4 py-2.5 bg-background/40 border-b border-border">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                    onCheckedChange={() => toggleGroup(estado, allChecked)}
                    aria-label={`Seleccionar todos los ${groupLabel(estado)}`}
                  />
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', groupDot(estado))} />
                    {groupLabel(estado)} · {list.length}
                  </div>
                </div>
                {list.map(c => (
                  <ClientRow
                    key={c.id} c={c}
                    checked={selected.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                    onPay={() => openCobro(c)}
                    onWhatsapp={() => handleRowWhatsapp(c)}
                    onHistory={() => setHistoryClient(c)}
                    onEdit={() => openEditar(c)}
                    onDelete={() => handleDelete(c)}
                  />
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Diálogos */}
      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={refresh} />
      <PaymentDialog client={paymentClient} onOpenChange={closeCobro} onPaid={refresh} />
      <BulkPayDialog open={bulkPayOpen} onOpenChange={setBulkPayOpen} targets={selectedConDeuda} onDone={afterBulkAction} />
      <WhatsAppQueueDialog open={wpQueueOpen} onOpenChange={setWpQueueOpen} queue={wpTargets} />
      <HistoryDialog client={historyClient} onOpenChange={(o) => { if (!o) setHistoryClient(null) }} />
      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} onImported={refresh} />
    </div>
  )
}

function ClientRow({
  c, checked, onToggle, onPay, onWhatsapp, onHistory, onEdit, onDelete,
}: {
  c: Cliente
  checked: boolean
  onToggle: () => void
  onPay: () => void
  onWhatsapp: () => void
  onHistory: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const days = daysUntil(c.fecha_vencimiento)
  const daysLabel =
    days < 0   ? `Hace ${Math.abs(days)} días`
    : days === 0 ? 'Vence hoy'
    : `En ${days} días`
  const daysTone =
    days < 0   ? 'text-destructive'
    : days <= 5 ? 'text-warning'
    : 'text-muted-foreground'

  return (
    <div className={cn(
      'grid grid-cols-[auto_minmax(180px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(100px,1fr)_auto] gap-x-4 items-center px-4 py-3.5 border-b border-border/60 hover:bg-accent/30 transition-colors',
      checked && 'bg-primary/[0.04]'
    )}>
      <Checkbox checked={checked} onCheckedChange={onToggle} aria-label={`Seleccionar a ${c.nombre}`} />

      <div className="flex items-center gap-3 min-w-0">
        <div className="grid place-items-center h-9 w-9 rounded-full bg-primary/15 text-primary text-xs font-semibold shrink-0">
          {getInitials(c.nombre)}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{c.nombre}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{c.telefono}</div>
        </div>
      </div>

      <div className="text-sm text-foreground/80 truncate">{c.servicio}</div>

      <div className="text-sm">
        <div className="font-medium tabular-nums">{formatDate(c.fecha_vencimiento)}</div>
        <div className={cn('text-xs', daysTone)}>{daysLabel}</div>
      </div>

      <div className="text-sm font-semibold tabular-nums">{formatCurrency(c.monto)}</div>

      <div>{estadoBadge(c.estado)}</div>

      <div className="flex items-center justify-end gap-1">
        {/* Acción primaria: Cobrar (o badge Cobrado) */}
        {c.estado !== 'al_dia' ? (
          <Button variant="success" size="sm" className="h-8 px-2.5 text-xs" onClick={onPay}>
            <HandCoins className="h-3.5 w-3.5" /> Cobrar
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-medium text-success pr-1">
            <CheckCircle2 className="h-4 w-4" /> Cobrado
          </div>
        )}

        {/* WhatsApp queda visible (es la acción más frecuente) */}
        {c.telefono && (
          <Button
            variant="ghost" size="icon" onClick={onWhatsapp}
            className="h-8 w-8 text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10"
            aria-label={`Enviar WhatsApp a ${c.nombre}`}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        )}

        {/* Menú con el resto: Historial / Editar / Eliminar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Más acciones para ${c.nombre}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onHistory}>
              <Clock /> Ver historial de pagos
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Editar datos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={onDelete}>
              <Trash2 /> Eliminar cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
