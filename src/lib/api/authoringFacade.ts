// DAR-UI-064. Audit authoring calls, kept out of facade.ts so this slice stays separable from work in flight there.
import { callService } from './client'
import type {
  AuditCheckDraft,
  AuditCheckStatementLink,
  CreateRunConclusionCodeResponse,
  GetAuditCheckOptionsResponse,
  GetRunConclusionsResponse,
  RunConclusionNode,
  SaveAuditCheckResponse,
  SaveRunConclusionsResponse,
  GetNsSuiteQlQueryOptionsResponse,
  GetNsSuiteQlQueryResponse,
  NsSuiteQlQuery,
  PreviewNsSuiteQlQueryPayload,
  PreviewNsSuiteQlQueryResponse,
  SaveNsSuiteQlQueryResponse,
} from './authoringTypes'

export const NETSUITE_QUERY = {
  getOptions: 'facade.NetSuiteQueryFacadeServices.get#NsSuiteQlQueryOptions',
  get: 'facade.NetSuiteQueryFacadeServices.get#NsSuiteQlSourceQuery',
  save: 'facade.NetSuiteQueryFacadeServices.save#NsSuiteQlSourceQuery',
  preview: 'facade.NetSuiteQueryFacadeServices.preview#NsSuiteQlSourceQuery',
} as const

export const netSuiteQueryFacade = {
  getOptions(signal?: AbortSignal): Promise<GetNsSuiteQlQueryOptionsResponse> {
    return callService<GetNsSuiteQlQueryOptionsResponse>(NETSUITE_QUERY.getOptions, {}, signal)
  },
  get(nsSuiteQlSourceQueryId: string, signal?: AbortSignal): Promise<GetNsSuiteQlQueryResponse> {
    return callService<GetNsSuiteQlQueryResponse>(NETSUITE_QUERY.get, { nsSuiteQlSourceQueryId }, signal)
  },
  save(query: NsSuiteQlQuery, signal?: AbortSignal): Promise<SaveNsSuiteQlQueryResponse> {
    return callService<SaveNsSuiteQlQueryResponse>(NETSUITE_QUERY.save, query, signal)
  },
  /** Reads NetSuite for one day, nothing saved: the first rows as records, and the SuiteQL it sent. */
  preview(payload: PreviewNsSuiteQlQueryPayload, signal?: AbortSignal): Promise<PreviewNsSuiteQlQueryResponse> {
    return callService<PreviewNsSuiteQlQueryResponse>(NETSUITE_QUERY.preview, payload, signal)
  },
}

export const RUN_CONCLUSION = {
  get: 'facade.RunConclusionFacadeServices.get#RunConclusions',
  save: 'facade.RunConclusionFacadeServices.save#RunConclusions',
  createCode: 'facade.RunConclusionFacadeServices.create#RunConclusionCode',
} as const

export const runConclusionFacade = {
  get(savedRunId: string, signal?: AbortSignal): Promise<GetRunConclusionsResponse> {
    return callService<GetRunConclusionsResponse>(RUN_CONCLUSION.get, { savedRunId }, signal)
  },
  /** Replaces the run's whole tree; an empty list clears it. */
  save(savedRunId: string, conclusions: RunConclusionNode[], signal?: AbortSignal): Promise<SaveRunConclusionsResponse> {
    return callService<SaveRunConclusionsResponse>(RUN_CONCLUSION.save, { savedRunId, conclusions }, signal)
  },
  /** A conclusion code of the active tenant's own; refused when its catalog already has the label. */
  createCode(label: string, signal?: AbortSignal): Promise<CreateRunConclusionCodeResponse> {
    return callService<CreateRunConclusionCodeResponse>(RUN_CONCLUSION.createCode, { label }, signal)
  },
}

export const AUDIT_CHECK = {
  getOptions: 'facade.AuditFacadeServices.get#AuditCheckOptions',
  save: 'facade.AuditFacadeServices.save#AuditCheck',
} as const

export const auditCheckFacade = {
  getOptions(audit: string, signal?: AbortSignal): Promise<GetAuditCheckOptionsResponse> {
    return callService<GetAuditCheckOptionsResponse>(AUDIT_CHECK.getOptions, { audit }, signal)
  },
  /** Creates or updates check.id and replaces its links to this audit's statements. */
  save(audit: string, check: AuditCheckDraft, statements: AuditCheckStatementLink[], signal?: AbortSignal): Promise<SaveAuditCheckResponse> {
    return callService<SaveAuditCheckResponse>(AUDIT_CHECK.save, { audit, check, statements }, signal)
  },
}
