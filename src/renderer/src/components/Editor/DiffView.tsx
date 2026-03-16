import { useMemo, useState } from 'react'
import { Send, Loader2, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { computeLineDiff, groupIntoHunks, applyRevert, applyAccept, type Hunk } from '../EnviarModal/diff'

interface DiffViewProps {
  fileName: string
  filePath: string
  modified: string
  original: string
  isUploading: boolean
  onEnviarFile: (path: string) => Promise<void>
  onContentChange?: (newContent: string) => void   // revert ops — updates local content
  onOriginalChange?: (newOriginal: string) => void // accept ops — updates baseline
}

export function DiffView({
  fileName,
  filePath,
  modified,
  original,
  isUploading,
  onEnviarFile,
  onContentChange,
  onOriginalChange,
}: DiffViewProps): React.JSX.Element {
  const [confirmingEnviar, setConfirmingEnviar] = useState(false)
  const [confirmingRevertAll, setConfirmingRevertAll] = useState(false)

  const diff   = useMemo(() => computeLineDiff(original, modified), [original, modified])
  const hunks  = useMemo(() => groupIntoHunks(diff), [diff])

  const hasChanges  = diff.some((l) => l.type !== 'equal')
  const changedLines = diff.filter((l) => l.type !== 'equal').length

  // Map diff-line index → hunk (for injecting the action bar before each hunk's first line)
  const lineToHunk = useMemo(() => {
    const map = new Map<number, Hunk>()
    diff.forEach((line, i) => {
      if (line.type !== 'equal') {
        const hunk = hunks.find((h) => h.lines.includes(line))
        if (hunk) map.set(i, hunk)
      }
    })
    return map
  }, [diff, hunks])

  const isFirstOfHunk = (i: number): boolean =>
    diff[i].type !== 'equal' && (i === 0 || diff[i - 1].type === 'equal')

  async function handleConfirmEnviar(): Promise<void> {
    setConfirmingEnviar(false)
    await onEnviarFile(filePath)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{fileName}</span>
          {hasChanges ? (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              {changedLines} linha{changedLines !== 1 ? 's' : ''} · {hunks.length} bloco{hunks.length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
              Sem alterações
            </span>
          )}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-1.5">

            {/* Reverter tudo */}
            {onContentChange && (
              confirmingRevertAll ? (
                <>
                  <span className="text-xs text-zinc-400">Reverter tudo?</span>
                  <button
                    onClick={() => setConfirmingRevertAll(false)}
                    className="rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => { setConfirmingRevertAll(false); onContentChange(original) }}
                    className="flex items-center gap-1 rounded bg-red-900/60 px-2 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-900"
                  >
                    <RotateCcw size={10} />
                    Confirmar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmingRevertAll(true)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-red-400"
                  title="Descartar todas as alterações"
                >
                  <RotateCcw size={10} />
                  Reverter tudo
                </button>
              )
            )}

            {/* Aceitar tudo — update baseline without upload */}
            {onOriginalChange && (
              <button
                onClick={() => onOriginalChange(modified)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-emerald-400"
                title="Marcar todas as alterações como baseline (sem enviar para o servidor)"
              >
                Aceitar tudo
                <ChevronRight size={10} />
              </button>
            )}

            <div className="h-3 w-px bg-zinc-700" />

            {/* Enviar */}
            {confirmingEnviar ? (
              <>
                <span className="text-xs text-zinc-400">Confirmar envio?</span>
                <button
                  onClick={() => setConfirmingEnviar(false)}
                  className="rounded px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmEnviar}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  Enviar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingEnviar(true)}
                disabled={isUploading}
                className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-indigo-400 transition-colors hover:bg-zinc-800 hover:text-indigo-300 disabled:opacity-50"
              >
                {isUploading ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Enviar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Column headers */}
      <div className="grid shrink-0 grid-cols-2 border-b border-zinc-800 bg-zinc-900/40">
        <div className="border-r border-zinc-800 px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Modificado
        </div>
        <div className="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Original
        </div>
      </div>

      {/* Diff body */}
      <div className="flex-1 overflow-auto font-mono text-xs">
        <table className="w-full border-collapse">
          <tbody>
            {diff.map((line, i) => {
              const isAdded   = line.type === 'added'
              const isRemoved = line.type === 'removed'
              const hunk      = lineToHunk.get(i)

              return (
                <>
                  {/* Hunk action bar — shown before first line of each hunk */}
                  {isFirstOfHunk(i) && hunk && (
                    <tr key={`hh-${hunk.id}`} className="border-y border-zinc-700/30 bg-zinc-900/60">
                      <td colSpan={2} className="px-3 py-0.5">
                        <div className="flex items-center justify-end gap-1">
                          {onContentChange && (
                            <button
                              onClick={() => onContentChange(applyRevert(modified, hunk))}
                              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-red-950/50 hover:text-red-400"
                              title="Reverter este bloco (restaurar original)"
                            >
                              <ChevronLeft size={9} />
                              Reverter bloco
                            </button>
                          )}
                          {onOriginalChange && (
                            <button
                              onClick={() => onOriginalChange(applyAccept(original, hunk))}
                              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-zinc-600 transition-colors hover:bg-emerald-950/50 hover:text-emerald-400"
                              title="Aceitar este bloco (atualizar baseline sem enviar)"
                            >
                              Aceitar bloco
                              <ChevronRight size={9} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                  <tr key={i} className="group">
                    {/* Left — modified */}
                    <td
                      className={`w-1/2 border-r border-zinc-800 align-top ${
                        isAdded ? 'bg-emerald-950/40' : isRemoved ? 'bg-red-950/30' : ''
                      }`}
                    >
                      {line.right !== null && (
                        <div className="flex">
                          <span className="w-10 shrink-0 select-none border-r border-zinc-800/60 pr-2 text-right text-zinc-600">
                            {line.lineRight}
                          </span>
                          <span className={`px-3 whitespace-pre-wrap break-all ${
                            isAdded ? 'text-emerald-300' : isRemoved ? 'text-red-300' : 'text-zinc-300'
                          }`}>
                            {isAdded && <span className="mr-1 text-emerald-500">+</span>}
                            {line.right || ' '}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Right — original */}
                    <td
                      className={`w-1/2 align-top ${
                        isRemoved ? 'bg-red-950/40' : isAdded ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {line.left !== null && (
                        <div className="flex">
                          <span className="w-10 shrink-0 select-none border-r border-zinc-800/60 pr-2 text-right text-zinc-600">
                            {line.lineLeft}
                          </span>
                          <span className={`px-3 whitespace-pre-wrap break-all ${
                            isRemoved ? 'text-red-300' : 'text-zinc-300'
                          }`}>
                            {isRemoved && <span className="mr-1 text-red-500">−</span>}
                            {line.left || ' '}
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
