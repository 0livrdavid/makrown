import { useMemo, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { computeLineDiff } from '../EnviarModal/diff'

interface DiffViewProps {
  fileName: string
  filePath: string
  modified: string
  original: string
  isUploading: boolean
  onEnviarFile: (path: string) => Promise<void>
}

export function DiffView({ fileName, filePath, modified, original, isUploading, onEnviarFile }: DiffViewProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)

  const diff = useMemo(() => computeLineDiff(original, modified), [original, modified])
  const hasChanges = diff.some((l) => l.type !== 'equal')
  const changedLines = diff.filter((l) => l.type !== 'equal').length

  async function handleConfirmEnviar(): Promise<void> {
    setConfirming(false)
    await onEnviarFile(filePath)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Diff header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{fileName}</span>
          {hasChanges ? (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
              {changedLines} linha{changedLines !== 1 ? 's' : ''} alterada{changedLines !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
              Sem alterações
            </span>
          )}
        </div>

        {/* Enviar com confirmação */}
        {hasChanges && (
          <div className="flex items-center gap-2">
            {confirming ? (
              <>
                <span className="text-xs text-zinc-400">Confirmar envio?</span>
                <button
                  onClick={() => setConfirming(false)}
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
                onClick={() => setConfirming(true)}
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
              const isAdded = line.type === 'added'
              const isRemoved = line.type === 'removed'

              return (
                <tr key={i} className="group">
                  {/* Left — modified */}
                  <td
                    className={`w-1/2 border-r border-zinc-800 align-top ${
                      isAdded
                        ? 'bg-emerald-950/40'
                        : isRemoved
                          ? 'bg-red-950/30'
                          : ''
                    }`}
                  >
                    {line.right !== null && (
                      <div className="flex">
                        <span className="w-10 shrink-0 select-none border-r border-zinc-800/60 pr-2 text-right text-zinc-600">
                          {line.lineRight}
                        </span>
                        <span
                          className={`px-3 whitespace-pre-wrap break-all ${
                            isAdded ? 'text-emerald-300' : isRemoved ? 'text-red-300' : 'text-zinc-300'
                          }`}
                        >
                          {isAdded && <span className="mr-1 text-emerald-500">+</span>}
                          {line.right || ' '}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Right — original */}
                  <td
                    className={`w-1/2 align-top ${
                      isRemoved
                        ? 'bg-red-950/40'
                        : isAdded
                          ? 'bg-emerald-950/20'
                          : ''
                    }`}
                  >
                    {line.left !== null && (
                      <div className="flex">
                        <span className="w-10 shrink-0 select-none border-r border-zinc-800/60 pr-2 text-right text-zinc-600">
                          {line.lineLeft}
                        </span>
                        <span
                          className={`px-3 whitespace-pre-wrap break-all ${
                            isRemoved ? 'text-red-300' : 'text-zinc-300'
                          }`}
                        >
                          {isRemoved && <span className="mr-1 text-red-500">−</span>}
                          {line.left || ' '}
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
