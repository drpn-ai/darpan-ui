import { callService } from './client'
import type { GetAuditFindingResponse, GetAuditReportResponse, GetAuditsResponse } from './auditTypes'

// Cache-reset coordinator. The actual reset implementation is wired up in
// main.ts after Pinia is installed, so this module stays free of store
// imports (avoiding circular dependencies with referenceData store, which
// itself depends on settingsFacade defined below).
let _resetApiCache: (() => void) | null = null

export function setApiCacheReset(fn: () => void): void {
  _resetApiCache = fn
}

export function clearApiResponseCache(): void {
  _resetApiCache?.()
}
import type {
  CreateRuleSetRunResponse,
  ChangeExpiredPasswordResponse,
  CompletePasswordResetResponse,
  GetPasswordResetStatusResponse,
  RequestPasswordResetResponse,
  SaveRecoveryEmailResponse,
  VerifyPasswordResetCodeResponse,
  ChangeOwnPasswordResponse,
  DeleteJsonSchemaResponse,
  DeleteAutomationResponse,
  DeleteNsAuthConfigResponse,
  DeleteOmsRestSourceConfigResponse,
  DeleteSavedRunResponse,
  DeleteShopifyAuthConfigResponse,
  BeginSlackInstallResponse,
  DeleteTenantChatSpaceResponse,
  DisconnectSlackWorkspaceResponse,
  GetSlackInstallResponse,
  ListSlackChannelsResponse,
  SaveSlackBotTokenResponse,
  FlattenJsonSchemaResponse,
  GetAutomationResponse,
  SyncAutomationResponse,
  GetMappingResponse,
  GetGeneratedOutputResponse,
  GetReconciliationRunStatusPayload,
  GetReconciliationRunStatusResponse,
  GetGeneratedOutputDifferencesResponse,
  GetShopifyAuthConfigResponse,
  GetTenantSettingsResponse,
  GetUserNotificationDefaultResponse,
  GetJsonSchemaResponse,
  GrantConfigTenantAccessResponse,
  InferJsonSchemaResponse,
  ListAutomationExecutionsResponse,
  ListAutomationsResponse,
  ListAutomationSourceOptionsResponse,
  ListConfigTenantAccessResponse,
  ListEnumOptionsResponse,
  ListJsonSchemasResponse,
  ListNsAuthConfigsResponse,
  ListOmsRestSourceConfigsResponse,
  ListNsRestletConfigsResponse,
  ListShopifyAuthConfigsResponse,
  ListGeneratedOutputsResponse,
  ListSavedRunsResponse,
  ListSftpServersResponse,
  ListSourceConfigEndpointsResponse,
  ListTenantChatSpacesResponse,
  LoginSessionResponse,
  LlmSettingsResponse,
  LogoutSessionResponse,
  RevokeConfigTenantAccessResponse,
  RunAutomationNowResponse,
  RunSavedRunDiffResponse,
  PauseAutomationResponse,
  ArchiveResponse,
  ResumeAutomationResponse,
  SaveAutomationResponse,
  SaveJsonSchemaTextResponse,
  SaveLlmSettingsResponse,
  SaveNsAuthConfigResponse,
  SaveOmsRestSourceConfigResponse,
  SaveDashboardPinnedSavedRunsResponse,
  SaveRuleSetRunResponse,
  SaveSavedRunNameResponse,
  SaveActiveTenantResponse,
  SaveTenantChatSpaceResponse,
  SaveTenantSettingsResponse,
  SaveUserNotificationDefaultResponse,
  SaveUserSettingsResponse,
  SaveShopifyAuthConfigResponse,
  TestSourceConnectionResponse,
  SubscribeRunNotificationResponse,
  UnsubscribeRunNotificationResponse,
  CancelReconciliationRunResponse,
  VerifyOwnPasswordResponse,
  SaveMappingResponse,
  SaveNsRestletConfigResponse,
  SaveRefinedSchemaResponse,
  SaveSftpServerResponse,
  SessionInfoResponse,
  StoreSourceConfigEndpointAccessResponse,
  ValidateJsonResponse,
} from './types'
import type {
  ChangeExpiredPasswordPayload,
  CompletePasswordResetPayload,
  RequestPasswordResetPayload,
  SaveRecoveryEmailPayload,
  VerifyPasswordResetCodePayload,
  ChangeOwnPasswordPayload,
  ConfigTenantAccessMutationPayload,
  CreateRuleSetRunPayload,
  DeleteAutomationPayload,
  DeleteJsonSchemaPayload,
  DeleteNsAuthConfigPayload,
  DeleteOmsRestSourceConfigPayload,
  DeleteSavedRunPayload,
  DeleteShopifyAuthConfigPayload,
  DeleteTenantChatSpacePayload,
  DisconnectSlackWorkspacePayload,
  ListSlackChannelsPayload,
  SaveSlackBotTokenPayload,
  FlattenJsonSchemaPayload,
  GetAutomationPayload,
  SyncAutomationPayload,
  GetGeneratedOutputPayload,
  GetGeneratedOutputDifferencesPayload,
  GetJsonSchemaPayload,
  GetLlmSettingsPayload,
  GetMappingPayload,
  GetShopifyAuthConfigPayload,
  InferJsonSchemaFromCsvTextPayload,
  InferJsonSchemaFromTextPayload,
  ListAutomationExecutionsPayload,
  ListAutomationsPayload,
  ListConfigTenantAccessPayload,
  ListGeneratedOutputsPayload,
  ListJsonSchemasPayload,
  ListNsAuthConfigsPayload,
  ListNsRestletConfigsPayload,
  ListOmsRestSourceConfigsPayload,
  ListSavedRunsPayload,
  ListSftpServersPayload,
  ListShopifyAuthConfigsPayload,
  ListSourceConfigEndpointsPayload,
  PauseAutomationPayload,
  ResumeAutomationPayload,
  RunAutomationNowPayload,
  RunSavedRunDiffPayload,
  SaveAutomationPayload,
  SaveDashboardPinnedSavedRunsPayload,
  SaveJsonSchemaTextPayload,
  SaveLlmSettingsPayload,
  SaveMappingPayload,
  SaveNsAuthConfigPayload,
  SaveNsRestletConfigPayload,
  SaveOmsRestSourceConfigPayload,
  SaveRefinedSchemaPayload,
  SaveRuleSetRunPayload,
  SaveSavedRunNamePayload,
  SaveSftpServerPayload,
  SaveShopifyAuthConfigPayload,
  TestSourceConnectionPayload,
  SaveTenantChatSpacePayload,
  SaveTenantSettingsPayload,
  SaveUserNotificationDefaultPayload,
  SaveUserSettingsPayload,
  StoreSourceConfigEndpointAccessPayload,
  SubscribeRunNotificationPayload,
  UnsubscribeRunNotificationPayload,
  CancelReconciliationRunPayload,
  ValidateJsonTextPayload,
  VerifyOwnPasswordPayload,
} from './facadeTypes'
import type {
  GetFlowchartExecutionResponse,
  GetFlowchartRunResponse,
  ImportNetSuiteChecksResponse,
  GetLifecycleOptionsResponse,
  SaveLifecyclePayload,
  SaveLifecycleResponse,
  LifecycleRule,
  LifecycleRuleOptionsResponse,
  LifecycleRulesResponse,
  LifecycleStageException,
  LifecycleStageExceptionsResponse,
  LifecycleDetail,
  LifecycleFinding,
  FlowchartQuestion,
  ListFlowchartExecutionsResponse,
  ListFlowchartRunsResponse,
  RunFlowchartPayload,
  RunFlowchartResponse,
  SaveFlowchartQuestionPayload,
  SaveFlowchartQuestionResponse,
  SaveFlowchartRunPayload,
  SaveFlowchartRunResponse,
} from './flowchartTypes'

