import type { Schemas } from './generated'
import type { SourceExcludeFilter } from '../sourceExcludeFilters'

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
  // Only populated for DarpanSystemSource "systems" rows that are an endpoint under a top-level
  // system (e.g. OMS_RETURNS -> OMS) — see list#AutomationSourceOptions. Absent everywhere else.
  parentEnumId?: string
}

export interface SessionInfo {
  userId: string
  username?: string
  displayName?: string
  locale?: string
  timeZone?: string
  userTimeZone?: string
  tenantTimeZone?: string
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

/** Why a correct username/password pair still cannot sign in: `PWDCHG` when the account is flagged to
 *  change its password at next login (every admin-created and admin-reset account is), `PWDTIM` when the
 *  current password has aged past the rotation window. Both are recoverable by changing the password. */
export type PasswordChangeReason = 'PWDCHG' | 'PWDTIM'

export interface LoginSessionResponse extends ApiEnvelope, AuthTokenContract {
  authenticated: boolean
  sessionInfo?: SessionInfo | null
  passwordChangeRequired?: boolean
  passwordChangeReason?: PasswordChangeReason
}

export interface ChangeExpiredPasswordResponse extends ApiEnvelope {
  passwordUpdated?: boolean
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

/** DarpanChatProvider enum ids. A space with no provider is Google Chat. */
export type ChatProviderId = 'CHAT_PROV_GOOGLE' | 'CHAT_PROV_SLACK'

export interface TenantChatSpace {
  chatSpaceId: string
  spaceName: string
  chatProviderEnumId: ChatProviderId
  /** Server-resolved display name for the provider ("Google Chat", "Slack"). */
  chatProviderLabel: string
  /** Set when this space posts through a connected workspace rather than a webhook. */
  slackInstallId?: string | null
  slackChannelId?: string | null
  slackChannelName?: string | null
  deliveryMode?: 'WEBHOOK' | 'SLACK_BOT'
  webhookConfigured: boolean
  webhookUrl?: string | null
  /**
   * Pre-Slack names, kept one release. The backend mirrors the resolved provider-agnostic values
   * into these, so they are NOT Google-specific despite the name — prefer webhookConfigured /
   * webhookUrl in new code.
   */
  googleChatConfigured: boolean
  googleChatWebhookUrl?: string | null
  isActive: string
  inUse: boolean
  createdDate?: string
  lastUpdatedDate?: string
}

export interface SlackWorkspaceInstall {
  slackInstallId: string
  teamId: string
  teamName?: string | null
  /** The bot's own user id, for the "invite @Darpan" instruction on private channels. */
  botUserId?: string | null
  grantedScopes?: string | null
  isActive: string
  installedDate?: string
}

export interface SlackChannel {
  id: string
  name: string
  isPrivate: boolean
  /**
   * Whether the bot is already in the channel. chat:write.public covers PUBLIC channels it never
   * joined, so this only gates private ones — but a private channel it is not in fails at the first
   * run, hours after the admin walked away.
   */
  isMember: boolean
}

export interface GetSlackInstallResponse extends ApiEnvelope {
  /** Slack is usable at all — always true now that a bot token can be pasted. */
  slackConfigured?: boolean
  /** Whether the one-click OAuth install is ALSO offered (needs a client id + redirect URI). */
  oauthAvailable?: boolean
  installs?: SlackWorkspaceInstall[]
}

export interface SaveSlackBotTokenResponse extends ApiEnvelope {
  install?: SlackWorkspaceInstall
  /** Granted-scope gaps: the token still delivers, but these features will not work. */
  missingScopes?: string[]
}

export interface BeginSlackInstallResponse extends ApiEnvelope {
  authorizeUrl?: string
}

export interface ListSlackChannelsResponse extends ApiEnvelope {
  channels?: SlackChannel[]
  nextCursor?: string | null
  botUserId?: string | null
}

export type DisconnectSlackWorkspaceResponse = ApiEnvelope

export interface ListTenantChatSpacesResponse extends ApiEnvelope {
  chatSpaces?: TenantChatSpace[]
}

export interface SaveTenantChatSpaceResponse extends ApiEnvelope {
  chatSpace?: TenantChatSpace
}

export type DeleteTenantChatSpaceResponse = ApiEnvelope

export interface UserNotificationDefault {
  chatSpaceId: string
  spaceName: string
  isActive: string
}

export interface GetUserNotificationDefaultResponse extends ApiEnvelope {
  userNotificationDefault?: UserNotificationDefault
}

export interface SaveUserNotificationDefaultResponse extends ApiEnvelope {
  userNotificationDefault?: UserNotificationDefault
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
  /** DAR-BE-005: true when this row's owning tenant is not the active tenant — i.e. shared in. */
  isShared?: boolean
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
  /** DAR-BE-005: true when this row's owning tenant is not the active tenant — i.e. shared in. */
  isShared?: boolean
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
  /** DAR-BE-005: true when this row's owning tenant is not the active tenant — i.e. shared in. */
  isShared?: boolean
}

export type SaveShopifyAuthConfigResponse = Schemas['SaveShopifyAuthConfigResult']

export type DeleteShopifyAuthConfigResponse = Schemas['DeleteShopifyAuthConfigResult']

export interface GetShopifyAuthConfigResponse extends ApiEnvelope {
  shopifyAuthConfig?: ShopifyAuthConfigRecord | null
}

export type ConnectionCheckStatus = 'PASS' | 'FAIL' | 'SKIP'

export interface ConnectionCheck {
  key: string
  label: string
  status: ConnectionCheckStatus
  detail?: string | null
  /**
   * Per-check timing. Returned and logged for troubleshooting (it is how the orders stage was
   * found to sit at ~4900ms against a 10s read timeout) but deliberately not rendered: an operator
   * asking whether a connection works is not asking how many milliseconds it took.
   */
  durationMillis?: number | null
}

/**
 * Hand-authored rather than aliased to Schemas['TestSourceConnectionResult']: Moqui describes a
 * List-of-Map out-parameter by naming its element (`<parameter name="check" type="Map">`), and the
 * generator turns that into a `{ check?: ... }[]` wrapper that does not exist at runtime.
 *
 * `ok` keeps the envelope meaning (the diagnostic ran); `connectionOk` is the verdict. They are
 * deliberately separate — the client throws on `ok: false`, so a failed connection has to come back
 * as a successful call or the failure rows would never reach the UI.
 */
export interface TestSourceConnectionResponse extends ApiEnvelope {
  available?: boolean
  connectionOk?: boolean
  /** Stage to pass back to continue a staged run; blank/absent ends the walk. */
  nextStage?: string | null
  durationMillis?: number
  checks?: ConnectionCheck[]
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
  /** DAR-BE-005: true when this row's owning tenant is not the active tenant — i.e. shared in. */
  isShared?: boolean
}

export interface SaveOmsRestSourceConfigResponse extends ApiEnvelope {
  savedOmsRestSourceConfig?: OmsRestSourceConfigRecord
}

export type DeleteOmsRestSourceConfigResponse = Schemas['DeleteHotWaxOmsRestSourceConfigResult']

// ─── Config sharing (DAR-BE-005) ────────────────────────────────────────────
//
// `sharing.memberTenantLabels` is a Moqui List<Map> whose inner element is named
// "member" for schema documentation only (see ConfigSharingFacadeServices.xml).
// Like ApiEnvelope.messages/errors and TestSourceConnectionResponse.checks above,
// the wire shape is a flat array of maps — NOT wrapped in a `member` key. The
// openapi-typescript-generated Schemas['ListConfigTenantAccessResult'] models the
// wrapped shape (a known contract-generator gap), so this is hand-written to match
// what the backend actually sends rather than aliased to the generated type.

export interface ConfigSharingMember {
  tenantUserGroupId: string
  label?: string | null
}

export interface ConfigSharing {
  configTypeEnumId: string
  configId: string
  ownerTenantUserGroupId?: string | null
  ownerTenantLabel?: string | null
  memberTenantUserGroupIds: string[]
  memberTenantLabels: ConfigSharingMember[]
  memberCount: number
  canManage: boolean
}

export interface ListConfigTenantAccessResponse extends ApiEnvelope {
  sharing?: ConfigSharing | null
}

export interface GrantConfigTenantAccessResponse extends ApiEnvelope {
  granted?: boolean
}

export interface RevokeConfigTenantAccessResponse extends ApiEnvelope {
  revoked?: boolean
}

// ─── Source endpoint access (per-endpoint enablement) ──────────────────────────

export interface SourceConfigEndpoint {
  systemEnumId: string
  endpointLabel: string
  isEnabled: boolean
}

export interface ListSourceConfigEndpointsResponse extends ApiEnvelope {
  endpoints?: SourceConfigEndpoint[]
}

export interface StoreSourceConfigEndpointAccessResponse extends ApiEnvelope {
  stored?: boolean
}

export interface PaginatedResponse extends ApiEnvelope {
  pagination: PaginationMeta
}

export interface MappingSystemOption {
  enumId: string
  enumCode?: string
  description?: string
  label?: string
  // The system FAMILY an endpoint-level option belongs to: SHOPIFY_RETURN_REFS -> SHOPIFY/"Shopify".
  // Absent on the family enums themselves, whose own `label` is already the system name.
  systemParentEnumId?: string
  systemParentLabel?: string
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
  // Configured exclusion rules per side, as the backend's buildExcludeFilterResponse returns them
  // (fieldExpression is the stored operator-facing path, values already split into an array).
  // buildRuleSetDraft MUST map these: without them the board renders every exclusion as unset and
  // editing one side's exclusion overwrites the rest of that side.
  file1ExcludeFilters?: SourceExcludeFilter[]
  file2ExcludeFilters?: SourceExcludeFilter[]
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
  chatSpaceId?: string
  chatSpaceName?: string
  chatSpaceActive?: boolean
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
  /** Wider field list for the rules board; absent means "fall back to primaryIdOptions". */
  fieldOptions?: AutomationPrimaryIdOption[]
  /** True only when this system's connector declares a filterParameterName (see supportsExclusions). */
  supportsExcludeFilters?: boolean
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
  /** Wider field list for the rules board; absent means "fall back to primaryIdOptions". */
  fieldOptions?: AutomationPrimaryIdOption[]
  /** True only when this system's connector declares a filterParameterName (see supportsExclusions). */
  supportsExcludeFilters?: boolean
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

export interface ListSavedRunsResponse extends PaginatedResponse {
  pinnedSavedRunIds?: string[]
  savedRuns: SavedRunSummary[]
}

export interface ListAutomationsResponse extends PaginatedResponse {
  automations: AutomationRecord[]
}

/**
 * Whether an automation's snapshot still matches its saved run. Computed by the backend from the
 * same derive that sync#Automation applies, so the edit form's out-of-date marker can never
 * disagree with what Sync would change. A missing saved run is reported here, not as drift.
 */
export interface AutomationSyncStatus {
  inSync: boolean
  changedFields: string[]
  inputModeChanging: boolean
  savedRunMissing: boolean
}

export interface GetAutomationResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
  syncStatus?: AutomationSyncStatus | null
}

export interface SyncAutomationResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
  changedFields?: string[]
}

export type SaveAutomationResponse = Schemas['SaveAutomationResult']

export type DeleteAutomationResponse = Schemas['DeleteAutomationResult']

export interface RunAutomationNowResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
  runResult?: Record<string, unknown> | null
}

