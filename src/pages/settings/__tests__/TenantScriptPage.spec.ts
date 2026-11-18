import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { TenantScript, TenantScriptDeployment } from '../../../lib/api/scriptTypes'

const listTenantScripts = vi.hoisted(() => vi.fn())
const saveTenantScript = vi.hoisted(() => vi.fn())
const deleteTenantScript = vi.hoisted(() => vi.fn())
const runTenantScript = vi.hoisted(() => vi.fn())
const listTenantScriptDeployments = vi.hoisted(() => vi.fn())
const saveTenantScriptDeployment = vi.hoisted(() => vi.fn())
const runTenantScriptDeployment = vi.hoisted(() => vi.fn())
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({ params: { tenantScriptId: '100' } as Record<string, string> }))
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: {
    listTenantScripts, saveTenantScript, deleteTenantScript, runTenantScript,
    listTenantScriptDeployments, saveTenantScriptDeployment, runTenantScriptDeployment,
  },
  reconciliationFacade: { listGeneratedOutputs },
  settingsFacade: { listTenantChatSpaces },
}))
vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
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

const script = (over: Partial<TenantScript> = {}): TenantScript => ({
  tenantScriptId: '100', scriptName: 'Orders only in OMS', description: null, scriptProfile: 'SCRIPT', inputSource: 'RUN_RESULT',
  scriptBody: "size(input.differences)", sampleInputJson: '{"payments":[1]}', isActive: true,
  createdByUserId: 'U1', createdDate: null, lastUpdatedDate: null, ...over,
})

const deployment = (over: Partial<TenantScriptDeployment> = {}): TenantScriptDeployment => ({
  tenantScriptDeploymentId: 'D1', tenantScriptId: '100', scheduleExpr: '0 0 7 * * ?', inputSavedRunId: 'RS_SALES',
  chatSpaceId: 'S1', isActive: true, nextRunDate: null, lastRunDate: '2026-11-18T07:00:00Z', lastRunStatus: 'SENT',
  lastRunMessage: 'Sent 32 characters.', lastRunUnits: 40, ...over,
})

