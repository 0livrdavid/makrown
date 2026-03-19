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
import { TerminalPanel } from './components/TerminalPanel'
import { ToastContainer } from './components/Toast'
import { UpdateToast } from './components/UpdateToast'
import { ShortcutTooltip } from './components/ShortcutTooltip'
import { ToastContext } from './contexts/ToastContext'
import { useToast } from './hooks/useToast'
import type { TreeNode } from './hooks/useFileTree'
import type { SSHConfig, SSHProfileSummary } from '../../shared/types'
import { shortcutTitle, shortcutTokens } from './utils/shortcuts'
import { describeUpdaterError, getUpdateVersion, toDownloadingState, type UpdateState } from './utils/updater'

const DRAFT_PREFIX = 'makrown:draft:'
const LARGE_FILE_BYTES = 1 * 1024 * 1024
const WELCOME_MESSAGES = [
  'Seu workspace Markdown está pronto.',
  'Abra uma pasta e continue de onde parou.',
  'Hoje parece um bom dia para organizar ideias.',
  'Entre arquivos locais e VPS, escolha seu ponto de partida.',
  'Escreva localmente. Publique com precisão.',
  'Tudo pronto para mais uma sessão.',
  'Comece por uma pasta ou conecte um servidor.',
  'Markdown, terminal e VPS no mesmo lugar.',
  'O próximo arquivo está te esperando.',
  'Menos atrito, mais fluxo.',
] as const

function saveDraft(path: string, content: string): void {
  localStorage.setItem(DRAFT_PREFIX + path, content)
}

function loadDraft(path: string): string | null {
  return localStorage.getItem(DRAFT_PREFIX + path)
}

function clearDraft(path: string): void {
  localStorage.removeItem(DRAFT_PREFIX + path)
}

/** Compare two markdown strings ignoring trailing newlines (Milkdown may add them). */
function contentEquals(a: string, b: string): boolean {
  return a.replace(/\n+$/, '') === b.replace(/\n+$/, '')
}

// Persists closed-but-not-uploaded tabs across app restarts (VPS mode only)
const PENDING_UPLOADS_KEY = 'makrown:pending-uploads'

type PersistedUpload = {
  path: string
  name: string
  content: string
  originalContent: string
  isLargeFile?: boolean
  fileSizeBytes?: number
}

function savePendingUploads(uploads: import('./components/Editor').OpenTab[]): void {
  const data: PersistedUpload[] = uploads.map(({ path, name, content, originalContent, isLargeFile, fileSizeBytes }) => ({
    path, name, content, originalContent, isLargeFile, fileSizeBytes,
  }))
  localStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(data))
}

function loadPendingUploads(): import('./components/Editor').OpenTab[] {
  try {
    const raw = localStorage.getItem(PENDING_UPLOADS_KEY)
    if (!raw) return []
    const items: PersistedUpload[] = JSON.parse(raw)
    return items
      .map(({ path, name, content, originalContent, isLargeFile, fileSizeBytes }) => ({
        path, name, content, originalContent,
        type: 'file' as const,
        isDirty: !contentEquals(content, originalContent),
        isNormalized: true,
        isUploading: false,
        isLargeFile,
        fileSizeBytes,
      }))
      .filter((t) => t.isDirty)
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
const DEFAULT_EDITOR_PREFS: EditorPrefs = { fontFamily: 'sans', fontSize: 15, rawModeEnabled: false, tabSize: 2 }

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

const LOCAL_DIFF_KEY = 'makrown:local-diff-enabled'

function loadLocalDiffEnabled(): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_DIFF_KEY)
    return raw === null ? true : raw === 'true'
  } catch {
    return true
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

function loadRecentVPSIds(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_VPS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
  } catch {
    return []
  }
}

function saveRecentVPSIds(ids: string[]): void {
  const uniqueIds = ids.filter((id, index) => id && ids.indexOf(id) === index).slice(0, MAX_RECENT_VPS)
  localStorage.setItem(RECENT_VPS_KEY, JSON.stringify(uniqueIds))
}

