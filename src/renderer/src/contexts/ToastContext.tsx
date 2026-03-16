import { createContext, useContext } from 'react'
import type { ToastType } from '../hooks/useToast'

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastContextValue>({ addToast: () => {} })

export function useToastContext(): ToastContextValue {
  return useContext(ToastContext)
}
