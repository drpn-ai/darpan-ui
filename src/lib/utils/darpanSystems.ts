export interface DarpanSystemOptionInput {
  enumId?: string
  enumCode?: string
  description?: string
  sequenceNum?: number
  label?: string
}

const CANONICAL_SYSTEM_IDS: Record<string, string> = {
  DARSYSOMS: 'OMS',
  HOTWAX: 'OMS',
  OMS: 'OMS',
  DARSYSSHOPIFY: 'SHOPIFY',
  SHOPIFY: 'SHOPIFY',
  DARSYSNETSUITE: 'NETSUITE',
  NETSUITE: 'NETSUITE',
  DARSYSSAPI: 'SAPI',
  SAPI: 'SAPI',
  OMSTRANSFERORDERS: 'OMS_TRANSFER_ORDERS',
  HOTWAXTRANSFERORDERS: 'OMS_TRANSFER_ORDERS',
  DARSYSOMSTO: 'OMS_TRANSFER_ORDERS',
}

const CANONICAL_SYSTEM_LABELS: Record<string, string> = {
  OMS: 'HotWax',
  SHOPIFY: 'Shopify',
  NETSUITE: 'NetSuite',
  SAPI: 'SAPI',
  OMS_TRANSFER_ORDERS: 'HotWax Transfer Orders',
}

export function canonicalDarpanSystemEnumId(systemEnumId: string | null | undefined): string {
  const trimmed = systemEnumId?.trim() ?? ''
  if (!trimmed) return ''

  const lookupKey = trimmed.replace(/[\s_-]/g, '').toUpperCase()
  return CANONICAL_SYSTEM_IDS[lookupKey] ?? trimmed
}

export function darpanSystemDisplayLabel(systemEnumId: string | null | undefined, fallback?: string | null): string {
  const canonicalEnumId = canonicalDarpanSystemEnumId(systemEnumId)
  if (canonicalEnumId && CANONICAL_SYSTEM_LABELS[canonicalEnumId]) return CANONICAL_SYSTEM_LABELS[canonicalEnumId]

  const fallbackLabel = fallback?.trim() ?? ''
  return fallbackLabel || canonicalEnumId
}

export function darpanSystemIdsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const canonicalLeft = canonicalDarpanSystemEnumId(left)
  const canonicalRight = canonicalDarpanSystemEnumId(right)
  return Boolean(canonicalLeft && canonicalRight && canonicalLeft === canonicalRight)
}

export function deduplicateDarpanSystemOptions<T extends DarpanSystemOptionInput>(options: T[]): Array<T & { enumId: string }> {
  const preferredBySystemId = new Map<string, PreferredSystemOption<T>>()

  for (const option of options) {
    const canonicalEnumId = canonicalDarpanSystemEnumId(option.enumId || option.enumCode || option.label || option.description)
    if (!canonicalEnumId) continue

    const candidate = {
      option: {
        ...option,
        enumId: canonicalEnumId,
        label: darpanSystemDisplayLabel(canonicalEnumId, option.label || option.description || option.enumCode),
      },
      sourceEnumId: option.enumId?.trim() ?? '',
      sequenceNum: normalizeSequenceNumber(option.sequenceNum),
    }
    const currentOption = preferredBySystemId.get(canonicalEnumId)
    if (!currentOption || shouldPreferSystemOption(candidate, currentOption)) {
      preferredBySystemId.set(canonicalEnumId, candidate)
    }
  }

  return Array.from(preferredBySystemId.values()).map((entry) => entry.option)
}

interface PreferredSystemOption<T extends DarpanSystemOptionInput> {
  option: T & { enumId: string }
  sourceEnumId: string
  sequenceNum: number
}

function shouldPreferSystemOption<T extends DarpanSystemOptionInput>(
  candidate: PreferredSystemOption<T>,
  current: PreferredSystemOption<T>,
): boolean {
  const candidateCanonical = candidate.sourceEnumId === candidate.option.enumId
  const currentCanonical = current.sourceEnumId === current.option.enumId
  if (candidateCanonical !== currentCanonical) return candidateCanonical

  if (candidate.sequenceNum !== current.sequenceNum) return candidate.sequenceNum < current.sequenceNum

  return candidate.sourceEnumId < current.sourceEnumId
}

function normalizeSequenceNumber(sequenceNum: number | undefined): number {
  return typeof sequenceNum === 'number' && Number.isFinite(sequenceNum) ? sequenceNum : Number.MAX_SAFE_INTEGER
}
