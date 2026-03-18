import fs from 'fs/promises'
import path from 'path'
import type { IFileSystem, FileEntry, FileSystemResult, FileStatInfo } from '../../shared/types'

export class LocalFileSystem implements IFileSystem {
  async listDir(dirPath: string): Promise<FileSystemResult<FileEntry[]>> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      const result: FileEntry[] = entries.map((entry) => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        type: entry.isDirectory() ? 'directory' : 'file',
        extension: entry.isDirectory() ? null : path.extname(entry.name) || null
      }))
      return { ok: true, data: result }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async stat(targetPath: string): Promise<FileSystemResult<FileStatInfo>> {
    try {
      const info = await fs.stat(targetPath)
      return {
        ok: true,
        data: {
          type: info.isDirectory() ? 'directory' : 'file',
          size: info.size,
        },
      }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async readFile(filePath: string): Promise<FileSystemResult<string>> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { ok: true, data: content }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async writeFile(filePath: string, content: string): Promise<FileSystemResult<void>> {
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async createFile(filePath: string): Promise<FileSystemResult<void>> {
    try {
      // Falha se o arquivo já existir
      await fs.writeFile(filePath, '', { encoding: 'utf-8', flag: 'wx' })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async createDir(dirPath: string): Promise<FileSystemResult<void>> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async rename(oldPath: string, newPath: string): Promise<FileSystemResult<void>> {
    try {
      await fs.rename(oldPath, newPath)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }

  async delete(targetPath: string): Promise<FileSystemResult<void>> {
    try {
      const stat = await fs.stat(targetPath)
      if (stat.isDirectory()) {
        await fs.rm(targetPath, { recursive: true, force: true })
      } else {
        await fs.unlink(targetPath)
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }
}