function isSSHConfigLike(value: unknown): value is SSHConfig {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SSHConfig>
  return typeof candidate.host === 'string'
    && typeof candidate.port === 'number'
    && typeof candidate.username === 'string'
    && (candidate.authMethod === 'password' || candidate.authMethod === 'key')
    && typeof candidate.remotePath === 'string'
}

// Persists open tabs per project so they survive app restarts and folder switches
const OPEN_TABS_PREFIX = 'makrown:open-tabs:'

type PersistedTab = { path: string; type: 'file' | 'diff'; diffOf?: string }
type PersistedTabState = { tabs: PersistedTab[]; activeTabPath: string | null }

function saveOpenTabs(folder: string, tabs: OpenTab[], activeTabPath: string | null): void {
  const data: PersistedTabState = {
    tabs: tabs.map(({ path, type, diffOf }) => ({ path, type, ...(diffOf ? { diffOf } : {}) })),
    activeTabPath,
  }
  localStorage.setItem(OPEN_TABS_PREFIX + folder, JSON.stringify(data))
}

function loadSavedTabs(folder: string): PersistedTabState | null {
  try {
    const raw = localStorage.getItem(OPEN_TABS_PREFIX + folder)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Persists the last active session so the app can auto-restore on startup
const LAST_SESSION_KEY = 'makrown:last-session'

type LastSession =
  | { type: 'local'; folder: string }
  | { type: 'vps'; profileId: string }

function saveLastSession(session: LastSession | null): void {
  if (session) localStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session))
  else localStorage.removeItem(LAST_SESSION_KEY)
}

