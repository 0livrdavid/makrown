import { useEffect, useRef, useState } from 'react'
import { FileText, Search, Loader2 } from 'lucide-react'
import type { SearchContentResult } from '../../../../shared/types'

interface ContentSearchPanelProps {
  rootPath: string
  onOpen: (file: { name: string; path: string }) => void
  onClose: () => void
}

export function ContentSearchPanel({ rootPath, onOpen, onClose }: ContentSearchPanelProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchContentResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (query.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const result = await window.api.fs.searchContent(rootPath, query.trim())
      setLoading(false)
      if (result.ok && result.data) {
        setResults(result.data)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, rootPath])

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Escape') onClose()
  }

  function highlightExcerpt(excerpt: string, query: string): React.JSX.Element {
    const idx = excerpt.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return <>{excerpt}</>
    return (
      <>
        {excerpt.slice(0, idx)}
        <mark className="rounded bg-indigo-900/60 text-indigo-300 not-italic">{excerpt.slice(idx, idx + query.length)}</mark>
        {excerpt.slice(idx + query.length)}
      </>
    )
  }

  // Agrupa resultados por arquivo
  const grouped = results.reduce<Record<string, SearchContentResult[]>>((acc, r) => {
    if (!acc[r.path]) acc[r.path] = []
    acc[r.path].push(r)
    return acc
  }, {})

  const sep = window.api.platform === 'win32' ? '\\' : '/'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3">
          {loading
            ? <Loader2 size={15} className="shrink-0 animate-spin text-zinc-500" />
            : <Search size={15} className="shrink-0 text-zinc-500" />
          }
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar no conteúdo... (mín. 2 caracteres)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          {results.length > 0 && (
            <span className="shrink-0 text-xs text-zinc-600">{results.length} resultado{results.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Resultados agrupados por arquivo */}
        {Object.keys(grouped).length > 0 && (
          <ul className="max-h-96 overflow-y-auto py-1">
            {Object.entries(grouped).map(([filePath, matches]) => {
              const fileName = matches[0].name
              const relativePath = filePath.startsWith(rootPath)
                ? filePath.slice(rootPath.length + 1)
                : filePath
              return (
                <li key={filePath} className="mb-1">
                  {/* Cabeçalho do arquivo */}
                  <button
                    className="flex w-full items-center gap-2 px-4 py-1.5 text-left hover:bg-zinc-800/60"
                    onClick={() => { onOpen({ name: fileName, path: filePath }); onClose() }}
                  >
                    <FileText size={12} className="shrink-0 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-300">{fileName}</span>
                    <span className="truncate text-xs text-zinc-600">{relativePath.split(sep).slice(0, -1).join(sep)}</span>
                    <span className="ml-auto shrink-0 text-xs text-zinc-600">{matches.length} ocorrência{matches.length !== 1 ? 's' : ''}</span>
                  </button>
                  {/* Trechos */}
                  {matches.map((match, i) => (
                    <button
                      key={i}
                      className="flex w-full cursor-pointer items-start gap-3 px-4 py-1.5 text-left hover:bg-zinc-800/40"
                      onClick={() => { onOpen({ name: fileName, path: filePath }); onClose() }}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-xs text-zinc-600">{match.lineNumber}</span>
                      <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-xs text-zinc-400 leading-relaxed">
                        {highlightExcerpt(match.excerpt, query.trim())}
                      </pre>
                    </button>
                  ))}
                </li>
              )
            })}
          </ul>
        )}

        {query.trim().length >= 2 && !loading && results.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-zinc-600">Nenhum resultado encontrado</p>
        )}

        {query.trim().length < 2 && (
          <p className="px-4 py-4 text-center text-xs text-zinc-700">Digite ao menos 2 caracteres para buscar</p>
        )}

        {/* Dica */}
        <div className="flex items-center gap-4 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-600">
          <span><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono">↵</kbd> abrir arquivo</span>
          <span><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  )
}
