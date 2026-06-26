import Store from 'electron-store'
import { readFileSync, statSync } from 'fs'
import { homedir, userInfo } from 'os'
import { join } from 'path'
import { APP_THEMES, type AppTheme, type FlingSettings, type HistoryItem } from './types'

const ZEDD_KEY_DIR = join(homedir(), '.ssh', 'zedd')
const ZEDD_KEY_PATH = join(ZEDD_KEY_DIR, 'id_ed25519')

const DEFAULT_KEY_PATHS = [
  ZEDD_KEY_PATH,
  join(ZEDD_KEY_DIR, 'id_rsa'),
  join(homedir(), '.ssh', 'id_ed25519'),
  join(homedir(), '.ssh', 'id_rsa')
]

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

function detectKeyPath(): string {
  for (const p of DEFAULT_KEY_PATHS) {
    if (isFile(p)) return p
  }
  return ZEDD_KEY_PATH
}

const store = new Store<{
  settings: FlingSettings
  history: HistoryItem[]
  hostKeys: Record<string, string>
}>({
  name: 'fling',
  defaults: {
    settings: {
      host: '',
      port: 22,
      username: userInfo().username,
      remotePath: '~/shared',
      keyPath: detectKeyPath(),
      screenshotDir: join(homedir(), 'Desktop', 'screenshots'),
      autoCleanupDays: 7,
      theme: 'terminal'
    },
    history: [],
    hostKeys: {}
  }
})

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && APP_THEMES.includes(value as AppTheme)
}

function migrateDetectedKeyPath(settings: FlingSettings): FlingSettings {
  const resolvedKeyPath = resolveHomePath(settings.keyPath)
  const genericKeyPaths = new Set(DEFAULT_KEY_PATHS.filter((p) => p !== ZEDD_KEY_PATH))

  if (
    isFile(ZEDD_KEY_PATH) &&
    (resolvedKeyPath === ZEDD_KEY_DIR || isDirectory(resolvedKeyPath) || genericKeyPaths.has(resolvedKeyPath))
  ) {
    const migrated = { ...settings, keyPath: ZEDD_KEY_PATH }
    store.set('settings', migrated)
    return migrated
  }

  return settings
}

function migrateSettings(settings: FlingSettings): FlingSettings {
  let migrated = migrateDetectedKeyPath(settings)

  if (!isAppTheme(migrated.theme)) {
    migrated = { ...migrated, theme: 'terminal' }
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
  return store.get('hostKeys')[host]
}

export function setHostKey(host: string, key: string): void {
  const hostKeys = store.get('hostKeys')
  hostKeys[host] = key
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
