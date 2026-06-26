import { APP_THEMES, type AppTheme, type DestinationProfile, type FlingSettings } from './types'

const MAX_TEXT_LENGTH = 2048
const SETTINGS_KEYS = new Set<keyof FlingSettings>([
  'host',
  'port',
  'username',
  'remotePath',
  'keyPath',
  'sshConfigHost',
  'screenshotDir',
  'clipboardTemplate',
  'activeProfileId',
  'profiles',
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

function optionalReasonableString(value: unknown, field: string): string {
  if (value === undefined || value === '') return ''
  return assertReasonableString(value, field)
}

function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && APP_THEMES.includes(value as AppTheme)
}

function validateDestinationProfiles(value: unknown): DestinationProfile[] {
  if (!Array.isArray(value)) {
    throw new Error('profiles must be an array')
  }

  if (value.length > 25) {
    throw new Error('profiles cannot contain more than 25 destinations')
  }

  const seenIds = new Set<string>()

  return value.map((rawProfile, index) => {
    if (!isRecord(rawProfile)) {
      throw new Error(`profiles[${index}] must be an object`)
    }

    const id = assertReasonableString(rawProfile.id, `profiles[${index}].id`)
    if (seenIds.has(id)) {
      throw new Error(`duplicate profile id: ${id}`)
    }
    seenIds.add(id)

    return {
      id,
      name: assertReasonableString(rawProfile.name, `profiles[${index}].name`),
      host: optionalReasonableString(rawProfile.host, `profiles[${index}].host`),
      port: assertIntegerInRange(rawProfile.port ?? 22, `profiles[${index}].port`, 1, 65535),
      username: optionalReasonableString(rawProfile.username, `profiles[${index}].username`),
      remotePath: optionalReasonableString(rawProfile.remotePath, `profiles[${index}].remotePath`),
      keyPath: optionalReasonableString(rawProfile.keyPath, `profiles[${index}].keyPath`),
      sshConfigHost: optionalReasonableString(rawProfile.sshConfigHost, `profiles[${index}].sshConfigHost`),
      clipboardTemplate: assertReasonableString(rawProfile.clipboardTemplate || '{{remotePath}}', `profiles[${index}].clipboardTemplate`)
    }
  })
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
      case 'sshConfigHost':
        patch.sshConfigHost = optionalReasonableString(rawValue, key)
        break
      case 'screenshotDir':
        patch.screenshotDir = assertReasonableString(rawValue, key)
        break
      case 'clipboardTemplate':
        patch.clipboardTemplate = assertReasonableString(rawValue, key)
        break
      case 'activeProfileId':
        patch.activeProfileId = assertReasonableString(rawValue, key)
        break
      case 'profiles':
        patch.profiles = validateDestinationProfiles(rawValue)
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
