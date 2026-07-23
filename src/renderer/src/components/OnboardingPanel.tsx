import type { FlingSettings } from '../../../main/types'
import SettingsPanel from './SettingsPanel'

export default function OnboardingPanel({
  settings,
  onComplete
}: {
  settings: FlingSettings | null
  onComplete: (settings: FlingSettings) => void
}) {
  return (
    <SettingsPanel
      settings={settings}
      setupMode
      onSettingsUpdated={() => undefined}
      onSettingsPreview={() => undefined}
      onComplete={onComplete}
    />
  )
}
