import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ConnectionTestResult, FlingSettings, HistoryItem, HostKeyRecord, SendProgress } from '../main/types'

const api = {
  sendFile: (opts: { filePath?: string; isScreenshot?: boolean }) =>
    ipcRenderer.invoke('filefling:sendFile', opts),

  getSettings: (): Promise<FlingSettings> =>
    ipcRenderer.invoke('filefling:getSettings'),

  updateSettings: (patch: Partial<FlingSettings>): Promise<FlingSettings> =>
    ipcRenderer.invoke('filefling:updateSettings', patch),

  testConnection: (patch: Partial<FlingSettings>): Promise<ConnectionTestResult> =>
    ipcRenderer.invoke('filefling:testConnection', patch),

  getHostKeys: (): Promise<HostKeyRecord[]> =>
    ipcRenderer.invoke('filefling:getHostKeys'),

  forgetHostKey: (hostKeyId: string): Promise<void> =>
    ipcRenderer.invoke('filefling:forgetHostKey', hostKeyId),

  getHistory: (): Promise<HistoryItem[]> =>
    ipcRenderer.invoke('filefling:getHistory'),

  clearHistory: (): Promise<void> =>
    ipcRenderer.invoke('filefling:clearHistory'),

  getPathForFile: (file: File): string =>
    webUtils.getPathForFile(file),

  onStatus: (callback: (progress: SendProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: SendProgress) => {
      callback(progress)
    }
    ipcRenderer.on('filefling:status', handler)
    // Return an unsubscribe function
    return () => ipcRenderer.removeListener('filefling:status', handler)
  }
}

export type FileFlingApi = typeof api

contextBridge.exposeInMainWorld('filefling', api)
