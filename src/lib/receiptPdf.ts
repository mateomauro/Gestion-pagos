// Generador de recibo PDF — jsPDF se importa dinámicamente para que NO entre
// en el bundle inicial. La primera descarga descarga el chunk (~150KB), las
// siguientes son instantáneas.

export interface BusinessConfig {
  name: string             // Nombre del gym/academia (header del recibo)
  contacto: string         // 1 línea libre: dirección, IG, tel
  mensaje: string          // Mensaje al pie ("¡Gracias por entrenar con nosotros!")
  logoDataURL: string | null  // Logo como dataURL (ya descargado), o null
}

export interface ReceiptInput {
  clientName: string
  service: string
  amount: number
  method: string
  paymentDate: Date
  nextDueDate?: string | null
  receiptId?: string
  business?: BusinessConfig
}

const MES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const formatFechaLarga = (d: Date) =>
  `${d.getDate()} de ${MES_ES[d.getMonth()]} de ${d.getFullYear()}`

const formatPeriodo = (d: Date) => {
  const mes = MES_ES[d.getMonth()]
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`
}

// jsPDF + Helvetica no soporta emojis ni caracteres no-latin extendidos
// (renderizan como ?). Los quitamos del texto que va al PDF.
// Esto solo afecta al PDF — el mensaje de WhatsApp mantiene los emojis.
const stripUnsupported = (s: string): string =>
  s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim()

const DEFAULT_BUSINESS: BusinessConfig = {
  name: 'Comprobante de pago',
  contacto: '',
  mensaje: '',
  logoDataURL: null,
}

export async function buildReceiptPDF(input: ReceiptInput): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ format: 'a5', unit: 'mm' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const business = input.business ?? DEFAULT_BUSINESS
  const negocioName = business.name?.trim() || 'Comprobante de pago'

  // ---- HEADER ----
  const headerH = 32
  let textX = 15
  const headerY = 14

  // Logo a la izquierda (si hay)
  if (business.logoDataURL) {
    try {
      const logoSize = 18 // mm
      doc.addImage(business.logoDataURL, 'PNG', 15, 7, logoSize, logoSize, undefined, 'FAST')
      textX = 15 + logoSize + 5
    } catch {
      // si falla el addImage seguimos sin logo
    }
  }

  // Nombre del negocio (izquierda)
  doc.setTextColor(20, 20, 20)
  doc.setFontSize(business.logoDataURL ? 16 : 20)
  doc.setFont('helvetica', 'bold')
  doc.text(stripUnsupported(negocioName), textX, headerY)

  // "Comprobante de pago" subtítulo
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  doc.text('Comprobante de pago', textX, headerY + 5.5)

  // Contacto (1 línea)
  if (business.contacto) {
    doc.setFontSize(8)
    doc.setTextColor(140, 140, 140)
    doc.text(stripUnsupported(business.contacto), textX, headerY + 10.5)
  }

  // Número de recibo (derecha)
  const shortId = (input.receiptId || Math.random().toString(36))
    .replace(/-/g, '')
    .substring(0, 8)
    .toUpperCase()
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(99, 102, 241)
  doc.text(`N° ${shortId}`, pageWidth - 15, headerY, { align: 'right' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(140, 140, 140)
  doc.text(formatFechaLarga(input.paymentDate), pageWidth - 15, headerY + 5.5, { align: 'right' })

  // Línea divisora bajo el header
  doc.setDrawColor(99, 102, 241)
  doc.setLineWidth(0.6)
  doc.line(15, headerH, pageWidth - 15, headerH)

  // ---- BODY ----
  doc.setTextColor(40, 40, 40)
  let y = headerH + 10

  const drawField = (label: string, value: string, valueSize = 12) => {
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(130, 130, 130)
    doc.text(label, 15, y)
    doc.setFontSize(valueSize)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(stripUnsupported(value || '-'), 15, y + 5.5)
    y += 14
  }

  drawField('COBRADO A', input.clientName, 13)

  const periodo = formatPeriodo(input.paymentDate)
  drawField('CONCEPTO', `${input.service} · ${periodo}`)
  drawField('METODO DE PAGO', input.method)

  // Box monto
  y += 2
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(16, 185, 129)
  doc.roundedRect(15, y, pageWidth - 30, 26, 3, 3, 'FD')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(16, 185, 129)
  doc.text('TOTAL PAGADO', pageWidth / 2, y + 9, { align: 'center' })

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  const amountStr = '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(input.amount)
  doc.text(amountStr, pageWidth / 2, y + 19, { align: 'center' })

  y += 34

  if (input.nextDueDate) {
    const [yy, mm, dd] = input.nextDueDate.split('-').map(Number)
    const next = `${dd} de ${MES_ES[mm - 1]}`
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Proximo vencimiento: ${next}`, pageWidth / 2, y, { align: 'center' })
    y += 6
  }

  // ---- FOOTER ----
  // Mensaje custom del negocio (si hay)
  const mensaje = stripUnsupported(business.mensaje || '')
  if (mensaje) {
    doc.setFontSize(11)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(60, 60, 60)
    const lines = doc.splitTextToSize(mensaje, pageWidth - 30) as string[]
    const footerY = pageHeight - 18 - (lines.length - 1) * 5
    doc.text(lines, pageWidth / 2, footerY, { align: 'center' })
  }

  const safeName = input.clientName.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `recibo_${safeName}_${shortId}.pdf`
  const blob = doc.output('blob') as Blob
  return { blob, filename }
}

// Genera el PDF y dispara la descarga (mantiene backward compat).
export async function generateReceiptPDF(input: ReceiptInput) {
  const { blob, filename } = await buildReceiptPDF(input)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
