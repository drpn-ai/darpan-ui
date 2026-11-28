import type { Schemas } from './generated'
import type { SourceExcludeFilter } from '../sourceExcludeFilters'
import type { SourceExtractOption } from './authoringTypes'

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
  // system (e.g. OMS_RETURNS_GQL -> OMS) — see list#AutomationSourceOptions. Absent everywhere else.
  parentEnumId?: string
  // DAR-BE-052: false on a system kept only to group its endpoints (OMS); absent means extractable.
  extractable?: boolean
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
  /** DAR-BE-028: no email on file, so password reset cannot reach this account yet. */
  recoveryEmailMissing?: boolean
  emailAddressMasked?: string | null
  /** DAR-BE-264: two-factor is on for this account (DAR-BE-270: the app, a passkey, or both). */
  twoFactorEnabled?: boolean
  /** DAR-BE-264: set only while two-factor is off and a role of theirs has a date; the grace prompt reads it. */
  twoFactorDueDate?: ApiTimestamp | null
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
  /** DAR-BE-264: right password, two-factor on. No session yet; send challengeToken with a code to verify#SignInCode. */
  twoFactorRequired?: boolean
  /** DAR-BE-264: right password, two-factor required but not set up. challengeToken allows only begin/confirm setup. */
  twoFactorSetupRequired?: boolean
  /** Page memory only: never storage or a cookie. */
  challengeToken?: string
  challengeExpiresInSeconds?: number
  /** DAR-BE-270: with twoFactorRequired, what this person can answer with here: "app" and/or "passkey". */
  twoFactorMethods?: string[]
  /** DAR-BE-270: with a challenge, whether this instance offers passkeys (a forced setup offers one beside the app). */
  passkeysAvailable?: boolean
}

// DAR-BE-264. Hand-typed rather than Schemas['VerifySignInCodeResult'] / ['ConfirmTwoFactorSetupResult']: the
// generator types their sessionInfo loosely (userId optional, scopeType a plain string, availableTenants rows with
// optional ids), and the auth store needs the SessionInfo every other sign-in reply carries.
export interface VerifySignInCodeResponse extends ApiEnvelope, AuthTokenContract {
  authenticated?: boolean
  sessionInfo?: SessionInfo | null
  /** With a recovery code: how many are left. */
  recoveryCodesLeft?: number
  /** On a refusal (ok false): true when the challenge can no longer be used; back to the password. */
  challengeEnded?: boolean
}

/** DAR-BE-301: finish#PasskeyFirstSignIn answers a success as verify#SignInCode does; a refusal carries `reason`. */
export interface FinishPasskeyFirstSignInResponse extends ApiEnvelope, AuthTokenContract {
  authenticated?: boolean
  sessionInfo?: SessionInfo | null
  reason?: string
}

export interface ConfirmTwoFactorSetupResponse extends ApiEnvelope, AuthTokenContract {
  authenticated?: boolean
  sessionInfo?: SessionInfo | null
  /** 10 codes, xxxx-xxxx-xxxx-xxxx, in this reply only. */
  recoveryCodes?: string[]
  challengeEnded?: boolean
}

// The generated result types are right for these: flat fields, no sessionInfo.
export type BeginTwoFactorSetupResponse = Schemas['BeginTwoFactorSetupResult']
export type CreateRecoveryCodesResponse = Schemas['CreateRecoveryCodesResult']
export type DisableTwoFactorResponse = Schemas['DisableTwoFactorResult']
export type BeginPasskeySignInResponse = Schemas['BeginPasskeySignInResult']
export type BeginPasskeyFirstSignInResponse = Schemas['BeginPasskeyFirstSignInResult']
export type BeginPasskeyProofResponse = Schemas['BeginPasskeyProofResult']
export type BeginPasskeyRegistrationResponse = Schemas['BeginPasskeyRegistrationResult']
export type RenamePasskeyResponse = Schemas['RenamePasskeyResult']
export type DeletePasskeyResponse = Schemas['DeletePasskeyResult']

/** DAR-BE-270: one of the person's passkeys, as get#TwoFactorStatus lists them (oldest first). */
export interface TwoFactorPasskey {
  passkeyId: string
  name?: string
  createdDate?: ApiTimestamp | null
  lastUsedDate?: ApiTimestamp | null
  transports?: string[]
  /** A synced passkey (on more than one device). */
  backedUp?: boolean
}

