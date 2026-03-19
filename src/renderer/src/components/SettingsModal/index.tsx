import { useState } from 'react'
import { ChevronLeft, Type, FolderTree, Server, RefreshCw, GitCompare } from 'lucide-react'
import type { EditorPrefs } from '../Editor'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'
import type { UpdateState } from '../../utils/updater'
import { formatByteSize, formatSpeed } from '../../utils/updater'

export interface VpsPrefs {
  autoSaveEnabled: boolean
  autoSaveDelay: number // seconds
}

interface SettingsPageProps {
  editorPrefs: EditorPrefs
  onEditorPrefsChange: (prefs: EditorPrefs) => void
  onClose: () => void
  isRemote?: boolean
  vpsPrefs?: VpsPrefs
  onVpsPrefsChange?: (prefs: VpsPrefs) => void
  localDiffEnabled?: boolean
  onLocalDiffChange?: (enabled: boolean) => void
  updateState: UpdateState
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
}

// ─── Static data ────────────────────────────────────────────────────────────

type SectionId = 'fonte' | 'navegacao' | 'alteracoes' | 'vps' | 'atualizacoes'

interface NavItem { id: SectionId; label: string; description: string; icon: React.ElementType }
interface NavGroup { group: string; items: NavItem[] }

const NAV_BASE: NavGroup[] = [
  {
    group: 'Editor',
    items: [
      { id: 'fonte', label: 'Fonte', description: 'Família e tamanho', icon: Type },
      { id: 'alteracoes', label: 'Alterações', description: 'Rastreamento local', icon: GitCompare },
    ],
  },
  {
    group: 'Árvore de arquivos',
    items: [{ id: 'navegacao', label: 'Navegação', description: 'Pré-carregamento', icon: FolderTree }],
  },
]

const NAV_VPS: NavGroup = {
  group: 'VPS',
  items: [{ id: 'vps', label: 'Auto-save', description: 'Envio automático', icon: Server }],
}

const NAV_APP: NavGroup = {
  group: 'Aplicativo',
  items: [{ id: 'atualizacoes', label: 'Atualizações', description: 'Verificar nova versão', icon: RefreshCw }],
}

const PREFETCH_DEPTH_KEY = 'makrown:prefetch-depth'
const DEFAULT_PREFETCH_DEPTH = 3

const FONT_SIZES = [13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 32]

const FONT_OPTIONS: { value: EditorPrefs['fontFamily']; label: string; family: string }[] = [
  { value: 'sans',  label: 'Sans',  family: 'ui-sans-serif, system-ui, sans-serif' },
  { value: 'serif', label: 'Serif', family: 'ui-serif, Georgia, serif' },
  { value: 'mono',  label: 'Mono',  family: '"JetBrains Mono", "Fira Code", ui-monospace, monospace' },
]

// ─── Live preview ────────────────────────────────────────────────────────────

function EditorPreview({ fontFamily, fontSize }: { fontFamily: string; fontSize: number }): React.JSX.Element {
  const base: React.CSSProperties = { fontFamily, fontSize, lineHeight: 1.75, color: '#d4d4d8' }
  const h1:   React.CSSProperties = { ...base, fontSize: Math.round(fontSize * 1.75), fontWeight: 700, color: '#f4f4f5', lineHeight: 1.2, marginBottom: '0.5em' }
  const h2:   React.CSSProperties = { ...base, fontSize: Math.round(fontSize * 1.25), fontWeight: 600, color: '#e4e4e7', lineHeight: 1.3, margin: '1.1em 0 0.4em' }
  const p:    React.CSSProperties = { ...base, marginBottom: '0.8em' }
  const code: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: Math.round(fontSize * 0.88),
    background: '#27272a',
    padding: '0.15em 0.4em',
    borderRadius: 4,
    color: '#a78bfa',
  }
  const pre: React.CSSProperties = {
    fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace',
    fontSize: Math.round(fontSize * 0.88),
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: 6,
    padding: '0.75em 1em',
    color: '#a1a1aa',
    lineHeight: 1.6,
    marginTop: '0.6em',
    overflow: 'auto',
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-950 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-2">
        <span className="text-[11px] text-zinc-400 font-medium">exemplo.md</span>
      </div>
      <div className="px-10 py-6">
        <div style={h1}>Título do documento</div>
        <p style={p}>
          Este é um parágrafo com texto <strong style={{ color: '#f4f4f5' }}>negrito</strong>,{' '}
          <em>itálico</em> e <span style={code}>código inline</span>.
        </p>
        <div style={h2}>Seção secundária</div>
        <p style={p}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          Sed do eiusmod tempor ut labore et dolore.
        </p>
        <pre style={pre}>{`function hello(name) {\n  return \`Olá, \${name}!\`\n}`}</pre>
      </div>
    </div>
  )
}