function loadLastSession(): LastSession | null {
  try {
    const raw = localStorage.getItem(LAST_SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function vpsBaseName(profile: SSHProfileSummary | SSHConfig): string {
  return profile.label || profile.host
}

function folderBaseName(path: string): string {
  return path.split('/').pop() ?? path
}

function getDailyWelcomeMessage(): string {
  const today = new Date()
  const key = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return WELCOME_MESSAGES[hash % WELCOME_MESSAGES.length]
}

function getUpdateToastKey(state: UpdateState): string | null {
  if (state.kind === 'available' || state.kind === 'downloading' || state.kind === 'downloaded') {
    return `${state.kind}:${state.version}`
  }
  if (state.kind === 'error') {
    return `error:${state.message}`
  }
  return null
}

function AppBrandIcon(): React.JSX.Element {
  return (
    <svg width="64" height="64" viewBox="0 0 1024 1024" fill="none" aria-hidden="true">
      <rect width="1024" height="1024" rx="224" fill="#09090B" />
      <rect x="56" y="56" width="912" height="912" rx="184" fill="#0F0F13" stroke="#27272A" strokeWidth="12" />
      <path d="M276 768V256H375L512 518L649 256H748V768H656V414L552 616H472L368 414V768H276Z" fill="#FACC15" />
    </svg>
  )
}

function App(): React.JSX.Element {
  const { mod } = shortcutTokens
  const welcomeMessage = getDailyWelcomeMessage()
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
  const [recentVPS, setRecentVPS] = useState<SSHProfileSummary[]>([])
  const [activeSSHConfig, setActiveSSHConfig] = useState<SSHProfileSummary | null>(null)
  const [pendingSSHConfig, setPendingSSHConfig] = useState<SSHConfig | null>(null)
  const [connectionKey, setConnectionKey] = useState(0)
  const [editorPrefs, setEditorPrefs] = useState<EditorPrefs>(loadEditorPrefs)
  const [uiZoom, setUiZoom] = useState<number>(loadUiZoom)
  const [showShortcutsModal, setShowShortcutsModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [vpsPrefs, setVpsPrefs] = useState<VpsPrefs>(loadVpsPrefs)
  const [localDiffEnabled, setLocalDiffEnabled] = useState(loadLocalDiffEnabled)
  const [pendingUploads, setPendingUploads] = useState<OpenTab[]>(loadPendingUploads)

  // Refs to avoid stale closures in auto-save timers
  const tabsRef = useRef<OpenTab[]>([])
  const pendingUploadsRef = useRef<OpenTab[]>([])
  const vpsPrefsRef = useRef<VpsPrefs>(vpsPrefs)
  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [showEnviarModal, setShowEnviarModal] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('makrown:terminal-height')
    return saved ? Number(saved) : 280
  })

  function handleTerminalHeightChange(h: number): void {
    setTerminalHeight(h)
    localStorage.setItem('makrown:terminal-height', String(h))
  }
  const [sshStatus, setSshStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const sshStatusRef = useRef<'connected' | 'reconnecting' | 'disconnected'>('disconnected')

  const { toasts, addToast, removeToast } = useToast()
  const [updateState, setUpdateState] = useState<UpdateState>({ kind: 'idle' })
  const [dismissedUpdateToastKey, setDismissedUpdateToastKey] = useState<string | null>(null)
  const updaterIntentRef = useRef<'auto' | 'manual'>('auto')
  const updateToastKey = getUpdateToastKey(updateState)

  const handleCheckForUpdates = useCallback((): void => {
    updaterIntentRef.current = 'manual'
    void window.api.updater.check()
  }, [])

  const handleDownloadUpdate = useCallback((): void => {
    void window.api.updater.download()
  }, [])

  const handleInstallUpdate = useCallback((): void => {
    void window.api.updater.install()
  }, [])

  const handleDismissUpdateToast = useCallback((): void => {
    if (updateToastKey) setDismissedUpdateToastKey(updateToastKey)
  }, [updateToastKey])

  const handleOpenUpdateSettings = useCallback((): void => {
    if (updateToastKey) setDismissedUpdateToastKey(updateToastKey)
    setShowSettingsModal(true)
  }, [updateToastKey])

  // Keep refs in sync for use inside setTimeout callbacks
  useEffect(() => { tabsRef.current = tabs }, [tabs])
  useEffect(() => { pendingUploadsRef.current = pendingUploads }, [pendingUploads])
  useEffect(() => { vpsPrefsRef.current = vpsPrefs }, [vpsPrefs])
  useEffect(() => { sshStatusRef.current = sshStatus }, [sshStatus])

  useEffect(() => {
    const unsubs = [
      window.api.updater.onChecking(() => {
        setUpdateState({ kind: 'checking' })
      }),
      window.api.updater.onAvailable((info) => {
        setUpdateState({ kind: 'available', version: info.version, releaseNotes: info.releaseNotes })
      }),
      window.api.updater.onNotAvailable(() => {
        setUpdateState({ kind: 'up-to-date' })
        if (updaterIntentRef.current === 'manual') {
          addToast('Você já está na versão mais recente.', 'success')
        }
        updaterIntentRef.current = 'auto'
      }),
      window.api.updater.onProgress((progress) => {
        setUpdateState((prev) => toDownloadingState(getUpdateVersion(prev) ?? 'nova versão', progress))
      }),
      window.api.updater.onDownloaded(() => {
        setUpdateState((prev) => ({ kind: 'downloaded', version: getUpdateVersion(prev) ?? 'nova versão' }))
      }),
      window.api.updater.onError((error) => {
        const next = describeUpdaterError(error.message)
        setUpdateState({ kind: 'error', ...next })
        updaterIntentRef.current = 'auto'
      }),
    ]

    return () => unsubs.forEach((unsubscribe) => unsubscribe())
  }, [addToast])

  // Sync pendingUploads → localStorage whenever the list changes
  useEffect(() => {
    if (isRemote) {
      savePendingUploads(pendingUploads)
    }
  }, [pendingUploads, isRemote])

  // Persist open tabs per project whenever tabs or activeTabPath change
  useEffect(() => {
    if (folder) saveOpenTabs(folder, tabs, activeTabPath)
  }, [folder, tabs, activeTabPath])

  // Re-read open files when they change on disk (external editor, git pull, etc.)
  useEffect(() => {
    if (isRemote) return // only for local mode — VPS files are fetched on demand
    const unsubscribe = window.api.fs.onFileChanged(async (changedPath: string) => {
      const openTab = tabsRef.current.find((t) => t.type === 'file' && t.path === changedPath)
      if (!openTab) return
      const [statResult, result] = await Promise.all([
        window.api.fs.stat(changedPath),
        window.api.fs.readFile(changedPath),
      ])
      if (!result.ok) return
      const diskContent = result.data ?? ''
      const fileSizeBytes = statResult.ok && statResult.data ? statResult.data.size : new TextEncoder().encode(diskContent).length
      const isLargeFile = fileSizeBytes > LARGE_FILE_BYTES
      // If disk content matches what we already have as original, nothing changed for us
      if (contentEquals(diskContent, openTab.originalContent)) return
      if (isLargeFile && !openTab.isLargeFile) {
        addToast(`"${openTab.name}" foi recarregado em modo seguro após edição externa.`, 'info', { durationMs: 5000 })
      }
      setTabs((prev) =>
        prev.map((t) => {
          if (t.path !== changedPath || t.type !== 'file') return t
          // If the user has no local edits, update silently
          if (!t.isDirty) {
            clearDraft(changedPath)
            return {
              ...t,
              content: diskContent,
              originalContent: diskContent,
              isDirty: false,
              isNormalized: false,
              contentVersion: (t.contentVersion ?? 0) + 1,
              isLargeFile,
              fileSizeBytes,
            }
          }
          // If user has edits, update originalContent (for diff) but keep their content
          return { ...t, originalContent: diskContent, isLargeFile, fileSizeBytes }
        })
      )
    })
    return unsubscribe
  }, [isRemote, addToast])

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
    let cancelled = false

    async function migrateLegacyRecentVPS(): Promise<void> {
      const raw = localStorage.getItem(RECENT_VPS_KEY)
      if (!raw) return

      let parsed: unknown
      try {
        parsed = JSON.parse(raw)
      } catch {
        localStorage.removeItem(RECENT_VPS_KEY)
        return
      }

      if (!Array.isArray(parsed)) {
        localStorage.removeItem(RECENT_VPS_KEY)
        return
      }

      if (parsed.every((item) => typeof item === 'string')) {
        const migratedIds: string[] = []
        for (const id of parsed) {
          const profile = await window.api.credentials.get(id)
          if (!profile?.id) continue
          migratedIds.push(profile.id)
        }

        if (migratedIds.length > 0) saveRecentVPSIds(migratedIds)
        else localStorage.removeItem(RECENT_VPS_KEY)
        return
      }

      const legacyProfiles = parsed.filter(isSSHConfigLike)
      if (legacyProfiles.length === 0) {
        localStorage.removeItem(RECENT_VPS_KEY)
        return
      }

      const migratedIds: string[] = []
      for (const legacyProfile of legacyProfiles) {
        const { id } = await window.api.credentials.set(legacyProfile)
        migratedIds.push(id)
      }

      if (migratedIds.length > 0) saveRecentVPSIds(migratedIds)
      else localStorage.removeItem(RECENT_VPS_KEY)
    }

    async function syncRecentVPS(): Promise<void> {
      const ids = loadRecentVPSIds()
      if (ids.length === 0) {
        if (!cancelled) setRecentVPS([])
        return
      }

      const allProfiles = await window.api.credentials.list()
      const profileMap = new Map(allProfiles.map((profile) => [profile.id, profile]))
      const ordered = ids.map((id) => profileMap.get(id)).filter(Boolean) as SSHProfileSummary[]

      if (ordered.length !== ids.length) {
        if (ordered.length > 0) saveRecentVPSIds(ordered.map((profile) => profile.id))
        else localStorage.removeItem(RECENT_VPS_KEY)
      }

      if (!cancelled) setRecentVPS(ordered)
    }

    async function migrateLegacyLastSession(): Promise<LastSession | null> {
      const session = loadLastSession()
      if (!session || session.type !== 'vps') return session

      const profile = await window.api.credentials.get(session.profileId)
      if (!profile?.id) {
        saveLastSession(null)
        return null
      }

      if (profile.id !== session.profileId) {
        const migratedSession: LastSession = { type: 'vps', profileId: profile.id }
        saveLastSession(migratedSession)
        return migratedSession
      }

      return session
    }

    async function restoreLastSession(): Promise<void> {
      const session = await migrateLegacyLastSession()
      if (!session) return

      if (session.type === 'local') {
        setFolder(session.folder)
        setRecentFolders((prev) => addToRecent(prev, session.folder))
        await restoreTabs(session.folder)
        return
      }

      const config = await window.api.credentials.get(session.profileId)
      if (!config) {
        saveLastSession(null)
        return
      }

      const result = await window.api.ssh.connect(config)
      if (result.ok) {
        await handleSSHConnect(config, config.remotePath)
      } else {
        saveLastSession(null)
      }
    }

    async function initialiseSecureProfiles(): Promise<void> {
      try {
        await migrateLegacyRecentVPS()
        await syncRecentVPS()
        await restoreLastSession()
      } catch {
        if (!cancelled) setRecentVPS([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void initialiseSecureProfiles()

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function restoreTabs(folderPath: string): Promise<void> {
    const saved = loadSavedTabs(folderPath)
    if (!saved || saved.tabs.length === 0) return

    const fileTabs = saved.tabs.filter((t) => t.type === 'file')
    const diffTabs = saved.tabs.filter((t) => t.type === 'diff')

    const opened: OpenTab[] = []
    for (const entry of fileTabs) {
      const restoredTab = await buildFileTab(entry.path, entry.path.split('/').pop() ?? entry.path)
      if (!restoredTab) continue // file no longer exists — skip silently
      opened.push(restoredTab)
    }

    // Restore diff tabs whose source file was successfully opened
    const openedPaths = new Set(opened.map((t) => t.path))
    for (const entry of diffTabs) {
      if (!entry.diffOf || !openedPaths.has(entry.diffOf)) continue
      opened.push({
        path: entry.path,
        name: entry.path.replace(/^diff:/, '').split('/').pop() ?? entry.path,
        type: 'diff',
        content: '',
        originalContent: '',
        isDirty: false,
        isNormalized: true,
        isUploading: false,
        diffOf: entry.diffOf,
      })
    }

    if (opened.length === 0) return
    const activeTab = saved.activeTabPath && opened.some((t) => t.path === saved.activeTabPath)
      ? saved.activeTabPath
      : opened[0].path
    setTabs(opened)
    setActiveTabPath(activeTab)
  }

  async function openFolder(path: string): Promise<void> {
    await window.api.fs.clearDeleteUndo()
    if (isRemote) {
      await window.api.ssh.disconnect()
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
    saveLastSession({ type: 'local', folder: path })
    void restoreTabs(path)
  }

  async function handleSelectFolder(): Promise<void> {
    const result = await window.api.fs.selectFolder()
    if (result.ok && result.data) {
      await openFolder(result.data)
    }
  }

  // Connection is already established by SSHConnectionModal before this is called
  async function handleSSHConnect(config: SSHConfig, remotePath: string): Promise<void> {
    await window.api.fs.clearDeleteUndo()
    const fullConfig = { ...config, remotePath }
    const { id } = await window.api.credentials.set(fullConfig)
    const summary: SSHProfileSummary = {
      id,
      label: fullConfig.label,
      host: fullConfig.host,
      port: fullConfig.port,
      username: fullConfig.username,
      authMethod: fullConfig.authMethod,
      keyPath: fullConfig.keyPath,
      remotePath: fullConfig.remotePath,
    }
    setIsRemote(true)
    setShowSSHModal(false)
    setPendingSSHConfig(null)
    setActiveSSHConfig(summary)
    setRecentVPS((prev) => {
      const next = [summary, ...prev.filter((p) => p.id !== id)].slice(0, MAX_RECENT_VPS)
      saveRecentVPSIds(next.map((p) => p.id))
      return next
    })
    setFolder(remotePath)
    setConnectionKey((k) => k + 1)  // força o Sidebar a recarregar mesmo se o path for igual
    setTabs([])
    // Don't reset pendingUploads here — persisted drafts from last session are preserved
    // across reconnects to the same VPS. clearPendingUploads() is called on explicit disconnect.
    setActiveTabPath(null)
    addToast(`Conectado a ${vpsBaseName(config)}`, 'success')
    saveLastSession({ type: 'vps', profileId: id })
    restoreTabs(remotePath)
  }

  async function handleDisconnect(): Promise<void> {
    cancelAllAutoSave()
    await window.api.fs.clearDeleteUndo()
    await window.api.ssh.disconnect()
    clearPendingUploads()
    setIsRemote(false)
    setActiveSSHConfig(null)
    setFolder(null)
    setTabs([])
    setPendingUploads([])
    setActiveTabPath(null)
    saveLastSession(null)
    addToast('Desconectado', 'info')
  }

  async function handleExitFolder(): Promise<void> {
    await window.api.fs.clearDeleteUndo()
    saveLastSession(null)
    setFolder(null)
    setTabs([])
    setActiveTabPath(null)
  }

  // Conecta direto sem abrir modal (usado ao clicar em VPS recente)
  async function handleDirectConnectVPS(summary: SSHProfileSummary): Promise<void> {
    const config = await window.api.credentials.get(summary.id)
    if (!config) {
      addToast('Perfil não encontrado', 'error')
      return
    }
    const result = await window.api.ssh.connect(config)
    if (!result.ok) {
      addToast(result.error ?? 'Erro ao conectar', 'error')
      return
    }
    // handleSSHConnect já incrementa connectionKey, forçando reload do Sidebar
    await handleSSHConnect(config, config.remotePath)
  }

  // Abre modal pré-preenchido para editar antes de conectar
  async function handleEditVPS(summary: SSHProfileSummary): Promise<void> {
    const config = await window.api.credentials.get(summary.id)
    if (!config) {
      addToast('Perfil não encontrado', 'error')
      return
    }
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

  function removeRecentVPS(summary: SSHProfileSummary): void {
    setRecentVPS((prev) => {
      const next = prev.filter((p) => p.id !== summary.id)
      saveRecentVPSIds(next.map((p) => p.id))
      return next
    })
    void window.api.credentials.delete(summary.id)
  }

  function handleSSHModalClose(): void {
    setPendingSSHConfig(null)
    setShowSSHModal(false)
  }

  function handleEditorPrefsChange(prefs: EditorPrefs): void {
    setEditorPrefs(prefs)
    localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs))
    if (!prefs.rawModeEnabled) setLayoutMode((m) => m === 'raw' ? 'editor' : m)
  }

  function handleLocalDiffChange(enabled: boolean): void {
    setLocalDiffEnabled(enabled)
    localStorage.setItem(LOCAL_DIFF_KEY, String(enabled))
  }

  const buildFileTab = useCallback(async (
    filePath: string,
    fileName: string,
    notifyLargeFile = false
  ): Promise<OpenTab | null> => {
    const [statResult, readResult] = await Promise.all([
      window.api.fs.stat(filePath),
      window.api.fs.readFile(filePath),
    ])

    if (!readResult.ok) return null

    const diskContent = readResult.data ?? ''
    const draft = loadDraft(filePath)
    const hasDraft = draft !== null && !contentEquals(draft, diskContent)
    const fileSizeBytes = statResult.ok && statResult.data ? statResult.data.size : new TextEncoder().encode(diskContent).length
    const isLargeFile = fileSizeBytes > LARGE_FILE_BYTES

    if (isLargeFile && notifyLargeFile) {
      addToast(`"${fileName}" é maior que 1 MB e foi aberto em modo seguro.`, 'info', { durationMs: 5000 })
    }

    return {
      path: filePath,
      name: fileName,
      type: 'file',
      content: hasDraft ? draft : diskContent,
      originalContent: diskContent,
      isDirty: hasDraft,
      isNormalized: false,
      isUploading: false,
      isLargeFile,
      fileSizeBytes,
    }
  }, [addToast])

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

    const newTab = await buildFileTab(node.path, node.name, true)
    if (!newTab) {
      addToast(`Erro ao abrir ${node.name}`, 'error')
      return
    }

    // Use functional updater to prevent duplicate tabs from rapid clicks
    setTabs((prev) => prev.some((t) => t.path === node.path) ? prev : [...prev, newTab])
    setActiveTabPath(node.path)
  }, [tabs, pendingUploads, addToast, buildFileTab])

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
        // Recalculate isDirty: draft may match the normalized content (e.g. Milkdown
        // previously normalised * → - and the draft already has -).
        if (t.isDirty) {
          const stillDirty = !contentEquals(t.content, normalizedContent)
          if (!stillDirty) clearDraft(path)
          return { ...t, isNormalized: true, originalContent: normalizedContent, isDirty: stillDirty }
        }
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
        const isDirty = !contentEquals(content, t.originalContent)
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
      // Also remove from pendingUploads if it was there (e.g. closed dirty tab)
      setPendingUploads((prev) => prev.filter((t) => t.path !== path))
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

  // Diff merge: revert a hunk (or all) — updates tab.content + forces editor remount
  const handleDiffRevert = useCallback((filePath: string, newContent: string) => {
    const update = (t: OpenTab): OpenTab => t.path !== filePath ? t : {
      ...t,
      content: newContent,
      isDirty: !contentEquals(newContent, t.originalContent),
      contentVersion: (t.contentVersion ?? 0) + 1,
    }
    setTabs((prev) => prev.map(update))
    // For pendingUploads: update and remove if no longer dirty (revert restores original)
    setPendingUploads((prev) => prev.map(update).filter((t) => t.isDirty))
    // Keep draft in sync
    const tab = [...tabs, ...pendingUploads].find((t) => t.path === filePath)
    if (tab) {
      if (!contentEquals(newContent, tab.originalContent)) saveDraft(filePath, newContent)
      else clearDraft(filePath)
    }
  }, [tabs, pendingUploads])

  // Diff merge: accept a hunk (or all) — updates tab.originalContent (baseline only, no upload)
  const handleDiffAccept = useCallback((filePath: string, newOriginal: string) => {
    const update = (t: OpenTab): OpenTab => t.path !== filePath ? t : {
      ...t,
      originalContent: newOriginal,
      isDirty: !contentEquals(t.content, newOriginal),
    }
    setTabs((prev) => prev.map(update))
    // Remove pendingUploads that are no longer dirty (accept aligns baseline with content)
    setPendingUploads((prev) => prev.map(update).filter((t) => t.isDirty))
  }, [])

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
           ?? pendingUploadsRef.current.find((t) => t.path === path)
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
      if (e.key === '`') { e.preventDefault(); setTerminalOpen((v) => !v); return }
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
      else if (action === 'layout:editor') setLayoutMode('raw')
      else if (action === 'layout:visualize') setLayoutMode('visualize')
      else if (action === 'search:files') setShowFileSearch(true)
      else if (action === 'search:content') setShowContentSearch(true)
      else if (action === 'shortcuts') setShowShortcutsModal(true)
      else if (action === 'openSettings') setShowSettingsModal(true)
      else if (action === 'closeTab') { if (activeTabPath) handleTabClose(activeTabPath) }
    })
    return unsubscribe
  }, [activeTabPath, handleTabClose])

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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl">
              <AppBrandIcon />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Makrown</h1>
            <p className="max-w-sm text-sm text-zinc-500">{welcomeMessage}</p>
          </div>

          <div className="flex flex-col items-center gap-2">
            <ShortcutTooltip content={shortcutTitle('Abrir pasta', [mod, 'O'])}>
              <button
                onClick={handleSelectFolder}
                className="w-72 rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Abrir pasta
              </button>
            </ShortcutTooltip>
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
                          aria-label={`Remover ${folderBaseName(path)} das pastas recentes`}
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
                    {recentVPS.map((summary) => (
                      <div
                        key={summary.id}
                        className="group/item flex w-full items-center rounded-md transition-colors hover:bg-zinc-800"
                      >
                        <button
                          onClick={() => handleDirectConnectVPS(summary)}
                          className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left"
                        >
                          <Server size={12} className="shrink-0 text-indigo-400" />
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-zinc-300">
                              {vpsBaseName(summary)}
                            </div>
                            <div className="truncate text-[10px] text-zinc-600">
                              {summary.username}@{summary.host}:{summary.port}
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => removeRecentVPS(summary)}
                          className="mr-1.5 rounded p-1 text-zinc-700 opacity-0 transition-all hover:bg-zinc-700 hover:text-red-400 group-hover/item:opacity-100"
                          title="Remover da lista"
                          aria-label={`Remover ${vpsBaseName(summary)} das conexões recentes`}
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
          <div className="pt-2 text-[11px] text-zinc-600">
            Versão {window.api.appVersion}
          </div>
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
              updateState={updateState}
              onCheckForUpdates={handleCheckForUpdates}
              onDownloadUpdate={handleDownloadUpdate}
              onInstallUpdate={handleInstallUpdate}
            />
          </div>
        )}
        {updateToastKey && updateToastKey !== dismissedUpdateToastKey && (
          <UpdateToast
            state={updateState}
            onDownload={handleDownloadUpdate}
            onInstall={handleInstallUpdate}
            onOpenSettings={handleOpenUpdateSettings}
            onDismiss={handleDismissUpdateToast}
          />
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
      <div className="flex h-screen flex-col overflow-hidden bg-zinc-950 text-zinc-100">
        <div className="flex flex-1 min-h-0 overflow-hidden">
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
            showDirtyPanel={isRemote || localDiffEnabled}
            dirtyTabs={[...tabs.filter((t) => t.type === 'file' && t.isDirty), ...pendingUploads.filter((t) => t.isDirty)]}
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
            onDiffRevert={handleDiffRevert}
            onDiffAccept={handleDiffAccept}
            editorPrefs={editorPrefs}
            onEditorPrefsChange={handleEditorPrefsChange}
            onOpenSettings={() => setShowSettingsModal(true)}
            onToggleTerminal={() => setTerminalOpen((v) => !v)}
            terminalOpen={terminalOpen}
            onEnviar={() => setShowEnviarModal(true)}
            onEnviarFile={handleEnviarFile}
            onNormalized={handleNormalized}
            isRemote={isRemote}
            autoSaveEnabled={isRemote && vpsPrefs.autoSaveEnabled}
          />
        </div>
        <TerminalPanel
          isOpen={terminalOpen}
          height={terminalHeight}
          onHeightChange={handleTerminalHeightChange}
          onClose={() => setTerminalOpen(false)}
          cwd={folder}
          isRemote={isRemote}
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
          dirtyTabs={[...tabs.filter((t) => t.type === 'file' && t.isDirty), ...pendingUploads.filter((t) => t.isDirty)]}
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
            localDiffEnabled={localDiffEnabled}
            onLocalDiffChange={handleLocalDiffChange}
            updateState={updateState}
            onCheckForUpdates={handleCheckForUpdates}
            onDownloadUpdate={handleDownloadUpdate}
            onInstallUpdate={handleInstallUpdate}
          />
        </div>
      )}

      {updateToastKey && updateToastKey !== dismissedUpdateToastKey && (
        <UpdateToast
          state={updateState}
          onDownload={handleDownloadUpdate}
          onInstall={handleInstallUpdate}
          onOpenSettings={handleOpenUpdateSettings}
          onDismiss={handleDismissUpdateToast}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export default App
