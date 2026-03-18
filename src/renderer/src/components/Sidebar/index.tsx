import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FilePlus, FolderPlus, RefreshCw, Trash2, Filter, LogOut, ChevronsDownUp, ChevronDown, ChevronRight, GitCompare, FileText as FileIcon, FolderSearch, RotateCcw } from 'lucide-react'
import { useFileTree, type DeletedNodeUndo, type TreeNode } from '../../hooks/useFileTree'
import type { OpenTab } from '../Editor'
import { FileTreeNode } from './FileTreeNode'
import { FilterModal } from './FilterModal'
import { FolderSelect } from './FolderSelect'
import { LoadingScreen } from '../LoadingScreen'
import { DEFAULT_FILTER, shouldShowNode, type FilterConfig } from './filterUtils'
import { useToastContext } from '../../contexts/ToastContext'
import { useModalFocusTrap } from '../../hooks/useModalFocusTrap'
import type { SSHProfileSummary } from '../../../../shared/types'

const PREFETCH_DEPTH_KEY = 'makrown:prefetch-depth'
const DEFAULT_PREFETCH_DEPTH = 3

function getPrefetchDepth(): number {
  try {
    const raw = localStorage.getItem(PREFETCH_DEPTH_KEY)
    return raw ? Math.max(1, Math.min(10, Number(raw))) : DEFAULT_PREFETCH_DEPTH
  } catch {
    return DEFAULT_PREFETCH_DEPTH
  }
}

interface SidebarProps {
  rootPath: string
  selectedPath: string | null
  onSelectFile: (node: TreeNode) => void
  onOpenFolder: (path: string) => void
  onPickFolder: () => void
  onConnectVPS: () => void
  onConnectRecentVPS: (summary: SSHProfileSummary) => void
  onEditVPS: (summary: SSHProfileSummary) => void
  onDisconnect?: () => void
  onExit: () => void
  isRemote: boolean
  recentFolders: string[]
  recentVPS: SSHProfileSummary[]
  activeSSHConfig: SSHProfileSummary | null
  sshStatus?: 'connected' | 'reconnecting' | 'disconnected'
  showDirtyPanel?: boolean
  dirtyTabs?: OpenTab[]
  onOpenDiff?: (filePath: string) => void
  onOpenFile?: (filePath: string) => void
}

