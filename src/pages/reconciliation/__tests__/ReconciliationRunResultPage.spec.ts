import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'

const route = vi.hoisted(() => ({
  params: {
    savedRunId: 'RS_ORDER_CSV',
    outputFileName: 'CSV-Order-Compare-diff-20260331-063304.json',
  },
  query: {
    runName: 'CSV Order Compare',
    file1SystemLabel: 'OMS',
    file2SystemLabel: 'SHOPIFY',
  },
  fullPath:
    '/reconciliation/run-result/RS_ORDER_CSV/CSV-Order-Compare-diff-20260331-063304.json?runName=CSV%20Order%20Compare&file1SystemLabel=OMS&file2SystemLabel=SHOPIFY',
}))
const getGeneratedOutput = vi.hoisted(() => vi.fn())
const getGeneratedOutputDifferences = vi.hoisted(() => vi.fn())
const listSavedRuns = vi.hoisted(() => vi.fn())
const saveSavedRunName = vi.hoisted(() => vi.fn())
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const getReconciliationRunStatus = vi.hoisted(() => vi.fn())
const subscribeRunNotification = vi.hoisted(() => vi.fn())
const unsubscribeRunNotification = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const saveUserNotificationDefault = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'editor',
    canRunActiveTenantReconciliation: true,
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
}))

// Server search debounce on the page; tests wait slightly longer than this before asserting.
const SEARCH_DEBOUNCE_WAIT = 360

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
  },
  useRoute: () => route,
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    getGeneratedOutput,
    getGeneratedOutputDifferences,
    listSavedRuns,
    saveSavedRunName,
    listGeneratedOutputs,
    getReconciliationRunStatus,
    subscribeRunNotification,
    unsubscribeRunNotification,
  },
  settingsFacade: {
    listTenantChatSpaces,
    saveUserNotificationDefault,
  },
}))

vi.mock('../../../lib/auth', () => ({
  useUiPermissions: () => permissionsShape,
}))

const permissionsShape = {
    get canRunActiveTenantReconciliation() {
      return authState.sessionInfo.canRunActiveTenantReconciliation === true ||
        authState.sessionInfo.canEditActiveTenantData === true ||
        authState.sessionInfo.isSuperAdmin === true
    },
    get canEditTenantSettings() {
      return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
    },
    get canManageGlobalSettings() {
      return authState.sessionInfo.isSuperAdmin === true
    },
    get canViewTenantSettings() {
      return Boolean(authState.sessionInfo.userId)
    },
}

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsShape,
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => ({
    workflowOrigin: null,
    ruleSetDraftState: null,
    automationDraftState: null,
    setWorkflowOrigin: vi.fn(),
    clearWorkflowOrigin: vi.fn(),
    setRuleSetDraft: vi.fn(),
    clearRuleSetDraft: vi.fn(),
    setAutomationDraft: vi.fn(),
    clearAutomationDraft: vi.fn(),
  }),
}))

import ReconciliationRunResultPage from '../ReconciliationRunResultPage.vue'
import { useRunResultsStore } from '../../../stores/runResults'

function buildGeneratedOutputFile(contentText: string, outputFileOverrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    messages: [],
    errors: [],
    outputFile: {
      fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
      downloadFileName: 'CSV-Order-Compare-diff-20260331-063304.json',
      sourceFormat: 'json',
      format: 'json',
      contentType: 'application/json',
      contentText,
      ...outputFileOverrides,
    },
  }
}

// ---------------------------------------------------------------------------
// Server simulator: a faithful port of the backend DiffDetailClassifier so the
// paginated get#GeneratedOutputDifferences mock reproduces real classification,
// faceting, filtering, and paging from a full diff-document fixture (audit #21).
// ---------------------------------------------------------------------------

const BUCKET_ORDER = ['file-1', 'file-2', 'rule']
const BASE_RULE_FILTER_KEY = 'base-diff'
const ALL_RULE_FILTER_KEY = 'all'

type Rec = Record<string, unknown>

function sNormalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
function sNormalizeToken(value: unknown): string {
  return sNormalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
function sResolveDiffType(record: Rec): string {
  return sNormalizeText(record.diffType || record.type)
}
function sFirstRecordValue(record: unknown, keys: string[]): unknown {
  if (!record || typeof record !== 'object') return undefined
  const source = record as Rec
  return keys.map((key) => source[key]).find((value) => value != null && String(value).trim())
}
function sParseDiffData(rawData: unknown): unknown {
  if (typeof rawData !== 'string') return rawData
  try {
    return JSON.parse(rawData)
  } catch {
    return rawData
  }
}
function sResolveDiffRecordId(record: Rec, rowIndex: number): string {
  if (record.id != null && String(record.id).trim()) return String(record.id).trim()
  if (record.primaryId != null && String(record.primaryId).trim()) return String(record.primaryId).trim()
  const candidate = sFirstRecordValue(record.data, ['primaryId', 'record_id', 'recordId', 'compare_id', 'compareId', 'id'])
  if (candidate != null) return String(candidate).trim()
  return `row-${rowIndex + 1}`
}
function sResolveMissingBucket(record: Rec, file1Label: string, file2Label: string): string {
  const missingToken = sNormalizeToken(record.missingIn)
  const file1Token = sNormalizeToken(file1Label)
  const file2Token = sNormalizeToken(file2Label)
  const typeToken = sNormalizeToken(sResolveDiffType(record))
  const presentToken = sNormalizeToken(record.presentIn)
  if (missingToken && missingToken === file1Token) return 'file-1'
  if (missingToken && missingToken === file2Token) return 'file-2'
  if (file1Token && typeToken.includes(`missing_in_${file1Token}`)) return 'file-1'
  if (file2Token && typeToken.includes(`missing_in_${file2Token}`)) return 'file-2'
  if (presentToken && presentToken === file1Token) return 'file-2'
  if (presentToken && presentToken === file2Token) return 'file-1'
  return 'rule'
}
function sIsMissing(record: Rec): boolean {
  const typeToken = sNormalizeToken(sResolveDiffType(record))
  return Boolean(record.missingIn || record.presentIn || typeToken.startsWith('missing_in_'))
}
function sResolveBucket(record: Rec, file1Label: string, file2Label: string): string {
  return sIsMissing(record) ? sResolveMissingBucket(record, file1Label, file2Label) : 'rule'
}
function sHumanize(ruleId: string): string {
  const normalized = sNormalizeText(ruleId)
  if (!normalized) return 'Rule difference'
  return normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}
function sRuleOptionLabel(ruleId: string, fallbackIndex: number): string {
  const normalized = sNormalizeText(ruleId)
  const numbered = normalized.match(/(?:^|[_\-\s])rule[_\-\s]*(\d+)$/i) ?? normalized.match(/(?:^|[_\-\s])(\d+)$/)
  if (numbered?.[1]) return `Rule ${Number(numbered[1])}`
  return `Rule ${fallbackIndex}`
}
function sRuleRowDetail(record: Rec, fallbackRuleId: string): string {
  return (
    sNormalizeText(record.ruleLabel) ||
    sNormalizeText(record.ruleName) ||
    sNormalizeText(record.ruleDescription) ||
    sNormalizeText(record.field) ||
    sNormalizeText(record.message) ||
    sHumanize(fallbackRuleId)
  )
}
function sRuleDescriptor(record: Rec, bucket: string, rowIndex: number) {
  if (bucket !== 'rule') {
    return { ruleFilterKey: BASE_RULE_FILTER_KEY, ruleId: BASE_RULE_FILTER_KEY, ruleLabel: 'Base comparison' }
  }
  const ruleId =
    sNormalizeText(record.ruleId) || sNormalizeText(record.ruleName) || sResolveDiffType(record) || `rule-${rowIndex + 1}`
  const ruleFilterKey = sNormalizeToken(ruleId) || `rule_${rowIndex + 1}`
  return { ruleFilterKey, ruleId, ruleLabel: sRuleRowDetail(record, ruleId) }
}
function sClassify(record: Rec, index: number, file1Label: string, file2Label: string) {
  const bucket = sResolveBucket(record, file1Label, file2Label)
  const descriptor = sRuleDescriptor(record, bucket, index)
  const withParsed = { ...record, data: sParseDiffData(record.data) }
  const recordId = sResolveDiffRecordId(withParsed, index)
  return { rowKey: `${bucket}-${recordId}-${index}`, recordId, bucket, ...descriptor, record }
}
function sBucketCounts(rows: ReturnType<typeof sClassify>[]) {
  const counts: Record<string, number> = { 'file-1': 0, 'file-2': 0, rule: 0 }
  rows.forEach((row) => {
    const current = counts[row.bucket]
    if (current != null) counts[row.bucket] = current + 1
  })
  return counts
}
function sRuleOptions(rows: ReturnType<typeof sClassify>[]) {
  const baseRows = rows.filter((row) => row.ruleFilterKey === BASE_RULE_FILTER_KEY)
  const ruleEntries = new Map<string, { key: string; ruleId: string; detail: string; count: number; bucketKeys: Set<string> }>()
  rows.forEach((row) => {
    if (row.ruleFilterKey === BASE_RULE_FILTER_KEY) return
    const existing = ruleEntries.get(row.ruleFilterKey)
    if (existing) {
      existing.count += 1
      existing.bucketKeys.add(row.bucket)
      if (!existing.detail && row.ruleLabel) existing.detail = row.ruleLabel
      return
    }
    ruleEntries.set(row.ruleFilterKey, {
      key: row.ruleFilterKey,
      ruleId: row.ruleId,
      detail: row.ruleLabel,
      count: 1,
      bucketKeys: new Set([row.bucket]),
    })
  })
  const options: Array<{ key: string; label: string; detail: string; count: number; bucketKeys: string[] }> = []
  if (baseRows.length > 0) {
    const baseBuckets = BUCKET_ORDER.filter((bucket) => baseRows.some((row) => row.bucket === bucket))
    options.push({
      key: BASE_RULE_FILTER_KEY,
      label: 'Rule 0',
      detail: 'Base comparison',
      count: baseRows.length,
      bucketKeys: baseBuckets.length > 0 ? baseBuckets : ['file-1', 'file-2'],
    })
  }
  Array.from(ruleEntries.values()).forEach((entry, index) => {
    options.push({
      key: entry.key,
      label: sRuleOptionLabel(entry.ruleId, index + 1),
      detail: entry.detail || sHumanize(entry.ruleId),
      count: entry.count,
      bucketKeys: BUCKET_ORDER.filter((bucket) => entry.bucketKeys.has(bucket)),
    })
  })
  return options
}
function sEffectiveSummary(document: Rec, file1Label: string, file2Label: string) {
  const differences = (document.differences ?? []) as Rec[]
  const fileSummary = (document.summary ?? {}) as Rec
  let onlyInFile1Count = 0
  let onlyInFile2Count = 0
  differences.forEach((record) => {
    const bucket = sResolveMissingBucket(record, file1Label, file2Label)
    if (bucket === 'file-1') onlyInFile2Count += 1
    else if (bucket === 'file-2') onlyInFile1Count += 1
  })
  return {
    totalDifferences: fileSummary.totalDifferences != null ? fileSummary.totalDifferences : differences.length,
    onlyInFile1Count: fileSummary.onlyInFile1Count != null ? fileSummary.onlyInFile1Count : onlyInFile1Count,
    onlyInFile2Count: fileSummary.onlyInFile2Count != null ? fileSummary.onlyInFile2Count : onlyInFile2Count,
    ruleDifferenceCount: fileSummary.ruleDifferenceCount ?? null,
    missingObjectDifferenceCount: fileSummary.missingObjectDifferenceCount ?? null,
  }
}

interface DifferencesQuery {
  fileName: string
  pageIndex?: number
  pageSize?: number
  buckets?: string
  ruleFilterKey?: string
  search?: string
  includeFacets?: boolean
}

function simulateDifferences(document: Rec, outputFileOverrides: Record<string, unknown> = {}) {
  return async (payload: DifferencesQuery) => {
    const metadata = (document.metadata ?? {}) as Rec
    const file1Label = sNormalizeText(metadata.file1Label) || 'File 1'
    const file2Label = sNormalizeText(metadata.file2Label) || 'File 2'
    const differences = (document.differences ?? []) as Rec[]
    const classified = differences.map((record, index) => sClassify(record, index, file1Label, file2Label))

    const requestedBuckets = (payload.buckets ?? '').split(',').map((token) => token.trim()).filter(Boolean)
    const activeBuckets = requestedBuckets.length > 0 ? BUCKET_ORDER.filter((b) => requestedBuckets.includes(b)) : [...BUCKET_ORDER]
    const ruleKey = sNormalizeText(payload.ruleFilterKey) || ALL_RULE_FILTER_KEY
    const search = (payload.search ?? '').trim().toLowerCase()

    const filtered = classified.filter((row) => {
      if (!activeBuckets.includes(row.bucket)) return false
      if (ruleKey !== ALL_RULE_FILTER_KEY && row.ruleFilterKey !== ruleKey) return false
      if (search && !row.recordId.toLowerCase().includes(search)) return false
      return true
    })

    const pageSize = Math.max(1, payload.pageSize ?? 50)
    const totalFiltered = filtered.length
    const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize))
    const pageIndex = Math.min(Math.max(payload.pageIndex ?? 0, 0), pageCount - 1)
    const start = pageIndex * pageSize
    const pageRows = filtered.slice(start, start + pageSize)

    const includeFacets = payload.includeFacets !== false
    return {
      ok: true,
      messages: [],
      errors: [],
      metadata,
      summary: sEffectiveSummary(document, file1Label, file2Label),
      ...(includeFacets ? { bucketCounts: sBucketCounts(classified), ruleOptions: sRuleOptions(classified) } : {}),
      differences: pageRows,
      pageIndex,
      pageSize,
      pageCount,
      totalDifferences: classified.length,
      totalFiltered,
      outputFile: {
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        downloadFileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        sourceFormat: 'json',
        format: 'json',
        contentType: 'application/json',
        ...outputFileOverrides,
      },
    }
  }
}

