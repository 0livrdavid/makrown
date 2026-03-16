import { useEffect, useRef, useState } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { highlightActiveLineGutter } from '@codemirror/view'

interface UseCodeMirrorOptions {
  initialValue: string
  onChange: (value: string) => void
}

export function useCodeMirror({ initialValue, onChange }: UseCodeMirrorOptions) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          oneDark,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChange(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '14px' },
            '.cm-scroller': { fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace", overflow: 'auto' },
            '.cm-content': { padding: '12px 0' },
            '.cm-gutters': { borderRight: '1px solid #2a2a2a' }
          })
        ]
      }),
      parent: containerRef.current
    })

    viewRef.current = view
    setIsReady(true)

    return () => {
      view.destroy()
      viewRef.current = null
      setIsReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Atualiza o conteúdo quando o arquivo muda (initialValue vindo de fora)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== initialValue) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: initialValue }
      })
    }
  }, [initialValue])

  return { containerRef, isReady }
}
