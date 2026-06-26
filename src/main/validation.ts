import { APP_THEMES, type AppTheme, type FlingSettings } from './types'

const MAX_TEXT_LENGTH = 2048
const SETTINGS_KEYS = new Set<keyof FlingSettings>([
  'host',
  'port',
  'username',
  'remotePath',
  'keyPath',
  'screenshotDir',
  'autoCleanupDays',
  'theme',
  'onboardingComplete'
])

export interface SendFileOptions {
  filePath?: string
  isScreenshot?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertReasonableString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${field} cannot be empty`)
  }

  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new Error(`${field} is too long`)
  }

  if (trimmed.includes('\0')) {
    throw new Error(`${field} cannot contain null bytes`)
  }

  return trimmed
}

function assertIntegerInRange(value: unknown, field: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} must be an integer from ${min} to ${max}`)
  }
  return parsed
}

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && APP_THEMES.includes(value as AppTheme)
}

export function validateSettingsPatch(value: unknown): Partial<FlingSettings> {
  if (!isRecord(value)) {
    throw new Error('settings patch must be an object')
  }

  const patch: Partial<FlingSettings> = {}

  for (const [key, rawValue] of Object.entries(value)) {
    if (!SETTINGS_KEYS.has(key as keyof FlingSettings)) continue

    switch (key as keyof FlingSettings) {
      case 'host':
        patch.host = assertReasonableString(rawValue, key)
        break
      case 'username':
        patch.username = assertReasonableString(rawValue, key)
        break
      case 'remotePath':
        patch.remotePath = assertReasonableString(rawValue, key)
        break
      case 'keyPath':
        patch.keyPath = assertReasonableString(rawValue, key)
        break
      case 'screenshotDir':
        patch.screenshotDir = assertReasonableString(rawValue, key)
        break
      case 'port':
        patch.port = assertIntegerInRange(rawValue, key, 1, 65535)
        break
      case 'autoCleanupDays':
        patch.autoCleanupDays = assertIntegerInRange(rawValue, key, 0, 3650)
        break
      case 'theme':
        if (!isAppTheme(rawValue)) {
          throw new Error('theme is not supported')
        }
        patch.theme = rawValue
        break
      case 'onboardingComplete':
        if (typeof rawValue !== 'boolean') {
          throw new Error('onboardingComplete must be a boolean')
        }
        patch.onboardingComplete = rawValue
        break
    }
  }

  return patch
}

export function validateHostKeyId(value: unknown): string {
  return assertReasonableString(value, 'hostKeyId')
}

export function validateSendFileOptions(value: unknown): SendFileOptions {
  if (!isRecord(value)) {
    throw new Error('send options must be an object')
  }

  const opts: SendFileOptions = {}

  if ('filePath' in value && value.filePath !== undefined) {
    opts.filePath = assertReasonableString(value.filePath, 'filePath')
  }

  if ('isScreenshot' in value && value.isScreenshot !== undefined) {
    if (typeof value.isScreenshot !== 'boolean') {
      throw new Error('isScreenshot must be a boolean')
    }
    opts.isScreenshot = value.isScreenshot
  }

  return opts
}
