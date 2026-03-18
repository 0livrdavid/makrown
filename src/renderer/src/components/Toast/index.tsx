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
    <div
      className="fixed bottom-8 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
      aria-live="assertive"
      aria-atomic="true"
    >
      {toasts.map((toast) => {
        const { icon: Icon, bar, iconClass } = CONFIG[toast.type]
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-72 items-start gap-2.5 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
            role="alert"
          >
            {/* Color accent bar */}
            <div className={`w-1 self-stretch shrink-0 ${bar}`} />
            <div className="flex flex-1 items-center gap-2 py-2.5 pr-2">
              <Icon size={14} className={`mt-0.5 shrink-0 ${iconClass}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-xs leading-snug text-zinc-300">{toast.message}</span>
                {toast.action && (
                  <button
                    onClick={() => {
                      onRemove(toast.id)
                      void toast.action?.onClick()
                    }}
                    className="self-start rounded bg-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-100 transition-colors hover:bg-zinc-700"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => onRemove(toast.id)}
                className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
                aria-label="Fechar aviso"
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
