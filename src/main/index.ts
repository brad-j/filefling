import { app, globalShortcut, nativeImage, ipcMain, type NativeImage } from 'electron'
import { menubar } from 'menubar'
import type { Menubar } from 'menubar'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { sendFile, getHistory, clearHistory, setStatusWindow, onStatus } from './sender'
import { getSettings, updateSettings } from './settings'
import { validateSendFileOptions, validateSettingsPatch } from './validation'
import type { SendStatus } from './types'

let mb: Menubar | null = null

// ─── Tray Icon States ────────────────────────────────────────────────

const ICON_FILES: Record<SendStatus, string> = {
  idle: 'idleTemplate.png',
  sending: 'sending.png',
  success: 'success.png',
  error: 'error.png'
}

function createTrayImage(state: SendStatus = 'idle'): NativeImage {
  const imagePath = join(__dirname, 'icons', ICON_FILES[state])
  const img = nativeImage.createFromPath(imagePath)

  if (img.isEmpty()) {
    console.error(`[fling] Failed to load tray icon: ${imagePath}`)
  }

  // Only idle should be a template image. Colored status flashes should keep
  // their actual colors.
  img.setTemplateImage(state === 'idle')
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
  const preloadPath = join(__dirname, '../preload/index.cjs')
  const rendererIndex = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(join(__dirname, '../renderer/index.html')).toString()

  mb = menubar({
    index: rendererIndex,
    icon: createTrayImage('idle'),
    preloadWindow: true,
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
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    }
  })

  mb.on('after-create-window', () => {
    if (mb?.window) {
      setStatusWindow(mb.window)

      mb.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

      mb.window.webContents.on('will-navigate', (event, url) => {
        if (url !== rendererIndex) {
          event.preventDefault()
        }
      })

      mb.window.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'Escape') {
          event.preventDefault()
          mb?.hideWindow()
        }
      })
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
  ipcMain.handle('fling:sendFile', (_event, opts: unknown) => {
    return sendFile(validateSendFileOptions(opts))
  })

  ipcMain.handle('fling:getSettings', () => {
    return getSettings()
  })

  ipcMain.handle('fling:updateSettings', (_event, patch: unknown) => {
    return updateSettings(validateSettingsPatch(patch))
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
