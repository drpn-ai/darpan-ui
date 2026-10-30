// DAR-BE-160. A tenant's audit config kept as versions (facade.TenantConfigFacadeServices): the whole tenant's audits,
// statements, checks, runs, queries, conclusion codes and connections, no secrets. A version is kept a minute after any
// of them changes (SETTINGS_SAVE), on request (MANUAL), and around a restore (RESTORE).

export type ConfigChangeSource = 'MANUAL' | 'SETTINGS_SAVE' | 'AGENT_APPLY' | 'IMPORT' | 'RESTORE'

export interface ConfigVersionCounts {
  audits: number
  statements: number
  checks: number
  runs: number
  queries: number
  conclusionCodes: number
  connections: number
  /** Present on versions kept after darpan's automation versioning; absent (0) before. */
  automations: number
  /** Present on versions kept after darpan's lifecycle versioning; absent (0) before. */
  lifecycles: number
}

export interface ConfigVersion {
  id: string
  seq: number
  parentId: string | null
  hash: string
  bundleVersion: number
  counts: Partial<ConfigVersionCounts>
  changeSource: ConfigChangeSource | string
  reason: string | null
  createdBy: string | null
  /** Full name, else username; absent on a version read alone before 16be6a4. */
  createdByName?: string | null
  /** Moqui sends a Timestamp as epoch millis or an ISO string. */
  createdDate: string | number | null
}

export interface ConfigPlanChange {
  field: string
  from: string | null
  to: string | null
}

export interface ConfigPlanLine {
  kind: string
  ref: string
  label: string | null
  /** CREATE | UPDATE | UNCHANGED | MAPPED | NEEDS_CREDENTIALS */
  action: string
  targetId?: string | null
  changes?: ConfigPlanChange[]
}

export interface ConfigPlanNote {
  code: string
  ref: string | null
  message: string
}

export interface ConfigRestorePlan {
  lines: ConfigPlanLine[]
  blocking: ConfigPlanNote[]
  warnings: ConfigPlanNote[]
  counts?: Record<string, number>
  /** Statements the version does not hold: switched off, not deleted (findings point at them). */
  switchOff: { statementId: string; audit: string | null; statement: string }[]
  /** Check links the version does not hold: removed (a link is config). */
  unlink: { statementId: string; checkId: string; audit: string | null; statement: string; check: string }[]
  /** Runs, automations and lifecycles added since: kept, nothing in the restored config uses them. */
  kept: { kind: string; label: string }[]
}

export interface SnapshotTenantConfigResponse {
  created: boolean
  version: ConfigVersion
}

export interface GetTenantConfigVersionsResponse {
  versions: ConfigVersion[]
}

export interface PreviewTenantConfigRestoreResponse {
  version: ConfigVersion
  plan: ConfigRestorePlan
  planHash: string
}

export interface RestoreTenantConfigVersionResponse {
  restored: boolean
  before: ConfigVersion
  after: ConfigVersion
  plan: ConfigRestorePlan
}
