import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { FileSystemResult, FileEntry, SearchFileResult, SearchContentResult } from '../shared/types'

const api = {
  platform: process.platform,

  fs: {
    selectFolder: (): Promise<FileSystemResult<string>> =>
      ipcRenderer.invoke('fs:selectFolder'),

    listDir: (dirPath: string): Promise<FileSystemResult<FileEntry[]>> =>
      ipcRenderer.invoke('fs:listDir', dirPath),

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

    delete: (targetPath: string): Promise<FileSystemResult<void>> =>
      ipcRenderer.invoke('fs:delete', targetPath),

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

  prefs: {
    get: <T>(key: string): Promise<T> => ipcRenderer.invoke('prefs:get', key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke('prefs:set', key, value)
  },

  zoom: {
    setFactor: (factor: number): void => webFrame.setZoomFactor(factor),
    getFactor: (): number => webFrame.getZoomFactor(),
  }
}

contextBridge.exposeInMainWorld('api', api)

// Tipos exportados para uso no renderer via window.api
export type API = typeof api