// Hand-typed passkeys: the generator nests each row under its Moqui list-entry name ({ passkey: {...} }); the reply
// carries the rows themselves.
export type GetTwoFactorStatusResponse = Omit<Schemas['GetTwoFactorStatusResult'], 'passkeys'> & { passkeys?: TwoFactorPasskey[] }

/** finish#PasskeyRegistration. The sign-in fields and recoveryCodes come only with a first factor or a setup challenge. */
export interface FinishPasskeyRegistrationResponse extends ApiEnvelope, AuthTokenContract {
  passkeyId?: string
  authenticated?: boolean
  sessionInfo?: SessionInfo | null
  recoveryCodes?: string[]
  challengeEnded?: boolean
}

export interface ChangeExpiredPasswordResponse extends ApiEnvelope {
  passwordUpdated?: boolean
}

/** DAR-UI-084: what the reset request did. */
export type PasswordResetRequestOutcome = 'sent' | 'noAccount' | 'locked' | 'noEmail' | 'overLimit' | 'sendFailed'

export interface RequestPasswordResetResponse extends ApiEnvelope {
  outcome?: PasswordResetRequestOutcome
  /** Set only when outcome is sent. */
  emailAddressMasked?: string | null
}

export interface VerifyPasswordResetCodeResponse extends ApiEnvelope {
  verified?: boolean
}

export interface CompletePasswordResetResponse extends ApiEnvelope {
  passwordUpdated?: boolean
}

export interface SaveRecoveryEmailResponse extends ApiEnvelope {
  emailAddressMasked?: string | null
}

export type GetPasswordResetStatusResponse = Schemas['GetPasswordResetStatusResult']

// Migration template (MACH P1): sourced from the generated OpenAPI contract types
// instead of a hand-written interface. Same exported name, so consumers are
// unchanged; note every generated field is optional (the contract declares no
// `required` fields on Result schemas). Retire other interfaces here the same way.
export type LogoutSessionResponse = Schemas['LogoutSessionResult']

export interface ListEnumOptionsResponse extends ApiEnvelope {
  options: EnumOption[]
}

export interface TenantSettings {
  companyUserGroupId?: string | null
  companyLabel?: string | null
  timeZone: string
  /** Chat space for tenant-wide streak messages; null when unset or the space was deactivated. */
  streaksChatSpaceId?: string | null
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

/** DAR-UI-123. The things that post to chat on the notifications grid. */
export type NotificationSourceType = 'STREAKS' | 'AUDIT_UPDATE' | 'AUTOMATION' | 'SCRIPT'

/** A chat space as get#NotificationRoutes lists it: a TenantChatSpace without its webhook URL. */
export type NotificationRouteSpace = Pick<
  TenantChatSpace,
  | 'chatSpaceId'
  | 'spaceName'
  | 'chatProviderEnumId'
  | 'chatProviderLabel'
  | 'slackChannelName'
  | 'deliveryMode'
  | 'webhookConfigured'
  | 'isActive'
>

/** One row of the notifications grid: one thing that posts to chat and the one space it posts to. */
export interface NotificationRoute {
  sourceType: NotificationSourceType
  /** null for STREAKS; the audit's code (AUDIT_UPDATE); the automationId; the tenantScriptDeploymentId (SCRIPT). */
  sourceId: string | null
  /** "Streaks", "<audit name> update", the automation's name, or the script's name. */
  label: string
  /** "Daily HH:mm" (daily automation or script), "After each run" (audit update), else null. */
  when: string | null
  /** Off its schedule, or the audit's run update is off. Always false for STREAKS. */
  paused: boolean
  /** The space it posts to as stored (it may since be switched off); null posts nowhere. */
  chatSpaceId: string | null
}

export interface GetNotificationRoutesResponse extends ApiEnvelope {
  /** The tenant's spaces by name, switched-off ones too. */
  spaces?: NotificationRouteSpace[]
  /** Streaks, then each audit update, each automation (paused too, not archived), each deployed script. */
  routes?: NotificationRoute[]
}

export interface SetNotificationRouteResponse extends ApiEnvelope {
  /** The route as saved; absent when refused. */
  route?: NotificationRoute
}

export type SendChatSpaceTestResponse = ApiEnvelope

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
  /** DAR-BE-082: the server's key, saved on the first successful connection (OpenSSH SHA256 fingerprint). */
  hostKeyFingerprint?: string | null
  hostKeyPinnedDate?: string | number | null
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

export type DeleteNsAuthConfigResponse = Schemas['DeleteNsAuthConfigResult']

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
  /** 'HEADERS_NOT_CARRIED' when an edit moved the base URL or auth type and stored custom headers would not follow. */
  reason?: string
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
  sourceConfigId?: string
  sourceConfigType?: string
}

