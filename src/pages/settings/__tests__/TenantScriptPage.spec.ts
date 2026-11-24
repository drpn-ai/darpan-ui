import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { QueryRun, TenantQuery, TenantQuerySchedule } from '../../../lib/api/scriptTypes'

const listTenantQueries = vi.hoisted(() => vi.fn())
const saveTenantQuery = vi.hoisted(() => vi.fn())
const deleteTenantQuery = vi.hoisted(() => vi.fn())
const runTenantQuery = vi.hoisted(() => vi.fn())
const listTenantQuerySchedules = vi.hoisted(() => vi.fn())
const saveTenantQuerySchedule = vi.hoisted(() => vi.fn())
const runTenantQuerySchedule = vi.hoisted(() => vi.fn())
const sendAgentQueryTurn = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const getAgentStatus = vi.hoisted(() => vi.fn())
const getTenantQueryCatalog = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({ params: { tenantScriptId: '100' } as Record<string, string> }))
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true, canScheduleQueries: true }))
const auth = vi.hoisted(() => ({ userId: 'U1' }))

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: {
    listTenantQueries, saveTenantQuery, deleteTenantQuery, runTenantQuery,
    listTenantQuerySchedules, saveTenantQuerySchedule, runTenantQuerySchedule, sendAgentQueryTurn, getTenantQueryCatalog,
  },
  settingsFacade: { listTenantChatSpaces },
  agentFacade: { getAgentStatus },
}))
vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))
vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => auth,
}))
vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRoute: () => route,
    useRouter: () => ({ push, replace }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup(props, { slots, attrs }) {
        return () => h('a', { ...attrs, 'data-to': JSON.stringify(props.to) }, slots.default?.())
      },
    }),
  }
})

import TenantScriptPage from '../TenantScriptPage.vue'

const READ = '{"inputs":[{"name":"orders","source":"dataset","datasetId":"DS_ORDERS","fields":["id","status"]}]}'

const CATALOG = {
  audits: [{ auditId: '100510', auditCode: 'MC', auditName: 'Month-close audit', fields: ['statement', 'recordKey', 'headline'] }],
  savedRuns: [],
  datasets: [{ datasetId: 'DS_ORDERS', system: 'HotWax', idField: 'id', windowField: 'orderDate', recordCount: 3,
    fields: ['id', 'status', 'qty'], wholeRecords: false }],
}

const query = (over: Partial<TenantQuery> = {}): TenantQuery => ({
  tenantQueryId: '100', queryName: 'Open backorders', description: null, readSpecJson: READ,
  readText: 'Reads dataset DS_ORDERS, 2 fields', scriptBody: "{'summary': 'x'}", sampleInputJson: null, isActive: true,
  ownerUserId: 'U1', ...over,
})

const schedule = (over: Partial<TenantQuerySchedule> = {}): TenantQuerySchedule => ({
  scheduleId: 'S100', tenantQueryId: '100', cronExpression: '0 0 7 * * ?', timeZone: 'UTC', isActive: 'Y',
  ownerUserId: 'U1', ownerName: 'Aditi Patel', emailTo: 'ops@krewe.example, cfo@krewe.example', emailCc: null, chatSpaceId: 'C1',
  recipientCount: 2, nextRunDate: null, lastRunDate: '2026-11-18T07:00:00Z', lastRunStatus: 'OK', lastRunMessage: 'Sent.',
  deliveries: [], ...over,
})

const run = (over: Partial<QueryRun> = {}): QueryRun => ({
  ok: true, summary: '3 backorders', nothing: false, invalid: null, data: null,
  files: [{ name: 'backorders.csv', columns: ['id', 'status'], rowCount: 3, previewRows: [['1', 'B'], ['3', 'B'], ['7', 'B']] }],
  readCounts: { orders: 3 }, units: 120, elapsedMs: 9, logs: [], error: null, readText: 'Reads dataset DS_ORDERS, 2 fields', ...over,
})

