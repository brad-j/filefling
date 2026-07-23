import { useState, useEffect, useCallback } from 'react'
import DropZone from './components/DropZone'
import History from './components/History'
import OnboardingPanel from './components/OnboardingPanel'
import SettingsPanel from './components/SettingsPanel'
import { useFlingStatus } from './hooks/useFlingStatus'
import type { AppTheme, DestinationProfile, FlingSettings, HistoryItem } from '../../main/types'

type View = 'main' | 'settings' | 'onboarding'

const DEFAULT_THEME: AppTheme = 'graphite'

export default function App() {
  const [view, setView] = useState<View>('main')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [settings, setSettings] = useState<FlingSettings | null>(null)
  const { status, progress } = useFlingStatus()
  const theme = settings?.theme ?? DEFAULT_THEME

  const previewSettings = useCallback((draftSettings: FlingSettings) => {
    setSettings(draftSettings)
  }, [])

  const refreshHistory = useCallback(async () => {
    const items = await window.filefling.getHistory()
    setHistory(items)
  }, [])

  const refreshSettings = useCallback(async () => {
    const loadedSettings = await window.filefling.getSettings()
    setSettings(loadedSettings)
  }, [])

  const selectDestination = useCallback(async (profileId: string) => {
    const updatedSettings = await window.filefling.updateSettings({ activeProfileId: profileId })
    setSettings(updatedSettings)
  }, [])

  useEffect(() => {
    refreshHistory()
    refreshSettings()
  }, [refreshHistory, refreshSettings])

  useEffect(() => {
    if (settings && !settings.onboardingComplete) {
      setView('onboarding')
    }
  }, [settings])

  // Refresh history when a send completes
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const timer = setTimeout(refreshHistory, 500)
      return () => clearTimeout(timer)
    }
  }, [status, refreshHistory])

  return (
    <div data-theme={theme} className="filefling-window w-full h-full flex flex-col">
      {/* ─── Header ─── */}
      <header className="theme-header app-header flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <FlingLogo state={status} />
          <h1 className="theme-title text-sm font-semibold">FileFling</h1>
        </div>
        {view === 'settings' ? (
          <button
            onClick={() => setView('main')}
            className="theme-link text-xs transition-colors"
          >
            Done
          </button>
        ) : view === 'onboarding' ? null : (
          <button
            onClick={() => setView('settings')}
            className="theme-icon-button transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </header>

      {/* ─── Content ─── */}
      <div className="flex-1 overflow-y-auto">
        {view === 'onboarding' ? (
          <OnboardingPanel
            settings={settings}
            onComplete={(updatedSettings) => {
              setSettings(updatedSettings)
              setView('main')
            }}
          />
        ) : view === 'main' ? (
          <div className="home-view flex flex-col gap-3 p-4 animate-fade-in">
            {settings && (
              <DestinationSwitcher
                profiles={settings.profiles}
                activeProfileId={settings.activeProfileId}
                onSelect={selectDestination}
              />
            )}
            <DropZone status={status} progress={progress} />
            <History items={history} onClear={refreshHistory} />
          </div>
        ) : (
          <SettingsPanel
            settings={settings}
            onSettingsUpdated={setSettings}
            onSettingsPreview={previewSettings}
          />
        )}
      </div>

      {/* ─── Footer ─── */}
      <footer className="theme-footer px-4 py-2 border-t">
        <p className="theme-muted-soft text-[10px] text-center tracking-wide">
          {view === 'onboarding' ? 'Files are sent securely over SSH' : <><span className="theme-hotkey">⌘⇧F</span> sends the latest screenshot</>}
        </p>
      </footer>
    </div>
  )
}

function DestinationSwitcher({
  profiles,
  activeProfileId,
  onSelect
}: {
  profiles: DestinationProfile[]
  activeProfileId: string
  onSelect: (profileId: string) => void
}) {
  if (profiles.length <= 1) return null

  return (
    <label className="destination-switcher">
      <span>Sending to</span>
      <select
        value={activeProfileId}
        onChange={(event) => onSelect(event.target.value)}
        className="theme-input"
        aria-label="Destination"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </label>
  )
}

// ─── FileFling Logo (animated state) ─────────────────────────────────

function FlingLogo({ state }: { state: string }) {
  const colors: Record<string, string> = {
    idle: 'var(--accent)',
    sending: 'var(--status-sending)',
    success: 'var(--success)',
    error: 'var(--error)'
  }
  const color = colors[state] || colors.idle
  const animClass = state === 'sending' ? 'animate-pulse-fast' : ''

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 32 32"
      fill="none"
      className={`${animClass} theme-logo`}
    >
      <path
        d="M16 4 L16 22 M8 12 L16 4 L24 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6 26 L26 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
