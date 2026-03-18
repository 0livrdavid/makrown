import { useEffect, useRef } from 'react'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
    .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
}

interface UseModalFocusTrapOptions {
  onClose?: () => void
}

export function useModalFocusTrap({ onClose }: UseModalFocusTrapOptions = {}): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = ref.current
    if (!container) return
    const modal = container

    const focusTarget = getFocusableElements(modal)[0] ?? modal
    requestAnimationFrame(() => focusTarget.focus())

    function handleKeyDown(event: KeyboardEvent): void {
      if (!modal.contains(event.target as Node)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableElements(modal)
      if (focusable.length === 0) {
        event.preventDefault()
        modal.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousActive?.focus()
    }
  }, [onClose])

  return ref
}
