import { Client } from 'ssh2'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getSettings, readPrivateKey, getHostKeyRecord, setHostKeyRecord } from './settings'
import { expandRemoteDir, joinRemotePath, shellQuote, stripTrailingSlash } from './remotePath'
import { describeFileFlingError } from './errors'
import {
  createHostKeyRecord,
  describePresentedHostKey,
  hostKeyId,
  hostKeysMatch,
  hostKeyVerificationMessage
} from './hostKeys'
import type { ConnectionTestCheck, ConnectionTestResult, FlingSettings, HostKeyRecord, HostKeyVerificationResult } from './types'

export interface SshResult {
  remotePath: string
}

/**
 * Reads ~/.ssh/known_hosts and returns the host key for the given host, if present.
 */
function readKnownHosts(host: string, port: number): HostKeyRecord | undefined {
  const knownHostsPath = join(homedir(), '.ssh', 'known_hosts')
  try {
    const content = readFileSync(knownHostsPath, 'utf8')
    for (const line of content.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 3) continue
      const hosts = parts[0]
      const algorithm = parts[1]
      const keyData = parts[2]
      const hostEntries = hosts.split(',')

      // known_hosts can have comma-separated hostnames or hashed entries.
      // Hashed entries are intentionally not decoded here; TOFU storage below
      // still protects future connections made by Fling.
      if (hostEntries.includes(host) || hostEntries.includes(`[${host}]:${port}`)) {
        const key = Buffer.from(keyData, 'base64')
        const presented = describePresentedHostKey(key)
        return createHostKeyRecord({
          host,
          port,
          key: keyData,
          algorithm: algorithm || presented.algorithm,
          fingerprintSHA256: presented.fingerprintSHA256,
          trustedAt: 0,
          source: 'known_hosts'
        })
      }
    }
  } catch {
    // known_hosts doesn't exist or isn't readable
  }
  return undefined
}

function runCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      let stdout = ''
      let stderr = ''
      stream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      stream.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      stream.on('close', (code: number | null) => {
        if (code && code !== 0) {
          reject(new Error(stderr.trim() || `Remote command failed with exit code ${code}`))
          return
        }
        resolve(stdout)
      })
    })
  })
}

function fastPut(conn: Client, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err)
        return
      }

      sftp.fastPut(localPath, remotePath, (putErr) => {
        if (putErr) {
          reject(putErr)
          return
        }
        resolve()
      })
    })
  })
}

function assertConnectionSettings(settings: FlingSettings): void {
  const missing: string[] = []
  if (!settings.host.trim()) missing.push('host')
  if (!settings.username.trim()) missing.push('username')
  if (!settings.remotePath.trim()) missing.push('remote path')
  if (!settings.keyPath.trim()) missing.push('SSH key path')

  if (missing.length > 0) {
    throw new Error(`Missing required connection settings: ${missing.join(', ')}`)
  }
}

interface SshConnection {
  conn: Client
  hostKey?: HostKeyVerificationResult
}

function attachHostKeyVerification(err: Error, hostKey?: HostKeyVerificationResult): Error {
  if (hostKey) {
    Object.assign(err, { hostKeyVerification: hostKey })
  }
  return err
}

function readAttachedHostKeyVerification(err: unknown): HostKeyVerificationResult | undefined {
  if (typeof err !== 'object' || err === null || !('hostKeyVerification' in err)) return undefined
  return (err as { hostKeyVerification?: HostKeyVerificationResult }).hostKeyVerification
}

function connect(settings: FlingSettings): Promise<SshConnection> {
  assertConnectionSettings(settings)

  const privateKey = readPrivateKey(settings.keyPath)
  const id = hostKeyId(settings.host, settings.port)
  const storedKey = getHostKeyRecord(id, settings.host, settings.port) || getHostKeyRecord(settings.host, settings.host, settings.port)
  const knownHostsKey = readKnownHosts(settings.host, settings.port)
  const knownKey = storedKey || knownHostsKey
  const conn = new Client()
  let hostKeyVerification: HostKeyVerificationResult | undefined

  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      if (err) {
        conn.end()
        reject(attachHostKeyVerification(err, hostKeyVerification))
      } else {
        resolve({ conn, hostKey: hostKeyVerification })
      }
    }

    conn.on('ready', () => finish())
    conn.on('error', (err) => finish(err))

    conn.connect({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      privateKey,
      readyTimeout: 15000,
      hostVerifier: (key: Buffer) => {
        const presented = describePresentedHostKey(key)

        if (knownKey) {
          if (hostKeysMatch(knownKey, presented.key)) {
            hostKeyVerification = {
              status: knownKey.source === 'known_hosts' ? 'matched-known-hosts' : 'matched-stored',
              hostKeyId: id,
              host: settings.host,
              port: settings.port,
              algorithm: knownKey.algorithm || presented.algorithm,
              fingerprintSHA256: knownKey.fingerprintSHA256 || presented.fingerprintSHA256,
              trustedAt: knownKey.trustedAt
            }
            return true
          }

          hostKeyVerification = {
            status: 'mismatch',
            hostKeyId: id,
            host: settings.host,
            port: settings.port,
            algorithm: presented.algorithm,
            fingerprintSHA256: presented.fingerprintSHA256,
            previousAlgorithm: knownKey.algorithm,
            previousFingerprintSHA256: knownKey.fingerprintSHA256,
            trustedAt: knownKey.trustedAt
          }
          return false
        }

        // No known key — trust on first use and store metadata for future UX.
        const record = createHostKeyRecord({
          host: settings.host,
          port: settings.port,
          key: presented.key,
          algorithm: presented.algorithm,
          fingerprintSHA256: presented.fingerprintSHA256
        })
        setHostKeyRecord(record)
        hostKeyVerification = {
          status: 'trusted-new',
          hostKeyId: id,
          host: settings.host,
          port: settings.port,
          algorithm: record.algorithm,
          fingerprintSHA256: record.fingerprintSHA256,
          trustedAt: record.trustedAt
        }
        return true
      }
    })
  })
}

