import type { Schemas } from './generated'

export interface ApiEnvelope {
  ok: boolean
  messages: string[]
  errors: string[]
}

export type ApiTimestamp = string | number

export type SessionScopeType = 'GLOBAL' | 'TENANT' | 'ANONYMOUS'

export interface SessionTenantOption {
  userGroupId: string
  label?: string
}

export interface SessionLastRun {
  reconciliationRunResultId?: string
  savedRunId?: string
  savedRunType?: string
  reconciliationRunId?: string
  createdDate?: string
}

export interface PaginationMeta {
  pageIndex: number
  pageSize: number
  totalCount: number
  pageCount: number
}

export interface EnumOption {
  enumId: string
  enumCode?: string
  description?: string
  sequenceNum?: number
  label?: string
}

export interface SessionInfo {
  userId: string
  username?: string
  displayName?: string
  locale?: string
  timeZone?: string
  lastLoginDate?: string
  lastRun?: SessionLastRun | null
  scopeType?: SessionScopeType
  customerScopeId?: string | null
  activeTenantUserGroupId?: string | null
  activeTenantLabel?: string | null
  availableTenants?: SessionTenantOption[]
  activeTenantPermissionGroupIds?: string[]
  canViewActiveTenantData?: boolean
  canRunActiveTenantReconciliation?: boolean
  canEditActiveTenantData?: boolean
  canManageDarpanCore?: boolean
  isSuperAdmin?: boolean
}

export interface AuthTokenContract {
  authToken?: string
  authTokenType?: string
  authTokenHeaderName?: string
  authTokenExpiresInSeconds?: number
}

export interface SessionInfoResponse extends ApiEnvelope {
  authenticated: boolean
  sessionInfo?: SessionInfo | null
}

export interface SaveActiveTenantResponse extends ApiEnvelope {
  authenticated: boolean
  sessionInfo?: SessionInfo | null
}

export interface SaveUserSettingsResponse extends ApiEnvelope {
  authenticated: boolean
  sessionInfo?: SessionInfo | null
}

export interface VerifyOwnPasswordResponse extends ApiEnvelope {
  authenticated: boolean
  passwordVerified?: boolean
  sessionInfo?: SessionInfo | null
}

export interface ChangeOwnPasswordResponse extends ApiEnvelope {
  authenticated: boolean
  passwordUpdated?: boolean
  sessionInfo?: SessionInfo | null
}

export interface LoginSessionResponse extends ApiEnvelope, AuthTokenContract {
  authenticated: boolean
  sessionInfo?: SessionInfo | null
}

// Migration template (MACH P1): sourced from the generated OpenAPI contract types
// instead of a hand-written interface. Same exported name, so consumers are
// unchanged; note every generated field is optional (the contract declares no
// `required` fields on Result schemas). Retire other interfaces here the same way.
export type LogoutSessionResponse = Schemas['LogoutSessionResult']

export interface ListEnumOptionsResponse extends ApiEnvelope {
  options: EnumOption[]
}

export interface LlmSettings {
  activeProvider: string
  llmProvider: string
  llmModel: string
  llmBaseUrl: string
  llmTimeoutSeconds: string
  llmEnabled: string
  hasStoredLlmApiKey?: boolean
  hasFallbackLlmApiKey?: boolean
  fallbackLlmKeyEnvName?: string
}

export interface LlmSettingsResponse extends ApiEnvelope {
  llmSettings?: LlmSettings
}

export type SaveLlmSettingsResponse = Schemas['SaveLlmSettingsResult']

export interface TenantSettings {
  companyUserGroupId?: string | null
  companyLabel?: string | null
  timeZone: string
  createdByUserId?: string
  createdDate?: string
  lastUpdatedDate?: string
}

export interface GetTenantSettingsResponse extends ApiEnvelope {
  tenantSettings?: TenantSettings
}

export interface SaveTenantSettingsResponse extends ApiEnvelope {
  tenantSettings?: TenantSettings
}

export interface TenantNotificationSettings {
  companyUserGroupId?: string | null
  companyLabel?: string | null
  googleChatConfigured: boolean
  googleChatWebhookUrlMasked?: string | null
  isActive: string
  createdByUserId?: string
  createdDate?: string
  lastUpdatedDate?: string
}

export interface GetTenantNotificationSettingsResponse extends ApiEnvelope {
  tenantNotificationSettings?: TenantNotificationSettings
}

export interface SaveTenantNotificationSettingsResponse extends ApiEnvelope {
  tenantNotificationSettings?: TenantNotificationSettings
}

