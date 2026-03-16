import { useEffect, useRef, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import type { SearchFileResult } from '../../../../shared/types'

interface FileSearchModalProps {
  rootPath: string
  onOpen: (file: SearchFileResult) => void
  onClose: () => void
}

export function FileSearchModal({ rootPath, onOpen, onClose }: FileSearchModalProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchFileResult[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setSelected(0)
      return
    }

    debounceRef.current = setTimeout(async () => {
      const result = await window.api.fs.searchFiles(rootPath, query.trim())
      if (result.ok && result.data) {
        setResults(result.data)
        setSelected(0)
      }
    }, 150)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, rootPath])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((s) => Math.min(s + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter' && results[selected]) {
      onOpen(results[selected])
      onClose()
    }
  }

  const sep = window.api.platform === 'win32' ? '\\' : '/'
  const rootName = rootPath.split(sep).pop() ?? rootPath

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          <Search size={15} className="shrink-0 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar arquivo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <span className="shrink-0 text-xs text-zinc-600">{rootName}</span>
        </div>

        {/* Resultados */}
        {results.length > 0 && (
          <ul className="max-h-72 overflow-y-auto py-1">
            {results.map((file, i) => {
              const relativePath = file.path.startsWith(rootPath)
                ? file.path.slice(rootPath.length + 1)
                : file.path
              return (
                <li
                  key={file.path}
                  className={`flex cursor-pointer items-center gap-3 px-4 py-2 transition-colors ${
                    i === selected ? 'bg-zinc-800' : 'hover:bg-zinc-800/60'
                  }`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => { onOpen(file); onClose() }}
                >
                  <FileText size={13} className="shrink-0 text-zinc-500" />
                  <div className="min-w-0">
                    <span className={`text-sm font-medium ${i === selected ? 'text-indigo-400' : 'text-zinc-200'}`}>
                      {file.name}
                    </span>
                    <p className="truncate text-xs text-zinc-600">{relativePath}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {query.trim() && results.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-600">Nenhum arquivo encontrado</p>
        )}

        {/* Dica */}
        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-600">
          <span><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono">↵</kbd> abrir</span>
          <span><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