const AUTH = {
  loginSession: 'facade.AuthFacadeServices.login#Session',
  getSessionInfo: 'facade.AuthFacadeServices.get#SessionInfo',
  saveActiveTenant: 'facade.AuthFacadeServices.save#ActiveTenant',
  saveUserSettings: 'facade.AuthFacadeServices.save#UserSettings',
  verifyOwnPassword: 'facade.AuthFacadeServices.verify#OwnPassword',
  changeOwnPassword: 'facade.AuthFacadeServices.change#OwnPassword',
  changeExpiredPassword: 'facade.AuthFacadeServices.change#ExpiredPassword',
  requestPasswordReset: 'facade.AuthFacadeServices.request#PasswordReset',
  verifyPasswordResetCode: 'facade.AuthFacadeServices.verify#PasswordResetCode',
  completePasswordReset: 'facade.AuthFacadeServices.complete#PasswordReset',
  saveRecoveryEmail: 'facade.AuthFacadeServices.save#RecoveryEmail',
  getPasswordResetStatus: 'facade.AuthFacadeServices.get#PasswordResetStatus',
  logoutSession: 'facade.AuthFacadeServices.logout#Session',
}

const SETTINGS = {
  listEnumOptions: 'facade.SettingsFacadeServices.list#EnumOptions',
  getLlmSettings: 'facade.SettingsFacadeServices.get#LlmSettings',
  saveLlmSettings: 'facade.SettingsFacadeServices.save#LlmSettings',
  getTenantSettings: 'facade.SettingsFacadeServices.get#TenantSettings',
  saveTenantSettings: 'facade.SettingsFacadeServices.save#TenantSettings',
  listTenantChatSpaces: 'facade.SettingsFacadeServices.list#TenantChatSpaces',
  saveTenantChatSpace: 'facade.SettingsFacadeServices.save#TenantChatSpace',
  deleteTenantChatSpace: 'facade.SettingsFacadeServices.delete#TenantChatSpace',
  beginSlackInstall: 'facade.SlackFacadeServices.begin#SlackInstall',
  getSlackInstall: 'facade.SlackFacadeServices.get#SlackInstall',
  saveSlackBotToken: 'facade.SlackFacadeServices.save#SlackBotToken',
  listSlackChannels: 'facade.SlackFacadeServices.list#SlackChannels',
  disconnectSlackWorkspace: 'facade.SlackFacadeServices.disconnect#SlackWorkspace',
  getUserNotificationDefault: 'facade.SettingsFacadeServices.get#UserNotificationDefault',
  saveUserNotificationDefault: 'facade.SettingsFacadeServices.save#UserNotificationDefault',
  listSftpServers: 'facade.SettingsFacadeServices.list#SftpServers',
  saveSftpServer: 'facade.SettingsFacadeServices.save#SftpServer',
  listNsAuthConfigs: 'facade.SettingsFacadeServices.list#NsAuthConfigs',
  saveNsAuthConfig: 'facade.SettingsFacadeServices.save#NsAuthConfig',
  deleteNsAuthConfig: 'facade.SettingsFacadeServices.delete#NsAuthConfig',
  listNsRestletConfigs: 'facade.SettingsFacadeServices.list#NsRestletConfigs',
  saveNsRestletConfig: 'facade.SettingsFacadeServices.save#NsRestletConfig',
  listShopifyAuthConfigs: 'facade.ShopifyFacadeServices.list#ShopifyAuthConfigs',
  getShopifyAuthConfig: 'facade.ShopifyFacadeServices.get#ShopifyAuthConfig',
  saveShopifyAuthConfig: 'facade.ShopifyFacadeServices.save#ShopifyAuthConfig',
  deleteShopifyAuthConfig: 'facade.ShopifyFacadeServices.delete#ShopifyAuthConfig',
  listOmsRestSourceConfigs: 'facade.HotWaxOmsFacadeServices.list#HotWaxOmsRestSourceConfigs',
  saveOmsRestSourceConfig: 'facade.HotWaxOmsFacadeServices.save#HotWaxOmsRestSourceConfig',
  deleteOmsRestSourceConfig: 'facade.HotWaxOmsFacadeServices.delete#HotWaxOmsRestSourceConfig',
  testSourceConnection: 'facade.SettingsFacadeServices.test#SourceConnection',
  listConfigTenantAccess: 'facade.ConfigSharingFacadeServices.list#ConfigTenantAccess',
  grantConfigTenantAccess: 'facade.ConfigSharingFacadeServices.grant#ConfigTenantAccess',
  revokeConfigTenantAccess: 'facade.ConfigSharingFacadeServices.revoke#ConfigTenantAccess',
  listSourceConfigEndpoints: 'facade.SourceEndpointFacadeServices.list#SourceConfigEndpoints',
  storeSourceConfigEndpointAccess: 'facade.SourceEndpointFacadeServices.store#SourceConfigEndpointAccess',
}

