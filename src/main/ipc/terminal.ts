import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import * as nodePty from 'node-pty'
import { getActiveClient } from './ssh'

interface TermSession {
  sessionId: string
  pty?: nodePty.IPty
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channel?: any // ssh2 ClientChannel
  closed?: boolean
}

const sessions = new Map<string, TermSession>()

function send(event: string, terminalId: string, sessionId: string, payload: unknown): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send(event, terminalId, sessionId, payload)
  }
}

function defaultShell(): string {
  return process.env.SHELL ?? (process.platform === 'win32' ? 'cmd.exe' : '/bin/zsh')
}

function isCurrentSession(terminalId: string, sessionId: string): boolean {
  const current = sessions.get(terminalId)
  return current?.sessionId === sessionId && !current.closed
}

function disposeSession(session: TermSession): void {
  session.closed = true
  try {
    if (session.pty) session.pty.kill()
    else if (session.channel) session.channel.end()
  } catch { /* ignore */ }
}

export function registerTerminalHandlers(): void {
  // term:create — spawn local PTY or open SSH shell channel
  ipcMain.handle(
    'term:create',
    (
      _event,
      opts: { terminalId: string; sessionId: string; cwd: string; cols: number; rows: number; mode: 'local' | 'vps' }
    ) => {
      const { terminalId, sessionId, cwd, cols, rows, mode } = opts
      const nextSessionId = sessionId || randomUUID()

      const previous = sessions.get(terminalId)
      if (previous && previous.sessionId !== nextSessionId) {
        disposeSession(previous)
      }

      const session: TermSession = { sessionId: nextSessionId }
      sessions.set(terminalId, session)

      if (mode === 'vps') {
        const client = getActiveClient()
        if (!client) {
          sessions.delete(terminalId)
          return { ok: false, error: 'No SSH connection' }
        }

        client.shell({ term: 'xterm-256color', cols, rows }, (err, channel) => {
          if (!isCurrentSession(terminalId, nextSessionId)) {
            try {
              channel?.end()
            } catch { /* ignore */ }
            return
          }

          if (err) {
            sessions.delete(terminalId)
            send('term:exit', terminalId, nextSessionId, 1)
            return
          }

          session.channel = channel

          channel.on('data', (data: Buffer) => {
            if (isCurrentSession(terminalId, nextSessionId)) {
              send('term:output', terminalId, nextSessionId, data.toString())
            }
          })
          channel.on('close', () => {
            if (isCurrentSession(terminalId, nextSessionId)) {
              sessions.delete(terminalId)
              send('term:exit', terminalId, nextSessionId, 0)
            }
          })
        })
        return { ok: true }
      }

      // local PTY
      try {
        const pty = nodePty.spawn(defaultShell(), [], {
          name: 'xterm-256color',
          cols,
          rows,
          cwd: cwd || process.env.HOME || process.cwd(),
          env: process.env as Record<string, string>,
        })

        session.pty = pty

        pty.onData((data) => {
          if (isCurrentSession(terminalId, nextSessionId)) {
            send('term:output', terminalId, nextSessionId, data)
          }
        })
        pty.onExit(({ exitCode }) => {
          if (isCurrentSession(terminalId, nextSessionId)) {
            sessions.delete(terminalId)
            send('term:exit', terminalId, nextSessionId, exitCode)
          }
        })
        return { ok: true }
      } catch (err) {
        if (isCurrentSession(terminalId, nextSessionId)) {
          sessions.delete(terminalId)
        }
        return { ok: false, error: (err as Error).message }
      }
    }
  )

  // term:input — write data to session
  ipcMain.on('term:input', (_event, terminalId: string, sessionId: string, data: string) => {
    const session = sessions.get(terminalId)
    if (!session || session.sessionId !== sessionId || session.closed) return
    if (session.pty) session.pty.write(data)
    else if (session.channel) session.channel.write(data)
  })

  // term:resize — resize PTY or SSH channel
  ipcMain.on('term:resize', (_event, terminalId: string, sessionId: string, cols: number, rows: number) => {
    const session = sessions.get(terminalId)
    if (!session || session.sessionId !== sessionId || session.closed) return
    if (session.pty) session.pty.resize(cols, rows)
    else if (session.channel) session.channel.setWindow(rows, cols, 0, 0)
  })

  // term:close — kill session
  ipcMain.handle('term:close', (_event, terminalId: string, sessionId: string) => {
    const session = sessions.get(terminalId)
    if (!session || session.sessionId !== sessionId) return
    disposeSession(session)
    sessions.delete(terminalId)
  })
}

export function cleanupTerminalSessions(): void {
  for (const [, session] of sessions) {
    disposeSession(session)
  }
  sessions.clear()
}
