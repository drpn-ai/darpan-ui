import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  buildReconciliationAutomationDraftState,
} from '../../../lib/reconciliationAutomationDraft'

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const route = vi.hoisted(() => ({
  name: 'reconciliation-automation-create',
  fullPath: '/reconciliation/automations/create',
  params: {} as Record<string, string>,
}))
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const getAutomation = vi.hoisted(() => vi.fn())
const saveAutomation = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
  useRoute: () => route,
}))

vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    listAutomationSourceOptions,
    getAutomation,
    saveAutomation,
  },
}))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null,
  automationDraftState: null as null | { draft: unknown, resumeStepId: string | null, savedRun: unknown | null },
  setWorkflowOrigin: vi.fn(function (this: { workflowOrigin: { label: string, path: string } | null }, label: string, path: string) {
    this.workflowOrigin = { label, path }
  }),
  clearWorkflowOrigin: vi.fn(),
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
  setAutomationDraft: vi.fn(),
  clearAutomationDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import ReconciliationAutomationWorkflowPage from '../ReconciliationAutomationWorkflowPage.vue'

function optionsResponse() {
  return {
    ok: true,
    messages: [],
    errors: [],
    inputModes: [
      { enumId: 'AUT_IN_API_RANGE', label: 'API date-range extraction' },
      { enumId: 'AUT_IN_SFTP_FILES', label: 'SFTP file inputs' },
      { enumId: 'AUT_IN_SFTP_POLL', label: 'SFTP_POLL' },
    ],
    sourceTypes: [],
    relativeWindows: [
      { enumId: 'AUT_WIN_PREV_DAY', label: 'Previous calendar day' },
      { enumId: 'AUT_WIN_PREV_WEEK', label: 'Previous calendar week' },
      { enumId: 'AUT_WIN_PREV_MONTH', label: 'Previous month' },
      { enumId: 'AUT_WIN_LAST_DAYS', label: 'Last N days' },
      { enumId: 'AUT_WIN_LAST_WEEKS', label: 'Last N weeks' },
      { enumId: 'AUT_WIN_LAST_MONTHS', label: 'Last N months' },
      { enumId: 'AUT_WIN_CUSTOM', label: 'Custom date range' },
    ],
    fileTypes: [],
    systems: [],
    savedRuns: [
      {
        savedRunId: 'RS_ORDER_SYNC',
        runName: 'Order Sync',
        runType: 'ruleset',
        ruleSetId: 'RS_ORDER_SYNC',
        compareScopeId: 'CS_ORDER_SYNC',
        requiresSystemSelection: false,
        defaultFile1SystemEnumId: 'OMS',
        defaultFile2SystemEnumId: 'SHOPIFY',
        systemOptions: [
          {
            fileSide: 'FILE_1',
            enumId: 'OMS',
            label: 'OMS',
            fileTypeEnumId: 'DftCsv',
            schemaFileName: 'oms.csv',
            idFieldExpression: 'order_id',
          },
          {
            fileSide: 'FILE_2',
            enumId: 'SHOPIFY',
            label: 'Shopify',
            fileTypeEnumId: 'DftJson',
            schemaFileName: 'shopify.schema.json',
            idFieldExpression: '$.orders[0].id',
          },
        ],
      },
    ],
    sftpServers: [
      { sftpServerId: 'SFTP_OMS', label: 'OMS SFTP' },
      { sftpServerId: 'SFTP_SHOPIFY', label: 'Shopify SFTP' },
    ],
    nsRestletConfigs: [
      { nsRestletConfigId: 'NS_INVENTORY', label: 'NetSuite inventory', isActive: 'Y', systemEnumId: 'NETSUITE' },
    ],
    systemRemotes: [
      {
        systemMessageRemoteId: 'OMS_REMOTE',
        label: 'OMS orders',
        systemEnumId: 'OMS',
        optionKey: 'OMS_REST_SOURCE',
        safeMetadataJson: '{"extractServiceName":"reconciliation.HotWaxOmsExtractionServices.extract#HotWaxOmsOrders","parameters":{"omsRestSourceConfigId":"OMS_REST_SOURCE"}}',
      },
      {
        systemMessageRemoteId: 'SHOPIFY_REMOTE',
        label: 'Shopify orders',
        systemEnumId: 'SHOPIFY',
        optionKey: 'SHOPIFY_ORDERS',
        safeMetadataJson: '{"extractServiceName":"fixture.extractShopifyOrders"}',
      },
      { systemMessageRemoteId: 'DARPAN_DB', label: 'Darpan test DB' },
    ],
  }
}

