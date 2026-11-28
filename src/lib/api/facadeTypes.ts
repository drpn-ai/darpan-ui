// Request payload interfaces for facade methods.
// Naming convention: <MethodName>Payload

import type { SourceExcludeFilter } from '../sourceExcludeFilters'
import type { SharedConfigType } from '../sharedConfig'
import type { ChatProviderId, NotificationSourceType } from './types'
import type { Schemas } from './generated'
import type { SourceExtractOptions } from './authoringTypes'

// ─── Auth ───────────────────────────────────────────────────────────────────

export type SaveUserSettingsPayload = Schemas['SaveUserSettingsParams']

export type VerifyOwnPasswordPayload = Schemas['VerifyOwnPasswordParams']

export type ChangeOwnPasswordPayload = Schemas['ChangeOwnPasswordParams']

/** Carries `username` because there is no session to infer it from — this runs before sign-in, for an
 *  account that login refuses until its password changes. */
export type ChangeExpiredPasswordPayload = Schemas['ChangeExpiredPasswordParams']

/** DAR-BE-028 forgot password; all three run before sign-in, so they carry who is asking. */
export type RequestPasswordResetPayload = Schemas['RequestPasswordResetParams']

export type VerifyPasswordResetCodePayload = Schemas['VerifyPasswordResetCodeParams']

export type CompletePasswordResetPayload = Schemas['CompletePasswordResetParams']

/** The backend checks currentPassword itself: a session token alone cannot redirect reset codes. */
export type SaveRecoveryEmailPayload = Schemas['SaveRecoveryEmailParams']

// ─── Settings ────────────────────────────────────────────────────────────────

export type SaveTenantSettingsPayload = Schemas['SaveTenantSettingsParams']

export type ListSlackChannelsPayload = Schemas['ListSlackChannelsParams']

export type SaveSlackBotTokenPayload = Schemas['SaveSlackBotTokenParams']

export type DisconnectSlackWorkspacePayload = Schemas['DisconnectSlackWorkspaceParams']

export interface SaveTenantChatSpacePayload {
  chatSpaceId?: string
  spaceName: string
  chatProviderEnumId?: ChatProviderId
  slackInstallId?: string
  slackChannelId?: string
  slackChannelName?: string
  webhookUrl?: string
  isActive?: boolean
}

export type DeleteTenantChatSpacePayload = Schemas['DeleteTenantChatSpaceParams']

export type SaveUserNotificationDefaultPayload = Schemas['SaveUserNotificationDefaultParams']

/**
 * DAR-UI-123. Moves one source to a space. A blank chatSpaceId posts nowhere (refused for SCRIPT); an AUDIT_UPDATE move
 * needs a tenant admin.
 */
export interface SetNotificationRoutePayload {
  sourceType: NotificationSourceType
  /** Omit for STREAKS; the audit's code, the automationId or the tenantScriptDeploymentId otherwise. */
  sourceId?: string | null
  chatSpaceId?: string | null
}

export type SendChatSpaceTestPayload = Schemas['SendChatSpaceTestParams']

export interface ListSftpServersPayload {
  pageIndex: number
  pageSize: number
}

export interface SaveSftpServerPayload {
  sftpServerId?: string
  description?: string
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  remoteAttributes?: string
  /** DAR-BE-082: forget the saved server key so the next connection saves the one it sees. */
  resetHostKey?: boolean
}

export interface ListNsAuthConfigsPayload {
  pageIndex: number
  pageSize: number
}

export interface SaveNsAuthConfigPayload {
  nsAuthConfigId?: string
  description?: string
  authType: string
  isActive?: string
  username?: string
  password?: string
  apiToken?: string
  tokenUrl?: string
  clientId?: string
  certId?: string
  scope?: string
  privateKeyPem?: string
}

export interface ListShopifyAuthConfigsPayload {
  pageIndex: number
  pageSize: number
}

export type GetShopifyAuthConfigPayload = Schemas['GetShopifyAuthConfigParams']

export interface SaveShopifyAuthConfigPayload {
  shopifyAuthConfigId?: string
  description?: string
  shopApiUrl: string
  apiVersion: string
  timeZone: string
  accessToken?: string
  isActive?: string
  canReadOrders?: boolean
}

export type DeleteShopifyAuthConfigPayload = Schemas['DeleteShopifyAuthConfigParams']

export type DeleteNsAuthConfigPayload = Schemas['DeleteNsAuthConfigParams']

export type TestSourceConnectionPayload = Schemas['TestSourceConnectionParams']

export interface ListOmsRestSourceConfigsPayload {
  pageIndex: number
  pageSize: number
}

