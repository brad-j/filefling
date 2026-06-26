import { Client } from 'ssh2'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getSettings, readPrivateKey, getHostKey, setHostKey } from './settings'
import { expandRemoteDir, joinRemotePath, shellQuote, stripTrailingSlash } from './remotePath'

export interface SshResult {
  remotePath: string
}

/**
 * Reads ~/.ssh/known_hosts and returns the host key for the given host, if present.
 */
function readKnownHosts(host: string, port: number): string | undefined {
  const knownHostsPath = join(homedir(), '.ssh', 'known_hosts')
  try {
    const content = readFileSync(knownHostsPath, 'utf8')
    for (const line of content.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 3) continue
      const hosts = parts[0]
      const keyData = parts[2]
      const hostEntries = hosts.split(',')

      // known_hosts can have comma-separated hostnames or hashed entries.
      // Hashed entries are intentionally not decoded here; TOFU storage below
      // still protects future connections made by Fling.
      if (hostEntries.includes(host) || hostEntries.includes(`[${host}]:${port}`)) {
        return keyData
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

export async function flingFile(
  localPath: string,
  remoteFilename: string
): Promise<SshResult> {
  const settings = getSettings()
  const privateKey = readPrivateKey(settings.keyPath)
  const hostKeyId = `${settings.host}:${settings.port}`
  const knownKey = getHostKey(hostKeyId) || getHostKey(settings.host) || readKnownHosts(settings.host, settings.port)

  const conn = new Client()

  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (err?: Error, result?: SshResult) => {
      if (settled) return
      settled = true
      conn.end()
      if (err) reject(err)
      else resolve(result!)
    }

    conn.on('ready', async () => {
      try {
        const homeDir = stripTrailingSlash((await runCommand(conn, 'printf %s "$HOME"')).trim())
        const remoteDir = expandRemoteDir(settings.remotePath, homeDir || '.')
        const remotePath = joinRemotePath(remoteDir, remoteFilename)

        await runCommand(conn, `mkdir -p -- ${shellQuote(remoteDir)}`)
        await fastPut(conn, localPath, remotePath)
        finish(undefined, { remotePath })
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)))
      }
    })

    conn.on('error', (err) => {
      finish(err)
    })

    conn.connect({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      privateKey,
      hostVerifier: (key: Buffer) => {
        const presentedKey = key.toString('base64')
        if (knownKey) {
          return knownKey.trim() === presentedKey
        }

        // No known key — trust on first use.
        setHostKey(hostKeyId, presentedKey)
        return true
      }
    })
  })
}
