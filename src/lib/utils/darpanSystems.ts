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

// Endpoints that exist ONLY as an API pull. Their enum rows name a Reconciliation API endpoint or
// a per-order lookup service, not a dataset anyone can hand over as a file — two of them say
// "(Reconciliation API)" in the label the operator reads. Offering them on the file-upload branch
// asks "which data is in this CSV?" and lists an API as a possible answer.
//
// A DENYLIST rather than an allowlist on purpose: a newly seeded endpoint that IS file-valid must
// show up on its own, and the worse failure is a real dataset the operator cannot configure. The
// backend carries no flag separating the two — every DarpanSystemSource row has a
// SourceSystemConnector, including the top-level systems — so a new API-only endpoint has to be
// added here by hand.
const API_ONLY_SYSTEM_ENUM_IDS = ['OMS_RECON_ORDERS', 'OMS_RETURNS', 'SHOPIFY_RETURN_REFS']

export function darpanSystemIsApiOnlyEndpoint(systemEnumId: string | null | undefined): boolean {
  return API_ONLY_SYSTEM_ENUM_IDS.some((apiOnlyEnumId) => darpanSystemIdsMatch(apiOnlyEnumId, systemEnumId))
}

// The endpoint options a FILE source may pick from: darpanSystemEndpointOptions minus the rows
// that only an API pull can produce. The API branch keeps the full list (it filters by which
// endpoints the chosen config actually carries instead).
export function excludeApiOnlyEndpointOptions<T extends { value: string }>(options: T[]): T[] {
  return options.filter((option) => !darpanSystemIsApiOnlyEndpoint(option.value))
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

// The top-level systems only. Endpoint ids (OMS_TRANSFER_ORDERS) are deliberately excluded: an
// endpoint is what the collapse below reads FROM, never an answer it may return.
const TOP_LEVEL_SYSTEM_ENUM_IDS = ['OMS', 'SHOPIFY', 'NETSUITE', 'SAPI']

const TOP_LEVEL_SYSTEM_NAMES = TOP_LEVEL_SYSTEM_ENUM_IDS
  .map((enumId) => CANONICAL_SYSTEM_LABELS[enumId])
  .filter((name): name is string => Boolean(name))

// Prefix match on a word boundary so "Shopifyish Orders" is not read as Shopify.
function labelStartsWithSystemName(label: string, systemName: string): boolean {
  if (label.length < systemName.length) return false
  if (label.slice(0, systemName.length).toLowerCase() !== systemName.toLowerCase()) return false

  const nextCharacter = label.charAt(systemName.length)
  return !nextCharacter || !/[A-Za-z0-9]/.test(nextCharacter)
}

// Result surfaces count records per SYSTEM ("Missing from Shopify"), but the only name they hold is
// the label stamped into the run output when the run executed — the endpoint enum's description
// ("Shopify Order Return References"), or the raw enum code on runs older than the 2026-08-13 seed
// correction ("SHOPIFY"). Resolving the system name at DISPLAY time covers both, and covers runs
// already stored in prod, which re-stamping never could. Seed data names every endpoint
// "<System> <what it extracts>", which is what makes the prefix read reliable; an endpoint that
// ever breaks that convention degrades to showing its own label rather than the wrong system.
export function darpanSystemNameFromLabel(label: string | null | undefined): string {
  const trimmed = label?.trim() ?? ''
  if (!trimmed) return ''

  const canonicalEnumId = canonicalDarpanSystemEnumId(trimmed)
  if (TOP_LEVEL_SYSTEM_ENUM_IDS.includes(canonicalEnumId)) {
    const systemName = CANONICAL_SYSTEM_LABELS[canonicalEnumId]
    if (systemName) return systemName
  }

  return TOP_LEVEL_SYSTEM_NAMES.find((systemName) => labelStartsWithSystemName(trimmed, systemName)) ?? trimmed
}

// Both sides of one run, resolved together: when two endpoints of the SAME system are compared
// (HotWax Returns vs HotWax Transfer Orders) collapsing would print "Missing from HotWax" twice and
// leave the two counts indistinguishable, so that pairing keeps the endpoint labels.
export function darpanSystemNamePair(
  file1Label: string | null | undefined,
  file2Label: string | null | undefined,
): { file1: string, file2: string } {
  const file1 = file1Label?.trim() ?? ''
  const file2 = file2Label?.trim() ?? ''
  const file1SystemName = darpanSystemNameFromLabel(file1)
  const file2SystemName = darpanSystemNameFromLabel(file2)

  if (file1SystemName && file2SystemName && file1SystemName.toLowerCase() === file2SystemName.toLowerCase()) {
    return { file1, file2 }
  }

  return { file1: file1SystemName, file2: file2SystemName }
}
