import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type ConfirmOpts = {
  title?: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
}

type ConfirmContextValue = (opts: ConfirmOpts) => Promise<boolean>

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((o: ConfirmOpts) => {
    setOpts(o); setOpen(true)
    return new Promise<boolean>((resolve) => { resolver.current = resolve })
  }, [])

  const handle = (result: boolean) => {
    setOpen(false)
    resolver.current?.(result)
    resolver.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && handle(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{opts?.title ?? '¿Estás seguro?'}</DialogTitle>
            <DialogDescription className="mt-2 text-foreground/80">
              {opts?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => handle(false)}>{opts?.cancelText ?? 'Cancelar'}</Button>
            <Button
              variant={opts?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={() => handle(true)}
              autoFocus
            >
              {opts?.confirmText ?? 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>')
  return ctx
}
