import { Menu, MenuItem, BrowserWindow, app } from 'electron'

function send(win: BrowserWindow, action: string): void {
  if (!win.isDestroyed()) win.webContents.send('menu:action', action)
}

export function buildMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const template: (Electron.MenuItemConstructorOptions | MenuItem)[] = [
    // macOS app menu
    ...(isMac
      ? [{
          label: 'Makrown',
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            {
              label: 'Configurações...',
              accelerator: 'Cmd+,',
              click: () => send(win, 'openSettings')
            },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ]
        }]
      : []),

    // File
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Abrir pasta...',
          accelerator: 'CmdOrCtrl+O',
          click: () => send(win, 'openFolder')
        },
        { type: 'separator' },
        {
          label: 'Salvar',
          accelerator: 'CmdOrCtrl+S',
          click: () => send(win, 'save')
        },
        { type: 'separator' },
        isMac
          ? { role: 'close' as const }
          : { role: 'quit' as const }
      ]
    },

    // Edit
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' as const, label: 'Desfazer' },
        { role: 'redo' as const, label: 'Refazer' },
        { type: 'separator' },
        { role: 'cut' as const, label: 'Recortar' },
        { role: 'copy' as const, label: 'Copiar' },
        { role: 'paste' as const, label: 'Colar' },
        { type: 'separator' },
        { role: 'selectAll' as const, label: 'Selecionar tudo' }
      ]
    },

    // View
    {
      label: 'Visualizar',
      submenu: [
        {
          label: 'Modo Preview',
          accelerator: 'CmdOrCtrl+1',
          click: () => send(win, 'layout:preview')
        },
        {
          label: 'Modo Editor',
          accelerator: 'CmdOrCtrl+2',
          click: () => send(win, 'layout:editor')
        },
        {
          label: 'Modo Visualize',
          accelerator: 'CmdOrCtrl+3',
          click: () => send(win, 'layout:visualize')
        },
        { type: 'separator' },
        {
          label: 'Buscar arquivo',
          accelerator: 'CmdOrCtrl+P',
          click: () => send(win, 'search:files')
        },
        {
          label: 'Buscar conteúdo',
          accelerator: 'CmdOrCtrl+Shift+F',
          click: () => send(win, 'search:content')
        },
        { type: 'separator' },
        {
          label: 'Atualizar árvore',
          accelerator: 'CmdOrCtrl+R',
          click: () => send(win, 'refreshTree')
        },
        { type: 'separator' },
        { role: 'toggleDevTools' as const, label: 'Dev Tools' }
      ]
    },

    // Help
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Atalhos de teclado',
          accelerator: 'CmdOrCtrl+/',
          click: () => send(win, 'shortcuts')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
