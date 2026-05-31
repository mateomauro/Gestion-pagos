import { FormEvent, useState } from 'react'
import { Wallet, LoaderCircle, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Mode = 'signin' | 'signup' | 'forgot'

export function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<null | 'email' | 'google'>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const clearMessages = () => { setError(null); setInfo(null) }
  const switchMode = (m: Mode) => { setMode(m); clearMessages() }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    clearMessages(); setBusy('email')

    if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      })
      setBusy(null)
      if (err) { setError(err.message); return }
      setInfo('Te mandamos un mail con un link para restablecer tu contraseña. Revisá la bandeja de entrada (y el spam).')
      return
    }

    const fn = mode === 'signin'
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password })

    const { error: err } = await fn
    setBusy(null)
    if (err) { setError(err.message); return }
    if (mode === 'signup') setInfo('¡Cuenta creada! Ya podés ingresar.')
  }

  const google = async () => {
    clearMessages(); setBusy('google')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (err) { setBusy(null); setError(err.message) }
  }

  const headerSub: Record<Mode, string> = {
    signin: 'Ingresá para gestionar tus cobros',
    signup: 'Creá tu cuenta para empezar',
    forgot: 'Te mandamos un link a tu email para restablecerla',
  }
  const submitLabel: Record<Mode, string> = {
    signin: 'Ingresar',
    signup: 'Crear cuenta',
    forgot: 'Enviar link de recuperación',
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-background">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="grid place-items-center h-12 w-12 rounded-xl bg-primary/15 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {mode === 'forgot' ? 'Recuperar contraseña' : 'CobroGest'}
          </h1>
          <p className="text-sm text-muted-foreground text-center">{headerSub[mode]}</p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <Input
              id="email" type="email" required autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <Input
                id="password" type="password" required minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Al menos 6 caracteres' : '••••••'}
              />
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-md bg-destructive/15 text-destructive text-sm px-3 py-2">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-md bg-success/15 text-success text-sm px-3 py-2 leading-relaxed">
              {info}
            </div>
          )}

          <Button type="submit" disabled={busy !== null} className="mt-1">
            {busy === 'email' && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitLabel[mode]}
          </Button>

          {mode === 'forgot' ? (
            <Button type="button" variant="ghost" onClick={() => switchMode('signin')}>
              <ArrowLeft className="h-4 w-4" /> Volver al login
            </Button>
          ) : (
            <Button
              type="button" variant="outline"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? '¿No tenés cuenta? Creá una' : '¿Ya tenés cuenta? Ingresá'}
            </Button>
          )}
        </form>

        {/* Divider + Google: solo en signin/signup, NO en forgot */}
        {mode !== 'forgot' && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">o</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <button
              type="button" onClick={google} disabled={busy !== null}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-md bg-white text-zinc-900 font-medium text-sm shadow-sm hover:bg-zinc-50 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {busy === 'google' ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="" width={20} height={20} />
              )}
              Continuar con Google
            </button>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6 leading-relaxed">
          Al ingresar aceptás los <a href="/terminos" target="_blank" className="text-primary hover:underline">Términos</a>{' '}
          y la <a href="/privacidad" target="_blank" className="text-primary hover:underline">Política de Privacidad</a>.
        </p>
      </div>
    </div>
  )
}