const defaultDiffDetails = {
  metadata: {
    timestamp: '2026-03-31 08:11:06.134',
    file1Label: 'OMS',
    file2Label: 'SHOPIFY',
    savedRunId: 'RS_ORDER_CSV',
    savedRunName: 'CSV Order Compare',
    savedRunType: 'ruleset',
    ruleSetId: 'RS_ORDER_CSV',
    compareScopeId: 'CS_ORDER_CSV',
  },
  summary: {
    totalDifferences: 2,
    onlyInFile1Count: 1,
    onlyInFile2Count: 1,
  },
  differences: [
    {
      type: 'missing_in_SHOPIFY',
      id: '1001',
      presentIn: 'OMS',
      missingIn: 'SHOPIFY',
      data: '{"order_id":"1001"}',
    },
    {
      type: 'missing_in_OMS',
      id: '1003',
      presentIn: 'SHOPIFY',
      missingIn: 'OMS',
      data: '{"order_id":"1003"}',
    },
  ],
}

const defaultSourceDetails = {
  mode: 'FILES',
  files: [
    {
      side: 'file1',
      label: 'OMS',
      fileName: 'orders-1.csv',
      filePath: 'reconciliation-runs/RS_ORDER_CSV/20260331-081106134/RS_ORDER_CSV_file1_orders-1.csv',
      downloadFileName: 'orders-1.csv',
      sourceFormat: 'csv',
      canDownload: true,
    },
    {
      side: 'file2',
      label: 'SHOPIFY',
      fileName: 'orders-2.csv',
      filePath: 'reconciliation-runs/RS_ORDER_CSV/20260331-081106134/RS_ORDER_CSV_file2_orders-2.csv',
      downloadFileName: 'orders-2.csv',
      sourceFormat: 'csv',
      canDownload: true,
    },
  ],
}

function buildSavedRunSummary() {
  return {
    savedRunId: 'RS_ORDER_CSV',
    runName: 'CSV Order Compare',
    description: 'CSV Order Compare',
    runType: 'ruleset',
    ruleSetId: 'RS_ORDER_CSV',
    compareScopeId: 'CS_ORDER_CSV',
    requiresSystemSelection: false,
    defaultFile1SystemEnumId: 'OMS',
    defaultFile2SystemEnumId: 'SHOPIFY',
    systemOptions: [
      {
        fileSide: 'FILE_1',
        enumId: 'OMS',
        label: 'OMS',
        fileTypeEnumId: 'DftCsv',
        idFieldExpression: 'order_id',
      },
      {
        fileSide: 'FILE_2',
        enumId: 'SHOPIFY',
        label: 'SHOPIFY',
        fileTypeEnumId: 'DftCsv',
        idFieldExpression: 'id',
      },
    ],
    rules: [
      {
        ruleId: 'RS_ORDER_CSV_RULE_1',
        sequenceNum: 1,
        file1FieldPath: 'total',
        file2FieldPath: 'current_total',
        operator: '=',
      },
    ],
  }
}

