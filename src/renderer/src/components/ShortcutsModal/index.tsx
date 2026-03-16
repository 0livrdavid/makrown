import { X } from 'lucide-react'

interface ShortcutsModalProps {
  onClose: () => void
}

const isMac = typeof window !== 'undefined' && window.api?.platform === 'darwin'
const Mod = isMac ? '⌘' : 'Ctrl'
const Shift = '⇧'
const Alt = isMac ? '⌥' : 'Alt'

interface Shortcut {
  keys: string[]
  description: string
}

interface Section {
  title: string
  shortcuts: Shortcut[]
}

const SECTIONS: Section[] = [
  {
    title: 'Arquivo',
    shortcuts: [
      { keys: [Mod, 'O'], description: 'Abrir pasta' },
      { keys: [Mod, 'S'], description: 'Salvar arquivo' },
      { keys: [Mod, 'W'], description: 'Fechar aba' },
    ],
  },
  {
    title: 'Busca',
    shortcuts: [
      { keys: [Mod, 'P'], description: 'Buscar arquivo pelo nome' },
      { keys: [Mod, Shift, 'F'], description: 'Buscar no conteúdo dos arquivos' },
    ],
  },
  {
    title: 'Visualização',
    shortcuts: [
      { keys: [Mod, '1'], description: 'Modo Preview (WYSIWYG)' },
      { keys: [Mod, '2'], description: 'Modo Editor (markdown raw)' },
      { keys: [Mod, '3'], description: 'Modo Visualize (renderizado)' },
    ],
  },
  {
    title: 'Navegação',
    shortcuts: [
      { keys: ['↑', '↓'], description: 'Navegar resultados de busca' },
      { keys: ['↵'], description: 'Abrir arquivo selecionado' },
      { keys: ['Esc'], description: 'Fechar modal / painel' },
    ],
  },
  {
    title: 'Ajuda',
    shortcuts: [
      { keys: [Mod, '/'], description: 'Mostrar atalhos de teclado' },
    ],
  },
]

function KeyBadge({ children }: { children: string }): React.JSX.Element {
  return (
    <kbd className="inline-flex min-w-[1.4rem] items-center justify-center rounded border border-zinc-600 bg-zinc-700 px-1.5 py-0.5 text-[11px] font-medium text-zinc-200 shadow-[0_1px_0_0_#27272a]">
      {children}
    </kbd>
  )
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex w-[520px] max-h-[80vh] flex-col rounded-xl border border-zinc-700 bg-zinc-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
          <span className="text-sm font-semibold text-zinc-100">Atalhos de teclado</span>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-zinc-700/40">
                    <span className="text-xs text-zinc-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        <KeyBadge key={ki}>{key}</KeyBadge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-700 px-5 py-3 text-[11px] text-zinc-600">
          {isMac ? '⌘ = Command  ·  ⇧ = Shift  ·  ⌥ = Option' : 'Ctrl = Control  ·  Shift = Shift  ·  Alt = Alt'}
        </div>
      </div>
    </div>
  )
}