export interface SaveOmsRestSourceConfigPayload {
  omsRestSourceConfigId?: string
  description?: string
  baseUrl: string
  timeZone: string
  authType: string
  username?: string
  password?: string
  apiToken?: string
  /** Only ever '{}', and only after the user agrees to drop stored headers a moved connection cannot carry (C4). */
  headersJson?: '{}'
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive?: boolean
  canReadOrders?: boolean
}

export interface DeleteOmsRestSourceConfigPayload {
  omsRestSourceConfigId: string
}

// ─── Config sharing (DAR-BE-005) ───────────────────────────────────────────────

export interface ListConfigTenantAccessPayload {
  configTypeEnumId: SharedConfigType
  configId: string
}

export interface ConfigTenantAccessMutationPayload extends ListConfigTenantAccessPayload {
  targetTenantUserGroupId: string
}

// ─── Source endpoint access (per-endpoint enablement) ──────────────────────────

export interface ListSourceConfigEndpointsPayload {
  configTypeEnumId: SharedConfigType
  configId: string
}

export interface StoreSourceConfigEndpointAccessPayload {
  configTypeEnumId: SharedConfigType
  configId: string
  enabledSystemEnumIds: string[]
}

// ─── JSON Schema ─────────────────────────────────────────────────────────────

export type ListJsonSchemasPayload = Schemas['ListJsonSchemasParams']

export type GetJsonSchemaPayload = Schemas['GetJsonSchemaParams']

export interface SaveJsonSchemaTextPayload {
  schemaName: string
  systemEnumId: string
  schemaText: string
  overwrite?: boolean
}

export type InferJsonSchemaFromTextPayload = Schemas['InferJsonSchemaFromTextParams']

/** csvText is the head of the upload. isCompleteFile says whether it is the whole file: a truncated header and a complete
 *  header-only file with no trailing newline are byte-identical, and this is the only thing that separates them. */
export type InferJsonSchemaFromCsvTextPayload = Schemas['InferJsonSchemaFromCsvTextParams']

export interface FlattenJsonSchemaPayload {
  jsonSchemaId: string
}

export interface SaveRefinedSchemaPayload {
  jsonSchemaId: string
  schemaName: string
  description?: string
  systemEnumId: string
  fieldList: Array<{ fieldPath: string; type: string; required: boolean }>
}

