import { app, globalShortcut, nativeImage, ipcMain } from 'electron'
import { menubar } from 'menubar'
import type { Menubar } from 'menubar'
import { join } from 'path'
import { sendFile, getHistory, clearHistory, setStatusWindow, onStatus } from './sender'
import { getSettings, updateSettings } from './settings'
import type { FlingSettings, SendStatus } from './types'

let mb: Menubar | null = null

// ─── Tray Icon States ────────────────────────────────────────────────

const ICON_SIZE = 16

function createIconSVG(state: SendStatus): string {
  const colors: Record<SendStatus, string> = {
    idle: '#8b8b8b',
    sending: '#6366f1',
    success: '#22c55e',
    error: '#ef4444'
  }
  const color = colors[state]

  // Arrow-up-in-a-box glyph — represents flinging a file up/out
  return `<svg width="${ICON_SIZE * 2}" height="${ICON_SIZE * 2}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 4 L16 22 M8 12 L16 4 L24 12" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M6 26 L26 26" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  </svg>`
}

function createTrayImage(state: SendStatus = 'idle'): nativeImage {
  const svg = createIconSVG(state)
  const img = nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  )
  img.setTemplateImage(true)
  return img
}

function setTrayIconState(state: SendStatus): void {
  if (mb?.tray) {
    mb.tray.setImage(createTrayImage(state))
  }

  // Reset to idle after success/error flash
  if (state === 'success' || state === 'error') {
    setTimeout(() => {
      if (mb?.tray) {
        mb.tray.setImage(createTrayImage('idle'))
      }
    }, 2000)
  }
}

// ─── Menubar Setup ───────────────────────────────────────────────────

function createMenubar(): void {
  const preloadPath = join(__dirname, '../preload/index.js')

  mb = menubar({
    icon: createTrayImage('idle'),
    browserWindow: {
      width: 360,
      height: 480,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      transparent: true,
      frame: false,
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    }
  })

  mb.on('after-create-window', () => {
    if (mb?.window) {
      setStatusWindow(mb.window)
    }
  })

  mb.on('ready', () => {
    if (mb?.tray) {
      mb.tray.setToolTip('Fling — drop to send')
    }
  })

  // Update tray icon on status changes
  onStatus((progress) => {
    setTrayIconState(progress.status)
  })
}

// ─── IPC Handlers ────────────────────────────────────────────────────

function registerIpc(): void {
  ipcMain.handle('fling:sendFile', (_event, opts: { filePath?: string; isScreenshot?: boolean }) => {
    return sendFile(opts)
  })

  ipcMain.handle('fling:getSettings', () => {
    return getSettings()
  })

  ipcMain.handle('fling:updateSettings', (_event, patch: Partial<FlingSettings>) => {
    return updateSettings(patch)
  })

  ipcMain.handle('fling:getHistory', () => {
    return getHistory()
  })

  ipcMain.handle('fling:clearHistory', () => {
    clearHistory()
  })
}

// ─── Global Hotkey ───────────────────────────────────────────────────

function registerHotkey(): void {
  const ret = globalShortcut.register('CommandOrControl+Shift+F', () => {
    // Immediately send latest screenshot without opening the dropdown
    sendFile({ isScreenshot: true })
  })

  if (!ret) {
    console.error('Failed to register global hotkey Cmd+Shift+F')
  }
}

// ─── App Ready ───────────────────────────────────────────────────────

app.whenReady().then(() => {
  createMenubar()
  registerIpc()
  registerHotkey()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Menubar-only: don't show in dock
app.dock?.hide?.()
