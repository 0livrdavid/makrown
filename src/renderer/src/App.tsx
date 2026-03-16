import { useEffect, useState, useCallback, useRef } from 'react'
import { FolderOpen, Server, X } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { Editor, type OpenTab, type LayoutMode, type EditorPrefs } from './components/Editor'
import { FileSearchModal } from './components/FileSearchModal'
import { ContentSearchPanel } from './components/ContentSearchPanel'
import { SSHConnectionModal } from './components/SSHConnectionModal'
import { ShortcutsModal } from './components/ShortcutsModal'
import { SettingsModal, type VpsPrefs } from './components/SettingsModal'
import { EnviarModal } from './components/EnviarModal'
import { ToastContainer } from './components/Toast'
import { ToastContext } from './contexts/ToastContext'
import { useToast } from './hooks/useToast'
import type { TreeNode } from './hooks/useFileTree'
import type { SSHConfig } from '../../../shared/types'

const DRAFT_PREFIX = 'makrown:draft:'

function saveDraft(path: string, content: string): void {
  localStorage.setItem(DRAFT_PREFIX + path, content)
}

function loadDraft(path: string): string | null {
  return localStorage.getItem(DRAFT_PREFIX + path)
}

function clearDraft(path: string): void {
  localStorage.removeItem(DRAFT_PREFIX + path)
}

// Persists closed-but-not-uploaded tabs across app restarts (VPS mode only)
const PENDING_UPLOADS_KEY = 'makrown:pending-uploads'

type PersistedUpload = { path: string; name: string; content: string; originalContent: string }

function savePendingUploads(uploads: import('./components/Editor').OpenTab[]): void {
  const data: PersistedUpload[] = uploads.map(({ path, name, content, originalContent }) => ({
    path, name, content, originalContent,
  }))
  localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(data))
}

function loadPendingUploads(): import('./components/Editor').OpenTab[] {
  try {
    const raw = localStorage.getItem(PENDING_UPLOADS_KEY)
    if (!raw) return []
    const items: PersistedUpload[] = JSON.parse(raw)
    return items.map(({ path, name, content, originalContent }) => ({
      path, name, content, originalContent,
      type: 'file' as const,
      isDirty: true,
      isNormalized: true,
      isUploading: false,
    }))
  } catch {
    return []
  }
}

function clearPendingUploads(): void {
  localStorage.removeItem(PENDING_UPLOADS_KEY)
}

const RECENT_FOLDERS_KEY = 'recentFolders'
const MAX_RECENT = 8
const RECENT_VPS_KEY = 'makrown:recentVPS'
const MAX_RECENT_VPS = 5
const EDITOR_PREFS_KEY = 'makrown:editor-prefs'
const DEFAULT_EDITOR_PREFS: EditorPrefs = { fontFamily: 'sans', fontSize: 15 }

const UI_ZOOM_KEY = 'makrown:ui-zoom'
const UI_ZOOM_MIN = 0.7
const UI_ZOOM_MAX = 1.5
const UI_ZOOM_STEP = 0.1

function loadUiZoom(): number {
  try {
    const raw = localStorage.getItem(UI_ZOOM_KEY)
    const val = raw ? parseFloat(raw) : 1.0
    return isNaN(val) ? 1.0 : Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, val))
  } catch {
    return 1.0
  }
}

const VPS_PREFS_KEY = 'makrown:vps-prefs'

const DEFAULT_VPS_PREFS: VpsPrefs = { autoSaveEnabled: true, autoSaveDelay: 20 }

function loadVpsPrefs(): VpsPrefs {
  try {
    const raw = localStorage.getItem(VPS_PREFS_KEY)
    return raw ? { ...DEFAULT_VPS_PREFS, ...JSON.parse(raw) } : DEFAULT_VPS_PREFS
  } catch {
    return DEFAULT_VPS_PREFS
  }
}

function loadEditorPrefs(): EditorPrefs {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY)
    return raw ? { ...DEFAULT_EDITOR_PREFS, ...JSON.parse(raw) } : DEFAULT_EDITOR_PREFS
  } catch {
    return DEFAULT_EDITOR_PREFS
  }
}

function loadRecentFolders(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_FOLDERS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveRecentFolders(folders: string[]): void {
  localStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(folders))
}

