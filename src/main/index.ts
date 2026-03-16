import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { registerFilesystemHandlers } from './ipc/filesystem'
import { registerPreferencesHandlers } from './ipc/preferences'
import { registerSSHHandlers } from './ipc/ssh'
import { buildMenu } from './menu'
import { store } from './store'

app.name = 'Makrown'

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

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerFilesystemHandlers()
  registerSSHHandlers()
  registerPreferencesHandlers()

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
