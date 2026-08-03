import type { CreateRuleSetRunPayload } from './api/facadeTypes'

export const EXCLUDE_FILTER_OPERATOR = 'EXCLUDE_IN'

export interface SourceExcludeFilter {
  fieldExpression: string
  operator?: string
  values: string[]
}

/** Split the operator's comma-separated entry into exact values, trimmed and de-duplicated. */
export function parseExcludeFilterValues(raw: string): string[] {
  const seen = new Set<string>()
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) return false
      seen.add(value)
      return true
    })
}

/** Drop incomplete rules and stamp the default operator. A half-filled rule is not a rule. */
export function normalizeExcludeFilters(filters: SourceExcludeFilter[] | undefined): SourceExcludeFilter[] {
  if (!filters) return []
  return filters
    .map((filter) => ({
      fieldExpression: filter.fieldExpression.trim(),
      operator: filter.operator?.trim() || EXCLUDE_FILTER_OPERATOR,
      values: filter.values.map((value) => value.trim()).filter(Boolean),
    }))
    .filter((filter) => filter.fieldExpression.length > 0 && filter.values.length > 0)
}

/**
 * Build the payload key for one side. The distinction matters server-side: an omitted key leaves
 * existing rules alone, while an explicit empty array clears them. `undefined` means the draft never
 * touched exclusions; `[]` means the operator removed them.
 */
export function excludeFilterPayloadFields(
  filters: SourceExcludeFilter[] | undefined,
  side: 'file1' | 'file2',
): Partial<CreateRuleSetRunPayload> {
  if (filters === undefined) return {}
  const normalized = normalizeExcludeFilters(filters)
  return side === 'file1' ? { file1ExcludeFilters: normalized } : { file2ExcludeFilters: normalized }
}
