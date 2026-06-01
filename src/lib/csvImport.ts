// Parsing y normalización de CSV con formato argentino flexible.
// Replicado de la versión vanilla. Maneja fechas DD/MM/YYYY, montos con $,
// estados en español/inglés y detección automática de columnas.

import type { Estado } from '@/data/mock'

export interface ParsedRow {
  rowNum: number
  nombre: string
  telefono: string
  servicio: string
  monto: number
  fecha: string | null
  estado: Estado
  errors: string[]
  warnings: string[]
  valid: boolean
}

export interface ColumnMapping {
  nombre: number
  telefono: number
  servicio: number
  monto: number
  vencimiento: number
  estado: number
}

export interface ParseResult {
  headers: string[]
  mapping: ColumnMapping
  rows: ParsedRow[]
}

export const parseFlexibleDate = (raw: string): string | null => {
  if (!raw) return null
  raw = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(raw + 'T00:00:00')
    return isNaN(d.getTime()) ? null : raw
  }
  const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (!m) return null
  let [, day, month, year] = m
  day = day.padStart(2, '0')
  month = month.padStart(2, '0')
  if (year.length === 2) year = (parseInt(year, 10) > 50 ? '19' : '20') + year
  const iso = `${year}-${month}-${day}`
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return null
  if (d.getDate() !== parseInt(day, 10) || d.getMonth() + 1 !== parseInt(month, 10)) return null
  return iso
}

export const parseFlexibleAmount = (raw: any): number => {
  if (raw === null || raw === undefined || raw === '') return NaN
  let s = String(raw).trim().replace(/[^\d.,\-]/g, '')
  if (!s) return NaN
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
  else if (lastDot > lastComma && (s.length - lastDot - 1) === 3 && lastComma === -1) s = s.replace(/\./g, '')
  s = s.replace(/,/g, '')
  const n = parseFloat(s)
  return isNaN(n) ? NaN : n
}

export const normalizeEstado = (raw: any): Estado => {
  if (!raw) return 'pendiente'
  const map: Record<string, Estado> = {
    'al dia': 'al_dia', 'al_dia': 'al_dia', 'al día': 'al_dia',
    'pagado': 'al_dia', 'paid': 'al_dia', 'cobrado': 'al_dia', 'pago': 'al_dia',
    'pendiente': 'pendiente', 'pending': 'pendiente', 'a cobrar': 'pendiente',
    'vencido': 'vencido', 'overdue': 'vencido', 'deudor': 'vencido',
    'debe': 'vencido', 'atrasado': 'vencido',
  }
  return map[String(raw).toLowerCase().trim()] || 'pendiente'
}

