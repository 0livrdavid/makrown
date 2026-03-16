import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import type { Toast } from '../../hooks/useToast'

interface ToastContainerProps {
  toasts: Toast[]
  onRemove: (id: string) => void
}

const CONFIG = {
  success: {
    icon: CheckCircle2,
    bar: 'bg-green-500',
    iconClass: 'text-green-400',
  },
  error: {
    icon: AlertCircle,
    bar: 'bg-red-500',
    iconClass: 'text-red-400',
  },
  info: {
    icon: Info,
    bar: 'bg-indigo-500',
    iconClass: 'text-indigo-400',
  },
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps): React.JSX.Element | null {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-8 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const { icon: Icon, bar, iconClass } = CONFIG[toast.type]
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-72 items-start gap-2.5 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
          >
            {/* Color accent bar */}
            <div className={`w-1 self-stretch shrink-0 ${bar}`} />
            <div className="flex flex-1 items-center gap-2 py-2.5 pr-2">
              <Icon size={14} className={`shrink-0 ${iconClass}`} />
              <span className="flex-1 text-xs text-zinc-300 leading-snug">{toast.message}</span>
              <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