function addToRecent(folders: string[], path: string): string[] {
  const next = [path, ...folders.filter((f) => f !== path)].slice(0, MAX_RECENT)
  saveRecentFolders(next)
  return next
}

function loadRecentVPS(): SSHConfig[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_VPS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function addToRecentVPS(configs: SSHConfig[], config: SSHConfig): SSHConfig[] {
  const key = (c: SSHConfig): string => `${c.host}:${c.port}:${c.username}`
  const next = [config, ...configs.filter((c) => key(c) !== key(config))].slice(0, MAX_RECENT_VPS)
  localStorage.setItem(RECENT_VPS_KEY, JSON.stringify(next))
  return next
}

function vpsBaseName(config: SSHConfig): string {
  return config.label || config.host
}

function folderBaseName(path: string): string {
  return path.split('/').pop() ?? path
}

function App(): React.JSX.Element {
  const [folder, setFolder] = useState<string | null>(null)
  const [recentFolders, setRecentFolders] = useState<string[]>(loadRecentFolders)
  const [loading, setLoading] = useState(true)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('editor')
  const [showFileSearch, setShowFileSearch] = useState(false)
  const [showContentSearch, setShowContentSearch] = useState(false)
  const [showSSHModal, setShowSSHModal] = useState(false)
  const [isRemote, setIsRemote] = useState(false)
  const [recentVPS, setRecentVPS] = useState<SSHConfig[]>(loadRecentVPS)
  const [activeSSHConfig, setActiveSSHConfig] = useState<SSHConfig | null>(null)
  const [pendingSSHConfig, setPendingSSHConfig] = useState<SSHConfig | null>(null)
  const [connectionKey, setConnectionKey] = useState(0)
  const [editorPrefs, setEditorPrefs] = useState<EditorPrefs>(loadEditorPrefs)
  const [uiZoom, setUiZoom] = useState<number>(loadUiZoom)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [vpsPrefs, setVpsPrefs] = useState<VpsPrefs>(loadVpsPrefs)
  const [pendingUploads, setPendingUploads] = useState<OpenTab[]>(loadPendingUploads)

  // Refs to avoid stale closures in auto-save timers
  const tabsRef = useRef<OpenTab[]>([])
  const vpsPrefsRef = useRef<VpsPrefs>(vpsPrefs)
  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [showEnviarModal, setShowEnviarModal] = useState(false)
  const [sshStatus, setSshStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const sshStatusRef = useRef<'connected' | 'reconnecting' | 'disconnected'>('disconnected')

  const { toasts, addToast, removeToast } = useToast()

  // Keep refs in sync for use inside setTimeout callbacks
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { vpsPrefsRef.current = vpsPrefs }, [vpsPrefs])
  useEffect(() => { sshStatusRef.current = sshStatus }, [sshStatus])

  // Sync pendingUploads → localStorage whenever the list changes
  useEffect(() => {
    if (isRemote) {
      savePendingUploads(pendingUploads)
    }
  }, [pendingUploads, isRemote])

  // Apply persisted zoom on mount and whenever it changes
  useEffect(() => {
    window.api.zoom.setFactor(uiZoom)
    localStorage.setItem(UI_ZOOM_KEY, String(uiZoom))
  }, [uiZoom])

  // Cmd+= / Cmd+- zoom shortcuts
  useEffect(() => {
    function handleZoomKey(e: KeyboardEvent): void {
      const mod = window.api.platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (!mod) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setUiZoom((z) => parseFloat(Math.min(UI_ZOOM_MAX, z + UI_ZOOM_STEP).toFixed(2)))
      } else if (e.key === '-') {
        e.preventDefault()
        setUiZoom((z) => parseFloat(Math.max(UI_ZOOM_MIN, z - UI_ZOOM_STEP).toFixed(2)))
      } else if (e.key === '0') {
        e.preventDefault()
        setUiZoom(1.0)
      }
    }
    window.addEventListener('keydown', handleZoomKey)
    return () => window.removeEventListener('keydown', handleZoomKey)
  }, [])

  const cancelAutoSave = useCallback((path: string) => {
    const t = autoSaveTimers.current.get(path)
    if (t) { clearTimeout(t); autoSaveTimers.current.delete(path) }
  }, [])

  const cancelAllAutoSave = useCallback(() => {
    autoSaveTimers.current.forEach(clearTimeout)
    autoSaveTimers.current.clear()
  }, [])

  useEffect(() => {
    window.api.prefs.get<string | null>('lastOpenedFolder').then(() => {
      setLoading(false)
    })
  }, [])

  function openFolder(path: string): void {
    if (isRemote) {
      window.api.ssh.disconnect()
      setIsRemote(false)
      setActiveSSHConfig(null)
    }
    clearPendingUploads()
    setFolder(path)
    setTabs([])
    setPendingUploads([])
    setActiveTabPath(null)
    setRecentFolders((prev) => addToRecent(prev, path))
    window.api.prefs.set('lastOpenedFolder', path)
  }

  async function handleSelectFolder(): Promise<void> {
    const result = await window.api.fs.selectFolder()
    if (result.ok && result.data) {
      openFolder(result.data)
    }
  }

  // Connection is already established by SSHConnectionModal before this is called
  function handleSSHConnect(config: SSHConfig, remotePath: string): void {
    const fullConfig = { ...config, remotePath }
    setIsRemote(true)
    setShowSSHModal(false)
    setPendingSSHConfig(null)
    setActiveSSHConfig(fullConfig)
    setRecentVPS((prev) => addToRecentVPS(prev, fullConfig))
    setFolder(remotePath)
    setConnectionKey((k) => k + 1)  // força o Sidebar a recarregar mesmo se o path for igual
    setTabs([])
    // Don't reset pendingUploads here — persisted drafts from last session are preserved
    // across reconnects to the same VPS. clearPendingUploads() is called on explicit disconnect.
    setActiveTabPath(null)
    addToast(`Conectado a ${vpsBaseName(config)}`, 'success')
  }

  function handleDisconnect(): void {
    cancelAllAutoSave()
    window.api.ssh.disconnect()
    clearPendingUploads()
    setIsRemote(false)
    setActiveSSHConfig(null)
    setFolder(null)
    setTabs([])
    setPendingUploads([])
    setActiveTabPath(null)
    addToast('Desconectado', 'info')
  }

  function handleExitFolder(): void {
    setFolder(null)
    setTabs([])
    setActiveTabPath(null)
  }

  // Conecta direto sem abrir modal (usado ao clicar em VPS recente)
  async function handleDirectConnectVPS(config: SSHConfig): Promise<void> {
    const result = await window.api.ssh.connect(config)
    if (!result.ok) {
      addToast(result.error ?? 'Erro ao conectar', 'error')
      return
    }
    // handleSSHConnect já incrementa connectionKey, forçando reload do Sidebar
    handleSSHConnect(config, config.remotePath)
  }

  // Abre modal pré-preenchido para editar antes de conectar
  function handleEditVPS(config: SSHConfig): void {
    setPendingSSHConfig(config)
    setShowSSHModal(true)
  }

  function removeRecentFolder(path: string): void {
    setRecentFolders((prev) => {
      const next = prev.filter((f) => f !== path)
      saveRecentFolders(next)
      return next
    })
  }

  function removeRecentVPS(config: SSHConfig): void {
    setRecentVPS((prev) => {
      const key = (c: SSHConfig): string => `${c.host}:${c.port}:${c.username}`
      const next = prev.filter((c) => key(c) !== key(config))
      localStorage.setItem(RECENT_VPS_KEY, JSON.stringify(next))
      return next
    })
  }

  function handleSSHModalClose(): void {
    setPendingSSHConfig(null)
    setShowSSHModal(false)
  }

  function handleEditorPrefsChange(prefs: EditorPrefs): void {
    setEditorPrefs(prefs)
    localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs))
  }

  const handleSelectFile = useCallback(async (node: TreeNode) => {
    if (node.type !== 'file') return

    const existing = tabs.find((t) => t.path === node.path)
    if (existing) {
      setActiveTabPath(node.path)
      return
    }

    // File was closed while dirty (pendingUpload) → restore the dirty tab
    const pending = pendingUploads.find((t) => t.path === node.path)
    if (pending) {
      setPendingUploads((prev) => prev.filter((t) => t.path !== node.path))
      setTabs((prev) => [...prev, pending])
      setActiveTabPath(node.path)
      return
    }

    const result = await window.api.fs.readFile(node.path)
    if (!result.ok) {
      addToast(`Erro ao abrir ${node.name}`, 'error')
      return
    }

    const diskContent = result.data ?? ''
    const draft = loadDraft(node.path)
    const hasDraft = draft !== null && draft !== diskContent

    const newTab: OpenTab = {
      path: node.path,
      name: node.name,
      type: 'file',
      content: hasDraft ? draft : diskContent,
      originalContent: diskContent,
      isDirty: hasDraft,
      isNormalized: false,
      isUploading: false
    }

    setTabs((prev) => [...prev, newTab])
    setActiveTabPath(node.path)
  }, [tabs, pendingUploads, addToast])

  const handleTabClose = useCallback((path: string) => {
    setTabs((prev) => {
      const tab = prev.find((t) => t.path === path)
      if (tab?.isDirty && tab.type === 'file') {
        if (isRemote) {
          // Keep as pending upload and save draft so content survives app restarts
          saveDraft(path, tab.content)
          setPendingUploads((pu) => {
            const without = pu.filter((t) => t.path !== path)
            return [...without, tab]
          })
        } else {
          saveDraft(path, tab.content)
        }
      }
      const idx = prev.findIndex((t) => t.path === path)
      const next = prev.filter((t) => t.path !== path)
      if (activeTabPath === path) {
        const nextTab = next[idx] ?? next[idx - 1] ?? null
        setActiveTabPath(nextTab?.path ?? null)
      }
      return next
    })
  }, [activeTabPath, isRemote])

  const handleNormalized = useCallback((path: string, normalizedContent: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.path !== path) return t
        // Tab was already normalized (e.g. restored from pendingUploads) — skip to avoid
        // overwriting originalContent with the edited content on re-mount.
        if (t.isNormalized) return t
        // If the tab was opened with a draft, preserve it — only update originalContent baseline.
        if (t.isDirty) return { ...t, isNormalized: true, originalContent: normalizedContent }
        return { ...t, isNormalized: true, originalContent: normalizedContent, content: normalizedContent, isDirty: false }
      })
    )
  }, [])

  // scheduleAutoSave uses refs to read latest state inside the timer callback
  const scheduleAutoSave = useCallback((path: string) => {
    cancelAutoSave(path)
    const delay = vpsPrefsRef.current.autoSaveDelay * 1000
    const timer = setTimeout(async () => {
      autoSaveTimers.current.delete(path)
      const tab = tabsRef.current.find((t) => t.path === path)
      if (!tab?.isDirty || tab.isUploading) return
      if (sshStatusRef.current === 'reconnecting') return
      // Trigger upload via state — set isUploading then write
      setTabs((prev) => prev.map((t) => t.path === path ? { ...t, isUploading: true } : t))
      const result = await window.api.fs.writeFile(path, tab.content)
      if (result.ok) {
        clearDraft(path)
        setTabs((prev) => prev.map((t) => t.path === path
          ? { ...t, isDirty: false, isUploading: false, originalContent: tab.content }
          : t
        ))
      } else {
        setTabs((prev) => prev.map((t) => t.path === path ? { ...t, isUploading: false } : t))
        addToast(`Erro ao enviar ${tab.name}`, 'error')
      }
    }, delay)
    autoSaveTimers.current.set(path, timer)
  }, [cancelAutoSave, addToast])

  const handleContentChange = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.path !== path) return t
        // Before normalization completes, Milkdown may emit events as part of its
        // init process. Don't mark dirty yet — originalContent may still be the raw
        // disk content and the "change" is just Milkdown normalizing (e.g. line endings).
        if (!t.isNormalized) return { ...t, content }
        const isDirty = content !== t.originalContent
        // Schedule or cancel auto-save based on dirty state
        if (isRemote && vpsPrefsRef.current.autoSaveEnabled) {
          if (isDirty && !t.isUploading) scheduleAutoSave(path)
          else if (!isDirty) cancelAutoSave(path)
        }
        // Persist draft locally so edits survive app restarts (both local and VPS modes)
        if (isDirty) saveDraft(path, content)
        else clearDraft(path)
        return { ...t, content, isDirty }
      })
    )
  }, [isRemote, scheduleAutoSave, cancelAutoSave])

  const handleSave = useCallback(async (path: string, content: string) => {
    if (isRemote && sshStatusRef.current === 'reconnecting') {
      addToast('Reconectando ao servidor... aguarde para salvar.', 'error')
      return
    }
    if (isRemote) {
      cancelAutoSave(path)
      setTabs((prev) => prev.map((t) => t.path === path ? { ...t, isUploading: true } : t))
    }
    const result = await window.api.fs.writeFile(path, content)
    if (result.ok) {
      clearDraft(path)
      setTabs((prev) => prev.map((t) => t.path === path
        ? { ...t, isDirty: false, isUploading: false, originalContent: content }
        : t
      ))
      if (!isRemote) addToast('Arquivo salvo', 'success')
    } else {
      setTabs((prev) => prev.map((t) => t.path === path ? { ...t, isUploading: false } : t))
      addToast('Erro ao salvar arquivo', 'error')
    }
  }, [isRemote, cancelAutoSave, addToast])

  const handleEnviar = useCallback(async (paths: string[]) => {
    const allTabs = [...tabs, ...pendingUploads]
    const results = await Promise.all(
      paths.map(async (path) => {
        const tab = allTabs.find((t) => t.path === path)
        if (!tab) return { path, ok: false }
        const result = await window.api.fs.writeFile(path, tab.content)
        return { path, ok: result.ok }
      })
    )
    const failed = results.filter((r) => !r.ok)
    const succeeded = results.filter((r) => r.ok).map((r) => r.path)
    setTabs((prev) =>
      prev.map((t) => {
        if (!succeeded.includes(t.path)) return t
        clearDraft(t.path)
        return { ...t, isDirty: false, originalContent: t.content }
      })
    )
    setPendingUploads((prev) => prev.filter((t) => !succeeded.includes(t.path)))
    if (failed.length === 0) {
      const n = paths.length
      addToast(`${n} arquivo${n > 1 ? 's' : ''} enviado${n > 1 ? 's' : ''}`, 'success')
      setShowEnviarModal(false)
    } else {
      addToast(`${failed.length} arquivo(s) falharam ao enviar`, 'error')
    }
  }, [tabs, pendingUploads, addToast])

  const handleOpenDiff = useCallback((filePath: string) => {
    // Look in open tabs first, then in pendingUploads (closed dirty files)
    const fileTab = tabs.find((t) => t.path === filePath && t.type === 'file')
                 ?? pendingUploads.find((t) => t.path === filePath)
    if (!fileTab) return

    const diffPath = `diff://${filePath}`
    const existingDiff = tabs.find((t) => t.path === diffPath)
    if (existingDiff) {
      setActiveTabPath(diffPath)
      return
    }

    const diffTab: OpenTab = {
      path: diffPath,
      name: fileTab.name,
      type: 'diff',
      diffOf: filePath,
      content: '',
      originalContent: '',
      isDirty: false,
      isNormalized: true,
      isUploading: false,
    }

    // Only add the diff tab — DiffView reads content from pendingUploads directly
    setTabs((prev) => [...prev, diffTab])
    setActiveTabPath(diffPath)
  }, [tabs, pendingUploads])

  const handleOpenFile = useCallback((filePath: string) => {
    // If file was closed while dirty, restore it from pendingUploads
    const pending = pendingUploads.find((t) => t.path === filePath)
    if (pending) {
      setPendingUploads((prev) => prev.filter((t) => t.path !== filePath))
      setTabs((prev) => [...prev, pending])
    }
    setActiveTabPath(filePath)
  }, [pendingUploads])

  const handleEnviarFile = useCallback(async (path: string) => {
    const tab = tabsRef.current.find((t) => t.path === path)
    if (!tab) return
    await handleSave(path, tab.content)
  }, [handleSave])

  // SSH status subscription — active only while connected remotely
  useEffect(() => {
    if (!isRemote) return
    setSshStatus('connected')
    const unsubscribe = window.api.ssh.onStatusChange(({ status }) => {
      setSshStatus(status)
      if (status === 'disconnected') {
        // Retries exhausted — revert to local automatically
        cancelAllAutoSave()
        clearPendingUploads()
        setIsRemote(false)
        setActiveSSHConfig(null)
        setFolder(null)
        setTabs([])
        setPendingUploads([])
        setActiveTabPath(null)
        addToast('Conexão SSH perdida após 3 tentativas. Revertendo para local.', 'error')
      }
    })
    return unsubscribe
  }, [isRemote, connectionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts (Cmd+P / Cmd+Shift+F kept here; Cmd+S delegated to Editor)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const mod = window.api.platform === 'darwin' ? e.metaKey : e.ctrlKey
      if (!mod) return
      if (e.key === '/' ) { e.preventDefault(); setShowShortcutsModal(true) }
      if (!folder) return
      if (e.key === 'p' && !e.shiftKey) { e.preventDefault(); setShowFileSearch(true) }
      else if (e.key === 'F' && e.shiftKey) { e.preventDefault(); setShowContentSearch(true) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [folder])

  // Native menu action handler
  useEffect(() => {
    const unsubscribe = window.api.menu.onAction((action) => {
      if (action === 'openFolder') handleSelectFolder()
      else if (action === 'save') {
        // Dispatch a synthetic Cmd+S so the active Editor pane handles it
        window.dispatchEvent(new KeyboardEvent('keydown', {
          key: 's', metaKey: window.api.platform === 'darwin', ctrlKey: window.api.platform !== 'darwin', bubbles: true
        }))
      }
      else if (action === 'layout:preview') setLayoutMode('editor')
      else if (action === 'layout:visualize') setLayoutMode('visualize')
      else if (action === 'search:files') setShowFileSearch(true)
      else if (action === 'search:content') setShowContentSearch(true)
      else if (action === 'shortcuts') setShowShortcutsModal(true)
      else if (action === 'openSettings') setShowSettingsModal(true)
    })
    return unsubscribe
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
        Carregando...
      </div>
    )
  }

  if (!folder) {
    return (
      <ToastContext.Provider value={{ addToast }}>
        <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
          {/* Draggable titlebar area for welcome screen */}
          <div className="h-9 w-full shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} />
          <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800">
              <FolderOpen size={32} className="text-amber-400" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Makrown</h1>
            <p className="text-sm text-zinc-500">Abra uma pasta para começar</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleSelectFolder}
              className="w-72 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Abrir pasta
            </button>
            <button
              onClick={() => setShowSSHModal(true)}
              className="flex w-72 items-center justify-center gap-2 rounded-md border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Server size={14} />
              Conectar via VPS
            </button>
          </div>

          {(recentFolders.length > 0 || recentVPS.length > 0) && (
            <div className="flex w-72 flex-col gap-4">
              {recentFolders.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    Pastas recentes
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {recentFolders.slice(0, 5).map((path) => (
                      <div
                        key={path}
                        className="group/item flex w-full items-center rounded-md transition-colors hover:bg-zinc-800"
                      >
                        <button
                          onClick={() => openFolder(path)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                        >
                          <FolderOpen size={12} className="shrink-0 text-amber-400" />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-zinc-300">
                              {folderBaseName(path)}
                            </div>
                            <div className="truncate text-[10px] text-zinc-600">{path}</div>
                          </div>
                        </button>
                        <button
                          onClick={() => removeRecentFolder(path)}
                          className="mr-1.5 rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-zinc-700 hover:text-red-400 group-hover/item:opacity-100"
                          title="Remover da lista"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {recentVPS.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                    VPS recentes
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {recentVPS.map((cfg) => (
                      <div
                        key={`${cfg.host}:${cfg.port}:${cfg.username}`}
                        className="group/item flex w-full items-center rounded-md transition-colors hover:bg-zinc-800"
                      >
                        <button
                          onClick={() => handleDirectConnectVPS(cfg)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                        >
                          <Server size={12} className="shrink-0 text-indigo-400" />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-zinc-300">
                              {vpsBaseName(cfg)}
                            </div>
                            <div className="truncate text-[10px] text-zinc-600">
                              {cfg.username}@{cfg.host}:{cfg.port}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => removeRecentVPS(cfg)}
                          className="mr-1.5 rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-zinc-700 hover:text-red-400 group-hover/item:opacity-100"
                          title="Remover da lista"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
        {showSSHModal && (
          <SSHConnectionModal
            onConnect={handleSSHConnect}
            onClose={handleSSHModalClose}
            initialConfig={pendingSSHConfig ?? undefined}
          />
        )}
        {showShortcutsModal && (
          <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />
        )}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-zinc-950">
            <SettingsModal
              editorPrefs={editorPrefs}
              onEditorPrefsChange={handleEditorPrefsChange}
              onClose={() => setShowSettingsModal(false)}
              isRemote={isRemote}
              vpsPrefs={vpsPrefs}
              onVpsPrefsChange={(prefs) => {
                setVpsPrefs(prefs)
                localStorage.setItem(VPS_PREFS_KEY, JSON.stringify(prefs))
              }}
            />
          </div>
        )}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </ToastContext.Provider>
    )
  }

  function handleOpenFromSearch(file: { name: string; path: string }): void {
    const node: TreeNode = { name: file.name, path: file.path, type: 'file', extension: '.md' }
    handleSelectFile(node)
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        <Sidebar
          key={connectionKey}
          rootPath={folder}
          selectedPath={activeTabPath}
          onSelectFile={handleSelectFile}
          onOpenFolder={openFolder}
          onPickFolder={handleSelectFolder}
          onConnectVPS={() => setShowSSHModal(true)}
          onConnectRecentVPS={handleDirectConnectVPS}
          onEditVPS={handleEditVPS}
          onDisconnect={isRemote ? handleDisconnect : undefined}
          onExit={handleExitFolder}
          isRemote={isRemote}
          recentFolders={recentFolders}
          recentVPS={recentVPS}
          activeSSHConfig={activeSSHConfig}
          sshStatus={isRemote ? sshStatus : undefined}
          dirtyTabs={[...tabs.filter((t) => t.type === 'file' && t.isDirty), ...pendingUploads]}
          onOpenDiff={handleOpenDiff}
          onOpenFile={handleOpenFile}
        />
        <Editor
          tabs={tabs}
          pendingUploads={pendingUploads}
          activeTabPath={activeTabPath}
          layoutMode={layoutMode}
          onLayoutChange={setLayoutMode}
          onTabChange={setActiveTabPath}
          onTabClose={handleTabClose}
          onSave={handleSave}
          onContentChange={handleContentChange}
          editorPrefs={editorPrefs}
          onEditorPrefsChange={handleEditorPrefsChange}
          onOpenSettings={() => setShowSettingsModal(true)}
          onEnviar={() => setShowEnviarModal(true)}
          onEnviarFile={handleEnviarFile}
          onNormalized={handleNormalized}
          isRemote={isRemote}
          autoSaveEnabled={isRemote && vpsPrefs.autoSaveEnabled}
        />
      </div>

      {showSSHModal && (
        <SSHConnectionModal
          onConnect={handleSSHConnect}
          onClose={handleSSHModalClose}
          initialConfig={pendingSSHConfig ?? undefined}
        />
      )}
      {showFileSearch && (
        <FileSearchModal
          rootPath={folder}
          onOpen={handleOpenFromSearch}
          onClose={() => setShowFileSearch(false)}
        />
      )}
      {showContentSearch && (
        <ContentSearchPanel
          rootPath={folder}
          onOpen={handleOpenFromSearch}
          onClose={() => setShowContentSearch(false)}
        />
      )}
      {showShortcutsModal && (
        <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />
      )}
      {showEnviarModal && (
        <EnviarModal
          dirtyTabs={[...tabs.filter((t) => t.type === 'file' && t.isDirty), ...pendingUploads]}
          onCancel={() => setShowEnviarModal(false)}
          onEnviar={handleEnviar}
        />
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950">
          <SettingsModal
            editorPrefs={editorPrefs}
            onEditorPrefsChange={handleEditorPrefsChange}
            onClose={() => setShowSettingsModal(false)}
            isRemote={isRemote}
            vpsPrefs={vpsPrefs}
            onVpsPrefsChange={(prefs) => {
              setVpsPrefs(prefs)
              localStorage.setItem(VPS_PREFS_KEY, JSON.stringify(prefs))
            }}
          />
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export default App