const JSON_SCHEMA = {
  list: 'facade.JsonSchemaFacadeServices.list#JsonSchemas',
  get: 'facade.JsonSchemaFacadeServices.get#JsonSchema',
  saveText: 'facade.JsonSchemaFacadeServices.save#JsonSchemaText',
  inferFromText: 'facade.JsonSchemaFacadeServices.infer#JsonSchemaFromText',
  inferFromCsvText: 'facade.JsonSchemaFacadeServices.infer#JsonSchemaFromCsvText',
  validateText: 'facade.JsonSchemaFacadeServices.validate#JsonTextAgainstSchema',
  flatten: 'facade.JsonSchemaFacadeServices.flatten#JsonSchema',
  saveRefined: 'facade.JsonSchemaFacadeServices.save#RefinedSchema',
  delete: 'facade.JsonSchemaFacadeServices.delete#JsonSchema',
}

const RECONCILIATION = {
  createRuleSetRun: 'facade.ReconciliationFacadeServices.create#RuleSetRun',
  saveRuleSetRun: 'facade.ReconciliationFacadeServices.save#RuleSetRun',
  listSavedRuns: 'facade.ReconciliationFacadeServices.list#SavedRuns',
  getMapping: 'facade.ReconciliationFacadeServices.get#Mapping',
  saveMapping: 'facade.ReconciliationFacadeServices.save#Mapping',
  saveDashboardPinnedSavedRuns: 'facade.ReconciliationFacadeServices.save#DashboardPinnedSavedRuns',
  saveSavedRunName: 'facade.ReconciliationFacadeServices.save#SavedRunName',
  deleteSavedRun: 'facade.ReconciliationFacadeServices.delete#SavedRun',
  runSavedRunDiff: 'facade.ReconciliationFacadeServices.run#SavedRunDiff',
  listGeneratedOutputs: 'facade.ReconciliationFacadeServices.list#GeneratedOutputs',
  getGeneratedOutput: 'facade.ReconciliationFacadeServices.get#GeneratedOutput',
  getGeneratedOutputDifferences: 'facade.ReconciliationFacadeServices.get#GeneratedOutputDifferences',
  getReconciliationRunStatus: 'facade.ReconciliationFacadeServices.get#ReconciliationRunStatus',
  // DAR-UI-048: the run flowchart.
  listReconciliations: 'facade.ReconciliationFacadeServices.list#Reconciliations',
  saveReconciliation: 'facade.ReconciliationFacadeServices.save#Reconciliation',
  getReconciliation: 'facade.ReconciliationFacadeServices.get#Reconciliation',
  saveReconciliationQuestion: 'facade.ReconciliationFacadeServices.save#ReconciliationQuestion',
  deleteReconciliationQuestion: 'facade.ReconciliationFacadeServices.delete#ReconciliationQuestion',
  runReconciliation: 'facade.ReconciliationFacadeServices.run#Reconciliation',
  getReconciliationExecution: 'facade.ReconciliationFacadeServices.get#ReconciliationExecution',
  listReconciliationExecutions: 'facade.ReconciliationFacadeServices.list#ReconciliationExecutions',
  importNetSuiteChecksAsRuns: 'facade.ReconciliationFacadeServices.import#NetSuiteChecksAsRuns',
  // DAR-UI-050: the lifecycle builder.
  getLifecycleOptions: 'facade.NetSuiteLifecycleFacadeServices.get#LifecycleOptions',
  saveLifecycle: 'facade.ReconciliationFacadeServices.save#Lifecycle',
  getLifecycleRuleOptions: 'facade.NetSuiteLifecycleFacadeServices.get#LifecycleRuleOptions',
  saveLifecycleRule: 'facade.ReconciliationFacadeServices.save#LifecycleRule',
  deleteLifecycleRule: 'facade.ReconciliationFacadeServices.delete#LifecycleRule',
  saveLifecycleStageException: 'facade.ReconciliationFacadeServices.save#LifecycleStageException',
  saveLifecycleDetails: 'facade.ReconciliationFacadeServices.save#LifecycleDetails',
  saveLifecycleFinding: 'facade.ReconciliationFacadeServices.save#LifecycleFinding',
  deleteLifecycleFinding: 'facade.ReconciliationFacadeServices.delete#LifecycleFinding',
  deleteLifecycleStageException: 'facade.ReconciliationFacadeServices.delete#LifecycleStageException',
  saveLifecycleStages: 'facade.ReconciliationFacadeServices.save#LifecycleStages',
  getLifecyclePlan: 'facade.ReconciliationFacadeServices.get#LifecyclePlan',
  listAutomations: 'facade.ReconciliationFacadeServices.list#Automations',
  getAutomation: 'facade.ReconciliationFacadeServices.get#Automation',
  saveAutomation: 'facade.ReconciliationFacadeServices.save#Automation',
  syncAutomation: 'facade.ReconciliationFacadeServices.sync#Automation',
  deleteAutomation: 'facade.ReconciliationFacadeServices.delete#Automation',
  runAutomationNow: 'facade.ReconciliationFacadeServices.run#AutomationNow',
  pauseAutomation: 'facade.ReconciliationFacadeServices.pause#Automation',
  resumeAutomation: 'facade.ReconciliationFacadeServices.resume#Automation',
  // DAR-BE-061. The trash can, which archives rather than deletes. Distinct from pause: pausing
  // keeps an automation on the list, archiving takes it off.
  archiveAutomation: 'facade.ReconciliationFacadeServices.archive#Automation',
  restoreAutomation: 'facade.ReconciliationFacadeServices.restore#Automation',
  archiveSavedRun: 'facade.ReconciliationFacadeServices.archive#SavedRun',
  restoreSavedRun: 'facade.ReconciliationFacadeServices.restore#SavedRun',
  listAutomationExecutions: 'facade.ReconciliationFacadeServices.list#AutomationExecutions',
  listAutomationSourceOptions: 'facade.ReconciliationFacadeServices.list#AutomationSourceOptions',
  subscribeRunNotification: 'facade.ReconciliationFacadeServices.subscribe#RunNotification',
  unsubscribeRunNotification: 'facade.ReconciliationFacadeServices.unsubscribe#RunNotification',
  cancelReconciliationRun: 'facade.ReconciliationFacadeServices.cancel#ReconciliationRun',
}

