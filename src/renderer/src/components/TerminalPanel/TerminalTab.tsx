import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalTabProps {
  terminalId: string
  cwd: string
  mode: 'local' | 'vps'
  isActive: boolean
  onExit?: (code: number) => void
}

export function TerminalTab({ terminalId, cwd, mode, isActive, onExit }: TerminalTabProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Single effect: create terminal, connect PTY, wire resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const sessionId = crypto.randomUUID()
    sessionIdRef.current = sessionId

    const term = new Terminal({
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#a1a1aa',
        selectionBackground: '#3f3f46',
        black: '#18181b', red: '#ef4444', green: '#22c55e',
        yellow: '#eab308', blue: '#3b82f6', magenta: '#a855f7',
        cyan: '#06b6d4', white: '#d4d4d8',
        brightBlack: '#3f3f46', brightRed: '#f87171', brightGreen: '#4ade80',
        brightYellow: '#facc15', brightBlue: '#60a5fa', brightMagenta: '#c084fc',
        brightCyan: '#22d3ee', brightWhite: '#f4f4f5',
      },
      fontFamily: 'ui-monospace, "Cascadia Code", "Fira Mono", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      allowTransparency: false,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    termRef.current = term
    fitAddonRef.current = fitAddon

    term.open(container)

    requestAnimationFrame(() => {
      if (container.offsetHeight > 0) fitAddon.fit()
      term.focus()
    })

    // Subscribe before create so no early output/exit event is lost.
    const unsubOutput = window.api.terminal.onOutput(terminalId, sessionId, (data) => {
      term.write(data)
    })

    const unsubExit = window.api.terminal.onExit(terminalId, sessionId, (code) => {
      term.write(`\r\n\x1b[90m[processo encerrado com código ${code}]\x1b[0m\r\n`)
      onExit?.(code)
    })

    // Wire keyboard input → PTY
    const dataDisposable = term.onData((data) => {
      window.api.terminal.input(terminalId, sessionId, data)
    })

    // Create PTY after terminal is ready
    const cols = term.cols || 80
    const rows = term.rows || 24
    window.api.terminal.create({ terminalId, sessionId, cwd, cols, rows, mode }).then((result) => {
      if (!result.ok) {
        term.write(`\r\n\x1b[31mErro: ${result.error}\x1b[0m\r\n`)
      }
    })

    // Resize observer
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (container.offsetHeight > 0) {
          fitAddon.fit()
          window.api.terminal.resize(terminalId, sessionId, term.cols, term.rows)
        }
      })
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      dataDisposable.dispose()
      unsubOutput()
      unsubExit()
      window.api.terminal.close(terminalId, sessionId)
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
      sessionIdRef.current = null
    }
  }, [terminalId, cwd, mode])

  // Re-fit and focus when tab becomes active
  useEffect(() => {
    if (!isActive) return
    requestAnimationFrame(() => {
      const fitAddon = fitAddonRef.current
      const term = termRef.current
      const sessionId = sessionIdRef.current
      if (fitAddon && containerRef.current && containerRef.current.offsetHeight > 0) {
        fitAddon.fit()
        if (term && sessionId) window.api.terminal.resize(terminalId, sessionId, term.cols, term.rows)
      }
      term?.focus()
    })
  }, [isActive, terminalId])

  return (
    <div
      ref={containerRef}
      style={{ display: isActive ? 'block' : 'none' }}
      className="h-full w-full overflow-hidden px-1 pt-1"
      onClick={() => termRef.current?.focus()}
    />
  )
}
