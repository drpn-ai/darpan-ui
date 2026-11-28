import type { RouteLocationRaw } from 'vue-router'
import { reconciliationFacade } from './api/facade'
import { homeSavedRuns } from './api/queries'
import { readQueryOnce } from './api/readCache'
import type { SourceExtractOptions } from './api/authoringTypes'
import type { SavedRunSummary, SavedRunSystemOption } from './api/types'
import {
  normalizePreActions,
  readReconciliationRuleExpressionPreActions,
  type ReconciliationRuleSetDraft,
} from './reconciliationRuleSetDraft'
import { normalizeExcludeFilters, type SourceExcludeFilter } from './sourceExcludeFilters'
import { resolveRecordLabel } from './utils/recordLabel'
import { normalizeStringOrEmpty } from './utils/strings'

const SAVED_RUN_EDITOR_LOOKUP_PAGE_SIZE = 100

// DAR-UI-156: Home's first page of runs, under its cache key, so the copy Home and the session preload keep
// warm answers this lookup. The same call, made without an abort signal as this lookup's callers expect.
const editorLookupFirstPage: typeof homeSavedRuns = {
  key: homeSavedRuns.key,
  fetch: () => reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: SAVED_RUN_EDITOR_LOOKUP_PAGE_SIZE, query: '' }),
}

/** The label of one of a saved run's systems, by its enum id; '' when the run has no such option. */
export function savedRunSystemLabel(savedRun: SavedRunSummary, enumId?: string): string {
  if (!enumId) return ''
  const option = savedRun.systemOptions.find((systemOption) => systemOption.enumId === enumId)
  return option?.label || option?.description || option?.enumCode || option?.enumId || ''
}

export function savedRunName(row: SavedRunSummary): string {
  return resolveRecordLabel({
    primary: row.runName,
    description: row.description,
    fallbackId: row.savedRunId,
  })
}

function savedRunMatchesEditorTarget(row: SavedRunSummary, targetId: string): boolean {
  const normalizedTargetId = normalizeStringOrEmpty(targetId)
  if (!normalizedTargetId) return false

  return [
    row.savedRunId,
    row.ruleSetId,
    row.reconciliationMappingId,
  ].some((value) => normalizeStringOrEmpty(value) === normalizedTargetId)
}

function findSavedRunEditorTarget(rows: SavedRunSummary[], targetId: string): SavedRunSummary | null {
  return rows.find((row) => savedRunMatchesEditorTarget(row, targetId)) ?? null
}

function normalizeLoadedExcludeFilters(
  filters: SourceExcludeFilter[] | undefined,
): SourceExcludeFilter[] | undefined {
  if (!filters) return undefined
  return normalizeExcludeFilters(filters)
}

function effectivePrimaryIdExpression(option: SavedRunSystemOption | undefined): string[] {
  if (option?.idFieldExpressions?.length) return option.idFieldExpressions
  if (option?.idFieldExpression) return [option.idFieldExpression]
  return []
}

/**
 * DAR-UI-148. A side's stored extract options (list#SavedRuns systemOptions[].extractParametersJson), so a draft opened
 * from a run shows them and its saves send them back. Undefined when none are stored or the JSON is unreadable.
 */
export function storedExtractOptions(option: SavedRunSystemOption | undefined): SourceExtractOptions | undefined {
  const raw = option?.extractParametersJson?.trim()
  if (!raw) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const kept = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, boolean | string] => typeof entry[1] === 'boolean' || typeof entry[1] === 'string')
    return kept.length ? Object.fromEntries(kept) : undefined
  } catch {
    return undefined
  }
}

