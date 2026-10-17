import { reconciliationFacade, settingsFacade } from './facade'
import type { ReadQuery } from './readCache'
import { nsAccountLabels } from '../nsAccountLabel'
import { ALL_RULE_FILTER_KEY, DIFF_BUCKET_ORDER, DIFF_DETAILS_PAGE_SIZE } from '../runResultDiffDetails'

/**
 * DAR-UI-051. The page reads a prefetch can warm, named once. A page and a prefetch that use the same query
 * share one cache entry and one request in flight, so the key and the call must never drift apart: pages
 * build their read from here rather than spelling the call themselves.
 */

type Scope = 'STAGE' | 'FINDING' | undefined

/** Home: every run, grouped and counted on the page. */
export const homeSavedRuns: ReadQuery<Awaited<ReturnType<typeof reconciliationFacade.listSavedRuns>>> = {
  key: 'home.listSavedRuns',
  fetch: (signal) => reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: 100, query: '' }, signal),
}

/** Home: the lifecycle runs beside the Sync ones. */
export const homeReconciliations: ReadQuery<Awaited<ReturnType<typeof reconciliationFacade.listReconciliations>>> = {
  key: 'home.listReconciliations',
  fetch: (signal) => reconciliationFacade.listReconciliations(signal),
}

/** A lifecycle and its NetSuite account names, fetched together: shared by its page, settings and start. */
export function lifecycleChart(reconciliationId: string) {
  return {
    key: `lifecycle.chart:${reconciliationId}`,
    fetch: async () => {
      const [got, accountLabels] = await Promise.all([
        reconciliationFacade.getReconciliation({ reconciliationId }),
        nsAccountLabels(),
      ])
      return { got, accountLabels }
    },
  }
}

/** The rules a lifecycle question can ask, for naming its boxes. */
export const lifecycleRules: ReadQuery<Awaited<ReturnType<typeof reconciliationFacade.listSavedRuns>>> = {
  key: 'lifecycle.listSavedRuns',
  fetch: () => reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: 200 }),
}

export function lifecycleExecutions(reconciliationId: string) {
  return {
    key: `lifecycle.executions:${reconciliationId}`,
    fetch: () => reconciliationFacade.listReconciliationExecutions({ reconciliationId }),
  }
}

export function lifecycleExecution(reconciliationExecutionId: string) {
  return {
    key: `lifecycle.execution:${reconciliationExecutionId}`,
    fetch: () => reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId }),
  }
}

/** A NetSuite record type's fields, as a rule picker offers them. Account metadata: slow to read, rarely changes. */
export function lifecycleRuleFields(source: { nsAuthConfigId: string; recordType: string }, scope?: Scope) {
  return {
    key: `lifecycle.ruleFields:${scope ?? ''}:${source.nsAuthConfigId}:${source.recordType}`,
    fetch: () => reconciliationFacade.getLifecycleRuleOptions({ ...source, ...(scope ? { scope } : {}) }),
  }
}

export const automations: ReadQuery<Awaited<ReturnType<typeof reconciliationFacade.listAutomations>>> = {
  key: 'automations.listAutomations',
  fetch: (signal) => reconciliationFacade.listAutomations({ pageIndex: 0, pageSize: 200, query: '' }, signal),
}

/** An automation and its run history, as its dashboard draws them first. */
export function automationDashboard(automationId: string) {
  return {
    key: `automationDashboard.load:${automationId}`,
    fetch: (signal?: AbortSignal) => Promise.all([
      reconciliationFacade.getAutomation({ automationId }, signal),
      reconciliationFacade.listAutomationExecutions({ automationId, pageIndex: 0, pageSize: 200 }, signal),
    ]),
  }
}

export const RUN_HISTORY_PAGE_SIZE = 6

export function runHistoryPage(savedRunId: string, pageIndex = 0) {
  return {
    key: `runHistory.generatedOutputs:${savedRunId}:${pageIndex}:${RUN_HISTORY_PAGE_SIZE}`,
    fetch: (signal?: AbortSignal) => reconciliationFacade.listGeneratedOutputs({
      savedRunId, pageIndex, pageSize: RUN_HISTORY_PAGE_SIZE, query: '',
    }, signal),
  }
}

/** A run result's first page of differences, with the facets its filters are built from. */
export function runResultFirstPage(fileName: string) {
  const request = {
    fileName,
    pageIndex: 0,
    pageSize: DIFF_DETAILS_PAGE_SIZE,
    buckets: DIFF_BUCKET_ORDER.join(','),
    ruleFilterKey: ALL_RULE_FILTER_KEY,
    search: '',
    includeFacets: true,
  }
  return {
    key: `runResult.differences:${JSON.stringify(request)}`,
    fetch: (signal?: AbortSignal) => reconciliationFacade.getGeneratedOutputDifferences(request, signal),
  }
}

/** useSettingsPagedList appends `:<pageIndex>:<pageSize>` to these; its default page size is 12. */
export const SETTINGS_LIST_KEYS = {
  oms: 'omsRestSettings.listOmsRestSourceConfigs',
  runs: 'runsSettings.listSavedRuns',
  sftp: 'sftpServers.listSftpServers',
  shopify: 'shopifySettings.listShopifyAuthConfigs',
} as const
const SETTINGS_LIST_PAGE_SIZE = 12
const firstSettingsPage = { pageIndex: 0, pageSize: SETTINGS_LIST_PAGE_SIZE }

export const settingsLists = {
  oms: { key: `${SETTINGS_LIST_KEYS.oms}:0:${SETTINGS_LIST_PAGE_SIZE}`, fetch: () => settingsFacade.listOmsRestSourceConfigs(firstSettingsPage) },
  runs: { key: `${SETTINGS_LIST_KEYS.runs}:0:${SETTINGS_LIST_PAGE_SIZE}`, fetch: () => reconciliationFacade.listSavedRuns({ ...firstSettingsPage, query: '' }) },
  sftp: { key: `${SETTINGS_LIST_KEYS.sftp}:0:${SETTINGS_LIST_PAGE_SIZE}`, fetch: () => settingsFacade.listSftpServers(firstSettingsPage) },
  shopify: { key: `${SETTINGS_LIST_KEYS.shopify}:0:${SETTINGS_LIST_PAGE_SIZE}`, fetch: () => settingsFacade.listShopifyAuthConfigs(firstSettingsPage) },
}
