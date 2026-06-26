import type { HostKeyVerificationResult } from './types'

export type FriendlyErrorKind =
  | 'setup-required'
  | 'missing-key'
  | 'key-not-readable'
  | 'key-permissions'
  | 'host-unreachable'
  | 'dns-failure'
  | 'connection-refused'
  | 'connection-timeout'
  | 'auth-failed'
  | 'host-key-mismatch'
  | 'remote-path-not-writable'
  | 'local-file-missing'
  | 'local-path-not-file'
  | 'no-screenshots'
  | 'file-too-large'
  | 'upload-interrupted'
  | 'unknown'

export interface FriendlyFileFlingError {
  kind: FriendlyErrorKind
  title: string
  message: string
  detail?: string
}

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function errorCode(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) return ''
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : ''
}

function includesAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle))
}

function attachedHostKeyVerification(error: unknown): HostKeyVerificationResult | undefined {
  if (typeof error !== 'object' || error === null || !('hostKeyVerification' in error)) return undefined
  return (error as { hostKeyVerification?: HostKeyVerificationResult }).hostKeyVerification
}

function friendly(
  kind: FriendlyErrorKind,
  title: string,
  message: string,
  detail: string
): FriendlyFileFlingError {
  return { kind, title, message, detail }
}

export function describeFileFlingError(error: unknown): FriendlyFileFlingError {
  const detail = rawMessage(error)
  const lower = detail.toLowerCase()
  const code = errorCode(error)

  if (lower.includes('configure host') || lower.includes('missing required connection settings')) {
    return friendly(
      'setup-required',
      'FileFling — Setup required',
      'Finish setup before sending. Host, username, remote path, and SSH key path are required.',
      detail
    )
  }

  if (lower.includes('no screenshots found')) {
    return friendly(
      'no-screenshots',
      'FileFling — No screenshots found',
      'No screenshots were found in your configured screenshot directory.',
      detail
    )
  }

  if (lower.startsWith('file does not exist:')) {
    return friendly(
      'local-file-missing',
      'FileFling — File missing',
      'The local file was not found. It may have been moved or deleted.',
      detail
    )
  }

  if (lower.startsWith('path is not a file:')) {
    return friendly(
      'local-path-not-file',
      'FileFling — Not a file',
      'The selected path is not a file. Drop or send a regular file instead.',
      detail
    )
  }

  if (code === 'ENOENT' && includesAny(lower, ['.ssh', 'id_ed25519', 'id_rsa', 'key'])) {
    return friendly(
      'missing-key',
      'FileFling — SSH key missing',
      'SSH key file was not found. Check the SSH key path in Settings.',
      detail
    )
  }

  if (code === 'EACCES' && includesAny(lower, ['.ssh', 'id_ed25519', 'id_rsa', 'key'])) {
    return friendly(
      'key-not-readable',
      'FileFling — SSH key unreadable',
      'SSH key file could not be read. Check the key path and file permissions.',
      detail
    )
  }

  if (includesAny(lower, ['permissions are too open', 'bad permissions', 'unprotected private key'])) {
    return friendly(
      'key-permissions',
      'FileFling — SSH key permissions',
      'SSH key permissions are too open. Try `chmod 600` on the private key.',
      detail
    )
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || lower.includes('getaddrinfo')) {
    return friendly(
      'dns-failure',
      'FileFling — Host not found',
      'Host could not be resolved. Check the host name or Tailscale/DNS status.',
      detail
    )
  }

  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || lower.includes('no route to host')) {
    return friendly(
      'host-unreachable',
      'FileFling — Host unreachable',
      'Host is unreachable. Check network access, VPN/Tailscale, and whether the machine is online.',
      detail
    )
  }

  if (code === 'ECONNREFUSED') {
    return friendly(
      'connection-refused',
      'FileFling — SSH refused',
      'Connection was refused. Check the host and SSH port, and make sure SSH is running.',
      detail
    )
  }

  if (code === 'ETIMEDOUT' || includesAny(lower, ['timed out', 'handshake timeout', 'ready timeout'])) {
    return friendly(
      'connection-timeout',
      'FileFling — SSH timed out',
      'Connection timed out. Check network access, VPN/Tailscale, host, and port.',
      detail
    )
  }

  const hostKeyVerification = attachedHostKeyVerification(error)
  if (hostKeyVerification?.status === 'mismatch') {
    return friendly(
      'host-key-mismatch',
      'FileFling — Host key mismatch',
      `Host key for ${hostKeyVerification.host}:${hostKeyVerification.port} changed. Previously trusted ${hostKeyVerification.previousFingerprintSHA256 || 'unknown'}; server presented ${hostKeyVerification.fingerprintSHA256}.`,
      detail
    )
  }

  if (includesAny(lower, ['host denied', 'verification failed', 'host key'])) {
    return friendly(
      'host-key-mismatch',
      'FileFling — Host key mismatch',
      'Host key verification failed. The server identity may have changed.',
      detail
    )
  }

  if (includesAny(lower, ['all configured authentication methods failed', 'authentication failed', 'permission denied (publickey)'])) {
    return friendly(
      'auth-failed',
      'FileFling — SSH auth failed',
      'Authentication failed. Check the username, SSH key, and authorized_keys on the server.',
      detail
    )
  }

  if (includesAny(lower, ['remote directory is not writable', 'permission denied', 'no space left on device', 'disk quota exceeded', 'sftp error'])) {
    return friendly(
      'remote-path-not-writable',
      'FileFling — Remote path not writable',
      'Remote directory is not writable. Check the remote path, permissions, and available disk space.',
      detail
    )
  }

  if (code === 'EFBIG' || includesAny(lower, ['file too large', 'request entity too large'])) {
    return friendly(
      'file-too-large',
      'FileFling — File too large',
      'The file is too large to upload. Try a smaller file or compress it first.',
      detail
    )
  }

  if (includesAny(lower, ['connection lost', 'connection reset', 'socket closed', 'channel closed', 'sftp connection closed']) || ['ECONNRESET', 'EPIPE', 'ECONNABORTED'].includes(code)) {
    return friendly(
      'upload-interrupted',
      'FileFling — Upload interrupted',
      'Upload was interrupted. Check the connection and try again.',
      detail
    )
  }

  if (code === 'ENOENT') {
    return friendly(
      'local-file-missing',
      'FileFling — Path missing',
      'A required file or path was not found. Check the local file and SSH key path.',
      detail
    )
  }

  if (code === 'EACCES') {
    return friendly(
      'key-not-readable',
      'FileFling — Permission denied',
      'A required file could not be read. Check local file and SSH key permissions.',
      detail
    )
  }

  return friendly(
    'unknown',
    'FileFling — Error',
    detail || 'Something went wrong. Check your settings and try again.',
    detail
  )
}
