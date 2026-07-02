import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import { installLocalStorageStub } from '../../../test/localStorage'

const route = vi.hoisted(() => ({
  query: {},
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listSavedRuns = vi.hoisted(() => vi.fn())
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const runSavedRunDiff = vi.hoisted(() => vi.fn())
const permissionState = vi.hoisted(() => ({
  canRunActiveTenantReconciliation: true,
  canEditTenantSettings: true,
  canManageGlobalSettings: false,
  canViewTenantSettings: true,
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
  },
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    listSavedRuns,
    listGeneratedOutputs,
    runSavedRunDiff,
  },
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionState,
}))

import ReconciliationDiffPage from '../ReconciliationDiffPage.vue'

const savedRunResponse = {
  ok: true,
  messages: [],
  errors: [],
  pagination: {
    pageIndex: 0,
    pageSize: 50,
    totalCount: 1,
    pageCount: 1,
  },
  savedRuns: [
    {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      description: 'CSV order comparison',
      runType: 'ruleset',
      ruleSetId: 'RS_ORDER_CSV',
      compareScopeId: 'CS_ORDER_CSV',
      requiresSystemSelection: false,
      defaultFile1SystemEnumId: 'OMS',
      defaultFile2SystemEnumId: 'SHOPIFY',
      systemOptions: [
        { enumId: 'OMS', label: 'OMS', fileSide: 'FILE_1', fileTypeEnumId: 'DftCsv', fileTypeLabel: 'CSV' },
        {
          enumId: 'SHOPIFY',
          label: 'SHOPIFY',
          fileSide: 'FILE_2',
          fileTypeEnumId: 'DftCsv',
          fileTypeLabel: 'CSV',
        },
      ],
    },
  ],
}

const apiSavedRunResponse = {
  ok: true,
  messages: [],
  errors: [],
  pagination: {
    pageIndex: 0,
    pageSize: 50,
    totalCount: 1,
    pageCount: 1,
  },
  savedRuns: [
    {
      savedRunId: 'RS_API_ORDER_SYNC',
      runName: 'API Order Sync',
      description: 'API order comparison',
      runType: 'ruleset',
      ruleSetId: 'RS_API_ORDER_SYNC',
      compareScopeId: 'CS_API_ORDER_SYNC',
      requiresSystemSelection: false,
      defaultFile1SystemEnumId: 'OMS',
      defaultFile2SystemEnumId: 'SHOPIFY',
      systemOptions: [
        {
          enumId: 'OMS',
          label: 'HotWax',
          fileSide: 'FILE_1',
          fileTypeEnumId: 'DftJson',
          fileTypeLabel: 'JSON',
          sourceTypeEnumId: 'AUT_SRC_API',
          systemMessageRemoteId: 'HOTWAX_ORDERS_API',
        },
        {
          enumId: 'SHOPIFY',
          label: 'Shopify',
          fileSide: 'FILE_2',
          fileTypeEnumId: 'DftJson',
          fileTypeLabel: 'JSON',
          sourceTypeEnumId: 'AUT_SRC_API',
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
        },
      ],
    },
  ],
}

const mixedApiFileSavedRunResponse = {
  ok: true,
  messages: [],
  errors: [],
  pagination: {
    pageIndex: 0,
    pageSize: 50,
    totalCount: 1,
    pageCount: 1,
  },
  savedRuns: [
    {
      savedRunId: 'RS_MIXED_ORDER_SYNC',
      runName: 'Mixed Order Sync',
      description: 'API to file order comparison',
      runType: 'ruleset',
      ruleSetId: 'RS_MIXED_ORDER_SYNC',
      compareScopeId: 'CS_MIXED_ORDER_SYNC',
      requiresSystemSelection: false,
      defaultFile1SystemEnumId: 'OMS',
      defaultFile2SystemEnumId: 'SHOPIFY',
      systemOptions: [
        {
          enumId: 'OMS',
          label: 'HotWax',
          fileSide: 'FILE_1',
          fileTypeEnumId: 'DftJson',
          fileTypeLabel: 'JSON',
          sourceTypeEnumId: 'AUT_SRC_API',
          systemMessageRemoteId: 'HOTWAX_ORDERS_API',
        },
        {
          enumId: 'SHOPIFY',
          label: 'Shopify',
          fileSide: 'FILE_2',
          fileTypeEnumId: 'DftCsv',
          fileTypeLabel: 'CSV',
        },
      ],
    },
  ],
}

function expectedWindowPayloadDate(year: number, monthIndex: number, day: number): string {
  return new Date(year, monthIndex, day).toISOString()
}

function stubFileReader(): void {
  class MockFileReader {
    result: string | ArrayBuffer | null = null
    onload: null | (() => void) = null
    onerror: null | (() => void) = null

    readAsText(file: File): void {
      this.result = file.name === 'oms-orders.csv' ? 'order_id\n1001\n1002\n' : 'order_id\n1002\n1003\n'
      this.onload?.()
    }
  }

  vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader)
}