function apiSavedRun() {
  const savedRun = optionsResponse().savedRuns[0]!
  return {
    ...savedRun,
    runName: 'API Order Sync',
    systemOptions: [
      {
        ...savedRun.systemOptions[0]!,
        sourceTypeEnumId: 'AUT_SRC_API',
        sourceTypeLabel: 'API',
        systemMessageRemoteId: 'OMS_REMOTE',
        systemMessageRemoteLabel: 'OMS orders',
        sourceConfigId: 'OMS_REST_SOURCE',
        sourceConfigType: 'SYSTEM_MESSAGE_REMOTE_OPTION',
      },
      {
        ...savedRun.systemOptions[1]!,
        sourceTypeEnumId: 'AUT_SRC_API',
        sourceTypeLabel: 'API',
        systemMessageRemoteId: 'SHOPIFY_REMOTE',
        systemMessageRemoteLabel: 'Shopify orders',
        sourceConfigId: 'SHOPIFY_ORDERS',
        sourceConfigType: 'SYSTEM_MESSAGE_REMOTE_OPTION',
      },
    ],
  }
}

function optionsResponseWithMultipleApiSources() {
  const response = optionsResponse()
  return {
    ...response,
    systemRemotes: [
      ...response.systemRemotes,
      {
        systemMessageRemoteId: 'OMS_REMOTE_BACKUP',
        label: 'OMS orders backup',
        systemEnumId: 'OMS',
        optionKey: 'OMS_REST_SOURCE_BACKUP',
        safeMetadataJson: '{"extractServiceName":"fixture.extractOmsOrdersBackup"}',
      },
      {
        systemMessageRemoteId: 'SHOPIFY_REMOTE_BACKUP',
        label: 'Shopify orders backup',
        systemEnumId: 'SHOPIFY',
        optionKey: 'SHOPIFY_ORDERS_BACKUP',
        safeMetadataJson: '{"extractServiceName":"fixture.extractShopifyOrdersBackup"}',
      },
    ],
  }
}

async function chooseCard(wrapper: ReturnType<typeof mount>, testId: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
}

