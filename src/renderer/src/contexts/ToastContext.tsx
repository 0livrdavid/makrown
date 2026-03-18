import { createContext, useContext } from 'react'
import type { ToastOptions, ToastType } from '../hooks/useToast'

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToastContext(): ToastContextValue {
  return useContext(ToastContext)
}