async function mountPage() {
  const wrapper = mount(TenantScriptPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

function text(wrapper: VueWrapper, testId: string): string {
  return wrapper.find(`[data-testid="${testId}"]`).text()
}

async function choose(wrapper: VueWrapper, selectTestId: string, value: string): Promise<void> {
  await wrapper.find(`[data-testid="${selectTestId}"]`).trigger('click')
  await wrapper.find(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

describe('TenantScriptPage (query)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    permissions.canScheduleQueries = true
    auth.userId = 'U1'
    route.params = { tenantScriptId: '100' }
    document.body.replaceChildren()
    listTenantQueries.mockResolvedValue({ queries: [query()], library: [], limits: {} })
    listTenantQuerySchedules.mockResolvedValue({ schedules: [schedule()], timeZone: 'UTC' })
    listTenantChatSpaces.mockResolvedValue({ chatSpaces: [
      { chatSpaceId: 'C1', spaceName: '#ops-daily', chatProviderLabel: 'Slack', isActive: 'Y' },
      { chatSpaceId: 'C2', spaceName: '#finance', chatProviderLabel: 'Slack', isActive: 'Y' },
    ] })
    runTenantQuery.mockResolvedValue({ result: run() })
    getAgentStatus.mockResolvedValue({ state: 'ON', grantState: 'LIVE', canApprove: true })
    getTenantQueryCatalog.mockResolvedValue(CATALOG)
    saveTenantQuery.mockImplementation(async (payload: Partial<TenantQuery>) => ({ query: query({ ...payload, tenantQueryId: payload.tenantQueryId ?? '900' }) }))
    saveTenantQuerySchedule.mockImplementation(async (payload: Record<string, unknown>) => ({ schedule: schedule({ ...payload } as Partial<TenantQuerySchedule>) }))
  })

  it('shows the name, the read by name, and the schedule facts with who it sends as', async () => {
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-name')).toBe('Open backorders')
    expect(getTenantQueryCatalog).toHaveBeenCalledTimes(1)
    const row = wrapper.find('[data-testid="script-read-input"]')
    expect(row.find('.query-read__name').text()).toBe('orders')
    expect(row.find('[data-testid="script-read-sentence"]').text().replace(/\s+/g, ' ')).toBe('Records of HotWax DS_ORDERS. Keeps id status')
    expect(text(wrapper, 'script-fact-schedule')).toContain('Daily at 7:00 AM')
    expect(text(wrapper, 'script-fact-sends-to')).toContain('2 addresses · #ops-daily')
    expect(text(wrapper, 'script-fact-last-run')).toMatch(/· sent$/)
    expect(text(wrapper, 'script-fact-sends-as')).toBe('Sends asAditi Patelsaved the schedule')
    expect(listTenantQuerySchedules).toHaveBeenCalledWith({ tenantQueryId: '100' })
  })

  it('reads top to bottom: facts, then 1 Data, 2 Script, 3 Result, with no tabs', async () => {
    const wrapper = await mountPage()
    const order = ['script-facts', 'script-ask', 'query-step-data', 'query-step-script', 'query-step-result']
      .map((id) => wrapper.find(`[data-testid="${id}"]`).element)
    order.slice(1).forEach((element, index) => {
      expect(order[index]!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
    expect(wrapper.findAll('[data-testid="query-step-data"] h2 span').map((span) => span.text())).toEqual(['1', 'Data'])
    expect(wrapper.findAll('[data-testid="query-step-script"] h2 span').map((span) => span.text())).toEqual(['2', 'Script'])
    expect(wrapper.findAll('[data-testid="query-step-result"] h2 span').map((span) => span.text())).toEqual(['3', 'Result'])
    expect(wrapper.find('[role="tab"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="query-step-result"] [data-testid="script-run"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="query-step-result"] [data-testid="script-preview"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="query-step-script"] [data-testid="script-functions-link"]').exists()).toBe(true)
  })

  it('a part of the sentence opens the Data popup, and its save changes the read and marks it edited', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="script-read-part"]')[0]!.trigger('click')
    expect(wrapper.find('[data-testid="query-data-popup"]').exists()).toBe(true)
    expect(wrapper.find('.static-page-frame--popup-open').exists()).toBe(true)
    await wrapper.findAll('[data-testid="query-data-keep"]').find((chip) => chip.text() === 'qty')!.trigger('click')
    await wrapper.find('[data-testid="query-data-window"]').setValue('7')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-popup"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(true)
    expect(text(wrapper, 'script-read-sentence').replace(/\s+/g, ' ')).toBe('Records of HotWax DS_ORDERS, orderDate in the last 7 days. Keeps id status qty')

    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    const sent = JSON.parse(runTenantQuery.mock.calls[0]![0].readSpecJson)
    expect(sent).toEqual({ inputs: [{ name: 'orders', source: 'dataset', datasetId: 'DS_ORDERS', fields: ['id', 'status', 'qty'],
      window: { field: 'orderDate', lastDays: 7 } }] })
  })

  it('adds an input with the plus, and removes one with its trash', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-read-add"]').trigger('click')
    await wrapper.find('[data-testid="query-data-source"]').trigger('click')
    await wrapper.find('[data-testid="app-select-option"][data-option-value="100510"]').trigger('click')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(wrapper.findAll('[data-testid="script-read-input"]')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid="script-read-sentence"]')[1]!.text()).toContain('Open findings of Month-close audit')

    await wrapper.findAll('[data-testid="script-read-remove"]')[1]!.trigger('click')
    await wrapper.findAll('[data-testid="script-read-remove"]')[0]!.trigger('click')
    expect(text(wrapper, 'script-read-empty')).toBe('Reads nothing: script only')
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantQuery).toHaveBeenCalledWith(expect.objectContaining({ readSpecJson: '' }))
  })

  it('an input the popup cannot change reads as plain words and points to the JSON', async () => {
    const grouped = '{"inputs":[{"name":"byStatus","source":"dataset","datasetId":"DS_ORDERS","groupBy":["status"],"measures":[{"fn":"count","as":"n"}]}]}'
    listTenantQueries.mockResolvedValue({ queries: [query({ readSpecJson: grouped })], library: [], limits: {} })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-read-part"]').exists()).toBe(false)
    expect(text(wrapper, 'script-read-limits')).toBe('Change it in the JSON: it has groups, measures.')
  })

  it('without the catalog the read shows ids and the popup says why', async () => {
    getTenantQueryCatalog.mockRejectedValue(new Error('Catalog unavailable.'))
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-read-sentence').replace(/\s+/g, ' ')).toBe('Records of DS_ORDERS. Keeps id status')
    await wrapper.findAll('[data-testid="script-read-part"]')[0]!.trigger('click')
    expect(text(wrapper, 'query-data-catalog-error')).toContain('Catalog unavailable.')
  })

  it('a read that is not JSON says so and shows the JSON to fix', async () => {
    listTenantQueries.mockResolvedValue({ queries: [query({ readSpecJson: '{"inputs": [' })], library: [], limits: {} })
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-read-invalid')).toMatch(/^The read is not valid JSON/)
    expect(wrapper.find('[data-testid="script-read"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="script-read-add"]').attributes('disabled')).toBeDefined()
  })

  it('runs the draft and shows each file with its row count and a preview', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(runTenantQuery).toHaveBeenCalledWith({ tenantQueryId: '100', readSpecJson: READ, scriptBody: "{'summary': 'x'}" })
    const cell = wrapper.find('[data-testid="script-run-cell"]')
    expect(cell.find('[data-testid="script-run-summary"]').text()).toBe('3 backorders')
    expect(cell.find('[data-testid="script-run-file"]').text()).toContain('backorders.csv · 3 rows')
    expect(cell.findAll('[data-testid="script-run-preview-row"]')).toHaveLength(3)
    expect(cell.find('[data-testid="script-run-meta"]').text()).toContain('read orders 3')
  })

  it('names the field when the read fails', async () => {
    runTenantQuery.mockResolvedValue({ result: run({ ok: false, files: [], summary: null,
      error: { kind: 'READ_ERROR', message: 'qty is no longer kept for dataset DS_ORDERS: no audit reads it now.' } }) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'script-run-error')).toBe('Read failed: qty is no longer kept for dataset DS_ORDERS: no audit reads it now.')
  })

  it('a script error marks its line', async () => {
    runTenantQuery.mockResolvedValue({ result: run({ ok: false, files: [], summary: null, error: { kind: 'SCRIPT_ERROR', message: 'Unknown name x', line: 1 } }) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'script-run-error')).toBe('Line 1: Unknown name x')
    expect(wrapper.find('.script-code__line--error').text()).toBe('1')
  })

  it('the code icon shows the read as JSON, and typing there changes the sentence', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-read"]').exists()).toBe(false)
    const toggle = wrapper.find('[data-testid="script-read-json-toggle"]')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-pressed')).toBe('true')
    const json = wrapper.find('[data-testid="script-read"]')
    expect((json.element as HTMLTextAreaElement).value).toBe(READ)
    await json.setValue(READ.replace('"status"', '"qty"'))
    expect(text(wrapper, 'script-read-sentence').replace(/\s+/g, ' ')).toBe('Records of HotWax DS_ORDERS. Keeps id qty')
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(true)
    await toggle.trigger('click')
    expect(wrapper.find('[data-testid="script-read"]').exists()).toBe(false)
  })

  it('asks the agent, and its proposal fills the read and script and shows how it ran', async () => {
    sendAgentQueryTurn.mockResolvedValue({ conversationId: 'CV1', outcome: 'DONE', reply: 'It lists open backorders.',
      question: null, masked: [],
      queryProposal: { proposal: { queryName: 'Backorders', description: null, readSpecJson: READ, scriptBody: "{'summary': 'new'}",
        readText: 'Reads dataset DS_ORDERS, 2 fields' }, preview: run({ summary: 'from the agent' }) } })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-ask"]').setValue('Which orders are backordered?')
    await wrapper.find('[data-testid="script-ask-send"]').trigger('click')
    await flushPromises()
    expect(sendAgentQueryTurn).toHaveBeenCalledWith({ text: 'Which orders are backordered?', readSpecJson: READ, scriptBody: "{'summary': 'x'}" })
    expect(text(wrapper, 'script-ask-reply')).toBe('It lists open backorders.')
    expect((wrapper.find('[data-testid="script-body"]').element as HTMLTextAreaElement).value).toBe("{'summary': 'new'}")
    expect(text(wrapper, 'script-run-summary')).toBe('from the agent')
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(true)
    expect(saveTenantQuery).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="script-ask-undo"]').trigger('click')
    expect((wrapper.find('[data-testid="script-body"]').element as HTMLTextAreaElement).value).toBe("{'summary': 'x'}")
  })

  it('hides the ask box when the agent is off or the person has no AI access', async () => {
    getAgentStatus.mockResolvedValue({ state: 'ON', grantState: 'NOT_GRANTED', canApprove: false })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-ask"]').exists()).toBe(false)
  })

  it('shows where the schedule sends, in full, to everyone who can see the query', async () => {
    permissions.canScheduleQueries = false
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-fact-sends-to')).toBe('Sends to2 addresses · #ops-dailyops@krewe.example, cfo@krewe.example')
  })

  it('the schedule popup keeps email recipients and a chat space, and Save sends them', async () => {
    listTenantQuerySchedules.mockResolvedValue({ schedules: [], timeZone: 'UTC' })
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-fact-schedule')).toContain('Not scheduled')
    await wrapper.find('[data-testid="script-fact-schedule"]').trigger('click')
    await wrapper.find('[data-testid="script-schedule-email-to"]').setValue('ops@krewe.example; cfo@krewe.example')
    await choose(wrapper, 'script-schedule-space', 'C2')
    await wrapper.find('[data-testid="script-schedule-save"]').trigger('click')
    expect(text(wrapper, 'script-fact-sends-to')).toContain('2 addresses · #finance')
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantQuerySchedule).toHaveBeenCalledWith(expect.objectContaining({ tenantQueryId: '100', dailyAt: '09:00',
      emailTo: 'ops@krewe.example, cfo@krewe.example', chatSpaceId: 'C2', isActive: false }))
  })

  it('refuses an address that is not one', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-fact-schedule"]').trigger('click')
    await wrapper.find('[data-testid="script-schedule-email-to"]').setValue('ops')
    await wrapper.find('[data-testid="script-schedule-save"]').trigger('click')
    expect(text(wrapper, 'script-schedule-error')).toBe('ops is not an email address.')
  })

  it('without tenant admin the toggle is off-limits and says why', async () => {
    permissions.canScheduleQueries = false
    const wrapper = await mountPage()
    const toggle = wrapper.find('[data-testid="script-on-schedule"]')
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(toggle.attributes('aria-label')).toBe('On schedule: scheduling needs tenant admin')
    expect(wrapper.find('[data-testid="script-fact-schedule"]').element.tagName).not.toBe('BUTTON')
  })

  it('only the owner can send now', async () => {
    runTenantQuerySchedule.mockResolvedValue({ outcome: { status: 'PREVIEW', message: 'Would email 2 addresses.', result: { summary: '3 backorders' } } })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-preview"]').trigger('click')
    await flushPromises()
    expect(runTenantQuerySchedule).toHaveBeenCalledWith({ scheduleId: 'S100', send: false })
    expect(text(wrapper, 'script-preview-message')).toContain('Would email 2 addresses.')
    expect(wrapper.find('[data-testid="script-send-now"]').exists()).toBe(true)
    wrapper.unmount()

    auth.userId = 'U2'
    const other = await mountPage()
    await other.find('[data-testid="script-preview"]').trigger('click')
    await flushPromises()
    expect(other.find('[data-testid="script-send-now"]').exists()).toBe(false)
    expect(text(other, 'script-preview-owner-note')).toBe('Only Aditi Patel can send it now.')
  })

  it('a new query with a schedule saves both before it moves to its own page', async () => {
    route.params = {}
    listTenantQuerySchedules.mockResolvedValue({ schedules: [], timeZone: 'UTC' })
    const order: string[] = []
    saveTenantQuerySchedule.mockImplementation(async (payload: Record<string, unknown>) => {
      order.push('schedule')
      return { schedule: schedule({ ...payload } as Partial<TenantQuerySchedule>) }
    })
    replace.mockImplementation(() => { order.push('move') })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-fact-schedule"]').trigger('click')
    await wrapper.find('[data-testid="script-schedule-email-to"]').setValue('ops@krewe.example')
    await wrapper.find('[data-testid="script-schedule-save"]').trigger('click')
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(order).toEqual(['schedule', 'move'])
  })

  it('a new query runs as it opens: its read starts on the first audit, not a blank one, and is not marked edited', async () => {
    route.params = {}
    listTenantQuerySchedules.mockResolvedValue({ schedules: [], timeZone: 'UTC' })
    // The catalog lands after the draft is built: the untouched starter still picks up the audit.
    let landCatalog: (value: typeof CATALOG) => void = () => {}
    getTenantQueryCatalog.mockReturnValue(new Promise((resolve) => { landCatalog = resolve }))
    const wrapper = await mountPage()
    landCatalog(CATALOG)
    await flushPromises()
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(false)
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    const sent = runTenantQuery.mock.calls[0]?.[0] as { readSpecJson: string; scriptBody: string }
    expect(JSON.parse(sent.readSpecJson).inputs[0]).toMatchObject({ source: 'auditFindings', auditId: '100510' })
    expect(sent.scriptBody).toContain('input.findings')
  })

  it('a new query opened after the catalog loads also starts on the first audit', async () => {
    route.params = {}
    let landSchedules: (value: unknown) => void = () => {}
    listTenantQuerySchedules.mockReturnValue(new Promise((resolve) => { landSchedules = resolve }))
    const wrapper = await mountPage()
    landSchedules({ schedules: [], timeZone: 'UTC' })
    await flushPromises()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    const sent = runTenantQuery.mock.calls[0]?.[0] as { readSpecJson: string }
    expect(JSON.parse(sent.readSpecJson).inputs[0].auditId).toBe('100510')
  })

  it('a new query saves and moves to its own page', async () => {
    route.params = {}
    listTenantQuerySchedules.mockResolvedValue({ schedules: [], timeZone: 'UTC' })
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-name')).toBe('New query')
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantQuery).toHaveBeenCalledWith(expect.objectContaining({ queryName: 'New query' }))
    expect(replace).toHaveBeenCalledWith({ name: 'settings-tenant-script', params: { tenantScriptId: '900' } })
    expect(saveTenantQuerySchedule).not.toHaveBeenCalled()
  })
})
