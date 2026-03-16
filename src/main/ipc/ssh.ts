import { ipcMain, BrowserWindow } from 'electron'
import type { Client } from 'ssh2'
import { createRemoteFileSystem } from '../filesystem'
import { setActiveFs } from './filesystem'
import { LocalFileSystem } from '../filesystem'
import type { SSHConfig } from '../../shared/types'

// Active SSH client — kept to allow explicit disconnect
let activeClient: Client | null = null

// Last successful config — used for auto-reconnect
let lastConfig: SSHConfig | null = null

export type SSHStatus = 'disconnected' | 'connected' | 'reconnecting'

export function getSshStatus(): SSHStatus {
  return activeClient ? 'connected' : 'disconnected'
}

function emitStatus(status: SSHStatus, extra?: Record<string, unknown>): void {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send('ssh:status-changed', { status, ...extra })
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [2000, 5000, 10000]

async function attemptReconnect(config: SSHConfig, attempt: number): Promise<void> {
  emitStatus('reconnecting', { attempt })
  await delay(RETRY_DELAYS[attempt] ?? 10000)

  // If user already disconnected manually, abort
  if (lastConfig === null) return

  try {
    const { fs, client } = await createRemoteFileSystem(config)
    activeClient = client
    lastConfig = config
    setActiveFs(fs)
    setupClientListeners(client, config)
    emitStatus('connected')
  } catch {
    if (attempt < MAX_RETRIES - 1) {
      attemptReconnect(config, attempt + 1)
    } else {
      activeClient = null
      lastConfig = null
      setActiveFs(new LocalFileSystem())
      emitStatus('disconnected')
    }
  }
}

function setupClientListeners(client: Client, config: SSHConfig): void {
  client.on('end', () => {
    if (activeClient !== client) return
    activeClient = null
    if (lastConfig) {
      attemptReconnect(config, 0)
    } else {
      setActiveFs(new LocalFileSystem())
      emitStatus('disconnected')
    }
  })

  client.on('error', () => {
    if (activeClient !== client) return
    activeClient = null
    if (lastConfig) {
      attemptReconnect(config, 0)
    } else {
      setActiveFs(new LocalFileSystem())
      emitStatus('disconnected')
    }
  })
}

export function registerSSHHandlers(): void {
  // ssh:connect — attempts SSH + SFTP, swaps activeFs on success
  ipcMain.handle('ssh:connect', async (_event, config: SSHConfig) => {
    // Disconnect any existing session first
    if (activeClient) {
      try { activeClient.end() } catch { /* ignore */ }
      activeClient = null
    }
    lastConfig = null

    try {
      const { fs, client } = await createRemoteFileSystem(config)
      activeClient = client
      lastConfig = config
      setActiveFs(fs)
      setupClientListeners(client, config)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // ssh:disconnect — closes session and reverts to LocalFileSystem
  ipcMain.handle('ssh:disconnect', () => {
    lastConfig = null  // prevent auto-reconnect
    if (activeClient) {
      try { activeClient.end() } catch { /* ignore */ }
      activeClient = null
    }
    setActiveFs(new LocalFileSystem())
    return { ok: true }
  })

  // ssh:status — tells the renderer whether a remote session is active
  ipcMain.handle('ssh:status', () => {
    return { ok: true, data: getSshStatus() }
  })
}