describe('ReconciliationRunResultPage', () => {
  beforeEach(() => {
    authState.sessionInfo = {
      userId: 'editor',
      canRunActiveTenantReconciliation: true,
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }
    route.params.savedRunId = 'RS_ORDER_CSV'
    route.params.outputFileName = 'CSV-Order-Compare-diff-20260331-063304.json'
    route.query.runName = 'CSV Order Compare'
    route.query.file1SystemLabel = 'OMS'
    route.query.file2SystemLabel = 'SHOPIFY'
    route.fullPath =
      '/reconciliation/run-result/RS_ORDER_CSV/CSV-Order-Compare-diff-20260331-063304.json?runName=CSV%20Order%20Compare&file1SystemLabel=OMS&file2SystemLabel=SHOPIFY'

    useRunResultsStore().reset()
    listGeneratedOutputs.mockReset()
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 0, pageCount: 0 },
      generatedOutputs: [],
    })
    getReconciliationRunStatus.mockReset()
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_SUCCESS', steps: [] })
    subscribeRunNotification.mockReset()
    unsubscribeRunNotification.mockReset()
    listTenantChatSpaces.mockReset()
    saveUserNotificationDefault.mockReset()
    getGeneratedOutput.mockReset()
    getGeneratedOutputDifferences.mockReset()
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences(defaultDiffDetails, { sourceDetails: defaultSourceDetails }))
    saveSavedRunName.mockReset()
    listSavedRuns.mockReset()
    listSavedRuns.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 100,
        totalCount: 1,
        pageCount: 1,
      },
      savedRuns: [buildSavedRunSummary()],
    })
    routerPush.mockReset()
    saveSavedRunName.mockResolvedValue({
      ok: true,
      messages: ['Saved run CSV Order Compare Revised.'],
      errors: [],
      savedRun: {
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare Revised',
        runType: 'ruleset',
        requiresSystemSelection: false,
        systemOptions: [],
      },
    })
  })

  it('loads saved result details on the static surface and links back to history and workflow', async () => {
    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(getGeneratedOutputDifferences).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        pageIndex: 0,
        includeFacets: true,
      }),
      expect.any(AbortSignal),
    )
    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.find('.wizard-progress-track').exists()).toBe(false)
    expect(wrapper.text()).toContain('CSV Order Compare')
    const editableTitle = wrapper.get('[data-testid="run-result-title"]')
    expect(editableTitle.element.tagName).toBe('H1')
    expect(editableTitle.attributes('contenteditable')).toBe('plaintext-only')
    expect(editableTitle.attributes('aria-label')).toBe('Run name')
    expect(editableTitle.classes()).toContain('static-page-inline-edit-title')
    const sourceDetails = wrapper.get('[data-testid="run-result-source-details"]')
    expect(sourceDetails.text()).toContain('Source files')
    expect(sourceDetails.text()).toContain('OMS')
    expect(sourceDetails.text()).toContain('orders-1.csv')
    expect(sourceDetails.text()).toContain('SHOPIFY')
    expect(sourceDetails.text()).toContain('orders-2.csv')
    expect(sourceDetails.findAll('[data-testid="run-result-source-download"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Missing from OMS')
    expect(wrapper.text()).toContain('Missing from SHOPIFY')
    expect(wrapper.find('[data-testid="diff-bucket-rule"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Rule differences')
    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('{ ... }')
    expect(wrapper.text()).toContain('1 key')
    expect(wrapper.get('[data-testid="run-result-download"]').attributes('aria-label')).toBe('Download saved result')
    const tableColumns = wrapper.findAll('.app-table colgroup col')
    expect(tableColumns).toHaveLength(3)
    expect(tableColumns[0]?.attributes('style')).toContain('width: 13rem;')
    expect(tableColumns[2]?.classes()).toContain('app-table__action-column')
    expect(wrapper.find('.static-page-board [data-testid="run-result-view-history"]').exists()).toBe(false)
    const footerActions = wrapper.findAll('.static-page-actions .action-row > *')
    expect(footerActions.map((action) => action.attributes('data-testid'))).toEqual([
      'run-result-open-workflow',
      'run-result-view-history',
      'run-result-open-settings',
    ])
    const viewHistoryAction = wrapper.get('.static-page-actions [data-testid="run-result-view-history"]')
    expect(viewHistoryAction.classes()).toContain('app-icon-action')
    expect(viewHistoryAction.classes()).toContain('app-icon-action--large')
    expect(viewHistoryAction.attributes('aria-label')).toBe('View previous runs')
    expect(viewHistoryAction.text()).not.toContain('View all previous runs')
    expect(viewHistoryAction.get('svg').attributes('viewBox')).toBe('0 0 20 20')
    expect(JSON.parse(viewHistoryAction.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-history',
      params: {
        savedRunId: 'RS_ORDER_CSV',
      },
      query: {
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })
    expect(wrapper.find('.static-page-board [data-testid="run-result-open-workflow"]').exists()).toBe(false)
    const openWorkflowAction = wrapper.get('.static-page-actions [data-testid="run-result-open-workflow"]')
    expect(openWorkflowAction.classes()).toContain('app-icon-action')
    expect(openWorkflowAction.classes()).toContain('app-icon-action--large')
    expect(openWorkflowAction.attributes('aria-label')).toBe('Open run')
    expect(openWorkflowAction.find('svg').exists()).toBe(true)
    expect(openWorkflowAction.text()).not.toContain('Open Run')
    expect(JSON.parse(openWorkflowAction.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-diff',
      query: {
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      }
    })
    expect(wrapper.find('.static-page-board [data-testid="run-result-open-settings"]').exists()).toBe(false)
    const openSettingsAction = wrapper.get('.static-page-actions [data-testid="run-result-open-settings"]')
    expect(openSettingsAction.classes()).toContain('app-icon-action')
    expect(openSettingsAction.classes()).toContain('app-icon-action--large')
    expect(openSettingsAction.attributes('aria-label')).toBe('Run settings')
    expect(openSettingsAction.find('svg').exists()).toBe(true)
    const settingsIcon = openSettingsAction.get('svg')
    expect(settingsIcon.attributes('viewBox')).toBe('0 0 24 24')
    expect(settingsIcon.attributes('fill')).toBe('none')
    expect(settingsIcon.attributes('stroke')).toBe('currentColor')
    expect(settingsIcon.attributes('stroke-width')).toBe('1.8')
    expect(openSettingsAction.get('circle').attributes('r')).toBe('3')
    expect(openSettingsAction.text()).not.toContain('Run settings')
    expect(openSettingsAction.element.tagName).toBe('BUTTON')

    await openSettingsAction.trigger('click')
    await flushPromises()

    expect(listSavedRuns).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 100,
      query: '',
    })
    expect(routerPush).toHaveBeenCalledWith(expect.objectContaining({
      name: 'reconciliation-ruleset-manager',
    }))

    editableTitle.element.textContent = 'CSV Order Compare Revised'
    await editableTitle.trigger('input')
    await editableTitle.trigger('blur')
    await flushPromises()

    expect(saveSavedRunName).toHaveBeenCalledWith({
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare Revised',
    })
  })

  it('renders API date range source details and downloads compared source files', async () => {
    const createObjectUrl = vi.fn(() => 'blob:source')
    const revokeObjectUrl = vi.fn()
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal(
      'URL',
      {
        createObjectURL: createObjectUrl,
        revokeObjectURL: revokeObjectUrl,
      } as unknown as typeof URL,
    )
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences(defaultDiffDetails, {
      sourceDetails: {
        mode: 'API',
        dateRange: {
          start: '2026-05-01T04:00:00Z',
          end: '2026-05-02T04:00:00Z',
        },
        files: [
          {
            side: 'file1',
            label: 'HotWax',
            fileName: 'HotWax-orders-api.json',
            filePath: 'reconciliation-runs/RS_API_ORDER_SYNC/20260502-054559147/RS_API_ORDER_SYNC_file1_HotWax-orders-api.json',
            downloadFileName: 'HotWax-orders-api.json',
            sourceFormat: 'json',
            canDownload: true,
          },
          {
            side: 'file2',
            label: 'SHOPIFY',
            fileName: 'SHOPIFY-orders-api.json',
            filePath: 'reconciliation-runs/RS_API_ORDER_SYNC/20260502-054559147/RS_API_ORDER_SYNC_file2_SHOPIFY-orders-api.json',
            downloadFileName: 'SHOPIFY-orders-api.json',
            sourceFormat: 'json',
            canDownload: true,
          },
        ],
      },
    }))
    getGeneratedOutput.mockResolvedValueOnce(buildGeneratedOutputFile('{"orders":[]}', {
      fileName: 'reconciliation-runs/RS_API_ORDER_SYNC/20260502-054559147/RS_API_ORDER_SYNC_file1_HotWax-orders-api.json',
      downloadFileName: 'HotWax-orders-api.json',
      sourceFormat: 'json',
      format: 'json',
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    const sourceDetails = wrapper.get('[data-testid="run-result-source-details"]')
    expect(sourceDetails.text()).toContain('API date range')
    // Single-day API run: dateRange.end is an exclusive next-day boundary (start=May 1, end=May 2),
    // so the label collapses to the one covered date instead of reading as a two-day range.
    expect(sourceDetails.text()).toContain('May 1, 2026')
    expect(sourceDetails.text()).not.toContain('May 1, 2026 to May 2, 2026')
    expect(sourceDetails.text()).toContain('Files compared')
    expect(sourceDetails.text()).toContain('HotWax')
    expect(sourceDetails.text()).toContain('HotWax-orders-api.json')
    expect(sourceDetails.text()).toContain('SHOPIFY-orders-api.json')

    await sourceDetails.findAll('[data-testid="run-result-source-download"]')[0]!.trigger('click')
    await flushPromises()

    expect(getGeneratedOutput).toHaveBeenLastCalledWith({
      fileName: 'reconciliation-runs/RS_API_ORDER_SYNC/20260502-054559147/RS_API_ORDER_SYNC_file1_HotWax-orders-api.json',
      format: 'json',
    })
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:source')
  })

  it('downloads the saved result on demand instead of retaining the loaded payload copy', async () => {
    const createObjectUrl = vi.fn(() => 'blob:result')
    const revokeObjectUrl = vi.fn()
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal(
      'URL',
      {
        createObjectURL: createObjectUrl,
        revokeObjectURL: revokeObjectUrl,
      } as unknown as typeof URL,
    )
    getGeneratedOutput.mockResolvedValueOnce(buildGeneratedOutputFile('{"download":true}', {
      downloadFileName: 'downloaded-result.json',
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-result-download"]').trigger('click')
    await flushPromises()

    // The diff page is loaded via the paginated service; the full file is only fetched on explicit download.
    expect(getGeneratedOutput).toHaveBeenCalledTimes(1)
    expect(getGeneratedOutput).toHaveBeenLastCalledWith({
      fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
      format: 'json',
    })
    expect(createObjectUrl).toHaveBeenCalledTimes(1)
    expect(anchorClick).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:result')

    anchorClick.mockRestore()
  })

  it('does not stringify every object detail while rendering a large saved result page', async () => {
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences({
      metadata: defaultDiffDetails.metadata,
      summary: {
        totalDifferences: 6,
        onlyInFile1Count: 6,
        onlyInFile2Count: 0,
      },
      differences: Array.from({ length: 6 }, (_item, index) => ({
        type: 'missing_in_SHOPIFY',
        id: `30${index}`,
        presentIn: 'OMS',
        missingIn: 'SHOPIFY',
        data: JSON.stringify({ order_id: `30${index}` }),
      })),
    }))
    const stringifySpy = vi.spyOn(JSON, 'stringify')

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(5)
    const eagerDetailStringifyCalls = stringifySpy.mock.calls.filter(([value, , space]) =>
      space === 2 &&
      value !== null &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'order_id'),
    )
    expect(eagerDetailStringifyCalls).toHaveLength(0)

    stringifySpy.mockRestore()
  })

  it('filters and paginates saved diff details', async () => {
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences({
      metadata: defaultDiffDetails.metadata,
      summary: {
        totalDifferences: 7,
        onlyInFile1Count: 4,
        onlyInFile2Count: 3,
      },
      differences: [
        { type: 'missing_in_OMS', id: '2001', presentIn: 'SHOPIFY', missingIn: 'OMS', data: '{"order_id":"2001"}' },
        { type: 'missing_in_OMS', id: '2002', presentIn: 'SHOPIFY', missingIn: 'OMS', data: '{"order_id":"2002"}' },
        { type: 'missing_in_OMS', id: '2003', presentIn: 'SHOPIFY', missingIn: 'OMS', data: '{"order_id":"2003"}' },
        { type: 'missing_in_SHOPIFY', id: '3001', presentIn: 'OMS', missingIn: 'SHOPIFY', data: '{"order_id":"3001"}' },
        { type: 'missing_in_SHOPIFY', id: '3002', presentIn: 'OMS', missingIn: 'SHOPIFY', data: '{"order_id":"3002"}' },
        { type: 'missing_in_SHOPIFY', id: '3003', presentIn: 'OMS', missingIn: 'SHOPIFY', data: '{"order_id":"3003"}' },
        { type: 'missing_in_SHOPIFY', id: '3004', presentIn: 'OMS', missingIn: 'SHOPIFY', data: '{"order_id":"3004"}' },
      ],
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(5)
    expect(wrapper.text()).toContain('Page 1 of 2')
    expect(wrapper.text()).not.toContain('3004')

    await wrapper.get('[data-testid="diff-page-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Page 2 of 2')
    expect(wrapper.text()).toContain('3004')

    await wrapper.get('[data-testid="diff-details-search"]').setValue('2002')
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_WAIT))
    await flushPromises()

    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('2002')
    expect(wrapper.text()).toContain('Page 1 of 1')
    expect(wrapper.find('[data-testid="diff-details-search-clear"]').exists()).toBe(true)

    await wrapper.get('[data-testid="diff-details-search-clear"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_WAIT))
    await flushPromises()

    expect((wrapper.get('[data-testid="diff-details-search"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(5)
    expect(wrapper.text()).toContain('Page 1 of 2')
  })

  it('renders rule difference rows with primary ids and diff metadata instead of empty JSON objects', async () => {
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences({
      metadata: defaultDiffDetails.metadata,
      summary: {
        totalDifferences: 3,
        onlyInFile1Count: 1,
        onlyInFile2Count: 1,
        missingObjectDifferenceCount: 2,
        ruleDifferenceCount: 1,
      },
      differences: [
        defaultDiffDetails.differences[0],
        defaultDiffDetails.differences[1],
        {
          diffType: 'FIELD_MISMATCH',
          primaryId: '6678202450051',
          field: 'grand_total = total_amount',
          file1Value: '89.89',
          file2Value: '90.32',
          ruleId: 'FIELD_COMPARISON_1',
          severity: 'WARN',
          message: 'Field comparison failed: grand_total = total_amount',
        },
      ],
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Rule differences')
    expect(wrapper.text()).toContain('6678202450051')
    expect(wrapper.text()).toContain('{ ... }')
    expect(wrapper.text()).toContain('8 keys')

    const ruleDetailRow = wrapper.findAll('[data-testid="diff-details-row"]').find((row) => row.text().includes('6678202450051'))
    const ruleDetailToggle = ruleDetailRow?.find('[data-testid="json-collapse-toggle"]')
    expect(ruleDetailToggle).toBeTruthy()

    await ruleDetailToggle!.trigger('click')

    expect(wrapper.text()).toContain('"diffType": "FIELD_MISMATCH"')
    expect(wrapper.text()).toContain('"field": "grand_total = total_amount"')
    expect(wrapper.text()).toContain('"file1Value": "89.89"')
    expect(wrapper.text()).toContain('"file2Value": "90.32"')
    expect(wrapper.text()).not.toContain('row-3')
    expect(wrapper.text()).not.toContain('{}')
  })

  it('renders diff JSON collapsed by default with bracket-level expand controls', async () => {
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences({
      metadata: defaultDiffDetails.metadata,
      summary: {
        totalDifferences: 1,
        onlyInFile1Count: 1,
        onlyInFile2Count: 0,
      },
      differences: [
        {
          type: 'missing_in_SHOPIFY',
          id: '6550852436099',
          presentIn: 'OMS',
          missingIn: 'SHOPIFY',
          data: JSON.stringify({
            _entity: 'org.apache.ofbiz.order.order.OrderHeader',
            adjustments: [
              {
                orderAdjustmentId: 'M263327',
                amount: 7.5,
              },
              {
                orderAdjustmentId: 'M263328',
                amount: 0.31,
              },
            ],
          }),
        },
      ],
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="json-collapse-viewer"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('{ ... }')
    expect(wrapper.text()).toContain('2 keys')
    expect(wrapper.text()).not.toContain('"adjustments": [')
    expect(wrapper.text()).not.toContain('"orderAdjustmentId": "M263327"')

    const rootToggle = wrapper.findAll('[data-testid="json-collapse-toggle"]').find((button) =>
      button.attributes('aria-label') === 'Expand JSON object'
    )
    expect(rootToggle).toBeTruthy()
    expect(rootToggle?.attributes('aria-expanded')).toBe('false')

    await rootToggle!.trigger('click')

    expect(wrapper.text()).toContain('"adjustments": [')
    expect(wrapper.text()).toContain('2 items')
    expect(wrapper.text()).not.toContain('"orderAdjustmentId": "M263327"')

    const collapsedAdjustmentsToggle = wrapper.findAll('[data-testid="json-collapse-toggle"]').find((button) =>
      button.attributes('aria-label') === 'Expand adjustments array'
    )
    expect(collapsedAdjustmentsToggle?.attributes('aria-expanded')).toBe('false')

    await collapsedAdjustmentsToggle!.trigger('click')

    const firstAdjustmentToggle = wrapper.findAll('[data-testid="json-collapse-toggle"]').find((button) =>
      button.attributes('aria-label') === 'Expand item 1 object'
    )
    expect(firstAdjustmentToggle?.attributes('aria-expanded')).toBe('false')

    await firstAdjustmentToggle!.trigger('click')

    expect(wrapper.text()).toContain('"orderAdjustmentId": "M263327"')
  })

  it('shows a collapsible rule selector that filters result rows by rule', async () => {
    getGeneratedOutputDifferences.mockImplementation(simulateDifferences({
      metadata: defaultDiffDetails.metadata,
      summary: {
        totalDifferences: 4,
        onlyInFile1Count: 1,
        onlyInFile2Count: 1,
        missingObjectDifferenceCount: 2,
        ruleDifferenceCount: 2,
      },
      differences: [
        defaultDiffDetails.differences[0],
        defaultDiffDetails.differences[1],
        {
          diffType: 'FIELD_MISMATCH',
          primaryId: '1002',
          field: 'OMS order id = Shopify order id',
          file1Value: '1002',
          file2Value: 'gid://shopify/Order/1002',
          ruleId: 'ORDER_ID_MATCH',
          severity: 'WARN',
        },
        {
          diffType: 'FIELD_MISMATCH',
          primaryId: '1004',
          field: 'Payment total = Shopify total',
          file1Value: '40.00',
          file2Value: '42.00',
          ruleId: 'PAYMENT_TOTAL_MATCH',
          severity: 'WARN',
        },
      ],
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    const selector = wrapper.get('[data-testid="run-result-rule-selector"]')
    expect(selector.element.closest('.static-page-section')).toBeNull()
    expect(selector.element.closest('.static-page-frame')).toBeNull()
    expect(wrapper.get('[data-testid="run-result-rule-selector-toggle"]').text()).toBe('')
    expect(wrapper.find('[data-testid="run-result-rule-list"]').exists()).toBe(true)
    expect(selector.text()).not.toContain('Rule Selector')
    expect(selector.text()).toContain('Rule 0')
    expect(selector.text()).toContain('Base comparison')
    expect(selector.text()).toContain('Rule 1')
    expect(selector.text()).toContain('OMS order id = Shopify order id')
    expect(selector.text()).toContain('Rule 2')
    expect(selector.text()).toContain('Payment total = Shopify total')
    expect(wrapper.find('[data-testid="diff-bucket-file-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-bucket-file-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-bucket-rule"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(4)

    await selector.get('[data-rule-filter-key="order_id_match"]').trigger('click')
    await flushPromises()

    const selectedRuleTotal = wrapper.get('[data-testid="diff-bucket-total-results"]')
    expect(selectedRuleTotal.element.tagName).toBe('DIV')
    expect(selectedRuleTotal.text()).toContain('Total results')
    expect(selectedRuleTotal.text()).toContain('1')
    expect(wrapper.find('[data-testid="diff-bucket-file-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diff-bucket-file-2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diff-bucket-rule"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('1002')
    expect(wrapper.text()).not.toContain('1004')
    expect(wrapper.text()).not.toContain('"order_id": "1001"')
    expect(selector.get('[data-rule-filter-key="order_id_match"]').attributes('aria-pressed')).toBe('true')

    await selector.get('[data-rule-filter-key="base-diff"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="diff-bucket-total-results"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diff-bucket-file-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-bucket-file-2"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diff-bucket-rule"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('{ ... }')
    expect(wrapper.text()).toContain('1 key')
    expect(wrapper.text()).not.toContain('1002')

    await selector.get('[data-rule-filter-key="all"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="diff-details-row"]')).toHaveLength(4)

    await wrapper.get('[data-testid="run-result-rule-selector-toggle"]').trigger('click')

    expect(wrapper.get('[data-testid="run-result-rule-selector"]').classes()).toContain('run-result-rule-selector--collapsed')
    expect(wrapper.get('[data-testid="run-result-rule-selector-toggle"]').text()).toBe('')
    expect(wrapper.find('[data-testid="run-result-rule-list"]').exists()).toBe(false)
    expect(wrapper.find('[data-rule-filter-key="order_id_match"]').exists()).toBe(false)
  })

  it('shows an inline error when the saved result cannot be loaded', async () => {
    getGeneratedOutputDifferences.mockReset()
    getGeneratedOutputDifferences.mockRejectedValue(new ApiCallError('Unable to load saved result.', 503))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load saved result.')
  })

  it('renders diff details through the shared app table frame instead of a page-local table shell', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationRunResultPage.vue', 'utf8')

    expect(source).toContain('.reconciliation-diff-details__toolbar')
    expect(source).toContain('justify-content: space-between;')
    expect(source).toMatch(/\.reconciliation-diff-details__search \{[^}]*width: 100%;[^}]*\}/)
    expect(source).toContain('.reconciliation-diff-details__pagination')
    expect(source).toContain('justify-content: space-between;')
    expect(source).toContain("import AppTableFrame from '../../components/ui/AppTableFrame.vue'")
    expect(source).toContain('<AppTableFrame')
    expect(source).toContain("label: 'Record ID'")
    expect(source).toContain("label: 'Diff Detail'")
    expect(source).toContain('run-result-rule-selector__panel')
    expect(source).toContain('run-result-rule-selector__option-count')
    expect(source).toContain('diff-bucket-total-results')
    expect(source).toContain('reconciliation-diff-bucket--static')
    expect(source).not.toContain('run-result-rule-selector__header')
    expect(source).not.toContain('<strong>{{ option.count }}</strong>')
    expect(source).not.toContain('<strong>{{ diffDetailRows.length }}</strong>')
    expect(source).not.toContain('.run-result-rule-selector__option-label {\n  font-weight: 700;')
    expect(source).toContain('position: fixed;')
    expect(source).toContain('left: max(0.5rem, env(safe-area-inset-left));')
    expect(source).toMatch(/\.run-result-rule-selector\s*\{[\s\S]*?align-items: center;/)
    expect(source).not.toContain('padding-left: clamp')
    expect(source).not.toContain('padding-left: 4rem')
    expect(source).not.toContain('class="reconciliation-diff-table"')
  })

  it('renders the step timeline for a run with recorded steps', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_TIMELINE',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_SUCCESS',
        resultAvailable: true,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus.mockResolvedValue({
      ok: true,
      statusEnumId: 'AUT_STAT_SUCCESS',
      steps: [
        { stageCode: 'RESOLVE', stageSequence: 1, statusEnumId: 'AUT_STAT_SUCCESS', startedDate: 1784955159000, completedDate: 1784955160000 },
        { stageCode: 'EXTRACT_FILE2', stageSequence: 3, statusEnumId: 'AUT_STAT_SUCCESS', startedDate: 1784955160000, completedDate: 1784955472000, recordCount: 4965 },
        { stageCode: 'COMPARE', stageSequence: 4, statusEnumId: 'AUT_STAT_FAILED', startedDate: 1784955472000, completedDate: 1784955484000, errorMessage: 'Spark compare failed: boom' },
      ],
    })

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(getReconciliationRunStatus).toHaveBeenCalledWith({ reconciliationRunResultId: 'RR_TIMELINE' })
    // Collapsed by default: the header shows the step count, the rows stay hidden until expanded.
    let timeline = wrapper.get('[data-testid="run-result-step-timeline"]')
    expect(timeline.text()).toContain('Run steps')
    expect(timeline.text()).toContain('3')
    expect(timeline.text()).not.toContain('Preparing run')
    const toggle = wrapper.get('[data-testid="run-result-step-timeline-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')

    timeline = wrapper.get('[data-testid="run-result-step-timeline"]')
    expect(wrapper.get('[data-testid="run-result-step-timeline-toggle"]').attributes('aria-expanded')).toBe('true')
    expect(timeline.text()).toContain('Preparing run')
    expect(timeline.text()).toContain('Extracting SHOPIFY')
    expect(timeline.text()).toContain(`${(4965).toLocaleString()} records`)
    expect(timeline.text()).toContain('5m 12s')
    expect(timeline.text()).toContain('Comparing records')
    expect(timeline.text()).toContain('Spark compare failed: boom')
    expect(timeline.text()).toContain('Failed')
  })

  it('shows the legacy empty state when a run has no recorded steps', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_LEGACY',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_SUCCESS',
        resultAvailable: true,
        createdDate: new Date().toISOString(),
      }],
    })

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-result-step-timeline-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="run-result-step-timeline-empty"]').text()).toContain('No step detail (legacy run)')
  })

  it('subscribes via notify-me while the run is active', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_NOTIFY',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_RUNNING',
        resultAvailable: false,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus
      .mockResolvedValueOnce({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', mySubscription: false, steps: [] })
      .mockResolvedValueOnce({
        ok: true,
        statusEnumId: 'AUT_STAT_RUNNING',
        mySubscription: true,
        mySubscriptionSpaceName: 'Ops Room',
        steps: [],
      })
    subscribeRunNotification.mockResolvedValue({ ok: true, messages: [], errors: [], subscribed: true })

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    const notifyButton = wrapper.get('[data-testid="run-result-notify-me"]')
    expect(notifyButton.text()).toBe('Notify me')

    await notifyButton.trigger('click')
    await flushPromises()

    expect(subscribeRunNotification).toHaveBeenCalledTimes(1)
    expect(subscribeRunNotification).toHaveBeenCalledWith({ reconciliationRunResultId: 'RR_NOTIFY' })
    expect(getReconciliationRunStatus).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="run-result-notify-me"]').text()).toBe('Notifying — Ops Room')
  })

  it('prompts for a default space when subscribe reports needsDefaultChatSpace, then retries after picking one', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_NEEDS_DEFAULT',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_RUNNING',
        resultAvailable: false,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus
      .mockResolvedValueOnce({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', mySubscription: false, steps: [] })
      .mockResolvedValueOnce({
        ok: true,
        statusEnumId: 'AUT_STAT_RUNNING',
        mySubscription: true,
        mySubscriptionSpaceName: 'Ops Room',
        steps: [],
      })
    // callService throws on ok:false envelopes -- it never resolves with one -- so the
    // backend's needsDefaultChatSpace signal only ever reaches the UI via a thrown
    // ApiCallError whose details.result carries the raw envelope (see client.ts's
    // withMethodDetails(method, { candidateUrl, result }) attached before throwing).
    subscribeRunNotification
      .mockRejectedValueOnce(new ApiCallError('Set a default chat space first.', 200, {
        method: 'facade.ReconciliationFacadeServices.subscribe#RunNotification',
        result: { ok: false, messages: [], errors: ['Set a default chat space first.'], needsDefaultChatSpace: true },
      }))
      .mockResolvedValueOnce({ ok: true, messages: [], errors: [], subscribed: true })
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops Room', googleChatConfigured: true, isActive: 'Y', inUse: true },
        { chatSpaceId: 'CS2', spaceName: 'Archived Room', googleChatConfigured: true, isActive: 'N', inUse: false },
      ],
    })
    saveUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      userNotificationDefault: { chatSpaceId: 'CS1', spaceName: 'Ops Room' },
    })

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-result-notify-me"]').trigger('click')
    await flushPromises()

    expect(subscribeRunNotification).toHaveBeenCalledTimes(1)
    expect(listTenantChatSpaces).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="notify-space-choice-CS1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notify-space-choice-CS2"]').exists()).toBe(false)

    await wrapper.get('[data-testid="notify-space-choice-CS1"]').trigger('click')
    await flushPromises()

    expect(saveUserNotificationDefault).toHaveBeenCalledWith({ chatSpaceId: 'CS1' })
    expect(subscribeRunNotification).toHaveBeenCalledTimes(2)
    expect(subscribeRunNotification).toHaveBeenLastCalledWith({ reconciliationRunResultId: 'RR_NEEDS_DEFAULT' })
    expect(wrapper.find('[data-testid="notify-space-choice-CS1"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="run-result-notify-me"]').text()).toBe('Notifying — Ops Room')
  })

  it('shows an empty-state line when a tenant has no active chat spaces to pick from', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_NO_SPACES',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_RUNNING',
        resultAvailable: false,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', mySubscription: false, steps: [] })
    subscribeRunNotification.mockRejectedValue(new ApiCallError('Set a default chat space first.', 200, {
      method: 'facade.ReconciliationFacadeServices.subscribe#RunNotification',
      result: { ok: false, messages: [], errors: ['Set a default chat space first.'], needsDefaultChatSpace: true },
    }))
    listTenantChatSpaces.mockResolvedValue({ ok: true, messages: [], errors: [], chatSpaces: [] })

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-result-notify-me"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No chat spaces yet — add one in Tenant Settings.')
  })

  it('surfaces a plain subscribe failure through the page error affordance instead of swallowing it', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_SUBSCRIBE_FAIL',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_RUNNING',
        resultAvailable: false,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', mySubscription: false, steps: [] })
    subscribeRunNotification.mockRejectedValue(new ApiCallError('Google Chat webhook rejected the request.', 200, {
      method: 'facade.ReconciliationFacadeServices.subscribe#RunNotification',
      result: { ok: false, messages: [], errors: ['Google Chat webhook rejected the request.'] },
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-result-notify-me"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Google Chat webhook rejected the request.')
    expect(wrapper.get('[data-testid="run-result-notify-me"]').text()).toBe('Notify me')
  })

  it('surfaces a save-default failure inside the picker instead of hiding it behind the popup', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_SAVE_DEFAULT_FAIL',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_RUNNING',
        resultAvailable: false,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', mySubscription: false, steps: [] })
    subscribeRunNotification.mockRejectedValue(new ApiCallError('Set a default chat space first.', 200, {
      method: 'facade.ReconciliationFacadeServices.subscribe#RunNotification',
      result: { ok: false, messages: [], errors: ['Set a default chat space first.'], needsDefaultChatSpace: true },
    }))
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [{ chatSpaceId: 'CS1', spaceName: 'Ops Room', googleChatConfigured: true, isActive: 'Y', inUse: true }],
    })
    saveUserNotificationDefault.mockRejectedValue(new ApiCallError('Chat space is no longer active.', 200, {
      method: 'facade.SettingsFacadeServices.save#UserNotificationDefault',
      result: { ok: false, messages: [], errors: ['Chat space is no longer active.'] },
    }))

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-result-notify-me"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="notify-space-choice-CS1"]').trigger('click')
    await flushPromises()

    expect(subscribeRunNotification).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="notify-space-choice-CS1"]').exists()).toBe(true)
    expect(wrapper.get('.popup-workflow-overlay').text()).toContain('Chat space is no longer active.')
  })

  it('hides notify-me once the run is terminal', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 25, totalCount: 1, pageCount: 1 },
      generatedOutputs: [{
        fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
        reconciliationRunResultId: 'RR_TERMINAL',
        sourceFormat: 'json',
        availableFormats: ['json'],
        savedRunId: 'RS_ORDER_CSV',
        statusEnumId: 'AUT_STAT_SUCCESS',
        resultAvailable: true,
        createdDate: new Date().toISOString(),
      }],
    })
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_SUCCESS', mySubscription: false, steps: [] })

    const wrapper = mount(ReconciliationRunResultPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="run-result-notify-me"]').exists()).toBe(false)
  })
})
