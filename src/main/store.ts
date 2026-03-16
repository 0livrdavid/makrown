import Store from 'electron-store'
import type { AppPreferences } from '../shared/types'

export const store = new Store<AppPreferences>({
  defaults: {
    lastOpenedFolder: null,
    windowState: {
      width: 1200,
      height: 800,
      isMaximized: false,
      isFullScreen: false
    },
    savedSSHConnections: []
  }
})