export const authFacade = {
  loginSession(username: string, password: string, signal?: AbortSignal): Promise<LoginSessionResponse> {
    return callService<LoginSessionResponse>(AUTH.loginSession, { username, password }, signal)
  },
  getSessionInfo(signal?: AbortSignal): Promise<SessionInfoResponse> {
    return callService<SessionInfoResponse>(AUTH.getSessionInfo, {}, signal)
  },
  saveActiveTenant(activeTenantUserGroupId: string, signal?: AbortSignal): Promise<SaveActiveTenantResponse> {
    return callService<SaveActiveTenantResponse>(AUTH.saveActiveTenant, { activeTenantUserGroupId }, signal)
  },
  saveUserSettings(payload: SaveUserSettingsPayload, signal?: AbortSignal): Promise<SaveUserSettingsResponse> {
    return callService<SaveUserSettingsResponse>(AUTH.saveUserSettings, payload, signal)
  },
  verifyOwnPassword(payload: VerifyOwnPasswordPayload, signal?: AbortSignal): Promise<VerifyOwnPasswordResponse> {
    return callService<VerifyOwnPasswordResponse>(AUTH.verifyOwnPassword, payload, signal)
  },
  changeOwnPassword(payload: ChangeOwnPasswordPayload, signal?: AbortSignal): Promise<ChangeOwnPasswordResponse> {
    return callService<ChangeOwnPasswordResponse>(AUTH.changeOwnPassword, payload, signal)
  },
  /** Pre-session password change for an account login refuses until its password changes.
   *  Issues no token — the caller signs in normally afterwards with the new password. */
  changeExpiredPassword(payload: ChangeExpiredPasswordPayload, signal?: AbortSignal): Promise<ChangeExpiredPasswordResponse> {
    return callService<ChangeExpiredPasswordResponse>(AUTH.changeExpiredPassword, payload, signal)
  },
  requestPasswordReset(payload: RequestPasswordResetPayload, signal?: AbortSignal): Promise<RequestPasswordResetResponse> {
    return callService<RequestPasswordResetResponse>(AUTH.requestPasswordReset, payload, signal)
  },
  verifyPasswordResetCode(payload: VerifyPasswordResetCodePayload, signal?: AbortSignal): Promise<VerifyPasswordResetCodeResponse> {
    return callService<VerifyPasswordResetCodeResponse>(AUTH.verifyPasswordResetCode, payload, signal)
  },
  /** Issues no token — the caller signs in normally afterwards with the new password. */
  completePasswordReset(payload: CompletePasswordResetPayload, signal?: AbortSignal): Promise<CompletePasswordResetResponse> {
    return callService<CompletePasswordResetResponse>(AUTH.completePasswordReset, payload, signal)
  },
  saveRecoveryEmail(payload: SaveRecoveryEmailPayload, signal?: AbortSignal): Promise<SaveRecoveryEmailResponse> {
    return callService<SaveRecoveryEmailResponse>(AUTH.saveRecoveryEmail, payload, signal)
  },
  getPasswordResetStatus(signal?: AbortSignal): Promise<GetPasswordResetStatusResponse> {
    return callService<GetPasswordResetStatusResponse>(AUTH.getPasswordResetStatus, {}, signal)
  },
  logoutSession(signal?: AbortSignal): Promise<LogoutSessionResponse> {
    return callService<LogoutSessionResponse>(AUTH.logoutSession, {}, signal)
  },
}

