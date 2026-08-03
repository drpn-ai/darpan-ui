// Draft state management has moved to src/stores/reconciliationDraft.ts.
// This file keeps types and pure utility functions for building API payloads.

import type { CreateRuleSetRunPayload, RuleSetRulePayload, SaveRuleSetRunPayload } from './api/facadeTypes'
import { excludeFilterPayloadFields, type SourceExcludeFilter } from './sourceExcludeFilters'
import { normalizeString } from './utils/strings'

const RULESET_SOURCE_TYPE_API = 'AUT_SRC_API'

export type ReconciliationRuleSetDraftStepId = 'ruleset-manager'
export type ReconciliationRulePreAction = 'STRING_TO_INT' | 'STRING_TO_NUMBER'
export type ReconciliationRulePreActionFieldSide = 'file1' | 'file2'

export interface ReconciliationRulePreActionEntry {
  fieldSide: ReconciliationRulePreActionFieldSide
  action: ReconciliationRulePreAction
}

export interface ReconciliationRuleSetDraftRule {
  ruleId?: string
  file1FieldPath: string
  file2FieldPath: string
  operator: string
  sequenceNum: number
  preActions?: ReconciliationRulePreActionEntry[]
  ruleText?: string
  ruleLogic?: string
  ruleType?: string
  expression?: string
  enabled?: string
  severity?: string
}

export interface ReconciliationRuleSetDraft {
  savedRunId?: string
  runName: string
  description?: string
  file1SystemEnumId: string
  file1SystemLabel?: string
  file1SourceTypeEnumId?: string
  file1SystemMessageRemoteId?: string
  file1SystemMessageRemoteLabel?: string
  file1NsRestletConfigId?: string
  file1NsRestletConfigLabel?: string
  file1SourceConfigId?: string
  file1SourceConfigType?: string
  file1FileTypeEnumId: string
  file1JsonSchemaId?: string
  file1SchemaLabel?: string
  file1SchemaFileName?: string
  file1PrimaryIdExpression: string[]
  file2SystemEnumId: string
  file2SystemLabel?: string
  file2SourceTypeEnumId?: string
  file2SystemMessageRemoteId?: string
  file2SystemMessageRemoteLabel?: string
  file2NsRestletConfigId?: string
  file2NsRestletConfigLabel?: string
  file2SourceConfigId?: string
  file2SourceConfigType?: string
  file2FileTypeEnumId: string
  file2JsonSchemaId?: string
  file2SchemaLabel?: string
  file2SchemaFileName?: string
  file2PrimaryIdExpression: string[]
  file1ExcludeFilters?: SourceExcludeFilter[]
  file2ExcludeFilters?: SourceExcludeFilter[]
  rules?: ReconciliationRuleSetDraftRule[]
}

export interface ReconciliationRuleSetDraftState {
  draft: ReconciliationRuleSetDraft
  resumeStepId: ReconciliationRuleSetDraftStepId | null
}

/**
 * Build a serializable state payload from a rule-set draft.  The result is
 * spread into Vue Router `history.state` so it survives navigation.
 */
export function buildReconciliationRuleSetDraftState(
  draft: ReconciliationRuleSetDraft,
  resumeStepId?: ReconciliationRuleSetDraftStepId | null,
): ReconciliationRuleSetDraftState {
  return { draft, resumeStepId: resumeStepId ?? null }
}

/** Read a rule-set draft state payload from an arbitrary state-like object. */
export function readReconciliationRuleSetDraftState(stateLike: unknown): ReconciliationRuleSetDraftState | null {
  if (!stateLike || typeof stateLike !== 'object' || Array.isArray(stateLike)) return null
  const state = stateLike as Record<string, unknown>
  const rawDraft = state.draft
  if (!rawDraft || typeof rawDraft !== 'object' || Array.isArray(rawDraft)) return null
  const resumeStepId = typeof state.resumeStepId === 'string'
    ? (state.resumeStepId as ReconciliationRuleSetDraftStepId)
    : null
  return { draft: rawDraft as ReconciliationRuleSetDraft, resumeStepId }
}