async function chooseWorkflowOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="workflow-select-option"][data-option-value="${value}"]`).trigger('click')
}

describe('ReconciliationDiffPage', () => {
  beforeEach(() => {
    installLocalStorageStub()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 17, 12, 0, 0))
    window.localStorage.clear()
    route.query = {}
    push.mockClear()
    listSavedRuns.mockReset()
    listGeneratedOutputs.mockReset()
    runSavedRunDiff.mockReset()
    permissionState.canEditTenantSettings = true
    listSavedRuns.mockResolvedValue(savedRunResponse)
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 1,
        totalCount: 0,
        pageCount: 1,
      },
      generatedOutputs: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('loads saved runs and keeps the summary hidden before selection', async () => {
    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(listSavedRuns).toHaveBeenCalledWith(
      {
        pageIndex: 0,
        pageSize: 50,
        query: '',
      },
      expect.any(AbortSignal),
    )
    expect(wrapper.find('.workflow-page').exists()).toBe(true)
    expect(wrapper.find('.wizard-progress-track').exists()).toBe(true)
    expect(wrapper.find('.workflow-shell--center-stage').exists()).toBe(true)
    expect(wrapper.find('.reconciliation-diff-layout').exists()).toBe(true)
    expect(wrapper.find('.reconciliation-diff-main').exists()).toBe(true)
    expect(wrapper.find('.workflow-step-shell').exists()).toBe(true)
    expect(wrapper.text()).toContain('Select a Run')
    expect(wrapper.text()).toContain('Next')
    expect(wrapper.find('[data-testid="saved-run-select"]').exists()).toBe(true)
    await wrapper.get('[data-testid="saved-run-select"]').trigger('click')
    expect(wrapper.get('[data-testid="workflow-select-option"][data-option-value="RS_ORDER_CSV"]').text()).toBe(
      'CSV Order Compare',
    )
    expect(wrapper.find('[data-testid="file1-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file2-input"]').exists()).toBe(false)
    expect(wrapper.find('.reconciliation-run-history-board').exists()).toBe(false)
  })

  it('shows the API error when saved-run lookup fails', async () => {
    listSavedRuns.mockRejectedValue(new ApiCallError('Unable to load saved runs.', 503))

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load saved runs.')
    expect(wrapper.find('.reconciliation-diff-layout').exists()).toBe(false)
    expect(wrapper.find('[data-testid="saved-run-select"]').exists()).toBe(false)
  })

  it('offers a create-run CTA in the empty state when there are no saved runs', async () => {
    listSavedRuns.mockResolvedValue({ ...savedRunResponse, savedRuns: [] })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('No runs available')
    const cta = wrapper.findAll('.empty-state__action').find((link) => link.text().includes('Create a run'))
    expect(cta).toBeTruthy()
    expect(cta!.attributes('data-to')).toContain('reconciliation-create')
    expect(wrapper.find('.reconciliation-diff-layout').exists()).toBe(false)
  })

  it('hides the create-run CTA when the user cannot edit tenant settings', async () => {
    permissionState.canEditTenantSettings = false
    listSavedRuns.mockResolvedValue({ ...savedRunResponse, savedRuns: [] })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('No runs available')
    expect(wrapper.find('.empty-state__action').exists()).toBe(false)
  })

  it('loads the latest saved result card with a static-result link and a separate history link', async () => {
    route.query = {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      file1SystemLabel: 'OMS',
      file2SystemLabel: 'SHOPIFY',
    }
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 1,
        totalCount: 2,
        pageCount: 2,
      },
      generatedOutputs: [
        {
          fileName: 'CSV-Order-Compare-diff-20260330-150000.json',
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
          totalDifferences: 4,
          onlyInFile1Count: 1,
          onlyInFile2Count: 3,
          createdDate: '2026-03-30T15:00:00.000Z',
        },
      ],
    })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(listGeneratedOutputs).toHaveBeenCalledWith(
      {
        savedRunId: 'RS_ORDER_CSV',
        pageIndex: 0,
        pageSize: 1,
        query: '',
      },
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('Upload the OMS CSV file')
    expect(wrapper.find('.reconciliation-run-history-board').exists()).toBe(true)
    expect(wrapper.get('[data-testid="latest-run-result"]').text()).toContain('Mar')
    expect(wrapper.get('[data-testid="latest-run-result"]').text()).toContain('Total differences')
    expect(JSON.parse(wrapper.get('[data-testid="latest-run-result"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-result',
      params: {
        savedRunId: 'RS_ORDER_CSV',
        outputFileName: 'CSV-Order-Compare-diff-20260330-150000.json',
      },
      query: {
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })
    expect(JSON.parse(wrapper.get('[data-testid="view-all-run-results"]').attributes('data-to') ?? '{}')).toEqual({
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
  })

  it('uses the two-step upload workflow and navigates to the static result page after a successful run', async () => {
    stubFileReader()
    route.query = {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      file1SystemLabel: 'OMS',
      file2SystemLabel: 'SHOPIFY',
    }
    runSavedRunDiff.mockResolvedValue({
      ok: true,
      messages: ['Generated CSV-Order-Compare-diff-20260331-063304.json.'],
      errors: [],
      runResult: {
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        runType: 'ruleset',
        ruleSetId: 'RS_ORDER_CSV',
        compareScopeId: 'CS_ORDER_CSV',
        file1SystemEnumId: 'OMS',
        file2SystemEnumId: 'SHOPIFY',
        validationErrors: [],
        processingWarnings: [],
        generatedOutput: {
          fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
          savedRunId: 'RS_ORDER_CSV',
          savedRunType: 'ruleset',
          totalDifferences: 2,
          onlyInFile1Count: 1,
          onlyInFile2Count: 1,
        },
      },
    })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Upload the OMS CSV file')
    expect(wrapper.find('[data-testid="saved-run-select"]').exists()).toBe(false)

    const file1Input = wrapper.get('[data-testid="file1-input"]')
    Object.defineProperty(file1Input.element, 'files', {
      value: [new File(['order_id\n1001\n1002\n'], 'oms-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file1Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Upload the SHOPIFY CSV file')
    expect(wrapper.text()).toContain('Choose the SHOPIFY CSV file to upload...')

    const file2Input = wrapper.get('[data-testid="file2-input"]')
    Object.defineProperty(file2Input.element, 'files', {
      value: [new File(['order_id\n1002\n1003\n'], 'shopify-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file2Input.trigger('change')
    expect(wrapper.get('[data-testid="reconciliation-step-primary"]').text()).toBe('Execute')

    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    expect(runSavedRunDiff).toHaveBeenCalledWith(
      {
        savedRunId: 'RS_ORDER_CSV',
        file1Name: 'oms-orders.csv',
        file1Text: 'order_id\n1001\n1002\n',
        file2Name: 'shopify-orders.csv',
        file2Text: 'order_id\n1002\n1003\n',
        file1SystemEnumId: 'OMS',
        file2SystemEnumId: 'SHOPIFY',
        hasHeader: true,
      },
      expect.any(AbortSignal),
    )
    expect(push).toHaveBeenCalledWith({
      name: 'reconciliation-run-result',
      params: {
        savedRunId: 'RS_ORDER_CSV',
        outputFileName: 'CSV-Order-Compare-diff-20260331-063304.json',
      },
      query: {
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })
  })

  it('shows a come-back-later hint and records the run as pending while execution is in progress', async () => {
    stubFileReader()
    route.query = {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      file1SystemLabel: 'OMS',
      file2SystemLabel: 'SHOPIFY',
    }

    let resolveRun: (value: unknown) => void = () => {}
    runSavedRunDiff.mockReturnValue(new Promise((resolve) => {
      resolveRun = resolve
    }))

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    const file1Input = wrapper.get('[data-testid="file1-input"]')
    Object.defineProperty(file1Input.element, 'files', {
      value: [new File(['order_id\n1001\n1002\n'], 'oms-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file1Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    const file2Input = wrapper.get('[data-testid="file2-input"]')
    Object.defineProperty(file2Input.element, 'files', {
      value: [new File(['order_id\n1002\n1003\n'], 'shopify-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file2Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    const hint = wrapper.get('[data-testid="run-submitted-hint"]')
    expect(hint.text()).toContain('Run submitted')
    expect(hint.text()).toContain('You can leave this page and come back later from run history.')
    expect(JSON.parse(wrapper.get('[data-testid="run-submitted-history-link"]').attributes('data-to') ?? '{}')).toEqual({
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
    expect(JSON.parse(window.localStorage.getItem('darpan.pendingReconciliationRuns') ?? '[]')).toEqual([
      expect.objectContaining({
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
        submittedAt: new Date(2026, 4, 17, 12, 0, 0).toISOString(),
      }),
    ])

    resolveRun({
      ok: true,
      messages: ['Generated CSV-Order-Compare-diff-20260331-063304.json.'],
      errors: [],
      runResult: {
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        runType: 'ruleset',
        ruleSetId: 'RS_ORDER_CSV',
        compareScopeId: 'CS_ORDER_CSV',
        file1SystemEnumId: 'OMS',
        file2SystemEnumId: 'SHOPIFY',
        validationErrors: [],
        processingWarnings: [],
        generatedOutput: {
          fileName: 'CSV-Order-Compare-diff-20260331-063304.json',
          savedRunId: 'RS_ORDER_CSV',
          savedRunType: 'ruleset',
          totalDifferences: 2,
          onlyInFile1Count: 1,
          onlyInFile2Count: 1,
        },
      },
    })
    await flushPromises()

    expect(window.localStorage.getItem('darpan.pendingReconciliationRuns')).toBeNull()
  })

  it('keeps the pending run marker when the submitted request is interrupted after starting', async () => {
    stubFileReader()
    route.query = {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      file1SystemLabel: 'OMS',
      file2SystemLabel: 'SHOPIFY',
    }
    runSavedRunDiff.mockRejectedValue(
      new ApiCallError('Unable to connect to Darpan right now. Try again in a moment.', 503, {
        failures: [{ url: 'http://localhost:8080/rpc/json', error: new TypeError('Failed to fetch') }],
      }),
    )

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    const file1Input = wrapper.get('[data-testid="file1-input"]')
    Object.defineProperty(file1Input.element, 'files', {
      value: [new File(['order_id\n1001\n1002\n'], 'oms-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file1Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    const file2Input = wrapper.get('[data-testid="file2-input"]')
    Object.defineProperty(file2Input.element, 'files', {
      value: [new File(['order_id\n1002\n1003\n'], 'shopify-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file2Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to connect to Darpan right now. Try again in a moment.')
    expect(JSON.parse(window.localStorage.getItem('darpan.pendingReconciliationRuns') ?? '[]')).toEqual([
      expect.objectContaining({
        savedRunId: 'RS_ORDER_CSV',
        runName: 'CSV Order Compare',
        submittedAt: new Date(2026, 4, 17, 12, 0, 0).toISOString(),
      }),
    ])
  })

  it('asks for one API time period instead of file uploads when both saved-run sources are API-backed', async () => {
    route.query = {
      savedRunId: 'RS_API_ORDER_SYNC',
      runName: 'API Order Sync',
      file1SystemLabel: 'HotWax',
      file2SystemLabel: 'SHOPIFY',
    }
    listSavedRuns.mockResolvedValue(apiSavedRunResponse)
    runSavedRunDiff.mockResolvedValue({
      ok: true,
      messages: ['Generated API-Order-Sync-result.json.'],
      errors: [],
      runResult: {
        savedRunId: 'RS_API_ORDER_SYNC',
        runName: 'API Order Sync',
        runType: 'ruleset',
        ruleSetId: 'RS_API_ORDER_SYNC',
        compareScopeId: 'CS_API_ORDER_SYNC',
        file1SystemEnumId: 'OMS',
        file2SystemEnumId: 'SHOPIFY',
        validationErrors: [],
        processingWarnings: [],
        generatedOutput: {
          fileName: 'API-Order-Sync-result.json',
          savedRunId: 'RS_API_ORDER_SYNC',
          savedRunType: 'ruleset',
          totalDifferences: 0,
          onlyInFile1Count: 0,
          onlyInFile2Count: 0,
        },
      },
    })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Which API time period should we use?')
    expect(wrapper.find('[data-testid="api-window-range-field"]').exists()).toBe(false)
    expect(wrapper.findAll('.workflow-shortcut-choice-card')).toHaveLength(4)
    expect(wrapper.get('[data-testid="api-window-preset-previous-day"]').text()).toContain('Previous Day, May 16, 2026')
    expect(wrapper.get('[data-testid="api-window-preset-previous-week"]').text()).toContain(
      'Previous Week, May 9, 2026 to May 16, 2026',
    )
    expect(wrapper.get('[data-testid="api-window-preset-previous-month"]').text()).toContain(
      'Previous Month, April 2026',
    )
    expect(wrapper.get('[data-testid="api-window-preset-custom"]').text()).toContain(
      'Custom Dates, select start and end dates',
    )
    expect(wrapper.find('.workflow-shortcut-choice-card__description').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file1-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file2-input"]').exists()).toBe(false)
    await wrapper.get('[data-testid="api-window-preset-previous-week"]').trigger('click')
    expect(wrapper.get('[data-testid="api-window-preset-previous-week"]').classes()).toContain(
      'workflow-shortcut-choice-card--active',
    )
    await wrapper.get('[data-testid="reconciliation-step-primary"]').trigger('click')
    await flushPromises()

    const payload = runSavedRunDiff.mock.calls[0]?.[0]
    expect(payload).toEqual({
      savedRunId: 'RS_API_ORDER_SYNC',
      file1SystemEnumId: 'OMS',
      file2SystemEnumId: 'SHOPIFY',
      windowStartDate: expectedWindowPayloadDate(2026, 4, 9),
      windowEndDate: expectedWindowPayloadDate(2026, 4, 17),
      windowStartLocalDate: '2026-05-09',
      windowEndLocalDate: '2026-05-17',
      hasHeader: true,
    })
  })

  it('uses the previous calendar month for API previous-month presets', async () => {
    vi.setSystemTime(new Date(2026, 4, 2, 12, 0, 0))
    route.query = {
      savedRunId: 'RS_API_ORDER_SYNC',
      runName: 'API Order Sync',
      file1SystemLabel: 'HotWax',
      file2SystemLabel: 'SHOPIFY',
    }
    listSavedRuns.mockResolvedValue(apiSavedRunResponse)
    runSavedRunDiff.mockResolvedValue({
      ok: true,
      messages: ['Generated API-Order-Sync-result.json.'],
      errors: [],
      runResult: {
        savedRunId: 'RS_API_ORDER_SYNC',
        runName: 'API Order Sync',
        runType: 'ruleset',
        ruleSetId: 'RS_API_ORDER_SYNC',
        compareScopeId: 'CS_API_ORDER_SYNC',
        file1SystemEnumId: 'OMS',
        file2SystemEnumId: 'SHOPIFY',
        validationErrors: [],
        processingWarnings: [],
        generatedOutput: {
          fileName: 'API-Order-Sync-result.json',
          savedRunId: 'RS_API_ORDER_SYNC',
          savedRunType: 'ruleset',
          totalDifferences: 0,
          onlyInFile1Count: 0,
          onlyInFile2Count: 0,
        },
      },
    })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="api-window-preset-previous-month"]').text()).toContain(
      'Previous Month, April 2026',
    )
    await wrapper.get('[data-testid="api-window-preset-previous-month"]').trigger('click')
    await wrapper.get('[data-testid="reconciliation-step-primary"]').trigger('click')
    await flushPromises()

    expect(runSavedRunDiff.mock.calls[0]?.[0]).toMatchObject({
      windowStartDate: expectedWindowPayloadDate(2026, 3, 1),
      windowEndDate: expectedWindowPayloadDate(2026, 4, 1),
      windowStartLocalDate: '2026-04-01',
      windowEndLocalDate: '2026-05-01',
    })
  })

  it('asks for an API time period and only uploads the file-backed side for mixed saved runs', async () => {
    stubFileReader()
    route.query = {
      savedRunId: 'RS_MIXED_ORDER_SYNC',
      runName: 'Mixed Order Sync',
      file1SystemLabel: 'HotWax',
      file2SystemLabel: 'SHOPIFY',
    }
    listSavedRuns.mockResolvedValue(mixedApiFileSavedRunResponse)
    runSavedRunDiff.mockResolvedValue({
      ok: true,
      messages: ['Generated Mixed-Order-Sync-result.json.'],
      errors: [],
      runResult: {
        savedRunId: 'RS_MIXED_ORDER_SYNC',
        runName: 'Mixed Order Sync',
        runType: 'ruleset',
        ruleSetId: 'RS_MIXED_ORDER_SYNC',
        compareScopeId: 'CS_MIXED_ORDER_SYNC',
        file1SystemEnumId: 'OMS',
        file2SystemEnumId: 'SHOPIFY',
        validationErrors: [],
        processingWarnings: [],
        generatedOutput: {
          fileName: 'Mixed-Order-Sync-result.json',
          savedRunId: 'RS_MIXED_ORDER_SYNC',
          savedRunType: 'ruleset',
          totalDifferences: 1,
          onlyInFile1Count: 1,
          onlyInFile2Count: 0,
        },
      },
    })

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Which API time period should we use?')
    expect(wrapper.find('[data-testid="file1-input"]').exists()).toBe(false)
    await wrapper.get('[data-testid="api-window-preset-custom"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Select custom dates')
    expect(wrapper.find('[data-testid="api-window-custom-range-field"]').exists()).toBe(false)
    expect(wrapper.find('input[type="date"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="api-window-custom-start"]').text()).toContain('mm/dd/yyyy')
    expect(wrapper.get('[data-testid="api-window-custom-end"]').text()).toContain('mm/dd/yyyy')
    expect(wrapper.text()).toContain('April 2026')
    expect(wrapper.text()).toContain('May 2026')
    expect(wrapper.text()).not.toContain('June 2026')
    expect(wrapper.find('[data-testid="api-window-custom-next-month"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="api-window-custom-day-2026-05-18"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-testid="api-window-custom-day-2026-05-18"]').trigger('click')
    expect(wrapper.get('[data-testid="api-window-custom-start"]').text()).toContain('mm/dd/yyyy')
    expect(wrapper.get('[data-testid="api-window-custom-day-2026-05-01"] .wizard-api-calendar-day__label').text()).toBe('1')
    await wrapper.get('[data-testid="api-window-custom-day-2026-05-01"]').trigger('click')
    expect(wrapper.get('[data-testid="api-window-custom-start"]').text()).toContain('05/01/2026')
    await wrapper.get('[data-testid="api-window-custom-day-2026-05-02"]').trigger('click')
    expect(wrapper.get('[data-testid="api-window-custom-end"]').text()).toContain('05/02/2026')
    await wrapper.get('[data-testid="reconciliation-step-primary"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Upload the Shopify CSV file')
    expect(wrapper.find('[data-testid="file1-input"]').exists()).toBe(false)

    const file2Input = wrapper.get('[data-testid="file2-input"]')
    Object.defineProperty(file2Input.element, 'files', {
      value: [new File(['order_id\n1002\n1003\n'], 'shopify-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file2Input.trigger('change')
    await wrapper.get('[data-testid="reconciliation-step-primary"]').trigger('click')
    await flushPromises()

    const payload = runSavedRunDiff.mock.calls[0]?.[0]
    expect(payload).toEqual({
      savedRunId: 'RS_MIXED_ORDER_SYNC',
      file2Name: 'shopify-orders.csv',
      file2Text: 'order_id\n1002\n1003\n',
      file1SystemEnumId: 'OMS',
      file2SystemEnumId: 'SHOPIFY',
      windowStartDate: expectedWindowPayloadDate(2026, 4, 1),
      windowEndDate: expectedWindowPayloadDate(2026, 4, 3),
      windowStartLocalDate: '2026-05-01',
      windowEndLocalDate: '2026-05-03',
      hasHeader: true,
    })
  })

  it('keeps the custom API calendar constrained to the workflow column', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationDiffPage.vue', 'utf8')

    expect(source).toMatch(/\.reconciliation-diff-layout\s*\{[^}]*min-width: 0;/s)
    expect(source).toMatch(/\.wizard-api-calendar-grid\s*\{[^}]*width: 100%;[^}]*min-width: 0;[^}]*max-width: 100%;/s)
    expect(source).toMatch(/\.wizard-api-calendar-weekdays,\n\.wizard-api-calendar-days\s*\{[^}]*grid-template-columns: repeat\(7, minmax\(0, 1fr\)\);/s)
    expect(source).toMatch(/\.wizard-api-calendar-day__label\s*\{[^}]*inline-size: min\(1\.95rem, 100%\);[^}]*min-width: 0;/s)
  })

  it('does not allow outside-month calendar cells to be selected or highlighted', async () => {
    route.query = {
      savedRunId: 'RS_MIXED_ORDER_SYNC',
      runName: 'Mixed Order Sync',
      file1SystemLabel: 'HotWax',
      file2SystemLabel: 'SHOPIFY',
    }
    listSavedRuns.mockResolvedValue(mixedApiFileSavedRunResponse)

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    await wrapper.get('[data-testid="api-window-preset-custom"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="api-window-custom-day-2026-04-01"]').trigger('click')
    await wrapper.get('[data-testid="api-window-custom-day-2026-04-29"]').trigger('click')

    const mayMonth = wrapper.findAll('.wizard-api-calendar-month')[1]!
    const mayMonthDays = mayMonth.findAll('.wizard-api-calendar-day')
    const outsideApril29InMay = mayMonthDays[3]!
    const outsideApril30InMay = mayMonthDays[4]!

    expect(outsideApril29InMay.text()).toBe('29')
    expect(outsideApril29InMay.attributes('disabled')).toBeDefined()
    expect(outsideApril29InMay.classes()).toContain('wizard-api-calendar-day--outside')
    expect(outsideApril29InMay.classes()).toContain('wizard-api-calendar-day--disabled')
    expect(outsideApril29InMay.classes()).not.toContain('wizard-api-calendar-day--range-end')
    expect(outsideApril29InMay.classes()).not.toContain('wizard-api-calendar-day--in-range')

    await outsideApril30InMay.trigger('click')
    expect(wrapper.get('[data-testid="api-window-custom-end"]').text()).toContain('04/29/2026')
  })

  it('keeps the latest saved result board in the normal workflow layout', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationDiffPage.vue', 'utf8')
    const layoutBlock = source.match(/\.reconciliation-diff-layout\s*\{(?<body>[^}]*)\}/s)?.groups?.body ?? ''
    const boardBlock = source.match(/\.reconciliation-run-history-board\s*\{(?<body>[^}]*)\}/s)?.groups?.body ?? ''

    expect(layoutBlock).toContain('gap: var(--space-5);')
    expect(boardBlock).not.toContain('position: fixed;')
    expect(boardBlock).toContain('width: min(var(--workflow-question-width), 100%);')
    expect(boardBlock).toContain('justify-self: center;')
  })

  it('surfaces validation feedback when the backend blocks an invalid saved-run diff', async () => {
    stubFileReader()
    route.query = {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      file1SystemLabel: 'OMS',
      file2SystemLabel: 'SHOPIFY',
    }
    runSavedRunDiff.mockRejectedValue(
      new ApiCallError('Schema validation failed. OMS: missing required property order_id', 400, {
        result: {
          ok: false,
          errors: ['Schema validation failed. OMS: missing required property order_id'],
          validationErrors: ['OMS: missing required property order_id'],
          processingWarnings: [],
        },
      }),
    )

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    const file1Input = wrapper.get('[data-testid="file1-input"]')
    Object.defineProperty(file1Input.element, 'files', {
      value: [new File(['order_id\n1001\n1002\n'], 'oms-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file1Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    const file2Input = wrapper.get('[data-testid="file2-input"]')
    Object.defineProperty(file2Input.element, 'files', {
      value: [new File(['order_id\n1002\n1003\n'], 'shopify-orders.csv', { type: 'text/csv' })],
      configurable: true,
    })
    await file2Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Schema validation failed. OMS: missing required property order_id')
    expect(wrapper.text()).toContain('OMS: missing required property order_id')
    expect(push).not.toHaveBeenCalled()
  })

  it('blocks schema json uploads before calling the saved-run diff API', async () => {
    class SchemaFileReader {
      result: string | ArrayBuffer | null = null
      onload: null | (() => void) = null
      onerror: null | (() => void) = null

      readAsText(): void {
        this.result = JSON.stringify({
          $schema: 'http://json-schema.org/draft-07/schema#',
          type: 'array',
          items: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
            },
          },
        })
        this.onload?.()
      }
    }

    vi.stubGlobal('FileReader', SchemaFileReader as unknown as typeof FileReader)
    route.query = {
      savedRunId: 'RS_ORDER_CSV',
      runName: 'CSV Order Compare',
      file1SystemLabel: 'OMS',
      file2SystemLabel: 'SHOPIFY',
    }

    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    const file1Input = wrapper.get('[data-testid="file1-input"]')
    Object.defineProperty(file1Input.element, 'files', {
      value: [new File(['{}'], 'Gorjana-OMS-Order.json', { type: 'application/json' })],
      configurable: true,
    })
    await file1Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    const file2Input = wrapper.get('[data-testid="file2-input"]')
    Object.defineProperty(file2Input.element, 'files', {
      value: [new File(['{}'], 'Gorjana-Shopify-Orders.json', { type: 'application/json' })],
      configurable: true,
    })
    await file2Input.trigger('change')
    await wrapper.get('.workflow-step-shell').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('OMS expects CSV data for this saved run.')
    expect(wrapper.text()).toContain('Gorjana-OMS-Order.json looks like a JSON Schema file.')
    expect(runSavedRunDiff).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('allows selecting a saved run from the workflow dropdown before upload', async () => {
    const wrapper = mount(ReconciliationDiffPage)
    await flushPromises()

    await chooseWorkflowOption(wrapper, 'saved-run-select', 'RS_ORDER_CSV')
    await wrapper.get('[data-testid="reconciliation-step-primary"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Upload the OMS CSV file')
    expect(listGeneratedOutputs).toHaveBeenCalledWith(
      {
        savedRunId: 'RS_ORDER_CSV',
        pageIndex: 0,
        pageSize: 1,
        query: '',
      },
      expect.any(AbortSignal),
    )
  })
})