export interface SftpServerRecord {
  sftpServerId: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  host: string
  port: number
  username: string
  remoteAttributes?: string
  hasPassword: boolean
  hasPrivateKey: boolean
}

export type SaveSftpServerResponse = Schemas['SaveSftpServerResult']

export interface NsAuthConfigRecord {
  nsAuthConfigId: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  authType: string
  username?: string
  tokenUrl?: string
  clientId?: string
  certId?: string
  scope?: string
  isActive: string
  hasPassword: boolean
  hasApiToken: boolean
  hasPrivateKeyPem: boolean
}

export type SaveNsAuthConfigResponse = Schemas['SaveNsAuthConfigResult']

export interface NsRestletConfigRecord {
  nsRestletConfigId: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  endpointUrl: string
  httpMethod: string
  nsAuthConfigId: string
  authDescription?: string
  authType?: string
  authIsActive?: string
  headersJson?: string
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive: string
}

export type SaveNsRestletConfigResponse = Schemas['SaveNsRestletConfigResult']

export interface ShopifyAuthConfigRecord {
  shopifyAuthConfigId: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  createdByUserId?: string
  shopApiUrl: string
  apiVersion: string
  timeZone: string
  isActive: string
  canReadOrders: boolean
  hasAccessToken: boolean
}

export type SaveShopifyAuthConfigResponse = Schemas['SaveShopifyAuthConfigResult']

export type DeleteShopifyAuthConfigResponse = Schemas['DeleteShopifyAuthConfigResult']

export interface GetShopifyAuthConfigResponse extends ApiEnvelope {
  shopifyAuthConfig?: ShopifyAuthConfigRecord | null
}

export interface OmsRestSourceConfigRecord {
  omsRestSourceConfigId: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  baseUrl: string
  ordersPath: string
  timeZone: string
  authType: string
  hasUsername?: boolean
  hasPassword?: boolean
  hasApiToken?: boolean
  customHeaderNames?: string[]
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive: string
  canReadOrders?: boolean
  createdDate?: string
  lastUpdatedDate?: string
}

export interface SaveOmsRestSourceConfigResponse extends ApiEnvelope {
  savedOmsRestSourceConfig?: OmsRestSourceConfigRecord
}

export type DeleteOmsRestSourceConfigResponse = Schemas['DeleteHotWaxOmsRestSourceConfigResult']

export interface PaginatedResponse extends ApiEnvelope {
  pagination: PaginationMeta
}

export interface MappingSystemOption {
  enumId: string
  enumCode?: string
  description?: string
  label?: string
  fileTypeEnumId?: string
  fileTypeLabel?: string
  idFieldExpression?: string
  idFieldExpressions?: string[]
  schemaFileName?: string
  sourceTypeEnumId?: string
  sourceTypeLabel?: string
  systemMessageRemoteId?: string
  systemMessageRemoteLabel?: string
  nsRestletConfigId?: string
  nsRestletConfigLabel?: string
  sourceConfigId?: string
  sourceConfigType?: string
}

export interface SavedRunSystemOption extends MappingSystemOption {
  fileSide?: string
}

export interface SavedRunRule {
  ruleId?: string
  sequenceNum?: number
  ruleText?: string
  ruleLogic?: string
  ruleType?: string
  expression?: string
  enabled?: string
  severity?: string
  file1FieldPath?: string
  file2FieldPath?: string
  operator?: string
  preActions?: Array<string | { fieldSide?: string, action?: string, preAction?: string }>
}

export interface SavedRunSummary {
  savedRunId: string
  runName: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  runType?: string
  reconciliationMappingId?: string
  ruleSetId?: string
  compareScopeId?: string
  requiresSystemSelection: boolean
  defaultFile1SystemEnumId?: string
  defaultFile2SystemEnumId?: string
  systemOptions: SavedRunSystemOption[]
  rules?: SavedRunRule[]
}

export interface AutomationPermissions {
  canViewHistory?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canPause?: boolean
  canResume?: boolean
  canRunNow?: boolean
}

export interface AutomationExecutionSummary {
  automationExecutionId: string
  automationId?: string
  companyUserGroupId?: string
  statusEnumId?: string
  statusLabel?: string
  scheduledDate?: ApiTimestamp
  startedDate?: ApiTimestamp
  completedDate?: ApiTimestamp
  resultFileName?: string
  resultDataManagerPath?: string
  reconciliationRunResultId?: string
  file1RecordCount?: number
  file2RecordCount?: number
  differenceCount?: number
  onlyInFile1Count?: number
  onlyInFile2Count?: number
  errorMessage?: string
  createdDate?: ApiTimestamp
}

