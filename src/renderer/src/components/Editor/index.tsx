import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Save, Upload, Loader2, X, FileText, GitCompare, PenLine, Eye, Settings, Send } from 'lucide-react'
import { encode } from 'gpt-tokenizer'
import { MilkdownEditor } from './MilkdownEditor'
import { MarkdownPreview } from './MarkdownPreview'
import { DiffView } from './DiffView'

export interface OpenTab {
  path: string
  name: string
  type: 'file' | 'diff'
  content: string
  originalContent: string
  isDirty: boolean
  isNormalized: boolean
  isUploading: boolean
  diffOf?: string        // only for type === 'diff': path of the source file
  contentVersion?: number // increment to force EditorPane remount after programmatic edit
}

export type LayoutMode = 'editor' | 'visualize'

export interface EditorPrefs {
  fontFamily: 'sans' | 'serif' | 'mono'
  fontSize: number
}

const FONT_FAMILY_MAP: Record<EditorPrefs['fontFamily'], string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: '"JetBrains Mono", "Fira Code", monospace',
}

interface EditorProps {
  tabs: OpenTab[]
  pendingUploads?: OpenTab[]
  activeTabPath: string | null
  layoutMode: LayoutMode
  onLayoutChange: (mode: LayoutMode) => void
  onTabChange: (path: string) => void
  onTabClose: (path: string) => void
  onSave: (path: string, content: string) => Promise<void>
  onContentChange: (path: string, content: string) => void
  onDiffRevert: (filePath: string, newContent: string) => void
  onDiffAccept: (filePath: string, newOriginal: string) => void
  editorPrefs: EditorPrefs
  onEditorPrefsChange: (prefs: EditorPrefs) => void
  onOpenSettings: () => void
  onEnviar: () => void
  onEnviarFile: (path: string) => Promise<void>
  onNormalized: (path: string, normalizedContent: string) => void
  isRemote: boolean
  autoSaveEnabled?: boolean
}

function EditorPane({
  tab,
  onSave,
  onContentChange,
  onNormalized,
  layout,
  editorPrefs,
  isRemote,
}: {
  tab: OpenTab
  onSave: (path: string, content: string) => Promise<void>
  onContentChange: (path: string, content: string) => void
  onNormalized: (path: string, normalizedContent: string) => void
  layout: LayoutMode
  editorPrefs: EditorPrefs
  isRemote: boolean
}): React.JSX.Element {
  const contentRef = useRef(tab.content)

  const handleChange = useCallback(
    (value: string) => {
      contentRef.current = value
      onContentChange(tab.path, value)
    },
    [tab.path, onContentChange]
  )

  const handleSave = useCallback(async () => {
    await onSave(tab.path, contentRef.current)
  }, [tab.path, onSave])

  const handleReady = useCallback((normalizedContent: string) => {
    onNormalized(tab.path, normalizedContent)
  }, [tab.path, onNormalized])

  // Cmd+S listener per pane — no-op in VPS mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const mod = window.api.platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (mod && e.key === 's') {
        e.preventDefault()
        if (!isRemote) handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleSave, isRemote])

  if (layout === 'visualize') {
    return (
      <div className="h-full overflow-hidden">
        <MarkdownPreview
          content={tab.content}
          fontFamily={FONT_FAMILY_MAP[editorPrefs.fontFamily]}
          fontSize={editorPrefs.fontSize}
        />
      </div>
    )
  }

  return (
    <MilkdownEditor
      content={tab.content}
      onChange={handleChange}
      onSave={handleSave}
      onReady={handleReady}
      fontFamily={FONT_FAMILY_MAP[editorPrefs.fontFamily]}
      fontSize={editorPrefs.fontSize}
    />
  )
}

