import { useState, useEffect } from 'react'
import { APP_THEMES, type AppTheme, type FlingSettings } from '../../../main/types'

const THEME_LABELS: Record<AppTheme, string> = {
  terminal: 'Terminal Green',
  graphite: 'Graphite',
  light: 'Light'
}

export default function SettingsPanel({
  settings,
  onSettingsUpdated,
  onSettingsPreview
}: {
  settings: FlingSettings | null
  onSettingsUpdated: (settings: FlingSettings) => void
  onSettingsPreview: (settings: FlingSettings) => void
}) {
  const [draft, setDraft] = useState<FlingSettings | null>(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const handleChange = (field: keyof FlingSettings, value: string | number) => {
    if (!draft) return
    setDraft({ ...draft, [field]: value })
  }

  const handleThemeChange = (theme: AppTheme) => {
    if (!draft) return
    const updatedDraft = { ...draft, theme }
    setDraft(updatedDraft)
    onSettingsPreview(updatedDraft)
  }

  const handleSave = async () => {
    if (!draft) return
    const updated = await window.fling.updateSettings(draft)
    setDraft(updated)
    onSettingsUpdated(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!draft) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="theme-muted text-xs animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 animate-fade-in">
      <h2 className="theme-section-title text-xs font-semibold uppercase tracking-[0.2em]">
        Appearance
      </h2>

      <ThemePicker value={draft.theme} onChange={handleThemeChange} />

      <div className="theme-divider h-px my-1" />

      <h2 className="theme-section-title text-xs font-semibold uppercase tracking-[0.2em]">
        Connection
      </h2>

      <Field
        label="Host"
        value={draft.host}
        onChange={(v) => handleChange('host', v)}
        placeholder="server-name or 100.x.x.x"
      />

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Port"
          value={String(draft.port)}
          onChange={(v) => handleChange('port', parseInt(v) || 22)}
          placeholder="22"
        />
        <Field
          label="Username"
          value={draft.username}
          onChange={(v) => handleChange('username', v)}
          placeholder="your-user"
        />
      </div>

      <Field
        label="Remote Path"
        value={draft.remotePath}
        onChange={(v) => handleChange('remotePath', v)}
        placeholder="~/shared"
      />

      <Field
        label="SSH Key Path"
        value={draft.keyPath}
        onChange={(v) => handleChange('keyPath', v)}
        placeholder="~/.ssh/id_ed25519"
      />

      <div className="theme-divider h-px my-1" />

      <h2 className="theme-section-title text-xs font-semibold uppercase tracking-[0.2em]">
        Screenshots
      </h2>

      <Field
        label="Screenshot Directory"
        value={draft.screenshotDir}
        onChange={(v) => handleChange('screenshotDir', v)}
        placeholder="~/Desktop/screenshots"
      />

      <div className="theme-divider h-px my-1" />

      <button
        onClick={handleSave}
        className={`
          w-full py-2 rounded-lg text-xs font-medium tracking-wide transition-all
          ${saved ? 'theme-secondary-button-saved' : 'theme-secondary-button'}
        `}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}

function ThemePicker({
  value,
  onChange
}: {
  value: AppTheme
  onChange: (theme: AppTheme) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
      {APP_THEMES.map((theme) => {
        const selected = theme === value
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(theme)}
            className={`
              rounded-lg border px-2 py-2 text-[10px] font-medium tracking-wide transition-all
              ${selected ? 'theme-primary-button' : 'theme-dropzone'}
            `}
          >
            {THEME_LABELS[theme]}
          </button>
        )
      })}
    </div>
  )
}

// ─── Reusable Input Field ────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="theme-muted text-[10px] font-medium tracking-wide">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="theme-input rounded-lg px-2.5 py-1.5 text-xs font-mono transition-all focus:outline-none"
      />
    </label>
  )
}
