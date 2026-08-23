import type { SavedRunSummary, SavedRunSystemOption } from './api/types'
import type { AutomationSourcePayload, SaveAutomationPayload } from './api/facadeTypes'
import { normalizeExcludeFilters, type SourceExcludeFilter } from './sourceExcludeFilters'
import { isRecord, removeEmpty } from './utils/objects'
import { normalizeString } from './utils/strings'

// Draft state management has moved to src/stores/reconciliationDraft.ts.
// This file keeps types, constants, and pure payload-building utilities.

export const AUTOMATION_INPUT_MODE_API_RANGE = 'AUT_IN_API_RANGE'
export const AUTOMATION_INPUT_MODE_SFTP_FILES = 'AUT_IN_SFTP_FILES'
export const AUTOMATION_SOURCE_TYPE_API = 'AUT_SRC_API'
const AUTOMATION_SOURCE_TYPE_SFTP = 'AUT_SRC_SFTP'
export const AUTOMATION_WINDOW_PREVIOUS_DAY = 'AUT_WIN_PREV_DAY'
export const AUTOMATION_WINDOW_PREVIOUS_WEEK = 'AUT_WIN_PREV_WEEK'
export const AUTOMATION_WINDOW_PREVIOUS_MONTH = 'AUT_WIN_PREV_MONTH'
export const AUTOMATION_WINDOW_LAST_DAYS = 'AUT_WIN_LAST_DAYS'
export const AUTOMATION_WINDOW_LAST_WEEKS = 'AUT_WIN_LAST_WEEKS'
export const AUTOMATION_WINDOW_LAST_MONTHS = 'AUT_WIN_LAST_MONTHS'
export const AUTOMATION_WINDOW_CUSTOM = 'AUT_WIN_CUSTOM'

const COUNTED_WINDOW_TYPES = new Set([
  AUTOMATION_WINDOW_LAST_DAYS,
  AUTOMATION_WINDOW_LAST_WEEKS,
  AUTOMATION_WINDOW_LAST_MONTHS,
])

export type ReconciliationAutomationIntent = 'existing-run' | 'new-run'
export type ReconciliationAutomationFileSide = 'FILE_1' | 'FILE_2'
export type ReconciliationAutomationStepId =
  | 'purpose'
  | 'saved-run'
  | 'automation-name'
  | 'input-mode'
  | 'file1-sftp'
  | 'file1-remote-path'
  | 'file1-api'
  | 'file2-sftp'
  | 'file2-remote-path'
  | 'file2-api'
  | 'date-window'
  | 'schedule'
  | 'chat-space'
  | 'chat-space-select'
  | 'chat-space-name'
  | 'chat-space-provider'
  | 'chat-space-url'

export interface ReconciliationAutomationSourceDraft {
  sourceTypeEnumId?: string
  sftpServerId?: string
  nsRestletConfigId?: string
  systemMessageRemoteId?: string
  remotePathTemplate?: string
  fileNamePattern?: string
  apiRequestTemplateJson?: string
  apiResponsePathExpression?: string
  dateFromParameterName?: string
  dateToParameterName?: string
  safeMetadataJson?: string
  optionKey?: string
  omsRestSourceConfigId?: string
  excludeFilters?: SourceExcludeFilter[]
}

export type ReconciliationAutomationChatSpaceChoice = '' | 'default' | 'existing' | 'new' | 'none'

export interface ReconciliationAutomationDraft {
  automationId?: string
  automationName?: string
  description?: string
  intent?: ReconciliationAutomationIntent
  savedRunId?: string
  savedRunType?: string
  inputModeEnumId?: string
  scheduleExpr?: string
  windowTimeZone?: string
  relativeWindowTypeEnumId?: string
  relativeWindowCount?: number
  customWindowStartDate?: string
  customWindowEndDate?: string
  maxWindowDays?: number
  splitWindowDays?: number
  isActive?: boolean
  returnLabel?: string
  returnPath?: string
  chatSpaceChoice?: ReconciliationAutomationChatSpaceChoice
  chatSpaceId?: string
  newChatSpaceName?: string
  newChatSpaceProvider?: string
  newChatSpaceUrl?: string
  sources?: Partial<Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft>>
}

export interface ReconciliationAutomationDraftState {
  draft: ReconciliationAutomationDraft
  resumeStepId: ReconciliationAutomationStepId | null
  savedRun: SavedRunSummary | null
}

/** SessionStorage key for pending automation draft handoff state. */
export const RECONCILIATION_AUTOMATION_PENDING_STATE_KEY = 'darpan.reconciliationAutomationDraftState'

/**
 * Build a serializable state payload from an automation draft.  The result
 * can be spread into Vue Router `history.state` or saved to sessionStorage.
 */
