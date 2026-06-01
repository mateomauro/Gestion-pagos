import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { BusinessConfig } from './receiptPdf'

export interface Negocio {
  nombre_negocio: string
  logo_url: string | null
  contacto: string
  mensaje_recibo: string
}

const DEFAULT_NEGOCIO: Negocio = {
  nombre_negocio: '',
  logo_url: null,
  contacto: '',
  mensaje_recibo: '¡Gracias por tu pago! 🙌',
}

export function useNegocio() {
  const { user } = useAuth()
  const [negocio, setNegocio] = useState<Negocio>(DEFAULT_NEGOCIO)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) { setNegocio(DEFAULT_NEGOCIO); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('configuraciones')
      .select('nombre_negocio, logo_url, contacto, mensaje_recibo')
      .eq('usuario_id', user.id)
      .maybeSingle()

    setNegocio({
      nombre_negocio: data?.nombre_negocio ?? '',
      logo_url: data?.logo_url ?? null,
      contacto: data?.contacto ?? '',
      mensaje_recibo: data?.mensaje_recibo ?? DEFAULT_NEGOCIO.mensaje_recibo,
    })
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  const save = async (patch: Partial<Negocio>): Promise<{ error: string | null }> => {
    if (!user) return { error: 'No autenticado' }
    const next = { ...negocio, ...patch }
    const { error } = await supabase.from('configuraciones').upsert({
      usuario_id: user.id,
      nombre_negocio: next.nombre_negocio || null,
      logo_url: next.logo_url,
      contacto: next.contacto || null,
      mensaje_recibo: next.mensaje_recibo || null,
    })
    if (error) return { error: error.message }
    setNegocio(next)
    return { error: null }
  }

  /**
   * Sube un archivo de logo al bucket `logos` bajo {userId}/logo.{ext}.
   * Reemplaza el existente. Devuelve la public URL.
   */
  const uploadLogo = async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!user) return { url: null, error: 'No autenticado' }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${user.id}/logo.${ext}`
    const { error: upErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '0' })
    if (upErr) return { url: null, error: upErr.message }
    const { data } = supabase.storage.from('logos').getPublicUrl(path)
    // cache-buster para que el browser no muestre la versión anterior
    const url = `${data.publicUrl}?t=${Date.now()}`
    const { error: saveErr } = await save({ logo_url: url })
    if (saveErr) return { url: null, error: saveErr }
    return { url, error: null }
  }

  const deleteLogo = async (): Promise<{ error: string | null }> => {
    if (!user) return { error: 'No autenticado' }
    // Borramos todas las variantes posibles (.png/.jpg/.jpeg/.webp/.svg)
    const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg']
    await supabase.storage.from('logos').remove(exts.map(e => `${user.id}/logo.${e}`))
    return await save({ logo_url: null })
  }

  return { negocio, loading, refresh, save, uploadLogo, deleteLogo }
}

/**
 * Hook para descargar el logo como dataURL. Lo usan tanto useReceiptBusiness
 * (recibos reales) como la preview en Configuración (live edit).
 */
export function useLogoDataURL(url: string | null): { dataURL: string | null; loading: boolean } {
  const [dataURL, setDataURL] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!url) { setDataURL(null); setLoading(false); return }
    setLoading(true)
    fetchLogoAsDataURL(url).then(d => {
      if (cancelled) return
      setDataURL(d)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [url])

  return { dataURL, loading }
}

/**
 * Versión "para PDF" de la config del negocio: incluye el logo ya descargado
 * como dataURL (jsPDF no soporta URLs directas). Se usa en los puntos de
 * entrada de generación de recibos.
 */
export function useReceiptBusiness() {
  const { negocio, loading } = useNegocio()
  const { dataURL: logoDataURL, loading: logoLoading } = useLogoDataURL(negocio.logo_url)

  const business: BusinessConfig = useMemo(() => ({
    name: negocio.nombre_negocio || '',
    contacto: negocio.contacto || '',
    mensaje: negocio.mensaje_recibo || '',
    logoDataURL,
  }), [negocio, logoDataURL])

  return { business, loading: loading || logoLoading }
}

/**
 * Descarga el logo y lo convierte a dataURL para incrustarlo en el PDF.
 * jsPDF no acepta URLs directas, necesita el binario.
 * Devuelve null si falla (sin romper la generación del recibo).
 */
export async function fetchLogoAsDataURL(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-cache' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