// pause#Automation and resume#Automation each return the fully rebuilt automation row, not just
// an ok flag -- the caller can adopt it directly instead of refetching.
export interface PauseAutomationResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
}

export interface ResumeAutomationResponse extends ApiEnvelope {
  automation?: AutomationRecord | null
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

export interface CreateRuleSetRunResponse extends ApiEnvelope {
  savedRun?: SavedRunSummary
}

export type SaveRuleSetRunResponse = Schemas['SaveRuleSetRunResult']

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

export interface SubscribeRunNotificationResponse extends ApiEnvelope {
  subscribed?: boolean
  needsDefaultChatSpace?: boolean
  chatSpaceName?: string
}

export interface UnsubscribeRunNotificationResponse extends ApiEnvelope {
  subscribed?: boolean
}

export interface CancelReconciliationRunResponse extends ApiEnvelope {
  cancelRequested?: boolean
  statusEnumId?: string
}

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

export interface JsonSchemaSummary {
  jsonSchemaId: string
  schemaName: string
  description?: string
  systemEnumId?: string
  systemLabel?: string
  companyUserGroupId?: string
  companyLabel?: string
  statusId?: string
  // True when every field flattens to a top-level scalar. CSV sides can only use flat schemas:
  // a nested one hands the rules board dotted paths no CSV column matches. Optional because a
  // backend predating this field returns undefined, which must read as "not proven flat".
  isFlatFieldList?: boolean
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
