import { useEffect, useRef, useState } from 'react'

/**
 * useInView: dispara `inView=true` cuando el elemento entra a viewport.
 * Por default `once: true` para que la animación corra una sola vez al scroll.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(opts: {
  threshold?: number
  rootMargin?: string
  once?: boolean
} = {}) {
  const { threshold = 0.15, rootMargin = '0px', once = true } = opts
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Si reduced-motion está activado, mostrar de una sin animar
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) obs.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, inView }
}
