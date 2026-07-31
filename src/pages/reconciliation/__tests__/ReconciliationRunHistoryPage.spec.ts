import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import { installLocalStorageStub } from '../../../test/localStorage'

const route = vi.hoisted(() => ({
  params: {
    savedRunId: 'RS_ORDER_CSV',
  },
  query: {
    runName: 'CSV Order Compare',
    file1SystemLabel: 'OMS',
    file2SystemLabel: 'SHOPIFY',
  },
  fullPath: '/reconciliation/run-history/RS_ORDER_CSV?runName=CSV%20Order%20Compare&file1SystemLabel=OMS&file2SystemLabel=SHOPIFY',
}))
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const listSavedRuns = vi.hoisted(() => vi.fn())
const saveSavedRunName = vi.hoisted(() => vi.fn())
const getReconciliationRunStatus = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'editor',
    canRunActiveTenantReconciliation: true,
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
}))

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
    listGeneratedOutputs,
    listSavedRuns,
    saveSavedRunName,
    getReconciliationRunStatus,
  },
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
    setRuleSetDraft: vi.fn(),
    clearRuleSetDraft: vi.fn(),
    setAutomationDraft: vi.fn(),
    clearAutomationDraft: vi.fn(),
  }),
}))

import ReconciliationRunHistoryPage from '../ReconciliationRunHistoryPage.vue'
import { useRunResultsStore } from '../../../stores/runResults'

function formatCreatedDateForExpectation(createdDate: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdDate))
}

function buildGeneratedOutput(day: number) {
  const createdDate = `2026-03-${String(day).padStart(2, '0')}T09:00:00.000Z`
  const differenceSeed = 32 - day

  return {
    fileName: `CSV-Order-Compare-diff-202603${String(day).padStart(2, '0')}-090000.json`,
    sourceFormat: 'json',
    availableFormats: ['json', 'csv'],
    preferredDownloadFormat: 'csv',
    savedRunId: 'RS_ORDER_CSV',
    savedRunName: 'CSV Order Compare',
    savedRunType: 'ruleset',
    ruleSetId: 'RS_ORDER_CSV',
    compareScopeId: 'CS_ORDER_CSV',
    file1Label: 'OMS',
    file2Label: 'SHOPIFY',
    totalDifferences: differenceSeed + 2,
    onlyInFile1Count: differenceSeed,
    onlyInFile2Count: differenceSeed + 1,
    createdDate,
  }
}

function buildRunningGeneratedOutput() {
  return {
    fileName: '',
    reconciliationRunResultId: 'RUN_RESULT_ACTIVE',
    sourceFormat: '',
    availableFormats: [],
    savedRunId: 'RS_ORDER_CSV',
    savedRunName: 'CSV Order Compare',
    savedRunType: 'ruleset',
    ruleSetId: 'RS_ORDER_CSV',
    compareScopeId: 'CS_ORDER_CSV',
    statusEnumId: 'AUT_STAT_RUNNING',
    statusLabel: 'Running',
    resultAvailable: false,
    createdDate: '2026-03-31T09:05:00.000Z',
  }
}

// The finished form of buildRunningGeneratedOutput(): same run (RUN_RESULT_ACTIVE), now carrying a
// fileName and a terminal status. This is the row the backend returns once the run completes.
function buildCompletedActiveRunOutput() {
  return {
    ...buildGeneratedOutput(31),
    fileName: 'CSV-Order-Compare-diff-20260331-090500.json',
    reconciliationRunResultId: 'RUN_RESULT_ACTIVE',
    statusEnumId: 'AUT_STAT_SUCCESS',
    statusLabel: 'Completed',
    resultAvailable: true,
    createdDate: '2026-03-31T09:05:00.000Z',
  }
}

