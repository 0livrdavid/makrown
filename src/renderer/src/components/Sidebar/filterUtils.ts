import type { TreeNode } from '../../hooks/useFileTree'

export interface FilterConfig {
  onlyMarkdown: boolean
  hideEmptyFolders: boolean
  customIgnore: string
  hideHiddenFiles: boolean
}

export const DEFAULT_FILTER: FilterConfig = {
  onlyMarkdown: true,
  hideEmptyFolders: false,
  customIgnore: '',
  hideHiddenFiles: true
}

function parsePatterns(raw: string): string[] {
  return raw.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
}

function matchesPattern(name: string, pattern: string): boolean {
  if (!pattern.includes('*')) return name === pattern
  const escaped = pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp('^' + escaped.join('.*') + '$').test(name)
}

export function shouldShowNode(node: TreeNode, config: FilterConfig): boolean {
  if (config.hideHiddenFiles && node.name.startsWith('.')) return false

  const patterns = parsePatterns(config.customIgnore)
  for (const pattern of patterns) {
    if (matchesPattern(node.name, pattern)) return false
  }

  if (config.onlyMarkdown && node.type === 'file' && node.extension !== '.md') return false

  if (config.hideEmptyFolders && node.type === 'directory' && Array.isArray(node.children)) {
    const visible = node.children.filter((c) => shouldShowNode(c, config)).length
    if (visible === 0) return false
  }

  return true
}
