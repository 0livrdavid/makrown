import type { UpdaterProgressInfo } from '../../../shared/types'

export type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date' }
  | { kind: 'available'; version: string; releaseNotes: string | null }
  | {
      kind: 'downloading'
      version: string
      percent: number
      transferredBytes: number
      totalBytes: number
      bytesPerSecond: number
    }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string; details?: string }

export function getUpdateVersion(state: UpdateState): string | null {
  if (state.kind === 'available' || state.kind === 'downloading' || state.kind === 'downloaded') {
    return state.version
  }
  return null
}

export function toDownloadingState(version: string, progress: UpdaterProgressInfo): UpdateState {
  return {
    kind: 'downloading',
    version,
    percent: progress.percent,
    transferredBytes: progress.transferredBytes,
    totalBytes: progress.totalBytes,
    bytesPerSecond: progress.bytesPerSecond,
  }
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s'
  return `${formatByteSize(bytesPerSecond)}/s`
}

export function describeUpdaterError(rawMessage: string): { message: string; details?: string } {
  const message = rawMessage.trim()

  if (
    /Code signature at URL/i.test(message) ||
    /did not pass validation/i.test(message) ||
    /ShipIt/i.test(message)
  ) {
    return {
      message:
        'A atualização foi baixada, mas o macOS recusou a assinatura do pacote. A release do mac precisa ser assinada com um certificado Developer ID válido para a instalação automática funcionar.',
      details: message,
    }
  }

  if (/Cannot parse releases feed/i.test(message)) {
    return {
      message:
        'O app encontrou a release, mas não conseguiu interpretar o feed de atualização do GitHub. Isso normalmente indica release incompleta ou assets ausentes.',
      details: message,
    }
  }

  return { message }
}
