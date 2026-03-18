import { ipcMain, safeStorage, type IpcMainInvokeEvent } from 'electron'
import { randomUUID } from 'node:crypto'
import { store } from '../store'
import type { SSHAuthMethod, SSHConfig, StoredSSHProfile, SSHProfileSummary } from '../../shared/types'

interface SSHProfileSecret {
  label: string
  host: string
  port: number
  username: string
  authMethod: SSHAuthMethod
  password?: string
  keyPath?: string
  passphrase?: string
  remotePath: string
}

interface LegacyStoredSSHProfile {
  id: string
  label: string
  host: string
  port: number
  username: string
  authMethod: SSHAuthMethod
  password?: string
  keyPath?: string
  passphrase?: string
  remotePath: string
}

function assertSafeStorageAvailable(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('A criptografia nativa do sistema não está disponível no momento.')
  }
}

function encrypt(value: string): string {
  assertSafeStorageAvailable()
  return safeStorage.encryptString(value).toString('base64')
}

function decrypt(encoded: string): string {
  assertSafeStorageAvailable()
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}

function decryptIfPossible(value?: string): string | undefined {
  if (!value) return undefined
  try {
    return decrypt(value)
  } catch {
    return value
  }
}

function normaliseRemotePath(remotePath?: string): string {
  const trimmed = (remotePath ?? '/').trim()
  if (!trimmed) return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.length > 1 ? withLeadingSlash.replace(/\/+$/, '') : withLeadingSlash
}

function normaliseConfig(config: SSHConfig): SSHProfileSecret {
  const authMethod = config.authMethod
  return {
    label: config.label.trim(),
    host: config.host.trim(),
    port: Number.isFinite(config.port) ? config.port : 22,
    username: config.username.trim(),
    authMethod,
    password: authMethod === 'password' ? config.password ?? '' : undefined,
    keyPath: authMethod === 'key' ? config.keyPath?.trim() || undefined : undefined,
    passphrase: authMethod === 'key' ? config.passphrase || undefined : undefined,
    remotePath: normaliseRemotePath(config.remotePath),
  }
}

function profileFingerprint(config: Pick<SSHProfileSecret, 'host' | 'port' | 'username'>): string {
  return `${config.host}:${config.port}:${config.username}`
}

function secretToStored(id: string, secret: SSHProfileSecret): StoredSSHProfile {
  return {
    id,
    payload: encrypt(JSON.stringify(secret)),
  }
}

function storedToSecret(stored: StoredSSHProfile): SSHProfileSecret {
  return JSON.parse(decrypt(stored.payload)) as SSHProfileSecret
}

function secretToConfig(id: string, secret: SSHProfileSecret): SSHConfig {
  return {
    id,
    label: secret.label,
    host: secret.host,
    port: secret.port,
    username: secret.username,
    authMethod: secret.authMethod,
    password: secret.password,
    keyPath: secret.keyPath,
    passphrase: secret.passphrase,
    remotePath: secret.remotePath,
  }
}

function storedToSummary(stored: StoredSSHProfile): SSHProfileSummary | null {
  try {
    const secret = storedToSecret(stored)
    return {
      id: stored.id,
      label: secret.label,
      host: secret.host,
      port: secret.port,
      username: secret.username,
      authMethod: secret.authMethod,
      keyPath: secret.keyPath,
      remotePath: secret.remotePath,
    }
  } catch {
    return null
  }
}

function isEncryptedStoredProfile(value: unknown): value is StoredSSHProfile {
  return typeof value === 'object'
    && value !== null
    && typeof (value as StoredSSHProfile).id === 'string'
    && typeof (value as StoredSSHProfile).payload === 'string'
}

function isLegacyStoredProfile(value: unknown): value is LegacyStoredSSHProfile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<LegacyStoredSSHProfile>
  return typeof candidate.id === 'string'
    && typeof candidate.host === 'string'
    && typeof candidate.port === 'number'
    && typeof candidate.username === 'string'
    && (candidate.authMethod === 'password' || candidate.authMethod === 'key')
    && typeof candidate.remotePath === 'string'
}

function legacyStoredToSecret(legacy: LegacyStoredSSHProfile): SSHProfileSecret {
  return normaliseConfig({
    label: legacy.label,
    host: legacy.host,
    port: legacy.port,
    username: legacy.username,
    authMethod: legacy.authMethod,
    password: decryptIfPossible(legacy.password),
    keyPath: legacy.keyPath,
    passphrase: decryptIfPossible(legacy.passphrase),
    remotePath: legacy.remotePath,
  })
}

