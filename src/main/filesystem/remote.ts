import path from 'path'
import { readFileSync } from 'fs'
import { Client, type SFTPWrapper } from 'ssh2'
import type { IFileSystem, FileEntry, FileSystemResult, FileStatInfo, SSHConfig } from '../../shared/types'

export class RemoteFileSystem implements IFileSystem {
  private sftp: SFTPWrapper
  private sep = '/'

  constructor(sftp: SFTPWrapper) {
    this.sftp = sftp
  }

  private join(...parts: string[]): string {
    return path.posix.join(...parts)
  }

  async listDir(dirPath: string): Promise<FileSystemResult<FileEntry[]>> {
    return new Promise((resolve) => {
      this.sftp.readdir(dirPath, (err, list) => {
        if (err) return resolve({ ok: false, error: err.message })
        const result: FileEntry[] = list.map((item) => {
          const isDir = item.attrs.isDirectory?.() ?? false
          const ext = isDir ? null : (path.posix.extname(item.filename) || null)
          return {
            name: item.filename,
            path: this.join(dirPath, item.filename),
            type: isDir ? 'directory' : 'file',
            extension: ext
          } satisfies FileEntry
        })
        resolve({ ok: true, data: result })
      })
    })
  }

  async stat(targetPath: string): Promise<FileSystemResult<FileStatInfo>> {
    return new Promise((resolve) => {
      this.sftp.stat(targetPath, (err, stats) => {
        if (err) return resolve({ ok: false, error: err.message })
        resolve({
          ok: true,
          data: {
            type: stats.isDirectory?.() ? 'directory' : 'file',
            size: stats.size,
          },
        })
      })
    })
  }

  async readFile(filePath: string): Promise<FileSystemResult<string>> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = []
      const stream = this.sftp.createReadStream(filePath, { encoding: undefined })
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve({ ok: true, data: Buffer.concat(chunks).toString('utf-8') }))
      stream.on('error', (err: Error) => resolve({ ok: false, error: err.message }))
    })
  }

  async writeFile(filePath: string, content: string): Promise<FileSystemResult<void>> {
    return new Promise((resolve) => {
      const stream = this.sftp.createWriteStream(filePath)
      stream.write(content, 'utf-8')
      stream.end()
      stream.on('close', () => resolve({ ok: true }))
      stream.on('error', (err: Error) => resolve({ ok: false, error: err.message }))
    })
  }

  async createFile(filePath: string): Promise<FileSystemResult<void>> {
    return new Promise((resolve) => {
      // open with 'wx' flags: create, fail if exists
      this.sftp.open(filePath, 'wx', (err, handle) => {
        if (err) return resolve({ ok: false, error: err.message })
        this.sftp.close(handle, (closeErr) => {
          if (closeErr) return resolve({ ok: false, error: closeErr.message })
          resolve({ ok: true })
        })
      })
    })
  }

  async createDir(dirPath: string): Promise<FileSystemResult<void>> {
    return new Promise((resolve) => {
      this.sftp.mkdir(dirPath, (err) => {
        if (err) return resolve({ ok: false, error: err.message })
        resolve({ ok: true })
      })
    })
  }

  async rename(oldPath: string, newPath: string): Promise<FileSystemResult<void>> {
    return new Promise((resolve) => {
      this.sftp.rename(oldPath, newPath, (err) => {
        if (err) return resolve({ ok: false, error: err.message })
        resolve({ ok: true })
      })
    })
  }

  async delete(targetPath: string): Promise<FileSystemResult<void>> {
    try {
      await this.deleteRecursive(targetPath)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  private deleteRecursive(targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sftp.stat(targetPath, (err, stats) => {
        if (err) return reject(err)

        if (stats.isDirectory?.()) {
          this.sftp.readdir(targetPath, (rdErr, list) => {
            if (rdErr) return reject(rdErr)
            Promise.all(list.map((item) => this.deleteRecursive(this.join(targetPath, item.filename))))
              .then(() => {
                this.sftp.rmdir(targetPath, (rmErr) => rmErr ? reject(rmErr) : resolve())
              })
              .catch(reject)
          })
        } else {
          this.sftp.unlink(targetPath, (ulErr) => ulErr ? reject(ulErr) : resolve())
        }
      })
    })
  }
}

// Conecta via SSH e retorna um RemoteFileSystem já pronto
export function createRemoteFileSystem(config: SSHConfig): Promise<{ fs: RemoteFileSystem; client: Client }> {
  return new Promise((resolve, reject) => {
    const client = new Client()

    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end()
          return reject(new Error(`SFTP error: ${err.message}`))
        }
        resolve({ fs: new RemoteFileSystem(sftp), client })
      })
    })

    client.on('error', (err) => reject(err))

    const connectOptions: Parameters<Client['connect']>[0] = {
      host: config.host,
      port: config.port,
      username: config.username,
      readyTimeout: 10_000,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3
    }

    if (config.authMethod === 'password') {
      connectOptions.password = config.password
    } else {
      try {
        connectOptions.privateKey = readFileSync(config.keyPath!)
        if (config.passphrase) connectOptions.passphrase = config.passphrase
      } catch (err) {
        return reject(new Error(`Não foi possível ler a chave SSH: ${(err as Error).message}`))
      }
    }

    client.connect(connectOptions)
  })
}
