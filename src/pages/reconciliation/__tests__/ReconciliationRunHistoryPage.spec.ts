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