export const settingsFacade = {
  listEnumOptions(enumTypeId: string, signal?: AbortSignal): Promise<ListEnumOptionsResponse> {
    return callService<ListEnumOptionsResponse>(SETTINGS.listEnumOptions, { enumTypeId }, signal)
  },
  getLlmSettings(payload?: GetLlmSettingsPayload, signal?: AbortSignal): Promise<LlmSettingsResponse> {
    return callService<LlmSettingsResponse>(SETTINGS.getLlmSettings, payload ?? {}, signal)
  },
  saveLlmSettings(payload: SaveLlmSettingsPayload, signal?: AbortSignal): Promise<SaveLlmSettingsResponse> {
    return callService<SaveLlmSettingsResponse>(SETTINGS.saveLlmSettings, payload, signal)
  },
  getTenantSettings(signal?: AbortSignal): Promise<GetTenantSettingsResponse> {
    return callService<GetTenantSettingsResponse>(SETTINGS.getTenantSettings, {}, signal)
  },
  saveTenantSettings(payload: SaveTenantSettingsPayload, signal?: AbortSignal): Promise<SaveTenantSettingsResponse> {
    return callService<SaveTenantSettingsResponse>(SETTINGS.saveTenantSettings, payload, signal)
  },
  listTenantChatSpaces(signal?: AbortSignal): Promise<ListTenantChatSpacesResponse> {
    return callService<ListTenantChatSpacesResponse>(SETTINGS.listTenantChatSpaces, {}, signal)
  },
  saveTenantChatSpace(payload: SaveTenantChatSpacePayload, signal?: AbortSignal): Promise<SaveTenantChatSpaceResponse> {
    return callService<SaveTenantChatSpaceResponse>(SETTINGS.saveTenantChatSpace, payload, signal)
  },
  deleteTenantChatSpace(payload: DeleteTenantChatSpacePayload, signal?: AbortSignal): Promise<DeleteTenantChatSpaceResponse> {
    return callService<DeleteTenantChatSpaceResponse>(SETTINGS.deleteTenantChatSpace, payload, signal)
  },
  beginSlackInstall(signal?: AbortSignal): Promise<BeginSlackInstallResponse> {
    return callService<BeginSlackInstallResponse>(SETTINGS.beginSlackInstall, {}, signal)
  },
  getSlackInstall(signal?: AbortSignal): Promise<GetSlackInstallResponse> {
    return callService<GetSlackInstallResponse>(SETTINGS.getSlackInstall, {}, signal)
  },
  saveSlackBotToken(payload: SaveSlackBotTokenPayload, signal?: AbortSignal): Promise<SaveSlackBotTokenResponse> {
    return callService<SaveSlackBotTokenResponse>(SETTINGS.saveSlackBotToken, payload, signal)
  },
  listSlackChannels(payload: ListSlackChannelsPayload, signal?: AbortSignal): Promise<ListSlackChannelsResponse> {
    return callService<ListSlackChannelsResponse>(SETTINGS.listSlackChannels, payload, signal)
  },
  disconnectSlackWorkspace(payload: DisconnectSlackWorkspacePayload, signal?: AbortSignal): Promise<DisconnectSlackWorkspaceResponse> {
    return callService<DisconnectSlackWorkspaceResponse>(SETTINGS.disconnectSlackWorkspace, payload, signal)
  },
  getUserNotificationDefault(signal?: AbortSignal): Promise<GetUserNotificationDefaultResponse> {
    return callService<GetUserNotificationDefaultResponse>(SETTINGS.getUserNotificationDefault, {}, signal)
  },
  saveUserNotificationDefault(payload: SaveUserNotificationDefaultPayload, signal?: AbortSignal): Promise<SaveUserNotificationDefaultResponse> {
    return callService<SaveUserNotificationDefaultResponse>(SETTINGS.saveUserNotificationDefault, payload, signal)
  },
  listSftpServers(payload: ListSftpServersPayload, signal?: AbortSignal): Promise<ListSftpServersResponse> {
    return callService<ListSftpServersResponse>(SETTINGS.listSftpServers, payload, signal)
  },
  saveSftpServer(payload: SaveSftpServerPayload, signal?: AbortSignal): Promise<SaveSftpServerResponse> {
    return callService<SaveSftpServerResponse>(SETTINGS.saveSftpServer, payload, signal)
  },
  listNsAuthConfigs(payload: ListNsAuthConfigsPayload, signal?: AbortSignal): Promise<ListNsAuthConfigsResponse> {
    return callService<ListNsAuthConfigsResponse>(SETTINGS.listNsAuthConfigs, payload, signal)
  },
  saveNsAuthConfig(payload: SaveNsAuthConfigPayload, signal?: AbortSignal): Promise<SaveNsAuthConfigResponse> {
    return callService<SaveNsAuthConfigResponse>(SETTINGS.saveNsAuthConfig, payload, signal)
  },
  deleteNsAuthConfig(payload: DeleteNsAuthConfigPayload, signal?: AbortSignal): Promise<DeleteNsAuthConfigResponse> {
    return callService<DeleteNsAuthConfigResponse>(SETTINGS.deleteNsAuthConfig, payload, signal)
  },
  listNsRestletConfigs(payload: ListNsRestletConfigsPayload, signal?: AbortSignal): Promise<ListNsRestletConfigsResponse> {
    return callService<ListNsRestletConfigsResponse>(SETTINGS.listNsRestletConfigs, payload, signal)
  },
  saveNsRestletConfig(payload: SaveNsRestletConfigPayload, signal?: AbortSignal): Promise<SaveNsRestletConfigResponse> {
    return callService<SaveNsRestletConfigResponse>(SETTINGS.saveNsRestletConfig, payload, signal)
  },
  listShopifyAuthConfigs(payload: ListShopifyAuthConfigsPayload, signal?: AbortSignal): Promise<ListShopifyAuthConfigsResponse> {
    return callService<ListShopifyAuthConfigsResponse>(SETTINGS.listShopifyAuthConfigs, payload, signal)
  },
  getShopifyAuthConfig(payload: GetShopifyAuthConfigPayload, signal?: AbortSignal): Promise<GetShopifyAuthConfigResponse> {
    return callService<GetShopifyAuthConfigResponse>(SETTINGS.getShopifyAuthConfig, payload, signal)
  },
  saveShopifyAuthConfig(payload: SaveShopifyAuthConfigPayload, signal?: AbortSignal): Promise<SaveShopifyAuthConfigResponse> {
    return callService<SaveShopifyAuthConfigResponse>(SETTINGS.saveShopifyAuthConfig, payload, signal)
  },
  deleteShopifyAuthConfig(payload: DeleteShopifyAuthConfigPayload, signal?: AbortSignal): Promise<DeleteShopifyAuthConfigResponse> {
    return callService<DeleteShopifyAuthConfigResponse>(SETTINGS.deleteShopifyAuthConfig, payload, signal)
  },
  listOmsRestSourceConfigs(payload: ListOmsRestSourceConfigsPayload, signal?: AbortSignal): Promise<ListOmsRestSourceConfigsResponse> {
    return callService<ListOmsRestSourceConfigsResponse>(SETTINGS.listOmsRestSourceConfigs, payload, signal)
  },
  saveOmsRestSourceConfig(payload: SaveOmsRestSourceConfigPayload, signal?: AbortSignal): Promise<SaveOmsRestSourceConfigResponse> {
    return callService<SaveOmsRestSourceConfigResponse>(SETTINGS.saveOmsRestSourceConfig, payload, signal)
  },
  deleteOmsRestSourceConfig(payload: DeleteOmsRestSourceConfigPayload, signal?: AbortSignal): Promise<DeleteOmsRestSourceConfigResponse> {
    return callService<DeleteOmsRestSourceConfigResponse>(SETTINGS.deleteOmsRestSourceConfig, payload, signal)
  },
  testSourceConnection(payload: TestSourceConnectionPayload, signal?: AbortSignal): Promise<TestSourceConnectionResponse> {
    return callService<TestSourceConnectionResponse>(SETTINGS.testSourceConnection, payload, signal)
  },
  listConfigTenantAccess(payload: ListConfigTenantAccessPayload, signal?: AbortSignal): Promise<ListConfigTenantAccessResponse> {
    return callService<ListConfigTenantAccessResponse>(SETTINGS.listConfigTenantAccess, payload, signal)
  },
  grantConfigTenantAccess(payload: ConfigTenantAccessMutationPayload, signal?: AbortSignal): Promise<GrantConfigTenantAccessResponse> {
    return callService<GrantConfigTenantAccessResponse>(SETTINGS.grantConfigTenantAccess, payload, signal)
  },
  revokeConfigTenantAccess(payload: ConfigTenantAccessMutationPayload, signal?: AbortSignal): Promise<RevokeConfigTenantAccessResponse> {
    return callService<RevokeConfigTenantAccessResponse>(SETTINGS.revokeConfigTenantAccess, payload, signal)
  },
  listSourceConfigEndpoints(payload: ListSourceConfigEndpointsPayload, signal?: AbortSignal): Promise<ListSourceConfigEndpointsResponse> {
    return callService<ListSourceConfigEndpointsResponse>(SETTINGS.listSourceConfigEndpoints, payload, signal)
  },
  storeSourceConfigEndpointAccess(payload: StoreSourceConfigEndpointAccessPayload, signal?: AbortSignal): Promise<StoreSourceConfigEndpointAccessResponse> {
    return callService<StoreSourceConfigEndpointAccessResponse>(SETTINGS.storeSourceConfigEndpointAccess, payload, signal)
  },
}

