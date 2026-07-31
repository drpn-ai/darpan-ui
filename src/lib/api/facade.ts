import { callService } from './client'

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
  ChangeOwnPasswordResponse,
  DeleteJsonSchemaResponse,
  DeleteAutomationResponse,
  DeleteOmsRestSourceConfigResponse,
  DeleteSavedRunResponse,
  DeleteShopifyAuthConfigResponse,
  DeleteTenantChatSpaceResponse,
  FlattenJsonSchemaResponse,
  GetAutomationResponse,
  GetMappingResponse,
  GetGeneratedOutputResponse,
  GetReconciliationRunStatusPayload,
  GetReconciliationRunStatusResponse,
  GetGeneratedOutputDifferencesResponse,
  GetShopifyAuthConfigResponse,
  GetTenantSettingsResponse,
  GetUserNotificationDefaultResponse,
  GetJsonSchemaResponse,
  InferJsonSchemaResponse,
  ListAutomationExecutionsResponse,
  ListAutomationsResponse,
  ListAutomationSourceOptionsResponse,
  ListEnumOptionsResponse,
  ListJsonSchemasResponse,
  ListNsAuthConfigsResponse,
  ListOmsRestSourceConfigsResponse,
  ListNsRestletConfigsResponse,
  ListShopifyAuthConfigsResponse,
  ListGeneratedOutputsResponse,
  ListSavedRunsResponse,
  ListSftpServersResponse,
  ListTenantChatSpacesResponse,
  LoginSessionResponse,
  LlmSettingsResponse,
  LogoutSessionResponse,
  RunAutomationNowResponse,
  RunSavedRunDiffResponse,
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
  SubscribeRunNotificationResponse,
  UnsubscribeRunNotificationResponse,
  CancelReconciliationRunResponse,
  VerifyOwnPasswordResponse,
  SaveMappingResponse,
  SaveNsRestletConfigResponse,
  SaveRefinedSchemaResponse,
  SaveSftpServerResponse,
  SessionInfoResponse,
  ValidateJsonResponse,
} from './types'
import type {
  ChangeOwnPasswordPayload,
  CreateRuleSetRunPayload,
  DeleteAutomationPayload,
  DeleteJsonSchemaPayload,
  DeleteOmsRestSourceConfigPayload,
  DeleteSavedRunPayload,
  DeleteShopifyAuthConfigPayload,
  DeleteTenantChatSpacePayload,
  FlattenJsonSchemaPayload,
  GetAutomationPayload,
  GetGeneratedOutputPayload,
  GetGeneratedOutputDifferencesPayload,
  GetJsonSchemaPayload,
  GetLlmSettingsPayload,
  GetMappingPayload,
  GetShopifyAuthConfigPayload,
  InferJsonSchemaFromTextPayload,
  ListAutomationExecutionsPayload,
  ListAutomationsPayload,
  ListGeneratedOutputsPayload,
  ListJsonSchemasPayload,
  ListNsAuthConfigsPayload,
  ListNsRestletConfigsPayload,
  ListOmsRestSourceConfigsPayload,
  ListSavedRunsPayload,
  ListSftpServersPayload,
  ListShopifyAuthConfigsPayload,
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
  SaveTenantChatSpacePayload,
  SaveTenantSettingsPayload,
  SaveUserNotificationDefaultPayload,
  SaveUserSettingsPayload,
  SubscribeRunNotificationPayload,
  UnsubscribeRunNotificationPayload,
  CancelReconciliationRunPayload,
  ValidateJsonTextPayload,
  VerifyOwnPasswordPayload,
} from './facadeTypes'

const AUTH = {
  loginSession: 'facade.AuthFacadeServices.login#Session',
  getSessionInfo: 'facade.AuthFacadeServices.get#SessionInfo',
  saveActiveTenant: 'facade.AuthFacadeServices.save#ActiveTenant',
  saveUserSettings: 'facade.AuthFacadeServices.save#UserSettings',
  verifyOwnPassword: 'facade.AuthFacadeServices.verify#OwnPassword',
  changeOwnPassword: 'facade.AuthFacadeServices.change#OwnPassword',
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
  getUserNotificationDefault: 'facade.SettingsFacadeServices.get#UserNotificationDefault',
  saveUserNotificationDefault: 'facade.SettingsFacadeServices.save#UserNotificationDefault',
  listSftpServers: 'facade.SettingsFacadeServices.list#SftpServers',
  saveSftpServer: 'facade.SettingsFacadeServices.save#SftpServer',
  listNsAuthConfigs: 'facade.SettingsFacadeServices.list#NsAuthConfigs',
  saveNsAuthConfig: 'facade.SettingsFacadeServices.save#NsAuthConfig',
  listNsRestletConfigs: 'facade.SettingsFacadeServices.list#NsRestletConfigs',
  saveNsRestletConfig: 'facade.SettingsFacadeServices.save#NsRestletConfig',
  listShopifyAuthConfigs: 'facade.ShopifyFacadeServices.list#ShopifyAuthConfigs',
  getShopifyAuthConfig: 'facade.ShopifyFacadeServices.get#ShopifyAuthConfig',
  saveShopifyAuthConfig: 'facade.ShopifyFacadeServices.save#ShopifyAuthConfig',
  deleteShopifyAuthConfig: 'facade.ShopifyFacadeServices.delete#ShopifyAuthConfig',
  listOmsRestSourceConfigs: 'facade.HotWaxOmsFacadeServices.list#HotWaxOmsRestSourceConfigs',
  saveOmsRestSourceConfig: 'facade.HotWaxOmsFacadeServices.save#HotWaxOmsRestSourceConfig',
  deleteOmsRestSourceConfig: 'facade.HotWaxOmsFacadeServices.delete#HotWaxOmsRestSourceConfig',
}

const JSON_SCHEMA = {
  list: 'facade.JsonSchemaFacadeServices.list#JsonSchemas',
  get: 'facade.JsonSchemaFacadeServices.get#JsonSchema',
  saveText: 'facade.JsonSchemaFacadeServices.save#JsonSchemaText',
  inferFromText: 'facade.JsonSchemaFacadeServices.infer#JsonSchemaFromText',
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
  listAutomations: 'facade.ReconciliationFacadeServices.list#Automations',
  getAutomation: 'facade.ReconciliationFacadeServices.get#Automation',
  saveAutomation: 'facade.ReconciliationFacadeServices.save#Automation',
  deleteAutomation: 'facade.ReconciliationFacadeServices.delete#Automation',
  runAutomationNow: 'facade.ReconciliationFacadeServices.run#AutomationNow',
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
  deleteAutomation(payload: DeleteAutomationPayload, signal?: AbortSignal): Promise<DeleteAutomationResponse> {
    return callService<DeleteAutomationResponse>(RECONCILIATION.deleteAutomation, payload, signal)
  },
  runAutomationNow(payload: RunAutomationNowPayload, signal?: AbortSignal): Promise<RunAutomationNowResponse> {
    return callService<RunAutomationNowResponse>(RECONCILIATION.runAutomationNow, payload, signal)
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
