import { createHash } from 'crypto'
import type { HostKeyRecord, HostKeyVerificationResult } from './types'

export function hostKeyId(host: string, port: number): string {
  return `${host}:${port}`
}

export function sha256Fingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}`
}

export function parsePublicKeyAlgorithm(key: Buffer): string {
  if (key.length < 4) return 'unknown'

  const length = key.readUInt32BE(0)
  if (length <= 0 || length > key.length - 4) return 'unknown'

  const algorithm = key.subarray(4, 4 + length).toString('utf8')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9@._+-]*$/.test(algorithm)) return 'unknown'

  return algorithm
}

export function describePresentedHostKey(key: Buffer): Pick<HostKeyRecord, 'key' | 'algorithm' | 'fingerprintSHA256'> {
  return {
    key: key.toString('base64'),
    algorithm: parsePublicKeyAlgorithm(key),
    fingerprintSHA256: sha256Fingerprint(key)
  }
}

export function createHostKeyRecord({
  host,
  port,
  key,
  algorithm,
  fingerprintSHA256,
  trustedAt = Date.now(),
  source = 'filefling'
}: {
  host: string
  port: number
  key: string
  algorithm: string
  fingerprintSHA256: string
  trustedAt?: number
  source?: HostKeyRecord['source']
}): HostKeyRecord {
  return {
    id: hostKeyId(host, port),
    host,
    port,
    key,
    algorithm,
    fingerprintSHA256,
    trustedAt,
    source
  }
}

export function normalizeStoredHostKey(
  id: string,
  value: string | HostKeyRecord,
  fallbackHost?: string,
  fallbackPort?: number
): HostKeyRecord {
  if (typeof value !== 'string') {
    return {
      ...value,
      id: value.id || id,
      host: value.host || fallbackHost || parseHostKeyId(id).host,
      port: value.port || fallbackPort || parseHostKeyId(id).port,
      source: value.source || 'filefling'
    }
  }

  const parsed = parseHostKeyId(id)
  const host = fallbackHost || parsed.host
  const port = fallbackPort || parsed.port
  let fingerprintSHA256 = 'unknown'
  let algorithm = 'unknown'

  try {
    const key = Buffer.from(value, 'base64')
    fingerprintSHA256 = sha256Fingerprint(key)
    algorithm = parsePublicKeyAlgorithm(key)
  } catch {
    // Keep legacy key comparable even if metadata cannot be derived.
  }

  return {
    ...createHostKeyRecord({
      host,
      port,
      key: value,
      algorithm,
      fingerprintSHA256,
      trustedAt: 0,
      source: 'legacy'
    }),
    // Preserve the storage key so Settings can forget legacy entries stored as just "host".
    id
  }
}

export function parseHostKeyId(id: string): { host: string; port: number } {
  const separator = id.lastIndexOf(':')
  if (separator <= 0) return { host: id, port: 22 }

  const host = id.slice(0, separator)
  const port = Number(id.slice(separator + 1))
  return {
    host,
    port: Number.isInteger(port) && port > 0 ? port : 22
  }
}

export function hostKeysMatch(stored: HostKeyRecord, presentedKeyBase64: string): boolean {
  return stored.key.trim() === presentedKeyBase64.trim()
}

export function hostKeyVerificationMessage(result: HostKeyVerificationResult): string {
  switch (result.status) {
    case 'trusted-new':
      return `Trusted new ${result.algorithm} host key: ${result.fingerprintSHA256}`
    case 'matched-stored':
      return `Matched trusted ${result.algorithm} host key: ${result.fingerprintSHA256}`
    case 'matched-known-hosts':
      return `Matched ${result.algorithm} host key from ~/.ssh/known_hosts: ${result.fingerprintSHA256}`
    case 'mismatch':
      return `Host key changed. Previous: ${result.previousFingerprintSHA256 || 'unknown'}; presented: ${result.fingerprintSHA256}`
  }
}
