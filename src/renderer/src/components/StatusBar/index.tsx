import { useMemo } from 'react'
import { encode } from 'gpt-tokenizer'
import type { OpenTab } from '../Editor'

interface StatusBarProps {
  tab: OpenTab | null
  rootPath: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function StatusBar({ tab, rootPath }: StatusBarProps): React.JSX.Element {
  const stats = useMemo(() => {
    if (!tab) return null
    const text = tab.content.trim()
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0
    const chars = tab.content.length
    const bytes = new TextEncoder().encode(tab.content).length
    const tokens = encode(tab.content).length
    return { words, chars, bytes, tokens }
  }, [tab?.content]) // eslint-disable-line react-hooks/exhaustive-deps

  const relativePath = tab
    ? tab.path.startsWith(rootPath)
      ? tab.path.slice(rootPath.length + 1)
      : tab.path
    : null

  return (
    <div className="flex h-6 shrink-0 items-center justify-between border-t border-zinc-800/60 bg-zinc-950 px-4 text-[11px] text-zinc-600 select-none">
      <span className="truncate" title={tab?.path}>
        {relativePath ?? ''}
      </span>
      {stats && (
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <span>{stats.words} {stats.words === 1 ? 'palavra' : 'palavras'}</span>
          <span>{stats.chars} {stats.chars === 1 ? 'caractere' : 'caracteres'}</span>
          <span>{formatBytes(stats.bytes)}</span>
          <span>{stats.tokens.toLocaleString()} tokens</span>
        </div>
      )}
    </div>
  )
}
