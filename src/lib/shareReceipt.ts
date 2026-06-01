import { buildReceiptPDF, type ReceiptInput } from './receiptPdf'

export type ShareMethod = 'native' | 'whatsapp-fallback' | 'download-only' | 'cancelled' | 'error'

export interface ShareReceiptOptions {
  receipt: ReceiptInput
  phone?: string // sin '+', formato internacional (ej: 5491123456789)
}

const formatARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)

const formatDateAR = (d: Date) =>
  d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

const formatShortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// Construye el texto que va al chat de WhatsApp acompañando al PDF
export function buildReceiptMessage(input: ReceiptInput): string {
  const nextLine = input.nextDueDate
    ? `\n\n📌 Tu próximo vencimiento es el ${formatShortDate(input.nextDueDate)}.`
    : ''
  return (
    `✅ *Comprobante de Pago*\n\n` +
    `Hola ${input.clientName}, confirmamos tu pago:\n\n` +
    `💰 Monto: $${formatARS(input.amount)}\n` +
    `📋 Servicio: ${input.service}\n` +
    `💳 Método: ${input.method}\n` +
    `📅 Fecha: ${formatDateAR(input.paymentDate)}` +
    nextLine +
    `\n\n¡Gracias por tu pago! 🙌`
  )
}

/**
 * Comparte el recibo PDF por WhatsApp.
 *
 * - En mobile con Web Share API (Android Chrome, iOS Safari ≥15): abre el
 *   selector nativo de compartir con el archivo adjunto, el usuario elige
 *   WhatsApp y ya viene todo armado.
 * - Como fallback (desktop / browsers sin Web Share): descarga el PDF +
 *   abre wa.me/<phone> con el mensaje pre-armado en otra pestaña, así el
 *   usuario arrastra el PDF al chat de WhatsApp Web.
 */
export async function shareReceiptViaWhatsApp({ receipt, phone }: ShareReceiptOptions): Promise<ShareMethod> {
  const message = buildReceiptMessage(receipt)
  let blob: Blob, filename: string
  try {
    ({ blob, filename } = await buildReceiptPDF(receipt))
  } catch (e) {
    console.error('Error generando PDF:', e)
    return 'error'
  }

  // Intento 1: Web Share API con archivo
  if (typeof navigator !== 'undefined' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Comprobante de pago',
          text: message,
        })
        return 'native'
      } catch (e: any) {
        if (e?.name === 'AbortError') return 'cancelled' // user cerró el sheet
        // Otro error: caemos al fallback
        console.warn('Web Share falló, fallback a descarga + WhatsApp Web:', e)
      }
    }
  }

  // Fallback: descargar PDF + abrir WhatsApp Web con el mensaje
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  if (phone) {
    // Pequeño delay para que el download arranque antes de abrir nueva pestaña
    await new Promise(r => setTimeout(r, 250))
    const waUrl = `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    return 'whatsapp-fallback'
  }

  return 'download-only'
}
