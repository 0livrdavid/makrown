import { FolderOpen } from 'lucide-react'

interface LoadingScreenProps {
  done: number
  total: number
}

export function LoadingScreen({ done, total }: LoadingScreenProps): React.JSX.Element {
  const hasPeeks = total > 0
  const progress = hasPeeks ? (done / total) * 100 : null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-950">
      <div className="flex w-60 flex-col items-center gap-6">
        {/* Icon + name */}
        <div className="flex flex-col items-center gap-2.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 ring-1 ring-zinc-800">
            <FolderOpen size={22} className="text-amber-400" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-300">Makrown</span>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-zinc-800">
            {progress !== null ? (
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            ) : (
              /* Indeterminate slide animation */
              <div className="absolute inset-0">
                <div
                  className="absolute h-full w-1/3 rounded-full bg-indigo-500"
                  style={{ animation: 'loading-slide 1.4s ease-in-out infinite' }}
                />
              </div>
            )}
          </div>

          <p className="mt-2.5 text-center text-[11px] text-zinc-600">
            {hasPeeks
              ? `${done} / ${total} pastas lidas`
              : 'Lendo estrutura...'}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes loading-slide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  )
}
