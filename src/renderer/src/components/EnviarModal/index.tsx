import { useState, useMemo } from 'react'
import { X, Send, FileText } from 'lucide-react'
import { encode } from 'gpt-tokenizer'
import type { OpenTab } from '../Editor'
import { computeLineDiff } from './diff'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'

function formatBytesAbs(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface EnviarModalProps {
  dirtyTabs: OpenTab[]
  onCancel: () => void
  onEnviar: (paths: string[]) => Promise<void>
}

function fileName(path: string): string {
  return path.split('/').pop() ?? path
}

function relativePath(path: string): string {
  const parts = path.split('/')
  return parts.slice(-3).join('/')
}

export function EnviarModal({ dirtyTabs, onCancel, onEnviar }: EnviarModalProps): React.JSX.Element {
  const [selectedPath, setSelectedPath] = useState<string>(dirtyTabs[0]?.path ?? '')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set(dirtyTabs.map((t) => t.path)))
  const [sending, setSending] = useState(false)
  const dialogRef = useModalFocusTrap({ onClose: onCancel })

  const selectedTab = dirtyTabs.find((t) => t.path === selectedPath) ?? dirtyTabs[0]

  const diff = useMemo(() => {
    if (!selectedTab) return []
    return computeLineDiff(selectedTab.originalContent, selectedTab.content)
  }, [selectedTab?.path, selectedTab?.content, selectedTab?.originalContent])

  const impact = useMemo(() => {
    const selected = dirtyTabs.filter((t) => selectedPaths.has(t.path))
    let linesAdded = 0, linesRemoved = 0, netChars = 0, netBytes = 0, netTokens = 0
    for (const tab of selected) {
      const d = computeLineDiff(tab.originalContent, tab.content)
      for (const line of d) {
        if (line.type === 'added') linesAdded++
        else if (line.type === 'removed') linesRemoved++
      }
      netChars += tab.content.length - tab.originalContent.length
      netBytes += new TextEncoder().encode(tab.content).length - new TextEncoder().encode(tab.originalContent).length
      netTokens += encode(tab.content).length - encode(tab.originalContent).length
    }
    return { linesAdded, linesRemoved, netChars, netBytes, netTokens }
  }, [selectedPaths, dirtyTabs])

  function togglePath(path: string): void {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  async function handleEnviar(paths: string[]): Promise<void> {
    setSending(true)
    await onEnviar(paths)
    setSending(false)
  }

  const changedLines = diff.filter((l) => l.type !== 'equal').length

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="enviar-modal-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100"
    >
      {/* Header */}
      <div
        className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 pl-20 pr-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Send size={14} className="text-indigo-400" />
          <span id="enviar-modal-title" className="text-sm font-medium">Enviar alterações</span>
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
            {dirtyTabs.length} arquivo{dirtyTabs.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onCancel}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          aria-label="Fechar envio de alterações"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* File list + impact panel */}
        <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800">
          {/* File list — scrollable */}
          <div className="flex-1 overflow-y-auto">
            <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Modificados
            </p>
            {dirtyTabs.map((tab) => (
              <div
                key={tab.path}
                onClick={() => setSelectedPath(tab.path)}
                className={`group flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors ${
                  tab.path === selectedPath
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedPaths.has(tab.path)}
                  onChange={(e) => { e.stopPropagation(); togglePath(tab.path) }}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 accent-indigo-500"
                />
                <FileText size={12} className="shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{fileName(tab.path)}</div>
                  <div className="truncate text-[10px] text-zinc-600">{relativePath(tab.path)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Impact panel — pinned at bottom */}
          <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/40 p-3">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Impacto selecionado
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Linhas</span>
                <span className="text-[11px] tabular-nums">
                  <span className="text-emerald-400">+{impact.linesAdded}</span>
                  {' '}
                  <span className="text-red-400">−{impact.linesRemoved}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Caracteres</span>
                <span className={`text-[11px] tabular-nums ${impact.netChars >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {impact.netChars >= 0 ? '+' : '−'}{Math.abs(impact.netChars).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Tamanho</span>
                <span className={`text-[11px] tabular-nums ${impact.netBytes >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {impact.netBytes >= 0 ? '+' : '−'}{formatBytesAbs(Math.abs(impact.netBytes))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">Tokens</span>
                <span className={`text-[11px] tabular-nums ${impact.netTokens >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {impact.netTokens >= 0 ? '+' : '−'}{Math.abs(impact.netTokens).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Diff view */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Diff header */}
          <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4">
            <span className="text-xs text-zinc-400 font-medium">{selectedTab ? fileName(selectedTab.path) : ''}</span>
            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
              <span className="text-red-400">−{diff.filter((l) => l.type === 'removed').length}</span>
              <span className="text-green-400">+{diff.filter((l) => l.type === 'added').length}</span>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex-1 px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600 border-r border-zinc-800">
              Modificado (será enviado)
            </div>
            <div className="flex-1 px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Atual (no disco)
            </div>
          </div>

          {/* Diff table */}
          <div className="flex-1 overflow-auto font-mono text-xs">
            {diff.length === 0 ? (
              <div className="flex h-full items-center justify-center text-zinc-600">
                Sem diferenças
              </div>
            ) : (
              <table className="w-full border-collapse">
                <tbody>
                  {diff.map((line, idx) => (
                    <tr key={idx}>
                      {/* Modified (left) */}
                      <td
                        className={`w-1/2 border-r border-zinc-800/60 px-2 py-0.5 align-top whitespace-pre-wrap break-all ${
                          line.type === 'added'
                            ? 'bg-green-950/40 text-green-300'
                            : line.type === 'removed'
                            ? 'bg-zinc-900 text-zinc-700'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span className="mr-3 select-none text-zinc-700 tabular-nums">
                          {line.type !== 'removed' ? line.lineRight : ' '}
                        </span>
                        {line.type === 'added' && <span className="mr-1 text-green-500">+</span>}
                        {line.right ?? ''}
                      </td>
                      {/* Original (right) */}
                      <td
                        className={`w-1/2 px-2 py-0.5 align-top whitespace-pre-wrap break-all ${
                          line.type === 'removed'
                            ? 'bg-red-950/40 text-red-300'
                            : line.type === 'added'
                            ? 'bg-zinc-900 text-zinc-700'
                            : 'text-zinc-400'
                        }`}
                      >
                        <span className="mr-3 select-none text-zinc-700 tabular-nums">
                          {line.type !== 'added' ? line.lineLeft : ' '}
                        </span>
                        {line.type === 'removed' && <span className="mr-1 text-red-400">−</span>}
                        {line.left ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex h-12 shrink-0 items-center justify-between border-t border-zinc-800 bg-zinc-900/60 px-4">
        <span className="text-xs text-zinc-600">
          {changedLines} linha{changedLines !== 1 ? 's' : ''} alterada{changedLines !== 1 ? 's' : ''} em {selectedTab ? fileName(selectedTab.path) : ''}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={sending}
            className="rounded-md px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleEnviar([...selectedPaths])}
            disabled={sending || selectedPaths.size === 0}
            title={selectedPaths.size === 0 ? 'Selecione ao menos um arquivo' : undefined}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
          >
            {sending ? 'Enviando...' : `Enviar selecionado${selectedPaths.size > 1 ? 's' : ''} (${selectedPaths.size})`}
          </button>
          <button
            onClick={() => handleEnviar(dirtyTabs.map((t) => t.path))}
            disabled={sending}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            <Send size={11} />
            {sending ? 'Enviando...' : `Enviar tudo (${dirtyTabs.length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
