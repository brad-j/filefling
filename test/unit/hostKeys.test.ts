import { describe, expect, it } from 'vitest'
import {
  createHostKeyRecord,
  describePresentedHostKey,
  hostKeyId,
  hostKeyVerificationMessage,
  normalizeStoredHostKey,
  parsePublicKeyAlgorithm,
  sha256Fingerprint
} from '../../src/main/hostKeys'

function publicKeyBlob(algorithm: string): Buffer {
  const algorithmBytes = Buffer.from(algorithm, 'utf8')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(algorithmBytes.length, 0)
  return Buffer.concat([length, algorithmBytes, Buffer.from('fake-key-material')])
}

describe('host key helpers', () => {
  it('parses the algorithm from an SSH public key blob', () => {
    expect(parsePublicKeyAlgorithm(publicKeyBlob('ssh-ed25519'))).toBe('ssh-ed25519')
  })

  it('creates OpenSSH-style SHA256 fingerprints without base64 padding', () => {
    const fingerprint = sha256Fingerprint(publicKeyBlob('ssh-rsa'))

    expect(fingerprint).toMatch(/^SHA256:/)
    expect(fingerprint).not.toContain('=')
  })

  it('describes presented host keys with key, algorithm, and fingerprint metadata', () => {
    const blob = publicKeyBlob('ecdsa-sha2-nistp256')
    const description = describePresentedHostKey(blob)

    expect(description.key).toBe(blob.toString('base64'))
    expect(description.algorithm).toBe('ecdsa-sha2-nistp256')
    expect(description.fingerprintSHA256).toMatch(/^SHA256:/)
  })

  it('normalizes legacy stored base64 keys into records', () => {
    const blob = publicKeyBlob('ssh-ed25519')
    const record = normalizeStoredHostKey('devbox:2222', blob.toString('base64'))

    expect(record.id).toBe('devbox:2222')
    expect(record.host).toBe('devbox')
    expect(record.port).toBe(2222)
    expect(record.source).toBe('legacy')
    expect(record.algorithm).toBe('ssh-ed25519')
  })

  it('preserves legacy storage ids so they can be forgotten from settings', () => {
    const blob = publicKeyBlob('ssh-ed25519')
    const record = normalizeStoredHostKey('devbox', blob.toString('base64'))

    expect(record.id).toBe('devbox')
    expect(record.host).toBe('devbox')
    expect(record.port).toBe(22)
  })

  it('formats host key verification messages', () => {
    const record = createHostKeyRecord({
      host: 'devbox',
      port: 22,
      key: publicKeyBlob('ssh-ed25519').toString('base64'),
      algorithm: 'ssh-ed25519',
      fingerprintSHA256: 'SHA256:abc'
    })

    expect(hostKeyId('devbox', 22)).toBe('devbox:22')
    expect(hostKeyVerificationMessage({
      status: 'matched-stored',
      hostKeyId: record.id,
      host: record.host,
      port: record.port,
      algorithm: record.algorithm,
      fingerprintSHA256: record.fingerprintSHA256,
      trustedAt: record.trustedAt
    })).toContain('Matched trusted ssh-ed25519 host key')
  })
})