export const jsonSchemaFacade = {
  list(payload: ListJsonSchemasPayload, signal?: AbortSignal): Promise<ListJsonSchemasResponse> {
    return callService<ListJsonSchemasResponse>(JSON_SCHEMA.list, payload, signal)
  },
  get(payload: GetJsonSchemaPayload, signal?: AbortSignal): Promise<GetJsonSchemaResponse> {
    return callService<GetJsonSchemaResponse>(JSON_SCHEMA.get, payload, signal)
  },
  saveText(payload: SaveJsonSchemaTextPayload, signal?: AbortSignal): Promise<SaveJsonSchemaTextResponse> {
    return callService<SaveJsonSchemaTextResponse>(JSON_SCHEMA.saveText, payload, signal)
  },
  inferFromText(payload: InferJsonSchemaFromTextPayload, signal?: AbortSignal): Promise<InferJsonSchemaResponse> {
    return callService<InferJsonSchemaResponse>(JSON_SCHEMA.inferFromText, payload, signal)
  },
  inferFromCsvText(payload: InferJsonSchemaFromCsvTextPayload, signal?: AbortSignal): Promise<InferJsonSchemaResponse> {
    return callService<InferJsonSchemaResponse>(JSON_SCHEMA.inferFromCsvText, payload, signal)
  },
  validateText(payload: ValidateJsonTextPayload, signal?: AbortSignal): Promise<ValidateJsonResponse> {
    return callService<ValidateJsonResponse>(JSON_SCHEMA.validateText, payload, signal)
  },
  flatten(payload: FlattenJsonSchemaPayload, signal?: AbortSignal): Promise<FlattenJsonSchemaResponse> {
    return callService<FlattenJsonSchemaResponse>(JSON_SCHEMA.flatten, payload, signal)
  },
  saveRefined(payload: SaveRefinedSchemaPayload, signal?: AbortSignal): Promise<SaveRefinedSchemaResponse> {
    return callService<SaveRefinedSchemaResponse>(JSON_SCHEMA.saveRefined, payload, signal)
  },
  delete(payload: DeleteJsonSchemaPayload, signal?: AbortSignal): Promise<DeleteJsonSchemaResponse> {
    return callService<DeleteJsonSchemaResponse>(JSON_SCHEMA.delete, payload, signal)
  },
}

// DAR-UI-058. The audit run: the assembler's JSON unchanged, so the screen reads what GraphQL and the CLI read.
const AUDIT = {
  getAudits: 'facade.AuditFacadeServices.get#Audits',
  getAuditReport: 'facade.AuditFacadeServices.get#AuditReport',
  getAuditFinding: 'facade.AuditFacadeServices.get#AuditFinding',
}

export const auditFacade = {
  getAudits(signal?: AbortSignal): Promise<GetAuditsResponse> {
    return callService<GetAuditsResponse>(AUDIT.getAudits, {}, signal)
  },
  getAuditReport(payload: { audit: string; date?: string; period?: string }, signal?: AbortSignal): Promise<GetAuditReportResponse> {
    return callService<GetAuditReportResponse>(AUDIT.getAuditReport, payload, signal)
  },
  getAuditFinding(payload: { findingId: string }, signal?: AbortSignal): Promise<GetAuditFindingResponse> {
    return callService<GetAuditFindingResponse>(AUDIT.getAuditFinding, payload, signal)
  },
}

