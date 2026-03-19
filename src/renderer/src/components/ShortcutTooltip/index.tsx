import { cloneElement, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface TooltipPosition {
  x: number
  y: number
}

interface TriggerProps {
  onMouseEnter?: React.MouseEventHandler<HTMLElement>
  onMouseLeave?: React.MouseEventHandler<HTMLElement>
  onFocus?: React.FocusEventHandler<HTMLElement>
  onBlur?: React.FocusEventHandler<HTMLElement>
}

interface ShortcutTooltipProps {
  content?: string
  children: React.ReactElement<TriggerProps>
}

function getPosition(element: HTMLElement): TooltipPosition {
  const rect = element.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom + 8,
  }
}

export function ShortcutTooltip({ content, children }: ShortcutTooltipProps): React.JSX.Element {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  useEffect(() => {
    if (!visible) return

    function hide(): void {
      setVisible(false)
    }

    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
    }
  }, [visible])

  if (!content) {
    return children
  }

  const child = cloneElement(children, {
    onMouseEnter: (event) => {
      children.props.onMouseEnter?.(event)
      setPosition(getPosition(event.currentTarget))
      setVisible(true)
    },
    onMouseLeave: (event) => {
      children.props.onMouseLeave?.(event)
      setVisible(false)
    },
    onFocus: (event) => {
      children.props.onFocus?.(event)
      setPosition(getPosition(event.currentTarget))
      setVisible(true)
    },
    onBlur: (event) => {
      children.props.onBlur?.(event)
      setVisible(false)
    },
  })

  return (
    <>
      {child}
      {visible && position && createPortal(
        <div
          className="pointer-events-none fixed z-[250] rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-medium text-zinc-200 shadow-2xl"
          style={{ left: position.x, top: position.y, transform: 'translateX(-50%)' }}
          role="tooltip"
        >
          {content}
        </div>,
        document.body
      )}
    </>
  )
}
