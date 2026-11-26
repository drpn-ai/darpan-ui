// DAR-BE-328. Words for a sync pair on a list and in the Tenant Settings value.
/** "Every 2h"; "Off" when the pulse is off. */
export function pulseCadence(pulseEveryMinutes: number | null | undefined): string {
  if (!pulseEveryMinutes) return 'Off'
  return pulseEveryMinutes % 60 === 0 ? `Every ${pulseEveryMinutes / 60}h` : `Every ${pulseEveryMinutes}m`
}

/** "40m", "6h", "6h 08m": how long an order has waited, on the pair page and its charts. */
export function durationWords(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(minutes ?? 0))
  if (total < 60) return `${total}m`
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${hours}h`
}

/** The Every fact: "Hour", "2 hours", or "Off" when the pulse is off. */
export function pulseEveryWords(pulseEveryMinutes: number | null | undefined): string {
  if (!pulseEveryMinutes) return 'Off'
  if (pulseEveryMinutes === 60) return 'Hour'
  return pulseEveryMinutes % 60 === 0 ? `${pulseEveryMinutes / 60} hours` : durationWords(pulseEveryMinutes)
}

/** The Allowance fact: "15 min", "1 hour", "6 hours". */
export function allowanceWords(allowanceMinutes: number | null | undefined): string {
  const minutes = allowanceMinutes ?? 0
  if (minutes < 60) return `${minutes} min`
  if (minutes === 60) return '1 hour'
  return minutes % 60 === 0 ? `${minutes / 60} hours` : durationWords(minutes)
}

/** The pulse a pair may have, as save#SyncPair checks it: off, or every 1, 2, 3, 4 or 6 hours. */
export const PULSE_EVERY_CHOICES: readonly (number | null)[] = [null, 60, 120, 180, 240, 360]

/** The allowance a pair may have, as save#SyncPair checks it: 15 minutes to 48 hours. */
export const ALLOWANCE_CHOICES: readonly number[] = [15, 30, 60, 120, 180, 240, 360, 480, 720, 1440, 2880]