export const reconciliationFacade = {
  createRuleSetRun(payload: CreateRuleSetRunPayload, signal?: AbortSignal): Promise<CreateRuleSetRunResponse> {
    return callService<CreateRuleSetRunResponse>(RECONCILIATION.createRuleSetRun, payload, signal)
  },
  saveRuleSetRun(payload: SaveRuleSetRunPayload, signal?: AbortSignal): Promise<SaveRuleSetRunResponse> {
    return callService<SaveRuleSetRunResponse>(RECONCILIATION.saveRuleSetRun, payload, signal)
  },
  listSavedRuns(payload: ListSavedRunsPayload, signal?: AbortSignal): Promise<ListSavedRunsResponse> {
    return callService<ListSavedRunsResponse>(RECONCILIATION.listSavedRuns, payload, signal)
  },
  getMapping(payload: GetMappingPayload, signal?: AbortSignal): Promise<GetMappingResponse> {
    return callService<GetMappingResponse>(RECONCILIATION.getMapping, payload, signal)
  },
  saveMapping(payload: SaveMappingPayload, signal?: AbortSignal): Promise<SaveMappingResponse> {
    return callService<SaveMappingResponse>(RECONCILIATION.saveMapping, payload, signal)
  },
  saveDashboardPinnedSavedRuns(payload: SaveDashboardPinnedSavedRunsPayload, signal?: AbortSignal): Promise<SaveDashboardPinnedSavedRunsResponse> {
    return callService<SaveDashboardPinnedSavedRunsResponse>(RECONCILIATION.saveDashboardPinnedSavedRuns, payload, signal)
  },
  saveSavedRunName(payload: SaveSavedRunNamePayload, signal?: AbortSignal): Promise<SaveSavedRunNameResponse> {
    return callService<SaveSavedRunNameResponse>(RECONCILIATION.saveSavedRunName, payload, signal)
  },
  deleteSavedRun(payload: DeleteSavedRunPayload, signal?: AbortSignal): Promise<DeleteSavedRunResponse> {
    return callService<DeleteSavedRunResponse>(RECONCILIATION.deleteSavedRun, payload, signal)
  },
  runSavedRunDiff(payload: RunSavedRunDiffPayload, signal?: AbortSignal): Promise<RunSavedRunDiffResponse> {
    return callService<RunSavedRunDiffResponse>(RECONCILIATION.runSavedRunDiff, payload, signal)
  },
  listGeneratedOutputs(payload: ListGeneratedOutputsPayload, signal?: AbortSignal): Promise<ListGeneratedOutputsResponse> {
    return callService<ListGeneratedOutputsResponse>(RECONCILIATION.listGeneratedOutputs, payload, signal)
  },
  getGeneratedOutput(payload: GetGeneratedOutputPayload, signal?: AbortSignal): Promise<GetGeneratedOutputResponse> {
    return callService<GetGeneratedOutputResponse>(RECONCILIATION.getGeneratedOutput, payload, signal)
  },
  getReconciliationRunStatus(
    payload: GetReconciliationRunStatusPayload,
    signal?: AbortSignal,
  ): Promise<GetReconciliationRunStatusResponse> {
    return callService<GetReconciliationRunStatusResponse>(RECONCILIATION.getReconciliationRunStatus, payload, signal)
  },
  listReconciliations(signal?: AbortSignal): Promise<ListFlowchartRunsResponse> {
    return callService<ListFlowchartRunsResponse>(RECONCILIATION.listReconciliations, {}, signal)
  },
  saveReconciliation(payload: SaveFlowchartRunPayload, signal?: AbortSignal): Promise<SaveFlowchartRunResponse> {
    return callService<SaveFlowchartRunResponse>(RECONCILIATION.saveReconciliation, payload, signal)
  },
  getReconciliation(payload: { reconciliationId: string }, signal?: AbortSignal): Promise<GetFlowchartRunResponse> {
    return callService<GetFlowchartRunResponse>(RECONCILIATION.getReconciliation, payload, signal)
  },
  saveReconciliationQuestion(payload: SaveFlowchartQuestionPayload, signal?: AbortSignal): Promise<SaveFlowchartQuestionResponse> {
    return callService<SaveFlowchartQuestionResponse>(RECONCILIATION.saveReconciliationQuestion, payload, signal)
  },
  deleteReconciliationQuestion(payload: { reconciliationRunId: string }, signal?: AbortSignal): Promise<{ ok?: boolean }> {
    return callService<{ ok?: boolean }>(RECONCILIATION.deleteReconciliationQuestion, payload, signal)
  },
  runReconciliation(payload: RunFlowchartPayload, signal?: AbortSignal): Promise<RunFlowchartResponse> {
    return callService<RunFlowchartResponse>(RECONCILIATION.runReconciliation, payload, signal)
  },
  getReconciliationExecution(payload: { reconciliationExecutionId: string }, signal?: AbortSignal): Promise<GetFlowchartExecutionResponse> {
    return callService<GetFlowchartExecutionResponse>(RECONCILIATION.getReconciliationExecution, payload, signal)
  },
  listReconciliationExecutions(payload: { reconciliationId: string }, signal?: AbortSignal): Promise<ListFlowchartExecutionsResponse> {
    return callService<ListFlowchartExecutionsResponse>(RECONCILIATION.listReconciliationExecutions, payload, signal)
  },
  importNetSuiteChecksAsRuns(signal?: AbortSignal): Promise<ImportNetSuiteChecksResponse> {
    return callService<ImportNetSuiteChecksResponse>(RECONCILIATION.importNetSuiteChecksAsRuns, {}, signal)
  },
  getLifecycleOptions(payload: { nsAuthConfigId: string; recordType?: string }, signal?: AbortSignal): Promise<GetLifecycleOptionsResponse> {
    return callService<GetLifecycleOptionsResponse>(RECONCILIATION.getLifecycleOptions, payload, signal)
  },
  saveLifecycle(payload: SaveLifecyclePayload, signal?: AbortSignal): Promise<SaveLifecycleResponse> {
    return callService<SaveLifecycleResponse>(RECONCILIATION.saveLifecycle, payload, signal)
  },
  getLifecycleRuleOptions(payload: { nsAuthConfigId: string; recordType: string; fieldId?: string; scope?: 'STAGE' | 'FINDING' }, signal?: AbortSignal): Promise<LifecycleRuleOptionsResponse> {
    return callService<LifecycleRuleOptionsResponse>(RECONCILIATION.getLifecycleRuleOptions, payload, signal)
  },
  saveLifecycleRule(payload: { reconciliationId: string } & Omit<LifecycleRule, 'valueLabel'>, signal?: AbortSignal): Promise<LifecycleRulesResponse> {
    return callService<LifecycleRulesResponse>(RECONCILIATION.saveLifecycleRule, payload, signal)
  },
  deleteLifecycleRule(payload: { reconciliationId: string; fieldId: string; value: string }, signal?: AbortSignal): Promise<LifecycleRulesResponse> {
    return callService<LifecycleRulesResponse>(RECONCILIATION.deleteLifecycleRule, payload, signal)
  },
  saveLifecycleFinding(payload: { reconciliationId: string } & Omit<LifecycleFinding, 'reconciliationRunId' | 'stageLabel' | 'label'>, signal?: AbortSignal): Promise<{ findings?: LifecycleFinding[] }> {
    return callService<{ findings?: LifecycleFinding[] }>(RECONCILIATION.saveLifecycleFinding, payload, signal)
  },
  deleteLifecycleFinding(payload: { reconciliationId: string; reconciliationRunId: string }, signal?: AbortSignal): Promise<{ findings?: LifecycleFinding[] }> {
    return callService<{ findings?: LifecycleFinding[] }>(RECONCILIATION.deleteLifecycleFinding, payload, signal)
  },
  saveLifecycleDetails(payload: { reconciliationId: string; details: { fieldId: string; label: string }[] }, signal?: AbortSignal): Promise<{ details?: LifecycleDetail[] }> {
    return callService<{ details?: LifecycleDetail[] }>(RECONCILIATION.saveLifecycleDetails, payload, signal)
  },
  saveLifecycleStageException(payload: { reconciliationId: string } & Omit<LifecycleStageException, 'stageLabel'>, signal?: AbortSignal): Promise<LifecycleStageExceptionsResponse> {
    return callService<LifecycleStageExceptionsResponse>(RECONCILIATION.saveLifecycleStageException, payload, signal)
  },
  saveLifecycleStages(payload: { reconciliationId: string; stageRecordTypes: string[] }, signal?: AbortSignal): Promise<{ reconciliationName?: string }> {
    return callService<{ reconciliationName?: string }>(RECONCILIATION.saveLifecycleStages, payload, signal)
  },
  /** DAR-UI-050. The questions these stages in this order would make, named as a save names them; nothing is saved. */
  getLifecyclePlan(payload: { recordType: string; stageRecordTypes: string[] }, signal?: AbortSignal): Promise<{ questions?: FlowchartQuestion[] }> {
    return callService<{ questions?: FlowchartQuestion[] }>(RECONCILIATION.getLifecyclePlan, payload, signal)
  },
  deleteLifecycleStageException(payload: { reconciliationId: string; stageRecordType: string; fieldId?: string; value: string }, signal?: AbortSignal): Promise<LifecycleStageExceptionsResponse> {
    return callService<LifecycleStageExceptionsResponse>(RECONCILIATION.deleteLifecycleStageException, payload, signal)
  },
  getGeneratedOutputDifferences(
    payload: GetGeneratedOutputDifferencesPayload,
    signal?: AbortSignal,
  ): Promise<GetGeneratedOutputDifferencesResponse> {
    return callService<GetGeneratedOutputDifferencesResponse>(RECONCILIATION.getGeneratedOutputDifferences, payload, signal)
  },
  listAutomations(payload: ListAutomationsPayload, signal?: AbortSignal): Promise<ListAutomationsResponse> {
    return callService<ListAutomationsResponse>(RECONCILIATION.listAutomations, payload, signal)
  },
  getAutomation(payload: GetAutomationPayload, signal?: AbortSignal): Promise<GetAutomationResponse> {
    return callService<GetAutomationResponse>(RECONCILIATION.getAutomation, payload, signal)
  },
  saveAutomation(payload: SaveAutomationPayload, signal?: AbortSignal): Promise<SaveAutomationResponse> {
    return callService<SaveAutomationResponse>(RECONCILIATION.saveAutomation, payload, signal)
  },
  syncAutomation(payload: SyncAutomationPayload, signal?: AbortSignal): Promise<SyncAutomationResponse> {
    return callService<SyncAutomationResponse>(RECONCILIATION.syncAutomation, payload, signal)
  },
  deleteAutomation(payload: DeleteAutomationPayload, signal?: AbortSignal): Promise<DeleteAutomationResponse> {
    return callService<DeleteAutomationResponse>(RECONCILIATION.deleteAutomation, payload, signal)
  },
  runAutomationNow(payload: RunAutomationNowPayload, signal?: AbortSignal): Promise<RunAutomationNowResponse> {
    return callService<RunAutomationNowResponse>(RECONCILIATION.runAutomationNow, payload, signal)
  },
  archiveAutomation(payload: { automationId: string }, signal?: AbortSignal): Promise<ArchiveResponse> {
    return callService<ArchiveResponse>(RECONCILIATION.archiveAutomation, payload, signal)
  },
  restoreAutomation(payload: { automationId: string }, signal?: AbortSignal): Promise<ArchiveResponse> {
    return callService<ArchiveResponse>(RECONCILIATION.restoreAutomation, payload, signal)
  },
  archiveSavedRun(payload: { savedRunId: string }, signal?: AbortSignal): Promise<ArchiveResponse> {
    return callService<ArchiveResponse>(RECONCILIATION.archiveSavedRun, payload, signal)
  },
  restoreSavedRun(payload: { savedRunId: string }, signal?: AbortSignal): Promise<ArchiveResponse> {
    return callService<ArchiveResponse>(RECONCILIATION.restoreSavedRun, payload, signal)
  },
  pauseAutomation(payload: PauseAutomationPayload, signal?: AbortSignal): Promise<PauseAutomationResponse> {
    return callService<PauseAutomationResponse>(RECONCILIATION.pauseAutomation, payload, signal)
  },
  resumeAutomation(payload: ResumeAutomationPayload, signal?: AbortSignal): Promise<ResumeAutomationResponse> {
    return callService<ResumeAutomationResponse>(RECONCILIATION.resumeAutomation, payload, signal)
  },
  listAutomationExecutions(payload: ListAutomationExecutionsPayload, signal?: AbortSignal): Promise<ListAutomationExecutionsResponse> {
    return callService<ListAutomationExecutionsResponse>(RECONCILIATION.listAutomationExecutions, payload, signal)
  },
  listAutomationSourceOptions(signal?: AbortSignal): Promise<ListAutomationSourceOptionsResponse> {
    return callService<ListAutomationSourceOptionsResponse>(RECONCILIATION.listAutomationSourceOptions, {}, signal)
  },
  subscribeRunNotification(payload: SubscribeRunNotificationPayload, signal?: AbortSignal): Promise<SubscribeRunNotificationResponse> {
    return callService<SubscribeRunNotificationResponse>(RECONCILIATION.subscribeRunNotification, payload, signal)
  },
  unsubscribeRunNotification(payload: UnsubscribeRunNotificationPayload, signal?: AbortSignal): Promise<UnsubscribeRunNotificationResponse> {
    return callService<UnsubscribeRunNotificationResponse>(RECONCILIATION.unsubscribeRunNotification, payload, signal)
  },
  cancelReconciliationRun(payload: CancelReconciliationRunPayload, signal?: AbortSignal): Promise<CancelReconciliationRunResponse> {
    return callService<CancelReconciliationRunResponse>(RECONCILIATION.cancelReconciliationRun, payload, signal)
  },
}
