// Tipos compartilhados entre main process e renderer

export type FileType = 'file' | 'directory'

export interface FileEntry {
  name: string
  path: string
  type: FileType
  extension: string | null // null para diretórios
}

export interface FileSystemResult<T> {
  ok: boolean
  data?: T
  error?: string
}

// Interface que abstrai operações de arquivo (local ou SFTP no futuro)
export interface IFileSystem {
  listDir(dirPath: string): Promise<FileSystemResult<FileEntry[]>>
  readFile(filePath: string): Promise<FileSystemResult<string>>
  writeFile(filePath: string, content: string): Promise<FileSystemResult<void>>
  createFile(filePath: string): Promise<FileSystemResult<void>>
  createDir(dirPath: string): Promise<FileSystemResult<void>>
  rename(oldPath: string, newPath: string): Promise<FileSystemResult<void>>
  delete(targetPath: string): Promise<FileSystemResult<void>>
}

// Configuração de conexão SSH/SFTP
export interface SSHConfig {
  label: string        // nome amigável, ex: "Minha VPS"
  host: string
  port: number         // padrão 22
  username: string
  authMethod: 'password' | 'key'
  password?: string
  keyPath?: string
  passphrase?: string
  remotePath: string   // diretório inicial no servidor, ex: "/home/user/notes"
}

export interface SSHConnectionResult {
  ok: boolean
  error?: string
}

// Estado da janela para persistência entre sessões
export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  isMaximized: boolean
  isFullScreen: boolean
}

// Preferências salvas com electron-store
export interface AppPreferences {
  lastOpenedFolder: string | null
  windowState: WindowState
  savedSSHConnections: SSHConfig[]
}

// Resultados de busca
export interface SearchFileResult {
  name: string
  path: string
}

export interface SearchContentResult {
  name: string
  path: string
  excerpt: string
  lineNumber: number
}
