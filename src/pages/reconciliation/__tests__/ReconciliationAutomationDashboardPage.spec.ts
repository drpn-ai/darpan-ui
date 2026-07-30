import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  params: { automationId: 'AUT_ACTIVE_API' } as Record<string, string>,
  fullPath: '/reconciliation/automations/AUT_ACTIVE_API',
}))
const getAutomation = vi.hoisted(() => vi.fn())
const listAutomationExecutions = vi.hoisted(() => vi.fn())
const runAutomationNow = vi.hoisted(() => vi.fn())
const deleteAutomation = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const permissions = vi.hoisted(() => ({
  canEditTenantSettings: true,
  canRunActiveTenantReconciliation: true,
}))
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'tenant-user',
    timeZone: 'America/Los_Angeles',
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    getAutomation,
    listAutomationExecutions,
    runAutomationNow,
    deleteAutomation,
  },
}))

vi.mock('../../../lib/auth', () => ({
  useAuthState: () => authState,
  useUiPermissions: () => permissions,
}))

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
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

import ReconciliationAutomationDashboardPage from '../ReconciliationAutomationDashboardPage.vue'

function mockAutomation(active = true) {
  return {
    automationId: 'AUT_ACTIVE_API',
    automationName: 'Daily API orders',
    savedRunId: 'RS_API',
    savedRunName: 'API Orders',
    savedRunType: 'ruleset',
    savedRun: {
      savedRunId: 'RS_API',
      runName: 'API Orders',
      runType: 'ruleset',
      ruleSetId: 'RS_API',
      compareScopeId: 'CS_API',
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
          sourceTypeEnumId: 'AUT_SRC_API',
          systemMessageRemoteId: 'HOTWAX_ORDERS_API',
          systemMessageRemoteLabel: 'Orders API',
          sourceConfigId: 'HOTWAX_ORDERS',
        },
        {
          fileSide: 'FILE_2',
          enumId: 'SHOPIFY',
          label: 'SHOPIFY',
          fileTypeEnumId: 'DftCsv',
          idFieldExpression: 'id',
          sourceTypeEnumId: 'AUT_SRC_API',
          systemMessageRemoteId: 'SHOPIFY_ORDERS_API',
          systemMessageRemoteLabel: 'Shopify Orders Endpoint',
          sourceConfigId: 'SHOPIFY_ORDERS',
        },
      ],
    },
    inputModeEnumId: 'AUT_IN_API_RANGE',
    inputModeCode: 'API_DATE_RANGE',
    sourceSummary: 'API: OMS via NS_ORDERS -> Shopify via SHOPIFY_ORDERS',
    scheduleSummary: 'Cron: 0 49 * * * ?',
    scheduleExpr: '0 49 * * * ?',
    timezone: 'America/New_York',
    relativeWindowTypeEnumId: 'AUT_WIN_LAST_DAYS',
    relativeWindowLabel: 'LAST_N_DAYS',
    relativeWindowCount: 1,
    active,
    nextScheduledFireTime: 1777740540000,
    lastScheduledFireTime: '2026-05-02T06:00:00Z',
    lastExecution: {
      automationExecutionId: 'EXEC_2',
      statusEnumId: 'AUT_STAT_SUCCESS',
      statusLabel: 'Succeeded',
      scheduledDate: '2026-05-02T06:00:00Z',
      completedDate: '2026-05-02T06:03:00Z',
    },
    permissions: {
      canViewHistory: true,
      canEdit: true,
      canDelete: true,
      canPause: active,
      canResume: !active,
      canRunNow: true,
    },
  }
}

function mockExecutions() {
  return [
    {
      automationExecutionId: 'EXEC_OLD',
      statusEnumId: 'AUT_STAT_FAILED',
      statusLabel: 'Failed',
      scheduledDate: '2026-05-01T06:00:00Z',
      completedDate: '2026-05-01T06:03:00Z',
      differenceCount: 4,
      errorMessage: 'Missing file',
    },
    {
      automationExecutionId: 'EXEC_NEW',
      statusEnumId: 'AUT_STAT_SUCCESS',
      statusLabel: 'Succeeded',
      scheduledDate: '2026-05-02T06:00:00Z',
      completedDate: '2026-05-02T06:03:00Z',
      differenceCount: 1,
      resultDataManagerPath: 'reconciliation-runs/AUT_ACTIVE_API/20260502/orders_result.json',
    },
  ]
}