// ─── Font section ─────────────────────────────────────────────────────────────

function FontSection({
  editorPrefs,
  onChange,
}: {
  editorPrefs: EditorPrefs
  onChange: (prefs: EditorPrefs) => void
}): React.JSX.Element {
  const currentFontFamily = FONT_OPTIONS.find((o) => o.value === editorPrefs.fontFamily)?.family ?? FONT_OPTIONS[0].family
  const sizeIdx = FONT_SIZES.indexOf(editorPrefs.fontSize)

  function changeSize(delta: number): void {
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, sizeIdx === -1 ? 2 : sizeIdx + delta))
    const next = FONT_SIZES[nextIdx]
    if (next !== editorPrefs.fontSize) onChange({ ...editorPrefs, fontSize: next })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-zinc-100">Fonte</h2>

      <div>
        <p className="mb-2.5 text-xs font-medium text-zinc-400">Família</p>
        <div className="flex gap-2">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...editorPrefs, fontFamily: opt.value })}
              className={`flex flex-1 flex-col items-center gap-2 rounded-lg border px-3 py-3.5 transition-colors ${
                editorPrefs.fontFamily === opt.value
                  ? 'border-indigo-500 bg-indigo-600/10 text-indigo-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-700/40'
              }`}
            >
              <span className="text-2xl font-medium leading-none" style={{ fontFamily: opt.family }}>
                Ag
              </span>
              <span className="text-[11px] font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-xs font-medium text-zinc-400">Tamanho</p>
        <div className="flex w-36 items-center gap-0 rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
          <button
            onClick={() => changeSize(-1)}
            disabled={sizeIdx <= 0}
            className="flex h-8 w-9 items-center justify-center text-base text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
          >
            −
          </button>
          <div className="flex flex-1 items-center justify-center gap-1 border-x border-zinc-700">
            <span className="text-sm font-medium tabular-nums text-zinc-200">{editorPrefs.fontSize}</span>
            <span className="text-xs text-zinc-500">px</span>
          </div>
          <button
            onClick={() => changeSize(1)}
            disabled={sizeIdx >= FONT_SIZES.length - 1}
            className="flex h-8 w-9 items-center justify-center text-base text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
          >
            +
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">Opções: {FONT_SIZES.join(', ')} px</p>
      </div>

      <div>
        <p className="mb-2.5 text-xs font-medium text-zinc-400">Pré-visualização</p>
        <EditorPreview fontFamily={currentFontFamily} fontSize={editorPrefs.fontSize} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-300">Modo Raw</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Exibe um terceiro botão na barra do editor para editar o markdown puro
          </p>
        </div>
        <button
          onClick={() => onChange({ ...editorPrefs, rawModeEnabled: !editorPrefs.rawModeEnabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            editorPrefs.rawModeEnabled ? 'bg-indigo-600' : 'bg-zinc-600'
          }`}
          role="switch"
          aria-checked={editorPrefs.rawModeEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              editorPrefs.rawModeEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className={editorPrefs.rawModeEnabled ? '' : 'pointer-events-none opacity-40'}>
        <p className="mb-2.5 text-xs font-medium text-zinc-400">Tamanho do Tab (modo raw)</p>
        <div className="flex gap-2">
          {[2, 4, 8].map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...editorPrefs, tabSize: n })}
              className={`flex h-8 w-10 items-center justify-center rounded-lg border text-xs font-medium transition-colors ${
                editorPrefs.tabSize === n
                  ? 'border-indigo-500 bg-indigo-600/10 text-indigo-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-700/40'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Navigation section ───────────────────────────────────────────────────────

function NavigationSection(): React.JSX.Element {
  const [depth, setDepth] = useState(() => {
    try {
      const raw = localStorage.getItem(PREFETCH_DEPTH_KEY)
      return raw ? Math.max(1, Math.min(10, Number(raw))) : DEFAULT_PREFETCH_DEPTH
    } catch {
      return DEFAULT_PREFETCH_DEPTH
    }
  })

  function changeDepth(next: number): void {
    const clamped = Math.max(1, Math.min(10, next))
    setDepth(clamped)
    localStorage.setItem(PREFETCH_DEPTH_KEY, String(clamped))
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-zinc-100">Navegação</h2>

      <div>
        <p className="mb-2.5 text-xs font-medium text-zinc-400">Profundidade de pré-carregamento</p>
        <p className="mb-3 text-xs text-zinc-500">
          Ao abrir um projeto, a árvore pré-carrega pastas até essa profundidade.
          Pastas dentro desse limite abrem instantaneamente.
        </p>
        <div className="flex w-36 items-center gap-0 rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
          <button
            onClick={() => changeDepth(depth - 1)}
            disabled={depth <= 1}
            className="flex h-8 w-9 items-center justify-center text-base text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
          >
            −
          </button>
          <div className="flex flex-1 items-center justify-center gap-1 border-x border-zinc-700">
            <span className="text-sm font-medium tabular-nums text-zinc-200">{depth}</span>
          </div>
          <button
            onClick={() => changeDepth(depth + 1)}
            disabled={depth >= 10}
            className="flex h-8 w-9 items-center justify-center text-base text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
          >
            +
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">
          Valores maiores deixam a navegação mais fluida, mas o carregamento inicial demora mais
        </p>
      </div>
    </div>
  )
}

// ─── VPS section ──────────────────────────────────────────────────────────────

const DELAY_MIN = 5
const DELAY_MAX = 120
const DELAY_STEP = 5

function DiffTrackingSection({
  enabled,
  onChange,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
}): React.JSX.Element {
  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-zinc-100">Alterações</h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-300">Rastrear alterações em projetos locais</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Mostra o painel de alterações na sidebar e permite visualizar diffs
          </p>
        </div>
        <button
          onClick={() => onChange(!enabled)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            enabled ? 'bg-indigo-600' : 'bg-zinc-600'
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )
}

function VpsSection({
  vpsPrefs,
  onChange,
}: {
  vpsPrefs: VpsPrefs
  onChange: (prefs: VpsPrefs) => void
}): React.JSX.Element {
  function changeDelay(delta: number): void {
    const next = Math.max(DELAY_MIN, Math.min(DELAY_MAX, vpsPrefs.autoSaveDelay + delta))
    if (next !== vpsPrefs.autoSaveDelay) onChange({ ...vpsPrefs, autoSaveDelay: next })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-zinc-100">Auto-save</h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-300">Enviar automaticamente</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Envia as alterações ao VPS após o delay configurado
          </p>
        </div>
        <button
          onClick={() => onChange({ ...vpsPrefs, autoSaveEnabled: !vpsPrefs.autoSaveEnabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
            vpsPrefs.autoSaveEnabled ? 'bg-indigo-600' : 'bg-zinc-600'
          }`}
          role="switch"
          aria-checked={vpsPrefs.autoSaveEnabled}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              vpsPrefs.autoSaveEnabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      <div className={vpsPrefs.autoSaveEnabled ? '' : 'opacity-40 pointer-events-none'}>
        <p className="mb-2.5 text-xs font-medium text-zinc-400">Delay</p>
        <div className="flex w-36 items-center gap-0 rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
          <button
            onClick={() => changeDelay(-DELAY_STEP)}
            disabled={vpsPrefs.autoSaveDelay <= DELAY_MIN}
            className="flex h-8 w-9 items-center justify-center text-base text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
          >
            −
          </button>
          <div className="flex flex-1 items-center justify-center gap-1 border-x border-zinc-700">
            <span className="text-sm font-medium tabular-nums text-zinc-200">{vpsPrefs.autoSaveDelay}</span>
            <span className="text-xs text-zinc-500">s</span>
          </div>
          <button
            onClick={() => changeDelay(DELAY_STEP)}
            disabled={vpsPrefs.autoSaveDelay >= DELAY_MAX}
            className="flex h-8 w-9 items-center justify-center text-base text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-30"
          >
            +
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-600">
          Entre {DELAY_MIN}s e {DELAY_MAX}s · incrementos de {DELAY_STEP}s
        </p>
      </div>
    </div>
  )
}

// ─── Update section ───────────────────────────────────────────────────────────

function UpdateSection({
  state,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}: {
  state: UpdateState
  onCheckForUpdates: () => void
  onDownloadUpdate: () => void
  onInstallUpdate: () => void
}): React.JSX.Element {
  const appVersion = window.api?.appVersion ?? '0.1.0'

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-zinc-100">Atualizações</h2>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3.5">
        <div>
          <p className="text-xs font-medium text-zinc-300">Versão atual</p>
          <p className="mt-0.5 font-mono text-sm text-zinc-100">{appVersion}</p>
        </div>
        {state.kind === 'up-to-date' && (
          <span className="mt-0.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            Atualizado
          </span>
        )}
      </div>

      {/* Status messages */}
      {state.kind === 'up-to-date' && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-600/10 px-4 py-3">
          <p className="text-xs font-medium text-emerald-300">Você está na versão mais recente</p>
          <p className="mt-0.5 text-[11px] text-emerald-400/70">Nenhuma atualização disponível no momento.</p>
        </div>
      )}
      {state.kind === 'available' && (
        <div className="rounded-lg border border-indigo-700/50 bg-indigo-600/10 px-4 py-3">
          <p className="text-xs font-medium text-indigo-300">
            Nova versão disponível: <span className="font-mono">{state.version}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-indigo-400/70">
            Você pode baixar em segundo plano e continuar usando o app.
          </p>
        </div>
      )}
      {state.kind === 'downloading' && (
        <div className="space-y-2">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>Baixando Makrown {state.version}…</span>
            <span>{state.percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${state.percent}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500">
            {formatByteSize(state.transferredBytes)} / {formatByteSize(state.totalBytes)} • {formatSpeed(state.bytesPerSecond)}
          </p>
        </div>
      )}
      {state.kind === 'downloaded' && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-600/10 px-4 py-3">
          <p className="text-xs font-medium text-emerald-300">
            Atualização pronta para instalar: <span className="font-mono">{state.version}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-400/70">
            {state.action === 'reveal'
              ? 'O instalador foi baixado. Você pode abrir o .dmg direto daqui ou pelo Finder.'
              : 'O aplicativo vai reiniciar para aplicar.'}
          </p>
        </div>
      )}
      {state.kind === 'error' && (
        <div className="rounded-lg border border-red-700/50 bg-red-600/10 px-4 py-3">
          <p className="text-xs font-medium text-red-300">Erro na atualização</p>
          <p className="mt-0.5 text-[11px] text-red-400/80">{state.message}</p>
          {state.details && (
            <p className="mt-2 text-[10px] text-red-400/60 font-mono break-all">{state.details}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {(state.kind === 'idle' || state.kind === 'up-to-date' || state.kind === 'error') && (
          <button
            onClick={onCheckForUpdates}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-100"
          >
            <RefreshCw size={12} />
            Verificar atualização
          </button>
        )}
        {state.kind === 'checking' && (
          <button disabled className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-500 opacity-60">
            <RefreshCw size={12} className="animate-spin" />
            Verificando…
          </button>
        )}
        {state.kind === 'available' && (
          <button
            onClick={onDownloadUpdate}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Baixar atualização
          </button>
        )}
        {state.kind === 'downloaded' && (
          <button
            onClick={onInstallUpdate}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            {state.action === 'reveal' ? 'Abrir instalador' : 'Reiniciar e instalar'}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Full-screen settings page ────────────────────────────────────────────────

export function SettingsModal({
  editorPrefs,
  onEditorPrefsChange,
  onClose,
  isRemote,
  vpsPrefs,
  onVpsPrefsChange,
  localDiffEnabled = true,
  onLocalDiffChange,
  updateState,
  onCheckForUpdates,
  onDownloadUpdate,
  onInstallUpdate,
}: SettingsPageProps): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<SectionId>('fonte')
  const nav = [...NAV_BASE, NAV_VPS, NAV_APP]
  const dialogRef = useModalFocusTrap({ onClose })

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      tabIndex={-1}
      className="flex h-screen flex-col bg-zinc-950 text-zinc-100"
    >

      {/* Top bar — draggable, traffic light clearance */}
      <div
        className="flex h-9 shrink-0 items-center border-b border-zinc-800 bg-zinc-950 pl-20 pr-3"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Back */}
        <button
          onClick={onClose}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <ChevronLeft size={13} />
          Voltar
        </button>

        {/* Title — centered, draggable */}
        <span id="settings-title" className="flex-1 text-center text-xs font-semibold text-zinc-300">
          Configurações
        </span>

        <span className="text-[11px] text-zinc-600" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          Alterações aplicadas automaticamente
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-900 pt-3">
          {nav.map(({ group, items }, gi) => (
            <div key={group}>
              {gi > 0 && <div className="mx-4 my-2 border-t border-zinc-800/70" />}
              <p className="px-4 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {group}
              </p>
              {items.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`relative flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    activeSection === id
                      ? 'bg-zinc-800/60 text-zinc-100'
                      : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
                  }`}
                >
                  {activeSection === id && (
                    <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r bg-indigo-500" />
                  )}
                  <Icon
                    size={14}
                    className={activeSection === id ? 'shrink-0 text-indigo-400' : 'shrink-0 text-zinc-500'}
                  />
                  <div>
                    <div className="text-xs font-medium leading-tight">{label}</div>
                    <div className="mt-0.5 text-[10px] text-zinc-600 leading-tight">{description}</div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="px-10 py-8">
            {activeSection === 'fonte' && (
              <FontSection editorPrefs={editorPrefs} onChange={onEditorPrefsChange} />
            )}
            {activeSection === 'navegacao' && (
              <NavigationSection />
            )}
            {activeSection === 'alteracoes' && onLocalDiffChange && (
              <DiffTrackingSection enabled={localDiffEnabled} onChange={onLocalDiffChange} />
            )}
            {activeSection === 'vps' && vpsPrefs && onVpsPrefsChange && (
              <VpsSection vpsPrefs={vpsPrefs} onChange={onVpsPrefsChange} />
            )}
            {activeSection === 'atualizacoes' && (
              <UpdateSection
                state={updateState}
                onCheckForUpdates={onCheckForUpdates}
                onDownloadUpdate={onDownloadUpdate}
                onInstallUpdate={onInstallUpdate}
              />
            )}
          </div>
        </main>

      </div>
    </div>
  )
}
