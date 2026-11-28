import { jsonSchemaFacade } from './api/facade'
import type { RunConclusionLookup } from './api/authoringTypes'
import { draftSideValue, SOURCE_TYPE_API, type ReconciliationDraftSide, type ReconciliationRuleSetDraft } from './reconciliationRuleSetDraft'

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
  /** First path segments known not to be lists: top-level schema objects and fields, lookups that are not `many`. */
  nonListPaths: Set<string>
}

export interface SideLabels {
  file1: string
  file2: string
}

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
  side: ReconciliationDraftSide,
  signal: AbortSignal,
  labels: SideLabels,
): Promise<CatalogResult> {
  const empty: CatalogResult = { fields: [], listPaths: new Set(), nonListPaths: new Set() }
  if (draftSideValue(draft, side, 'SourceTypeEnumId') === SOURCE_TYPE_API) return empty

  let schemaId = draftSideValue(draft, side, 'JsonSchemaId')?.trim() ?? ''
  if (!schemaId) {
    const schemaName = draftSideValue(draft, side, 'SchemaFileName')?.trim()
    if (!schemaName) return empty
    const response = await jsonSchemaFacade.get({ schemaName }, signal)
    schemaId = response.schemaData?.jsonSchemaId?.trim() ?? ''
    if (!schemaId) return empty
  }

  const response = await jsonSchemaFacade.flatten({ jsonSchemaId: schemaId }, signal)
  const subject: CatalogSubject = side === 'file1' ? 'FILE_1' : 'FILE_2'
  const entries = (response.fieldList ?? [])
    .map((f) => ({ path: normalisePath(f.fieldPath), type: f.type }))
    .filter((f) => f.path)
  const arrayPaths = entries.filter((f) => f.type === 'array').map((f) => f.path)
  // Only top-level arrays go in listPaths (first-segment contract); nested ones still mark their leaves.
  const listPaths = new Set(arrayPaths.filter((p) => !p.includes('.')))
  // `lines.[0]` normalises to `lines`, so an array's item entry must not mark it a non-list.
  const nonListPaths = new Set(entries.map((f) => f.path).filter((p) => !p.includes('.') && !listPaths.has(p)))
  const seen = new Set<string>()
  const fields: CatalogField[] = []
  for (const f of entries) {
    if (f.type === 'array' || f.type === 'object' || seen.has(f.path)) continue
    seen.add(f.path)
    const list = arrayPaths.some((a) => f.path === a || f.path.startsWith(`${a}.`))
    fields.push(entry(subject, f.path, labels, list))
  }
  return { fields, listPaths, nonListPaths }
}

/** Never throws: a side that cannot be read contributes nothing (typed paths still work). */
export async function loadConclusionFields(
  draft: ReconciliationRuleSetDraft,
  signal: AbortSignal,
  labels: SideLabels,
): Promise<CatalogResult> {
  const result: CatalogResult = { fields: [], listPaths: new Set(), nonListPaths: new Set() }
  for (const side of ['file1', 'file2'] as const) {
    try {
      const part = await sideFields(draft, side, signal, labels)
      result.fields.push(...part.fields)
      part.listPaths.forEach((p) => result.listPaths.add(p))
      part.nonListPaths.forEach((p) => result.nonListPaths.add(p))
    } catch {
      // empty for this side
    }
  }
  return result
}

/** One entry per lookup; the user types `<lookup>.<field>` after it. `many` lookups are lists. */
export function lookupFields(lookups: RunConclusionLookup[], labels: SideLabels): CatalogResult {
  const listPaths = new Set<string>()
  const nonListPaths = new Set<string>()
  const fields = lookups.map((lookup) => {
    if (lookup.many) listPaths.add(lookup.name)
    else nonListPaths.add(lookup.name)
    return entry(lookup.subject, lookup.name, labels, Boolean(lookup.many))
  })
  return { fields, listPaths, nonListPaths }
}
