import { ipcMain, dialog, BrowserWindow } from 'electron'
import fsp from 'fs/promises'
import { watch as fsWatch } from 'fs'
import type { FSWatcher } from 'fs'
import path from 'path'
import type { IFileSystem, SearchFileResult, SearchContentResult } from '../../shared/types'
import { LocalFileSystem } from '../filesystem'

// Active filesystem — swapped to RemoteFileSystem on SSH connect
let activeFs: IFileSystem = new LocalFileSystem()

export function setActiveFs(fs: IFileSystem): void {
  activeFs = fs
}

export function getActiveFs(): IFileSystem {
  return activeFs
}

// Filesystem watcher state (module-level, one watcher at a time)
let activeWatcher: FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.venv', 'vendor'])
const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB
const MAX_RESULTS = 100

async function walkMdFiles(dirPath: string, results: SearchFileResult[]): Promise<void> {
  let entries: Awaited<ReturnType<typeof fsp.readdir>>
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await walkMdFiles(path.join(dirPath, entry.name), results)
      }
    } else if (entry.name.endsWith('.md')) {
      results.push({ name: entry.name, path: path.join(dirPath, entry.name) })
    }
  }
}

export function registerFilesystemHandlers(): void {
  // Abre dialog nativo para selecionar pasta
  ipcMain.handle('fs:selectFolder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { ok: false, error: 'No window focused' }

    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: 'canceled' }
    }

    return { ok: true, data: result.filePaths[0] }
  })

  ipcMain.handle('fs:listDir', async (_event, dirPath: string) => {
    return activeFs.listDir(dirPath)
  })

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return activeFs.readFile(filePath)
  })

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
    return activeFs.writeFile(filePath, content)
  })

  ipcMain.handle('fs:createFile', async (_event, filePath: string) => {
    return activeFs.createFile(filePath)
  })

  ipcMain.handle('fs:createDir', async (_event, dirPath: string) => {
    return activeFs.createDir(dirPath)
  })

  ipcMain.handle('fs:rename', async (_event, oldPath: string, newPath: string) => {
    return activeFs.rename(oldPath, newPath)
  })

  ipcMain.handle('fs:delete', async (_event, targetPath: string) => {
    return activeFs.delete(targetPath)
  })

  ipcMain.handle('fs:searchFiles', async (_event, rootPath: string, query: string) => {
    try {
      const allFiles: SearchFileResult[] = []
      await walkMdFiles(rootPath, allFiles)
      const lower = query.toLowerCase()
      const matches = allFiles.filter((f) => f.name.toLowerCase().includes(lower))
      return { ok: true, data: matches.slice(0, MAX_RESULTS) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:searchContent', async (_event, rootPath: string, query: string) => {
    try {
      const allFiles: SearchFileResult[] = []
      await walkMdFiles(rootPath, allFiles)
      const lower = query.toLowerCase()
      const results: SearchContentResult[] = []

      for (const file of allFiles) {
        if (results.length >= MAX_RESULTS) break
        let stat: Awaited<ReturnType<typeof fsp.stat>>
        try { stat = await fsp.stat(file.path) } catch { continue }
        if (stat.size > MAX_FILE_SIZE) continue

        const content = await fsp.readFile(file.path, 'utf-8').catch(() => null)
        if (!content) continue

        const lines = content.split('\n')
        for (let i = 0; i < lines.length && results.length < MAX_RESULTS; i++) {
          if (lines[i].toLowerCase().includes(lower)) {
            const start = Math.max(0, i - 1)
            const end = Math.min(lines.length - 1, i + 1)
            const excerpt = lines.slice(start, end + 1).join('\n').trim()
            results.push({ name: file.name, path: file.path, excerpt, lineNumber: i + 1 })
          }
        }
      }

      return { ok: true, data: results }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  // Watch a folder for changes and push fs:changed events to the renderer
  ipcMain.handle('fs:watch', (_event, rootPath: string) => {
    // Tear down previous watcher
    if (activeWatcher) { activeWatcher.close(); activeWatcher = null }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }

    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { ok: false, error: 'No window focused' }

    try {
      activeWatcher = fsWatch(rootPath, { recursive: true }, (_eventType, filename) => {
        if (!filename) return
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const changedPath = path.join(rootPath, filename as string)
          const parentDir = path.dirname(changedPath)
          if (!win.isDestroyed()) win.webContents.send('fs:changed', parentDir)
        }, 300)
      })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('fs:unwatch', () => {
    if (activeWatcher) { activeWatcher.close(); activeWatcher = null }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
    return { ok: true }
  })
}
