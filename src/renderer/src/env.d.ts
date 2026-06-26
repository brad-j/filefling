/// <reference types="vite/client" />

interface Window {
  filefling: {
    sendFile: (opts: { filePath?: string; isScreenshot?: boolean }) => Promise<void>
    getSettings: () => Promise<import('../../main/types').FlingSettings>
    updateSettings: (patch: Partial<import('../../main/types').FlingSettings>) => Promise<import('../../main/types').FlingSettings>
    testConnection: (patch: Partial<import('../../main/types').FlingSettings>) => Promise<import('../../main/types').ConnectionTestResult>
    getHostKeys: () => Promise<import('../../main/types').HostKeyRecord[]>
    forgetHostKey: (hostKeyId: string) => Promise<void>
    getHistory: () => Promise<import('../../main/types').HistoryItem[]>
    clearHistory: () => Promise<void>
    getPathForFile: (file: File) => string
    onStatus: (callback: (progress: import('../../main/types').SendProgress) => void) => () => void
  }
}
