import { jsonSchemaFacade } from './api/facade'
import type { RunConclusionLookup } from './api/authoringTypes'
import type { ReconciliationRuleSetDraft } from './reconciliationRuleSetDraft'

// DAR-UI-135. The fields a conclusion line can check, for the "What is checked" picker.

export type CatalogSubject = 'FILE_1' | 'FILE_2'

export interface CatalogField {
  value: string
  label: string
  subject: CatalogSubject
  field: string
  list: boolean
}

export interface CatalogResult {
  fields: CatalogField[]
  listPaths: Set<string>
}

export interface SideLabels {
  file1: string
  file2: string
}

const SOURCE_TYPE_API = 'AUT_SRC_API'

function entry(subject: CatalogSubject, field: string, labels: SideLabels, list: boolean): CatalogField {
  const side = subject === 'FILE_1' ? labels.file1 : labels.file2
  return { value: `${subject}:${field}`, label: `${side} › ${field}`, subject, field, list }
}

/** `lines[].status` / `lines[*].status` / `lines[0].status` all read as `lines.status`. */
function normalisePath(fieldPath: string): string {
  return fieldPath.replace(/\[[^\]]*\]/g, '').split('.').map((s) => s.trim()).filter(Boolean).join('.')
}

async function sideFields(
  draft: ReconciliationRuleSetDraft,
  side: 'file1' | 'file2',
  signal: AbortSignal,
  labels: SideLabels,
): Promise<CatalogResult> {
  const empty: CatalogResult = { fields: [], listPaths: new Set() }
  const isOne = side === 'file1'
  const sourceType = isOne ? draft.file1SourceTypeEnumId : draft.file2SourceTypeEnumId
  if (sourceType === SOURCE_TYPE_API) return empty

  let schemaId = (isOne ? draft.file1JsonSchemaId : draft.file2JsonSchemaId)?.trim() ?? ''
  if (!schemaId) {
    const schemaName = (isOne ? draft.file1SchemaFileName : draft.file2SchemaFileName)?.trim()
    if (!schemaName) return empty
    const response = await jsonSchemaFacade.get({ schemaName }, signal)
    schemaId = response.schemaData?.jsonSchemaId?.trim() ?? ''
    if (!schemaId) return empty
  }

  const response = await jsonSchemaFacade.flatten({ jsonSchemaId: schemaId }, signal)
  const subject: CatalogSubject = isOne ? 'FILE_1' : 'FILE_2'
  const entries = (response.fieldList ?? [])
    .map((f) => ({ path: normalisePath(f.fieldPath), type: f.type }))
    .filter((f) => f.path)
  const arrayPaths = entries.filter((f) => f.type === 'array').map((f) => f.path)
  const listPaths = new Set(arrayPaths.map((p) => p.split('.')[0] ?? p))
  const fields = entries
    .filter((f) => f.type !== 'array' && f.type !== 'object')
    .map((f) => entry(subject, f.path, labels, arrayPaths.some((a) => f.path.startsWith(`${a}.`))))
  return { fields, listPaths }
}

/** Never throws: a side that cannot be read contributes nothing (typed paths still work). */
export async function loadConclusionFields(
  draft: ReconciliationRuleSetDraft,
  signal: AbortSignal,
  labels: SideLabels,
): Promise<CatalogResult> {
  const result: CatalogResult = { fields: [], listPaths: new Set() }
  for (const side of ['file1', 'file2'] as const) {
    try {
      const part = await sideFields(draft, side, signal, labels)
      result.fields.push(...part.fields)
      part.listPaths.forEach((p) => result.listPaths.add(p))
    } catch {
      // empty for this side
    }
  }
  return result
}

/** One entry per lookup; the user types `<lookup>.<field>` after it. `many` lookups are lists. */
export function lookupFields(lookups: RunConclusionLookup[], labels: SideLabels): CatalogResult {
  const listPaths = new Set<string>()
  const fields = lookups.map((lookup) => {
    if (lookup.many) listPaths.add(lookup.name)
    return entry(lookup.subject, lookup.name, labels, Boolean(lookup.many))
  })
  return { fields, listPaths }
}