export interface AutomationSourceRecord {
  automationId?: string
  fileSide: string
  companyUserGroupId?: string
  sourceTypeEnumId?: string
  sourceTypeLabel?: string
  systemEnumId?: string
  systemLabel?: string
  fileTypeEnumId?: string
  fileTypeLabel?: string
  schemaFileName?: string
  recordRootExpression?: string
  primaryIdExpression?: string
  idValueNormalizer?: string
  systemMessageRemoteId?: string
  nsRestletConfigId?: string
  sftpServerId?: string
  sftpServerLabel?: string
  remotePathTemplate?: string
  fileNamePattern?: string
  apiRequestTemplateJson?: string
  apiResponsePathExpression?: string
  dateFromParameterName?: string
  dateToParameterName?: string
  safeMetadataJson?: string
}

export interface AutomationRecord {
  automationId: string
  automationName: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  savedRunId?: string
  savedRunName?: string
  savedRunType?: string
  savedRun?: SavedRunSummary
  ruleSetId?: string
  compareScopeId?: string
  reconciliationMappingId?: string
  inputModeEnumId?: string
  inputModeLabel?: string
  inputModeCode?: string
  sourceSummary?: string
  scheduleExpr?: string
  scheduleSummary?: string
  timezone?: string
  nextScheduledFireTime?: ApiTimestamp
  lastScheduledFireTime?: ApiTimestamp
  relativeWindowTypeEnumId?: string
  relativeWindowLabel?: string
  relativeWindowCount?: number
  customWindowStartDate?: string
  customWindowEndDate?: string
  maxWindowDays?: number
  splitWindowDays?: number
  isActive?: string
  active?: boolean
  executionCount?: number
  lastExecution?: AutomationExecutionSummary | null
  permissions?: AutomationPermissions
  sources?: AutomationSourceRecord[]
  createdDate?: string
  lastUpdatedDate?: string
}

export interface AutomationSftpServerOption {
  sftpServerId: string
  description?: string
  companyUserGroupId?: string
  scopeEnumId?: string
  host?: string
  port?: number
  username?: string
  label?: string
}

export interface AutomationNsRestletOption {
  nsRestletConfigId: string
  description?: string
  endpointUrl?: string
  httpMethod?: string
  nsAuthConfigId?: string
  sourceConfigId?: string
  sourceConfigType?: string
  sourceConfigLabel?: string
  isActive?: string
  systemEnumId?: string
  systemLabel?: string
  safeMetadataJson?: string
  primaryIdOptions?: AutomationPrimaryIdOption[]
  label?: string
}

export interface AutomationSystemRemoteOption {
  systemMessageRemoteId: string
  description?: string
  sendUrl?: string
  systemEnumId?: string
  systemLabel?: string
  safeMetadataJson?: string
  optionKey?: string
  sourceConfigId?: string
  sourceConfigType?: string
  sourceConfigLabel?: string
  shopifyAuthConfigId?: string
  omsRestSourceConfigId?: string
  primaryIdOptions?: AutomationPrimaryIdOption[]
  label?: string
}

export interface AutomationSourceConfigOption {
  sourceConfigId: string
  sourceConfigType?: string
  description?: string
  systemEnumId?: string
  systemLabel?: string
  label?: string
  nsAuthConfigId?: string
  shopifyAuthConfigId?: string
  omsRestSourceConfigId?: string
}

export interface AutomationPrimaryIdOption {
  fieldPath: string
  label?: string
  type?: string
}

export interface MappingSummary {
  reconciliationMappingId: string
  mappingName: string
  description?: string
  companyUserGroupId?: string
  companyLabel?: string
  requiresSystemSelection: boolean
  defaultFile1SystemEnumId?: string
  defaultFile2SystemEnumId?: string
  systemOptions: MappingSystemOption[]
}

export interface MappingDetailMember {
  mappingMemberId: string
  systemEnumId?: string
  systemLabel?: string
  jsonSchemaId?: string
  schemaName?: string
  fieldPath?: string
}

export interface MappingDetail {
  reconciliationMappingId: string
  mappingName: string
  members: MappingDetailMember[]
}

export interface SavedMapping {
  reconciliationMappingId: string
  mappingName: string
  companyUserGroupId?: string
  companyLabel?: string
  file1SystemEnumId?: string
  file2SystemEnumId?: string
  file1SchemaName?: string
  file2SchemaName?: string
  file1FieldPath?: string
  file2FieldPath?: string
}