function buildFailedGeneratedOutput() {
  return {
    fileName: '',
    reconciliationRunResultId: 'RUN_RESULT_FAILED',
    sourceFormat: '',
    availableFormats: [],
    savedRunId: 'RS_ORDER_CSV',
    savedRunName: 'CSV Order Compare',
    savedRunType: 'ruleset',
    ruleSetId: 'RS_ORDER_CSV',
    compareScopeId: 'CS_ORDER_CSV',
    statusEnumId: 'AUT_STAT_FAILED',
    statusLabel: 'Failed',
    currentStage: 'EXTRACT_FILE2',
    resultAvailable: false,
    createdDate: '2026-03-31T09:06:00.000Z',
  }
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

describe('ReconciliationRunHistoryPage', () => {
  beforeEach(() => {
    installLocalStorageStub()
    window.localStorage.clear()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-31T09:10:00.000Z'))
    route.params.savedRunId = 'RS_ORDER_CSV'
    route.query.runName = 'CSV Order Compare'
    route.query.file1SystemLabel = 'OMS'
    route.query.file2SystemLabel = 'SHOPIFY'
    route.fullPath =
      '/reconciliation/run-history/RS_ORDER_CSV?runName=CSV%20Order%20Compare&file1SystemLabel=OMS&file2SystemLabel=SHOPIFY'

    listGeneratedOutputs.mockReset()
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 6,
        totalCount: 7,
        pageCount: 2,
      },
      generatedOutputs: [
        buildGeneratedOutput(31),
        buildGeneratedOutput(30),
        buildGeneratedOutput(29),
        buildGeneratedOutput(28),
        buildGeneratedOutput(27),
        buildGeneratedOutput(26),
      ],
    })
    getReconciliationRunStatus.mockReset()
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING' })
    useRunResultsStore().stopAllRunStatusPolls()
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
    authState.sessionInfo = {
      userId: 'editor',
      canRunActiveTenantReconciliation: true,
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }
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

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads saved-run scoped results and features the most recent output above the previous results list', async () => {
    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(listGeneratedOutputs).toHaveBeenCalledWith({
      savedRunId: 'RS_ORDER_CSV',
      pageIndex: 0,
      pageSize: 6,
      query: '',
    }, expect.any(AbortSignal))
    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.text()).toContain('CSV Order Compare')
    const editableTitle = wrapper.get('[data-testid="run-history-title"]')
    expect(editableTitle.element.tagName).toBe('H1')
    expect(editableTitle.attributes('contenteditable')).toBe('plaintext-only')
    expect(editableTitle.attributes('aria-label')).toBe('Run name')
    expect(editableTitle.classes()).toContain('static-page-inline-edit-title')
    expect(wrapper.findAll('.static-page-section-heading').map((node) => node.text())).toEqual(['Most Recent', 'Previous Results'])
    expect(wrapper.get('[data-testid="run-history-featured-tile"]').text()).toContain(
      formatCreatedDateForExpectation('2026-03-31T09:00:00.000Z'),
    )
    expect(wrapper.findAll('[data-testid="run-history-result-tile"]')).toHaveLength(5)
    expect(wrapper.findAll('.static-page-tile-title').map((node) => node.text())).toEqual([
      formatCreatedDateForExpectation('2026-03-31T09:00:00.000Z'),
      formatCreatedDateForExpectation('2026-03-30T09:00:00.000Z'),
      formatCreatedDateForExpectation('2026-03-29T09:00:00.000Z'),
      formatCreatedDateForExpectation('2026-03-28T09:00:00.000Z'),
      formatCreatedDateForExpectation('2026-03-27T09:00:00.000Z'),
      formatCreatedDateForExpectation('2026-03-26T09:00:00.000Z'),
    ])
    expect(wrapper.get('[data-testid="run-history-more"]').text()).toContain('More...')
    expect(JSON.parse(wrapper.get('[data-testid="run-history-featured-tile"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-result',
      params: {
        savedRunId: 'RS_ORDER_CSV',
        outputFileName: 'CSV-Order-Compare-diff-20260331-090000.json',
      },
      query: {
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })
    expect(JSON.parse(wrapper.findAll('[data-testid="run-history-result-tile"]')[0]!.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-result',
      params: {
        savedRunId: 'RS_ORDER_CSV',
        outputFileName: 'CSV-Order-Compare-diff-20260330-090000.json',
      },
      query: {
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })
    expect(wrapper.find('.static-page-board [data-testid="run-history-open-workflow"]').exists()).toBe(false)
    const openWorkflowAction = wrapper.get('.static-page-actions [data-testid="run-history-open-workflow"]')
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
    expect(wrapper.find('.static-page-board [data-testid="run-history-open-settings"]').exists()).toBe(false)
    const openSettingsAction = wrapper.get('.static-page-actions [data-testid="run-history-open-settings"]')
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

  it('keeps a single previous result on the shared one-third tile grid', async () => {
    listGeneratedOutputs.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 6,
        totalCount: 2,
        pageCount: 1,
      },
      generatedOutputs: [
        buildGeneratedOutput(31),
        buildGeneratedOutput(30),
      ],
    })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const resultsGrid = wrapper.get('[data-testid="run-history-results"]')
    expect(resultsGrid.classes()).toEqual(expect.arrayContaining(['static-page-tile-grid', 'run-history-grid']))
    expect(wrapper.findAll('[data-testid="run-history-result-tile"]')).toHaveLength(1)

    const pageSource = readFileSync('src/pages/reconciliation/ReconciliationRunHistoryPage.vue', 'utf8')
    const globalStyles = readFileSync('src/style.css', 'utf8')
    expect(pageSource).not.toMatch(/\.run-history-grid\s*\{[^}]*auto-fit/s)
    expect(globalStyles).toMatch(/\.static-page-tile-grid\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/s)
  })

  it('shows locally submitted unfinished runs as Running in run history', async () => {
    window.localStorage.setItem('darpan.pendingReconciliationRuns', JSON.stringify([
      {
        pendingRunId: 'pending-RS_ORDER_CSV',
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: '2026-03-31T09:05:00.000Z',
      },
    ]))

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const runningTile = wrapper.get('[data-testid="run-history-running-tile"]')
    expect(wrapper.findAll('.static-page-section-heading').map((node) => node.text())).toEqual(['In Progress', 'Most Recent', 'Previous Results'])
    expect(runningTile.text()).toContain('Running')
    expect(runningTile.text()).toContain(formatCreatedDateForExpectation('2026-03-31T09:05:00.000Z'))
  })

  it('shows backend persisted running runs without making them the featured result', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 6,
        totalCount: 7,
        pageCount: 2,
      },
      generatedOutputs: [
        buildRunningGeneratedOutput(),
        buildGeneratedOutput(31),
        buildGeneratedOutput(30),
        buildGeneratedOutput(29),
        buildGeneratedOutput(28),
        buildGeneratedOutput(27),
        buildGeneratedOutput(26),
      ],
    })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const runningTile = wrapper.get('[data-testid="run-history-running-tile"]')
    expect(wrapper.findAll('.static-page-section-heading').map((node) => node.text())).toEqual(['In Progress', 'Most Recent', 'Previous Results'])
    expect(runningTile.text()).toContain('Running')
    expect(runningTile.text()).toContain(formatCreatedDateForExpectation('2026-03-31T09:05:00.000Z'))
    expect(JSON.parse(wrapper.get('[data-testid="run-history-featured-tile"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-result',
      params: {
        savedRunId: 'RS_ORDER_CSV',
        outputFileName: 'CSV-Order-Compare-diff-20260331-090000.json',
      },
      query: {
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })
    expect(wrapper.findAll('[data-testid="run-history-result-tile"]')).toHaveLength(5)
  })

  it('older cache-hydrated rows never displace the newest result from the featured tile', async () => {
    // Live bug (2026-07-31, gorjana): the page's scoped fetch renders newest-first, then the
    // store's GLOBAL hydration completes a beat later carrying OLDER rows the page has not seen
    // (beyond page 1). The surface-fresh watch treated "unseen" as "newer" and prepended them,
    // putting a superseded run (the 37-diff artifact) in the Most Recent tile.
    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()
    const featuredBefore = wrapper.get('[data-testid="run-history-featured-tile"]').text()

    const olderHydratedOutput = {
      ...buildGeneratedOutput(20),   // Mar 20 — older than every fetched row (Mar 26-31)
      fileName: 'CSV-Order-Compare-diff-20260320-090000.json',
      totalDifferences: 37,
    }
    useRunResultsStore().upsertOutput(olderHydratedOutput as never)
    await flushPromises()

    const featuredAfter = wrapper.get('[data-testid="run-history-featured-tile"]').text()
    expect(featuredAfter).toBe(featuredBefore)
    expect(featuredAfter).not.toContain('37')
    // The older row lands in its chronological slot at the tail (behind "More..."), so the
    // visible previous-results batch is also unchanged — newest five, in order.
    const previousDates = wrapper.findAll('[data-testid="run-history-result-tile"]').map((tile) => tile.text())
    expect(previousDates[0]).toContain(formatCreatedDateForExpectation('2026-03-30T09:00:00.000Z'))
    expect(previousDates.join()).not.toContain(formatCreatedDateForExpectation('2026-03-20T09:00:00.000Z'))
  })

  it('surfaces a newly completed run without a page reload', async () => {
    // Page loads via direct server fetch (cache empty), then a run completes in the background:
    // the status-poll completion refresh upserts the finished output into the run-results cache,
    // and the page must show it without a remount or manual reload.
    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()
    expect(wrapper.findAll('[data-testid="run-history-result-tile"]').length).toBeGreaterThan(0)
    const freshOutput = {
      ...buildGeneratedOutput(31),
      fileName: 'CSV-Order-Compare-diff-20260331-091500.json',
      createdDate: '2026-03-31T09:15:00.000Z',
      totalDifferences: 99,
    }

    useRunResultsStore().upsertOutput(freshOutput as never)
    await flushPromises()

    const featured = wrapper.get('[data-testid="run-history-featured-tile"]')
    expect(featured.text()).toContain('99')
  })

  it('running tile shows live stage and progress from the status poll', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 2, pageCount: 1 },
      generatedOutputs: [
        { ...buildRunningGeneratedOutput(), reconciliationRunResultId: 'RUN_RESULT_LIVE_A', currentStage: 'EXTRACT_FILE2', progressPercent: 45 },
        buildGeneratedOutput(31),
      ],
    })
    getReconciliationRunStatus.mockResolvedValue({
      ok: true,
      statusEnumId: 'AUT_STAT_RUNNING',
      currentStage: 'COMPARE',
      progressPercent: 62,
    })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(getReconciliationRunStatus).toHaveBeenCalledWith({ reconciliationRunResultId: 'RUN_RESULT_LIVE_A' })
    const progress = wrapper.get('[data-testid="run-history-running-progress"]')
    // The live poll status wins over the (older) descriptor snapshot.
    expect(progress.text()).toContain('Comparing records')
    expect(progress.text()).toContain('62%')
  })

  it('links a backend running tile to the live run view and leaves local markers unlinked', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 2, pageCount: 1 },
      generatedOutputs: [
        { ...buildRunningGeneratedOutput(), reconciliationRunResultId: 'RUN_RESULT_OPENABLE' },
        buildGeneratedOutput(31),
      ],
    })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const runningTile = wrapper.get('[data-testid="run-history-running-tile"]')
    expect(JSON.parse(runningTile.attributes('data-to') as string)).toEqual({
      name: 'reconciliation-run-live',
      params: { savedRunId: 'RS_ORDER_CSV', runResultId: 'RUN_RESULT_OPENABLE' },
      query: { runName: 'CSV Order Compare', file1SystemLabel: 'OMS', file2SystemLabel: 'SHOPIFY' },
    })

    // A local pending marker has no backend run id yet, so its tile has nothing to open.
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 0, pageCount: 0 },
      generatedOutputs: [],
    })
    window.localStorage.setItem('darpan.pendingReconciliationRuns', JSON.stringify([
      {
        pendingRunId: 'pending-RS_ORDER_CSV',
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: new Date().toISOString(),
      },
    ]))
    const localWrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const localTile = localWrapper.get('[data-testid="run-history-running-tile"]')
    expect(localTile.element.tagName).toBe('ARTICLE')
    expect(localTile.attributes('data-to')).toBeUndefined()
  })

  it('running tile falls back to the descriptor stage before live status carries one', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 2, pageCount: 1 },
      generatedOutputs: [
        { ...buildRunningGeneratedOutput(), reconciliationRunResultId: 'RUN_RESULT_LIVE_B', currentStage: 'EXTRACT_FILE2', progressPercent: 45 },
        buildGeneratedOutput(31),
      ],
    })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const progress = wrapper.get('[data-testid="run-history-running-progress"]')
    expect(progress.text()).toContain('Extracting SHOPIFY')
    expect(progress.text()).toContain('45%')
  })

  it('prunes an abandoned pending marker when the backend shows no running run', async () => {
    // A run that failed server-side leaves no RUNNING row in the history list — and no newer
    // completed result to trigger the existing clearing — so the local pending marker would
    // ghost an "In Progress" tile forever. Markers past the grace window with no backend
    // running row are abandoned and must be dropped.
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 0, pageCount: 1 },
      generatedOutputs: [],
    })
    window.localStorage.setItem('darpan.pendingReconciliationRuns', JSON.stringify([
      {
        pendingRunId: 'pending-RS_ORDER_CSV-stale',
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: '2026-03-31T08:40:00.000Z',
      },
    ]))

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="run-history-running-tile"]').exists()).toBe(false)
    expect(window.localStorage.getItem('darpan.pendingReconciliationRuns')).toBeNull()
  })

  it('clears a pending history marker after a newer saved result is available', async () => {
    window.localStorage.setItem('darpan.pendingReconciliationRuns', JSON.stringify([
      {
        pendingRunId: 'pending-RS_ORDER_CSV',
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: '2026-03-30T09:05:00.000Z',
      },
    ]))

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="run-history-running-tile"]').exists()).toBe(false)
    expect(window.localStorage.getItem('darpan.pendingReconciliationRuns')).toBeNull()
  })

  it('shows a failed run as a Needs Attention tile with the live error message', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 2, pageCount: 1 },
      generatedOutputs: [buildFailedGeneratedOutput(), buildGeneratedOutput(31)],
    })
    getReconciliationRunStatus.mockResolvedValue({
      ok: true,
      statusEnumId: 'AUT_STAT_FAILED',
      currentStage: 'EXTRACT_FILE2',
      errorMessage: 'HotWax: OMS REST request failed: Read timed out',
    })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(getReconciliationRunStatus).toHaveBeenCalledWith({ reconciliationRunResultId: 'RUN_RESULT_FAILED' })
    expect(wrapper.findAll('.static-page-section-heading').map((node) => node.text()))
      .toContain('Needs Attention')
    const failedTile = wrapper.get('[data-testid="run-history-failed-tile"]')
    expect(failedTile.text()).toContain('Failed')
    expect(failedTile.text()).toContain('HotWax: OMS REST request failed: Read timed out')
    expect(failedTile.text()).toContain(formatCreatedDateForExpectation('2026-03-31T09:06:00.000Z'))
    // A failed run must never masquerade as the featured result.
    expect(wrapper.get('[data-testid="run-history-featured-tile"]').text()).not.toContain('Failed')
  })

  it('failed tile falls back to the failing stage when no error message is available', async () => {
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 1, pageCount: 1 },
      generatedOutputs: [buildFailedGeneratedOutput()],
    })
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_FAILED' })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    const failedTile = wrapper.get('[data-testid="run-history-failed-tile"]')
    expect(failedTile.text()).toContain('Failed during Extracting SHOPIFY')
  })

  it('clears the local pending marker when the backend run failed', async () => {
    // Ghost-card bug (2026-07-31): the pending marker only reconciled against completed outputs,
    // so a failed run left a "Running" card ghosting until the abandonment prune deleted it.
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 1, pageCount: 1 },
      generatedOutputs: [buildFailedGeneratedOutput()],
    })
    getReconciliationRunStatus.mockResolvedValue({
      ok: true,
      statusEnumId: 'AUT_STAT_FAILED',
      errorMessage: 'HotWax: OMS REST request failed: Read timed out',
    })
    window.localStorage.setItem('darpan.pendingReconciliationRuns', JSON.stringify([
      {
        pendingRunId: 'pending-RS_ORDER_CSV',
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: '2026-03-31T09:05:00.000Z',
      },
    ]))

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="run-history-running-tile"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-history-failed-tile"]').exists()).toBe(true)
    expect(window.localStorage.getItem('darpan.pendingReconciliationRuns')).toBeNull()
  })

  it('moves a run out of In Progress when it completes in the background, without a manual refresh', async () => {
    // 2026-07-31: a run that finished while the page was open stayed in the In Progress block until
    // the user manually refreshed. The background cache watch merged the finished row into the list
    // (so the backend running row went away) but never re-resolved the LOCAL pending marker, and
    // runningRuns falls back to those markers whenever there is no backend running row — so the tile
    // simply switched from being backend-backed to marker-backed and never disappeared.
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 2, pageCount: 1 },
      generatedOutputs: [buildRunningGeneratedOutput(), buildGeneratedOutput(30)],
    })
    // submittedAt is newer than every completed row above, so the marker legitimately survives the
    // initial load — this is a genuinely in-flight run, not a stale marker.
    window.localStorage.setItem('darpan.pendingReconciliationRuns', JSON.stringify([
      {
        pendingRunId: 'pending-RS_ORDER_CSV',
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: '2026-03-31T09:05:00.000Z',
      },
    ]))

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="run-history-running-tile"]').exists()).toBe(true)

    // The run finishes. This is exactly what production does on the live→terminal transition:
    // runResults.ts:192 calls refresh() so the finished result replaces the running tile.
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 6, totalCount: 2, pageCount: 1 },
      generatedOutputs: [buildCompletedActiveRunOutput(), buildGeneratedOutput(30)],
    })
    await useRunResultsStore().refresh()
    await flushPromises()

    expect(wrapper.find('[data-testid="run-history-running-tile"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="run-history-featured-tile"]').text())
      .toContain(formatCreatedDateForExpectation('2026-03-31T09:05:00.000Z'))
    expect(window.localStorage.getItem('darpan.pendingReconciliationRuns')).toBeNull()
  })

  it('reveals more previous results in five-at-a-time batches', async () => {
    listGeneratedOutputs
      .mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        pagination: {
          pageIndex: 0,
          pageSize: 6,
          totalCount: 7,
          pageCount: 2,
        },
        generatedOutputs: [
          buildGeneratedOutput(31),
          buildGeneratedOutput(30),
          buildGeneratedOutput(29),
          buildGeneratedOutput(28),
          buildGeneratedOutput(27),
          buildGeneratedOutput(26),
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        pagination: {
          pageIndex: 1,
          pageSize: 6,
          totalCount: 7,
          pageCount: 2,
        },
        generatedOutputs: [buildGeneratedOutput(25)],
      })

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-history-more"]').trigger('click')
    await flushPromises()

    expect(listGeneratedOutputs).toHaveBeenNthCalledWith(2, {
      savedRunId: 'RS_ORDER_CSV',
      pageIndex: 1,
      pageSize: 6,
      query: '',
    }, expect.any(AbortSignal))
    expect(wrapper.findAll('[data-testid="run-history-result-tile"]')).toHaveLength(6)
    expect(wrapper.text()).toContain(formatCreatedDateForExpectation('2026-03-25T09:00:00.000Z'))
    expect(wrapper.find('[data-testid="run-history-more"]').exists()).toBe(false)
  })

  it('renders from the run-results cache without a server fetch, and reaches older results via More', async () => {
    // Prime the warm cache (as login hydration / a completed run would), so the
    // page should render immediately without an on-demand listGeneratedOutputs call.
    useRunResultsStore().upsertOutputs([
      buildGeneratedOutput(31),
      buildGeneratedOutput(30),
    ])

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(listGeneratedOutputs).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="run-history-featured-tile"]').text()).toContain(
      formatCreatedDateForExpectation('2026-03-31T09:00:00.000Z'),
    )
    expect(wrapper.findAll('[data-testid="run-history-result-tile"]')).toHaveLength(1)
    // Cached data only covers recent results; "More" must still fall through to
    // the server to reach older history.
    const moreButton = wrapper.get('[data-testid="run-history-more"]')

    await moreButton.trigger('click')
    await flushPromises()

    expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)
    expect(listGeneratedOutputs.mock.calls[0]?.[0]).toEqual({
      savedRunId: 'RS_ORDER_CSV',
      pageIndex: 0,
      pageSize: 6,
      query: '',
    })
  })

  it('shows an inline error when the saved-result lookup fails', async () => {
    listGeneratedOutputs.mockRejectedValue(new ApiCallError('Unable to load saved results.', 503))

    const wrapper = mount(ReconciliationRunHistoryPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load saved results.')
  })
})
