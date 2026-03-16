import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Ajusta posição para não sair da tela
  const style: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000
  }

  return (
    <div
      ref={ref}
      style={style}
      className="min-w-40 rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-xl"
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-500/10'
              : 'text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {item.icon && <span className="opacity-70">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}