async function chooseWorkflowOption(wrapper: ReturnType<typeof mount>, testId: string, value: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="workflow-select-option"][data-option-value="${value}"]`).trigger('click')
}

function scheduleFieldLabels(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('.automation-schedule-field > .automation-schedule-label').map((label) => label.text())
}

describe('ReconciliationAutomationWorkflowPage', () => {
  beforeEach(() => {
    route.name = 'reconciliation-automation-create'
    route.fullPath = '/reconciliation/automations/create'
    route.params = {}
    push.mockClear()
    getAutomation.mockReset()
    saveAutomation.mockReset()
    listAutomationSourceOptions.mockReset()
    draftStoreState.workflowOrigin = null
    draftStoreState.ruleSetDraftState = null
    draftStoreState.automationDraftState = null
    draftStoreState.setWorkflowOrigin.mockClear()
    draftStoreState.setAutomationDraft.mockClear()
    window.history.replaceState({}, '', '/')
    window.sessionStorage.clear()
    listAutomationSourceOptions.mockResolvedValue(optionsResponse())
    saveAutomation.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      automation: {
        automationId: 'AUT_ORDER_SYNC',
        automationName: 'Daily order sync',
      },
    })
  })

  it('starts with a single branch decision and routes new-reconciliation automation to the create flow', async () => {
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('What is this automation for?')
    expect(wrapper.text()).toContain('Automate an existing reconciliation')
    expect(wrapper.text()).toContain('Create a new reconciliation and automate it')

    await chooseCard(wrapper, 'automation-purpose-choice-new-run')

    expect(push).toHaveBeenCalledWith(expect.objectContaining({
      path: '/reconciliation/create',
      query: { automationFlow: 'new-run' },
    }))
    expect(draftStoreState.setAutomationDraft).toHaveBeenCalled()
    const callArgs = draftStoreState.setAutomationDraft.mock.calls[0]
    expect(callArgs?.[0]).toMatchObject({ intent: 'new-run' })
    expect(callArgs?.[1]).toBe('input-mode')
  })

  it('routes new-reconciliation automation when the B shortcut is pressed', async () => {
    const wrapper = mount(ReconciliationAutomationWorkflowPage, { attachTo: document.body })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    await flushPromises()

    expect(push).toHaveBeenCalledWith(expect.objectContaining({
      path: '/reconciliation/create',
      query: { automationFlow: 'new-run' },
    }))
    expect(draftStoreState.setAutomationDraft).toHaveBeenCalled()
    const callArgs = draftStoreState.setAutomationDraft.mock.calls[0]
    expect(callArgs?.[0]).toMatchObject({ intent: 'new-run' })
    expect(callArgs?.[1]).toBe('input-mode')

    wrapper.unmount()
  })

  it('resumes a newly created run at automation setup instead of the final name step', async () => {
    const savedRun = optionsResponse().savedRuns[0]!
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
        {
          intent: 'new-run',
          savedRunId: savedRun.savedRunId,
          savedRunType: savedRun.runType,
          automationName: 'Order Sync Automation',
          returnLabel: 'Automations',
          returnPath: '/reconciliation/automations',
        },
        'input-mode',
        savedRun,

    )

    window.history.replaceState({}, '', '/reconciliation/automation/create')

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('How will Darpan get source data for Order Sync?')
    expect(wrapper.find('[data-testid="automation-saved-run-select"]').exists()).toBe(false)
    expect(wrapper.find('.wizard-back').exists()).toBe(false)
    expect(wrapper.get('.wizard-progress').attributes('aria-valuenow')).toBe('14.29')
    expect(wrapper.text()).not.toContain('What should this automation be called?')
    expect(wrapper.find('[data-testid="automation-input-mode-choice-AUT_IN_SFTP_FILES"]').exists()).toBe(true)
  })

  it('skips saved-run selection when existing-run automation has a single saved run', async () => {
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseCard(wrapper, 'automation-purpose-choice-existing-run')

    expect(wrapper.find('[data-testid="automation-saved-run-select"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('How will Darpan get source data for Order Sync?')
  })

  it('skips source acquisition mode for a newly created run when both saved-run sources are API', async () => {
    const savedRun = apiSavedRun()
    const response = optionsResponse()
    listAutomationSourceOptions.mockResolvedValue({
      ...response,
      systemRemotes: response.systemRemotes.filter((remote) => remote.systemEnumId !== 'SHOPIFY'),
    })
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
        {
          intent: 'new-run',
          savedRunId: savedRun.savedRunId,
          savedRunType: savedRun.runType,
          automationName: 'API Order Sync Automation',
          returnLabel: 'Automations',
          returnPath: '/reconciliation/automations',
        },
        'input-mode',
        savedRun,

    )

    window.history.replaceState({}, '', '/reconciliation/automation/create')

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('How will Darpan get source data')
    expect(wrapper.find('[data-testid="automation-input-mode-choice-AUT_IN_API_RANGE"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-input-mode-choice-AUT_IN_SFTP_FILES"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('How far back should each scheduled run reconcile?')
    expect(wrapper.find('[data-testid="automation-file1-api-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-file2-api-select"]').exists()).toBe(false)
  })

  it('skips preselected API source steps for a new-run draft restored from saved-run options', async () => {
    const savedRun = apiSavedRun()
    listAutomationSourceOptions.mockResolvedValue({
      ...optionsResponse(),
      savedRuns: [savedRun],
    })
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
        {
          intent: 'new-run',
          savedRunId: savedRun.savedRunId,
          savedRunType: savedRun.runType,
          automationName: 'API Order Sync Automation',
          inputModeEnumId: 'AUT_IN_API_RANGE',
          returnLabel: 'Automations',
          returnPath: '/reconciliation/automations',
        },
        'file1-api',
        null,

    )

    window.history.replaceState({}, '', '/reconciliation/automation/create')

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Which OMS API source provides the first file?')
    expect(wrapper.find('[data-testid="automation-file1-api-select"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('How far back should each scheduled run reconcile?')
  })

  it('skips single-option API source steps after API mode is selected', async () => {
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseCard(wrapper, 'automation-purpose-choice-existing-run')
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_API_RANGE')

    expect(wrapper.text()).toContain('How far back should each scheduled run reconcile?')
    expect(wrapper.find('[data-testid="automation-file1-api-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-file2-api-select"]').exists()).toBe(false)
  })

  it('skips single-option SFTP server steps after SFTP mode is selected', async () => {
    listAutomationSourceOptions.mockResolvedValue({
      ...optionsResponse(),
      sftpServers: [{ sftpServerId: 'SFTP_DEFAULT', label: 'Default SFTP' }],
    })
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseCard(wrapper, 'automation-purpose-choice-existing-run')
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_SFTP_FILES')

    expect(wrapper.text()).toContain('Where is the first remote file?')
    expect(wrapper.find('[data-testid="automation-file1-sftp-select"]').exists()).toBe(false)
  })

  it('saves an existing-run SFTP automation without showing or sending API date-window fields', async () => {
    listAutomationSourceOptions.mockResolvedValue({
      ...optionsResponse(),
      savedRuns: [
        optionsResponse().savedRuns[0],
        {
          ...optionsResponse().savedRuns[0],
          savedRunId: 'RS_INVENTORY_SYNC',
          runName: 'Inventory Sync',
        },
      ],
    })
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseCard(wrapper, 'automation-purpose-choice-existing-run')
    expect(wrapper.get('.wizard-progress').attributes('aria-valuenow')).toBe('22.22')
    await chooseWorkflowOption(wrapper, 'automation-saved-run-select', 'RS_ORDER_SYNC')
    expect(wrapper.find('[data-testid="automation-selected-run"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('SFTP scheduled file pickup')
    expect(wrapper.text()).not.toContain('SFTP_POLL')
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_SFTP_FILES')
    await chooseWorkflowOption(wrapper, 'automation-file1-sftp-select', 'SFTP_OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file1RemotePathTemplate"]').setValue('/oms/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'automation-file2-sftp-select', 'SFTP_SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file2RemotePathTemplate"]').setValue('/shopify/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).not.toContain('date window')

    expect(wrapper.text()).toContain('When should Darpan run this automation?')
    expect(wrapper.text()).not.toContain('Generated cron')
    expect(wrapper.find('[data-testid="automation-schedule-cron-input"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Manual')
    expect(wrapper.text()).not.toContain('Every hour')
    expect(wrapper.text()).not.toContain('Custom cron')
    expect(wrapper.get('[data-testid="automation-schedule-preset"]').element.tagName).toBe('BUTTON')
    await chooseWorkflowOption(wrapper, 'automation-schedule-preset', 'weekly')
    expect(scheduleFieldLabels(wrapper)).toEqual(['Run', 'Day', 'Time', 'Timezone'])
    expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toBe('UTC')
    await chooseWorkflowOption(wrapper, 'automation-schedule-preset', 'monthly')
    expect(scheduleFieldLabels(wrapper)).toEqual(['Run', 'Date', 'Time', 'Timezone'])
    await chooseWorkflowOption(wrapper, 'automation-schedule-preset', 'weekly')
    await wrapper.get('[data-testid="automation-schedule-time"]').setValue('07:30')
    expect(wrapper.get('[data-testid="automation-schedule-weekday"]').element.tagName).toBe('BUTTON')
    await chooseWorkflowOption(wrapper, 'automation-schedule-weekday', 'TUE')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="automationName"]').setValue('Daily order sync')
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith({
      automationName: 'Daily order sync',
      savedRunId: 'RS_ORDER_SYNC',
      savedRunType: 'ruleset',
      inputModeEnumId: 'AUT_IN_SFTP_FILES',
      scheduleExpr: '0 30 7 ? * TUE',
      windowTimeZone: 'UTC',
      isActive: true,
      maxWindowDays: 28,
      splitWindowDays: 28,
      sources: [
        expect.objectContaining({
          fileSide: 'FILE_1',
          sourceTypeEnumId: 'AUT_SRC_SFTP',
          systemEnumId: 'OMS',
          sftpServerId: 'SFTP_OMS',
          remotePathTemplate: '/oms/{{date}}',
        }),
        expect.objectContaining({
          fileSide: 'FILE_2',
          sourceTypeEnumId: 'AUT_SRC_SFTP',
          systemEnumId: 'SHOPIFY',
          sftpServerId: 'SFTP_SHOPIFY',
          remotePathTemplate: '/shopify/{{date}}',
        }),
      ],
    }, expect.any(AbortSignal))
  })

  it('saves an existing-run API automation with endpoint and date-window fields', async () => {
    listAutomationSourceOptions.mockResolvedValue({
      ...optionsResponseWithMultipleApiSources(),
      savedRuns: [
        optionsResponse().savedRuns[0],
        {
          ...optionsResponse().savedRuns[0],
          savedRunId: 'RS_INVENTORY_SYNC',
          runName: 'Inventory Sync',
        },
      ],
    })
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseCard(wrapper, 'automation-purpose-choice-existing-run')
    await chooseWorkflowOption(wrapper, 'automation-saved-run-select', 'RS_ORDER_SYNC')
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_API_RANGE')
    await wrapper.get('[data-testid="automation-file1-api-select"]').trigger('click')
    expect(wrapper.text()).toContain('OMS orders')
    expect(wrapper.text()).not.toContain('Shopify orders')
    expect(wrapper.text()).not.toContain('Darpan test DB')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="remote:OMS_REMOTE:OMS_REST_SOURCE"]').trigger('click')
    await wrapper.get('[data-testid="automation-file2-api-select"]').trigger('click')
    expect(wrapper.text()).toContain('Shopify orders')
    expect(wrapper.text()).not.toContain('OMS orders')
    expect(wrapper.text()).not.toContain('NetSuite inventory')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="remote:SHOPIFY_REMOTE:SHOPIFY_ORDERS"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'automation-window-select', 'AUT_WIN_PREV_WEEK')
    expect(wrapper.find('[data-testid="automation-window-count-input"]').exists()).toBe(false)
    await wrapper.get('[data-testid="automation-window-select"]').trigger('click')
    expect(wrapper.text()).toContain('Last N months')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="AUT_WIN_CUSTOM"]').trigger('click')
    expect(wrapper.find('[data-testid="automation-custom-window-start"]').exists()).toBe(true)
    await wrapper.get('[data-testid="automation-custom-window-start"]').setValue('2026-04-01')
    await wrapper.get('[data-testid="automation-custom-window-end"]').setValue('2026-04-30')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.get('[data-testid="automation-schedule-preset"]').element.tagName).toBe('BUTTON')
    expect(wrapper.find('[data-testid="automation-schedule-cron-input"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Custom cron')
    await chooseWorkflowOption(wrapper, 'automation-schedule-preset', 'hourly')
    await wrapper.get('[data-testid="automation-schedule-minute"]').setValue('10')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="automationName"]').setValue('Daily API orders')
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({
      automationName: 'Daily API orders',
      savedRunId: 'RS_ORDER_SYNC',
      inputModeEnumId: 'AUT_IN_API_RANGE',
      scheduleExpr: '0 10 * * * ?',
      relativeWindowTypeEnumId: 'AUT_WIN_CUSTOM',
      customWindowStartDate: '2026-04-01T00:00:00.000Z',
      customWindowEndDate: '2026-05-01T00:00:00.000Z',
    }), expect.any(AbortSignal))
    expect(saveAutomation.mock.calls[0]?.[0].sources).toEqual([
      expect.objectContaining({
        fileSide: 'FILE_1',
        sourceTypeEnumId: 'AUT_SRC_API',
        systemMessageRemoteId: 'OMS_REMOTE',
        safeMetadataJson: '{"extractServiceName":"reconciliation.HotWaxOmsExtractionServices.extract#HotWaxOmsOrders","parameters":{"omsRestSourceConfigId":"OMS_REST_SOURCE"}}',
      }),
      expect.objectContaining({
        fileSide: 'FILE_2',
        sourceTypeEnumId: 'AUT_SRC_API',
        systemMessageRemoteId: 'SHOPIFY_REMOTE',
      }),
    ])
  })

  it('opens the current automation in a single-page edit workflow', async () => {
    route.name = 'reconciliation-automation-edit'
    route.fullPath = '/reconciliation/automations/edit/AUT_ORDER_SYNC'
    route.params = { automationId: 'AUT_ORDER_SYNC' }
    getAutomation.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      automation: {
        automationId: 'AUT_ORDER_SYNC',
        automationName: 'Daily order sync',
        savedRunId: 'RS_ORDER_SYNC',
        savedRunName: 'Order Sync',
        savedRunType: 'ruleset',
        savedRun: optionsResponse().savedRuns[0],
        inputModeEnumId: 'AUT_IN_API_RANGE',
        scheduleExpr: '0 0 6 * * ?',
        timezone: 'UTC',
        relativeWindowTypeEnumId: 'AUT_WIN_PREV_DAY',
        relativeWindowCount: 1,
        active: true,
        sources: [
          {
            fileSide: 'FILE_1',
            sourceTypeEnumId: 'AUT_SRC_API',
            systemEnumId: 'OMS',
            systemMessageRemoteId: 'OMS_REMOTE',
            safeMetadataJson: '{"extractServiceName":"reconciliation.HotWaxOmsExtractionServices.extract#HotWaxOmsOrders","parameters":{"omsRestSourceConfigId":"OMS_REST_SOURCE"}}',
          },
          {
            fileSide: 'FILE_2',
            sourceTypeEnumId: 'AUT_SRC_API',
            systemEnumId: 'SHOPIFY',
            systemMessageRemoteId: 'SHOPIFY_REMOTE',
            safeMetadataJson: '{"extractServiceName":"fixture.extractShopifyOrders"}',
          },
        ],
      },
    })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(getAutomation).toHaveBeenCalledWith({ automationId: 'AUT_ORDER_SYNC' }, expect.any(AbortSignal))
    expect(wrapper.find('.workflow-page--edit').exists()).toBe(true)
    expect(wrapper.find('.wizard-progress').exists()).toBe(false)
    expect(wrapper.get('form').classes()).toContain('workflow-form--edit-single-page')
    expect(wrapper.text()).toContain('Update the automation setup.')
    expect(wrapper.text()).not.toContain('What should this automation be called?')
    expect((wrapper.get('input[name="automationName"]').element as HTMLInputElement).value).toBe('Daily order sync')
    const primaryFields = wrapper.get('[data-testid="automation-edit-primary-fields"]')
    expect(primaryFields.find('[data-testid="automation-edit-active-field"]').exists()).toBe(false)
    const windowFields = wrapper.get('[data-testid="automation-edit-window-fields"]')
    const activeField = windowFields.get('[data-testid="automation-edit-active-field"]')
    expect(activeField.get('.workflow-context-label').text()).toBe('Status')
    const activeSelect = activeField.get('[data-testid="automation-edit-active"]')
    expect(activeSelect.element.tagName).toBe('BUTTON')
    expect(activeSelect.text()).toBe('Active')
    expect(activeField.find('input[name="isActive"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-schedule-fields"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automation-edit-saved-run-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automation-edit-input-mode-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-file1-api-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-file2-api-select"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Input')
    expect(wrapper.text()).not.toContain('API Source')
    expect(wrapper.find('[data-testid="automation-window-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automation-schedule-preset"]').exists()).toBe(true)
    expect(wrapper.find('input[data-testid="automation-schedule-timezone"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="automation-schedule-timezone"]').element.tagName).toBe('SPAN')
    expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toBe('UTC')
    expect(wrapper.find('[data-testid="cancel-automation-edit"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="save-automation"]').attributes('aria-label')).toBe('Save Automation')
    expect(wrapper.get('[data-testid="save-automation"]').attributes('disabled')).toBeUndefined()
    await chooseWorkflowOption(wrapper, 'automation-edit-active', 'inactive')
    expect(wrapper.get('[data-testid="automation-edit-active"]').text()).toBe('Inactive')
    await wrapper.get('input[name="automationName"]').setValue('Daily order sync updated')
    expect(wrapper.get('[data-testid="save-automation"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="save-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({
      automationId: 'AUT_ORDER_SYNC',
      automationName: 'Daily order sync updated',
      savedRunId: 'RS_ORDER_SYNC',
      inputModeEnumId: 'AUT_IN_API_RANGE',
      scheduleExpr: '0 0 6 * * ?',
      relativeWindowTypeEnumId: 'AUT_WIN_PREV_DAY',
      isActive: false,
    }), expect.any(AbortSignal))
    expect(push).toHaveBeenCalledWith({
      name: 'reconciliation-automation-dashboard',
      params: { automationId: 'AUT_ORDER_SYNC' },
    })
  })
})