function normalizePreAction(value: unknown): ReconciliationRulePreAction | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  if (normalized === 'STRING_TO_INTEGER' || normalized === 'TO_INT' || normalized === 'TO_INTEGER') return 'STRING_TO_INT'
  if (normalized === 'TO_NUMBER') return 'STRING_TO_NUMBER'
  return normalized === 'STRING_TO_INT' || normalized === 'STRING_TO_NUMBER' ? normalized : null
}

function normalizePreActionFieldSide(value: unknown): ReconciliationRulePreActionFieldSide | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (normalized === 'file1' || normalized === 'file_1' || normalized === 'left') return 'file1'
  if (normalized === 'file2' || normalized === 'file_2' || normalized === 'right') return 'file2'
  return null
}

export function normalizePreActions(value: unknown): ReconciliationRulePreActionEntry[] {
  const rawValues = Array.isArray(value) ? value : (value ? [value] : [])
  const normalized = rawValues.flatMap((rawValue): ReconciliationRulePreActionEntry[] => {
    if (typeof rawValue === 'string') {
      const action = normalizePreAction(rawValue)
      return action ? [{ fieldSide: 'file1', action }, { fieldSide: 'file2', action }] : []
    }
    if (!rawValue || typeof rawValue !== 'object') return []
    const record = rawValue as Record<string, unknown>
    const action = normalizePreAction(record.action ?? record.preAction)
    const fieldSide = normalizePreActionFieldSide(record.fieldSide ?? record.field ?? record.side)
    return action && fieldSide ? [{ fieldSide, action }] : []
  })

  const seen = new Set<string>()
  return normalized.filter((entry) => {
    const key = `${entry.fieldSide}:${entry.action}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function readRuleExpression(value: unknown): Partial<ReconciliationRuleSetDraftRule> {
  const expression = normalizeString(value)
  if (!expression) return {}
  try {
    const parsed = JSON.parse(expression) as Record<string, unknown>
    return {
      file1FieldPath: normalizeString(parsed.file1FieldPath) ?? undefined,
      file2FieldPath: normalizeString(parsed.file2FieldPath) ?? undefined,
      operator: normalizeString(parsed.operator) ?? undefined,
      preActions: normalizePreActions(parsed.preActions ?? parsed.preAction),
    }
  } catch {
    return {}
  }
}

export function readReconciliationRuleExpressionPreActions(expression: string | undefined): ReconciliationRulePreActionEntry[] {
  return readRuleExpression(expression).preActions ?? []
}

export function buildCreateRuleSetRunPayload(draft: ReconciliationRuleSetDraft): CreateRuleSetRunPayload {
  const rules = buildRuleSetRulePayloads(draft)
  return {
    ...buildSideSourceFields('file1', draft),
    ...buildSideSourceFields('file2', draft),
    ...excludeFilterPayloadFields(draft.file1ExcludeFilters, 'file1'),
    ...excludeFilterPayloadFields(draft.file2ExcludeFilters, 'file2'),
    ...(rules.length ? { rules } : {}),
    runName: draft.runName.trim(),
    description: draft.description?.trim() || undefined,
    file1SystemEnumId: draft.file1SystemEnumId,
    file2SystemEnumId: draft.file2SystemEnumId,
  }
}

function buildSideSourceFields(side: 'file1' | 'file2', draft: ReconciliationRuleSetDraft): Partial<CreateRuleSetRunPayload> {
  if (side === 'file1') {
    const primaryIdFields = primaryIdExpressionPayloadFields(draft.file1PrimaryIdExpression)
    if (draft.file1SourceTypeEnumId === RULESET_SOURCE_TYPE_API) {
      return {
        file1SourceTypeEnumId: RULESET_SOURCE_TYPE_API,
        ...(draft.file1SystemMessageRemoteId?.trim() ? { file1SystemMessageRemoteId: draft.file1SystemMessageRemoteId.trim() } : {}),
        ...(draft.file1NsRestletConfigId?.trim() ? { file1NsRestletConfigId: draft.file1NsRestletConfigId.trim() } : {}),
        ...(draft.file1SourceConfigId?.trim() ? { file1SourceConfigId: draft.file1SourceConfigId.trim() } : {}),
        ...(draft.file1SourceConfigType?.trim() ? { file1SourceConfigType: draft.file1SourceConfigType.trim() } : {}),
        ...(primaryIdFields.file1PrimaryIdExpression ? { file1PrimaryIdExpression: primaryIdFields.file1PrimaryIdExpression } : {}),
        ...(primaryIdFields.file1PrimaryIdExpressions ? { file1PrimaryIdExpressions: primaryIdFields.file1PrimaryIdExpressions } : {}),
      }
    }
    return {
      file1FileTypeEnumId: draft.file1FileTypeEnumId,
      file1SchemaFileName: normalizeString(draft.file1SchemaFileName) ?? undefined,
      ...primaryIdFields,
    }
  }
  const primaryIdFields = primaryIdExpressionPayloadFields(draft.file2PrimaryIdExpression, 'file2')
  if (draft.file2SourceTypeEnumId === RULESET_SOURCE_TYPE_API) {
    return {
      file2SourceTypeEnumId: RULESET_SOURCE_TYPE_API,
      ...(draft.file2SystemMessageRemoteId?.trim() ? { file2SystemMessageRemoteId: draft.file2SystemMessageRemoteId.trim() } : {}),
      ...(draft.file2NsRestletConfigId?.trim() ? { file2NsRestletConfigId: draft.file2NsRestletConfigId.trim() } : {}),
      ...(draft.file2SourceConfigId?.trim() ? { file2SourceConfigId: draft.file2SourceConfigId.trim() } : {}),
      ...(draft.file2SourceConfigType?.trim() ? { file2SourceConfigType: draft.file2SourceConfigType.trim() } : {}),
      ...(primaryIdFields.file2PrimaryIdExpression ? { file2PrimaryIdExpression: primaryIdFields.file2PrimaryIdExpression } : {}),
      ...(primaryIdFields.file2PrimaryIdExpressions ? { file2PrimaryIdExpressions: primaryIdFields.file2PrimaryIdExpressions } : {}),
    }
  }
  return {
    file2FileTypeEnumId: draft.file2FileTypeEnumId,
    file2SchemaFileName: normalizeString(draft.file2SchemaFileName) ?? undefined,
    ...primaryIdFields,
  }
}

/**
 * Split a primary-id-expression array into the singular or plural payload field the backend
 * expects: `fileNPrimaryIdExpression` for a single field, `fileNPrimaryIdExpressions` for a
 * composite (>1 field) key. Centralized here so every caller (create, save, settings-page edit)
 * makes the same singular/plural decision.
 */
export function primaryIdExpressionPayloadFields(
  values: string[],
  side: 'file1' | 'file2' = 'file1',
): Partial<CreateRuleSetRunPayload> {
  const trimmed = values.map((value) => value.trim()).filter(Boolean)
  if (trimmed.length > 1) {
    return side === 'file1' ? { file1PrimaryIdExpressions: trimmed } : { file2PrimaryIdExpressions: trimmed }
  }
  const single = trimmed[0] ?? ''
  return side === 'file1' ? { file1PrimaryIdExpression: single } : { file2PrimaryIdExpression: single }
}

export function buildSaveRuleSetRunPayload(draft: ReconciliationRuleSetDraft): SaveRuleSetRunPayload {
  return {
    ...buildCreateRuleSetRunPayload(draft),
    savedRunId: draft.savedRunId?.trim(),
    rules: buildRuleSetRulePayloads(draft),
  }
}

export function buildRuleSetRulePayloads(draft: ReconciliationRuleSetDraft): RuleSetRulePayload[] {
  return [...(draft.rules ?? [])]
    .filter((rule) => rule.sequenceNum > 0 && rule.file1FieldPath.trim() && rule.file2FieldPath.trim())
    .sort((left, right) => left.sequenceNum - right.sequenceNum)
    .map((rule, index) => {
      const operator = normalizeRuleOperator(rule.operator)
      const preActions = normalizePreActions(rule.preActions)
      const expression = {
        type: 'FIELD_COMPARISON',
        file1FieldPath: rule.file1FieldPath.trim(),
        file2FieldPath: rule.file2FieldPath.trim(),
        operator,
        ...(preActions.length ? { preActions } : {}),
      }

      return {
        ...(rule.ruleId?.trim() ? { ruleId: rule.ruleId.trim() } : {}),
        sequenceNum: rule.sequenceNum,
        ruleText: `${formatFieldKey(rule.file1FieldPath)} ${operator} ${formatFieldKey(rule.file2FieldPath)}`,
        ruleLogic: buildFieldComparisonRuleLogic(draft, rule, operator, preActions, index),
        ruleType: 'FIELD_COMPARISON',
        expression: JSON.stringify(expression),
        enabled: rule.enabled?.trim() || 'Y',
        severity: rule.severity?.trim() || 'WARN',
      }
    })
}

function normalizeRuleOperator(operator: string | undefined): string {
  const normalized = operator?.trim()
  return normalized && ['=', '==', '!=', '>', '<', '>=', '<='].includes(normalized) ? normalized : '='
}

function buildFieldComparisonRuleLogic(
  draft: ReconciliationRuleSetDraft,
  rule: ReconciliationRuleSetDraftRule,
  operator: string,
  preActions: ReconciliationRulePreActionEntry[],
  index: number,
): string {
  const ruleName = rule.ruleId?.trim() || `FIELD_COMPARISON_${index + 1}`
  const file1Path = fieldPathRelativeToPrimary(rule.file1FieldPath, draft.file1PrimaryIdExpression[0] ?? '')
  const file2Path = fieldPathRelativeToPrimary(rule.file2FieldPath, draft.file2PrimaryIdExpression[0] ?? '')
  const file1RawValueExpression = buildDrlMapAccess('$m.get("file1")', file1Path)
  const file2RawValueExpression = buildDrlMapAccess('$m.get("file2")', file2Path)
  const file1ValueExpression = buildPreActionValueExpression(file1RawValueExpression, preActionNamesForSide(preActions, 'file1'))
  const file2ValueExpression = buildPreActionValueExpression(file2RawValueExpression, preActionNamesForSide(preActions, 'file2'))
  const violationExpression = buildViolationExpression(file1ValueExpression, file2ValueExpression, operator, preActions.length > 0)
  const fieldLabel = `${formatFieldKey(rule.file1FieldPath)} ${operator} ${formatFieldKey(rule.file2FieldPath)}`
  const severity = rule.severity?.trim() || 'WARN'

  return `rule "${escapeDrlString(ruleName)}"
when
    $m : Map(this["file1"] != null, this["file2"] != null)
    eval(${violationExpression})
then
    Object _file1Value = ${file1ValueExpression};
    Object _file2Value = ${file2ValueExpression};
    reconciliation.rule.RuleDiffSupport.addFieldMismatch(
        $m,
        kcontext.getRule().getName(),
        "${escapeDrlString(fieldLabel)}",
        _file1Value,
        _file2Value,
        "${escapeDrlString(severity)}",
        "Field comparison failed: ${escapeDrlString(fieldLabel)}"
    );
end`
}

function preActionNamesForSide(
  preActions: ReconciliationRulePreActionEntry[],
  fieldSide: ReconciliationRulePreActionFieldSide,
): ReconciliationRulePreAction[] {
  return preActions
    .filter((preAction) => preAction.fieldSide === fieldSide)
    .map((preAction) => preAction.action)
}

function buildPreActionValueExpression(valueExpression: string, preActions: ReconciliationRulePreAction[]): string {
  if (!preActions.length) return valueExpression
  const drlPreActions = preActions.map((preAction) => `"${escapeDrlString(preAction)}"`).join(', ')
  return `reconciliation.rule.RuleDiffSupport.applyPreActions(${valueExpression}, java.util.Arrays.asList(${drlPreActions}))`
}

function buildDrlMapAccess(rootExpression: string, fieldPath: string): string {
  return pathSegments(fieldPath).reduce((expression, segment) => (
    `((Map) ${expression}).get("${escapeDrlString(segment)}")`
  ), rootExpression)
}

function pathSegments(fieldPath: string): string[] {
  return stripRootPrefix(fieldPath)
    .replace(/\[['"]?([A-Za-z_$][\w$-]*)['"]?\]/g, '.$1')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\[\*\]/g, '')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function buildViolationExpression(file1ValueExpression: string, file2ValueExpression: string, operator: string, useRuleDiffSupport = false): string {
  if (useRuleDiffSupport || ['>', '<', '>=', '<='].includes(operator)) {
    return `reconciliation.rule.RuleDiffSupport.violatesOperator(${file1ValueExpression}, ${file2ValueExpression}, "${escapeDrlString(operator)}")`
  }
  switch (operator) {
    case '!=':
      return `java.util.Objects.equals(${file1ValueExpression}, ${file2ValueExpression})`
    default:
      return `!java.util.Objects.equals(${file1ValueExpression}, ${file2ValueExpression})`
  }
}

export function normalizeReconciliationFieldPath(fieldPath: string | undefined): string {
  const trimmed = fieldPath?.trim()
  if (!trimmed) return ''
  const expression = trimmed.split('|', 1)[0] ?? ''
  return expression
    .trim()
    .replace(/\[(\d+)\]/g, '[*]')
    .replace('.[*]', '[*]')
}

function fieldPathRelativeToPrimary(fieldPath: string, primaryExpression: string): string {
  const normalizedField = normalizeReconciliationFieldPath(fieldPath)
  const normalizedPrimary = normalizeReconciliationFieldPath(primaryExpression)
  if (!normalizedField) return ''
  const starIndex = normalizedPrimary.indexOf('[*]')
  if (starIndex >= 0) {
    const recordPrefix = normalizedPrimary.slice(0, starIndex + 3)
    const prefixWithDot = `${recordPrefix}.`
    if (normalizedField.startsWith(prefixWithDot)) return stripRootPrefix(normalizedField.slice(prefixWithDot.length))
  }
  return stripRootPrefix(normalizedField)
}

/**
 * True when two JSON field paths resolve to the same exploded-array record level — i.e. they can
 * safely be combined as fields of one composite compare key. Two non-array (no `[*]`) paths are
 * always considered to share the (implicit top-level) root.
 */
export function fieldSharesRecordRoot(candidateFieldPath: string, referenceFieldPath: string): boolean {
  const candidate = normalizeReconciliationFieldPath(candidateFieldPath)
  const reference = normalizeReconciliationFieldPath(referenceFieldPath)
  const candidateRoot = recordRootPrefix(candidate)
  const referenceRoot = recordRootPrefix(reference)
  return candidateRoot === referenceRoot
}

function recordRootPrefix(fieldPath: string): string {
  const starIndex = fieldPath.indexOf('[*]')
  return starIndex >= 0 ? fieldPath.slice(0, starIndex + 3) : ''
}

function stripRootPrefix(fieldPath: string): string {
  return fieldPath
    .replace(/^\$\[\*\]\.?/, '')
    .replace(/^\$\./, '')
    .replace(/^\$/, '')
    .replace(/^\./, '')
}

export function buildReconciliationFieldPathAliases(fieldPath: string | undefined): Set<string> {
  const normalized = normalizeReconciliationFieldPath(fieldPath)
  if (!normalized) return new Set()
  const aliases = new Set<string>([normalized])
  if (normalized.startsWith('$.')) aliases.add(normalized.slice(2))
  else if (normalized.startsWith('$[')) aliases.add(normalized.slice(1))
  else if (!normalized.startsWith('$')) aliases.add(normalized.startsWith('[') ? `$${normalized}` : `$.${normalized}`)
  return aliases
}

export function fieldsReferenceSamePath(left: string | undefined, right: string | undefined): boolean {
  const rightAliases = buildReconciliationFieldPathAliases(right)
  return [...buildReconciliationFieldPathAliases(left)].some((alias) => rightAliases.has(alias))
}

export function formatReconciliationFieldKey(fieldPath: string | undefined): string {
  const normalized = normalizeReconciliationFieldPath(fieldPath)
  if (!normalized) return 'Field pending'
  const segments = stripRootPrefix(normalized)
    .replace(/\[['"]?([A-Za-z_$][\w$-]*)['"]?\]/g, '.$1')
    .replace(/\[\*\]/g, '')
    .split('.')
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== '$')
  return segments.at(-1) || normalized
}

const formatFieldKey = formatReconciliationFieldKey

function escapeDrlString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
}
