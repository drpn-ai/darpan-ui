export interface TimezoneOption {
  value: string
  label: string
}

type SupportedIntl = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[]
}

const preservedTimezoneIds = [
  'UTC',
  'America/Los_Angeles',
  'US/Central',
  'America/Chicago',
  'America/New_York',
  'Asia/Kolkata',
] as const

const timezoneAliases: Record<string, string> = {
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
  PT: 'America/Los_Angeles',
}

export function normalizeTimezoneId(value: unknown): string {
  const normalized = String(value ?? '').trim()
  if (!normalized) return ''

  return timezoneAliases[normalized.toUpperCase()] ?? normalized
}

// The zone Intl would use when no explicit timezone is passed (see formatDateTime in utils/date).
// Labels that promise "your browser's timezone" have to be able to name it.
export function resolveBrowserTimeZone(): string {
  try {
    return normalizeTimezoneId(new Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    return ''
  }
}

export function buildTimezoneOptions(selectedTimeZone: unknown): TimezoneOption[] {
  const timezoneIds = new Set<string>([...preservedTimezoneIds, ...resolveSupportedTimeZones()])
  const normalizedSelectedTimezone = normalizeTimezoneId(selectedTimeZone)
  if (normalizedSelectedTimezone) timezoneIds.add(normalizedSelectedTimezone)

  return [...timezoneIds]
    .sort((first, second) => first.localeCompare(second))
    .map((timezoneId) => ({ value: timezoneId, label: timezoneId }))
}

function resolveSupportedTimeZones(): string[] {
  const supportedValuesOf = (Intl as SupportedIntl).supportedValuesOf
  try {
    return typeof supportedValuesOf === 'function' ? supportedValuesOf('timeZone') : fallbackTimezoneIds()
  } catch {
    return fallbackTimezoneIds()
  }
}

function fallbackTimezoneIds(): string[] {
  return [
    'Africa/Cairo',
    'America/Chicago',
    'America/Los_Angeles',
    'America/New_York',
    'America/Sao_Paulo',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Europe/London',
    'Europe/Paris',
    'UTC',
  ]
}
