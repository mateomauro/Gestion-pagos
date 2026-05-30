import { LayoutDashboard, Users, Receipt, Settings, LogOut, Wallet } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'

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

// Resuelve el display name del usuario logueado (Google full_name → email → fallback)
function useUserDisplay() {
  const { user } = useAuth()
  if (!user) return { name: '', email: '', initials: '?', avatar: null as string | null }
  const meta = (user.user_metadata ?? {}) as { full_name?: string; avatar_url?: string }
  const name = meta.full_name || user.email?.split('@')[0] || 'Usuario'
  return {
    name,
    email: user.email ?? '',
    initials: getInitials(name),
    avatar: meta.avatar_url ?? null,
  }
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const { signOut } = useAuth()
  const { name, initials, avatar } = useUserDisplay()

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Sesión cerrada')
    } catch (e: any) {
      toast.error('No se pudo cerrar la sesión: ' + (e?.message || 'error desconocido'))
    }
  }

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

      <button
        onClick={handleSignOut}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive/90 hover:bg-destructive/10 transition-colors mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
        Cerrar sesión
      </button>

      <div className="flex items-center gap-3 border-t border-border pt-4">
        {avatar ? (
          <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="grid place-items-center h-9 w-9 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
            {initials}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium leading-tight truncate">{name}</span>
          <span className="text-xs text-muted-foreground">Mi cuenta</span>
        </div>
      </div>
    </aside>
  )
}

// Mobile bottom nav
export function BottomNav({ current, onNavigate }: SidebarProps) {
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Sesión cerrada')
    } catch (e: any) {
      toast.error('No se pudo cerrar la sesión: ' + (e?.message || 'error desconocido'))
    }
  }

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/90 backdrop-blur-md grid grid-cols-5">
      {items.map(({ key, label, icon: Icon }) => {
        const active = current === key
        return (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
            {label}
          </button>
        )
      })}
      <button
        onClick={handleSignOut}
        className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-destructive/90 hover:text-destructive transition-colors"
      >
        <LogOut className="h-5 w-5" strokeWidth={1.75} />
        Salir
      </button>
    </nav>
  )
}
