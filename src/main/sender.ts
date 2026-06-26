import { BrowserWindow, clipboard, Notification } from 'electron'
import { EventEmitter } from 'events'
import { statSync } from 'fs'
import { basename } from 'path'
import { flingFile } from './ssh'
import { getLatestScreenshot, sanitizeFilename, timestampFilename } from './files'
import { getSettings, addHistoryItem, clearHistory, getHistory } from './settings'
import type { SendProgress, HistoryItem } from './types'
import { randomUUID } from 'crypto'

const emitter = new EventEmitter()
emitter.setMaxListeners(20)

let statusWindow: BrowserWindow | null = null

export function setStatusWindow(win: BrowserWindow | null): void {
  statusWindow = win
}

export function onStatus(callback: (progress: SendProgress) => void): void {
  emitter.on('status', callback)
}

function broadcastStatus(progress: SendProgress): void {
  emitter.emit('status', progress)
  if (statusWindow && !statusWindow.isDestroyed()) {
    statusWindow.webContents.send('fling:status', progress)
  }
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
}

function assertReadableFile(filePath: string): void {
  let stat
  try {
    stat = statSync(filePath)
  } catch {
    throw new Error(`File does not exist: ${filePath}`)
  }

  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`)
  }
}

/**
 * Core send flow:
 * 1. Resolve local file path (explicit or latest screenshot)
 * 2. Determine remote filename (timestamp for screenshots, sanitized for explicit files)
 * 3. Upload via SSH/SFTP
 * 4. On success: notification + clipboard copy + history
 * 5. On error: notification + history
 */
export async function sendFile(opts: {
  filePath?: string
  isScreenshot?: boolean
}): Promise<void> {
  const settings = getSettings()
  const isScreenshot = opts.isScreenshot ?? true

  if (!settings.host.trim() || !settings.username.trim() || !settings.remotePath.trim() || !settings.keyPath.trim()) {
    const error = 'Configure host, username, remote path, and SSH key path before sending'
    broadcastStatus({ status: 'error', error })
    notify('Fling — Setup required', error)
    return
  }

  // Resolve local file
  let localPath: string
  if (opts.filePath) {
    localPath = opts.filePath
  } else {
    const latest = getLatestScreenshot()
    if (!latest) {
      broadcastStatus({ status: 'error', error: 'No screenshots found' })
      notify('Fling — Error', 'No screenshots found in your screenshot directory')
      return
    }
    localPath = latest
  }

  // Determine remote filename
  const localBasename = basename(localPath) || 'screenshot.png'
  const remoteFilename = isScreenshot
    ? timestampFilename(localBasename)
    : sanitizeFilename(localBasename)

  broadcastStatus({ status: 'sending', filename: remoteFilename })

  try {
    assertReadableFile(localPath)
    const result = await flingFile(localPath, remoteFilename)

    // Copy remote path to clipboard
    clipboard.writeText(result.remotePath)

    // Notify
    notify('Fling — Sent', `${remoteFilename} → ${settings.host}`)
    broadcastStatus({ status: 'success', filename: remoteFilename, remotePath: result.remotePath })

    // Add to history
    const historyItem: HistoryItem = {
      id: randomUUID(),
      filename: remoteFilename,
      remotePath: result.remotePath,
      timestamp: Date.now(),
      status: 'success'
    }
    addHistoryItem(historyItem)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    notify('Fling — Error', `Failed to send ${remoteFilename}: ${errorMsg}`)
    broadcastStatus({ status: 'error', filename: remoteFilename, error: errorMsg })

    const historyItem: HistoryItem = {
      id: randomUUID(),
      filename: remoteFilename,
      remotePath: '',
      timestamp: Date.now(),
      status: 'error',
      error: errorMsg
    }
    addHistoryItem(historyItem)
  }
}

export { getHistory, clearHistory }