export interface SavedRunSystemOption extends MappingSystemOption {
  fileSide?: string
  /** DAR-UI-148. The side's stored extract options as JSON ({"withLineItems":true}); null or absent when none are on. */
  extractParametersJson?: string | null
}

export interface SavedRunRule {
  ruleId?: string
  sequenceNum?: number
  /** DAR-BE-210. Absent on older backends. */
  ruleName?: string | null
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
  // COMPARE (two sources diffed) or EVALUATE (one source whose rows ARE the findings, DAR-BE-049).
  // Absent reads as COMPARE, matching the backend default. It is on the wire rather than inferred
  // from systemOptions.length because one option is ALSO what a two-sided run looks like when its
  // FILE_2 has gone missing — inferring would render a broken run as a working single-sided one.
  scopeMode?: string
  /** DAR-BE-060. Absent reads as enabled — every run predating the flag has no value. */
  isActive?: boolean
  /** DAR-BE-061. In the bin: off Home and the runs list, and it will not run. Reversible. */
  isArchived?: boolean
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
  /** DAR-BE-328. Where the next run really starts (a peak-period move or hold); the period behind it; and when peak hours end, only while now is inside them. */
  effectiveNextStart?: ApiTimestamp
  peakPeriodName?: string
  peakHoursUntil?: ApiTimestamp
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
  // DAR-BE-199: the audit whose checks run through this automation. It runs on that audit's schedule and is never
  // paused or resumed by itself (permissions.canPause/canResume are false).
  audit?: { code: string; name: string }
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
  /** DAR-UI-064. The extract options this (config x endpoint) row's connector declares; absent when it takes none. */
  extractOptions?: SourceExtractOption[]
  /** DAR-UI-064. A SuiteQL query row's own projection: its key candidates and the rules board's fields. */
  primaryIdOptions?: AutomationPrimaryIdOption[]
  fieldOptions?: AutomationPrimaryIdOption[]
  supportsExcludeFilters?: boolean
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
    /**
     * The zone the window was anchored in, as an IANA id. Two instants cannot say which
     * calendar day they cover, so without this the UI resolves that day in the VIEWER's zone
     * and two people read different days for one run. Absent on runs that predate the column
     * on ReconciliationRunResult, which the screen reports rather than guessing at.
     */
    timeZone?: string
  }
  files?: GeneratedOutputSourceFile[]
}

export interface ListSftpServersResponse extends PaginatedResponse {
  servers: SftpServerRecord[]
}

export interface ListNsAuthConfigsResponse extends PaginatedResponse {
  authConfigs: NsAuthConfigRecord[]
}

export interface ListShopifyAuthConfigsResponse extends PaginatedResponse {
  shopifyAuthConfigs: ShopifyAuthConfigRecord[]
}

export interface ListOmsRestSourceConfigsResponse extends PaginatedResponse {
  omsRestSourceConfigs: OmsRestSourceConfigRecord[]
}

/** DAR-BE-061. archive#Automation; the flag is echoed back. */
export interface ArchiveResponse extends ApiEnvelope {
  automationId?: string
  isArchived?: boolean
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
  systemRemotes: AutomationSystemRemoteOption[]
}

export interface SaveDashboardPinnedSavedRunsResponse extends ApiEnvelope {
  pinnedSavedRunIds?: string[]
}

export type SaveSavedRunNameResponse = Schemas['SaveSavedRunNameResult']

export type DeleteSavedRunResponse = Schemas['DeleteSavedRunResult']

/** validationErrors and processingWarnings ride inside runResult; the top level is the envelope alone. */
export interface RunSavedRunDiffResponse extends ApiEnvelope {
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

export type GetReconciliationRunStatusPayload = Schemas['GetReconciliationRunStatusParams']

export type GetReconciliationRunStatusResponse = Schemas['GetReconciliationRunStatusResult']

export type ReconciliationRunStep = NonNullable<GetReconciliationRunStatusResponse['steps']>[number]

export type GetActiveRunResultPayload = Schemas['GetActiveRunResultParams']

export type GetActiveRunResultResponse = Schemas['GetActiveRunResultResult']

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
  /**
   * ZONE-LESS wall clock written in the reconciliation host's zone, e.g. "2026-08-26 05:10:38.673".
   * `new Date(string)` resolves that against the BROWSER's zone, so it names a different instant for
   * every viewer. Prefer `createdDate`; this remains only for results written before it existed.
   */
  timestamp?: string
  /**
   * ReconciliationRunResult.createdDate — a real instant (epoch ms), so it needs no zone guess.
   * Present for any run backed by a run-result row, including ones already on disk.
   */
  createdDate?: number | string
  savedRunId?: string
  savedRunName?: string
  savedRunType?: string
  reconciliationMappingId?: string
  reconciliationMappingName?: string
  ruleSetId?: string
  compareScopeId?: string
  /** DAR-BE-384: the run this result belongs to, when a run row names it. */
  reconciliationRunResultId?: string
}

