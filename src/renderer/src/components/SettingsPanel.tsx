import { useEffect, useMemo, useState } from 'react'
import { APP_THEMES, type AppTheme, type ConnectionTestResult, type DestinationProfile, type FlingSettings, type HostKeyRecord, type SshConfigHost } from '../../../main/types'
import { formatDestinationInput, parseDestinationInput } from '../destinationInput'

const THEME_LABELS: Record<AppTheme, string> = {
  terminal: 'Terminal',
  graphite: 'Dark',
  light: 'Light'
}

export default function SettingsPanel({
  settings,
  onSettingsUpdated,
  setupMode = false,
  onComplete
}: {
  settings: FlingSettings | null
  onSettingsUpdated: (settings: FlingSettings) => void
  onSettingsPreview: (settings: FlingSettings) => void
  setupMode?: boolean
  onComplete?: (settings: FlingSettings) => void
}) {
  const [draft, setDraft] = useState<FlingSettings | null>(settings)
  const [destination, setDestination] = useState('')
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [hostKeys, setHostKeys] = useState<HostKeyRecord[]>([])
  const [sshConfigHosts, setSshConfigHosts] = useState<SshConfigHost[]>([])

  const loadProfile = (next: FlingSettings, profile: DestinationProfile) => {
    const loaded = {
      ...next,
      activeProfileId: profile.id,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      remotePath: profile.remotePath,
      keyPath: profile.keyPath,
      sshConfigHost: profile.sshConfigHost,
      clipboardTemplate: profile.clipboardTemplate
    }
    setDraft(loaded)
    setDestination(formatDestinationInput(profile.host, profile.username, profile.port))
    setName(profile.name === 'Default' || profile.name === 'New destination' ? '' : profile.name)
    setMessage(null)
    setTestResult(null)
  }

  useEffect(() => {
    if (!settings) return
    setDraft(settings)
    setDestination(formatDestinationInput(settings.host, settings.username, settings.port))
    const active = settings.profiles.find((profile) => profile.id === settings.activeProfileId)
    setName(active && active.name !== 'Default' ? active.name : '')
  }, [settings])

  useEffect(() => {
    window.filefling.getHostKeys().then(setHostKeys)
    window.filefling.getSshConfigHosts().then(setSshConfigHosts)
  }, [])

  const parsed = useMemo(() => parseDestinationInput(destination), [destination])

  const updateDraft = (patch: Partial<FlingSettings>) => {
    if (!draft) return
    setDraft({ ...draft, ...patch })
    setSaved(false)
    setMessage(null)
    setTestResult(null)
  }

  const handleDestinationChange = (value: string) => {
    setDestination(value)
    if (!draft) return

    const next = parseDestinationInput(value)
    if (!next) {
      updateDraft({ host: '' })
      return
    }

    const configHost = sshConfigHosts.find((item) => item.alias === next.host)
    const resolvedHost = configHost?.hostName || next.host
    const isExeDev = next.isExeDev || resolvedHost.endsWith('.exe.xyz')
    updateDraft({
      host: resolvedHost,
      username: next.username || configHost?.user || (isExeDev ? 'exedev' : draft.username),
      port: next.port || configHost?.port || 22,
      keyPath: next.keyPath || configHost?.identityFile || draft.keyPath,
      sshConfigHost: configHost?.alias || ''
    })

    if (!name && next.suggestedName) setName(next.suggestedName)
  }

  const syncActiveProfile = (nextDraft: FlingSettings): FlingSettings => {
    const fallbackName = parsed?.suggestedName || nextDraft.host.split('.')[0] || 'Destination'
    return {
      ...nextDraft,
      profiles: nextDraft.profiles.map((profile) => profile.id === nextDraft.activeProfileId
        ? {
            ...profile,
            name: name.trim() || fallbackName,
            host: nextDraft.host,
            port: nextDraft.port,
            username: nextDraft.username,
            remotePath: nextDraft.remotePath,
            keyPath: nextDraft.keyPath,
            sshConfigHost: nextDraft.sshConfigHost,
            clipboardTemplate: nextDraft.clipboardTemplate
          }
        : profile)
    }
  }

  const handleSave = async () => {
    if (!draft || !parsed?.host) {
      setMessage('Enter a server address first.')
      return
    }

    setSaving(true)
    setMessage(null)
    try {
      const ready = syncActiveProfile({ ...draft, onboardingComplete: true })
      const updated = await window.filefling.updateSettings(ready)
      setDraft(updated)
      onSettingsUpdated(updated)
      setSaved(true)
      setMessage(`Saved ${updated.host}`)
      onComplete?.(updated)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (!draft || !parsed?.host) {
      setMessage('Enter a server address first.')
      return
    }

    setTesting(true)
    setMessage(null)
    setTestResult(null)
    try {
      setTestResult(await window.filefling.testConnection(syncActiveProfile(draft)))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(false)
    }
  }

  const createDestination = () => {
    if (!draft) return
    const id = `profile-${Date.now()}`
    const profile: DestinationProfile = {
      id,
      name: 'New destination',
      host: '',
      port: 22,
      username: draft.username,
      remotePath: '~/shared',
      keyPath: draft.keyPath,
      sshConfigHost: '',
      clipboardTemplate: '{{remotePath}}'
    }
    loadProfile({ ...draft, profiles: [...draft.profiles, profile] }, profile)
  }

  const deleteDestination = () => {
    if (!draft || draft.profiles.length <= 1) return
    const remaining = draft.profiles.filter((profile) => profile.id !== draft.activeProfileId)
    loadProfile({ ...draft, profiles: remaining }, remaining[0])
  }

  const forgetHostKey = async (id: string) => {
    await window.filefling.forgetHostKey(id)
    setHostKeys(await window.filefling.getHostKeys())
  }

  if (!draft) {
    return <div className="p-8 text-center theme-muted text-xs">Loading…</div>
  }

  return (
    <div className="simple-settings animate-fade-in">
      <div className="setup-intro">
        <p className="setup-kicker">{setupMode ? 'One quick setup' : 'Destination'}</p>
        <h2>{setupMode ? 'Where should files go?' : 'Send files here'}</h2>
        <p>Paste an IP, hostname, or the same <code>ssh …</code> command you use in Terminal.</p>
      </div>

      {draft.profiles.length > 1 && (
        <label className="simple-field">
          <span>Saved destinations</span>
          <select
            value={draft.activeProfileId}
            onChange={(event) => {
              const profile = draft.profiles.find((item) => item.id === event.target.value)
              if (profile) loadProfile(draft, profile)
            }}
            className="simple-input"
          >
            {draft.profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>
      )}

      <label className="simple-field destination-field">
        <span>Server</span>
        <input
          autoFocus={setupMode}
          value={destination}
          onChange={(event) => handleDestinationChange(event.target.value)}
          placeholder="ssh me@192.168.1.20"
          className="simple-input destination-input"
          list="ssh-destinations"
          spellCheck={false}
        />
        <datalist id="ssh-destinations">
          {sshConfigHosts.map((host) => <option key={host.alias} value={host.alias}>{host.hostName}</option>)}
        </datalist>
        <small>Examples: <code>100.64.1.2</code>, <code>me@server.local</code>, or <code>my-vm.exe.xyz</code></small>
      </label>

      <label className="simple-field">
        <span>Name <em>optional</em></span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={parsed?.suggestedName || 'Home server'}
          className="simple-input"
        />
      </label>

      {draft.host.endsWith('.exe.xyz') && <ExeDevNote host={draft.host} />}

      <details className="simple-disclosure">
        <summary>Connection details</summary>
        <div className="details-grid">
          <SimpleField label="Username" value={draft.username} onChange={(username) => updateDraft({ username })} />
          <SimpleField label="Port" value={String(draft.port)} onChange={(value) => updateDraft({ port: Number(value) || 22 })} />
          <SimpleField label="Upload folder" value={draft.remotePath} onChange={(remotePath) => updateDraft({ remotePath })} />
          <SimpleField label="SSH key" value={draft.keyPath} onChange={(keyPath) => updateDraft({ keyPath })} />
        </div>
      </details>

      <div className="setup-actions">
        <button type="button" onClick={handleSave} disabled={saving} className="simple-primary">
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save destination'}
        </button>
        <button type="button" onClick={handleTest} disabled={testing} className="simple-secondary">
          {testing ? 'Testing…' : 'Test'}
        </button>
      </div>

      {message && <p className={saved ? 'simple-message success' : 'simple-message'}>{message}</p>}
      {testResult && (
        <div className={`test-result ${testResult.ok ? 'success' : 'error'}`}>
          <strong>{testResult.ok ? 'Connection works' : 'Could not connect'}</strong>
          <span>{testResult.message}</span>
        </div>
      )}

      {!setupMode && (
        <>
          <div className="destination-tools">
            <button type="button" onClick={createDestination}>+ Add another</button>
            <button type="button" onClick={deleteDestination} disabled={draft.profiles.length <= 1}>Remove this destination</button>
          </div>

          <details className="simple-disclosure preferences">
            <summary>App preferences</summary>
            <div className="details-stack">
              <SimpleField label="Screenshot folder" value={draft.screenshotDir} onChange={(screenshotDir) => updateDraft({ screenshotDir })} />
              <SimpleField label="Copied text" value={draft.clipboardTemplate} onChange={(clipboardTemplate) => updateDraft({ clipboardTemplate })} />
              <label className="simple-field">
                <span>Appearance</span>
                <select value={draft.theme} onChange={(event) => updateDraft({ theme: event.target.value as AppTheme })} className="simple-input">
                  {APP_THEMES.map((theme) => <option key={theme} value={theme}>{THEME_LABELS[theme]}</option>)}
                </select>
              </label>
            </div>
          </details>

          {hostKeys.length > 0 && (
            <details className="simple-disclosure">
              <summary>Trusted servers ({hostKeys.length})</summary>
              <div className="trusted-list">
                {hostKeys.map((hostKey) => (
                  <div key={hostKey.id}>
                    <span>{hostKey.host}:{hostKey.port}</span>
                    <button type="button" onClick={() => forgetHostKey(hostKey.id)}>Forget</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}

function ExeDevNote({ host }: { host: string }) {
  const vmName = host.split('.')[0]
  return (
    <div className="exe-note">
      <div className="exe-mark">exe</div>
      <div>
        <strong>exe.dev VM detected</strong>
        <p>FileFling will connect as <code>exedev</code> over SSH. Make sure this Mac’s SSH key is registered with exe.dev.</p>
        <p>Its HTTPS front door is <code>https://{vmName}.exe.xyz</code>. That URL serves your app, not uploaded files automatically.</p>
      </div>
    </div>
  )
}

function SimpleField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="simple-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="simple-input" spellCheck={false} />
    </label>
  )
}
