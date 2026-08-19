import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
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
const getUserNotificationDefault = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const saveTenantChatSpace = vi.hoisted(() => vi.fn())

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
  settingsFacade: {
    getUserNotificationDefault,
    listTenantChatSpaces,
    saveTenantChatSpace,
  },
}))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null,
  automationDraftState: null as null | { draft: unknown, resumeStepId: string | null, savedRun: unknown | null },
  setWorkflowOrigin: vi.fn(function (this: { workflowOrigin: { label: string, path: string } | null }, label: string, path: string) {
    this.workflowOrigin = { label, path }
  }),
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
  setAutomationDraft: vi.fn(),
  clearAutomationDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

const authStoreState = vi.hoisted(() => ({
  sessionInfo: null as null | { tenantTimeZone?: string, userTimeZone?: string },
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authStoreState,
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

/** Purpose then saved run. The saved-run step is always asked — a single saved run only PRE-FILLS
 *  it — so every existing-run walk answers it before automation setup begins. Pass savedRunId when
 *  the fixture holds more than one run and nothing can be pre-filled. */
async function chooseExistingRunPurpose(wrapper: ReturnType<typeof mount>, savedRunId?: string): Promise<void> {
  await chooseCard(wrapper, 'automation-purpose-choice-existing-run')
  if (savedRunId) await chooseWorkflowOption(wrapper, 'automation-saved-run-select', savedRunId)
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')
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
    getUserNotificationDefault.mockReset()
    listTenantChatSpaces.mockReset()
    saveTenantChatSpace.mockReset()
    authStoreState.sessionInfo = null
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
    getUserNotificationDefault.mockResolvedValue({ ok: true, messages: [], errors: [] })
    listTenantChatSpaces.mockResolvedValue({ ok: true, messages: [], errors: [], chatSpaces: [] })
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
    expect(wrapper.get('.wizard-progress').attributes('aria-valuenow')).toBe('12.5')
    expect(wrapper.text()).not.toContain('What should this automation be called?')
    expect(wrapper.find('[data-testid="automation-input-mode-choice-AUT_IN_SFTP_FILES"]').exists()).toBe(true)
  })

  it('still asks which saved run to automate when the tenant has exactly one, pre-filled', async () => {
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseCard(wrapper, 'automation-purpose-choice-existing-run')

    // Asked, not inferred away: the run being automated is the fact the rest of the wizard is
    // about, so a single-run tenant sees it answered rather than never asked.
    expect(wrapper.text()).toContain('Which saved run should this automation use?')
    expect(wrapper.get('[data-testid="automation-saved-run-select"]').text()).toContain('Order Sync')

    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).toContain('How will Darpan get source data for Order Sync?')
  })

  it('skips the saved-run question when another page already chose the run', async () => {
    const savedRun = optionsResponse().savedRuns[0]!
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
      {
        intent: 'existing-run',
        savedRunId: savedRun.savedRunId,
        savedRunType: savedRun.runType,
        returnLabel: 'Automations',
        returnPath: '/reconciliation/automations',
      },
      'input-mode',
      savedRun,
    )
    window.history.replaceState({}, '', '/reconciliation/automation/create')

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

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

    await chooseExistingRunPurpose(wrapper)
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

    await chooseExistingRunPurpose(wrapper)
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
    expect(wrapper.get('.wizard-progress').attributes('aria-valuenow')).toBe('20')
    await chooseWorkflowOption(wrapper, 'automation-saved-run-select', 'RS_ORDER_SYNC')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
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
    // App-styled parts, not `<input type="time">` — the native picker panel is browser chrome and
    // cannot be themed (see WorkflowTimeSelect).
    expect(wrapper.find('input[type="time"]').exists()).toBe(false)
    await chooseWorkflowOption(wrapper, 'automation-schedule-time-hour', '07')
    await chooseWorkflowOption(wrapper, 'automation-schedule-time-minute', '30')
    expect(wrapper.get('[data-testid="automation-schedule-weekday"]').element.tagName).toBe('BUTTON')
    await chooseWorkflowOption(wrapper, 'automation-schedule-weekday', 'TUE')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.find('[data-testid="automation-chat-space-default"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-chat-space-existing"]').exists()).toBe(false)
    await chooseCard(wrapper, 'automation-chat-space-none')
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
      chatSpaceId: '',
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

    await chooseExistingRunPurpose(wrapper, 'RS_ORDER_SYNC')
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
    await chooseCard(wrapper, 'automation-chat-space-none')
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

  it('pairs date window with count on the edit form and hides count for a window type that does not need it', async () => {
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
        relativeWindowTypeEnumId: 'AUT_WIN_LAST_DAYS',
        relativeWindowCount: 3,
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

    const fieldLabels = wrapper.get('[data-testid="automation-edit-window-fields"]')
      .findAll('.workflow-context-label')
      .map((label) => label.text())
    expect(fieldLabels.indexOf('Date Window')).toBe(0)
    expect(fieldLabels.indexOf('Count')).toBe(1)
    expect(wrapper.find('[data-testid="automation-window-count-input"]').exists()).toBe(true)

    await chooseWorkflowOption(wrapper, 'automation-window-select', 'AUT_WIN_PREV_DAY')

    expect(wrapper.find('[data-testid="automation-window-count-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-active-field"]').exists()).toBe(true)
  })

  it('walks the chat-space step using the user default', async () => {
    getUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      userNotificationDefault: { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: 'Y' },
    })
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', googleChatConfigured: true, isActive: 'Y', inUse: true },
        { chatSpaceId: 'CS2', spaceName: 'Backup', googleChatConfigured: true, isActive: 'Y', inUse: false },
      ],
    })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseExistingRunPurpose(wrapper)
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_SFTP_FILES')
    await chooseWorkflowOption(wrapper, 'automation-file1-sftp-select', 'SFTP_OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file1RemotePathTemplate"]').setValue('/oms/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'automation-file2-sftp-select', 'SFTP_SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file2RemotePathTemplate"]').setValue('/shopify/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).toContain('My default space (Ops)')
    expect(wrapper.text()).toContain('Choose another space')
    expect(wrapper.text()).toContain('Set up a new space')
    expect(wrapper.text()).toContain('No notifications')

    await chooseCard(wrapper, 'automation-chat-space-default')
    expect(wrapper.text()).toContain('What should this automation be called?')

    await wrapper.get('input[name="automationName"]').setValue('Daily order sync')
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({ chatSpaceId: 'CS1' }), expect.any(AbortSignal))
  })

  it('creates a new space inline as two separate cards', async () => {
    saveTenantChatSpace.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpace: { chatSpaceId: 'CS9', spaceName: 'Ops Alerts', googleChatConfigured: true, isActive: 'Y', inUse: true },
    })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await chooseExistingRunPurpose(wrapper)
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_SFTP_FILES')
    await chooseWorkflowOption(wrapper, 'automation-file1-sftp-select', 'SFTP_OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file1RemotePathTemplate"]').setValue('/oms/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'automation-file2-sftp-select', 'SFTP_SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file2RemotePathTemplate"]').setValue('/shopify/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseCard(wrapper, 'automation-chat-space-new')
    expect(wrapper.find('[data-testid="automation-chat-space-name"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automation-chat-space-url"]').exists()).toBe(false)
    await wrapper.get('[data-testid="automation-chat-space-name"]').setValue('Ops Alerts')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.find('[data-testid="automation-chat-space-name"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-chat-space-url"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="automation-chat-space-url"]').attributes('type')).toBe('password')
    await wrapper.get('[data-testid="automation-chat-space-url"]').setValue('https://chat.googleapis.com/v1/spaces/AAA')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await wrapper.get('input[name="automationName"]').setValue('Daily order sync')
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith({
      spaceName: 'Ops Alerts',
      googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA',
      isActive: true,
    }, expect.any(AbortSignal))
    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({ chatSpaceId: 'CS9' }), expect.any(AbortSignal))
    const chatSpaceCallOrder = saveTenantChatSpace.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    const automationCallOrder = saveAutomation.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY
    expect(chatSpaceCallOrder).toBeLessThan(automationCallOrder)
  })

  async function walkToNewChatSpaceSubmit(wrapper: ReturnType<typeof mount>): Promise<void> {
    await chooseExistingRunPurpose(wrapper)
    await chooseCard(wrapper, 'automation-input-mode-choice-AUT_IN_SFTP_FILES')
    await chooseWorkflowOption(wrapper, 'automation-file1-sftp-select', 'SFTP_OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file1RemotePathTemplate"]').setValue('/oms/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'automation-file2-sftp-select', 'SFTP_SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="file2RemotePathTemplate"]').setValue('/shopify/{{date}}')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseCard(wrapper, 'automation-chat-space-new')
    await wrapper.get('[data-testid="automation-chat-space-name"]').setValue('Ops Alerts')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="automation-chat-space-url"]').setValue('https://chat.googleapis.com/v1/spaces/AAA')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await wrapper.get('input[name="automationName"]').setValue('Daily order sync')
  }

  it('does not re-create the chat space on retry after a failed automation save', async () => {
    saveTenantChatSpace.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpace: { chatSpaceId: 'CS9', spaceName: 'Ops Alerts', googleChatConfigured: true, isActive: 'Y', inUse: true },
    })
    saveAutomation
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        automation: { automationId: 'AUT_ORDER_SYNC', automationName: 'Daily order sync' },
      })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToNewChatSpaceSubmit(wrapper)

    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledTimes(1)
    expect(saveAutomation).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Unable to save automation setup.')

    // Retry: the chat space already exists (chatSpaceId carried over from the first
    // attempt) -- it must not be re-created a second time with the same name.
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledTimes(1)
    expect(saveAutomation).toHaveBeenCalledTimes(2)
    expect(saveAutomation).toHaveBeenLastCalledWith(expect.objectContaining({ chatSpaceId: 'CS9' }), expect.any(AbortSignal))
  })

  it('surfaces the real chat-space creation error instead of the generic automation-failure message', async () => {
    saveTenantChatSpace.mockRejectedValue(new ApiCallError("Chat space name 'Ops Alerts' already exists.", 400))

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToNewChatSpaceSubmit(wrapper)

    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("Chat space name 'Ops Alerts' already exists.")
    expect(wrapper.text()).not.toContain('Unable to save automation setup.')
    expect(saveAutomation).not.toHaveBeenCalled()
  })

  it('shows a visible note when chat-space options fail to load, without blocking automation setup', async () => {
    getUserNotificationDefault.mockRejectedValue(new Error('network down'))
    listTenantChatSpaces.mockRejectedValue(new Error('network down'))

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load chat space options.')
    // Non-fatal: the very first (choice-only) step is still fully usable.
    expect(wrapper.get('[data-testid="automation-purpose-choice-existing-run"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the same chat-space load note on the edit surface', async () => {
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
    getUserNotificationDefault.mockRejectedValue(new Error('network down'))
    listTenantChatSpaces.mockRejectedValue(new Error('network down'))

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load chat space options.')
    expect(wrapper.get('[data-testid="save-automation"]').attributes('disabled')).toBeUndefined()
  })

  it('edit mode shows and clears the linked space', async () => {
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
        chatSpaceId: 'CS1',
        chatSpaceName: 'Ops',
        chatSpaceActive: true,
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

    expect(wrapper.get('[data-testid="automation-chat-space-select"]').text()).toBe('Ops')
    expect(wrapper.find('[data-testid="automation-chat-space-inactive-note"]').exists()).toBe(false)

    await chooseWorkflowOption(wrapper, 'automation-chat-space-select', '')
    expect(wrapper.get('[data-testid="automation-chat-space-select"]').text()).toBe('No notifications')
    await wrapper.get('[data-testid="save-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({ chatSpaceId: '' }), expect.any(AbortSignal))
  })

  it('shows an inactive note only when the linked chat space id is present and inactive', async () => {
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
        chatSpaceId: 'CS1',
        chatSpaceName: 'Ops',
        chatSpaceActive: false,
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

    expect(wrapper.get('[data-testid="automation-chat-space-select"]').text()).toBe('Ops')
    expect(wrapper.find('[data-testid="automation-chat-space-inactive-note"]').exists()).toBe(true)
  })

  it('shows no inactive note when no chat space is linked, even if chatSpaceActive is false', async () => {
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
        // No chatSpaceId at all -- the one combination the brief flags: chatSpaceActive is
        // false simply because there is no linked space, not because a linked space went
        // inactive. The guard must key off chatSpaceId presence first.
        chatSpaceId: undefined,
        chatSpaceActive: false,
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

    expect(wrapper.find('[data-testid="automation-chat-space-inactive-note"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="automation-chat-space-select"]').text()).toBe('No notifications')
  })

  describe('schedule timezone follows the tenant', () => {
    function editAutomationResponse(timezone: string | undefined) {
      return {
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
          timezone,
          relativeWindowTypeEnumId: 'AUT_WIN_PREV_DAY',
          relativeWindowCount: 1,
          active: true,
          sources: [
            {
              fileSide: 'FILE_1',
              sourceTypeEnumId: 'AUT_SRC_API',
              systemEnumId: 'OMS',
              systemMessageRemoteId: 'OMS_REMOTE',
              safeMetadataJson: '{"extractServiceName":"fixture.extractOmsOrders"}',
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
      }
    }

    async function mountEdit(timezone: string | undefined): Promise<ReturnType<typeof mount>> {
      route.name = 'reconciliation-automation-edit'
      route.fullPath = '/reconciliation/automations/edit/AUT_ORDER_SYNC'
      route.params = { automationId: 'AUT_ORDER_SYNC' }
      getAutomation.mockResolvedValue(editAutomationResponse(timezone))
      const wrapper = mount(ReconciliationAutomationWorkflowPage)
      await flushPromises()
      return wrapper
    }

    it('shows the tenant timezone when the automation has not pinned one', async () => {
      authStoreState.sessionInfo = { tenantTimeZone: 'Asia/Kolkata' }
      const wrapper = await mountEdit(undefined)

      expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toBe('Asia/Kolkata')
    })

    it('keeps the timezone the automation was saved with, ignoring the tenant', async () => {
      authStoreState.sessionInfo = { tenantTimeZone: 'Asia/Kolkata' }
      const wrapper = await mountEdit('America/New_York')

      // An existing schedule already fires at a fixed moment; re-reading it through a different
      // zone would silently move it.
      expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toBe('America/New_York')
    })

    it('follows the tenant, not the viewer, when the two differ', async () => {
      // One automation fires once for the whole tenant, so the card must not read differently
      // depending on who opened it.
      authStoreState.sessionInfo = { tenantTimeZone: 'Asia/Kolkata', userTimeZone: 'America/Los_Angeles' }
      const wrapper = await mountEdit(undefined)

      expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toBe('Asia/Kolkata')
    })

    it('falls back to UTC when the tenant has no timezone set', async () => {
      authStoreState.sessionInfo = { tenantTimeZone: undefined }
      const wrapper = await mountEdit(undefined)

      expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toBe('UTC')
    })

    it('sends the tenant timezone with the saved automation', async () => {
      authStoreState.sessionInfo = { tenantTimeZone: 'Asia/Kolkata' }
      saveAutomation.mockResolvedValue({ ok: true, messages: [], errors: [], automation: { automationId: 'AUT_ORDER_SYNC' } })
      const wrapper = await mountEdit(undefined)

      await wrapper.get('[data-testid="save-automation"]').trigger('click')
      await flushPromises()

      expect(saveAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ windowTimeZone: 'Asia/Kolkata' }),
        expect.any(AbortSignal),
      )
    })
  })
})
