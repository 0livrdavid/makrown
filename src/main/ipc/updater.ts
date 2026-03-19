import { ipcMain, BrowserWindow, app, session, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import type { UpdateInfo } from 'builder-util-runtime'
import type {
  UpdaterAvailableInfo,
  UpdaterDownloadedInfo,
  UpdaterErrorInfo,
  UpdaterProgressInfo,
} from '../../shared/types'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let currentWindow: BrowserWindow | null = null
let updaterRegistered = false
let latestUpdateInfo: UpdateInfo | null = null
let downloadedInstallerPath: string | null = null

const RELEASE_OWNER = '0livrdavid'
const RELEASE_REPO = 'makrown'

function resolveMacInstallerDownload(updateInfo: UpdateInfo): { assetUrl: string; fileName: string } {
  const dmgFile = updateInfo.files.find((file) => file.url.toLowerCase().endsWith('.dmg'))
  if (!dmgFile) {
    throw new Error('Nenhum instalador .dmg foi encontrado para esta atualização.')
  }

  const fileName = dmgFile.url.split('/').pop() ?? dmgFile.url
  const assetUrl = /^https?:\/\//i.test(dmgFile.url)
    ? dmgFile.url
    : `https://github.com/${RELEASE_OWNER}/${RELEASE_REPO}/releases/download/v${updateInfo.version}/${fileName}`

  return { assetUrl, fileName }
}

function downloadMacInstaller(send: (channel: string, payload?: unknown) => void): Promise<void> {
  if (!latestUpdateInfo) {
    throw new Error('Nenhuma atualização disponível para baixar no momento.')
  }

  const { assetUrl, fileName } = resolveMacInstallerDownload(latestUpdateInfo)
  const savePath = join(app.getPath('downloads'), fileName)

  return new Promise((resolve, reject) => {
    const handler = (_event: Electron.Event, item: Electron.DownloadItem): void => {
      item.setSavePath(savePath)

      item.on('updated', () => {
        const payload: UpdaterProgressInfo = {
          percent: Math.max(0, Math.round(item.getPercentComplete())),
          bytesPerSecond: item.getCurrentBytesPerSecond(),
          transferredBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
        }
        send('updater:progress', payload)
      })

      item.once('done', (_doneEvent, state) => {
        if (state === 'completed') {
          downloadedInstallerPath = savePath
          shell.showItemInFolder(savePath)
          const payload: UpdaterDownloadedInfo = {
            filePath: savePath,
            action: 'reveal',
          }
          send('updater:downloaded', payload)
          resolve()
          return
        }

        reject(new Error(`O download do instalador foi encerrado com estado "${state}".`))
      })
    }

    session.defaultSession.once('will-download', handler)

    try {
      session.defaultSession.downloadURL(assetUrl)
    } catch (error) {
      session.defaultSession.removeListener('will-download', handler)
      reject(error)
    }
  })
}

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
      latestUpdateInfo = info
      downloadedInstallerPath = null
      const payload: UpdaterAvailableInfo = {
        version: info.version,
        releaseNotes: info.releaseNotes ?? null,
      }
      send('updater:available', payload)
    })

    autoUpdater.on('update-not-available', () => {
      latestUpdateInfo = null
      downloadedInstallerPath = null
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

    autoUpdater.on('update-downloaded', (event) => {
      downloadedInstallerPath = event.downloadedFile
      const payload: UpdaterDownloadedInfo = {
        filePath: event.downloadedFile ?? null,
        action: 'install',
      }
      send('updater:downloaded', payload)
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
        if (process.platform === 'darwin') {
          await downloadMacInstaller(send)
          return
        }
        await autoUpdater.downloadUpdate()
      } catch (err) {
        const payload: UpdaterErrorInfo = { message: (err as Error).message }
        send('updater:error', payload)
      }
    })

    ipcMain.handle('updater:install', () => {
      if (process.platform === 'darwin') {
        if (downloadedInstallerPath) {
          shell.showItemInFolder(downloadedInstallerPath)
          return
        }
        const payload: UpdaterErrorInfo = {
          message: 'Nenhum instalador baixado foi encontrado para abrir no Finder.',
        }
        send('updater:error', payload)
        return
      }
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
