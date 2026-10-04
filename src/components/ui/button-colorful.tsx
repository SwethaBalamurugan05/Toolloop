import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Source: ButtonColorful component supplied from 21st.dev for ToolLoop.
// Its optional label and native button props make it suitable for the Logout action.
interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
}

export function ButtonColorful({ className, label = 'Explore Components', ...props }: ButtonColorfulProps) {
  return (
    <Button
      className={cn(
        'relative h-10 overflow-hidden rounded-full px-4',
        'bg-zinc-900 dark:bg-zinc-100',
        'transition-all duration-200',
        'group',
        className,
      )}
      {...props}
    >
      <div className={cn('absolute inset-0', 'bg-gradient-to-r from-[#ffcc00] via-[#f59e0b] to-[#f97316]', 'opacity-60 group-hover:opacity-95', 'blur transition-opacity duration-500')} />
      <div className="relative flex items-center justify-center gap-2">
        <span className="font-extrabold text-black">{label}</span>
        <ArrowUpRight className="h-3.5 w-3.5 text-black/90" aria-hidden="true" />
      </div>
    </Button>
  )
}