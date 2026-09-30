import type { GeneratedOutputDifferenceRow, GeneratedOutputDifferencesRuleOption, RunConclusion, RunConclusionCount } from './api/types'
import { DEFAULT_LIST_PAGE_SIZE } from './listPagination'
import { normalizeDisplayText } from './reconciliationDisplay'

export type DiffBucketKey = 'file-1' | 'file-2' | 'rule'

export const DIFF_DETAILS_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE
export const DIFF_BUCKET_ORDER: DiffBucketKey[] = ['file-1', 'file-2', 'rule']
export const ALL_RULE_FILTER_KEY = 'all'
export const BASE_RULE_FILTER_KEY = 'base-diff'

export interface DiffDetailsMetadata {
  file1Label?: string
  file2Label?: string
  timestamp?: string
  savedRunId?: string
  savedRunName?: string
  savedRunType?: string
  reconciliationMappingId?: string
  reconciliationMappingName?: string
  ruleSetId?: string
  compareScopeId?: string
}

export interface DiffDetailsSummary {
  totalDifferences?: number
  onlyInFile1Count?: number
  onlyInFile2Count?: number
  missingObjectDifferenceCount?: number
  ruleDifferenceCount?: number
  /** DAR-UI-044: present only when the run's scope had conclusion rules. */
  conclusions?: { enabled: boolean; counts: RunConclusionCount[] }
}

export interface DiffDetailsRecord {
  diffType?: string
  type?: string
  id?: string | number
  primaryId?: string | number
  presentIn?: string
  missingIn?: string
  data?: unknown
  field?: string
  file1Value?: unknown
  file2Value?: unknown
  ruleId?: string
  ruleName?: string
  ruleLabel?: string
  ruleDescription?: string
  severity?: string
  message?: string
}

export interface NormalizedDiffDetailRow {
  rowKey: string
  recordId: string
  bucket: DiffBucketKey
  detailValue: unknown
  detailText?: string
  ruleFilterKey: string
  ruleId: string
  ruleLabel: string
  /**
   * The disagreement in words, as the QUERY wrote it (STATE_CONTRADICTION). Lifted out of the record
   * so the table can show it beside the id: without it 57 findings render as identical rows and the
   * reason only appears once the JSON is expanded. Absent on every other kind of run.
   */
  contradictionBrief?: string
  /** DAR-UI-044: what the run concluded about this finding. Absent on runs without conclusion rules. */
  conclusion?: RunConclusion
  /** The present side's order name, shown under the record id on a conclusion row. */
  orderName?: string
}

export interface RuleSelectorOption {
  key: string
  label: string
  detail: string
  count: number
  bucketKeys: DiffBucketKey[]
}

export function createEmptyDiffBucketCounts(): Record<DiffBucketKey, number> {
  return {
    'file-1': 0,
    'file-2': 0,
    rule: 0,
  }
}

export function normalizeDiffBucketSelection(buckets: DiffBucketKey[]): DiffBucketKey[] {
  return DIFF_BUCKET_ORDER.filter((bucket) => buckets.includes(bucket))
}

