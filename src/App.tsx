import { lazy, Suspense, ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { LoaderCircle, MessageCircle } from 'lucide-react'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/lib/auth'
import { SUPPORT_WHATSAPP } from '@/lib/supabase'
import { Sidebar, BottomNav } from '@/components/Sidebar'
import { TrialBanner } from '@/components/TrialBanner'
import { LoginScreen } from '@/components/LoginScreen'
import { ExpiredScreen } from '@/components/ExpiredScreen'
import { LandingPage } from '@/components/LandingPage'
import { TerminosPage, PrivacidadPage } from '@/components/LegalPage'
import { ResetPasswordScreen } from '@/components/ResetPasswordScreen'
import { ConfirmProvider } from '@/components/ConfirmDialog'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Code splitting: cada vista en su propio chunk
const DashboardView     = lazy(() => import('@/components/DashboardView').then(m => ({ default: m.DashboardView })))
const ClientesView      = lazy(() => import('@/components/ClientesView').then(m => ({ default: m.ClientesView })))
const RecibosView       = lazy(() => import('@/components/RecibosView').then(m => ({ default: m.RecibosView })))
const ConfiguracionView = lazy(() => import('@/components/ConfiguracionView').then(m => ({ default: m.ConfiguracionView })))

function FullScreenLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

function RouteFallback() {
  return (
    <div className="grid place-items-center min-h-[60vh]">
      <LoaderCircle className="h-5 w-5 animate-spin text-primary/70" />
    </div>
  )
}

function SupportFab() {
  return (
    <a
      href={`https://wa.me/${SUPPORT_WHATSAPP}`}
      target="_blank" rel="noopener noreferrer"
      className="fixed right-6 bottom-24 md:bottom-6 z-40 grid place-items-center h-14 w-14 rounded-full bg-[#25D366] text-white shadow-xl hover:scale-105 active:scale-95 transition-transform"
      aria-label="Hablar con soporte por WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  )
}

/* ----- AppShell: layout autenticado ----- */
function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const current = location.pathname.split('/')[1] || 'dashboard'
  const { subscription } = useAuth()

  return (
    <div className="flex min-h-screen">
      <Sidebar current={current} onNavigate={(view) => navigate(`/${view}`)} />
      <main className="flex-1 min-w-0 px-5 md:px-10 py-8 md:py-10 pb-24 md:pb-10 max-w-[1500px] w-full mx-auto">
        {subscription.state === 'active' && subscription.daysLeft !== null && (
          <TrialBanner daysLeft={subscription.daysLeft} />
        )}
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>{children}</Suspense>
        </ErrorBoundary>
      </main>
      <SupportFab />
      <BottomNav current={current} onNavigate={(view) => navigate(`/${view}`)} />
    </div>
  )
}

/* ----- AuthGuard: protege las rutas de la app ----- */
function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading, subscription } = useAuth()
  const location = useLocation()

  if (loading || (user && subscription.state === 'loading')) return <FullScreenLoader />

  if (!user) {
    // Preservar el path original para volver después del login
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (subscription.state === 'expired' || subscription.state === 'none') {
    return <ExpiredScreen tipo={subscription.tipo} />
  }

  return <AppShell>{children}</AppShell>
}

/* ----- LoginGuard: redirige a la app si ya hay sesión ----- */
function LoginGuard() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from || '/dashboard'

  if (loading) return <FullScreenLoader />
  if (user) return <Navigate to={from} replace />
  return <LoginScreen />
}

export function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <Routes>
              {/* Públicas */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginGuard />} />
              <Route path="/terminos" element={<TerminosPage />} />
              <Route path="/privacidad" element={<PrivacidadPage />} />
              <Route path="/reset" element={<ResetPasswordScreen />} />

              {/* Protegidas (requieren auth + suscripción activa) */}
              <Route path="/dashboard"     element={<AuthGuard><DashboardView /></AuthGuard>} />
              <Route path="/clientes"      element={<AuthGuard><ClientesView /></AuthGuard>} />
              <Route path="/recibos"       element={<AuthGuard><RecibosView /></AuthGuard>} />
              <Route path="/configuracion" element={<AuthGuard><ConfiguracionView /></AuthGuard>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster theme="dark" position="top-right" richColors closeButton toastOptions={{ className: 'font-sans' }} />
        </ConfirmProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
