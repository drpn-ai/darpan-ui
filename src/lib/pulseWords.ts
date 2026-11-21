// DAR-BE-328. Words for a sync pair on a list and in the Tenant Settings value.
import type { SyncPairSummary } from './api/pulseTypes'

/** "Every 2h"; "Off" when the pulse is off. */
export function pulseCadence(pulseEveryMinutes: number | null | undefined): string {
  if (!pulseEveryMinutes) return 'Off'
  return pulseEveryMinutes % 60 === 0 ? `Every ${pulseEveryMinutes / 60}h` : `Every ${pulseEveryMinutes}m`
}

/** "Approved orders · every 2h · 2 more", or "None". */
export function pulseSettingsValue(pairs: Pick<SyncPairSummary, 'label' | 'pulseEveryMinutes'>[]): string {
  const first = pairs[0]
  if (!first) return 'None'
  const cadence = pulseCadence(first.pulseEveryMinutes).toLowerCase()
  const more = pairs.length > 1 ? ` · ${pairs.length - 1} more` : ''
  return `${first.label} · ${cadence}${more}`
}
