import { useState, useCallback, useRef } from 'react'
import type { FileEntry, FileType } from '../../../shared/types'

export interface TreeNode extends FileEntry {
  children?: TreeNode[]
  isLoading?: boolean
  isExpanded?: boolean
}

interface UseFileTreeReturn {
  tree: TreeNode[]
  loadRoot: (rootPath: string) => Promise<TreeNode[]>
  toggleExpand: (node: TreeNode) => Promise<void>
  collapseAll: () => void
  peekDir: (dirPath: string) => Promise<TreeNode[]>
  refresh: (dirPath: string) => Promise<void>
  watchRefresh: (dirPath: string) => Promise<void>
  createFile: (dirPath: string, name: string) => Promise<boolean>
  createDir: (dirPath: string, name: string) => Promise<boolean>
  rename: (node: TreeNode, newName: string) => Promise<boolean>
  deleteNode: (node: TreeNode) => Promise<DeleteNodeResult>
  undoDelete: (entry: DeletedNodeUndo) => Promise<boolean>
}

export interface DeletedNodeUndo {
  undoId: string
  path: string
  parentPath: string
  name: string
  type: FileType
}

interface DeleteNodeResult {
  ok: boolean
  undo?: DeletedNodeUndo
}

function sortEntries(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

async function loadChildren(dirPath: string): Promise<TreeNode[]> {
  const result = await window.api.fs.listDir(dirPath)
  if (!result.ok || !result.data) return []
  return sortEntries(result.data).map((entry) => ({
    ...entry,
    children: entry.type === 'directory' ? undefined : undefined,
    isExpanded: false,
    isLoading: false
  }))
}

function updateNodeInTree(
  tree: TreeNode[],
  targetPath: string,
  updater: (node: TreeNode) => TreeNode
): TreeNode[] {
  return tree.map((node) => {
    if (node.path === targetPath) return updater(node)
    if (node.children) {
      return { ...node, children: updateNodeInTree(node.children, targetPath, updater) }
    }
    return node
  })
}

function removeNodeFromTree(tree: TreeNode[], targetPath: string): TreeNode[] {
  return tree
    .filter((node) => node.path !== targetPath)
    .map((node) => {
      if (node.children) {
        return { ...node, children: removeNodeFromTree(node.children, targetPath) }
      }
      return node
    })
}

export function useFileTree(): UseFileTreeReturn {
  const [tree, setTree] = useState<TreeNode[]>([])
  const rootPathRef = useRef<string | null>(null)

  const loadRoot = useCallback(async (rootPath: string): Promise<TreeNode[]> => {
    rootPathRef.current = rootPath
    const children = await loadChildren(rootPath)
    setTree(children)
    return children
  }, [])

  const toggleExpand = useCallback(async (node: TreeNode) => {
    if (node.type !== 'directory') return

    if (node.isExpanded) {
      setTree((prev) =>
        updateNodeInTree(prev, node.path, (n) => ({ ...n, isExpanded: false }))
      )
      return
    }

    // Se children já foram pré-carregados (via peekDir/prefetch), só expande
    if (node.children !== undefined) {
      setTree((prev) =>
        updateNodeInTree(prev, node.path, (n) => ({ ...n, isExpanded: true }))
      )
      return
    }

    // Marca como carregando
    setTree((prev) =>
      updateNodeInTree(prev, node.path, (n) => ({ ...n, isLoading: true }))
    )

    const children = await loadChildren(node.path)

    setTree((prev) =>
      updateNodeInTree(prev, node.path, (n) => ({
        ...n,
        isLoading: false,
        isExpanded: true,
        children
      }))
    )
  }, [])

  const peekDir = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const children = await loadChildren(dirPath)
    setTree((prev) =>
      updateNodeInTree(prev, dirPath, (n) => {
        if (n.children !== undefined) return n // Already loaded, don't overwrite
        return { ...n, children } // Load without expanding (isExpanded stays false)
      })
    )
    return children
  }, [])

  // Merges fresh children into existing nodes, preserving expanded/children state
  function mergeChildren(existing: TreeNode[], fresh: TreeNode[]): TreeNode[] {
    return sortEntries(fresh).map((freshNode) => {
      const prev = existing.find((e) => e.path === freshNode.path)
      if (prev) return { ...freshNode, children: prev.children, isExpanded: prev.isExpanded }
      return freshNode
    })
  }

  // Smart refresh for filesystem watch: preserves expanded state and children
  const watchRefresh = useCallback(async (dirPath: string) => {
    const fresh = await loadChildren(dirPath)
    if (dirPath === rootPathRef.current) {
      setTree((prev) => mergeChildren(prev, fresh))
    } else {
      setTree((prev) =>
        updateNodeInTree(prev, dirPath, (n) => {
          if (!n.children) return n // Not loaded yet, skip
          return { ...n, children: mergeChildren(n.children, fresh) }
        })
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async (dirPath: string) => {
    const children = await loadChildren(dirPath)
    // Se é a raiz, substitui a árvore inteira
    if (dirPath === rootPathRef.current) {
      setTree(children)
    } else {
      setTree((prev) =>
        updateNodeInTree(prev, dirPath, (n) => ({ ...n, children, isExpanded: true }))
      )
    }
  }, [])

  const createFile = useCallback(
    async (dirPath: string, name: string): Promise<boolean> => {
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      const filePath = `${dirPath}${sep}${name.endsWith('.md') ? name : `${name}.md`}`
      const result = await window.api.fs.createFile(filePath)
      if (result.ok) await refresh(dirPath)
      return result.ok
    },
    [refresh]
  )

  const createDir = useCallback(
    async (dirPath: string, name: string): Promise<boolean> => {
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      const newPath = `${dirPath}${sep}${name}`
      const result = await window.api.fs.createDir(newPath)
      if (result.ok) await refresh(dirPath)
      return result.ok
    },
    [refresh]
  )

  const rename = useCallback(
    async (node: TreeNode, newName: string): Promise<boolean> => {
      const sep = window.api.platform === 'win32' ? '\\' : '/'
      const parentPath = node.path.substring(0, node.path.lastIndexOf(sep))
      const newPath = `${parentPath}${sep}${newName}`
      const result = await window.api.fs.rename(node.path, newPath)
      if (result.ok) {
        // Remove o nó antigo e recarrega o pai
        setTree((prev) => removeNodeFromTree(prev, node.path))
        await refresh(parentPath)
      }
      return result.ok
    },
    [refresh]
  )

  const collapseAll = useCallback(() => {
    function collapse(nodes: TreeNode[]): TreeNode[] {
      return nodes.map((n) => ({
        ...n,
        isExpanded: false,
        children: n.children ? collapse(n.children) : n.children
      }))
    }
    setTree((prev) => collapse(prev))
  }, [])

  const deleteNode = useCallback(async (node: TreeNode): Promise<DeleteNodeResult> => {
    const result = await window.api.fs.delete(node.path)
    if (!result.ok || !result.data) return { ok: false }

    setTree((prev) => removeNodeFromTree(prev, node.path))

    const sep = node.path.includes('\\') ? '\\' : '/'
    const parentPath = node.path.slice(0, node.path.lastIndexOf(sep)) || sep

    return {
      ok: true,
      undo: {
        undoId: result.data.undoId,
        path: node.path,
        parentPath,
        name: node.name,
        type: node.type,
      },
    }
  }, [])

  const undoDelete = useCallback(async (entry: DeletedNodeUndo): Promise<boolean> => {
    const result = await window.api.fs.undoDelete(entry.undoId)
    if (!result.ok) return false
    await watchRefresh(entry.parentPath)
    return true
  }, [watchRefresh])

  return { tree, loadRoot, toggleExpand, collapseAll, peekDir, refresh, watchRefresh, createFile, createDir, rename, deleteNode, undoDelete }
}
