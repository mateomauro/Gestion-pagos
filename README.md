# CobroGest

SaaS para que gimnasios y academias dejen de manejar sus cobros en Excel y WhatsApp.

> **Etapa actual:** Beta. Validando con los primeros 10 clientes pagantes ($20-40k ARS/mes).

## Stack

- **Vite + React 18 + TypeScript** — SPA, code-splitting por route
- **Tailwind CSS + shadcn-style components** (Radix UI por debajo)
- **Supabase** — Auth (email + Google OAuth) + Postgres con Row Level Security
- **react-router-dom v7** — routing público (`/`, `/login`, `/terminos`, `/privacidad`) + protegido (`/dashboard`, `/clientes`, etc.)
- **sonner** — toasts
- **lucide-react** — iconos
- **jsPDF** — generación de recibos (lazy loaded)
- **Bricolage Grotesque** + **Inter** — tipografía

## Estructura

```
src/
├── App.tsx              # Routing + auth gates + error boundary
├── main.tsx
├── index.css            # Tokens (HSL), keyframes, reduced-motion
├── lib/
│   ├── supabase.ts      # Supabase client + env vars
│   ├── auth.tsx         # AuthProvider con session + suscripción
│   ├── useClientes.ts   # Hook + auto-promoción de estados vencidos
│   ├── usePagos.ts      # Pagos del usuario y por cliente
│   ├── useServicios.ts  # Servicios del usuario
│   ├── useTemplates.ts  # Plantillas WhatsApp + builder de mensaje
│   ├── useInView.ts     # IntersectionObserver para scroll anims
│   ├── csvImport.ts     # Parser + normalización AR
│   ├── receiptPdf.ts    # Generador PDF lazy import('jspdf')
│   └── utils.ts         # cn, formatCurrency, formatDate, getInitials
├── data/
│   └── mock.ts          # Types compartidos (Cliente, Estado)
└── components/
    ├── ui/              # Button, Card, Checkbox, Dialog, Input, Select, Skeleton, Badge
    ├── LandingPage.tsx  # Hero + features + how + FAQ + CTA + footer
    ├── LegalPage.tsx    # Terminos + Privacidad
    ├── LoginScreen.tsx
    ├── ExpiredScreen.tsx
    ├── Sidebar.tsx      # Sidebar desktop + BottomNav mobile
    ├── TrialBanner.tsx
    ├── ConfirmDialog.tsx # Provider + useConfirm hook
    ├── ErrorBoundary.tsx
    ├── DashboardView.tsx
    ├── ClientesView.tsx  # Tabla + filtros + bulk actions
    ├── RecibosView.tsx
    ├── ConfiguracionView.tsx
    ├── ClientFormDialog.tsx     # Nuevo + Editar
    ├── PaymentDialog.tsx        # Cobro individual
    ├── BulkPayDialog.tsx        # Cobro en lote
    ├── WhatsAppQueueDialog.tsx  # Cola guiada de recordatorios
    ├── HistoryDialog.tsx        # Historial por cliente con PDF
    └── CsvImportDialog.tsx      # Preview + validación
```

## Desarrollo local

```bash
npm install
npm run dev          # Vite en http://localhost:5173 (o el siguiente libre)
```

### Variables de entorno

Crear `.env.local` (ya está, NO se commitea):

```
VITE_SUPABASE_URL=https://fcnvjpioswuiyogjjwlp.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_SUPPORT_WHATSAPP=5492494374128
```

## Scripts

```bash
npm run dev          # Dev server con HMR
npm run build        # Type-check + build de producción a /dist
npm run preview      # Servir el build de prod localmente
```

## Deploy

Netlify, conectado al repo. El `netlify.toml` ya configura:
- `npm run build` como build command
- `dist/` como publish dir
- Fallback SPA a `/index.html` para rutas client-side
- Cache largo para assets con hash

## Supabase

Tablas (todas con RLS habilitado, policy `auth.uid() = usuario_id`):
- `clientes` — los alumnos del gimnasio
- `pagos` — historial de cobros (FK a clientes con ON DELETE CASCADE)
- `servicios` — los planes que ofrece cada usuario
- `configuraciones` — plantillas WhatsApp por usuario (PK es `usuario_id`)
- `suscripciones` — trial/pago/cancelado + `vence_el`

Trigger `crear_trial_para_nuevo_usuario` (AFTER INSERT en `auth.users`):
- Crea suscripción trial 30 días
- Crea 3 servicios default: Cuota mensual, Clase suelta, Pase libre

## Contacto

WhatsApp soporte: +54 9 249 437-4128
