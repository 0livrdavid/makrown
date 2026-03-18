import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync } from 'fs'
import { cleanupFilesystemSession, registerFilesystemHandlers } from './ipc/filesystem'
import { registerPreferencesHandlers } from './ipc/preferences'
import { registerSSHHandlers } from './ipc/ssh'
import { registerUpdaterHandlers } from './ipc/updater'
import { registerCredentialsHandlers } from './ipc/credentials'
import { registerTerminalHandlers, cleanupTerminalSessions } from './ipc/terminal'
import { buildMenu } from './menu'
import { store } from './store'

app.name = 'Makrown'

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.bmp': 'image/bmp',
}

function mimeFromExt(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return MIME_MAP[ext] ?? 'application/octet-stream'
}

const isDev = !app.isPackaged

function createWindow(): void {
  const savedState = store.get('windowState')

  const mainWindow = new BrowserWindow({
    width: savedState.width,
    height: savedState.height,
    x: savedState.x,
    y: savedState.y,
    minWidth: 800,
    minHeight: 600,
    title: 'Makrown',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 10 },
    backgroundColor: '#09090b',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (savedState.isFullScreen) {
    mainWindow.setFullScreen(true)
  } else if (savedState.isMaximized) {
    mainWindow.maximize()
  }

  // Salva apenas os bounds quando a janela está em modo normal (não maximizada/fullscreen)
  const saveBounds = (): void => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      const bounds = mainWindow.getBounds()
      store.set('windowState', {
        ...store.get('windowState'),
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y
      })
    }
  }

  mainWindow.on('resize', saveBounds)
  mainWindow.on('move', saveBounds)

  mainWindow.on('close', () => {
    store.set('windowState', {
      ...mainWindow.getBounds(),
      isMaximized: mainWindow.isMaximized(),
      isFullScreen: mainWindow.isFullScreen()
    })
  })

  buildMenu(mainWindow)
  registerUpdaterHandlers(mainWindow)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.on('app:version', (event) => { event.returnValue = app.getVersion() })

// Register custom protocol to serve local files (images, etc.) in the renderer.
// Usage in renderer: makrown-file:///absolute/path/to/image.png
protocol.registerSchemesAsPrivileged([
  { scheme: 'makrown-file', privileges: { standard: false, secure: true, supportFetchAPI: true } }
])

app.whenReady().then(() => {
  protocol.handle('makrown-file', (request) => {
    const absPath = decodeURIComponent(request.url.slice('makrown-file://'.length))
    try {
      const data = readFileSync(absPath)
      return new Response(data, {
        headers: { 'Content-Type': mimeFromExt(absPath) }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  registerFilesystemHandlers()
  registerSSHHandlers()
  registerPreferencesHandlers()
  registerCredentialsHandlers()
  registerTerminalHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  void cleanupFilesystemSession()
  cleanupTerminalSessions()
})
