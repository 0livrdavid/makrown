import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type {
  DeleteUndoInfo,
  FileSystemResult,
  FileEntry,
  FileStatInfo,
  SearchFileResult,
  SearchContentResult,
  SSHProfileSummary,
  SSHConfig,
  UpdaterAvailableInfo,
  UpdaterProgressInfo,
  UpdaterErrorInfo,
} from '../shared/types'

const api = {
  platform: process.platform,
  appVersion: ipcRenderer.sendSync('app:version') as string,

  fs: {
    selectFolder: (): Promise<FileSystemResult<string>> =>
      ipcRenderer.invoke('fs:selectFolder'),

    listDir: (dirPath: string): Promise<FileSystemResult<FileEntry[]>> =>
      ipcRenderer.invoke('fs:listDir', dirPath),

    stat: (targetPath: string): Promise<FileSystemResult<FileStatInfo>> =>
      ipcRenderer.invoke('fs:stat', targetPath),

    readFile: (filePath: string): Promise<FileSystemResult<string>> =>
      ipcRenderer.invoke('fs:readFile', filePath),

    writeFile: (filePath: string, content: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),

    createFile: (filePath: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:createFile', filePath),

    createDir: (dirPath: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:createDir', dirPath),

    rename: (oldPath: string, newPath: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath),

    delete: (targetPath: string): Promise<FileSystemResult<DeleteUndoInfo>> =>
      ipcRenderer.invoke('fs:delete', targetPath),

    undoDelete: (undoId: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:undoDelete', undoId),

    clearDeleteUndo: (): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:clearDeleteUndo'),

    searchFiles: (rootPath: string, query: string): Promise<FileSystemResult<SearchFileResult[]>> =>
      ipcRenderer.invoke('fs:searchFiles', rootPath, query),

    searchContent: (rootPath: string, query: string): Promise<FileSystemResult<SearchContentResult[]>> =>
      ipcRenderer.invoke('fs:searchContent', rootPath, query),

    watch: (rootPath: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:watch', rootPath),

    unwatch: (): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:unwatch'),

    onChanged: (callback: (dirPath: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, dirPath: string): void => callback(dirPath)
      ipcRenderer.on('fs:changed', handler)
      return () => ipcRenderer.removeListener('fs:changed', handler)
    },

    onFileChanged: (callback: (filePath: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, filePath: string): void => callback(filePath)
      ipcRenderer.on('fs:file-changed', handler)
      return () => ipcRenderer.removeListener('fs:file-changed', handler)
    }
  },

  ssh: {
    connect: (config: import('../shared/types').SSHConfig): Promise<import('../shared/types').FileSystemResult<void>> =>
      ipcRenderer.invoke('ssh:connect', config),

    disconnect: (): Promise<import('../shared/types').FileSystemResult<void>> =>
      ipcRenderer.invoke('ssh:disconnect'),

    status: (): Promise<import('../shared/types').FileSystemResult<'connected' | 'disconnected'>> =>
      ipcRenderer.invoke('ssh:status'),

    onStatusChange: (callback: (payload: { status: 'connected' | 'reconnecting' | 'disconnected' }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: { status: 'connected' | 'reconnecting' | 'disconnected' }): void => callback(payload)
      ipcRenderer.on('ssh:status-changed', handler)
      return () => ipcRenderer.removeListener('ssh:status-changed', handler)
    },
  },

  menu: {
    onAction: (callback: (action: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, action: string): void => callback(action)
      ipcRenderer.on('menu:action', handler)
      return () => ipcRenderer.removeListener('menu:action', handler)
    }
  },

  credentials: {
    list: (): Promise<SSHProfileSummary[]> =>
      ipcRenderer.invoke('credentials:list'),

    get: (id: string): Promise<SSHConfig | null> =>
      ipcRenderer.invoke('credentials:get', id),

    set: (config: SSHConfig): Promise<{ id: string }> =>
      ipcRenderer.invoke('credentials:set', config),

    save: (config: SSHConfig): Promise<{ id: string }> =>
      ipcRenderer.invoke('credentials:save', config),

    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('credentials:delete', id),
  },

  prefs: {
    get: <T>(key: string): Promise<T> => ipcRenderer.invoke('prefs:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('prefs:set', key, value)
  },

  zoom: {
    setFactor: (factor: number): void => webFrame.setZoomFactor(factor),
    getFactor: (): number => webFrame.getZoomFactor(),
  },

  terminal: {
    create: (opts: { terminalId: string; sessionId: string; cwd: string; cols: number; rows: number; mode: 'local' | 'vps' }): Promise<{ ok: boolean; error?: string }> =>
      ipcRenderer.invoke('term:create', opts),

    input: (terminalId: string, sessionId: string, data: string): void =>
      ipcRenderer.send('term:input', terminalId, sessionId, data),

    resize: (terminalId: string, sessionId: string, cols: number, rows: number): void =>
      ipcRenderer.send('term:resize', terminalId, sessionId, cols, rows),

    close: (terminalId: string, sessionId: string): Promise<void> =>
      ipcRenderer.invoke('term:close', terminalId, sessionId),

    onOutput: (terminalId: string, sessionId: string, callback: (data: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, eventSessionId: string, data: string): void => {
        if (id === terminalId && eventSessionId === sessionId) callback(data)
      }
      ipcRenderer.on('term:output', handler)
      return () => ipcRenderer.removeListener('term:output', handler)
    },

    onExit: (terminalId: string, sessionId: string, callback: (code: number) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, eventSessionId: string, code: number): void => {
        if (id === terminalId && eventSessionId === sessionId) callback(code)
      }
      ipcRenderer.on('term:exit', handler)
      return () => ipcRenderer.removeListener('term:exit', handler)
    },
  },

  updater: {
    check: (): Promise<void> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<void> => ipcRenderer.invoke('updater:download'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),

    onChecking: (cb: () => void): (() => void) => {
      const h = (): void => cb()
      ipcRenderer.on('updater:checking', h)
      return () => ipcRenderer.removeListener('updater:checking', h)
    },
    onAvailable: (cb: (info: UpdaterAvailableInfo) => void): (() => void) => {
      const h = (_e: Electron.IpcRendererEvent, info: UpdaterAvailableInfo): void => cb(info)
      ipcRenderer.on('updater:available', h)
      return () => ipcRenderer.removeListener('updater:available', h)
    },
    onNotAvailable: (cb: () => void): (() => void) => {
      const h = (): void => cb()
      ipcRenderer.on('updater:not-available', h)
      return () => ipcRenderer.removeListener('updater:not-available', h)
    },
    onProgress: (cb: (p: UpdaterProgressInfo) => void): (() => void) => {
      const h = (_e: Electron.IpcRendererEvent, p: UpdaterProgressInfo): void => cb(p)
      ipcRenderer.on('updater:progress', h)
      return () => ipcRenderer.removeListener('updater:progress', h)
    },
    onDownloaded: (cb: () => void): (() => void) => {
      const h = (): void => cb()
      ipcRenderer.on('updater:downloaded', h)
      return () => ipcRenderer.removeListener('updater:downloaded', h)
    },
    onError: (cb: (e: UpdaterErrorInfo) => void): (() => void) => {
      const h = (_e: Electron.IpcRendererEvent, err: UpdaterErrorInfo): void => cb(err)
      ipcRenderer.on('updater:error', h)
      return () => ipcRenderer.removeListener('updater:error', h)
    },
  }
}

contextBridge.exposeInMainWorld('api', api)

// Tipos exportados para uso no renderer via window.api
export type API = typeof api