export function Sidebar({
  rootPath,
  selectedPath,
  onSelectFile,
  onOpenFolder,
  onPickFolder,
  onConnectVPS,
  onConnectRecentVPS,
  onEditVPS,
  onDisconnect,
  onExit,
  isRemote,
  recentFolders,
  recentVPS,
  activeSSHConfig,
  sshStatus,
  showDirtyPanel = false,
  dirtyTabs = [],
  onOpenDiff,
  onOpenFile,
}: SidebarProps): React.JSX.Element {
  const { tree, loadRoot, toggleExpand, collapseAll, peekDir, watchRefresh, createFile, createDir, rename, deleteNode, undoDelete } =
    useFileTree()

  const { addToast } = useToastContext()

  const FILTER_KEY = (path: string): string => `makrown:filter:${path}`

  function loadSavedFilter(path: string): FilterConfig {
    try {
      const raw = localStorage.getItem(FILTER_KEY(path))
      return raw ? { ...DEFAULT_FILTER, ...JSON.parse(raw) } : DEFAULT_FILTER
    } catch {
      return DEFAULT_FILTER
    }
  }

  const [deletingNode, setDeletingNode] = useState<TreeNode | null>(null)
  const [showNewFile, setShowNewFile] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [filterConfig, setFilterConfig] = useState<FilterConfig>(() => loadSavedFilter(rootPath))
  const [dirtyPanelOpen, setDirtyPanelOpen] = useState(true)
  const [deletedStack, setDeletedStack] = useState<DeletedNodeUndo[]>([])
  const deleteModalRef = useModalFocusTrap({ onClose: () => setDeletingNode(null) })

  const isFilterModified = JSON.stringify(filterConfig) !== JSON.stringify(DEFAULT_FILTER)
  const treeRef = useRef(tree)
  treeRef.current = tree
  const filterConfigRef = useRef(filterConfig)
  filterConfigRef.current = filterConfig

  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  const [peekDisplay, setPeekDisplay] = useState({ done: 0, total: 0 })
  // Ref counters are race-condition safe for concurrent async operations
  const peekCountRef = useRef({ pending: 0, total: 0, done: 0 })
  const visibleTree = useMemo(
    () => tree.filter((node) => shouldShowNode(node, filterConfig)),
    [tree, filterConfig]
  )

  function resetPeekCount(): void {
    peekCountRef.current = { pending: 0, total: 0, done: 0 }
    setPeekDisplay({ done: 0, total: 0 })
  }

  // Recursively peeks a dir up to maxDepth, tracking progress via ref counters
  const peekDirDeep = useCallback(async (dirPath: string, maxDepth = Infinity, currentDepth = 0) => {
    if (currentDepth >= maxDepth) return

    peekCountRef.current.pending++
    peekCountRef.current.total++
    setPeekDisplay({ done: peekCountRef.current.done, total: peekCountRef.current.total })

    const children = await peekDir(dirPath)
    const subdirs = children.filter((c) => c.type === 'directory')
    await Promise.all(subdirs.map((c) => peekDirDeep(c.path, maxDepth, currentDepth + 1)))

    peekCountRef.current.done++
    peekCountRef.current.pending--
    setPeekDisplay({ done: peekCountRef.current.done, total: peekCountRef.current.total })

    if (peekCountRef.current.pending === 0) {
      setIsLoading(false)
    }
  }, [peekDir])

  // Load folder: restore saved filter, load tree, track progress
  useEffect(() => {
    setIsLoading(true)
    resetPeekCount()
    const saved = loadSavedFilter(rootPath)
    setFilterConfig(saved)

    loadRoot(rootPath).then((rootNodes) => {
      const dirs = rootNodes.filter((n) => n.type === 'directory')
      // hideEmptyFolders precisa de profundidade infinita para filtrar corretamente
      const effectiveDepth = saved.hideEmptyFolders ? Infinity : getPrefetchDepth()
      if (dirs.length > 0 && effectiveDepth > 0) {
        for (const n of dirs) peekDirDeep(n.path, effectiveDepth)
      } else {
        setIsLoading(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, loadRoot])

  // When hideEmptyFolders is toggled ON while on the same folder, peek unloaded dirs
  useEffect(() => {
    if (!filterConfig.hideEmptyFolders) return
    function collectUnloaded(nodes: TreeNode[]): string[] {
      const paths: string[] = []
      for (const node of nodes) {
        if (node.type !== 'directory') continue
        if (node.children === undefined) paths.push(node.path)
        else paths.push(...collectUnloaded(node.children))
      }
      return paths
    }
    const unloaded = collectUnloaded(treeRef.current)
    if (unloaded.length === 0) return
    setIsLoading(true)
    resetPeekCount()
    for (const path of unloaded) peekDirDeep(path)
  }, [filterConfig.hideEmptyFolders, peekDirDeep])

  // Filesystem watcher: restart whenever rootPath changes
  useEffect(() => {
    window.api.fs.watch(rootPath)
    const unsubscribe = window.api.fs.onChanged((changedDir) => {
      if (changedDir.startsWith(rootPath)) {
        watchRefresh(changedDir)
      }
    })
    return () => {
      window.api.fs.unwatch()
      unsubscribe()
    }
  }, [rootPath, watchRefresh])

  // Reload tree preserving the current filterConfig (not resetting to saved)
  function handleRefresh(): void {
    setIsLoading(true)
    resetPeekCount()
    const cfg = filterConfigRef.current
    loadRoot(rootPath).then((rootNodes) => {
      const dirs = rootNodes.filter((n) => n.type === 'directory')
      const effectiveDepth = cfg.hideEmptyFolders ? Infinity : getPrefetchDepth()
      if (dirs.length > 0 && effectiveDepth > 0) {
        for (const n of dirs) peekDirDeep(n.path, effectiveDepth)
      } else {
        setIsLoading(false)
      }
    })
  }

  function handleSaveFilter(config: FilterConfig): void {
    setFilterConfig(config)
    localStorage.setItem(FILTER_KEY(rootPath), JSON.stringify(config))
  }

  const undoLatestDelete = useCallback(async () => {
    const latest = deletedStack[0]
    if (!latest) return

    const ok = await undoDelete(latest)
    if (ok) {
      setDeletedStack((prev) => prev.filter((entry) => entry.undoId !== latest.undoId))
      addToast(`"${latest.name}" restaurado`, 'success')
    } else {
      addToast(`Não foi possível restaurar "${latest.name}"`, 'error')
    }
  }, [deletedStack, undoDelete, addToast])

  async function handleToggleExpand(node: TreeNode): Promise<void> {
    await toggleExpand(node)
    if (!node.isExpanded) {
      const cfg = filterConfigRef.current
      setTimeout(() => {
        function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
          for (const n of nodes) {
            if (n.path === path) return n
            if (n.children) {
              const found = findNode(n.children, path)
              if (found) return found
            }
          }
          return undefined
        }
        const expanded = findNode(treeRef.current, node.path)
        if (expanded?.children) {
          for (const child of expanded.children) {
            if (child.type === 'directory' && child.children === undefined) {
              const depth = cfg.hideEmptyFolders ? Infinity : getPrefetchDepth()
              peekDirDeep(child.path, depth)
            }
          }
        }
      }, 0)
    }
  }


  async function handleCreateFile(dirPath: string, name: string): Promise<boolean> {
    const ok = await createFile(dirPath, name)
    if (!ok) addToast(`Erro ao criar arquivo "${name}"`, 'error')
    return ok
  }

  async function handleCreateDir(dirPath: string, name: string): Promise<boolean> {
    const ok = await createDir(dirPath, name)
    if (!ok) addToast(`Erro ao criar pasta "${name}"`, 'error')
    return ok
  }

  // Criar na raiz
  async function handleRootCreateFile(name: string): Promise<void> {
    setShowNewFile(false)
    const ok = await createFile(rootPath, name)
    if (!ok) addToast(`Erro ao criar arquivo "${name}"`, 'error')
  }

  async function handleRootCreateDir(name: string): Promise<void> {
    setShowNewFolder(false)
    const ok = await createDir(rootPath, name)
    if (!ok) addToast(`Erro ao criar pasta "${name}"`, 'error')
  }

  async function handleRename(node: TreeNode, newName: string): Promise<boolean> {
    const ok = await rename(node, newName)
    if (!ok) addToast(`Erro ao renomear "${node.name}"`, 'error')
    return ok
  }

  function handleDeleteRequest(node: TreeNode): void {
    setDeletingNode(node)
  }

  async function confirmDelete(): Promise<void> {
    if (!deletingNode) return
    const result = await deleteNode(deletingNode)
    if (result.ok && result.undo) {
      const deletedEntry = result.undo
      setDeletedStack((prev) => [deletedEntry, ...prev.filter((entry) => entry.undoId !== deletedEntry.undoId)].slice(0, 20))
      addToast(`"${deletingNode.name}" excluído`, 'success', {
        action: {
          label: 'Reverter',
          onClick: async () => {
            const ok = await undoDelete(deletedEntry)
            if (ok) {
              setDeletedStack((prev) => prev.filter((entry) => entry.undoId !== deletedEntry.undoId))
              addToast(`"${deletedEntry.name}" restaurado`, 'success')
            } else {
              addToast(`Não foi possível restaurar "${deletedEntry.name}"`, 'error')
            }
          },
        },
        durationMs: 8000,
      })
    } else {
      addToast(`Erro ao excluir "${deletingNode.name}"`, 'error')
    }
    setDeletingNode(null)
  }

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false
      return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('[contenteditable="true"]') !== null
    }

    function handleUndoShortcut(event: KeyboardEvent): void {
      const mod = window.api.platform === 'darwin' ? event.metaKey : event.ctrlKey
      if (!mod || event.shiftKey || event.altKey || event.key.toLowerCase() !== 'z') return
      if (deletedStack.length === 0 || isEditableTarget(event.target)) return
      event.preventDefault()
      void undoLatestDelete()
    }

    window.addEventListener('keydown', handleUndoShortcut)
    return () => window.removeEventListener('keydown', handleUndoShortcut)
  }, [deletedStack.length, undoLatestDelete])

  useEffect(() => {
    setDeletedStack([])
  }, [rootPath])

  return (
    <>
      {isLoading && <LoadingScreen done={peekDisplay.done} total={peekDisplay.total} />}

      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
        {/* Header */}
        <div
          className="flex h-9 shrink-0 items-center justify-end border-b border-zinc-800 px-2 pl-20"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => { setShowNewFile(true); setShowNewFolder(false) }}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              title="Novo arquivo"
              aria-label="Novo arquivo"
            >
              <FilePlus size={15} />
            </button>
            <button
              onClick={() => { setShowNewFolder(true); setShowNewFile(false) }}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              title="Nova pasta"
              aria-label="Nova pasta"
            >
              <FolderPlus size={15} />
            </button>
            <button
              onClick={() => setShowFilterModal(true)}
              className={`rounded p-1.5 transition-colors hover:bg-zinc-700 ${isFilterModified ? 'text-indigo-400 hover:text-indigo-300' : 'text-zinc-500 hover:text-zinc-200'}`}
              title="Filtros"
              aria-label="Abrir filtros da árvore"
            >
              <Filter size={15} />
            </button>
            <button
              onClick={collapseAll}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              title="Colapsar tudo"
              aria-label="Colapsar toda a árvore"
            >
              <ChevronsDownUp size={15} />
            </button>
            <button
              onClick={handleRefresh}
              className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              title="Atualizar"
              aria-label="Atualizar árvore de arquivos"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>

        {/* File tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {/* Inputs inline na raiz */}
          {showNewFile && (
            <div className="px-1">
              <input
                autoFocus
                placeholder="nome.md"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRootCreateFile(e.currentTarget.value.trim())
                  if (e.key === 'Escape') setShowNewFile(false)
                }}
                onBlur={() => setShowNewFile(false)}
                className="w-full rounded bg-zinc-700 px-2 py-0.5 text-sm text-zinc-100 outline-none ring-1 ring-indigo-500"
              />
            </div>
          )}
          {showNewFolder && (
            <div className="px-1">
              <input
                autoFocus
                placeholder="nova-pasta"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRootCreateDir(e.currentTarget.value.trim())
                  if (e.key === 'Escape') setShowNewFolder(false)
                }}
                onBlur={() => setShowNewFolder(false)}
                className="w-full rounded bg-zinc-700 px-2 py-0.5 text-sm text-zinc-100 outline-none ring-1 ring-indigo-500"
              />
            </div>
          )}

          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-zinc-500">
              <FolderSearch size={24} className="text-zinc-700" />
              <div>
                <p className="text-sm font-medium text-zinc-400">Nada por aqui ainda</p>
                <p className="mt-1 text-xs text-zinc-600">Crie um arquivo markdown ou adicione conteúdo nesta pasta.</p>
              </div>
            </div>
          ) : visibleTree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-zinc-500">
              <Filter size={22} className="text-zinc-700" />
              <div>
                <p className="text-sm font-medium text-zinc-400">Nenhum arquivo visível</p>
                <p className="mt-1 text-xs text-zinc-600">Os filtros atuais esconderam todos os itens desta pasta.</p>
              </div>
              {isFilterModified && (
                <button
                  onClick={() => handleSaveFilter(DEFAULT_FILTER)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <RotateCcw size={12} />
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            visibleTree.map((node) => (
              <FileTreeNode
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                filterConfig={filterConfig}
                onSelect={onSelectFile}
                onToggle={handleToggleExpand}
                onCreateFile={handleCreateFile}
                onCreateDir={handleCreateDir}
                onRename={handleRename}
                onDelete={handleDeleteRequest}
              />
            ))
          )}
        </div>

        {/* Dirty files panel */}
        {showDirtyPanel && dirtyTabs.length > 0 && (
          <div className="shrink-0 border-t border-zinc-800">
            {/* Panel header */}
            <button
              onClick={() => setDirtyPanelOpen((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
            >
              {dirtyPanelOpen
                ? <ChevronDown size={11} className="shrink-0 text-zinc-500" />
                : <ChevronRight size={11} className="shrink-0 text-zinc-500" />
              }
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Alterações
              </span>
              <span className="ml-auto rounded-full bg-zinc-700 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400">
                {dirtyTabs.length}
              </span>
            </button>

            {/* Panel content */}
            <div
              className="grid transition-all duration-150 ease-in-out"
              style={{ gridTemplateRows: dirtyPanelOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                {dirtyTabs.map((tab) => (
                  <div
                    key={tab.path}
                    className="group flex items-center gap-1 px-3 py-1 transition-colors hover:bg-zinc-800/60"
                  >
                    {/* Click name → open diff */}
                    <button
                      onClick={() => onOpenDiff?.(tab.path)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      title="Ver diff"
                    >
                      <GitCompare size={10} className="shrink-0 text-zinc-500" />
                      <span className="truncate text-xs text-zinc-300">{tab.name}</span>
                    </button>

                    {/* Open file directly */}
                    <button
                      onClick={() => onOpenFile?.(tab.path)}
                      className="shrink-0 rounded p-0.5 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-zinc-700 hover:text-zinc-300"
                      title="Abrir arquivo"
                      aria-label={`Abrir ${tab.name}`}
                    >
                      <FileIcon size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-zinc-800 px-2 py-2">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <FolderSelect
                currentPath={rootPath}
                isRemote={isRemote}
                activeSSHConfig={activeSSHConfig}
                recentFolders={recentFolders}
                recentVPS={recentVPS}
                sshStatus={sshStatus}
                onSelect={onOpenFolder}
                onPickNew={onPickFolder}
                onConnectVPS={onConnectVPS}
                onConnectRecentVPS={onConnectRecentVPS}
                onEditVPS={onEditVPS}
              />
            </div>
            <button
              onClick={isRemote ? (onDisconnect ?? onExit) : onExit}
              className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-red-400"
              title={isRemote ? 'Desconectar' : 'Fechar pasta'}
              aria-label={isRemote ? 'Desconectar do VPS' : 'Fechar pasta atual'}
            >
              <LogOut size={12} />
            </button>
          </div>
        </div>
      </aside>

      {showFilterModal && (
        <FilterModal
          config={filterConfig}
          onSave={handleSaveFilter}
          onClose={() => setShowFilterModal(false)}
        />
      )}

      {/* Modal de confirmação de exclusão */}
      {deletingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            ref={deleteModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-node-title"
            tabIndex={-1}
            className="w-80 rounded-lg border border-zinc-700 bg-zinc-800 p-5 shadow-2xl"
          >
            <div className="mb-1 flex items-center gap-2 text-red-400">
              <Trash2 size={16} />
              <span id="delete-node-title" className="font-medium">Excluir {deletingNode.type === 'directory' ? 'pasta' : 'arquivo'}</span>
            </div>
            <p className="mb-4 text-sm text-zinc-400">
              Tem certeza que deseja excluir{' '}
              <span className="font-medium text-zinc-200">"{deletingNode.name}"</span>?
              {deletingNode.type === 'directory' && (
                <span className="mt-1 block text-xs text-red-400">
                  Todo o conteúdo da pasta será removido.
                </span>
              )}
              <span className="mt-2 block text-xs text-zinc-500">
                Você poderá desfazer pelo toast ou com Ctrl+Z.
              </span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingNode(null)}
                className="rounded px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