export interface GeneratedOutput {
  fileName: string
  reconciliationRunResultId?: string
  sourceFormat: string
  availableFormats: string[]
  preferredDownloadFormat?: string
  savedRunId?: string
  savedRunName?: string
  savedRunType?: string
  reconciliationMappingId?: string
  mappingName?: string
  ruleSetId?: string
  compareScopeId?: string
  reconciliationType?: string
  file1Label?: string
  file2Label?: string
  totalDifferences?: number
  onlyInFile1Count?: number
  onlyInFile2Count?: number
  createdDate?: string | number
  sizeBytes?: number
  statusEnumId?: string
  statusLabel?: string
  currentStage?: string
  progressPercent?: number
  resultAvailable?: boolean
  startedDate?: string | number
  completedDate?: string | number
  lastUpdatedDate?: string | number
}

export interface RunSavedRunDiffResult {
  savedRunId: string
  runName?: string
  runType?: string
  reconciliationMappingId?: string
  ruleSetId?: string
  compareScopeId?: string
  file1Name?: string
  file2Name?: string
  file1SystemEnumId?: string
  file1SystemLabel?: string
  file2SystemEnumId?: string
  file2SystemLabel?: string
  validationErrors?: string[]
  processingWarnings?: string[]
  generatedOutput?: GeneratedOutput
}

export interface GetGeneratedOutputFile {
  fileName: string
  downloadFileName: string
  sourceFormat: string
  format: string
  contentType: string
  contentText: string
  sourceDetails?: GeneratedOutputSourceDetails
}

export interface GeneratedOutputSourceFile {
  side?: string
  label?: string
  fileName?: string
  filePath?: string
  downloadFileName?: string
  sourceFormat?: string
  canDownload?: boolean
}

export interface GeneratedOutputSourceDetails {
  mode?: string
  dateRange?: {
    start?: string
    end?: string
  }
  files?: GeneratedOutputSourceFile[]
}

export interface ListSftpServersResponse extends PaginatedResponse {
  servers: SftpServerRecord[]
}

export interface ListNsAuthConfigsResponse extends PaginatedResponse {
  authConfigs: NsAuthConfigRecord[]
}

export interface ListNsRestletConfigsResponse extends PaginatedResponse {
  restletConfigs: NsRestletConfigRecord[]
}

export interface ListShopifyAuthConfigsResponse extends PaginatedResponse {
  shopifyAuthConfigs: ShopifyAuthConfigRecord[]
}

export interface ListOmsRestSourceConfigsResponse extends PaginatedResponse {
  omsRestSourceConfigs: OmsRestSourceConfigRecord[]
}

export type ListMappingsResponse = Schemas['ListMappingsResult']

export interface ListSavedRunsResponse extends PaginatedResponse {
  pinnedSavedRunIds?: string[]
  savedRuns: SavedRunSummary[]
}

export interface ListAutomationsResponse extends PaginatedResponse {
  automations: AutomationRecord[]
}

export interface GetAutomationResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
}

export type SaveAutomationResponse = Schemas['SaveAutomationResult']

export type DeleteAutomationResponse = Schemas['DeleteAutomationResult']

export interface RunAutomationNowResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
  runResult?: Record<string, unknown> | null
}

export interface ListAutomationExecutionsResponse extends PaginatedResponse {
  executions: AutomationExecutionSummary[]
}

export interface ListAutomationSourceOptionsResponse extends ApiEnvelope {
  inputModes: EnumOption[]
  sourceTypes: EnumOption[]
  relativeWindows: EnumOption[]
  fileTypes: EnumOption[]
  systems: EnumOption[]
  savedRuns: SavedRunSummary[]
  sftpServers: AutomationSftpServerOption[]
  sourceConfigs?: AutomationSourceConfigOption[]
  nsRestletConfigs: AutomationNsRestletOption[]
  systemRemotes: AutomationSystemRemoteOption[]
}

export type SaveDashboardPinnedMappingsResponse = Schemas['SaveDashboardPinnedMappingsResult']

export interface SaveDashboardPinnedSavedRunsResponse extends ApiEnvelope {
  pinnedSavedRunIds?: string[]
}

export type SaveSavedRunNameResponse = Schemas['SaveSavedRunNameResult']

export type DeleteSavedRunResponse = Schemas['DeleteSavedRunResult']