export function buildRuleSetDraft(row: SavedRunSummary): ReconciliationRuleSetDraft | null {
  const file1Option = row.systemOptions.find((option) => option.fileSide === 'FILE_1')
    ?? row.systemOptions.find((option) => option.enumId === row.defaultFile1SystemEnumId)
  const file2Option = row.systemOptions.find((option) => option.fileSide === 'FILE_2')
    ?? row.systemOptions.find((option) => option.enumId === row.defaultFile2SystemEnumId)

  const file1PrimaryIdExpression = effectivePrimaryIdExpression(file1Option)
  const file2PrimaryIdExpression = effectivePrimaryIdExpression(file2Option)

  // A single-sided run (DAR-BE-049) has one source and no FILE_2, so demanding a second side
  // returned null for a perfectly valid run — and a null draft is not inert: buildSavedRunEditorRoute
  // below reads it as "not a rule set after all" and falls through to the mapping editor, which then
  // asks for a ReconciliationMapping that never existed. That is the whole "Mapping '<ruleSetId>' was
  // not found" path.
  //
  // scopeMode is read from the WIRE and never inferred from the option count. One system option is
  // also what a two-sided run looks like when its FILE_2 row has gone missing; treating that as
  // single-sided would render a broken run as a working one, which is strictly worse than the loud
  // failure it replaces.
  const isSingleSided = normalizeStringOrEmpty(row.scopeMode).toUpperCase() === 'EVALUATE'

  if (!file1Option?.enumId || !file1PrimaryIdExpression.length) return null
  if (!isSingleSided && (!file2Option?.enumId || !file2PrimaryIdExpression.length)) return null

  return {
    savedRunId: row.savedRunId,
    scopeMode: row.scopeMode,
    // DAR-UI-064: the STORED name. savedRunName is the display label and prefers the description, so a draft built from
    // it saved every edited run back under its description (found renaming gorjana's "Invoices - Etail id").
    runName: normalizeStringOrEmpty(row.runName) || savedRunName(row),
    description: row.description,
    file1SystemEnumId: file1Option.enumId,
    file1SystemLabel: file1Option.label || file1Option.description || file1Option.enumCode,
    file1SystemParentLabel: file1Option.systemParentLabel,
    file1SourceTypeEnumId: file1Option.sourceTypeEnumId,
    file1SystemMessageRemoteId: file1Option.systemMessageRemoteId,
    file1SystemMessageRemoteLabel: file1Option.systemMessageRemoteLabel,
    file1SourceConfigId: file1Option.sourceConfigId,
    file1SourceConfigType: file1Option.sourceConfigType,
    file1FileTypeEnumId: file1Option.fileTypeEnumId || 'DftCsv',
    file1SchemaFileName: file1Option.schemaFileName,
    file1PrimaryIdExpression,
    // On a single-sided run these stay empty rather than echoing file1. An empty second side is
    // what every consumer already reads as "there isn't one"; copying file1 across would make the
    // board and the save payload describe a run comparing a source with itself.
    file2SystemEnumId: file2Option?.enumId ?? '',
    file2SystemLabel: file2Option ? (file2Option.label || file2Option.description || file2Option.enumCode) : '',
    file2SystemParentLabel: file2Option?.systemParentLabel,
    file2SourceTypeEnumId: file2Option?.sourceTypeEnumId,
    file2SystemMessageRemoteId: file2Option?.systemMessageRemoteId,
    file2SystemMessageRemoteLabel: file2Option?.systemMessageRemoteLabel,
    file2SourceConfigId: file2Option?.sourceConfigId,
    file2SourceConfigType: file2Option?.sourceConfigType,
    file2FileTypeEnumId: file2Option ? (file2Option.fileTypeEnumId || 'DftCsv') : '',
    file2SchemaFileName: file2Option?.schemaFileName,
    file2PrimaryIdExpression,
    file1ExtractOptions: storedExtractOptions(file1Option),
    file2ExtractOptions: isSingleSided ? undefined : storedExtractOptions(file2Option),
    rules: row.rules?.map((rule, index) => {
      const directPreActions = normalizePreActions(rule.preActions)
      const preActions = directPreActions.length
        ? directPreActions
        : readReconciliationRuleExpressionPreActions(rule.expression)
      return {
        ruleId: rule.ruleId,
        file1FieldPath: rule.file1FieldPath ?? '',
        file2FieldPath: rule.file2FieldPath ?? '',
        operator: rule.operator || '=',
        sequenceNum: rule.sequenceNum ?? index + 1,
        preActions: preActions.length ? preActions : undefined,
        ruleName: rule.ruleName ?? undefined,
        ruleText: rule.ruleText,
        ruleLogic: rule.ruleLogic,
        ruleType: rule.ruleType,
        expression: rule.expression,
        enabled: rule.enabled,
        severity: rule.severity,
      }
    }).filter((rule) => rule.file1FieldPath && rule.file2FieldPath),
    // Hydrate persisted exclusions. `undefined` (key absent from the wire) must stay `undefined`
    // rather than becoming `[]`: the save contract reads an explicit empty array as "clear this
    // side", so defaulting here would let merely opening a run wipe its exclusions. Leaving these
    // unmapped is what let RuleSetBoard.applyExclusionEdit compute `others` from an empty draft and
    // delete every other exclusion on the side being edited.
    file1ExcludeFilters: normalizeLoadedExcludeFilters(row.file1ExcludeFilters),
    file2ExcludeFilters: normalizeLoadedExcludeFilters(row.file2ExcludeFilters),
  }
}

export function buildSavedRunEditorRoute(row: SavedRunSummary): RouteLocationRaw {
  const ruleSetDraft = buildRuleSetDraft(row)
  if (row.runType === 'ruleset' && ruleSetDraft) {
    return {
      name: 'reconciliation-ruleset-manager',
    }
  }

  return {
    name: 'settings-runs-edit',
    params: { reconciliationMappingId: row.reconciliationMappingId || row.savedRunId },
  }
}

/**
 * DAR-UI-156: opening a run's settings is immediate. The first page is the same list#SavedRuns read Home and
 * the session preload keep warm (editorLookupFirstPage), so a click within a minute of that read navigates without waiting;
 * any write in this tab drops that copy. A run the copy does not hold (made since, or past the first page)
 * falls back to paging the network, so a stale copy can never answer "not found".
 */
export async function resolveSavedRunEditorTarget(targetId: string): Promise<SavedRunSummary | null> {
  const normalizedTargetId = normalizeStringOrEmpty(targetId)
  if (!normalizedTargetId) return null

  // readQueryOnce's own 60 s, not the cache's 15 min: the editor is seeded from this row, and an older copy could
  // miss an edit made since in another tab or by another person, which a save here would then overwrite.
  const firstPage = await readQueryOnce(editorLookupFirstPage)
  const cachedRun = findSavedRunEditorTarget(firstPage.savedRuns ?? [], normalizedTargetId)
  if (cachedRun) return cachedRun

  let pageIndex = 0
  let pageCount = 1

  while (pageIndex < pageCount) {
    const response = await reconciliationFacade.listSavedRuns({
      pageIndex,
      pageSize: SAVED_RUN_EDITOR_LOOKUP_PAGE_SIZE,
      query: '',
    })
    const savedRun = findSavedRunEditorTarget(response.savedRuns ?? [], normalizedTargetId)
    if (savedRun) return savedRun

    pageCount = response.pagination?.pageCount ?? pageCount
    pageIndex += 1
  }

  return null
}
