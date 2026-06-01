// Generador de recibo PDF — jsPDF se importa dinámicamente para que NO entre
// en el bundle inicial. La primera descarga descarga el chunk (~150KB), las
// siguientes son instantáneas.

export interface ReceiptInput {
  clientName: string
  service: string
  amount: number
  method: string
  paymentDate: Date
  nextDueDate?: string | null
  receiptId?: string
}

// Construye el PDF y devuelve { blob, filename } sin tocar el filesystem.
// Usado por shareReceipt (Web Share API) y por generateReceiptPDF (download).
export async function buildReceiptPDF(input: ReceiptInput): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ format: 'a5', unit: 'mm' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header con barra de color
  doc.setFillColor(99, 102, 241)
  doc.rect(0, 0, pageWidth, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('CobroGest', 15, 15)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Comprobante de pago', 15, 22)

  const shortId = (input.receiptId || Math.random().toString(36))
    .replace(/-/g, '')
    .substring(0, 8)
    .toUpperCase()
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(`#${shortId}`, pageWidth - 15, 18, { align: 'right' })

  // Cuerpo
  doc.setTextColor(40, 40, 40)
  let y = 45

  const drawField = (label: string, value: string, valueSize = 12) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(label, 15, y)
    doc.setFontSize(valueSize)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text(value || '-', 15, y + 6)
    y += 16
  }

  drawField('FECHA DE EMISION', input.paymentDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }))
  drawField('CLIENTE', input.clientName, 14)
  drawField('SERVICIO', input.service)
  drawField('METODO DE PAGO', input.method)

  // Box monto
  y += 4
  doc.setFillColor(240, 253, 244)
  doc.setDrawColor(16, 185, 129)
  doc.roundedRect(15, y, pageWidth - 30, 26, 3, 3, 'FD')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(16, 185, 129)
  doc.text('MONTO PAGADO', pageWidth / 2, y + 9, { align: 'center' })

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  const amountStr = '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(input.amount)
  doc.text(amountStr, pageWidth / 2, y + 19, { align: 'center' })

  y += 36

  if (input.nextDueDate) {
    const [yy, mm, dd] = input.nextDueDate.split('-').map(Number)
    const next = new Date(yy, mm - 1, dd).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(`Proximo vencimiento: ${next}`, pageWidth / 2, y, { align: 'center' })
  }

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('Generado con CobroGest', pageWidth / 2, pageHeight - 10, { align: 'center' })

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