// DAR-UI-044. What the run concluded about each finding, written once at run time by STAGE_CONCLUDE.
export interface RunConclusionSystem {
  side: 'FILE_1' | 'FILE_2'
  system: string
  /** EXCLUDED: the record exists but the run's own filter dropped it. UNKNOWN: absence could not be checked. */
  presence: 'KEPT' | 'EXCLUDED' | 'ABSENT' | 'UNKNOWN'
  state: string | null
  facts: string[]
}

export interface RunConclusionCheck {
  label: string
  value: string | null
  passed: boolean
}

export interface RunConclusionSuggestedFilter {
  fileSide: 'FILE_1' | 'FILE_2'
  fieldExpression: string
  operator: 'EXCLUDE_IN' | 'INCLUDE_IN'
  values: string[]
}

export interface RunConclusionQuestion {
  text: string
  count?: number
  suggestedFilter?: RunConclusionSuggestedFilter | null
}

export interface RunConclusion {
  code: string
  label: string
  systems: RunConclusionSystem[]
  checks: RunConclusionCheck[]
  question: RunConclusionQuestion | null
}

export interface RunConclusionCount {
  code: string
  label: string
  count: number
}

export interface GeneratedOutputDifferencesSummary {
  totalDifferences?: number
  onlyInFile1Count?: number
  onlyInFile2Count?: number
  ruleDifferenceCount?: number | null
  missingObjectDifferenceCount?: number | null
  /** Present only when the run's scope had conclusion rules; its absence means the legacy page. */
  conclusions?: { enabled: boolean; counts: RunConclusionCount[] }
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
  /** Whole-document count per conclusion code, ignoring the conclusion filter itself. */
  conclusionCounts?: Record<string, number>
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

// ─── CLI sign-in (DAR-CLI-003) ─────────────────────────────────────────────────

export interface GetCliLoginRequestResponse extends ApiEnvelope {
  hostLabel?: string
  status?: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'
  expiresDate?: ApiTimestamp
  createdDate?: ApiTimestamp
  /** DAR-BE-295: TENANT (default) or ADMIN (the darpan-admin CLI); a string so an unknown value is shown, not trusted. */
  scope?: string
}

export type ApproveCliLoginResponse = ApiEnvelope
export type DenyCliLoginResponse = ApiEnvelope

export interface CliSession {
  cliSessionId: string
  hostLabel: string
  createdDate: ApiTimestamp
  expiresDate: ApiTimestamp
}

export interface ListCliSessionsResponse extends ApiEnvelope {
  cliSessions?: CliSession[]
}

export type RevokeCliSessionResponse = ApiEnvelope

// ─── CLI access requests (DAR-BE-209) ──────────────────────────────────────────

export type CliAccessState = 'LIVE' | 'PAUSED' | 'ENDED' | 'NOT_GRANTED' | 'DARPAN_ADMIN'

export interface CliAccessRequest {
  requestId: string
  statusId: 'PENDING' | 'APPROVED' | 'DECLINED'
  reason?: string | null
  requestedDate?: ApiTimestamp
  decidedDate?: ApiTimestamp | null
  decisionNote?: string | null
}

/** The signed-in person's CLI access in the active tenant (facade.CliAccessFacadeServices.get#MyCliAccess). */
export interface MyCliAccess {
  tenantUserGroupId: string
  tenantLabel: string
  state: CliAccessState
  thruDate?: ApiTimestamp | null
  lifetimeDays: number
  /** The CLI is on for this person in some tenant (approve#CliLogin's own rule), whatever tenant is active. */
  canUseCli?: boolean
  request?: CliAccessRequest | null
}

export interface GetMyCliAccessResponse extends ApiEnvelope {
  access?: MyCliAccess | null
}

export interface RequestCliAccessResponse extends ApiEnvelope {
  request?: CliAccessRequest | null
}
