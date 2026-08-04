import type { RouteLocationRaw } from 'vue-router'
import { reconciliationFacade } from './api/facade'
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

export function buildRuleSetDraft(row: SavedRunSummary): ReconciliationRuleSetDraft | null {
  const file1Option = row.systemOptions.find((option) => option.fileSide === 'FILE_1')
    ?? row.systemOptions.find((option) => option.enumId === row.defaultFile1SystemEnumId)
  const file2Option = row.systemOptions.find((option) => option.fileSide === 'FILE_2')
    ?? row.systemOptions.find((option) => option.enumId === row.defaultFile2SystemEnumId)

  const file1PrimaryIdExpression = effectivePrimaryIdExpression(file1Option)
  const file2PrimaryIdExpression = effectivePrimaryIdExpression(file2Option)

  if (!file1Option?.enumId || !file1PrimaryIdExpression.length || !file2Option?.enumId || !file2PrimaryIdExpression.length) {
    return null
  }

  return {
    savedRunId: row.savedRunId,
    runName: savedRunName(row),
    description: row.description,
    file1SystemEnumId: file1Option.enumId,
    file1SystemLabel: file1Option.label || file1Option.enumCode || file1Option.description,
    file1SourceTypeEnumId: file1Option.sourceTypeEnumId,
    file1SystemMessageRemoteId: file1Option.systemMessageRemoteId,
    file1SystemMessageRemoteLabel: file1Option.systemMessageRemoteLabel,
    file1NsRestletConfigId: file1Option.nsRestletConfigId,
    file1NsRestletConfigLabel: file1Option.nsRestletConfigLabel,
    file1SourceConfigId: file1Option.sourceConfigId,
    file1SourceConfigType: file1Option.sourceConfigType,
    file1FileTypeEnumId: file1Option.fileTypeEnumId || 'DftCsv',
    file1SchemaFileName: file1Option.schemaFileName,
    file1PrimaryIdExpression,
    file2SystemEnumId: file2Option.enumId,
    file2SystemLabel: file2Option.label || file2Option.enumCode || file2Option.description,
    file2SourceTypeEnumId: file2Option.sourceTypeEnumId,
    file2SystemMessageRemoteId: file2Option.systemMessageRemoteId,
    file2SystemMessageRemoteLabel: file2Option.systemMessageRemoteLabel,
    file2NsRestletConfigId: file2Option.nsRestletConfigId,
    file2NsRestletConfigLabel: file2Option.nsRestletConfigLabel,
    file2SourceConfigId: file2Option.sourceConfigId,
    file2SourceConfigType: file2Option.sourceConfigType,
    file2FileTypeEnumId: file2Option.fileTypeEnumId || 'DftCsv',
    file2SchemaFileName: file2Option.schemaFileName,
    file2PrimaryIdExpression,
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
  if (row.runType === 'mapping' && row.reconciliationMappingId) {
    return {
      name: 'settings-runs-edit',
      params: { reconciliationMappingId: row.reconciliationMappingId },
    }
  }

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

export async function resolveSavedRunEditorTarget(targetId: string): Promise<SavedRunSummary | null> {
  const normalizedTargetId = normalizeStringOrEmpty(targetId)
  if (!normalizedTargetId) return null

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