export function parseCsv(text: string): ParseResult | { error: string } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { error: 'La lista está vacía o solo tiene encabezados. Asegurate de incluir tus clientes debajo de los títulos.' }

  // Auto-detectar separador: tab (Excel/Sheets paste), ; (CSV europeo) o , (CSV)
  const firstLine = lines[0]
  let separator = ','
  if (firstLine.includes('\t')) separator = '\t'
  else if (firstLine.includes(';')) separator = ';'

  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''))

  const findCol = (opts: string[]) => headers.findIndex(h => opts.some(o => h.includes(o)))
  const mapping: ColumnMapping = {
    nombre:      findCol(['nombre', 'name', 'alumno', 'cliente', 'apellido']),
    telefono:    findCol(['telefono', 'teléfono', 'tel', 'phone', 'whatsapp', 'celular', 'cel', 'movil']),
    servicio:    findCol(['servicio', 'plan', 'actividad', 'service']),
    monto:       findCol(['monto', 'precio', 'cuota', 'amount', 'valor', 'importe']),
    vencimiento: findCol(['vencimiento', 'fecha', 'date', 'vence', 'venc']),
    estado:      findCol(['estado', 'status', 'situacion']),
  }

  if (mapping.nombre === -1) return { error: 'No encontré la columna de Nombre. La primera fila tiene que ser encabezados.' }

  const today = new Date().toISOString().split('T')[0]
  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''))
    const errors: string[] = []
    const warnings: string[] = []

    const nombre = (cols[mapping.nombre] || '').trim()
    if (!nombre) errors.push('Nombre vacío')
    if (nombre.length > 100) errors.push('Nombre muy largo')

    const telefono = mapping.telefono !== -1 ? (cols[mapping.telefono] || '').trim().replace(/\s+/g, '') : ''
    if (telefono && !/^[0-9+\-()]{6,20}$/.test(telefono)) errors.push('Teléfono inválido')

    const servicio = mapping.servicio !== -1 ? ((cols[mapping.servicio] || '').trim() || 'General') : 'General'
    if (mapping.servicio === -1) warnings.push('Sin servicio → "General"')

    let monto = 0
    if (mapping.monto === -1) errors.push('Falta columna de monto')
    else {
      const raw = cols[mapping.monto]
      monto = parseFlexibleAmount(raw)
      if (isNaN(monto) || monto <= 0) errors.push(`Monto inválido ("${raw || ''}")`)
      else if (monto > 100_000_000) errors.push('Monto muy alto')
    }

    let fecha: string | null = null
    if (mapping.vencimiento === -1) {
      fecha = today
      warnings.push('Sin fecha → hoy')
    } else {
      const raw = cols[mapping.vencimiento]
      fecha = parseFlexibleDate(raw)
      if (!fecha) errors.push(`Fecha inválida ("${raw || ''}")`)
    }

    const estado = mapping.estado !== -1 ? normalizeEstado(cols[mapping.estado]) : 'pendiente'

    rows.push({
      rowNum: i + 1, nombre, telefono, servicio, monto, fecha, estado,
      errors, warnings, valid: errors.length === 0,
    })
  }

  return { headers, mapping, rows }
}

// Datos de la plantilla (compartidos por CSV y XLSX)
const futureDate = (days: number) => {
  const d = new Date(); d.setDate(d.getDate() + days)
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear()
}

const TEMPLATE_HEADERS = ['Nombre', 'Telefono', 'Servicio', 'Monto', 'Vencimiento', 'Estado']

const templateRows = (): (string | number)[][] => [
  ['Juan Pérez',     '5491123456789', 'Cuota mensual',        15000, futureDate(10),  'Pendiente'],
  ['María González', '5491198765432', 'Pase libre deportivo', 25000, futureDate(-5),  'Vencido'],
  ['Carlos Ramírez', '5491155667788', 'Clase suelta',         5000,  futureDate(20),  'Al día'],
]

// Genera el CSV de plantilla con datos de ejemplo (fallback legacy)
export const generateTemplateCsv = (): string => {
  const csv = [TEMPLATE_HEADERS, ...templateRows()]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  return '﻿' + csv // BOM para que Excel detecte UTF-8
}

/**
 * Genera la plantilla como archivo .xlsx real (Excel nativo).
 * Excel/LibreOffice/Sheets la abren directo sin wizard de import.
 * jsPDF y xlsx se importan dinamicamente para no inflar el bundle inicial.
 */
export const generateTemplateXlsx = async (): Promise<Blob> => {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...templateRows()])

  // Anchos de columna razonables
  ws['!cols'] = [
    { wch: 22 }, // Nombre
    { wch: 18 }, // Telefono
    { wch: 24 }, // Servicio
    { wch: 12 }, // Monto
    { wch: 14 }, // Vencimiento
    { wch: 12 }, // Estado
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')

  const arrayBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([arrayBuf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/**
 * Parsea un archivo .xlsx subido y devuelve su contenido como TSV
 * (tab-separated) para que el parseCsv() existente lo procese.
 * Si tiene varias hojas, usa la primera.
 */
export const parseXlsxFile = async (file: File): Promise<string> => {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: false })
  const firstSheetName = wb.SheetNames[0]
  if (!firstSheetName) throw new Error('El archivo Excel está vacío')
  const ws = wb.Sheets[firstSheetName]
  // sheet_to_csv con tab para que matchee nuestro parseCsv
  return XLSX.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false })
}