export function buildReconciliationAutomationDraftState(
  draft: ReconciliationAutomationDraft,
  resumeStepId: ReconciliationAutomationStepId | null,
  savedRun: SavedRunSummary | null,
): ReconciliationAutomationDraftState {
  return { draft, resumeStepId, savedRun }
}

/** Persist pending automation draft state to sessionStorage for cross-page handoff. */
export function savePendingReconciliationAutomationDraftState(
  draft: ReconciliationAutomationDraft,
  resumeStepId: ReconciliationAutomationStepId | null,
  savedRun: SavedRunSummary | null,
): void {
  try {
    window.sessionStorage.setItem(
      RECONCILIATION_AUTOMATION_PENDING_STATE_KEY,
      JSON.stringify({ draft, resumeStepId, savedRun }),
    )
  } catch {
    // ignore storage errors (private browsing, quota exceeded, etc.)
  }
}

/** Read pending automation draft state from sessionStorage. */
export function readPendingReconciliationAutomationDraftState(): ReconciliationAutomationDraftState | null {
  try {
    const raw = window.sessionStorage.getItem(RECONCILIATION_AUTOMATION_PENDING_STATE_KEY)
    if (!raw) return null
    return readReconciliationAutomationDraftState(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Remove pending automation draft state from sessionStorage. */
export function clearPendingReconciliationAutomationDraftState(): void {
  try {
    window.sessionStorage.removeItem(RECONCILIATION_AUTOMATION_PENDING_STATE_KEY)
  } catch {
    // ignore
  }
}

export function automationWindowNeedsCount(windowTypeEnumId: string | undefined): boolean {
  return COUNTED_WINDOW_TYPES.has(windowTypeEnumId ?? '')
}

export function automationWindowUsesCustomRange(windowTypeEnumId: string | undefined): boolean {
  return windowTypeEnumId === AUTOMATION_WINDOW_CUSTOM
}

export function buildDefaultAutomationName(savedRunName: string): string {
  const trimmedName = savedRunName.trim()
  return trimmedName ? `${trimmedName} Automation` : 'New Automation'
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    if (value === 'Y' || value.toLowerCase() === 'true') return true
    if (value === 'N' || value.toLowerCase() === 'false') return false
  }
  return undefined
}

function normalizeChatSpaceChoice(value: unknown): ReconciliationAutomationChatSpaceChoice | undefined {
  const normalized = normalizeString(value)
  return normalized === 'default' || normalized === 'existing' || normalized === 'new' || normalized === 'none'
    ? normalized
    : undefined
}

function readSourceDraft(value: unknown): ReconciliationAutomationSourceDraft {
  if (!isRecord(value)) return {}
  return removeEmpty({
    sourceTypeEnumId: normalizeString(value.sourceTypeEnumId),
    sftpServerId: normalizeString(value.sftpServerId),
    nsRestletConfigId: normalizeString(value.nsRestletConfigId),
    systemMessageRemoteId: normalizeString(value.systemMessageRemoteId),
    remotePathTemplate: normalizeString(value.remotePathTemplate),
    fileNamePattern: normalizeString(value.fileNamePattern),
    apiRequestTemplateJson: normalizeString(value.apiRequestTemplateJson),
    apiResponsePathExpression: normalizeString(value.apiResponsePathExpression),
    dateFromParameterName: normalizeString(value.dateFromParameterName),
    dateToParameterName: normalizeString(value.dateToParameterName),
    safeMetadataJson: normalizeString(value.safeMetadataJson),
    optionKey: normalizeString(value.optionKey),
    omsRestSourceConfigId: normalizeString(value.omsRestSourceConfigId),
  }) as ReconciliationAutomationSourceDraft
}

function readSources(value: unknown): Partial<Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft>> | undefined {
  if (!isRecord(value)) return undefined
  const file1 = readSourceDraft(value.FILE_1)
  const file2 = readSourceDraft(value.FILE_2)
  return removeEmpty({
    FILE_1: Object.keys(file1).length ? file1 : undefined,
    FILE_2: Object.keys(file2).length ? file2 : undefined,
  }) as Partial<Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft>>
}

function readDraft(value: unknown): ReconciliationAutomationDraft | null {
  if (!isRecord(value)) return null
  const intent = normalizeString(value.intent)
  const draft = removeEmpty({
    automationId: normalizeString(value.automationId),
    automationName: normalizeString(value.automationName),
    description: normalizeString(value.description),
    intent: intent === 'existing-run' || intent === 'new-run' ? intent : undefined,
    savedRunId: normalizeString(value.savedRunId),
    savedRunType: normalizeString(value.savedRunType),
    inputModeEnumId: normalizeString(value.inputModeEnumId),
    scheduleExpr: normalizeString(value.scheduleExpr),
    windowTimeZone: normalizeString(value.windowTimeZone),
    relativeWindowTypeEnumId: normalizeString(value.relativeWindowTypeEnumId),
    relativeWindowCount: normalizeNumber(value.relativeWindowCount),
    customWindowStartDate: normalizeString(value.customWindowStartDate),
    customWindowEndDate: normalizeString(value.customWindowEndDate),
    maxWindowDays: normalizeNumber(value.maxWindowDays),
    splitWindowDays: normalizeNumber(value.splitWindowDays),
    isActive: normalizeBoolean(value.isActive),
    returnLabel: normalizeString(value.returnLabel),
    returnPath: normalizeString(value.returnPath),
    chatSpaceChoice: normalizeChatSpaceChoice(value.chatSpaceChoice),
    chatSpaceId: normalizeString(value.chatSpaceId),
    newChatSpaceName: normalizeString(value.newChatSpaceName),
    newChatSpaceProvider: normalizeString(value.newChatSpaceProvider),
    newChatSpaceUrl: normalizeString(value.newChatSpaceUrl),
    sources: readSources(value.sources),
  }) as ReconciliationAutomationDraft
  return Object.keys(draft).length ? draft : null
}

function readSavedRunSystemOption(value: unknown): SavedRunSystemOption | null {
  if (!isRecord(value)) return null
  const enumId = normalizeString(value.enumId)
  if (!enumId) return null
  return removeEmpty({
    fileSide: normalizeString(value.fileSide),
    enumId,
    enumCode: normalizeString(value.enumCode),
    description: normalizeString(value.description),
    label: normalizeString(value.label),
    fileTypeEnumId: normalizeString(value.fileTypeEnumId),
    fileTypeLabel: normalizeString(value.fileTypeLabel),
    idFieldExpression: normalizeString(value.idFieldExpression),
    schemaFileName: normalizeString(value.schemaFileName),
    sourceTypeEnumId: normalizeString(value.sourceTypeEnumId),
    sourceTypeLabel: normalizeString(value.sourceTypeLabel),
    systemMessageRemoteId: normalizeString(value.systemMessageRemoteId),
    systemMessageRemoteLabel: normalizeString(value.systemMessageRemoteLabel),
    nsRestletConfigId: normalizeString(value.nsRestletConfigId),
    nsRestletConfigLabel: normalizeString(value.nsRestletConfigLabel),
    sourceConfigId: normalizeString(value.sourceConfigId),
    sourceConfigType: normalizeString(value.sourceConfigType),
  }) as SavedRunSystemOption
}

function readSavedRun(value: unknown): SavedRunSummary | null {
  if (!isRecord(value)) return null
  const savedRunId = normalizeString(value.savedRunId)
  const runName = normalizeString(value.runName)
  if (!savedRunId || !runName) return null
  const systemOptions = Array.isArray(value.systemOptions)
    ? value.systemOptions.map(readSavedRunSystemOption).filter((option): option is SavedRunSystemOption => option !== null)
    : []
  return removeEmpty({
    savedRunId,
    runName,
    description: normalizeString(value.description),
    companyUserGroupId: normalizeString(value.companyUserGroupId),
    companyLabel: normalizeString(value.companyLabel),
    runType: normalizeString(value.runType),
    reconciliationMappingId: normalizeString(value.reconciliationMappingId),
    ruleSetId: normalizeString(value.ruleSetId),
    compareScopeId: normalizeString(value.compareScopeId),
    requiresSystemSelection: normalizeBoolean(value.requiresSystemSelection) ?? false,
    defaultFile1SystemEnumId: normalizeString(value.defaultFile1SystemEnumId),
    defaultFile2SystemEnumId: normalizeString(value.defaultFile2SystemEnumId),
    systemOptions,
  }) as SavedRunSummary
}

export function readReconciliationAutomationDraftState(stateLike: unknown): ReconciliationAutomationDraftState | null {
  if (!isRecord(stateLike)) return null
  const draft = readDraft(stateLike.draft ?? stateLike)
  if (!draft) return null
  const resumeStepId = normalizeString(stateLike.resumeStepId)
  return {
    draft,
    resumeStepId: (resumeStepId as ReconciliationAutomationStepId | null) ?? null,
    savedRun: readSavedRun(stateLike.savedRun),
  }
}

function resolveSavedRunSide(savedRun: SavedRunSummary, fileSide: ReconciliationAutomationFileSide): SavedRunSystemOption | null {
  const sideOption = savedRun.systemOptions.find((option) => option.fileSide === fileSide)
  if (sideOption) return sideOption
  const fallbackEnumId = fileSide === 'FILE_1' ? savedRun.defaultFile1SystemEnumId : savedRun.defaultFile2SystemEnumId
  return savedRun.systemOptions.find((option) => option.enumId === fallbackEnumId) ?? null
}

function buildSourcePayload(
  draft: ReconciliationAutomationDraft,
  savedRun: SavedRunSummary,
  fileSide: ReconciliationAutomationFileSide,
): AutomationSourcePayload {
  const sourceDraft = draft.sources?.[fileSide] ?? {}
  const savedRunSide = resolveSavedRunSide(savedRun, fileSide)
  const sourceTypeEnumId = draft.inputModeEnumId === AUTOMATION_INPUT_MODE_SFTP_FILES
    ? AUTOMATION_SOURCE_TYPE_SFTP
    : AUTOMATION_SOURCE_TYPE_API
  // Explicitly typed: AutomationSourcePayload now declares excludeFilters, so a value-shape mistake
  // on it is a compile error here instead of being swallowed by the `as` casts below (which exist
  // only to re-widen removeEmpty's Partial<>, not to paper over undeclared keys).
  const basePayload: Partial<AutomationSourcePayload> = removeEmpty({
    fileSide,
    sourceTypeEnumId,
    systemEnumId: savedRunSide?.enumId ?? (fileSide === 'FILE_1' ? savedRun.defaultFile1SystemEnumId : savedRun.defaultFile2SystemEnumId),
    fileTypeEnumId: savedRunSide?.fileTypeEnumId,
    schemaFileName: savedRunSide?.schemaFileName,
    primaryIdExpression: savedRunSide?.idFieldExpression,
    // Only stamp excludeFilters when the draft has an opinion -- omitting the key entirely
    // preserves the "leave existing rules untouched" contract (see sourceExcludeFilters.ts).
    ...(sourceDraft.excludeFilters !== undefined
      ? { excludeFilters: normalizeExcludeFilters(sourceDraft.excludeFilters) }
      : {}),
  })

  if (sourceTypeEnumId === AUTOMATION_SOURCE_TYPE_SFTP) {
    return removeEmpty({
      ...basePayload,
      sftpServerId: sourceDraft.sftpServerId,
      remotePathTemplate: sourceDraft.remotePathTemplate,
      fileNamePattern: sourceDraft.fileNamePattern,
    }) as AutomationSourcePayload
  }

  return removeEmpty({
    ...basePayload,
    systemMessageRemoteId: sourceDraft.systemMessageRemoteId,
    nsRestletConfigId: sourceDraft.nsRestletConfigId,
    apiRequestTemplateJson: sourceDraft.apiRequestTemplateJson,
    apiResponsePathExpression: sourceDraft.apiResponsePathExpression,
    dateFromParameterName: sourceDraft.dateFromParameterName,
    dateToParameterName: sourceDraft.dateToParameterName,
    safeMetadataJson: sourceDraft.safeMetadataJson,
    optionKey: sourceDraft.optionKey,
    omsRestSourceConfigId: sourceDraft.omsRestSourceConfigId,
  }) as AutomationSourcePayload
}

export function buildSaveAutomationPayload(
  draft: ReconciliationAutomationDraft,
  savedRun: SavedRunSummary,
): SaveAutomationPayload {
  const payload = removeEmpty({
    automationId: draft.automationId,
    automationName: draft.automationName,
    description: draft.description,
    savedRunId: draft.savedRunId || savedRun.savedRunId,
    savedRunType: draft.savedRunType || savedRun.runType || 'ruleset',
    inputModeEnumId: draft.inputModeEnumId,
    scheduleExpr: draft.scheduleExpr,
    windowTimeZone: draft.windowTimeZone || 'UTC',
    relativeWindowTypeEnumId: draft.relativeWindowTypeEnumId,
    relativeWindowCount: automationWindowNeedsCount(draft.relativeWindowTypeEnumId) ? draft.relativeWindowCount : undefined,
    customWindowStartDate: automationWindowUsesCustomRange(draft.relativeWindowTypeEnumId) ? draft.customWindowStartDate : undefined,
    customWindowEndDate: automationWindowUsesCustomRange(draft.relativeWindowTypeEnumId) ? draft.customWindowEndDate : undefined,
    maxWindowDays: draft.maxWindowDays ?? 28,
    splitWindowDays: draft.splitWindowDays ?? 28,
    isActive: draft.isActive ?? true,
    chatSpaceId: draft.chatSpaceChoice === 'none' ? '' : draft.chatSpaceId,
    sources: [
      buildSourcePayload(draft, savedRun, 'FILE_1'),
      buildSourcePayload(draft, savedRun, 'FILE_2'),
    ],
  }) as SaveAutomationPayload
  // removeEmpty strips '' values, but an explicit empty chatSpaceId is exactly how the
  // backend clears the automation's chat-space link -- it must survive when the user
  // chose 'none', so it is restored here after the generic empty-value scrub above.
  if (draft.chatSpaceChoice === 'none') payload.chatSpaceId = ''
  return payload
}
