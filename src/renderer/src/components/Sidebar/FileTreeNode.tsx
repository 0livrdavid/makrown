import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  File,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
  Loader2
} from 'lucide-react'
import type { TreeNode } from '../../hooks/useFileTree'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'
import { InlineInput } from './InlineInput'
import { shouldShowNode, type FilterConfig } from './filterUtils'

interface FileTreeNodeProps {
  node: TreeNode
  depth: number
  selectedPath: string | null
  filterConfig: FilterConfig
  onSelect: (node: TreeNode) => void
  onToggle: (node: TreeNode) => void
  onCreateFile: (dirPath: string, name: string) => Promise<boolean>
  onCreateDir: (dirPath: string, name: string) => Promise<boolean>
  onRename: (node: TreeNode, newName: string) => Promise<boolean>
  onDelete: (node: TreeNode) => void
}

type InlineAction = 'newFile' | 'newFolder' | 'rename' | null

function getFileIcon(ext: string | null): React.JSX.Element {
  switch (ext?.toLowerCase()) {
    case '.md':
    case '.mdx':
      return <FileText size={14} className="shrink-0 text-blue-400" />
    case '.txt':
      return <FileText size={14} className="shrink-0 text-zinc-400" />
    case '.json':
    case '.jsonc':
      return <FileJson size={14} className="shrink-0 text-yellow-400" />
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
    case '.py':
    case '.rb':
    case '.go':
    case '.rs':
    case '.sh':
    case '.bash':
    case '.zsh':
    case '.css':
    case '.scss':
    case '.html':
    case '.xml':
    case '.yaml':
    case '.yml':
    case '.toml':
      return <FileCode size={14} className="shrink-0 text-emerald-400" />
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
    case '.webp':
    case '.ico':
      return <FileImage size={14} className="shrink-0 text-rose-400" />
    default:
      return <File size={14} className="shrink-0 text-zinc-500" />
  }
}

export function FileTreeNode({
  node,
  depth,
  selectedPath,
  filterConfig,
  onSelect,
  onToggle,
  onCreateFile,
  onCreateDir,
  onRename,
  onDelete
}: FileTreeNodeProps): React.JSX.Element {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [inlineAction, setInlineAction] = useState<InlineAction>(null)

  const isDir = node.type === 'directory'
  const isSelected = node.path === selectedPath
  const indent = depth * 12

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function buildContextMenuItems(): ContextMenuItem[] {
    const items: ContextMenuItem[] = []

    if (isDir) {
      items.push({
        label: 'Novo arquivo',
        icon: <FilePlus size={13} />,
        onClick: () => setInlineAction('newFile')
      })
      items.push({
        label: 'Nova pasta',
        icon: <FolderPlus size={13} />,
        onClick: () => setInlineAction('newFolder')
      })
    }

    items.push({
      label: 'Renomear',
      icon: <Pencil size={13} />,
      onClick: () => setInlineAction('rename')
    })

    items.push({
      label: 'Excluir',
      icon: <Trash2 size={13} />,
      onClick: () => onDelete(node),
      danger: true
    })

    return items
  }

  async function handleInlineConfirm(value: string): Promise<void> {
    setInlineAction(null)
    if (inlineAction === 'newFile') await onCreateFile(node.path, value)
    else if (inlineAction === 'newFolder') await onCreateDir(node.path, value)
    else if (inlineAction === 'rename') await onRename(node, value)
  }

  const icon = isDir ? (
    node.isLoading ? (
      <Loader2 size={14} className="shrink-0 animate-spin text-zinc-500" />
    ) : node.isExpanded ? (
      <FolderOpen size={14} className="shrink-0 text-amber-400" />
    ) : (
      <Folder size={14} className="shrink-0 text-amber-400" />
    )
  ) : (
    getFileIcon(node.extension)
  )

  const chevron = isDir ? (
    node.isLoading ? null : node.isExpanded ? (
      <ChevronDown size={12} className="shrink-0 text-zinc-500" />
    ) : (
      <ChevronRight size={12} className="shrink-0 text-zinc-500" />
    )
  ) : null

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => (isDir ? onToggle(node) : onSelect(node))}
        onKeyDown={(e) => e.key === 'Enter' && (isDir ? onToggle(node) : onSelect(node))}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: 8 + indent }}
        className={`group flex cursor-pointer items-center gap-1.5 rounded py-[3px] pr-2 text-sm select-none transition-colors ${
          isSelected
            ? 'bg-indigo-600/30 text-zinc-100'
            : 'text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100'
        }`}
      >
        <span className="flex w-3 items-center justify-center">{chevron}</span>
        {icon}
        <span className="truncate">{node.name}</span>
      </div>

      {/* Input inline para criar/renomear */}
      {inlineAction === 'rename' && (
        <InlineInput
          defaultValue={node.name}
          onConfirm={handleInlineConfirm}
          onCancel={() => setInlineAction(null)}
          indent={8 + indent}
        />
      )}

      {/* Filhos da pasta — animação grid 0fr→1fr */}
      {isDir && node.children && (
        <div
          className="grid duration-150 ease-in-out"
          style={{
            gridTemplateRows: node.isExpanded ? '1fr' : '0fr',
            transition: 'grid-template-rows 150ms ease-in-out'
          }}
        >
          <div className="overflow-hidden">
            {/* Input inline para novo arquivo/pasta dentro deste dir */}
            {(inlineAction === 'newFile' || inlineAction === 'newFolder') && (
              <InlineInput
                onConfirm={handleInlineConfirm}
                onCancel={() => setInlineAction(null)}
                indent={8 + indent + 12}
              />
            )}

            {node.children
              .filter((c) => shouldShowNode(c, filterConfig))
              .map((child) => (
                <FileTreeNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  selectedPath={selectedPath}
                  filterConfig={filterConfig}
                  onSelect={onSelect}
                  onToggle={onToggle}
                  onCreateFile={onCreateFile}
                  onCreateDir={onCreateDir}
                  onRename={onRename}
                  onDelete={onDelete}
                />
              ))}

            {node.children.filter((c) => shouldShowNode(c, filterConfig)).length === 0 && (
              <div
                style={{ paddingLeft: 8 + indent + 24 }}
                className="py-[3px] text-xs text-zinc-600"
              >
                pasta vazia
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
