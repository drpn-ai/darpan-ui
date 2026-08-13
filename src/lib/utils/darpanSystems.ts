export interface DarpanSystemOptionInput {
  enumId?: string
  enumCode?: string
  description?: string
  sequenceNum?: number
  label?: string
  // Present only on endpoint-level rows grouped under a top-level system (e.g. OMS_RETURNS's
  // parentEnumId is 'OMS') — see list#AutomationSourceOptions. Absent on top-level systems.
  parentEnumId?: string
}

export interface DarpanSystemEndpointOption {
  value: string
  label: string
}

// Shape of an already-mapped-to-WorkflowSelectOption system row (enumId projected to `value`),
// which is what callers actually hold by the time they group parents/endpoints — distinct from
// DarpanSystemOptionInput (the raw `enumId`-keyed backend shape consumed above by
// deduplicateDarpanSystemOptions). Kept as its own type rather than widening DarpanSystemOptionInput
// because every field on that interface is optional, so a `.value`-only object would satisfy it
// structurally and silently look for the wrong field name (`.enumId`, which is never set) at runtime.
export interface DarpanSystemValueOption {
  value?: string
  label?: string
  description?: string
  parentEnumId?: string
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

// Product-model fix: the source picker asks for the system first (HotWax, Shopify, ...), then the
// endpoint (Orders, Transfer Orders, Returns, ...) — endpoints must not appear as top-level
// systems. A row is top-level when it carries no parentEnumId.
export function darpanSystemIsParentOption(option: DarpanSystemValueOption): boolean {
  return !option.parentEnumId?.trim()
}

// Step 1 options: top-level systems only. Call on an already-deduplicated, .value-mapped list
// (e.g. deduplicateDarpanSystemOptions's output re-projected to WorkflowSelectOption + parentEnumId)
// so legacy alias rows don't leak through as extra systems.
export function darpanSystemParentOptions<T extends DarpanSystemValueOption>(options: T[]): T[] {
  return options.filter((option) => darpanSystemIsParentOption(option))
}

// True when a chosen parent system has at least one endpoint grouped under it — callers use this
// to decide whether step 2 ("which endpoint?") is needed at all. Systems with no children (SAPI,
// Database, NetSuite today) skip straight past it, preserving today's single-step behaviour.
export function darpanSystemHasEndpointOptions<T extends DarpanSystemValueOption>(
  parentEnumId: string | null | undefined,
  allOptions: T[],
): boolean {
  if (!parentEnumId) return false
  return allOptions.some((option) => Boolean(option.parentEnumId?.trim()) && darpanSystemIdsMatch(option.parentEnumId, parentEnumId))
}

// Step 2 options for a chosen parent system: every row grouped under it, PLUS the parent itself as
// its own default endpoint — OMS is a real extractable endpoint ("HotWax Orders"), not just a
// grouping node, and the same holds for Shopify. The submitted value stays the concrete
// systemEnumId the backend already expects (OMS, OMS_RETURNS, SHOPIFY_RETURN_REFS, ...).
export function darpanSystemEndpointOptions<T extends DarpanSystemValueOption>(
  parentEnumId: string | null | undefined,
  parentFallbackLabel: string,
  allOptions: T[],
): DarpanSystemEndpointOption[] {
  const trimmedParentEnumId = parentEnumId?.trim() ?? ''
  if (!trimmedParentEnumId) return []

  const children = allOptions.filter((option) =>
    Boolean(option.parentEnumId?.trim()) && darpanSystemIdsMatch(option.parentEnumId, trimmedParentEnumId),
  )
  const parentLabel = darpanSystemDisplayLabel(trimmedParentEnumId, parentFallbackLabel)
  const defaultOption: DarpanSystemEndpointOption = { value: trimmedParentEnumId, label: `${parentLabel} Orders` }

  return [
    defaultOption,
    ...children.flatMap((child) => {
      const value = child.value?.trim()
      if (!value) return []
      return [{ value, label: child.label?.trim() || child.description?.trim() || value }]
    }),
  ]
}

// Editing an existing automation/run only has the concrete stored systemEnumId (e.g. OMS_RETURNS).
// Resolve which Step 1 answer that belongs to so the wizard can pre-select the right parent.
// Top-level systems (and anything unrecognized) resolve to themselves — step 2 is then skipped,
// matching today's behaviour for systems with no endpoints.
export function resolveDarpanSystemParentEnumId<T extends DarpanSystemValueOption>(
  systemEnumId: string | null | undefined,
  allOptions: T[],
): string {
  const trimmedSystemEnumId = systemEnumId?.trim() ?? ''
  if (!trimmedSystemEnumId) return ''

  const match = allOptions.find((option) => darpanSystemIdsMatch(option.value, trimmedSystemEnumId))
  const parentEnumId = match?.parentEnumId?.trim()
  return parentEnumId || trimmedSystemEnumId
}