function getProfiles(): StoredSSHProfile[] {
  return [...store.get('sshProfiles')]
}

function findStoredProfile(profiles: StoredSSHProfile[], idOrLegacyFingerprint: string): StoredSSHProfile | null {
  const directMatch = profiles.find((profile) => profile.id === idOrLegacyFingerprint)
  if (directMatch) return directMatch

  for (const profile of profiles) {
    try {
      if (profileFingerprint(storedToSecret(profile)) === idOrLegacyFingerprint) {
        return profile
      }
    } catch {
      continue
    }
  }

  return null
}

function dedupeProfiles(profiles: StoredSSHProfile[]): StoredSSHProfile[] {
  const seenFingerprints = new Set<string>()
  const deduped: StoredSSHProfile[] = []

  for (const profile of profiles) {
    try {
      const fingerprint = profileFingerprint(storedToSecret(profile))
      if (seenFingerprints.has(fingerprint)) continue
      seenFingerprints.add(fingerprint)
      deduped.push(profile)
    } catch {
      continue
    }
  }

  return deduped
}

function resolveProfileId(profiles: StoredSSHProfile[], config: SSHConfig, secret: SSHProfileSecret): string {
  if (config.id) {
    const existing = findStoredProfile(profiles, config.id)
    if (existing) return existing.id
  }

  const fingerprint = profileFingerprint(secret)
  const existingByFingerprint = findStoredProfile(profiles, fingerprint)
  if (existingByFingerprint) return existingByFingerprint.id

  return randomUUID()
}

function upsertProfile(profiles: StoredSSHProfile[], config: SSHConfig): { id: string; profiles: StoredSSHProfile[] } {
  const secret = normaliseConfig(config)
  const id = resolveProfileId(profiles, config, secret)
  const nextProfile = secretToStored(id, secret)
  const nextProfiles = [nextProfile, ...profiles.filter((profile) => profile.id !== id)]
  return {
    id,
    profiles: dedupeProfiles(nextProfiles),
  }
}

/** Migrates legacy plaintext ssh profiles to the encrypted payload schema. */
function migrateIfNeeded(): void {
  const legacySavedConnections = store.get('savedSSHConnections')
  const rawProfiles = store.get('sshProfiles') as Array<StoredSSHProfile | LegacyStoredSSHProfile>

  let migratedProfiles: StoredSSHProfile[] = []
  let shouldPersist = false

  for (const rawProfile of rawProfiles) {
    if (isEncryptedStoredProfile(rawProfile)) {
      migratedProfiles.push(rawProfile)
      continue
    }

    if (!isLegacyStoredProfile(rawProfile)) {
      shouldPersist = true
      continue
    }

    shouldPersist = true
    const legacySecret = legacyStoredToSecret(rawProfile)
    const opaqueId = rawProfile.id.includes(':') ? randomUUID() : rawProfile.id
    migratedProfiles.push(secretToStored(opaqueId, legacySecret))
  }

  migratedProfiles = dedupeProfiles(migratedProfiles)

  if (legacySavedConnections.length > 0) {
    shouldPersist = true
    for (const legacyConfig of legacySavedConnections) {
      migratedProfiles = upsertProfile(migratedProfiles, legacyConfig).profiles
    }
    store.set('savedSSHConnections', [])
  }

  if (shouldPersist) {
    store.set('sshProfiles', migratedProfiles)
  }
}

function handleCredentialsSet(_event: IpcMainInvokeEvent, config: SSHConfig): { id: string } {
  const profiles = getProfiles()
  const next = upsertProfile(profiles, config)
  store.set('sshProfiles', next.profiles)
  return { id: next.id }
}

export function registerCredentialsHandlers(): void {
  migrateIfNeeded()

  ipcMain.handle('credentials:list', () => {
    return getProfiles()
      .map(storedToSummary)
      .filter((profile): profile is SSHProfileSummary => profile !== null)
  })

  ipcMain.handle('credentials:get', (_event, id: string) => {
    const stored = findStoredProfile(getProfiles(), id)
    if (!stored) return null

    try {
      return secretToConfig(stored.id, storedToSecret(stored))
    } catch {
      return null
    }
  })

  ipcMain.handle('credentials:set', handleCredentialsSet)
  ipcMain.handle('credentials:save', handleCredentialsSet)

  ipcMain.handle('credentials:delete', (_event, id: string) => {
    const profiles = getProfiles()
    const stored = findStoredProfile(profiles, id)
    if (!stored) return
    store.set('sshProfiles', profiles.filter((profile) => profile.id !== stored.id))
  })
}
