import Store from 'electron-store'
import { readFileSync, statSync } from 'fs'
import { homedir, userInfo } from 'os'
import { join } from 'path'
import { normalizeStoredHostKey } from './hostKeys'
import { APP_THEMES, type AppTheme, type FlingSettings, type HistoryItem, type HostKeyRecord } from './types'

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function resolveHomePath(path: string): string {
  return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
}

type StoredHostKey = string | HostKeyRecord

const store = new Store<{
  settings: FlingSettings
  history: HistoryItem[]
  hostKeys: Record<string, StoredHostKey>
}>({
  name: 'filefling',
  defaults: {
    settings: {
      host: '',
      port: 22,
      username: userInfo().username,
      remotePath: '~/shared',
      keyPath: '',
      screenshotDir: join(homedir(), 'Desktop', 'screenshots'),
      autoCleanupDays: 7,
      theme: 'terminal',
      onboardingComplete: false
    },
    history: [],
    hostKeys: {}
  }
})

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && APP_THEMES.includes(value as AppTheme)
}

function hasRequiredConnectionSettings(settings: FlingSettings): boolean {
  return Boolean(
    settings.host?.trim() &&
    settings.username?.trim() &&
    settings.remotePath?.trim() &&
    settings.keyPath?.trim()
  )
}

function migrateSettings(settings: FlingSettings): FlingSettings {
  let migrated = settings
  let changed = false

  if (!isAppTheme(migrated.theme)) {
    migrated = { ...migrated, theme: 'terminal' }
    changed = true
  }

  if (typeof migrated.onboardingComplete !== 'boolean') {
    migrated = {
      ...migrated,
      onboardingComplete: hasRequiredConnectionSettings(migrated)
    }
    changed = true
  }

  if (changed) {
    store.set('settings', migrated)
  }

  return migrated
}

export function getSettings(): FlingSettings {
  return migrateSettings(store.get('settings'))
}

export function updateSettings(patch: Partial<FlingSettings>): FlingSettings {
  const current = getSettings()
  const updated = { ...current, ...patch }
  store.set('settings', updated)
  return updated
}

export function getHistory(): HistoryItem[] {
  return store.get('history')
}

export function addHistoryItem(item: HistoryItem): void {
  const history = getHistory()
  history.unshift(item)
  store.set('history', history.slice(0, 10))
}

export function clearHistory(): void {
  store.set('history', [])
}

export function getHostKey(host: string): string | undefined {
  const value = store.get('hostKeys')[host]
  return typeof value === 'string' ? value : value?.key
}

export function getHostKeyRecord(id: string, fallbackHost?: string, fallbackPort?: number): HostKeyRecord | undefined {
  const value = store.get('hostKeys')[id]
  if (!value) return undefined
  return normalizeStoredHostKey(id, value, fallbackHost, fallbackPort)
}

export function getHostKeyRecords(): HostKeyRecord[] {
  return Object.entries(store.get('hostKeys'))
    .map(([id, value]) => normalizeStoredHostKey(id, value))
    .sort((a, b) => a.host.localeCompare(b.host) || a.port - b.port)
}

export function setHostKey(host: string, key: string): void {
  const hostKeys = store.get('hostKeys')
  hostKeys[host] = key
  store.set('hostKeys', hostKeys)
}

export function setHostKeyRecord(record: HostKeyRecord): void {
  const hostKeys = store.get('hostKeys')
  hostKeys[record.id] = record
  store.set('hostKeys', hostKeys)
}

export function forgetHostKey(id: string): void {
  const hostKeys = store.get('hostKeys')
  delete hostKeys[id]
  store.set('hostKeys', hostKeys)
}

export function readPrivateKey(keyPath: string): Buffer {
  const resolved = resolveHomePath(keyPath)

  if (isDirectory(resolved)) {
    for (const candidate of ['id_ed25519', 'id_rsa']) {
      const candidatePath = join(resolved, candidate)
      if (isFile(candidatePath)) return readFileSync(candidatePath)
    }
    throw new Error(`SSH key path is a directory with no supported private key: ${resolved}`)
  }

  return readFileSync(resolved)
}
