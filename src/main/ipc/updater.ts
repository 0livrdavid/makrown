import { ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export function registerUpdaterHandlers(mainWindow: BrowserWindow): void {
  const send = (channel: string, payload?: unknown): void => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, payload)
    }
  }

  autoUpdater.on('checking-for-update', () => {
    send('updater:checking')
  })

  autoUpdater.on('update-available', (info) => {
    send('updater:available', { version: info.version, releaseNotes: info.releaseNotes ?? null })
  })

  autoUpdater.on('update-not-available', () => {
    send('updater:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    send('updater:progress', { percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', () => {
    send('updater:downloaded')
  })

  autoUpdater.on('error', (err) => {
    send('updater:error', { message: err.message })
  })

  ipcMain.handle('updater:check', async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      send('updater:error', { message: (err as Error).message })
    }
  })

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
    } catch (err) {
      send('updater:error', { message: (err as Error).message })
    }
  })

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })
}
