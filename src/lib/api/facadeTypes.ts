// Request payload interfaces for facade methods.
// Naming convention: <MethodName>Payload

import type { SourceExcludeFilter } from '../sourceExcludeFilters'
import type { SharedConfigType } from '../sharedConfig'

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface SaveUserSettingsPayload {
  displayName?: string
  timeZone?: string
}

export interface VerifyOwnPasswordPayload {
  currentPassword: string
}

export interface ChangeOwnPasswordPayload {
  currentPassword: string
  newPassword: string
  newPasswordVerify: string
}

/** Carries `username` because there is no session to infer it from — this runs before sign-in, for an
 *  account that login refuses until its password changes. */
export interface ChangeExpiredPasswordPayload {
  username: string
  currentPassword: string
  newPassword: string
  newPasswordVerify: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface GetLlmSettingsPayload {
  llmProvider?: string
}

export interface SaveLlmSettingsPayload {
  llmProvider: string
  llmModel?: string
  llmBaseUrl?: string
  llmTimeoutSeconds?: string
  llmEnabled?: string
  llmApiKey?: string
}

export interface SaveTenantSettingsPayload {
  timeZone?: string
}

export interface SaveTenantChatSpacePayload {
  chatSpaceId?: string
  spaceName: string
  googleChatWebhookUrl?: string
  isActive?: boolean
}

export interface DeleteTenantChatSpacePayload {
  chatSpaceId: string
}

export interface SaveUserNotificationDefaultPayload {
  chatSpaceId?: string
}

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

export interface ListNsRestletConfigsPayload {
  pageIndex: number
  pageSize: number
}

export interface SaveNsRestletConfigPayload {
  nsRestletConfigId?: string
  description?: string
  endpointUrl: string
  httpMethod: string
  nsAuthConfigId: string
  headersJson?: string
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive?: string
}

export interface ListShopifyAuthConfigsPayload {
  pageIndex: number
  pageSize: number
}

export interface GetShopifyAuthConfigPayload {
  shopifyAuthConfigId: string
}

export interface SaveShopifyAuthConfigPayload {
  shopifyAuthConfigId: string
  description?: string
  shopApiUrl: string
  apiVersion: string
  timeZone: string
  accessToken?: string
  isActive?: string
  canReadOrders?: boolean
}

export interface DeleteShopifyAuthConfigPayload {
  shopifyAuthConfigId: string
}

export interface TestSourceConnectionPayload {
  systemEnumId: string
  configId: string
  /** Run only this stage, as reported by a previous call's nextStage. */
  stage?: string
  /** Start a staged run: with no stage, runs only the connector's first stage. */
  staged?: boolean
}

export interface ListOmsRestSourceConfigsPayload {
  pageIndex: number
  pageSize: number
}

export interface SaveOmsRestSourceConfigPayload {
  omsRestSourceConfigId: string
  description?: string
  baseUrl: string
  timeZone: string
  authType: string
  username?: string
  password?: string
  apiToken?: string
  headersJson?: string
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

// ─── JSON Schema ─────────────────────────────────────────────────────────────

export interface ListJsonSchemasPayload {
  pageIndex?: number
  pageSize?: number
  query?: string
  systemEnumId?: string
}

export interface GetJsonSchemaPayload {
  jsonSchemaId?: string
  schemaName?: string
}

export interface SaveJsonSchemaTextPayload {
  schemaName: string
  systemEnumId: string
  schemaText: string
  overwrite?: boolean
}

export interface InferJsonSchemaFromTextPayload {
  jsonText: string
}

export interface ValidateJsonTextPayload {
  jsonText?: string
  jsonSchemaId?: string
}

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
  file1SystemEnumId: string
  file2SystemEnumId: string
  file1SourceTypeEnumId?: string
  file1SystemMessageRemoteId?: string
  file1NsRestletConfigId?: string
  file1SourceConfigId?: string
  file1SourceConfigType?: string
  file1FileTypeEnumId?: string
  file1SchemaFileName?: string
  file1PrimaryIdExpression?: string
  file1PrimaryIdExpressions?: string[]
  file2SourceTypeEnumId?: string
  file2SystemMessageRemoteId?: string
  file2NsRestletConfigId?: string
  file2SourceConfigId?: string
  file2SourceConfigType?: string
  file2FileTypeEnumId?: string
  file2SchemaFileName?: string
  file2PrimaryIdExpression?: string
  file2PrimaryIdExpressions?: string[]
  file1ExcludeFilters?: SourceExcludeFilter[]
  file2ExcludeFilters?: SourceExcludeFilter[]
  rules?: RuleSetRulePayload[]
}

export interface SaveRuleSetRunPayload extends CreateRuleSetRunPayload {
  savedRunId?: string
}

export interface ListSavedRunsPayload {
  pageIndex: number
  pageSize: number
  query?: string
}

export interface GetMappingPayload {
  reconciliationMappingId: string
}

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

export interface SaveSavedRunNamePayload {
  savedRunId: string
  runName: string
}

export interface DeleteSavedRunPayload {
  savedRunId: string
}

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

export interface GetGeneratedOutputDifferencesPayload {
  fileName: string
  pageIndex?: number
  pageSize?: number
  buckets?: string
  ruleFilterKey?: string
  search?: string
  includeFacets?: boolean
}

export interface ListAutomationsPayload {
  pageIndex: number
  pageSize: number
  query?: string
}

export interface GetAutomationPayload {
  automationId: string
}

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
  nsRestletConfigId?: string
  apiRequestTemplateJson?: string
  apiResponsePathExpression?: string
  dateFromParameterName?: string
  dateToParameterName?: string
  safeMetadataJson?: string
  optionKey?: string
  omsRestSourceConfigId?: string
  // Presence-sensitive, like the rule-set payload's file{1,2}ExcludeFilters: an omitted key leaves the
  // automation's existing rows alone, an explicit [] clears them. Declared here so buildSourcePayload
  // no longer has to write it through an `as` cast, which is what hid its absence.
  excludeFilters?: SourceExcludeFilter[]
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

export interface DeleteAutomationPayload {
  automationId: string
}

export interface RunAutomationNowPayload {
  automationId: string
}

export interface ListAutomationExecutionsPayload {
  automationId: string
  pageIndex: number
  pageSize: number
  query?: string
}

export interface SubscribeRunNotificationPayload {
  reconciliationRunResultId: string
}

export interface UnsubscribeRunNotificationPayload {
  reconciliationRunResultId: string
}

export interface CancelReconciliationRunPayload {
  reconciliationRunResultId: string
}