export interface RunSavedRunDiffResponse extends ApiEnvelope {
  validationErrors?: string[]
  processingWarnings?: string[]
  runResult?: RunSavedRunDiffResult
}

export type CreateMappingResponse = Schemas['CreateMappingResult']

export interface CreateRuleSetRunResponse extends ApiEnvelope {
  savedRun?: SavedRunSummary
}

export type SaveRuleSetRunResponse = Schemas['SaveRuleSetRunResult']

export type CreateCsvRunResponse = Schemas['CreateCsvRunResult']

export type GetMappingResponse = Schemas['GetMappingResult']

export type SaveMappingResponse = Schemas['SaveMappingResult']

export interface ListGeneratedOutputsResponse extends PaginatedResponse {
  generatedOutputs: GeneratedOutput[]
}

export type GetGeneratedOutputResponse = Schemas['GetGeneratedOutputResult']

export interface GetReconciliationRunStatusPayload {
  reconciliationRunResultId: string
}

export type GetReconciliationRunStatusResponse = Schemas['GetReconciliationRunStatusResult']

export type ReconciliationRunStep = NonNullable<GetReconciliationRunStatusResponse['steps']>[number]

export interface GeneratedOutputDifferencesMetadata {
  file1Label?: string
  file2Label?: string
  timestamp?: string
  savedRunId?: string
  savedRunName?: string
  savedRunType?: string
  reconciliationMappingId?: string
  reconciliationMappingName?: string
  ruleSetId?: string
  compareScopeId?: string
}

export interface GeneratedOutputDifferencesSummary {
  totalDifferences?: number
  onlyInFile1Count?: number
  onlyInFile2Count?: number
  ruleDifferenceCount?: number | null
  missingObjectDifferenceCount?: number | null
}

export interface GeneratedOutputDifferenceRow {
  rowKey: string
  recordId: string
  bucket: string
  ruleFilterKey: string
  ruleId: string
  ruleLabel: string
  record: Record<string, unknown>
}

export interface GeneratedOutputDifferencesRuleOption {
  key: string
  label: string
  detail: string
  count: number
  bucketKeys: string[]
}

export interface GeneratedOutputDifferencesFile {
  fileName: string
  downloadFileName: string
  sourceFormat: string
  format: string
  contentType: string
  sourceDetails?: GeneratedOutputSourceDetails
}

export interface GetGeneratedOutputDifferencesResponse extends ApiEnvelope {
  metadata?: GeneratedOutputDifferencesMetadata
  summary?: GeneratedOutputDifferencesSummary
  bucketCounts?: Record<string, number>
  ruleOptions?: GeneratedOutputDifferencesRuleOption[]
  differences?: GeneratedOutputDifferenceRow[]
  pageIndex?: number
  pageSize?: number
  pageCount?: number
  totalDifferences?: number
  totalFiltered?: number
  outputFile?: GeneratedOutputDifferencesFile
}

export type DeleteGeneratedOutputResponse = Schemas['DeleteGeneratedOutputResult']

export interface JsonSchemaSummary {
  jsonSchemaId: string
  schemaName: string
  description?: string
  systemEnumId?: string
  systemLabel?: string
  companyUserGroupId?: string
  companyLabel?: string
  statusId?: string
  createdDate?: string
  lastUpdatedStamp?: string
}

export interface JsonSchemaData extends JsonSchemaSummary {
  schemaText: string
}

export interface ListJsonSchemasResponse extends ApiEnvelope {
  pagination: PaginationMeta
  schemas: JsonSchemaSummary[]
}

export type SaveJsonSchemaTextResponse = Schemas['SaveJsonSchemaTextResult']

export interface GetJsonSchemaResponse extends ApiEnvelope {
  schemaData?: JsonSchemaData
}

export interface InferJsonSchemaResponse extends ApiEnvelope {
  jsonSchemaString?: string
  fieldList?: JsonSchemaField[]
}

export type ValidateJsonResponse = Schemas['ValidateJsonTextAgainstSchemaResult']

export interface FlattenJsonSchemaResponse extends ApiEnvelope {
  jsonSchemaString?: string
  fieldList?: JsonSchemaField[]
}

export type SaveRefinedSchemaResponse = Schemas['SaveRefinedSchemaResult']

export type DeleteJsonSchemaResponse = Schemas['DeleteJsonSchemaResult']

export interface JsonSchemaField {
  fieldPath: string
  type: 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  depth?: number
  fieldName?: string
  indentLevel?: number
  [key: string]: unknown
}