export async function flingFile(
  localPath: string,
  remoteFilename: string
): Promise<SshResult> {
  const settings = getSettings()
  const { conn } = await connect(settings)

  try {
    const homeDir = stripTrailingSlash((await runCommand(conn, 'printf %s "$HOME"')).trim())
    const remoteDir = expandRemoteDir(settings.remotePath, homeDir || '.')
    const remotePath = joinRemotePath(remoteDir, remoteFilename)

    await runCommand(conn, `mkdir -p -- ${shellQuote(remoteDir)}`)
    await fastPut(conn, localPath, remotePath)
    return { remotePath }
  } finally {
    conn.end()
  }
}

export async function testConnection(settings: FlingSettings = getSettings()): Promise<ConnectionTestResult> {
  const checks: ConnectionTestCheck[] = [
    { id: 'settings', label: 'Required settings present', status: 'pending' },
    { id: 'host-key', label: 'Host key trust', status: 'pending' },
    { id: 'ssh', label: 'SSH authentication', status: 'pending' },
    { id: 'remote-dir', label: 'Remote directory writable', status: 'pending' },
    { id: 'upload', label: 'Test upload and cleanup', status: 'pending' }
  ]

  const mark = (id: string, status: ConnectionTestCheck['status'], message?: string) => {
    const check = checks.find((item) => item.id === id)
    if (check) {
      check.status = status
      check.message = message
    }
  }

  let conn: Client | null = null
  let tempDir = ''

  try {
    assertConnectionSettings(settings)
    mark('settings', 'success')

    tempDir = mkdtempSync(join(tmpdir(), 'filefling-test-'))
    const testFilename = `.filefling-test-${Date.now()}-${randomUUID()}.txt`
    const localTestPath = join(tempDir, testFilename)
    writeFileSync(localTestPath, 'FileFling connection test\n')

    const connection = await connect(settings)
    conn = connection.conn
    if (connection.hostKey) {
      mark('host-key', 'success', hostKeyVerificationMessage(connection.hostKey))
    }
    mark('ssh', 'success', `Connected as ${settings.username}@${settings.host}`)

    const homeDir = stripTrailingSlash((await runCommand(conn, 'printf %s "$HOME"')).trim())
    const remoteDir = expandRemoteDir(settings.remotePath, homeDir || '.')
    const remotePath = joinRemotePath(remoteDir, testFilename)

    await runCommand(conn, `mkdir -p -- ${shellQuote(remoteDir)}`)
    try {
      await runCommand(conn, `test -d ${shellQuote(remoteDir)} && test -w ${shellQuote(remoteDir)}`)
    } catch {
      throw new Error(`Remote directory is not writable: ${remoteDir}`)
    }
    mark('remote-dir', 'success', remoteDir)

    await fastPut(conn, localTestPath, remotePath)
    await runCommand(conn, `rm -f -- ${shellQuote(remotePath)}`)
    mark('upload', 'success', remotePath)

    return {
      ok: true,
      message: `Connected to ${settings.host}. Test upload succeeded.`,
      remotePath,
      hostKey: connection.hostKey,
      checks
    }
  } catch (err) {
    const friendlyError = describeFileFlingError(err)
    const message = friendlyError.message
    const hostKeyVerification = readAttachedHostKeyVerification(err)

    if (hostKeyVerification) {
      mark(
        'host-key',
        hostKeyVerification.status === 'mismatch' ? 'error' : 'success',
        hostKeyVerificationMessage(hostKeyVerification)
      )
    }

    const firstPending = checks.find((check) => check.status === 'pending')
    if (firstPending) {
      firstPending.status = 'error'
      firstPending.message = message
    }

    return {
      ok: false,
      message,
      hostKey: hostKeyVerification,
      checks
    }
  } finally {
    conn?.end()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}
