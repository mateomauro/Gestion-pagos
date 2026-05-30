import { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, ArrowLeft } from 'lucide-react'
import { SUPPORT_WHATSAPP } from '@/lib/supabase'

function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-40 backdrop-blur-md bg-background/75 border-b border-border/60">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid place-items-center h-8 w-8 rounded-lg bg-primary/15 text-primary">
              <Wallet className="h-4.5 w-4.5" />
            </div>
            <span className="font-semibold tracking-tight">CobroGest</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <h1 className="font-display text-[clamp(36px,5vw,60px)] leading-[1.05] tracking-[-0.02em] mb-3">{title}</h1>
        <p className="text-sm text-muted-foreground mb-12">Última actualización: mayo de 2026</p>

        <div className="prose prose-invert max-w-none [&_h2]:font-semibold [&_h2]:text-xl [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:my-3 [&_ul]:my-3 [&_li]:text-muted-foreground [&_li]:leading-relaxed [&_li]:my-1.5 [&_a]:text-primary [&_a]:underline [&_strong]:text-foreground [&_em]:text-foreground/90">
          {children}
        </div>

        <p className="mt-12 text-sm text-muted-foreground">
          <Link to="/" className="text-primary hover:underline">← Volver al inicio</Link>
        </p>
      </main>
    </div>
  )
}

export function TerminosPage() {
  return (
    <LegalShell title="Términos y Condiciones">
      <h2>1. Sobre el servicio</h2>
      <p>
        CobroGest es una plataforma web para que pequeños negocios (gimnasios, academias, profesores particulares y similares) lleven el control de cobros, vencimientos y deudas de sus clientes. El servicio se ofrece "tal cual está" y está en etapa beta: puede tener errores, cambios o interrupciones temporales.
      </p>

      <h2>2. Cuenta y responsabilidad del usuario</h2>
      <ul>
        <li>Para usar CobroGest tenés que crear una cuenta con un email válido.</li>
        <li>Sos responsable de mantener la confidencialidad de tu contraseña.</li>
        <li>Te comprometés a cargar información veraz, propia o sobre la cual tengas autorización para usar.</li>
        <li>Cualquier uso del servicio para fines ilegales, ofensivos o que vulnere derechos de terceros está prohibido y puede dar lugar a la baja inmediata de la cuenta.</li>
      </ul>

      <h2>3. Plan, precios y pagos</h2>
      <p>
        Durante la etapa beta, CobroGest se ofrece bajo condiciones acordadas individualmente entre vos y el responsable del servicio. Los precios, formas de pago y duración del plan piloto se comunican por WhatsApp o email al momento de la contratación. Cualquier cambio de precio se notifica con un mínimo de 30 días de anticipación.
      </p>

      <h2>4. Disponibilidad</h2>
      <p>
        Hacemos lo posible para que el servicio esté disponible 24/7, pero no garantizamos ausencia total de fallas (la plataforma depende de Supabase, Netlify y WhatsApp). En caso de caídas prolongadas, te avisamos por WhatsApp.
      </p>

      <h2>5. Responsabilidad por los datos</h2>
      <p>
        Los datos que cargás en CobroGest (clientes, pagos, montos) son tuyos. Hacemos backups regulares pero te recomendamos exportar tu cartera a CSV cada cierto tiempo para tener tu propia copia. CobroGest no se responsabiliza por pérdidas de datos producidas por causas ajenas a nuestro control.
      </p>

      <h2>6. Cancelación</h2>
      <p>
        Podés dar de baja tu cuenta en cualquier momento escribiéndonos al{' '}
        <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">WhatsApp +54 9 249 437-4128</a>. Te enviamos un export de toda tu data en CSV y eliminamos tus datos dentro de los 30 días.
      </p>

      <h2>7. Cambios en estos términos</h2>
      <p>Si modificamos estos términos, te avisamos por email o WhatsApp con un mínimo de 15 días de anticipación.</p>

      <h2>8. Contacto</h2>
      <p>
        <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">WhatsApp +54 9 249 437-4128</a>{' '}
        o <a href="mailto:dev1@theautomationpartner.com">dev1@theautomationpartner.com</a>.
      </p>
    </LegalShell>
  )
}

export function PrivacidadPage() {
  return (
    <LegalShell title="Política de Privacidad">
      <p>Cumplimos con la Ley 25.326 de Protección de Datos Personales (Argentina).</p>

      <h2>1. Qué datos guardamos</h2>
      <ul>
        <li><strong>Tu cuenta:</strong> email, contraseña encriptada y (si te logueás con Google) nombre y foto de perfil.</li>
        <li><strong>Datos de tu negocio:</strong> los clientes que cargás (nombre, teléfono, servicio, monto, estado) y el historial de pagos.</li>
      </ul>

      <h2>2. Para qué los usamos</h2>
      <p>
        Los datos se usan exclusivamente para que vos puedas operar tu negocio dentro de la plataforma. No vendemos, alquilamos ni cedemos tu información ni la de tus clientes a terceros con fines comerciales.
      </p>

      <h2>3. Dónde se almacenan</h2>
      <p>
        Tus datos viven en servidores de <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase</a> y la aplicación se sirve desde <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener noreferrer">Netlify</a>.
      </p>

      <h2>4. Quién accede a tus datos</h2>
      <p>
        Solo vos accedés a los datos de tu cuenta. Tenemos Row Level Security (RLS) activado en la base de datos, lo que significa que <strong>ningún otro usuario de CobroGest puede ver tu información, ni siquiera por error</strong>.
      </p>
      <p>
        El responsable técnico (Mateo Mauro) tiene acceso administrativo a la base de datos por motivos de soporte y mantenimiento, pero no consulta datos individuales salvo que vos lo autorices expresamente para resolver un problema puntual.
      </p>

      <h2>5. Tus derechos (ARCO)</h2>
      <ul>
        <li><strong>Acceder</strong> a todos los datos que tenemos sobre vos.</li>
        <li><strong>Rectificar</strong> datos incorrectos o desactualizados.</li>
        <li><strong>Cancelar / eliminar</strong> tu cuenta y todos los datos asociados.</li>
        <li><strong>Oponerte</strong> a usos específicos de tu información.</li>
      </ul>

      <h2>6. Datos de tus clientes (alumnos del gimnasio)</h2>
      <p>
        Cuando cargás clientes en CobroGest (con su nombre y teléfono), sos vos el responsable del tratamiento de esos datos. Asegurate de tener el consentimiento de tus clientes para guardarlos y enviarles mensajes de WhatsApp.
      </p>

      <h2>7. Cookies y tracking</h2>
      <p>
        Usamos exclusivamente cookies y localStorage necesarios para mantener tu sesión iniciada. No usamos cookies de seguimiento ni publicidad. No usamos servicios tipo Google Analytics o Meta Pixel.
      </p>

      <h2>8. Contacto</h2>
      <p>
        Para cualquier consulta sobre privacidad, escribinos a{' '}
        <a href="mailto:dev1@theautomationpartner.com">dev1@theautomationpartner.com</a>{' '}
        o al <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noopener noreferrer">WhatsApp +54 9 249 437-4128</a>.
      </p>
    </LegalShell>
  )
}
