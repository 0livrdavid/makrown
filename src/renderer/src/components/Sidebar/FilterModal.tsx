import { useState } from 'react'
import { Filter, RotateCcw } from 'lucide-react'
import type { FilterConfig } from './filterUtils'
import { DEFAULT_FILTER } from './filterUtils'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'

interface FilterModalProps {
  config: FilterConfig
  onSave: (config: FilterConfig) => void
  onClose: () => void
}

function Checkbox({
  id,
  checked,
  onChange,
  label,
  description
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}): React.JSX.Element {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-zinc-800/60">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-indigo-500"
      />
      <div className="min-w-0">
        <span className="block text-xs font-medium leading-[1.4] text-zinc-300">{label}</span>
        {description && <p className="text-xs leading-snug text-zinc-600">{description}</p>}
      </div>
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div>
      <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{title}</p>
      {children}
    </div>
  )
}

export function FilterModal({ config, onSave, onClose }: FilterModalProps): React.JSX.Element {
  const [draft, setDraft] = useState<FilterConfig>(config)
  const dialogRef = useModalFocusTrap({ onClose })

  function set<K extends keyof FilterConfig>(key: K, value: FilterConfig[K]): void {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const isModified = JSON.stringify(draft) !== JSON.stringify(DEFAULT_FILTER)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-modal-title"
        tabIndex={-1}
        className="w-[480px] rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2 text-zinc-300">
            <Filter size={13} />
            <span id="filter-modal-title" className="text-sm font-medium">Filtros da árvore</span>
          </div>
          {isModified && (
            <button
              onClick={() => setDraft({ ...DEFAULT_FILTER })}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
              title="Restaurar padrões"
            >
              <RotateCcw size={11} />
              Restaurar
            </button>
          )}
        </div>

        {/* Opções */}
        <div className="space-y-4 px-3 py-3">
          <Section title="Arquivos">
            <Checkbox
              id="onlyMarkdown"
              checked={draft.onlyMarkdown}
              onChange={(v) => set('onlyMarkdown', v)}
              label="Apenas arquivos .md"
              description="Oculta arquivos que não sejam markdown"
            />
            <Checkbox
              id="hideEmptyFolders"
              checked={draft.hideEmptyFolders}
              onChange={(v) => set('hideEmptyFolders', v)}
              label="Ocultar pastas vazias"
              description="Oculta pastas sem nenhum filho visível após filtros"
            />
            <Checkbox
              id="hideHiddenFiles"
              checked={draft.hideHiddenFiles}
              onChange={(v) => set('hideHiddenFiles', v)}
              label="Ocultar arquivos e pastas ocultas"
              description="Itens que começam com ponto (.git, .env…)"
            />
          </Section>

          <Section title="Ignorar">
            <div className="px-1">
              <textarea
                value={draft.customIgnore}
                onChange={(e) => set('customIgnore', e.target.value)}
                placeholder={'# Um padrão por linha\nnode_modules\n*.log\ntmp\nbuild-*'}
                rows={5}
                spellCheck={false}
                className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-300 outline-none placeholder:text-zinc-600 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30"
              />
              <p className="mt-1 text-[10px] text-zinc-600">
                Arquivos e pastas · um por linha · suporta glob com <code className="text-zinc-500">*</code> · prefixe com <code className="text-zinc-500">#</code> para comentar
              </p>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-800 px-4 py-2.5">
          <button
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            Fechar
          </button>
          <button
            onClick={() => { onSave(draft); onClose() }}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
