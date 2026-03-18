import { ipcMain, dialog, BrowserWindow } from 'electron'
import fsp from 'fs/promises'
import { watch as fsWatch } from 'fs'
import type { Dirent, FSWatcher } from 'fs'
import path from 'path'
import type { DeleteUndoInfo, FileSystemResult, IFileSystem, SearchFileResult, SearchContentResult } from '../../shared/types'
import { LocalFileSystem } from '../filesystem'

// Active filesystem — swapped to RemoteFileSystem on SSH connect
let activeFs: IFileSystem = new LocalFileSystem()
let activeFsKind: 'local' | 'remote' = 'local'

export function setActiveFs(fs: IFileSystem): void {
  activeFs = fs
  activeFsKind = fs instanceof LocalFileSystem ? 'local' : 'remote'
}

export function getActiveFs(): IFileSystem {
  return activeFs
}

// Filesystem watcher state (module-level, one watcher at a time)
let activeWatcher: FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let deletedEntries: Array<{ undoId: string; originalPath: string; trashPath: string; kind: 'local' | 'remote' }> = []

const IGNORED_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', '__pycache__', '.venv', 'vendor'])
const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB
const MAX_RESULTS = 100

function pathApiFor(targetPath: string): typeof path.posix | typeof path.win32 {
  return targetPath.includes('\\') ? path.win32 : path.posix
}

function buildTrashPath(targetPath: string, undoId: string): string {
  const pathApi = pathApiFor(targetPath)
  const parentDir = pathApi.dirname(targetPath)
  const baseName = pathApi.basename(targetPath)
  return pathApi.join(parentDir, `.${baseName}.makrown-trash-${undoId}`)
}

async function purgeDeletedEntries(): Promise<void> {
  const pending = deletedEntries
  deletedEntries = []

  await Promise.all(pending.map(async (entry) => {
    try {
      const fs = entry.kind === 'local' ? new LocalFileSystem() : activeFs
      await fs.delete(entry.trashPath)
    } catch {
      // Ignore purge failures. At this stage the file is already logically deleted.
    }
  }))
}

export async function cleanupFilesystemSession(): Promise<void> {
  await purgeDeletedEntries()
}

async function walkMdFiles(dirPath: string, results: SearchFileResult[]): Promise<void> {
  let entries: Dirent<string>[]
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

  ipcMain.handle('fs:stat', async (_event, targetPath: string) => {
    return activeFs.stat(targetPath)
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
    const undoId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const trashPath = buildTrashPath(targetPath, undoId)
    const renamed = await activeFs.rename(targetPath, trashPath)
    if (!renamed.ok) return renamed

    deletedEntries = [{ undoId, originalPath: targetPath, trashPath, kind: activeFsKind }, ...deletedEntries]
    const data: DeleteUndoInfo = { undoId }
    return { ok: true, data } satisfies FileSystemResult<DeleteUndoInfo>
  })

  ipcMain.handle('fs:undoDelete', async (_event, undoId: string) => {
    const entry = deletedEntries.find((item) => item.undoId === undoId)
    if (!entry) return { ok: false, error: 'Delete não pode mais ser desfeito.' }

    const fs = entry.kind === 'local' ? new LocalFileSystem() : activeFs
    const restored = await fs.rename(entry.trashPath, entry.originalPath)
    if (restored.ok) {
      deletedEntries = deletedEntries.filter((item) => item.undoId !== undoId)
    }
    return restored
  })

  ipcMain.handle('fs:clearDeleteUndo', async () => {
    await purgeDeletedEntries()
    return { ok: true }
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
          if (!win.isDestroyed()) {
            win.webContents.send('fs:changed', parentDir)
            win.webContents.send('fs:file-changed', changedPath)
          }
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
