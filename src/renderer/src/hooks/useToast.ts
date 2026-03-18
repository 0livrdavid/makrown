import { useCallback, useRef, useState } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

export interface ToastOptions {
  action?: ToastAction
  durationMs?: number
}

export interface Toast {
  id: string
  message: string
  type: ToastType
  action?: ToastAction
}

export function useToast(): {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => void
  removeToast: (id: string) => void
} {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts((prev) => [...prev, { id, message, type, action: options?.action }])
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      timers.current.delete(id)
    }, options?.durationMs ?? 3500)
    timers.current.set(id, timer)
  }, [])

  return { toasts, addToast, removeToast }
}
