import { describe, expect, expectTypeOf, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Schemas } from '../generated'
import type {
  ApiEnvelope,
  BeginSlackInstallResponse,
  CancelReconciliationRunResponse,
  ChangeExpiredPasswordResponse,
  ChangeOwnPasswordResponse,
  CompletePasswordResetResponse,
  ConfirmTwoFactorSetupResponse,
  CreateRuleSetRunResponse,
  EnumOption,
  FinishPasskeyFirstSignInResponse,
  FinishPasskeyRegistrationResponse,
  FlattenJsonSchemaResponse,
  GetAutomationResponse,
  GetCliLoginRequestResponse,
  GetGeneratedOutputDifferencesResponse,
  GetJsonSchemaResponse,
  GetMyCliAccessResponse,
  GetNotificationRoutesResponse,
  GetShopifyAuthConfigResponse,
  GetSlackInstallResponse,
  GetTenantSettingsResponse,
  GetUserNotificationDefaultResponse,
  GrantConfigTenantAccessResponse,
  ListAutomationExecutionsResponse,
  ListAutomationSourceOptionsResponse,
  ListAutomationsResponse,
  ListCliSessionsResponse,
  ListConfigTenantAccessResponse,
  ListEnumOptionsResponse,
  ListGeneratedOutputsResponse,
  ListJsonSchemasResponse,
  ListNsAuthConfigsResponse,
  ListSavedRunsResponse,
  ListSftpServersResponse,
  ListShopifyAuthConfigsResponse,
  ListSlackChannelsResponse,
  ListSourceConfigEndpointsResponse,
  ListTenantChatSpacesResponse,
  LoginSessionResponse,
  LogoutSessionResponse,
  PauseAutomationResponse,
  RequestCliAccessResponse,
  RequestPasswordResetResponse,
  ResumeAutomationResponse,
  RevokeConfigTenantAccessResponse,
  RunAutomationNowResponse,
  RunSavedRunDiffResponse,
  SaveActiveTenantResponse,
  SaveDashboardPinnedSavedRunsResponse,
  SaveRecoveryEmailResponse,
  SaveSlackBotTokenResponse,
  SaveTenantChatSpaceResponse,
  SaveTenantSettingsResponse,
  SaveUserNotificationDefaultResponse,
  SaveUserSettingsResponse,
  SessionInfo,
  SessionInfoResponse,
  SessionTenantOption,
  SetNotificationRouteResponse,
  StoreSourceConfigEndpointAccessResponse,
  SubscribeRunNotificationResponse,
  SyncAutomationResponse,
  TestSourceConnectionResponse,
  UnsubscribeRunNotificationResponse,
  VerifyOwnPasswordResponse,
  VerifyPasswordResetCodeResponse,
  VerifySignInCodeResponse,
} from '../types'
import type {
  CreateRuleSetRunPayload,
  DeleteJsonSchemaPayload,
  FlattenJsonSchemaPayload,
  GetGeneratedOutputPayload,
  ListAutomationExecutionsPayload,
  ListAutomationsPayload,
  ListConfigTenantAccessPayload,
  ListGeneratedOutputsPayload,
  ListNsAuthConfigsPayload,
  ListSavedRunsPayload,
  ListSftpServersPayload,
  ListShopifyAuthConfigsPayload,
  ListSourceConfigEndpointsPayload,
  RunAutomationNowPayload,
  RunSavedRunDiffPayload,
  SaveAutomationPayload,
  SaveDashboardPinnedSavedRunsPayload,
  SaveJsonSchemaTextPayload,
  SaveMappingPayload,
  SaveNsAuthConfigPayload,
  SaveRefinedSchemaPayload,
  SaveRuleSetRunPayload,
  SaveSftpServerPayload,
  SaveShopifyAuthConfigPayload,
  SaveTenantChatSpacePayload,
  SetNotificationRoutePayload,
  StoreSourceConfigEndpointAccessPayload,
} from '../facadeTypes'
import type {
  CreateRunConclusionCodeResponse,
  GetAuditCheckOptionsResponse,
  GetNsSuiteQlQueryOptionsResponse,
  GetRunConclusionsResponse,
  RemoveAuditCheckResponse,
  SaveAuditCheckResponse,
  SaveRunConclusionsResponse,
} from '../authoringTypes'
import type {
  GetTenantQueryCatalogResponse,
  ListTenantQueriesResponse,
  ListTenantQuerySchedulesResponse,
  RunTenantQueryResponse,
  RunTenantQueryScheduleResponse,
  SaveTenantQueryPinsResponse,
  SaveTenantQueryResponse,
  SaveTenantQuerySchedulePayload,
  SaveTenantQueryScheduleResponse,
  SendAgentQueryTurnResponse,
} from '../scriptTypes'
import type {
  GetLifecycleOptionsResponse,
  SaveLifecyclePayload,
  SaveLifecycleResponse,
} from '../flowchartTypes'
import type {
  ApplyAuditChangeResponse,
  GetAgentConversationResponse,
  GetAgentStatusResponse,
  PlanAuditChangeResponse,
  RejectAuditChangeResponse,
  RevertAuditChangeResponse,
  SendAgentTurnResponse,
} from '../agentTypes'
import type {
  GetPeakPeriodResponse,
  ListPeakPeriodsResponse,
  SavePeakPeriodPayload,
  SavePeakPeriodResponse,
} from '../peakTypes'
import type {
  GetRunPulseFlagsResponse,
  GetSyncPairResponse,
  ListSyncPairsResponse,
  SaveSyncPairPayload,
  SaveSyncPairResponse,
} from '../pulseTypes'
import type {
  GetTenantConfigVersionsResponse,
  PreviewTenantConfigRestoreResponse,
  RestoreTenantConfigVersionResponse,
  SnapshotTenantConfigResponse,
} from '../configTypes'

