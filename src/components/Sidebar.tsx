import { LayoutDashboard, Users, Receipt, Settings, LogOut, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  current: string
  onNavigate: (view: string) => void
}

const items = [
  { key: 'dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { key: 'clientes',     label: 'Clientes',      icon: Users },
  { key: 'recibos',      label: 'Recibos',       icon: Receipt },
  { key: 'configuracion', label: 'Configuración', icon: Settings },
]

export function Sidebar({ current, onNavigate }: SidebarProps) {
  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-border bg-card/30 backdrop-blur-sm px-4 py-6">
      <div className="flex items-center gap-2.5 px-2 mb-10">
        <div className="grid place-items-center h-9 w-9 rounded-lg bg-primary/15 text-primary">
          <Wallet className="h-5 w-5" />
        </div>
        <span className="text-lg font-semibold tracking-tight">CobroGest</span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {items.map(({ key, label, icon: Icon }) => {
          const active = current === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </button>
          )
        })}
      </nav>

      <button className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/90 hover:bg-destructive/10 transition-colors mb-4">
        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
        Cerrar sesión
      </button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <div className="grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground text-sm font-semibold">MM</div>
        <div className="flex flex-col">
          <span className="text-sm font-medium leading-tight">Mateo Mauro</span>
          <span className="text-xs text-muted-foreground">Mi cuenta</span>
        </div>
      </div>
    </aside>
  )
}

// Mobile bottom nav
export function BottomNav({ current, onNavigate }: SidebarProps) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/90 backdrop-blur-md grid grid-cols-4">
      {items.map(({ key, label, icon: Icon }) => {
        const active = current === key
        return (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