export function stringifyDiffJson(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function isJsonCollapseValue(value: unknown): boolean {
  return value !== null && typeof value === 'object'
}

export function resolveDiffType(record: DiffDetailsRecord): string {
  return normalizeDisplayText(record.diffType || record.type)
}

export function parseDiffData(rawData: unknown): unknown {
  if (typeof rawData !== 'string') return rawData

  try {
    return JSON.parse(rawData)
  } catch {
    return rawData
  }
}

export function buildDiffDetailPayload(record: DiffDetailsRecord, parsedData: unknown): unknown {
  if (parsedData != null && !(typeof parsedData === 'string' && !parsedData.trim())) {
    return parsedData
  }

  const diffDetail = {
    diffType: resolveDiffType(record) || undefined,
    primaryId:
      record.primaryId != null && String(record.primaryId).trim() ? String(record.primaryId).trim() : undefined,
    field: normalizeDisplayText(record.field) || undefined,
    file1Value: record.file1Value,
    file2Value: record.file2Value,
    severity: normalizeDisplayText(record.severity) || undefined,
    ruleId: normalizeDisplayText(record.ruleId) || undefined,
    message: normalizeDisplayText(record.message) || undefined,
  }

  const normalizedDetail = Object.fromEntries(Object.entries(diffDetail).filter(([, value]) => value != null))
  return Object.keys(normalizedDetail).length > 0 ? normalizedDetail : null
}

// The server already classified each page row (bucket / rule descriptor / record id); the client only
// rebuilds the presentational detail payload it renders. See backend DiffDetailClassifier (audit #21).
/**
 * The written brief, if this run wrote one. Narrowed rather than cast: parseDiffData returns whatever
 * the record held, and asserting a shape onto it would turn a malformed payload into a render error
 * instead of an absent brief.
 */
function briefFromRecord(parsedData: unknown): { contradictionBrief?: string } {
  if (!parsedData || typeof parsedData !== 'object') return {}
  const value = (parsedData as Record<string, unknown>).contradictionBrief
  if (typeof value !== 'string') return {}
  const trimmed = value.trim()
  return trimmed ? { contradictionBrief: trimmed } : {}
}

/** Narrowed like the brief: a conclusion without a code and a label is not rendered at all. */
function conclusionFromRecord(record: Record<string, unknown>): { conclusion?: RunConclusion } {
  const value = record.conclusion
  if (!value || typeof value !== 'object') return {}
  const candidate = value as Partial<RunConclusion>
  if (typeof candidate.code !== 'string' || typeof candidate.label !== 'string') return {}
  return {
    conclusion: {
      code: candidate.code,
      label: candidate.label,
      systems: Array.isArray(candidate.systems) ? candidate.systems : [],
      checks: Array.isArray(candidate.checks) ? candidate.checks : [],
      question: candidate.question ?? null,
    },
  }
}

const ORDER_NAME_FIELDS = ['omsOrderName', 'shopifyOrderName', 'orderName'] as const

function orderNameFromData(parsedData: unknown): { orderName?: string } {
  if (!parsedData || typeof parsedData !== 'object') return {}
  for (const field of ORDER_NAME_FIELDS) {
    const value = (parsedData as Record<string, unknown>)[field]
    if (typeof value === 'string' && value.trim()) return { orderName: value.trim() }
  }
  return {}
}

export function buildPageRow(serverRow: GeneratedOutputDifferenceRow): NormalizedDiffDetailRow {
  const record = (serverRow.record ?? {}) as DiffDetailsRecord
  const parsedData = parseDiffData((record as Record<string, unknown>).data)
  return {
    rowKey: serverRow.rowKey,
    recordId: serverRow.recordId,
    bucket: serverRow.bucket as DiffBucketKey,
    detailValue: buildDiffDetailPayload(record, parsedData),
    ruleFilterKey: serverRow.ruleFilterKey,
    ruleId: serverRow.ruleId,
    ruleLabel: serverRow.ruleLabel,
    ...briefFromRecord(parsedData),
    ...conclusionFromRecord(record as Record<string, unknown>),
    ...orderNameFromData(parsedData),
  }
}

export function normalizeServerBucketCounts(raw: Record<string, number> | undefined): Record<DiffBucketKey, number> {
  const counts = createEmptyDiffBucketCounts()
  if (raw) {
    DIFF_BUCKET_ORDER.forEach((bucket) => {
      const value = Number(raw[bucket])
      counts[bucket] = Number.isFinite(value) ? value : 0
    })
  }
  return counts
}

export function normalizeServerRuleOption(option: GeneratedOutputDifferencesRuleOption): RuleSelectorOption {
  return {
    key: option.key,
    label: option.label,
    detail: option.detail,
    count: option.count,
    bucketKeys: (option.bucketKeys ?? []).filter((bucket): bucket is DiffBucketKey =>
      DIFF_BUCKET_ORDER.includes(bucket as DiffBucketKey),
    ),
  }
}