// Type-level compatibility guard (MACH P1, API management) between the hand-written
// response interfaces in ../types.ts and the types generated from the backend
// OpenAPI 3.1 contract (src/lib/api/contract/openapi.json → npm run
// generate-api-types → src/lib/api/generated/schema.d.ts).
//
// Direction of the checks: the hand-written types are STRICTER (required envelope
// fields, literal unions), the generated contract types are LOOSER (the contract
// emits no `required` arrays, so every generated field is optional). Asserting
// hand-written ⊆ generated proves the UI model stays inside the contract's shape.
// The expectTypeOf assertions are enforced at compile time by vue-tsc
// (npm run type-check); at vitest runtime they are no-ops.

type GeneratedLogin = Schemas['LoginSessionResult']
type GeneratedLogout = Schemas['LogoutSessionResult']
type GeneratedListEnumOptions = Schemas['ListEnumOptionsResult']
type GeneratedGetSessionInfo = Schemas['GetSessionInfoResult']
type GeneratedSessionInfo = NonNullable<GeneratedGetSessionInfo['sessionInfo']>

describe('generated contract types vs hand-written API types', () => {
  it('LoginSessionResult: envelope and auth-token contract fields line up', () => {
    expectTypeOf<LoginSessionResponse['ok']>().toMatchTypeOf<GeneratedLogin['ok']>()
    expectTypeOf<LoginSessionResponse['messages']>().toMatchTypeOf<GeneratedLogin['messages']>()
    expectTypeOf<LoginSessionResponse['errors']>().toMatchTypeOf<GeneratedLogin['errors']>()
    expectTypeOf<LoginSessionResponse['authenticated']>().toMatchTypeOf<
      GeneratedLogin['authenticated']
    >()
    expectTypeOf<LoginSessionResponse['authToken']>().toEqualTypeOf<GeneratedLogin['authToken']>()
    expectTypeOf<LoginSessionResponse['authTokenType']>().toEqualTypeOf<
      GeneratedLogin['authTokenType']
    >()
    expectTypeOf<LoginSessionResponse['authTokenHeaderName']>().toEqualTypeOf<
      GeneratedLogin['authTokenHeaderName']
    >()
    expectTypeOf<LoginSessionResponse['authTokenExpiresInSeconds']>().toEqualTypeOf<
      GeneratedLogin['authTokenExpiresInSeconds']
    >()
  })

  it('GetSessionInfoResult: envelope fields line up with SessionInfoResponse', () => {
    expectTypeOf<SessionInfoResponse['ok']>().toMatchTypeOf<GeneratedGetSessionInfo['ok']>()
    expectTypeOf<SessionInfoResponse['authenticated']>().toMatchTypeOf<
      GeneratedGetSessionInfo['authenticated']
    >()
  })

  it('sessionInfo payload: hand-written SessionInfo fields stay inside the generated shape', () => {
    expectTypeOf<SessionInfo['userId']>().toMatchTypeOf<GeneratedSessionInfo['userId']>()
    expectTypeOf<SessionInfo['username']>().toMatchTypeOf<GeneratedSessionInfo['username']>()
    // Array-ness + element shape of availableTenants.
    expectTypeOf<SessionInfo['availableTenants']>().toMatchTypeOf<
      GeneratedSessionInfo['availableTenants']
    >()
    expectTypeOf<SessionTenantOption>().toMatchTypeOf<
      NonNullable<GeneratedSessionInfo['availableTenants']>[number]
    >()
    // Hand-written string[] fits the contract's under-specified unknown[] items.
    expectTypeOf<SessionInfo['activeTenantPermissionGroupIds']>().toMatchTypeOf<
      GeneratedSessionInfo['activeTenantPermissionGroupIds']
    >()
    // Hand-written literal union ('GLOBAL' | 'TENANT' | 'ANONYMOUS') fits plain string.
    expectTypeOf<SessionInfo['scopeType']>().toMatchTypeOf<GeneratedSessionInfo['scopeType']>()
    // Contract timestamps are string | number; hand-written models string only.
    expectTypeOf<SessionInfo['lastLoginDate']>().toMatchTypeOf<
      GeneratedSessionInfo['lastLoginDate']
    >()
    expectTypeOf<SessionInfo['canManageDarpanCore']>().toMatchTypeOf<
      GeneratedSessionInfo['canManageDarpanCore']
    >()
  })

  it('encodes the known contract gap: the generator does not model explicit nulls', () => {
    // The backend serializer can emit explicit `null` values (the hand-written types
    // model `| null` on sessionInfo / customerScopeId / activeTenant*), but the
    // generated contract schemas only model absence (optional, no "null" type).
    // If these assertions start FAILING, the backend contract has started modeling
    // null — fold these fields into the positive checks above and retire the
    // hand-written `| null` unions where the contract now covers them.
    expectTypeOf<SessionInfoResponse['sessionInfo']>().not.toMatchTypeOf<
      GeneratedGetSessionInfo['sessionInfo']
    >()
    expectTypeOf<SessionInfo['customerScopeId']>().not.toMatchTypeOf<
      GeneratedSessionInfo['customerScopeId']
    >()
  })

  it('ListEnumOptionsResult: options array shape lines up', () => {
    expectTypeOf<ListEnumOptionsResponse['options']>().toMatchTypeOf<
      GeneratedListEnumOptions['options']
    >()
    expectTypeOf<EnumOption>().toMatchTypeOf<
      NonNullable<GeneratedListEnumOptions['options']>[number]
    >()
  })

  it('LogoutSessionResponse is the generated LogoutSessionResult and carries the consumed fields', () => {
    // types.ts re-exports the generated type under the legacy name (migration template).
    expectTypeOf<LogoutSessionResponse>().toEqualTypeOf<GeneratedLogout>()
    expectTypeOf<GeneratedLogout['ok']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<GeneratedLogout['authenticated']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<GeneratedLogout['authTokenRevoked']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<GeneratedLogout['errors']>().toEqualTypeOf<string[] | undefined>()
  })

  it('committed openapi.json is non-trivial and defines every schema this spec checks', () => {
    const contract = JSON.parse(
      readFileSync(resolve(__dirname, '../contract/openapi.json'), 'utf-8'),
    ) as { components?: { schemas?: Record<string, unknown> } }
    const schemas = contract.components?.schemas ?? {}
    expect(Object.keys(schemas).length).toBeGreaterThanOrEqual(250)
    for (const name of [
      'LoginSessionResult',
      'LogoutSessionResult',
      'ListEnumOptionsResult',
      'GetSessionInfoResult',
      'JsonRpcError',
      'JsonRpcErrorResponse',
    ]) {
      expect(schemas, `schema ${name} missing from committed openapi.json`).toHaveProperty(name)
    }
  })
})

