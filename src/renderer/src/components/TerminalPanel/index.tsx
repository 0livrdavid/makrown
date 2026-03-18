import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react'
import { TerminalTab } from './TerminalTab'

interface TabState {
  id: string
  label: string
}

interface TerminalPanelProps {
  isOpen: boolean
  height: number
  onHeightChange: (h: number) => void
  cwd: string
  isRemote: boolean
}

function newId(): string {
  return crypto.randomUUID()
}

const MIN_HEIGHT = 120
const MAX_HEIGHT_RATIO = 0.7

export function TerminalPanel({ isOpen, height, onHeightChange, cwd, isRemote }: TerminalPanelProps): React.JSX.Element | null {
  const [tabs, setTabs] = useState<TabState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const dragRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  const initializedRef = useRef(false)

  // Create first tab only when panel first becomes visible
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      initializedRef.current = true
      addTab()
    }
  }, [isOpen])

  function addTab(): void {
    const id = newId()
    const n = tabs.length + 1
    const label = isRemote ? `ssh ${n}` : `bash ${n}`
    setTabs((prev) => [...prev, { id, label }])
    setActiveId(id)
  }

  function closeTab(id: string): void {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id)
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[next.length - 1].id : null)
      }
      return next
    })
  }

  // Drag handle
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = height

    function onMove(ev: MouseEvent): void {
      if (!dragRef.current) return
      const delta = startYRef.current - ev.clientY
      const maxH = window.innerHeight * MAX_HEIGHT_RATIO
      const next = Math.min(maxH, Math.max(MIN_HEIGHT, startHeightRef.current + delta))
      onHeightChange(next)
    }

    function onUp(): void {
      dragRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [height, onHeightChange])

  return (
    <div
      className="flex flex-col border-t border-zinc-700 bg-[#09090b] flex-shrink-0"
      style={{ height, display: isOpen ? 'flex' : 'none' }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        className="h-1 cursor-row-resize bg-zinc-800 hover:bg-indigo-500 transition-colors flex-shrink-0"
      />

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-zinc-800 bg-zinc-900 flex-shrink-0 overflow-x-auto">
        <div className="flex items-center pl-2 text-zinc-600 pr-1 flex-shrink-0">
          <TerminalIcon size={12} />
        </div>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-[11px] cursor-pointer select-none border-r border-zinc-800 transition-colors flex-shrink-0 ${
              activeId === tab.id
                ? 'bg-[#09090b] text-zinc-200'
                : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
            }`}
            onClick={() => setActiveId(tab.id)}
          >
            <span>{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              className="rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-zinc-700 hover:text-red-400 transition-all"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        <button
          onClick={addTab}
          className="flex items-center justify-center px-2 py-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0"
          title="Novo terminal"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Terminal tabs content */}
      <div className="flex-1 min-h-0 relative">
        {tabs.map((tab) => (
          <div key={tab.id} className="absolute inset-0" style={{ display: activeId === tab.id ? 'block' : 'none' }}>
            <TerminalTab
              terminalId={tab.id}
              cwd={cwd}
              mode={isRemote ? 'vps' : 'local'}
              isActive={activeId === tab.id}
              onExit={() => {/* keep tab open showing exit message */}}
            />
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-zinc-700">
            Nenhum terminal ativo
          </div>
        )}
      </div>
    </div>
  )
}
