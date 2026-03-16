import { ipcMain } from 'electron'
import { store } from '../store'

export function registerPreferencesHandlers(): void {
  ipcMain.handle('prefs:get', (_event, key: string) => {
    return store.get(key)
  })

  ipcMain.handle('prefs:set', (_event, key: string, value: unknown) => {
    store.set(key, value)
  })
}
