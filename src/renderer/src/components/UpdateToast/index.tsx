import { AlertCircle, CheckCircle2, Download, RefreshCw, X } from 'lucide-react'
import type { UpdateState } from '../../utils/updater'
import { formatByteSize, formatSpeed } from '../../utils/updater'

interface UpdateToastProps {
  state: UpdateState
  onDownload: () => void
  onInstall: () => void
  onOpenSettings: () => void
  onDismiss: () => void
}

export function UpdateToast({
  state,
  onDownload,
  onInstall,
  onOpenSettings,
  onDismiss,
}: UpdateToastProps): React.JSX.Element | null {
  if (
    state.kind === 'idle' ||
    state.kind === 'checking' ||
    state.kind === 'up-to-date'
  ) {
    return null
  }

  const progressDetails =
    state.kind === 'downloading'
      ? `${formatByteSize(state.transferredBytes)} / ${formatByteSize(state.totalBytes)} • ${formatSpeed(state.bytesPerSecond)}`
      : null

  return (
    <div className="pointer-events-none fixed bottom-8 right-4 z-[210]">
      <div className="pointer-events-auto w-96 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3 border-b border-zinc-800 px-4 py-3">
          <div className="mt-0.5 shrink-0">
            {state.kind === 'available' && <Download size={16} className="text-indigo-400" />}
            {state.kind === 'downloading' && <RefreshCw size={16} className="animate-spin text-indigo-400" />}
            {state.kind === 'downloaded' && <CheckCircle2 size={16} className="text-emerald-400" />}
            {state.kind === 'error' && <AlertCircle size={16} className="text-red-400" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-100">
              {state.kind === 'available' && `Makrown ${state.version} disponível`}
              {state.kind === 'downloading' && `Baixando Makrown ${state.version}`}
              {state.kind === 'downloaded' && `Makrown ${state.version} pronto para instalar`}
              {state.kind === 'error' && 'Erro na atualização'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">
              {state.kind === 'available' &&
                'Você pode baixar em segundo plano e continuar usando o app normalmente.'}
              {state.kind === 'downloading' && progressDetails}
              {state.kind === 'downloaded' &&
                (state.action === 'reveal'
                  ? 'O instalador foi baixado. O Finder foi aberto, e você também pode abrir o .dmg direto por aqui.'
                  : 'O app pode reiniciar agora para aplicar a nova versão.')}
              {state.kind === 'error' && state.message}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            aria-label="Ocultar atualização"
          >
            <X size={14} />
          </button>
        </div>

        {state.kind === 'downloading' && (
          <div className="px-4 pt-3">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Progresso</span>
              <span>{state.percent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${state.percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <button
            onClick={onOpenSettings}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100"
          >
            Atualizações
          </button>
          {state.kind === 'available' && (
            <button
              onClick={onDownload}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Baixar
            </button>
          )}
          {state.kind === 'downloaded' && (
            <button
              onClick={onInstall}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
            >
              {state.action === 'reveal' ? 'Abrir instalador' : 'Reiniciar e instalar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