export interface DeleteJsonSchemaPayload {
  jsonSchemaId: string
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export interface RuleSetRulePayload {
  ruleId?: string
  sequenceNum: number
  /** DAR-BE-210. Plain-text name (up to 60) run notifications show instead of ruleText. null clears it. */
  ruleName?: string | null
  ruleText: string
  ruleLogic: string
  ruleType: string
  expression: string
  enabled: string
  severity: string
}

export interface CreateRuleSetRunPayload {
  runName: string
  description?: string
  /** COMPARE (default) or EVALUATE. EVALUATE builds a single-sided run and sends no second side. */
  scopeMode?: string
  file1SystemEnumId: string
  /** Absent on a single-sided run: there is no second system to name. */
  file2SystemEnumId?: string
  file1SourceTypeEnumId?: string
  file1SystemMessageRemoteId?: string
  file1SourceConfigId?: string
  file1SourceConfigType?: string
  file1FileTypeEnumId?: string
  file1SchemaFileName?: string
  file1PrimaryIdExpression?: string
  file1PrimaryIdExpressions?: string[]
  file2SourceTypeEnumId?: string
  file2SystemMessageRemoteId?: string
  file2SourceConfigId?: string
  file2SourceConfigType?: string
  file2FileTypeEnumId?: string
  file2SchemaFileName?: string
  file2PrimaryIdExpression?: string
  file2PrimaryIdExpressions?: string[]
  file1ExcludeFilters?: SourceExcludeFilter[]
  file2ExcludeFilters?: SourceExcludeFilter[]
  rules?: RuleSetRulePayload[]
  /** DAR-UI-064. Only names the side's connector declares; false / blank are left out. */
  file1ExtractOptions?: SourceExtractOptions
  file2ExtractOptions?: SourceExtractOptions
}

/** save#RuleSetRun takes no scopeMode: a run's scope is fixed when it is created. */
export interface SaveRuleSetRunPayload extends Omit<CreateRuleSetRunPayload, 'scopeMode'> {
  savedRunId?: string
}

export interface ListSavedRunsPayload {
  pageIndex: number
  pageSize: number
  query?: string
}

export type GetMappingPayload = Schemas['GetMappingParams']

export interface SaveMappingPayload {
  reconciliationMappingId?: string
  mappingName: string
  schema1Id?: string
  schema2Id?: string
  schema1FieldPath?: string
  schema2FieldPath?: string
}

export interface SaveDashboardPinnedSavedRunsPayload {
  pinnedSavedRunIds: string[]
}

export type SaveSavedRunNamePayload = Schemas['SaveSavedRunNameParams']

export type DeleteSavedRunPayload = Schemas['DeleteSavedRunParams']

export interface RunSavedRunDiffPayload {
  savedRunId: string
  file1SystemEnumId?: string
  file2SystemEnumId?: string
  hasHeader?: boolean
  windowStartDate?: string
  windowEndDate?: string
  windowStartLocalDate?: string
  windowEndLocalDate?: string
  file1Name?: string
  file1Text?: string
  file2Name?: string
  file2Text?: string
  /** DAR-BE-163: a failed run of this saved run to retry from the step it failed at, over its own window. */
  retryFromRunResultId?: string
}

export interface ListGeneratedOutputsPayload {
  savedRunId?: string
  pageIndex: number
  pageSize: number
  query?: string
}

export interface GetGeneratedOutputPayload {
  fileName: string
  format: string
}

export type GetGeneratedOutputDifferencesPayload = Schemas['GetGeneratedOutputDifferencesParams']

export interface ListAutomationsPayload {
  pageIndex: number
  pageSize: number
  query?: string
}

export type GetAutomationPayload = Schemas['GetAutomationParams']

export type SyncAutomationPayload = Schemas['SyncAutomationParams']

export interface AutomationSourcePayload {
  fileSide: string
  sourceTypeEnumId: string
  systemEnumId?: string
  fileTypeEnumId?: string
  schemaFileName?: string
  primaryIdExpression?: string
  sftpServerId?: string
  remotePathTemplate?: string
  fileNamePattern?: string
  systemMessageRemoteId?: string
  apiRequestTemplateJson?: string
  apiResponsePathExpression?: string
  dateFromParameterName?: string
  dateToParameterName?: string
  safeMetadataJson?: string
  optionKey?: string
  omsRestSourceConfigId?: string
}

export interface SaveAutomationPayload {
  automationId?: string
  automationName?: string
  description?: string
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
  chatSpaceId?: string
  sources?: AutomationSourcePayload[]
}

export interface RunAutomationNowPayload {
  automationId: string
}

export type PauseAutomationPayload = Schemas['PauseAutomationParams']

export type ResumeAutomationPayload = Schemas['ResumeAutomationParams']

export interface ListAutomationExecutionsPayload {
  automationId: string
  pageIndex: number
  pageSize: number
}

export type SubscribeRunNotificationPayload = Schemas['SubscribeRunNotificationParams']

export type UnsubscribeRunNotificationPayload = Schemas['UnsubscribeRunNotificationParams']

export type CancelReconciliationRunPayload = Schemas['CancelReconciliationRunParams']

// ─── CLI sign-in (DAR-CLI-003) ─────────────────────────────────────────────────

export interface CliLoginCodePayload {
  userCode: string
}

/** approve#CliLogin: a `code` (DAR-BE-264) or a `passkeyAssertion` (DAR-BE-270) when the approver has two-factor on. */
export type ApproveCliLoginPayload = Schemas['ApproveCliLoginParams']

// ─── Two-factor (DAR-BE-264) ───────────────────────────────────────────────────

export type VerifySignInCodePayload = Schemas['VerifySignInCodeParams']
export type BeginTwoFactorSetupPayload = Schemas['BeginTwoFactorSetupParams']
export type ConfirmTwoFactorSetupPayload = Schemas['ConfirmTwoFactorSetupParams']
/** A fresh proof: a current code from the app, or (DAR-BE-270) a passkey assertion over begin#PasskeyProof's options. */
export type TwoFactorCodePayload = Schemas['CreateRecoveryCodesParams']
export type DisableTwoFactorPayload = Schemas['DisableTwoFactorParams']

// ─── Passkeys (DAR-BE-270) ─────────────────────────────────────────────────────

export type BeginPasskeySignInPayload = Schemas['BeginPasskeySignInParams']
export type BeginPasskeyFirstSignInPayload = Schemas['BeginPasskeyFirstSignInParams']
export type FinishPasskeyFirstSignInPayload = Schemas['FinishPasskeyFirstSignInParams']
export type BeginPasskeyRegistrationPayload = Schemas['BeginPasskeyRegistrationParams']
export type FinishPasskeyRegistrationPayload = Schemas['FinishPasskeyRegistrationParams']
export type RenamePasskeyPayload = Schemas['RenamePasskeyParams']
export type DeletePasskeyPayload = Schemas['DeletePasskeyParams']

export type RevokeCliSessionPayload = Schemas['RevokeCliSessionParams']

// ─── Mascot content (DAR-BE-313) ─────────────────────────────────────────────

/** The mascot entries an admin edited, hid or created; `version` is null when none are served. */
export type GetAppContentResponse = Schemas['GetAppContentResult']
