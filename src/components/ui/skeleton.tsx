import { cn } from '@/lib/utils'

// Skeleton con shimmer animado. Respeta prefers-reduced-motion (animación off).
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-muted/60',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent',
        'before:animate-[shimmer_1.5s_infinite] motion-reduce:before:animate-none',
        className
      )}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  )
}
