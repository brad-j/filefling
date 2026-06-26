import { useState, useEffect } from 'react'
import { APP_THEMES, type AppTheme, type FlingSettings, type HostKeyRecord } from '../../../main/types'

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
  const [hostKeys, setHostKeys] = useState<HostKeyRecord[]>([])

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  useEffect(() => {
    window.filefling.getHostKeys().then(setHostKeys)
  }, [])

  const refreshHostKeys = async () => {
    setHostKeys(await window.filefling.getHostKeys())
  }

  const handleForgetHostKey = async (hostKeyId: string) => {
    await window.filefling.forgetHostKey(hostKeyId)
    await refreshHostKeys()
  }

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
    const updated = await window.filefling.updateSettings(draft)
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

      <HostKeySection hostKeys={hostKeys} onForget={handleForgetHostKey} />

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

function formatTrustedAt(timestamp: number): string {
  if (!timestamp) return 'legacy trust'
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function HostKeySection({
  hostKeys,
  onForget
}: {
  hostKeys: HostKeyRecord[]
  onForget: (hostKeyId: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="theme-muted text-[10px] font-medium tracking-wide">Trusted Host Keys</h3>
        <span className="theme-muted-soft text-[9px]">TOFU</span>
      </div>

      {hostKeys.length === 0 ? (
        <div className="theme-dropzone rounded-lg border px-2.5 py-2">
          <p className="theme-muted-soft text-[10px] leading-relaxed">
            No FileFling-trusted host keys yet. The first successful connection will trust and store the server key.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {hostKeys.map((hostKey) => (
            <div key={hostKey.id} className="theme-dropzone rounded-lg border px-2.5 py-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="theme-text text-[10px] font-mono truncate">
                  {hostKey.host}:{hostKey.port}
                </p>
                <p className="theme-muted text-[9px] font-mono truncate">
                  {hostKey.algorithm} · {hostKey.fingerprintSHA256}
                </p>
                <p className="theme-muted-soft text-[9px]">
                  Trusted {formatTrustedAt(hostKey.trustedAt)}{hostKey.source === 'legacy' ? ' · migrated legacy key' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onForget(hostKey.id)}
                className="theme-link text-[9px] transition-colors flex-shrink-0"
                title="Forget this host key. The next connection will trust the presented key again."
              >
                Forget
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="theme-muted-soft text-[9px] leading-relaxed">
        If a server is rebuilt or its SSH host key changes, forget the old key here and run the connection test again.
      </p>
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
