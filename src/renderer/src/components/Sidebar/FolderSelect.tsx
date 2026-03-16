import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FolderOpen, FolderPlus, Server, Pencil } from 'lucide-react'
import type { SSHConfig } from '../../../../shared/types'

interface FolderSelectProps {
  currentPath: string
  isRemote: boolean
  activeSSHConfig: SSHConfig | null
  recentFolders: string[]
  recentVPS: SSHConfig[]
  sshStatus?: 'connected' | 'reconnecting' | 'disconnected'
  onSelect: (path: string) => void
  onPickNew: () => void
  onConnectVPS: () => void
  onConnectRecentVPS: (config: SSHConfig) => void
  onEditVPS: (config: SSHConfig) => void
}

function baseName(path: string): string {
  return path.split('/').pop() ?? path
}

export function FolderSelect({
  currentPath,
  isRemote,
  activeSSHConfig,
  recentFolders,
  recentVPS,
  sshStatus,
  onSelect,
  onPickNew,
  onConnectVPS,
  onConnectRecentVPS,
  onEditVPS,
}: FolderSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const others = recentFolders.filter((f) => f !== currentPath)

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-zinc-800"
      >
        {isRemote ? (
          <Server size={13} className="shrink-0 text-indigo-400" />
        ) : (
          <FolderOpen size={13} className="shrink-0 text-amber-400" />
        )}
        <span className="flex-1 truncate text-xs font-medium text-zinc-300" title={currentPath}>
          {isRemote
            ? (activeSSHConfig?.label || activeSSHConfig?.host || baseName(currentPath))
            : baseName(currentPath)}
        </span>
        {isRemote && (
          <span
            className={`shrink-0 h-1.5 w-1.5 rounded-full ${
              sshStatus === 'reconnecting'
                ? 'bg-amber-400 animate-pulse'
                : sshStatus === 'disconnected'
                  ? 'bg-red-500'
                  : 'bg-emerald-500'
            }`}
            title={
              sshStatus === 'reconnecting'
                ? 'Reconectando...'
                : sshStatus === 'disconnected'
                  ? 'Desconectado'
                  : 'Conectado'
            }
          />
        )}
        <ChevronDown
          size={11}
          className={`shrink-0 text-zinc-600 transition-transform group-hover:text-zinc-400 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown — abre para cima */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-1 overflow-hidden rounded-md border border-zinc-700 bg-zinc-800 shadow-xl">
          {others.length > 0 && (
            <>
              <div className="px-2 pb-1 pt-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">Recentes</span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {others.map((path) => (
                  <button
                    key={path}
                    onClick={() => { onSelect(path); setOpen(false) }}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-zinc-700"
                  >
                    <FolderOpen size={12} className="shrink-0 text-zinc-500" />
                    <div className="min-w-0">
                      <div className="truncate text-xs text-zinc-300">{baseName(path)}</div>
                      <div className="truncate text-[10px] text-zinc-600">{path}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="border-t border-zinc-700" />
            </>
          )}

          <button
            onClick={() => { onPickNew(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-zinc-700"
          >
            <FolderPlus size={12} className="shrink-0 text-indigo-400" />
            <span className="text-xs text-indigo-400">Abrir pasta...</span>
          </button>

          {recentVPS.length > 0 && (
            <>
              <div className="border-t border-zinc-700" />
              <div className="px-2 pb-1 pt-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">VPS recentes</span>
              </div>
              <div className="max-h-36 overflow-y-auto">
                {recentVPS.map((cfg) => (
                  <div
                    key={`${cfg.host}:${cfg.port}:${cfg.username}`}
                    className="group/item flex w-full items-center transition-colors hover:bg-zinc-700"
                  >
                    <button
                      onClick={() => { onConnectRecentVPS(cfg); setOpen(false) }}
                      className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                    >
                      <Server size={12} className="shrink-0 text-indigo-400" />
                      <div className="min-w-0">
                        <div className="truncate text-xs text-zinc-300">{cfg.label || cfg.host}</div>
                        <div className="truncate text-[10px] text-zinc-600">{cfg.username}@{cfg.host}:{cfg.port}</div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditVPS(cfg); setOpen(false) }}
                      className="mr-1.5 rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-zinc-600 hover:text-zinc-300 group-hover/item:opacity-100"
                      title="Editar conexão"
                    >
                      <Pencil size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-t border-zinc-700" />
          <button
            onClick={() => { onConnectVPS(); setOpen(false) }}
            className="flex w-full items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-zinc-700"
          >
            <Server size={12} className="shrink-0 text-zinc-500" />
            <span className="text-xs text-zinc-500">Conectar via VPS...</span>
          </button>
        </div>
      )}
    </div>
  )
}
