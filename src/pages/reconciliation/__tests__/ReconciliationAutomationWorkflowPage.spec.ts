import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const route = vi.hoisted(() => ({
  name: 'reconciliation-automation-create',
  fullPath: '/reconciliation/automations/create',
  params: {} as Record<string, string>,
}))
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const getAutomation = vi.hoisted(() => vi.fn())
const saveAutomation = vi.hoisted(() => vi.fn())
const syncAutomation = vi.hoisted(() => vi.fn())
const getUserNotificationDefault = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const getSlackInstall = vi.hoisted(() => vi.fn())
const listSlackChannels = vi.hoisted(() => vi.fn())
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
    syncAutomation,
  },
  settingsFacade: {
    getUserNotificationDefault,
    listTenantChatSpaces,
    getSlackInstall,
    listSlackChannels,
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
import { useMascotStore } from '../../../stores/mascot'

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

async function chooseAppSelectOption(wrapper: ReturnType<typeof mount>, testId: string, value: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get('[data-testid="app-select-search"]').setValue(value)
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
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
    syncAutomation.mockReset()
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
    // No workspace connected by default, so the inline flow keeps its webhook card.
    getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: false, installs: [] })
    listSlackChannels.mockResolvedValue({ ok: true, channels: [], nextCursor: null })
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
    draftStoreState.automationDraftState = {
      draft: {
          intent: 'new-run',
          savedRunId: savedRun.savedRunId,
          savedRunType: savedRun.runType,
          automationName: 'Order Sync Automation',
          returnLabel: 'Automations',
          returnPath: '/reconciliation/automations',
        },
      resumeStepId: 'input-mode',
      savedRun: savedRun,
    }

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
    draftStoreState.automationDraftState = {
      draft: {
        intent: 'existing-run',
        savedRunId: savedRun.savedRunId,
        savedRunType: savedRun.runType,
        returnLabel: 'Automations',
        returnPath: '/reconciliation/automations',
      },
      resumeStepId: 'input-mode',
      savedRun: savedRun,
    }
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
    draftStoreState.automationDraftState = {
      draft: {
          intent: 'new-run',
          savedRunId: savedRun.savedRunId,
          savedRunType: savedRun.runType,
          automationName: 'API Order Sync Automation',
          returnLabel: 'Automations',
          returnPath: '/reconciliation/automations',
        },
      resumeStepId: 'input-mode',
      savedRun: savedRun,
    }

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
    draftStoreState.automationDraftState = {
      draft: {
          intent: 'new-run',
          savedRunId: savedRun.savedRunId,
          savedRunType: savedRun.runType,
          automationName: 'API Order Sync Automation',
          inputModeEnumId: 'AUT_IN_API_RANGE',
          returnLabel: 'Automations',
          returnPath: '/reconciliation/automations',
        },
      resumeStepId: 'file1-api',
      savedRun: null,
    }

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
    expect(windowFields.find('[data-testid="automation-edit-active-field"]').exists()).toBe(false)
    const chatSpaceFields = wrapper.get('[data-testid="automation-edit-chat-space-fields"]')
    expect(chatSpaceFields.findAll('.workflow-context-label').map((label) => label.text()))
      .toEqual(['Status', 'Chat Space'])
    const activeField = chatSpaceFields.get('[data-testid="automation-edit-active-field"]')
    expect(activeField.get('.workflow-context-label').text()).toBe('Status')
    const activeSelect = activeField.get('[data-testid="automation-edit-active"]')
    expect(activeSelect.element.tagName).toBe('BUTTON')
    expect(activeSelect.text()).toBe('Active')
    expect(activeField.find('input[name="isActive"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-schedule-fields"]').exists()).toBe(true)
    // The run is shown, never chosen: an automation is a snapshot of its run, so re-pointing it
    // would leave a snapshot derived from a different run. Sync pulls the run's config instead.
    expect(wrapper.find('[data-testid="automation-edit-saved-run-select"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="automation-edit-saved-run-name"]').text()).toBe('Order Sync')
    expect(wrapper.find('[data-testid="automation-edit-input-mode-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-file1-api-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-edit-file2-api-select"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Input')
    expect(wrapper.text()).not.toContain('API Source')
    expect(wrapper.find('[data-testid="automation-window-select"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automation-schedule-preset"]').exists()).toBe(true)
    // A picker, not a free-text field: the zone has to stay one of the known ids. It is editable
    // so a wrong stored zone can be corrected; it still never changes on its own (see the
    // scheduleTimeZone setter and its two specs below).
    expect(wrapper.find('input[data-testid="automation-schedule-timezone"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="automation-schedule-timezone"]').element.tagName).toBe('BUTTON')
    expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toContain('UTC')
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

  function editWithWindow(relativeWindowTypeEnumId: string, relativeWindowCount?: number, stored: Record<string, unknown> = {}) {
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
        savedRunType: 'ruleset',
        savedRun: optionsResponse().savedRuns[0],
        inputModeEnumId: 'AUT_IN_API_RANGE',
        scheduleExpr: '0 0 6 * * ?',
        timezone: 'UTC',
        relativeWindowTypeEnumId,
        relativeWindowCount,
        active: true,
        ...stored,
        sources: [
          { fileSide: 'FILE_1', sourceTypeEnumId: 'AUT_SRC_API', systemEnumId: 'OMS', systemMessageRemoteId: 'OMS_REMOTE' },
          { fileSide: 'FILE_2', sourceTypeEnumId: 'AUT_SRC_API', systemEnumId: 'SHOPIFY', systemMessageRemoteId: 'SHOPIFY_REMOTE' },
        ],
      },
    })
  }

  it('keeps Save disabled on the edit form until the date window is complete', async () => {
    editWithWindow('AUT_WIN_LAST_DAYS', 3)
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="save-automation"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="automation-window-count-input"]').setValue('')
    expect(wrapper.get('[data-testid="save-automation"]').attributes('disabled')).toBeDefined()
  })

  // S06 F-A4: the backend refuses the retired state window. An automation still holding one opens
  // with the window blank, so it is re-picked rather than silently saved back.
  it('opens an automation stored with the retired state window with no window chosen', async () => {
    editWithWindow('AUT_WIN_STATE')
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="automation-window-select"]').text()).toContain('Select date window')
    expect(wrapper.get('[data-testid="save-automation"]').attributes('disabled')).toBeDefined()
    await chooseWorkflowOption(wrapper, 'automation-window-select', 'AUT_WIN_PREV_DAY')
    await wrapper.get('[data-testid="save-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ relativeWindowTypeEnumId: 'AUT_WIN_PREV_DAY' }),
      expect.any(AbortSignal),
    )
  })

  // An automation keeps its own filter copy; only sync#Automation changes it (DAR-BE-338). A save
  // that sent filters back would overwrite that copy, so the payload never carries the key.
  it('never sends exclusion filters on save, even when the loaded automation has them', async () => {
    route.name = 'reconciliation-automation-edit'
    route.fullPath = '/reconciliation/automations/edit/AUT_ORDER_SYNC'
    route.params = { automationId: 'AUT_ORDER_SYNC' }
    const excludeFilters = [{ fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] }]
    getAutomation.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      automation: {
        automationId: 'AUT_ORDER_SYNC',
        automationName: 'Daily order sync',
        savedRunId: 'RS_ORDER_SYNC',
        savedRunType: 'ruleset',
        savedRun: optionsResponse().savedRuns[0],
        inputModeEnumId: 'AUT_IN_API_RANGE',
        scheduleExpr: '0 0 6 * * ?',
        timezone: 'UTC',
        relativeWindowTypeEnumId: 'AUT_WIN_PREV_DAY',
        active: true,
        sources: [
          { fileSide: 'FILE_1', sourceTypeEnumId: 'AUT_SRC_API', systemEnumId: 'OMS', systemMessageRemoteId: 'OMS_REMOTE', excludeFilters },
          { fileSide: 'FILE_2', sourceTypeEnumId: 'AUT_SRC_API', systemEnumId: 'SHOPIFY', systemMessageRemoteId: 'SHOPIFY_REMOTE', excludeFilters },
        ],
      },
    })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await wrapper.get('[data-testid="save-automation"]').trigger('click')
    await flushPromises()

    const sources = saveAutomation.mock.calls[0]?.[0].sources as Array<Record<string, unknown>>
    expect(sources).toHaveLength(2)
    for (const source of sources) expect(source).not.toHaveProperty('excludeFilters')
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

  /** Through the SFTP setup to the chat-space card. */
  async function walkToChatSpaceStep(wrapper: ReturnType<typeof mount>): Promise<void> {
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
  }

  /** "Set up a new space" opens the Notifications page's Add space flow over the wizard (DAR-UI-123). */
  async function addGoogleChatSpace(wrapper: ReturnType<typeof mount>): Promise<void> {
    await chooseCard(wrapper, 'automation-chat-space-new')
    await flushPromises()
    await chooseCard(wrapper, 'add-chat-space-where-google')
    await wrapper.get('[data-testid="add-chat-space-webhook"]').setValue('https://chat.googleapis.com/v1/spaces/AAA')
    await wrapper.get('[data-testid="add-chat-space-next"]').trigger('click')
    await wrapper.get('[data-testid="add-chat-space-name"]').setValue('Ops Alerts')
    await wrapper.get('[data-testid="add-chat-space-save"]').trigger('click')
    await flushPromises()
  }

  it('adds a Slack space through the shared Add space flow and comes back with it selected', async () => {
    getSlackInstall.mockResolvedValue({
      ok: true, slackConfigured: true, oauthAvailable: false,
      installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', isActive: 'Y' }],
    })
    listSlackChannels.mockResolvedValue({
      ok: true, nextCursor: null,
      channels: [{ id: 'C1', name: 'darpan-test', isPrivate: false, isMember: false }],
    })
    saveTenantChatSpace.mockResolvedValue({
      ok: true, messages: [], errors: [],
      chatSpace: { chatSpaceId: 'CS9', spaceName: '#darpan-test', isActive: 'Y', inUse: true },
    })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToChatSpaceStep(wrapper)

    await chooseCard(wrapper, 'automation-chat-space-new')
    await flushPromises()
    expect(wrapper.get('[data-testid="add-chat-space"]').text()).toContain('Where should it post?')
    await chooseCard(wrapper, 'add-chat-space-where-slack')
    await flushPromises()
    expect(listSlackChannels).toHaveBeenCalledWith({ slackInstallId: 'SI1' }, expect.anything())
    await chooseAppSelectOption(wrapper, 'add-chat-space-channel', 'C1')
    await wrapper.get('[data-testid="add-chat-space-save"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith({
      spaceName: '#darpan-test',
      chatProviderEnumId: 'CHAT_PROV_SLACK',
      slackInstallId: 'SI1',
      slackChannelId: 'C1',
      slackChannelName: 'darpan-test',
      isActive: true,
    }, expect.any(AbortSignal))
    // No "what should post here" card in the wizard: the automation being built is what posts there.
    expect(wrapper.get('[data-testid="add-chat-space"]').text()).toContain('#darpan-test is added.')
    await wrapper.get('[data-testid="add-chat-space-done"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="add-chat-space"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('What should this automation be called?')
    await wrapper.get('input[name="automationName"]').setValue('Daily order sync')
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()
    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({ chatSpaceId: 'CS9' }), expect.any(AbortSignal))
  })

  // DAR-UI-023: with no Slack workspace connected, Slack is not a webhook paste; the workspace comes first. Inside the
  // wizard it is a pasted token, never Slack's consent screen, which would leave the wizard and lose its answers.
  it('connects Slack by token from the wizard, never by leaving for Slack', async () => {
    getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: true, installs: [] })
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToChatSpaceStep(wrapper)

    await chooseCard(wrapper, 'automation-chat-space-new')
    await flushPromises()
    await chooseCard(wrapper, 'add-chat-space-where-slack')
    await flushPromises()

    expect(wrapper.get('[data-testid="add-chat-space"]').text()).toContain('Paste the bot token.')
    expect(wrapper.find('[data-testid="add-chat-space-connect-oauth"]').exists()).toBe(false)
  })

  it('adds a Google Chat space before the automation is saved, and keeps it on a cancelled flow', async () => {
    saveTenantChatSpace.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpace: { chatSpaceId: 'CS9', spaceName: 'Ops Alerts', googleChatConfigured: true, isActive: 'Y', inUse: true },
    })

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToChatSpaceStep(wrapper)
    await addGoogleChatSpace(wrapper)

    expect(saveTenantChatSpace).toHaveBeenCalledWith({
      spaceName: 'Ops Alerts',
      chatProviderEnumId: 'CHAT_PROV_GOOGLE',
      webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA',
      isActive: true,
    }, expect.any(AbortSignal))
    expect(saveAutomation).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="add-chat-space-done"]').trigger('click')
    await flushPromises()

    await wrapper.get('input[name="automationName"]').setValue('Daily order sync')
    await wrapper.get('[data-testid="create-automation"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledTimes(1)
    expect(saveAutomation).toHaveBeenCalledWith(expect.objectContaining({ chatSpaceId: 'CS9' }), expect.any(AbortSignal))
  })

  it('stays on the chat-space card when the Add space flow is cancelled', async () => {
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToChatSpaceStep(wrapper)

    await chooseCard(wrapper, 'automation-chat-space-new')
    await flushPromises()
    await wrapper.get('[data-testid="add-chat-space-cancel"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="add-chat-space"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Where should Darpan send notifications for this automation?')
    expect(saveTenantChatSpace).not.toHaveBeenCalled()
  })

  it('shows the real chat-space error in the flow and saves no automation', async () => {
    saveTenantChatSpace.mockRejectedValue(new ApiCallError("Chat space name 'Ops Alerts' already exists.", 400))

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()
    await walkToChatSpaceStep(wrapper)
    await addGoogleChatSpace(wrapper)

    expect(wrapper.get('[data-testid="add-chat-space"]').text()).toContain("Chat space name 'Ops Alerts' already exists.")
    expect(wrapper.text()).not.toContain('The automation setup slipped through our fingers.')
    expect(saveAutomation).not.toHaveBeenCalled()
  })

  it('shows a visible note when chat-space options fail to load, without blocking automation setup', async () => {
    getUserNotificationDefault.mockRejectedValue(new Error('network down'))
    listTenantChatSpaces.mockRejectedValue(new Error('network down'))

    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('The chat spaces drifted into outer space.')
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

    expect(wrapper.text()).toContain('The chat spaces drifted into outer space.')
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
    expect(useMascotStore().warnings.map((w) => w.id)).not.toContain('automation-chat-space-inactive')

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
    expect(useMascotStore().warnings.map((w) => w.id)).toContain('automation-chat-space-inactive')
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

    expect(useMascotStore().warnings.map((w) => w.id)).not.toContain('automation-chat-space-inactive')
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

    // Pinning the saved zone stops a schedule MOVING on its own; it must not also make a wrong
    // zone permanent. An automation saved before the tenant zone was set reads UTC forever, and
    // re-saving rewrote UTC because a non-empty stored value always won the fallback chain.
    it('lets an operator correct the timezone the automation was saved with', async () => {
      authStoreState.sessionInfo = { tenantTimeZone: 'America/Los_Angeles' }
      saveAutomation.mockResolvedValue({ ok: true, messages: [], errors: [], automation: { automationId: 'AUT_ORDER_SYNC' } })
      const wrapper = await mountEdit('UTC')

      expect(wrapper.get('[data-testid="automation-schedule-timezone"]').text()).toContain('UTC')
      await chooseAppSelectOption(wrapper, 'automation-schedule-timezone', 'America/Los_Angeles')
      await wrapper.get('[data-testid="save-automation"]').trigger('click')
      await flushPromises()

      expect(saveAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ windowTimeZone: 'America/Los_Angeles' }),
        expect.any(AbortSignal),
      )
    })

    // The other half of the same guarantee: making it settable must not make it drift. An untouched
    // form still sends back exactly the zone it loaded, tenant setting notwithstanding.
    it('keeps the saved timezone when the operator does not touch the picker', async () => {
      authStoreState.sessionInfo = { tenantTimeZone: 'America/Los_Angeles' }
      saveAutomation.mockResolvedValue({ ok: true, messages: [], errors: [], automation: { automationId: 'AUT_ORDER_SYNC' } })
      const wrapper = await mountEdit('UTC')

      await wrapper.get('[data-testid="save-automation"]').trigger('click')
      await flushPromises()

      expect(saveAutomation).toHaveBeenCalledWith(
        expect.objectContaining({ windowTimeZone: 'UTC' }),
        expect.any(AbortSignal),
      )
    })
  })

  // OC-U03a (Coordinator OC8): a custom window's picked days are midnight in the automation's
  // schedule zone, saved and read in that zone. The backend uses the stored instant as-is
  // (AutomationExecutionSupport, WINDOW_CUSTOM), so a UTC-midnight bound shifted every non-UTC tenant.
  describe('custom date window days are the schedule zone\'s days', () => {
    async function mountCustomWindow(timezone: string, start: string, end: string): Promise<ReturnType<typeof mount>> {
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
          savedRunType: 'ruleset',
          savedRun: optionsResponse().savedRuns[0],
          inputModeEnumId: 'AUT_IN_API_RANGE',
          scheduleExpr: '0 0 6 * * ?',
          timezone,
          relativeWindowTypeEnumId: 'AUT_WIN_CUSTOM',
          customWindowStartDate: start,
          customWindowEndDate: end,
          active: true,
          sources: [
            { fileSide: 'FILE_1', sourceTypeEnumId: 'AUT_SRC_API', systemEnumId: 'OMS', systemMessageRemoteId: 'OMS_REMOTE' },
            { fileSide: 'FILE_2', sourceTypeEnumId: 'AUT_SRC_API', systemEnumId: 'SHOPIFY', systemMessageRemoteId: 'SHOPIFY_REMOTE' },
          ],
        },
      })
      const wrapper = mount(ReconciliationAutomationWorkflowPage)
      await flushPromises()
      return wrapper
    }

    function shownDays(wrapper: ReturnType<typeof mount>): [string, string] {
      return [
        (wrapper.get('[data-testid="automation-custom-window-start"]').element as HTMLInputElement).value,
        (wrapper.get('[data-testid="automation-custom-window-end"]').element as HTMLInputElement).value,
      ]
    }

    async function saveAndReadBounds(wrapper: ReturnType<typeof mount>): Promise<[string, string]> {
      await wrapper.get('[data-testid="save-automation"]').trigger('click')
      await flushPromises()
      const payload = saveAutomation.mock.calls[0]?.[0]
      return [payload.customWindowStartDate, payload.customWindowEndDate]
    }

    it('saves an IST tenant\'s Nov 1-7 as IST midnights, end exclusive', async () => {
      const wrapper = await mountCustomWindow('Asia/Kolkata', '2026-09-30T18:30:00.000Z', '2026-10-07T18:30:00.000Z')
      expect(shownDays(wrapper)).toEqual(['2026-10-01', '2026-10-07'])

      await wrapper.get('[data-testid="automation-custom-window-start"]').setValue('2026-11-01')
      await wrapper.get('[data-testid="automation-custom-window-end"]').setValue('2026-11-07')

      expect(await saveAndReadBounds(wrapper)).toEqual(['2026-10-31T18:30:00.000Z', '2026-11-07T18:30:00.000Z'])
    })

    it('reads a legacy UTC-midnight row on a Pacific tenant as its UTC days, and re-saves them as Pacific midnights', async () => {
      const wrapper = await mountCustomWindow('America/Los_Angeles', '2026-11-01T00:00:00.000Z', '2026-11-08T00:00:00.000Z')

      // Not Oct 31: an exact 00:00Z is never a real Pacific midnight, so it is the old UTC-midnight save.
      expect(shownDays(wrapper)).toEqual(['2026-11-01', '2026-11-07'])
      // Nov 1 00:00 is still PDT (UTC-7); Nov 8 00:00 is PST (UTC-8).
      expect(await saveAndReadBounds(wrapper)).toEqual(['2026-11-01T07:00:00.000Z', '2026-11-08T08:00:00.000Z'])
    })

    it('leaves a UTC tenant\'s window exactly as it was', async () => {
      const wrapper = await mountCustomWindow('UTC', '2026-11-01T00:00:00.000Z', '2026-11-08T00:00:00.000Z')

      expect(shownDays(wrapper)).toEqual(['2026-11-01', '2026-11-07'])
      expect(await saveAndReadBounds(wrapper)).toEqual(['2026-11-01T00:00:00.000Z', '2026-11-08T00:00:00.000Z'])
    })
  })

  // OC-U03b (Coordinator OC9): the edit form sent 28/28 over whatever the automation stored.
  it('keeps the stored window sizes through an unrelated edit', async () => {
    editWithWindow('AUT_WIN_PREV_DAY', undefined, { maxWindowDays: 14, splitWindowDays: 7 })
    const wrapper = mount(ReconciliationAutomationWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="automationName"]').setValue('Renamed')
    await wrapper.get('[data-testid="save-automation"]').trigger('click')
    await flushPromises()

    expect(saveAutomation).toHaveBeenCalledWith(
      expect.objectContaining({ automationName: 'Renamed', maxWindowDays: 14, splitWindowDays: 7 }),
      expect.any(AbortSignal),
    )
  })

  describe('syncing an automation with its saved run', () => {
    function editResponse(syncStatus: Record<string, unknown>) {
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
        syncStatus,
      }
    }

    const inSync = { inSync: true, changedFields: [], inputModeChanging: false, savedRunMissing: false }
    const drifted = {
      inSync: false,
      changedFields: ['FILE_1.schemaFileName'],
      inputModeChanging: false,
      savedRunMissing: false,
    }

    async function mountEditWithSyncStatus(syncStatus: Record<string, unknown>): Promise<ReturnType<typeof mount>> {
      route.name = 'reconciliation-automation-edit'
      route.fullPath = '/reconciliation/automations/edit/AUT_ORDER_SYNC'
      route.params = { automationId: 'AUT_ORDER_SYNC' }
      getAutomation.mockResolvedValue(editResponse(syncStatus))
      const wrapper = mount(ReconciliationAutomationWorkflowPage)
      await flushPromises()
      return wrapper
    }

    it('raises drift as a mascot warning rather than a line on the page', async () => {
      const clean = await mountEditWithSyncStatus(inSync)
      expect(useMascotStore().warnings.map((w) => w.id)).not.toContain('automation-drift')
      clean.unmount()

      await mountEditWithSyncStatus(drifted)
      const raised = useMascotStore().warnings.find((w) => w.id === 'automation-drift')

      expect(raised).toBeDefined()
      // The prompt asks; the body answers "what state am I in, and what does yes do". The title
      // above them already names the condition, so the body no longer repeats it.
      expect(raised?.prompt).toBe('Sync this automation with its run?')
      expect(raised?.body).toContain('runs the setup it was built with')
      expect(raised?.body).toContain('replaces this automation’s source setup and filters')
      // RAISED, NOT OPENED. Drift found on load announces itself through the burst and the held
      // posture; the bubble waits to be hovered or clicked. Only the Sync BUTTON opens it, because
      // there the operator asked a question and is owed the answer — see the in-sync test below.
      expect(useMascotStore().popupOpen).toBe(false)
    })

    it('syncs from the popup action and does not call the facade until it is pressed', async () => {
      syncAutomation.mockResolvedValue({ ok: true, messages: [], errors: [], changedFields: [] })
      await mountEditWithSyncStatus(drifted)
      const action = useMascotStore().warnings
        .find((w) => w.id === 'automation-drift')?.actions
        .find((a) => a.testId === 'mascot-warning-action-sync')

      expect(syncAutomation).not.toHaveBeenCalled()
      await action?.run()
      await flushPromises()

      expect(syncAutomation).toHaveBeenCalledWith({ automationId: 'AUT_ORDER_SYNC' }, expect.any(AbortSignal))
    })

    it('warns in the warning body when the input mode is about to change', async () => {
      await mountEditWithSyncStatus({
        inSync: false,
        changedFields: ['inputMode'],
        inputModeChanging: true,
        savedRunMissing: false,
      })

      expect(useMascotStore().warnings.find((w) => w.id === 'automation-drift')?.body).toContain('schedule')
    })

    it('offers no sync action at all when the saved run is gone', async () => {
      const wrapper = await mountEditWithSyncStatus({
        inSync: true,
        changedFields: [],
        inputModeChanging: false,
        savedRunMissing: true,
      })
      const raised = useMascotStore().warnings.find((w) => w.id === 'automation-saved-run-missing')

      expect(wrapper.get('[data-testid="automation-edit-sync"]').attributes('disabled')).toBeDefined()
      expect(raised).toBeDefined()
      // A deleted run cannot be synced, so an action here would be a button that always fails.
      expect(raised?.actions).toEqual([])
    })

    it('still double-checks when Sync is pressed on an automation that has not drifted', async () => {
      // syncWarnings() drops the drift warning when nothing drifted, so without an on-demand
      // confirm the button would open an empty popup and read as broken.
      const wrapper = await mountEditWithSyncStatus(inSync)

      await wrapper.get('[data-testid="automation-edit-sync"]').trigger('click')
      const mascot = useMascotStore()

      expect(mascot.popupOpen).toBe(true)
      expect(mascot.warnings.map((w) => w.id)).toEqual(['automation-sync-confirm'])
      expect(syncAutomation).not.toHaveBeenCalled()
    })

    it('drops its warnings on unmount so they do not follow you to the next page', async () => {
      const wrapper = await mountEditWithSyncStatus(drifted)
      expect(useMascotStore().warnings).not.toEqual([])

      wrapper.unmount()

      expect(useMascotStore().warnings).toEqual([])
    })

    it('leaves the create wizard free to choose a saved run', async () => {
      // The wizard renders its OWN control (automation-saved-run-select), untouched by this change —
      // only the edit form's picker is removed. Two runs are needed to see it: with exactly one the
      // wizard pre-fills that run and skips the step (see preselectOnlySavedRun).
      const twoRuns = optionsResponse()
      const firstRun = twoRuns.savedRuns[0]
      if (!firstRun) throw new Error('fixture must define at least one saved run')
      twoRuns.savedRuns = [
        firstRun,
        { ...firstRun, savedRunId: 'RS_SECOND', runName: 'Second Run', ruleSetId: 'RS_SECOND' },
      ]
      listAutomationSourceOptions.mockResolvedValue(twoRuns)
      route.name = 'reconciliation-automation-create'
      route.fullPath = '/reconciliation/automations/create'
      route.params = {}
      const wrapper = mount(ReconciliationAutomationWorkflowPage)
      await flushPromises()
      await chooseCard(wrapper, 'automation-purpose-choice-existing-run')
      expect(wrapper.find('[data-testid="automation-saved-run-select"]').exists()).toBe(true)
    })
  })
})
