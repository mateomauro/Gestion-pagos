import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet, MessageCircle, Receipt, FileSpreadsheet, Shield, ArrowRight,
  CheckCircle2, Sparkles, Plus, Clock, AlertCircle, Users, LineChart, Lock,
} from 'lucide-react'
import { SUPPORT_WHATSAPP } from '@/lib/supabase'
import { useInView } from '@/lib/useInView'
import { Button } from '@/components/ui/button'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased overflow-hidden">
      <Nav />
      <Hero />
      <ParaQuien />
      <Features />
      <ComoFunciona />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}

/* ============================= NAV ============================== */
function Nav() {
  return (
    <nav className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border/60">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="grid place-items-center h-8 w-8 rounded-lg bg-primary/15 text-primary transition-transform group-hover:scale-110 group-hover:rotate-3">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">CobroGest</span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <a href="#features" className="hidden sm:inline-block text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors">Cómo es</a>
          <a href="#faq" className="hidden sm:inline-block text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md transition-colors">FAQ</a>
          <Button asChild size="sm" variant="outline">
            <Link to="/login">Ingresar</Link>
          </Button>
        </div>
      </div>
    </nav>
  )
}

/* ============================= HERO ============================== */
function Hero() {
  return (
    <section className="relative">
      <div
        className="absolute inset-0 pointer-events-none opacity-90 anim-bg-pan"
        style={{
          backgroundImage:
            'radial-gradient(at 70% -10%, hsl(var(--primary) / 0.18) 0px, transparent 50%), radial-gradient(at 10% 60%, hsl(var(--success) / 0.10) 0px, transparent 50%), radial-gradient(at 90% 90%, hsl(var(--warning) / 0.08) 0px, transparent 50%)',
        }}
      />

      <div className="relative max-w-6xl mx-auto px-6 pt-20 md:pt-28 pb-16 md:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <div>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground mb-6 anim-fade-up"
            style={{ animationDelay: '0.05s' }}
          >
            <span className="relative grid place-items-center h-1.5 w-1.5 rounded-full bg-success">
              <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
            </span>
            Plataforma en beta · Hecho en Argentina 🇦🇷
          </span>

          <h1
            className="font-display text-[clamp(48px,7vw,84px)] leading-[1.02] text-foreground text-balance anim-fade-up"
            style={{ animationDelay: '0.15s' }}
          >
            Cobrá <em className="not-italic font-display italic text-primary">a tiempo</em>,<br />
            sin Excel ni planillas.
          </h1>

          <p
            className="mt-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl anim-fade-up"
            style={{ animationDelay: '0.3s' }}
          >
            CobroGest es la herramienta simple que usan gimnasios y academias para llevar el control de los cobros, vencimientos y deudores. Cargás tus alumnos una vez y nunca más perdés un cobro de vista.
          </p>

          <div
            className="mt-8 flex flex-wrap items-center gap-3 anim-fade-up"
            style={{ animationDelay: '0.45s' }}
          >
            <Button asChild size="lg" className="group">
              <Link to="/login">
                Empezar gratis 30 días
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <a href="#features">Ver cómo funciona</a>
            </Button>
          </div>

          <ul
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground anim-fade-up"
            style={{ animationDelay: '0.6s' }}
          >
            {['Sin tarjeta de crédito', 'Configuración en 5 minutos', 'Sin instalar nada'].map(t => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        {/* Mockup con float sutil */}
        <div className="anim-fade-up" style={{ animationDelay: '0.4s' }}>
          <div className="anim-float">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

/* CSS-only mockup que se ve como la app real */
function DashboardMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-tr from-primary/20 via-transparent to-success/15 rounded-3xl blur-2xl pointer-events-none anim-glow" />
      <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/40">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-background/40">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <MiniKpi icon={<LineChart />} label="Cobrado"    value="$ 320.000" tone="success"     pct={68} />
          <MiniKpi icon={<Clock />}     label="Pendiente"  value="$ 96.000"  tone="warning"     pct={20} />
          <MiniKpi icon={<AlertCircle />} label="Vencido"  value="$ 54.000"  tone="destructive" pct={12} />
          <MiniKpi icon={<Users />}     label="Alumnos"    value="48"        tone="primary" />
        </div>
        <div className="px-5 pb-5">
          <div className="rounded-lg border border-border divide-y divide-border/60">
            <MiniRow name="María González" badge="Vencido"   badgeTone="destructive" amount="$ 35.000" />
            <MiniRow name="Juan Pérez"     badge="Pendiente" badgeTone="warning"     amount="$ 15.000" />
            <MiniRow name="Sofía Vázquez"  badge="Al día"    badgeTone="success"     amount="$ 25.000" />
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniKpi({ icon, label, value, tone, pct }: { icon: ReactNode; label: string; value: string; tone: 'primary' | 'success' | 'warning' | 'destructive'; pct?: number }) {
  const toneCls = {
    primary:     { bg: 'bg-primary/15',     text: 'text-primary',     fill: 'bg-primary' },
    success:     { bg: 'bg-success/15',     text: 'text-success',     fill: 'bg-success' },
    warning:     { bg: 'bg-warning/15',     text: 'text-warning',     fill: 'bg-warning' },
    destructive: { bg: 'bg-destructive/15', text: 'text-destructive', fill: 'bg-destructive' },
  }[tone]
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className={`grid place-items-center h-6 w-6 rounded-md ${toneCls.bg} ${toneCls.text} [&_svg]:h-3 [&_svg]:w-3`}>{icon}</div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {pct !== undefined && (
        <div className="h-1 rounded-full bg-secondary overflow-hidden">
          <div className={`h-full ${toneCls.fill}`} style={{ width: `${pct}%`, transition: 'width 1s ease-out' }} />
        </div>
      )}
    </div>
  )
}

function MiniRow({ name, badge, badgeTone, amount }: { name: string; badge: string; badgeTone: 'success' | 'warning' | 'destructive'; amount: string }) {
  const cls = {
    success:     'bg-success/15 text-success',
    warning:     'bg-warning/15 text-warning',
    destructive: 'bg-destructive/15 text-destructive',
  }[badgeTone]
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-full bg-primary/15 text-primary text-[10px] font-semibold grid place-items-center shrink-0">
          {name.split(' ').map(n => n[0]).join('').substring(0, 2)}
        </div>
        <span className="text-xs font-medium truncate">{name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-[10px] font-medium uppercase tracking-wide rounded-full px-2 py-0.5 ${cls}`}>{badge}</span>
        <span className="text-xs font-semibold tabular-nums w-20 text-right">{amount}</span>
      </div>
    </div>
  )
}

/* ========================= PARA QUIÉN ========================= */
function ParaQuien() {
  const { ref, inView } = useInView<HTMLDivElement>()
  const items = ['Gimnasios', 'Academias', 'Profes particulares', 'Clases grupales', 'Crossfit / yoga', 'Pilates']
  return (
    <section className="border-y border-border/60 bg-card/30">
      <div
        ref={ref}
        className={`max-w-6xl mx-auto px-6 py-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground scroll-anim ${inView ? 'is-visible' : ''}`}
      >
        <span className="uppercase tracking-wider text-xs">Pensado para</span>
        {items.map((it, i) => (
          <span
            key={it}
            className="font-medium text-foreground/70 transition-all duration-700"
            style={{ transitionDelay: `${i * 60}ms`, opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(8px)' }}
          >
            {it}
          </span>
        ))}
      </div>
    </section>
  )
}

/* =========================== FEATURES =========================== */
const features = [
  { icon: <Wallet />,           title: 'Panel de control claro',     desc: 'Cuánto te tienen que pagar este mes, cuánto ya entró, quién te debe. En un solo vistazo, en vez de mil pestañas de Excel.' },
  { icon: <MessageCircle />,    title: 'Recordatorios por WhatsApp', desc: 'Plantilla personalizable con el nombre, monto y fecha. Mandás a uno o a todos los pendientes con la cola guiada.' },
  { icon: <Receipt />,          title: 'Recibos PDF profesionales',  desc: 'Cobrás → se genera un comprobante con tu marca, listo para mandar por WhatsApp. Tu alumno ve un recibo de empresa, no un mensaje cualquiera.' },
  { icon: <FileSpreadsheet />,  title: 'Migrá tu Excel en 2 minutos',desc: 'Importás tu archivo, te muestra una vista previa con qué se va a crear y qué falta. Sin pegar nombre por nombre.' },
  { icon: <Sparkles />,         title: 'Estado automático',          desc: 'CobroGest entiende solo cuándo un alumno pasa de Al día → Pendiente → Vencido según la fecha. No tenés que mover nada.' },
  { icon: <Shield />,           title: 'Cada uno ve solo lo suyo',   desc: 'Multi-tenant con Row Level Security: tu base de datos está aislada de otros gimnasios. Nadie ve a tus alumnos, ni siquiera por error.' },
]

function Features() {
  const heading = useInView<HTMLDivElement>()
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div ref={heading.ref} className={`scroll-anim ${heading.inView ? 'is-visible' : ''}`}>
          <SectionEyebrow>Lo que te da</SectionEyebrow>
          <h2 className="font-display text-[clamp(32px,5vw,56px)] leading-[1.05] text-balance max-w-3xl">
            Diseñado para <em className="not-italic font-display italic text-primary">ordenarte la cabeza</em>, no para sumarte trabajo.
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl leading-relaxed">
            Cada feature responde a un problema real de un gimnasio chico. Nada de complejidad por complejidad.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
          {features.map((f, i) => <FeatureCard key={i} feature={f} index={i} />)}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ feature, index }: { feature: typeof features[number]; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="group flex flex-col gap-4 bg-card p-7 transition-all duration-500 hover:bg-card/60 relative overflow-hidden"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 80}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 80}ms, background-color 0.3s`,
      }}
    >
      {/* Glow del hover */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary/0 group-hover:bg-primary/10 blur-3xl transition-colors duration-500 pointer-events-none" />

      <div className="grid place-items-center h-10 w-10 rounded-lg bg-primary/12 text-primary [&_svg]:h-5 [&_svg]:w-5 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
        {feature.icon}
      </div>
      <div className="relative">
        <h3 className="font-semibold tracking-tight text-foreground">{feature.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{feature.desc}</p>
      </div>
    </div>
  )
}

/* ========================= CÓMO FUNCIONA ========================= */
const pasos = [
  { n: '1', title: 'Cargás tus alumnos',         desc: 'A mano o importando tu Excel. Te lleva 2 minutos.' },
  { n: '2', title: 'Cobrás como cobrás hoy',     desc: 'Efectivo o transferencia. Lo registrás en CobroGest con un click. Se genera el recibo.' },
  { n: '3', title: 'CobroGest hace el seguimiento', desc: 'Te avisa quién vence, mandás recordatorios masivos. Tu cabeza queda libre.' },
]
function ComoFunciona() {
  const heading = useInView<HTMLDivElement>()
  return (
    <section className="py-20 md:py-28 bg-card/30 border-y border-border/60">
      <div className="max-w-6xl mx-auto px-6">
        <div ref={heading.ref} className={`scroll-anim ${heading.inView ? 'is-visible' : ''}`}>
          <SectionEyebrow>Tres pasos</SectionEyebrow>
          <h2 className="font-display text-[clamp(32px,5vw,56px)] leading-[1.05] max-w-2xl">
            Empezás hoy, <em className="not-italic font-display italic text-primary">cobrás mejor</em> mañana.
          </h2>
        </div>

        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {pasos.map((p, i) => <Paso key={p.n} paso={p} index={i} />)}
        </div>
      </div>
    </section>
  )
}

function Paso({ paso, index }: { paso: typeof pasos[number]; index: number }) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className="rounded-xl border border-border bg-background/40 p-7 flex flex-col gap-4 hover:border-primary/40 hover:bg-background/60 transition-all duration-300"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 120}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${index * 120}ms, border-color 0.3s, background-color 0.3s`,
      }}
    >
      <span className="font-display text-5xl text-primary/80 leading-none font-medium">{paso.n}</span>
      <h3 className="font-semibold tracking-tight">{paso.title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{paso.desc}</p>
    </div>
  )
}

/* ============================= FAQ ============================= */
const faq = [
  { q: '¿Cuánto sale?', a: 'Los primeros 30 días son gratis sin tarjeta. Después arrancamos en $20.000 a $40.000 ARS por mes según la cantidad de alumnos, hablamos cuando se acerca el vencimiento.' },
  { q: '¿Mis alumnos tienen que descargarse una app?', a: 'No. CobroGest lo usás solo vos. Tus alumnos reciben recordatorios y comprobantes por WhatsApp normal, como hacés hoy.' },
  { q: '¿Es seguro tener mis datos acá?', a: 'Sí. La base de datos usa Row Level Security: tu información está aislada del resto y solo accesible con tu cuenta. Si querés borrar todo, te exporto un CSV y elimino la cuenta en menos de 24 horas.' },
  { q: '¿Y si quiero volver a Excel?', a: 'Tenés "Exportar CSV" siempre disponible. Sin lock-in.' },
  { q: '¿Funciona en celu?', a: 'Sí, es responsive. Pero la mejor experiencia para gestionar cobros es desde la compu.' },
  { q: '¿Me podés ayudar con la migración?', a: 'Sí. Mandame tu Excel por WhatsApp y lo importo yo. Es parte del onboarding.' },
]

function FAQ() {
  const heading = useInView<HTMLDivElement>()
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-6">
        <div ref={heading.ref} className={`scroll-anim ${heading.inView ? 'is-visible' : ''}`}>
          <SectionEyebrow>FAQ</SectionEyebrow>
          <h2 className="font-display text-[clamp(32px,5vw,48px)] leading-[1.05]">
            Preguntas <em className="not-italic font-display italic text-primary">frecuentes</em>.
          </h2>
        </div>
        <div className="mt-10 space-y-2">
          {faq.map((f, i) => <FAQItem key={i} f={f} index={i} />)}
        </div>
      </div>
    </section>
  )
}

function FAQItem({ f, index }: { f: { q: string; a: string }; index: number }) {
  const { ref, inView } = useInView<HTMLDetailsElement>()
  return (
    <details
      ref={ref}
      className="group rounded-xl border border-border bg-card/40 px-5 hover:border-primary/30 transition-all duration-500 [&_summary::-webkit-details-marker]:hidden"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(12px)',
        transitionDelay: `${index * 60}ms`,
      }}
    >
      <summary className="cursor-pointer list-none flex items-center justify-between gap-4 py-4 font-medium text-foreground">
        {f.q}
        <Plus className="h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-300 group-open:rotate-45 group-hover:text-primary" />
      </summary>
      <p className="pb-4 -mt-1 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
    </details>
  )
}

/* =========================== FINAL CTA =========================== */
function FinalCTA() {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <section className="py-20 md:py-28">
      <div
        ref={ref}
        className={`max-w-3xl mx-auto px-6 text-center scroll-anim ${inView ? 'is-visible' : ''}`}
      >
        <h2 className="font-display text-[clamp(36px,6vw,64px)] leading-[1.02] text-balance">
          Empezá hoy. <em className="not-italic font-display italic text-primary">Después agradeces.</em>
        </h2>
        <p className="mt-5 text-muted-foreground max-w-md mx-auto">
          30 días sin tarjeta, sin compromiso. Si no te sirve, exportás tu data y listo.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="group">
            <Link to="/login">
              Empezar gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> Hablar con Mateo
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ============================ FOOTER ============================ */
function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <div className="grid place-items-center h-7 w-7 rounded-md bg-primary/15 text-primary">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-medium text-foreground">CobroGest</span>
          <span className="text-xs">© 2026 · Hecho en Tandil 🇦🇷</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/terminos" className="hover:text-foreground transition-colors">Términos</Link>
          <Link to="/privacidad" className="hover:text-foreground transition-colors flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Privacidad
          </Link>
          <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Contacto</a>
        </div>
      </div>
    </footer>
  )
}

/* ============================ HELPERS ============================ */
function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-primary mb-3">
      {children}
    </p>
  )
}
