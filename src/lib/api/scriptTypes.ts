// DAR-BE-164. A tenant's scripts (facade.TenantScriptFacadeServices): JEXL written and run in Darpan as data, with no
// code change. EXPRESSION is one expression with no loops; SCRIPT allows statements, loops and lambdas. Both read only
// `input` and the d: library.

export type ScriptProfile = 'EXPRESSION' | 'SCRIPT'
export type ScriptInputSource = 'SAMPLE' | 'RUN_RESULT'

export interface TenantScript {
  tenantScriptId: string
  scriptName: string
  description: string | null
  scriptProfile: ScriptProfile
  inputSource: ScriptInputSource
  scriptBody: string
  sampleInputJson: string | null
  isActive: boolean
  createdByUserId: string | null
  createdDate: string | number | null
  lastUpdatedDate: string | number | null
}

export interface ScriptLibraryFunction {
  name: string
  help: string
}

export interface ScriptProfileLimits {
  maxSourceChars: number
  unitLimit: number
  timeoutMs: number
}

export interface ScriptError {
  kind: string
  message: string
  line?: number
  column?: number
}

export interface ScriptRun {
  ok: boolean
  profile: ScriptProfile | null
  result: unknown
  units: number
  elapsedMs: number
  logs: string[]
  error: ScriptError | null
}

export interface ScriptInputSummary {
  source: ScriptInputSource
  characters?: number
  fileName?: string
  records?: number
  totalDifferences?: number
  truncated?: boolean
}

export interface ListTenantScriptsResponse {
  scripts: TenantScript[]
  library: ScriptLibraryFunction[]
  limits: Partial<Record<ScriptProfile, ScriptProfileLimits>>
}

export interface SaveTenantScriptPayload {
  tenantScriptId?: string
  scriptName: string
  description?: string
  scriptProfile: ScriptProfile
  inputSource: ScriptInputSource
  scriptBody: string
  sampleInputJson?: string
  isActive?: boolean
}

export interface SaveTenantScriptResponse {
  script: TenantScript
}

export interface RunTenantScriptPayload {
  tenantScriptId?: string
  scriptBody?: string
  scriptProfile?: ScriptProfile
  inputSource?: ScriptInputSource
  inputJson?: string
  fileName?: string
}

export interface RunTenantScriptResponse {
  run: ScriptRun
  inputSummary: ScriptInputSummary
}

// DAR-BE-167. A deployment: a saved script run on a schedule (Quartz cron in the tenant's zone), reading the newest
// result of a saved run (or its sample), its returned text posted to a chat space.

export type ScriptDeploymentStatus =
  | 'PREVIEW' | 'SENT' | 'NOTHING_TO_SEND' | 'SCRIPT_ERROR' | 'NO_INPUT' | 'NOT_DELIVERED' | 'SCRIPT_MISSING'

export interface TenantScriptDeployment {
  tenantScriptDeploymentId: string
  tenantScriptId: string
  scheduleExpr: string
  inputSavedRunId: string | null
  chatSpaceId: string
  isActive: boolean
  nextRunDate: string | number | null
  lastRunDate: string | number | null
  lastRunStatus: ScriptDeploymentStatus | null
  lastRunMessage: string | null
  lastRunUnits: number | null
}

export interface ListTenantScriptDeploymentsResponse {
  deployments: TenantScriptDeployment[]
  timeZone: string
}

export interface SaveTenantScriptDeploymentPayload {
  tenantScriptDeploymentId?: string
  tenantScriptId: string
  scheduleExpr: string
  inputSavedRunId?: string
  chatSpaceId: string
  isActive: boolean
}

export interface SaveTenantScriptDeploymentResponse {
  deployment: TenantScriptDeployment
}

export interface ScriptDeploymentOutcome {
  status: ScriptDeploymentStatus
  message: string
  text?: string
  run?: ScriptRun
  inputSummary?: ScriptInputSummary
  fileName?: string | null
}

export interface RunTenantScriptDeploymentResponse {
  outcome: ScriptDeploymentOutcome
  deployment: TenantScriptDeployment
}