// DAR-OPS-029 U13b. Moqui drops a request key its service does not declare without a word, and a reply field the
// service does not declare always reads undefined (a script service sends only its declared out-parameters). So a
// hand-written type may be STRICTER than its generated twin (required fields, literal unions) but never WIDER: every
// key it names, beyond the envelope, must exist in the contract. This caught SaveRuleSetRunPayload.scopeMode,
// ListJsonSchemasPayload.systemEnumId, ListAutomationExecutionsPayload.query and RunSavedRunDiffResponse's top-level
// validationErrors/processingWarnings. A key the contract lacks but the backend does send is a contract gap: fix the
// service's parameter declaration, not this list. Types that alias the generated contract need no row.
type Undeclared<Hand, Generated> = Exclude<keyof Hand, keyof Generated | keyof ApiEnvelope>

type HandWrittenTypes = {
  SaveActiveTenantResponse: Undeclared<SaveActiveTenantResponse, Schemas['SaveActiveTenantResult']>
  SaveUserSettingsResponse: Undeclared<SaveUserSettingsResponse, Schemas['SaveUserSettingsResult']>
  VerifyOwnPasswordResponse: Undeclared<VerifyOwnPasswordResponse, Schemas['VerifyOwnPasswordResult']>
  ChangeOwnPasswordResponse: Undeclared<ChangeOwnPasswordResponse, Schemas['ChangeOwnPasswordResult']>
  LoginSessionResponse: Undeclared<LoginSessionResponse, Schemas['LoginSessionResult']>
  VerifySignInCodeResponse: Undeclared<VerifySignInCodeResponse, Schemas['VerifySignInCodeResult']>
  FinishPasskeyFirstSignInResponse: Undeclared<FinishPasskeyFirstSignInResponse, Schemas['FinishPasskeyFirstSignInResult']>
  ConfirmTwoFactorSetupResponse: Undeclared<ConfirmTwoFactorSetupResponse, Schemas['ConfirmTwoFactorSetupResult']>
  FinishPasskeyRegistrationResponse: Undeclared<FinishPasskeyRegistrationResponse, Schemas['FinishPasskeyRegistrationResult']>
  ChangeExpiredPasswordResponse: Undeclared<ChangeExpiredPasswordResponse, Schemas['ChangeExpiredPasswordResult']>
  RequestPasswordResetResponse: Undeclared<RequestPasswordResetResponse, Schemas['RequestPasswordResetResult']>
  VerifyPasswordResetCodeResponse: Undeclared<VerifyPasswordResetCodeResponse, Schemas['VerifyPasswordResetCodeResult']>
  CompletePasswordResetResponse: Undeclared<CompletePasswordResetResponse, Schemas['CompletePasswordResetResult']>
  SaveRecoveryEmailResponse: Undeclared<SaveRecoveryEmailResponse, Schemas['SaveRecoveryEmailResult']>
  ListEnumOptionsResponse: Undeclared<ListEnumOptionsResponse, Schemas['ListEnumOptionsResult']>
  GetTenantSettingsResponse: Undeclared<GetTenantSettingsResponse, Schemas['GetTenantSettingsResult']>
  SaveTenantSettingsResponse: Undeclared<SaveTenantSettingsResponse, Schemas['SaveTenantSettingsResult']>
  GetSlackInstallResponse: Undeclared<GetSlackInstallResponse, Schemas['GetSlackInstallResult']>
  SaveSlackBotTokenResponse: Undeclared<SaveSlackBotTokenResponse, Schemas['SaveSlackBotTokenResult']>
  BeginSlackInstallResponse: Undeclared<BeginSlackInstallResponse, Schemas['BeginSlackInstallResult']>
  ListSlackChannelsResponse: Undeclared<ListSlackChannelsResponse, Schemas['ListSlackChannelsResult']>
  ListTenantChatSpacesResponse: Undeclared<ListTenantChatSpacesResponse, Schemas['ListTenantChatSpacesResult']>
  SaveTenantChatSpaceResponse: Undeclared<SaveTenantChatSpaceResponse, Schemas['SaveTenantChatSpaceResult']>
  GetUserNotificationDefaultResponse: Undeclared<GetUserNotificationDefaultResponse, Schemas['GetUserNotificationDefaultResult']>
  SaveUserNotificationDefaultResponse: Undeclared<SaveUserNotificationDefaultResponse, Schemas['SaveUserNotificationDefaultResult']>
  GetNotificationRoutesResponse: Undeclared<GetNotificationRoutesResponse, Schemas['GetNotificationRoutesResult']>
  SetNotificationRouteResponse: Undeclared<SetNotificationRouteResponse, Schemas['SetNotificationRouteResult']>
  GetShopifyAuthConfigResponse: Undeclared<GetShopifyAuthConfigResponse, Schemas['GetShopifyAuthConfigResult']>
  TestSourceConnectionResponse: Undeclared<TestSourceConnectionResponse, Schemas['TestSourceConnectionResult']>
  ListConfigTenantAccessResponse: Undeclared<ListConfigTenantAccessResponse, Schemas['ListConfigTenantAccessResult']>
  GrantConfigTenantAccessResponse: Undeclared<GrantConfigTenantAccessResponse, Schemas['GrantConfigTenantAccessResult']>
  RevokeConfigTenantAccessResponse: Undeclared<RevokeConfigTenantAccessResponse, Schemas['RevokeConfigTenantAccessResult']>
  ListSourceConfigEndpointsResponse: Undeclared<ListSourceConfigEndpointsResponse, Schemas['ListSourceConfigEndpointsResult']>
  StoreSourceConfigEndpointAccessResponse: Undeclared<StoreSourceConfigEndpointAccessResponse, Schemas['StoreSourceConfigEndpointAccessResult']>
  ListSftpServersResponse: Undeclared<ListSftpServersResponse, Schemas['ListSftpServersResult']>
  ListNsAuthConfigsResponse: Undeclared<ListNsAuthConfigsResponse, Schemas['ListNsAuthConfigsResult']>
  ListShopifyAuthConfigsResponse: Undeclared<ListShopifyAuthConfigsResponse, Schemas['ListShopifyAuthConfigsResult']>
  ListSavedRunsResponse: Undeclared<ListSavedRunsResponse, Schemas['ListSavedRunsResult']>
  ListAutomationsResponse: Undeclared<ListAutomationsResponse, Schemas['ListAutomationsResult']>
  GetAutomationResponse: Undeclared<GetAutomationResponse, Schemas['GetAutomationResult']>
  SyncAutomationResponse: Undeclared<SyncAutomationResponse, Schemas['SyncAutomationResult']>
  RunAutomationNowResponse: Undeclared<RunAutomationNowResponse, Schemas['RunAutomationNowResult']>
  PauseAutomationResponse: Undeclared<PauseAutomationResponse, Schemas['PauseAutomationResult']>
  ResumeAutomationResponse: Undeclared<ResumeAutomationResponse, Schemas['ResumeAutomationResult']>
  ListAutomationExecutionsResponse: Undeclared<ListAutomationExecutionsResponse, Schemas['ListAutomationExecutionsResult']>
  ListAutomationSourceOptionsResponse: Undeclared<ListAutomationSourceOptionsResponse, Schemas['ListAutomationSourceOptionsResult']>
  SaveDashboardPinnedSavedRunsResponse: Undeclared<SaveDashboardPinnedSavedRunsResponse, Schemas['SaveDashboardPinnedSavedRunsResult']>
  RunSavedRunDiffResponse: Undeclared<RunSavedRunDiffResponse, Schemas['RunSavedRunDiffResult']>
  CreateRuleSetRunResponse: Undeclared<CreateRuleSetRunResponse, Schemas['CreateRuleSetRunResult']>
  ListGeneratedOutputsResponse: Undeclared<ListGeneratedOutputsResponse, Schemas['ListGeneratedOutputsResult']>
  SubscribeRunNotificationResponse: Undeclared<SubscribeRunNotificationResponse, Schemas['SubscribeRunNotificationResult']>
  UnsubscribeRunNotificationResponse: Undeclared<UnsubscribeRunNotificationResponse, Schemas['UnsubscribeRunNotificationResult']>
  CancelReconciliationRunResponse: Undeclared<CancelReconciliationRunResponse, Schemas['CancelReconciliationRunResult']>
  GetGeneratedOutputDifferencesResponse: Undeclared<GetGeneratedOutputDifferencesResponse, Schemas['GetGeneratedOutputDifferencesResult']>
  ListJsonSchemasResponse: Undeclared<ListJsonSchemasResponse, Schemas['ListJsonSchemasResult']>
  GetJsonSchemaResponse: Undeclared<GetJsonSchemaResponse, Schemas['GetJsonSchemaResult']>
  FlattenJsonSchemaResponse: Undeclared<FlattenJsonSchemaResponse, Schemas['FlattenJsonSchemaResult']>
  GetCliLoginRequestResponse: Undeclared<GetCliLoginRequestResponse, Schemas['GetCliLoginRequestResult']>
  ListCliSessionsResponse: Undeclared<ListCliSessionsResponse, Schemas['ListCliSessionsResult']>
  GetMyCliAccessResponse: Undeclared<GetMyCliAccessResponse, Schemas['GetMyCliAccessResult']>
  RequestCliAccessResponse: Undeclared<RequestCliAccessResponse, Schemas['RequestCliAccessResult']>
  SaveTenantChatSpacePayload: Undeclared<SaveTenantChatSpacePayload, Schemas['SaveTenantChatSpaceParams']>
  SetNotificationRoutePayload: Undeclared<SetNotificationRoutePayload, Schemas['SetNotificationRouteParams']>
  ListSftpServersPayload: Undeclared<ListSftpServersPayload, Schemas['ListSftpServersParams']>
  SaveSftpServerPayload: Undeclared<SaveSftpServerPayload, Schemas['SaveSftpServerParams']>
  ListNsAuthConfigsPayload: Undeclared<ListNsAuthConfigsPayload, Schemas['ListNsAuthConfigsParams']>
  SaveNsAuthConfigPayload: Undeclared<SaveNsAuthConfigPayload, Schemas['SaveNsAuthConfigParams']>
  ListShopifyAuthConfigsPayload: Undeclared<ListShopifyAuthConfigsPayload, Schemas['ListShopifyAuthConfigsParams']>
  SaveShopifyAuthConfigPayload: Undeclared<SaveShopifyAuthConfigPayload, Schemas['SaveShopifyAuthConfigParams']>
  ListConfigTenantAccessPayload: Undeclared<ListConfigTenantAccessPayload, Schemas['ListConfigTenantAccessParams']>
  ListSourceConfigEndpointsPayload: Undeclared<ListSourceConfigEndpointsPayload, Schemas['ListSourceConfigEndpointsParams']>
  StoreSourceConfigEndpointAccessPayload: Undeclared<StoreSourceConfigEndpointAccessPayload, Schemas['StoreSourceConfigEndpointAccessParams']>
  SaveJsonSchemaTextPayload: Undeclared<SaveJsonSchemaTextPayload, Schemas['SaveJsonSchemaTextParams']>
  FlattenJsonSchemaPayload: Undeclared<FlattenJsonSchemaPayload, Schemas['FlattenJsonSchemaParams']>
  SaveRefinedSchemaPayload: Undeclared<SaveRefinedSchemaPayload, Schemas['SaveRefinedSchemaParams']>
  DeleteJsonSchemaPayload: Undeclared<DeleteJsonSchemaPayload, Schemas['DeleteJsonSchemaParams']>
  CreateRuleSetRunPayload: Undeclared<CreateRuleSetRunPayload, Schemas['CreateRuleSetRunParams']>
  SaveRuleSetRunPayload: Undeclared<SaveRuleSetRunPayload, Schemas['SaveRuleSetRunParams']>
  ListSavedRunsPayload: Undeclared<ListSavedRunsPayload, Schemas['ListSavedRunsParams']>
  SaveMappingPayload: Undeclared<SaveMappingPayload, Schemas['SaveMappingParams']>
  SaveDashboardPinnedSavedRunsPayload: Undeclared<SaveDashboardPinnedSavedRunsPayload, Schemas['SaveDashboardPinnedSavedRunsParams']>
  RunSavedRunDiffPayload: Undeclared<RunSavedRunDiffPayload, Schemas['RunSavedRunDiffParams']>
  ListGeneratedOutputsPayload: Undeclared<ListGeneratedOutputsPayload, Schemas['ListGeneratedOutputsParams']>
  GetGeneratedOutputPayload: Undeclared<GetGeneratedOutputPayload, Schemas['GetGeneratedOutputParams']>
  ListAutomationsPayload: Undeclared<ListAutomationsPayload, Schemas['ListAutomationsParams']>
  SaveAutomationPayload: Undeclared<SaveAutomationPayload, Schemas['SaveAutomationParams']>
  RunAutomationNowPayload: Undeclared<RunAutomationNowPayload, Schemas['RunAutomationNowParams']>
  ListAutomationExecutionsPayload: Undeclared<ListAutomationExecutionsPayload, Schemas['ListAutomationExecutionsParams']>
  GetNsSuiteQlQueryOptionsResponse: Undeclared<GetNsSuiteQlQueryOptionsResponse, Schemas['GetNsSuiteQlQueryOptionsResult']>
  GetRunConclusionsResponse: Undeclared<GetRunConclusionsResponse, Schemas['GetRunConclusionsResult']>
  CreateRunConclusionCodeResponse: Undeclared<CreateRunConclusionCodeResponse, Schemas['CreateRunConclusionCodeResult']>
  SaveRunConclusionsResponse: Undeclared<SaveRunConclusionsResponse, Schemas['SaveRunConclusionsResult']>
  GetAuditCheckOptionsResponse: Undeclared<GetAuditCheckOptionsResponse, Schemas['GetAuditCheckOptionsResult']>
  SaveAuditCheckResponse: Undeclared<SaveAuditCheckResponse, Schemas['SaveAuditCheckResult']>
  RemoveAuditCheckResponse: Undeclared<RemoveAuditCheckResponse, Schemas['RemoveAuditCheckResult']>
  ListTenantQueriesResponse: Undeclared<ListTenantQueriesResponse, Schemas['ListTenantQueriesResult']>
  SaveTenantQueryPinsResponse: Undeclared<SaveTenantQueryPinsResponse, Schemas['SaveTenantQueryPinsResult']>
  GetTenantQueryCatalogResponse: Undeclared<GetTenantQueryCatalogResponse, Schemas['GetTenantQueryCatalogResult']>
  SaveTenantQueryResponse: Undeclared<SaveTenantQueryResponse, Schemas['SaveTenantQueryResult']>
  RunTenantQueryResponse: Undeclared<RunTenantQueryResponse, Schemas['RunTenantQueryResult']>
  ListTenantQuerySchedulesResponse: Undeclared<ListTenantQuerySchedulesResponse, Schemas['ListTenantQuerySchedulesResult']>
  SaveTenantQuerySchedulePayload: Undeclared<SaveTenantQuerySchedulePayload, Schemas['SaveTenantQueryScheduleParams']>
  SaveTenantQueryScheduleResponse: Undeclared<SaveTenantQueryScheduleResponse, Schemas['SaveTenantQueryScheduleResult']>
  RunTenantQueryScheduleResponse: Undeclared<RunTenantQueryScheduleResponse, Schemas['RunTenantQueryScheduleResult']>
  SendAgentQueryTurnResponse: Undeclared<SendAgentQueryTurnResponse, Schemas['SendAgentQueryTurnResult']>
  GetLifecycleOptionsResponse: Undeclared<GetLifecycleOptionsResponse, Schemas['GetLifecycleOptionsResult']>
  SaveLifecyclePayload: Undeclared<SaveLifecyclePayload, Schemas['SaveLifecycleParams']>
  SaveLifecycleResponse: Undeclared<SaveLifecycleResponse, Schemas['SaveLifecycleResult']>
  GetAgentStatusResponse: Undeclared<GetAgentStatusResponse, Schemas['GetAgentStatusResult']>
  SendAgentTurnResponse: Undeclared<SendAgentTurnResponse, Schemas['SendAgentTurnResult']>
  GetAgentConversationResponse: Undeclared<GetAgentConversationResponse, Schemas['GetAgentConversationResult']>
  PlanAuditChangeResponse: Undeclared<PlanAuditChangeResponse, Schemas['PlanAuditChangeResult']>
  ApplyAuditChangeResponse: Undeclared<ApplyAuditChangeResponse, Schemas['ApplyAuditChangeResult']>
  RejectAuditChangeResponse: Undeclared<RejectAuditChangeResponse, Schemas['RejectAuditChangeResult']>
  RevertAuditChangeResponse: Undeclared<RevertAuditChangeResponse, Schemas['RevertAuditChangeResult']>
  ListPeakPeriodsResponse: Undeclared<ListPeakPeriodsResponse, Schemas['ListPeakPeriodsResult']>
  GetPeakPeriodResponse: Undeclared<GetPeakPeriodResponse, Schemas['GetPeakPeriodResult']>
  SavePeakPeriodPayload: Undeclared<SavePeakPeriodPayload, Schemas['SavePeakPeriodParams']>
  SavePeakPeriodResponse: Undeclared<SavePeakPeriodResponse, Schemas['SavePeakPeriodResult']>
  ListSyncPairsResponse: Undeclared<ListSyncPairsResponse, Schemas['ListSyncPairsResult']>
  GetSyncPairResponse: Undeclared<GetSyncPairResponse, Schemas['GetSyncPairResult']>
  SaveSyncPairPayload: Undeclared<SaveSyncPairPayload, Schemas['SaveSyncPairParams']>
  SaveSyncPairResponse: Undeclared<SaveSyncPairResponse, Schemas['SaveSyncPairResult']>
  GetRunPulseFlagsResponse: Undeclared<GetRunPulseFlagsResponse, Schemas['GetRunPulseFlagsResult']>
  SnapshotTenantConfigResponse: Undeclared<SnapshotTenantConfigResponse, Schemas['SnapshotTenantConfigResult']>
  GetTenantConfigVersionsResponse: Undeclared<GetTenantConfigVersionsResponse, Schemas['GetTenantConfigVersionsResult']>
  PreviewTenantConfigRestoreResponse: Undeclared<PreviewTenantConfigRestoreResponse, Schemas['PreviewTenantConfigRestoreResult']>
  RestoreTenantConfigVersionResponse: Undeclared<RestoreTenantConfigVersionResponse, Schemas['RestoreTenantConfigVersionResult']>
}

describe('hand-written API types name only keys the contract declares', () => {
  it('every hand-written payload and reply stays inside its generated twin', () => {
    expectTypeOf<HandWrittenTypes>().toEqualTypeOf<{ [Name in keyof HandWrittenTypes]: never }>()
  })
})