const okRun = (result: unknown, over: Record<string, unknown> = {}) => ({
  run: { ok: true, profile: 'SCRIPT', result, units: 42, elapsedMs: 3, logs: [], error: null, ...over },
  inputSummary: { source: 'RUN_RESULT', fileName: 'r2.json', records: 6, totalDifferences: 6 },
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

describe('TenantScriptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    route.params = { tenantScriptId: '100' }
    document.body.replaceChildren()
    listTenantScripts.mockResolvedValue({
      scripts: [script()],
      library: [{ name: 'dec(x)', help: 'x as a decimal number' }],
      limits: { SCRIPT: { maxSourceChars: 64000, unitLimit: 2000000, timeoutMs: 2000 } },
    })
    listTenantScriptDeployments.mockResolvedValue({ deployments: [deployment()], timeZone: 'UTC' })
    listGeneratedOutputs.mockImplementation(async (payload: { savedRunId?: string }) => ({
      generatedOutputs: payload.savedRunId
        ? [{ fileName: 'r2.json', savedRunId: payload.savedRunId }, { fileName: 'r1.json', savedRunId: payload.savedRunId }]
        : [
            { fileName: 'r2.json', savedRunId: 'RS_SALES', savedRunName: 'Sales Orders' },
            { fileName: 'r3.json', savedRunId: 'RS_REFUNDS', savedRunName: 'Refunds' },
          ],
    }))
    listTenantChatSpaces.mockResolvedValue({ chatSpaces: [
      { chatSpaceId: 'S1', spaceName: '#ops-daily', chatProviderLabel: 'Slack', isActive: 'Y' },
      { chatSpaceId: 'S2', spaceName: '#finance', chatProviderLabel: 'Slack', isActive: 'Y' },
    ] })
    saveTenantScript.mockImplementation(async (payload: Partial<TenantScript>) => ({ script: script({ ...payload, tenantScriptId: payload.tenantScriptId ?? '900' }) }))
    saveTenantScriptDeployment.mockImplementation(async (payload: Partial<TenantScriptDeployment>) => ({ deployment: deployment({ ...payload }) }))
  })

  it('shows the name as the title and the four facts', async () => {
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-name')).toBe('Orders only in OMS')
    expect(text(wrapper, 'script-fact-reads')).toContain('Sales Orders')
    expect(text(wrapper, 'script-fact-reads')).toContain('newest result')
    expect(text(wrapper, 'script-fact-schedule')).toContain('Daily at 7:00 AM')
    expect(text(wrapper, 'script-fact-posts-to')).toContain('#ops-daily')
    expect(text(wrapper, 'script-fact-last-run')).toMatch(/· sent$/)
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(false)
    expect(listTenantScriptDeployments).toHaveBeenCalledWith({ tenantScriptId: '100' })
  })

  it('renames in place; Esc puts the name back', async () => {
    const wrapper = await mountPage()
    const title = wrapper.find('[data-testid="script-name"]')
    const element = title.element as HTMLElement
    expect(element.getAttribute('contenteditable')).toBe('plaintext-only')

    await title.trigger('focus')
    element.textContent = 'Orders only in Shopify'
    await title.trigger('input')
    expect(wrapper.find('[data-testid="script-edited"]').text()).toBe('• edited')
    await title.trigger('keydown', { key: 'Escape' })
    expect(element.textContent).toBe('Orders only in OMS')
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(false)

    await title.trigger('focus')
    element.textContent = 'Orders only in Shopify'
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledWith(expect.objectContaining({ tenantScriptId: '100', scriptName: 'Orders only in Shopify' }))
    // Nothing about the schedule changed, so only the script is saved.
    expect(saveTenantScriptDeployment).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(false)
  })

  it('keeps the on-schedule toggle off and disabled until a schedule exists', async () => {
    listTenantScriptDeployments.mockResolvedValue({ deployments: [], timeZone: 'UTC' })
    const wrapper = await mountPage()
    const toggle = wrapper.find('[data-testid="script-on-schedule"]')
    expect(toggle.attributes('aria-label')).toBe('On schedule')
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(toggle.attributes('disabled')).toBeDefined()
    expect(text(wrapper, 'script-fact-schedule')).toContain('Not scheduled')
    expect(text(wrapper, 'script-fact-posts-to')).toContain('—')
    expect(text(wrapper, 'script-fact-last-run')).toContain('Never')
  })

  it('flips the deployment on the toggle and keeps it with Save', async () => {
    const wrapper = await mountPage()
    const toggle = wrapper.find('[data-testid="script-on-schedule"]')
    expect(toggle.attributes('aria-checked')).toBe('true')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-checked')).toBe('false')
    expect(text(wrapper, 'script-fact-schedule')).toContain('Off')
    expect(wrapper.find('[data-testid="script-edited"]').exists()).toBe(true)
    expect(saveTenantScriptDeployment).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledTimes(1)
    expect(saveTenantScriptDeployment).toHaveBeenCalledWith({
      tenantScriptDeploymentId: 'D1', tenantScriptId: '100', scheduleExpr: '0 0 7 * * ?',
      inputSavedRunId: 'RS_SALES', chatSpaceId: 'S1', isActive: false,
    })
  })

  it('changes what it reads in the Reads popup, and Save carries it to the schedule', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-fact-reads"]').trigger('click')
    expect(wrapper.find('.popup-workflow-modal').text()).toContain('What should it read?')
    expect(wrapper.find('main').classes()).toContain('static-page-frame--popup-open')

    await choose(wrapper, 'script-reads-select', 'RS_REFUNDS')
    expect(wrapper.find('[data-testid="script-sample"]').exists()).toBe(false)
    await wrapper.find('[data-testid="script-reads-save"]').trigger('click')
    expect(wrapper.find('.popup-workflow-modal').exists()).toBe(false)
    expect(text(wrapper, 'script-fact-reads')).toContain('Refunds')

    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledWith(expect.objectContaining({ inputSource: 'RUN_RESULT' }))
    expect(saveTenantScriptDeployment).toHaveBeenCalledWith(expect.objectContaining({ inputSavedRunId: 'RS_REFUNDS' }))
  })

  it('shows the sample JSON when the script reads the sample', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-fact-reads"]').trigger('click')
    await choose(wrapper, 'script-reads-select', '__sample__')
    const sample = wrapper.find('[data-testid="script-sample"]')
    expect((sample.element as HTMLTextAreaElement).value).toBe('{"payments":[1]}')
    await sample.setValue('{"payments":[1,2]}')
    await wrapper.find('[data-testid="script-reads-save"]').trigger('click')
    expect(text(wrapper, 'script-fact-reads')).toContain('Sample JSON')

    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledWith(expect.objectContaining({ inputSource: 'SAMPLE', sampleInputJson: '{"payments":[1,2]}' }))
    expect(saveTenantScriptDeployment).toHaveBeenCalledWith(expect.objectContaining({ inputSavedRunId: undefined }))
  })

  it('sets up a schedule from either fact and saves script and schedule with one Save', async () => {
    listTenantScriptDeployments.mockResolvedValue({ deployments: [], timeZone: 'America/Los_Angeles' })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-fact-posts-to"]').trigger('click')
    const popup = wrapper.find('.popup-workflow-modal')
    expect(popup.text()).toContain('Set up the schedule.')
    expect(popup.text()).toContain('Daily at · America/Los_Angeles')
    await wrapper.find('[data-testid="script-schedule-cancel"]').trigger('click')

    await wrapper.find('[data-testid="script-fact-schedule"]').trigger('click')
    expect((wrapper.find('[data-testid="script-schedule-save"]').element as HTMLButtonElement).disabled).toBe(true)
    await choose(wrapper, 'script-schedule-space', 'S2')
    await wrapper.find('[data-testid="script-schedule-active"]').trigger('click')
    await wrapper.find('[data-testid="script-schedule-save"]').trigger('click')

    expect(text(wrapper, 'script-fact-schedule')).toContain('Daily at 9:00 AM')
    expect(text(wrapper, 'script-fact-posts-to')).toContain('#finance')
    expect(wrapper.find('[data-testid="script-on-schedule"]').attributes('disabled')).toBeUndefined()
    expect(saveTenantScriptDeployment).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledWith(expect.objectContaining({ tenantScriptId: '100' }))
    expect(saveTenantScriptDeployment).toHaveBeenCalledWith({
      tenantScriptDeploymentId: undefined, tenantScriptId: '100', scheduleExpr: '0 0 9 * * ?',
      inputSavedRunId: undefined, chatSpaceId: 'S2', isActive: true,
    })
    await wrapper.find('[data-testid="script-fact-schedule"]').trigger('click')
    expect(wrapper.find('.popup-workflow-modal').text()).toContain('Change the schedule.')
  })

  it('runs on the newest result of the saved run it reads, newest cell first, three kept', async () => {
    runTenantScript.mockResolvedValue(okRun('6 orders', { logs: ['6 only in OMS'] }))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()

    expect(listGeneratedOutputs).toHaveBeenCalledWith({ savedRunId: 'RS_SALES', pageIndex: 0, pageSize: 20 })
    expect(runTenantScript).toHaveBeenCalledWith({
      tenantScriptId: '100', scriptBody: 'size(input.differences)', scriptProfile: 'SCRIPT',
      inputSource: 'RUN_RESULT', inputJson: undefined, fileName: 'r2.json',
    })
    let cells = wrapper.findAll('[data-testid="script-run-cell"]')
    expect(cells).toHaveLength(1)
    expect(cells[0]!.text()).toContain('Run 1 · latest')
    expect(cells[0]!.find('[data-testid="script-run-result"]').text()).toBe('"6 orders"')
    expect(cells[0]!.find('[data-testid="script-run-logs"]').text()).toContain('6 only in OMS')
    expect(cells[0]!.find('[data-testid="script-run-meta"]').text()).toBe('42 units · 3 ms · on Sales Orders')

    await wrapper.find('[data-testid="script-body"]').setValue('size(input.differences) + 1')
    // ⌘↵ in the code runs too.
    await wrapper.find('[data-testid="script-body"]').trigger('keydown', { key: 'Enter', metaKey: true })
    await flushPromises()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()

    cells = wrapper.findAll('[data-testid="script-run-cell"]')
    expect(cells).toHaveLength(3)
    expect(cells[0]!.text()).toContain('Run 4 · latest')
    expect(cells[2]!.text()).toContain('Run 2')
    expect(cells[2]!.text()).not.toContain('latest')
    expect(cells[2]!.find('[data-testid="script-run-meta"]').text()).toBe('42 units · 3 ms · on Sales Orders · after an edit')
    expect(cells[0]!.find('[data-testid="script-run-meta"]').text()).not.toContain('after an edit')
    // The last scheduled run sits under this visit's runs.
    expect(wrapper.find('[data-testid="script-scheduled-cell"]').text()).toContain('Sent 32 characters.')
  })

  it('marks the error line in the gutter and dashes the failed cell', async () => {
    runTenantScript.mockResolvedValue(okRun(null, { ok: false, error: { kind: 'PARSE', message: 'unexpected token', line: 2 } }))
    const wrapper = await mountPage()
    expect(wrapper.findAll('.script-code__line--error')).toHaveLength(0)
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()

    const cell = wrapper.find('[data-testid="script-run-cell"]')
    expect(cell.classes()).toContain('script-run--failed')
    expect(cell.find('[data-testid="script-run-error"]').text()).toBe('Line 2: unexpected token')
    const lines = wrapper.findAll('[data-testid="script-gutter-line"]')
    expect(lines.length).toBeGreaterThanOrEqual(12)
    expect(lines[1]!.classes()).toContain('script-code__line--error')
    expect(wrapper.findAll('.script-code__line--error')).toHaveLength(1)
  })

  it('says so when the saved run has no finished result, and runs nothing', async () => {
    listGeneratedOutputs.mockImplementation(async (payload: { savedRunId?: string }) => ({
      generatedOutputs: payload.savedRunId ? [] : [{ fileName: 'r2.json', savedRunId: 'RS_SALES', savedRunName: 'Sales Orders' }],
    }))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(runTenantScript).not.toHaveBeenCalled()
    expect(text(wrapper, 'script-run-error-message')).toContain('Sales Orders has no finished result yet.')
  })

  it('links the d: functions docs and lists no functions on the page', async () => {
    const wrapper = await mountPage()
    const link = wrapper.find('[data-testid="script-functions-link"]')
    expect(link.attributes('href')).toBe('https://developers.drpn.ai/tenant-scripts/functions')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(wrapper.find('[data-testid="script-library"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('d:dec')
    expect(wrapper.text()).not.toContain('JEXL kept as data')
  })

  it('previews the message and sends it from the popup', async () => {
    runTenantScriptDeployment
      .mockResolvedValueOnce({ outcome: { status: 'PREVIEW', message: 'Preview only: nothing was sent.', text: 'Orders only in OMS: 6' }, deployment: deployment() })
      .mockResolvedValueOnce({ outcome: { status: 'SENT', message: 'Sent 21 characters.', text: 'Orders only in OMS: 6' },
        deployment: deployment({ lastRunMessage: 'Sent 21 characters.' }) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-preview"]').trigger('click')
    await flushPromises()
    expect(runTenantScriptDeployment).toHaveBeenLastCalledWith({ tenantScriptDeploymentId: 'D1', send: false })
    expect(text(wrapper, 'script-preview-text')).toBe('Orders only in OMS: 6')

    await wrapper.find('[data-testid="script-send-now"]').trigger('click')
    await flushPromises()
    expect(runTenantScriptDeployment).toHaveBeenLastCalledWith({ tenantScriptDeploymentId: 'D1', send: true })
    expect(text(wrapper, 'script-preview-message')).toBe('Sent 21 characters.')
  })

  it('has no Preview message without a schedule', async () => {
    listTenantScriptDeployments.mockResolvedValue({ deployments: [], timeZone: 'UTC' })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-preview"]').exists()).toBe(false)
  })

  it('reads a failed scheduled run as Failed and dashes its cell', async () => {
    listTenantScriptDeployments.mockResolvedValue({
      deployments: [deployment({ lastRunStatus: 'SCRIPT_ERROR', lastRunMessage: 'Line 1: input.rows is empty.' })], timeZone: 'UTC',
    })
    const wrapper = await mountPage()
    expect(text(wrapper, 'script-fact-last-run')).toMatch(/Failed · /)
    const scheduled = wrapper.find('[data-testid="script-scheduled-cell"]')
    expect(scheduled.classes()).toContain('script-run--failed')
    expect(scheduled.text()).toContain('Line 1: input.rows is empty.')
  })

  it('deletes only after the popup confirms, then goes back to the list', async () => {
    deleteTenantScript.mockResolvedValue({})
    const wrapper = await mountPage()
    expect(JSON.parse(wrapper.find('[data-testid="script-back"]').attributes('data-to')!)).toEqual({ name: 'settings-tenant-scripts' })
    await wrapper.find('[data-testid="script-delete"]').trigger('click')
    expect(deleteTenantScript).not.toHaveBeenCalled()
    expect(wrapper.find('.popup-workflow-modal').text()).toContain('Its schedule stops and it leaves the Notifications grid.')

    await wrapper.find('[data-testid="script-delete-cancel"]').trigger('click')
    expect(wrapper.find('.popup-workflow-modal').exists()).toBe(false)

    await wrapper.find('[data-testid="script-delete"]').trigger('click')
    await wrapper.find('[data-testid="script-delete-confirm"]').trigger('click')
    await flushPromises()
    expect(deleteTenantScript).toHaveBeenCalledWith({ tenantScriptId: '100' })
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-scripts' })
  })

  it('shows the backend refusal of a save', async () => {
    saveTenantScript.mockRejectedValue(new ApiCallError('Line 2: parsing error'))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'script-page-error')).toContain('Line 2: parsing error')
  })

  it('starts a new script from the sample, and its first Save moves to its own address', async () => {
    route.params = {}
    runTenantScript.mockResolvedValue(okRun({ paid: 50 }))
    const wrapper = await mountPage()
    expect(listTenantScripts).not.toHaveBeenCalled()
    expect(text(wrapper, 'script-name')).toBe('New script')
    expect(text(wrapper, 'script-fact-reads')).toContain('Sample JSON')
    expect(wrapper.find('[data-testid="script-delete"]').exists()).toBe(false)

    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(runTenantScript.mock.calls[0]![0]).toEqual(expect.objectContaining({ tenantScriptId: undefined, inputSource: 'SAMPLE', fileName: undefined }))
    expect(runTenantScript.mock.calls[0]![0].inputJson).toContain('"orderId"')

    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledWith(expect.objectContaining({ tenantScriptId: undefined, scriptName: 'New script', inputSource: 'SAMPLE' }))
    expect(saveTenantScriptDeployment).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ name: 'settings-tenant-script', params: { tenantScriptId: '900' } })
  })

  it('lets a viewer read the script but not change, run or save it', async () => {
    permissions.canEditTenantSettings = false
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-name"]').attributes('contenteditable')).toBe('false')
    // A viewer's facts are plain text (DAR-UI-126), not buttons, so nothing opens.
    for (const fact of ['script-fact-reads', 'script-fact-schedule', 'script-fact-posts-to']) {
      await wrapper.find(`[data-testid="${fact}"]`).trigger('click')
      expect(wrapper.find(`[data-testid="${fact}"]`).element.tagName).toBe('DIV')
    }
    expect(wrapper.find('.popup-workflow-modal').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-on-schedule"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="script-run"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="script-body"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="script-save"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-preview"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-back"]').exists()).toBe(true)
  })
})
