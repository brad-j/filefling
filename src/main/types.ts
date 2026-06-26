export const APP_THEMES = ['terminal', 'graphite', 'light'] as const

export type AppTheme = typeof APP_THEMES[number]

export interface FlingSettings {
  host: string
  port: number
  username: string
  remotePath: string
  keyPath: string
  screenshotDir: string
  autoCleanupDays: number
  theme: AppTheme
  onboardingComplete: boolean
}

export interface HistoryItem {
  id: string
  filename: string
  remotePath: string
  timestamp: number
  status: 'success' | 'error'
  error?: string
}

export type SendStatus = 'idle' | 'sending' | 'success' | 'error'

export interface SendProgress {
  status: SendStatus
  filename?: string
  error?: string
  remotePath?: string
}

export interface HostKeyRecord {
  id: string
  host: string
  port: number
  key: string
  algorithm: string
  fingerprintSHA256: string
  trustedAt: number
  source: 'filefling' | 'known_hosts' | 'legacy'
}

export interface HostKeyVerificationResult {
  status: 'trusted-new' | 'matched-stored' | 'matched-known-hosts' | 'mismatch'
  hostKeyId: string
  host: string
  port: number
  algorithm: string
  fingerprintSHA256: string
  trustedAt?: number
  previousAlgorithm?: string
  previousFingerprintSHA256?: string
}

export interface ConnectionTestCheck {
  id: string
  label: string
  status: 'success' | 'error' | 'pending'
  message?: string
}

export interface ConnectionTestResult {
  ok: boolean
  message: string
  remotePath?: string
  hostKey?: HostKeyVerificationResult
  checks: ConnectionTestCheck[]
}
