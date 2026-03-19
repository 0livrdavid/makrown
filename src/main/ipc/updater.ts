import { ipcMain, BrowserWindow, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdaterAvailableInfo, UpdaterErrorInfo, UpdaterProgressInfo } from '../../shared/types'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let currentWindow: BrowserWindow | null = null
let updaterRegistered = false

export function registerUpdaterHandlers(mainWindow: BrowserWindow): void {
  currentWindow = mainWindow

  const send = (channel: string, payload?: unknown): void => {
    if (currentWindow && !currentWindow.isDestroyed()) {
      currentWindow.webContents.send(channel, payload)
    }
  }

  if (!updaterRegistered) {
    updaterRegistered = true

    autoUpdater.on('checking-for-update', () => {
      send('updater:checking')
    })

    autoUpdater.on('update-available', (info) => {
      const payload: UpdaterAvailableInfo = {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
      }
      send('updater:available', payload)
    })

    autoUpdater.on('update-not-available', () => {
      send('updater:not-available')
    })

    autoUpdater.on('download-progress', (progress) => {
      const payload: UpdaterProgressInfo = {
        percent: Math.round(progress.percent),
        bytesPerSecond: Math.round(progress.bytesPerSecond),
        transferredBytes: progress.transferred,
        totalBytes: progress.total,
      }
      send('updater:progress', payload)
    })

    autoUpdater.on('update-downloaded', () => {
      send('updater:downloaded')
    })

    autoUpdater.on('error', (err) => {
      const payload: UpdaterErrorInfo = { message: err.message }
      send('updater:error', payload)
    })

    ipcMain.handle('updater:check', async () => {
      if (!app.isPackaged) {
        send('updater:not-available')
        return
      }
      try {
        await autoUpdater.checkForUpdates()
      } catch (err) {
        const payload: UpdaterErrorInfo = { message: (err as Error).message }
        send('updater:error', payload)
      }
    })

    ipcMain.handle('updater:download', async () => {
      try {
        await autoUpdater.downloadUpdate()
      } catch (err) {
        const payload: UpdaterErrorInfo = { message: (err as Error).message }
        send('updater:error', payload)
      }
    })

    ipcMain.handle('updater:install', () => {
      autoUpdater.quitAndInstall()
    })
  }

  // Auto-check on startup (packaged builds only)
  if (app.isPackaged) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          await autoUpdater.checkForUpdates()
        } catch {
          // silent — don't bother the user on startup
        }
      }, 5000)
    })
  }
}