describe('ReconciliationAutomationDashboardPage', () => {
  beforeEach(() => {
    route.params = { automationId: 'AUT_ACTIVE_API' }
    route.fullPath = '/reconciliation/automations/AUT_ACTIVE_API'
    permissions.canEditTenantSettings = true
    permissions.canRunActiveTenantReconciliation = true
    authState.sessionInfo.timeZone = 'America/Los_Angeles'
    push.mockReset()
    getAutomation.mockReset()
    listAutomationExecutions.mockReset()
    runAutomationNow.mockReset()
    deleteAutomation.mockReset()
    vi.restoreAllMocks()
    getAutomation.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      automation: mockAutomation(),
    })
    listAutomationExecutions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      executions: mockExecutions(),
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 2, pageCount: 1 },
    })
    runAutomationNow.mockResolvedValue({ ok: true, messages: [], errors: [], automation: mockAutomation() })
    deleteAutomation.mockResolvedValue({ ok: true, messages: [], errors: [], deleted: true, deletedAutomationId: 'AUT_ACTIVE_API' })
  })

  it('renders setup details and previous runs on the selected automation dashboard', async () => {
    const wrapper = mount(ReconciliationAutomationDashboardPage)
    await flushPromises()

    expect(getAutomation).toHaveBeenCalledWith({ automationId: 'AUT_ACTIVE_API' }, expect.any(AbortSignal))
    expect(listAutomationExecutions).toHaveBeenCalledWith({ automationId: 'AUT_ACTIVE_API', pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Daily API orders')
    expect(wrapper.text()).toContain('Setup')
    expect(wrapper.text()).toContain('Previous Runs')
    expect(wrapper.find('[data-testid="automation-setup-summary"]').exists()).toBe(true)
    expect(wrapper.findAll('.static-page-summary-card')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Input')
    expect(wrapper.text()).not.toContain('API extraction')
    expect(wrapper.text()).not.toContain('Sources')
    expect(wrapper.text()).not.toContain('API: OMS via NS_ORDERS -> Shopify via SHOPIFY_ORDERS')
    expect(wrapper.text()).toContain('Hourly at :49')
    expect(wrapper.text()).not.toContain('Cron:')
    expect(wrapper.text()).toContain('Last 1 day')
    expect(wrapper.text()).not.toContain('LAST_N_DAYS')
    expect(wrapper.text()).not.toContain('Timezone')
    expect(wrapper.text()).not.toContain('America/New_York')

    const previousRunField = wrapper.get('[data-testid="automation-previous-run"]').element.closest('.automation-dashboard-detail-item')
    const nextRunField = wrapper.get('[data-testid="automation-next-run"]').element.closest('.automation-dashboard-detail-item')
    expect(previousRunField?.classList.contains('automation-dashboard-detail-item--date')).toBe(true)
    expect(nextRunField?.classList.contains('automation-dashboard-detail-item--date')).toBe(true)
    expect(wrapper.get('[data-testid="automation-previous-run"]').text()).toBe('May 1, 2026, 11:00 PM')
    expect(wrapper.get('[data-testid="automation-next-run"]').text()).toBe('May 2, 2026, 9:49 AM')

    const savedRunLink = wrapper.get('[data-testid="automation-saved-run-link"]')
    expect(savedRunLink.element.tagName).toBe('A')
    expect(savedRunLink.classes()).toContain('automation-dashboard-run-link')
    expect(savedRunLink.classes()).not.toContain('automation-dashboard-link')
    expect(JSON.parse(savedRunLink.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-ruleset-manager',
    })

    const rows = wrapper.findAll('[data-testid="automation-execution-row"]')
    expect(rows).toHaveLength(2)
    expect(wrapper.findAll('th').map((column) => column.text())).toEqual(['Status', 'Scheduled', 'Completed', 'Differences'])
    expect(wrapper.findAll('col').map((column) => column.attributes('style'))).toEqual([
      'width: 16%;',
      'width: 34%;',
      'width: 34%;',
      'width: 16%;',
    ])
    expect(wrapper.findAll('.automation-dashboard-date-text').map((node) => node.text())).toEqual([
      'May 1, 2026, 11:00 PM',
      'May 1, 2026, 11:03 PM',
      'Apr 30, 2026, 11:00 PM',
      'Apr 30, 2026, 11:03 PM',
    ])
    expect(wrapper.find('[data-testid="automation-execution-result-link"]').exists()).toBe(false)
    expect(rows.at(0)?.text()).toContain('Succeeded')
    expect(rows.at(0)?.text()).toContain('May 1, 2026, 11:00 PM')
    expect(rows.at(0)?.text()).toContain('May 1, 2026, 11:03 PM')
    expect(rows.at(0)?.text()).not.toContain('orders_result.json')
    expect(rows.at(0)?.attributes('aria-label')).toBe('Open result orders_result.json')
    expect(rows.at(1)?.text()).toContain('Failed')
    expect(rows.at(1)?.text()).not.toContain('Missing file')

    await rows.at(0)?.trigger('click')
    const resultRoute = push.mock.calls[0]?.[0]
    expect(resultRoute).toEqual({
      name: 'reconciliation-run-result',
      params: {
        savedRunId: 'RS_API',
        outputFileName: 'reconciliation-runs/AUT_ACTIVE_API/20260502/orders_result.json',
      },
      query: {
        runName: 'API Orders',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })

    expect(push).toHaveBeenCalledWith(resultRoute)

    await rows.at(1)?.trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('formats the schedule summary time as AM/PM, matching every other timestamp on the page', async () => {
    const scenarios: Array<{ scheduleExpr: string; expected: string; unexpected: string[] }> = [
      { scheduleExpr: '0 0 9 * * ?', expected: 'Daily at 9:00 AM', unexpected: ['09:00', '9:00 PM'] },
      { scheduleExpr: '0 30 14 * * ?', expected: 'Daily at 2:30 PM', unexpected: ['14:30', '2:30 AM'] },
      { scheduleExpr: '0 0 0 * * ?', expected: 'Daily at 12:00 AM', unexpected: ['00:00', '0:00 AM', '12:00 PM'] },
      { scheduleExpr: '0 0 12 * * ?', expected: 'Daily at 12:00 PM', unexpected: ['12:00 AM'] },
      { scheduleExpr: '0 30 14 ? * MON', expected: 'Weekly on Monday at 2:30 PM', unexpected: ['14:30'] },
      { scheduleExpr: '0 0 12 15 * ?', expected: 'Monthly on day 15 at 12:00 PM', unexpected: ['12:00 AM'] },
    ]

    for (const scenario of scenarios) {
      getAutomation.mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        automation: {
          ...mockAutomation(),
          scheduleExpr: scenario.scheduleExpr,
          scheduleSummary: `Cron: ${scenario.scheduleExpr}`,
        },
      })

      const wrapper = mount(ReconciliationAutomationDashboardPage)
      await flushPromises()

      expect(wrapper.text()).toContain(scenario.expected)
      scenario.unexpected.forEach((text) => expect(wrapper.text()).not.toContain(text))

      wrapper.unmount()
    }
  })

  it('keeps setup row divider spacing compact', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationAutomationDashboardPage.vue', 'utf8')

    expect(source).toMatch(/\.automation-dashboard-setup\s*\{[^}]*gap: 0\.5rem;/)
    expect(source).toMatch(/\.automation-dashboard-setup-head\s*\{[^}]*padding-bottom: 0\.5rem;/)
    expect(source).toMatch(/\.automation-dashboard-detail-item\s*\{[^}]*padding: 0\.45rem 1rem 0\.45rem 0;/)
  })

  it('keeps setup field values regular weight', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationAutomationDashboardPage.vue', 'utf8')

    expect(source).toMatch(/\.automation-dashboard-run-link\s*\{[^}]*font-weight: 400;/)
    expect(source).toMatch(/\.automation-dashboard-detail-item dd\s*\{[^}]*font-weight: 400;/)
    expect(source).not.toContain('font-weight: 500;')
  })

  it('does not render an unlinked open-result label when no route target is available', async () => {
    listAutomationExecutions.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      executions: [
        {
          automationExecutionId: 'EXEC_NO_RESULT',
          statusEnumId: 'AUT_STAT_SUCCESS',
          statusLabel: 'Succeeded',
          scheduledDate: '2026-05-03T06:00:00Z',
          completedDate: '2026-05-03T06:03:00Z',
          differenceCount: 4,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(ReconciliationAutomationDashboardPage)
    await flushPromises()

    const row = wrapper.get('[data-testid="automation-execution-row"]')
    expect(row.text()).toContain('Succeeded')
    expect(row.text()).not.toContain('Open result')
    expect(row.find('[data-testid="automation-execution-result-link"]').exists()).toBe(false)

    await row.trigger('click')
    expect(push).not.toHaveBeenCalled()
  })

  it('paginates previous runs through the shared list pager', async () => {
    const executions = Array.from({ length: 6 }, (_, index) => ({
      automationExecutionId: `EXEC_${index}`,
      statusEnumId: 'AUT_STAT_SUCCESS',
      statusLabel: 'Succeeded',
      scheduledDate: `2026-05-0${index + 1}T06:00:00Z`,
      completedDate: `2026-05-0${index + 1}T06:03:00Z`,
      differenceCount: index,
      resultFileName: `result_${index}.json`,
    }))
    listAutomationExecutions.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      executions,
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 6, pageCount: 1 },
    })

    const wrapper = mount(ReconciliationAutomationDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="automation-executions-page-previous"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Page 1 of 2')
    expect(wrapper.findAll('[data-testid="automation-execution-row"]')).toHaveLength(5)
    expect(wrapper.findAll('[data-testid="automation-execution-row"]').at(0)?.attributes('aria-label')).toBe('Open result result_5.json')
    expect(wrapper.text()).not.toContain('result_5.json')
    expect(wrapper.text()).not.toContain('result_0.json')

    await wrapper.get('[data-testid="automation-executions-page-next"]').trigger('click')

    expect(wrapper.text()).toContain('Page 2 of 2')
    expect(wrapper.findAll('[data-testid="automation-execution-row"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="automation-execution-row"]').at(0)?.attributes('aria-label')).toBe('Open result result_0.json')
    expect(wrapper.text()).not.toContain('result_0.json')
  })

  it('keeps edit, run, delete, and back actions on the dashboard without pause controls', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const wrapper = mount(ReconciliationAutomationDashboardPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="automation-edit-action"]').attributes('data-to')).toContain('"name":"reconciliation-automation-edit"')
    expect(wrapper.get('[data-testid="back-automations"]').attributes('data-to')).toBe('/reconciliation/automations')
    expect(wrapper.find('[data-testid="automation-run-now-action"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="automation-pause-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-resume-action"]').exists()).toBe(false)

    await wrapper.get('[data-testid="automation-delete-action"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('Delete automation "Daily API orders"?')
    expect(deleteAutomation).toHaveBeenCalledWith({ automationId: 'AUT_ACTIVE_API' })
    expect(push).toHaveBeenCalledWith('/reconciliation/automations')
  })

  it('hides mutation actions for view-only users while keeping setup and run history readable', async () => {
    permissions.canEditTenantSettings = false
    permissions.canRunActiveTenantReconciliation = false
    getAutomation.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      automation: {
        ...mockAutomation(),
        permissions: {
          canViewHistory: true,
          canEdit: false,
          canDelete: false,
          canPause: false,
          canResume: false,
          canRunNow: false,
        },
      },
    })

    const wrapper = mount(ReconciliationAutomationDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Daily API orders')
    expect(wrapper.find('[data-testid="automation-edit-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-run-now-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-pause-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-delete-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="back-automations"]').exists()).toBe(true)
  })
})
