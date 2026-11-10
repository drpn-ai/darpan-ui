import type { SavedRunSummary, SavedRunSystemOption } from './api/types'
import type { AutomationSourcePayload, SaveAutomationPayload } from './api/facadeTypes'
import { normalizeExcludeFilters, type SourceExcludeFilter } from './sourceExcludeFilters'
import { removeEmpty } from './utils/objects'

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
  | 'chat-space-channel'
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
  newChatSpaceChannelId?: string
  newChatSpaceUrl?: string
  sources?: Partial<Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft>>
}

export interface ReconciliationAutomationDraftState {
  draft: ReconciliationAutomationDraft
  resumeStepId: ReconciliationAutomationStepId | null
  savedRun: SavedRunSummary | null
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