function ActionBar({
  tab,
  layoutMode,
  onLayoutChange,
  onSave,
  isRemote,
}: {
  tab: OpenTab
  layoutMode: LayoutMode
  onLayoutChange: (mode: LayoutMode) => void
  onSave: (path: string, content: string) => Promise<void>
  isRemote: boolean
}): React.JSX.Element {
  const stats = useMemo(() => {
    const text = tab.content.trim()
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const chars = tab.content.length
    const bytes = new TextEncoder().encode(tab.content).length
    const tokens = encode(tab.content).length
    return { words, chars, bytes, tokens }
  }, [tab.content])

  const fileSize = useMemo(() => {
    const b = stats.bytes
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }, [stats.bytes])

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 bg-zinc-950 px-4 py-1.5">
      {/* Word / char count */}
      <span className="text-[11px] text-zinc-600 select-none tabular-nums">
        {stats.words} {stats.words === 1 ? 'palavra' : 'palavras'} · {stats.chars} {stats.chars === 1 ? 'caractere' : 'caracteres'} · {fileSize} · {stats.tokens.toLocaleString()} tokens
      </span>

      <div className="flex items-center gap-2">
        {/* Layout toggle */}
        <div className="flex items-center gap-0.5 rounded-md bg-zinc-900 p-0.5 ring-1 ring-zinc-800">
          {([
            ['editor', PenLine, 'Editor'],
            ['visualize', Eye, 'Visualize'],
          ] as [LayoutMode, React.ElementType, string][]).map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => onLayoutChange(mode)}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${layoutMode === mode ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>

        {/* Save / Upload */}
        {isRemote ? (
          <button
            onClick={() => onSave(tab.path, tab.content)}
            disabled={!tab.isDirty || tab.isUploading}
            className={`rounded-md p-1.5 transition-colors ${
              tab.isUploading
                ? 'cursor-default text-blue-400'
                : tab.isDirty
                  ? 'text-blue-400 hover:bg-zinc-800 hover:text-blue-300'
                  : 'cursor-default text-zinc-600'
            }`}
            title={tab.isUploading ? 'Enviando...' : tab.isDirty ? 'Enviar arquivo' : 'Sem alterações'}
          >
            {tab.isUploading
              ? <Loader2 size={13} className="animate-spin" />
              : <Upload size={13} />
            }
          </button>
        ) : (
          <button
            onClick={() => onSave(tab.path, tab.content)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              tab.isDirty
                ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'
            }`}
            title="Salvar (Cmd+S)"
          >
            <Save size={11} />
            {tab.isDirty ? 'Salvar' : 'Salvo'}
          </button>
        )}
      </div>
    </div>
  )
}

export function Editor({
  tabs,
  pendingUploads = [],
  activeTabPath,
  layoutMode,
  onLayoutChange,
  onTabChange,
  onTabClose,
  onSave,
  onContentChange,
  onDiffRevert,
  onDiffAccept,
  editorPrefs,
  onEditorPrefsChange: _onEditorPrefsChange,
  onOpenSettings,
  onEnviar,
  onEnviarFile,
  onNormalized,
  isRemote,
  autoSaveEnabled = false,
}: EditorProps): React.JSX.Element {
  const activeTab = tabs.find((t) => t.path === activeTabPath) ?? null

  // Inject a <style> tag to apply font with !important, reliably overriding Milkdown internals
  useEffect(() => {
    const styleId = 'makrown-editor-font'
    let style = document.getElementById(styleId) as HTMLStyleElement | null
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    const ff = FONT_FAMILY_MAP[editorPrefs.fontFamily]
    const fs = editorPrefs.fontSize
    // Root: actual values (also enforced inline by MutationObserver in MilkdownEditor)
    // Children: force inheritance so Milkdown's own CSS rules don't win via specificity.
    // font-size: inherit only on body-level elements — headings keep their natural scale.
    style.textContent = `
      .milkdown-editor .ProseMirror { font-family: ${ff} !important; font-size: ${fs}px !important; padding-left: 80px !important; }
      .milkdown-editor .ProseMirror p,
      .milkdown-editor .ProseMirror h1,
      .milkdown-editor .ProseMirror h2,
      .milkdown-editor .ProseMirror h3,
      .milkdown-editor .ProseMirror h4,
      .milkdown-editor .ProseMirror h5,
      .milkdown-editor .ProseMirror h6,
      .milkdown-editor .ProseMirror li,
      .milkdown-editor .ProseMirror td,
      .milkdown-editor .ProseMirror th,
      .milkdown-editor .ProseMirror blockquote { font-family: inherit !important; }
      .milkdown-editor .ProseMirror p,
      .milkdown-editor .ProseMirror li,
      .milkdown-editor .ProseMirror td,
      .milkdown-editor .ProseMirror th,
      .milkdown-editor .ProseMirror blockquote { font-size: inherit !important; }
    `
  }, [editorPrefs.fontFamily, editorPrefs.fontSize])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar — always rendered so the settings gear is always visible */}
      <div
        className="flex h-9 shrink-0 border-b border-zinc-800 bg-zinc-900/80"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Tabs — scrollable */}
        <div
          className="flex min-w-0 items-stretch overflow-x-auto"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {tabs.map((tab) => {
            const isActive = tab.path === activeTabPath
            return (
              <div
                key={tab.path}
                role="button"
                tabIndex={0}
                onClick={() => onTabChange(tab.path)}
                onKeyDown={(e) => e.key === 'Enter' && onTabChange(tab.path)}
                className={`group relative flex shrink-0 cursor-pointer items-center gap-1.5 px-4 py-2.5 text-xs transition-colors select-none ${
                  isActive
                    ? 'bg-zinc-950 text-zinc-200'
                    : 'text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-x-0 top-0 h-px bg-indigo-500" />
                )}
                <span className="flex max-w-36 items-center gap-1 truncate font-medium">
                  {tab.type === 'diff'
                    ? <GitCompare size={10} className="shrink-0 text-zinc-500" />
                    : tab.isDirty && <span className="mr-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                  }
                  {tab.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onTabClose(tab.path) }}
                  className="ml-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100 hover:bg-zinc-700"
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Draggable spacer — inherits drag from parent, fills remaining space */}
        <div className="flex-1" />

        {/* Enviar — visível no modo VPS apenas quando auto-save desativado */}
        {isRemote && !autoSaveEnabled && (
          <div className="flex shrink-0 items-center border-l border-zinc-800 px-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={onEnviar}
              disabled={!tabs.some((t) => t.isDirty)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                tabs.some((t) => t.isDirty)
                  ? 'text-indigo-400 hover:bg-zinc-800 hover:text-indigo-300'
                  : 'cursor-default text-zinc-600'
              }`}
              title={tabs.some((t) => t.isDirty) ? 'Enviar alterações' : 'Nenhuma alteração pendente'}
            >
              <Send size={12} />
              Enviar
            </button>
          </div>
        )}

        {/* Settings gear — always visible on the right */}
        <div className="flex shrink-0 items-center border-l border-zinc-800 px-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={onOpenSettings}
            className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
            title="Configurações"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {tabs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-600">
          <FileText size={40} className="text-zinc-800" strokeWidth={1.5} />
          <p className="text-sm text-zinc-600">Selecione um arquivo para editar</p>
        </div>
      ) : (
        <>
          {/* Actions bar — only for file tabs */}
          {activeTab?.type === 'file' && (
            <ActionBar
              tab={activeTab}
              layoutMode={layoutMode}
              onLayoutChange={onLayoutChange}
              onSave={onSave}
              isRemote={isRemote}
            />
          )}

          {/* Editor area */}
          <div className="relative flex-1 overflow-hidden bg-zinc-950">
            {tabs.map((tab) => {
              const isVisible = tab.path === activeTabPath
              if (tab.type === 'diff') {
                const sourceTab = tabs.find((t) => t.path === tab.diffOf && t.type === 'file')
                             ?? pendingUploads.find((t) => t.path === tab.diffOf)
                return (
                  <div
                    key={tab.path}
                    className={`absolute inset-0 ${isVisible ? 'block' : 'hidden'}`}
                  >
                    {sourceTab ? (
                      <DiffView
                        fileName={tab.name}
                        filePath={tab.diffOf!}
                        modified={sourceTab.content}
                        original={sourceTab.originalContent}
                        isUploading={sourceTab.isUploading}
                        onEnviarFile={onEnviarFile}
                        onContentChange={(newContent) => onDiffRevert(tab.diffOf!, newContent)}
                        onOriginalChange={(newOriginal) => onDiffAccept(tab.diffOf!, newOriginal)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                        Arquivo não encontrado
                      </div>
                    )}
                  </div>
                )
              }
              return (
                <div
                  key={tab.path}
                  className={`absolute inset-0 ${isVisible ? 'block' : 'hidden'}`}
                >
                  <EditorPane
                    key={`${tab.path}-${tab.contentVersion ?? 0}`}
                    tab={tab}
                    onSave={onSave}
                    onContentChange={onContentChange}
                    onNormalized={onNormalized}
                    layout={layoutMode}
                    editorPrefs={editorPrefs}
                    isRemote={isRemote}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
