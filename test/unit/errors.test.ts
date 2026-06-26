import { describe, expect, it } from 'vitest'
import { describeFileFlingError } from '../../src/main/errors'

function codedError(message: string, code: string): Error & { code: string } {
  return Object.assign(new Error(message), { code })
}

describe('friendly error mapping', () => {
  it('maps DNS failures to actionable host messages', () => {
    const friendly = describeFileFlingError(codedError('getaddrinfo ENOTFOUND devbox', 'ENOTFOUND'))

    expect(friendly.kind).toBe('dns-failure')
    expect(friendly.message).toMatch(/resolved/i)
  })

  it('maps missing SSH keys to key-path guidance', () => {
    const friendly = describeFileFlingError(codedError("ENOENT: no such file, open '/Users/alice/.ssh/id_ed25519'", 'ENOENT'))

    expect(friendly.kind).toBe('missing-key')
    expect(friendly.message).toMatch(/SSH key file was not found/)
  })

  it('maps auth failures to username/key guidance', () => {
    const friendly = describeFileFlingError(new Error('All configured authentication methods failed'))

    expect(friendly.kind).toBe('auth-failed')
    expect(friendly.message).toMatch(/authorized_keys/)
  })

  it('maps host-key failures to server identity warnings', () => {
    const friendly = describeFileFlingError(new Error('Host denied (verification failed)'))

    expect(friendly.kind).toBe('host-key-mismatch')
    expect(friendly.message).toMatch(/server identity/)
  })

  it('includes host-key mismatch fingerprints when verification metadata is attached', () => {
    const err = Object.assign(new Error('Host denied (verification failed)'), {
      hostKeyVerification: {
        status: 'mismatch' as const,
        hostKeyId: 'devbox:22',
        host: 'devbox',
        port: 22,
        algorithm: 'ssh-ed25519',
        fingerprintSHA256: 'SHA256:new',
        previousAlgorithm: 'ssh-ed25519',
        previousFingerprintSHA256: 'SHA256:old'
      }
    })
    const friendly = describeFileFlingError(err)

    expect(friendly.kind).toBe('host-key-mismatch')
    expect(friendly.message).toContain('SHA256:old')
    expect(friendly.message).toContain('SHA256:new')
  })

  it('maps remote write failures to remote path guidance', () => {
    const friendly = describeFileFlingError(new Error('Remote directory is not writable: /srv/uploads'))

    expect(friendly.kind).toBe('remote-path-not-writable')
    expect(friendly.message).toMatch(/Remote directory is not writable/)
  })

  it('maps local missing files separately from missing keys', () => {
    const friendly = describeFileFlingError(new Error('File does not exist: /tmp/missing.png'))

    expect(friendly.kind).toBe('local-file-missing')
    expect(friendly.message).toMatch(/local file/i)
  })
})
