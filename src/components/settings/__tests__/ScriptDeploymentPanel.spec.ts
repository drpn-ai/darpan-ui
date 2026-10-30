import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { TenantScript, TenantScriptDeployment } from '../../../lib/api/scriptTypes'
import type { TenantChatSpace } from '../../../lib/api/types'

const listTenantScriptDeployments = vi.hoisted(() => vi.fn())
const saveTenantScriptDeployment = vi.hoisted(() => vi.fn())
const deleteTenantScriptDeployment = vi.hoisted(() => vi.fn())
const runTenantScriptDeployment = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: { listTenantScriptDeployments, saveTenantScriptDeployment, deleteTenantScriptDeployment, runTenantScriptDeployment },
}))

import ScriptDeploymentPanel from '../ScriptDeploymentPanel.vue'

const script = (over: Partial<TenantScript> = {}): TenantScript => ({
  tenantScriptId: '100', scriptName: 'Backorders by SKU', description: null, scriptProfile: 'SCRIPT', inputSource: 'RUN_RESULT',
  scriptBody: "'x'", sampleInputJson: null, isActive: true, createdByUserId: 'U1', createdDate: null, lastUpdatedDate: null, ...over,
})

const space = { chatSpaceId: 'S1', spaceName: 'Ops', chatProviderLabel: 'Google Chat', isActive: 'Y' } as TenantChatSpace

const deployment = (over: Partial<TenantScriptDeployment> = {}): TenantScriptDeployment => ({
  tenantScriptDeploymentId: 'D1', tenantScriptId: '100', scheduleExpr: '0 0 9 * * ?', inputSavedRunId: 'RS_SALES',
  chatSpaceId: 'S1', isActive: true, nextRunDate: '2026-10-31T09:00:00Z', lastRunDate: null, lastRunStatus: null,
  lastRunMessage: null, lastRunUnits: null, ...over,
})

async function mountPanel(scriptOver: Partial<TenantScript> = {}, canEdit = true) {
  const wrapper = mount(ScriptDeploymentPanel, {
    props: { script: script(scriptOver), chatSpaces: [space], savedRunOptions: [{ value: 'RS_SALES', label: 'Sales Orders · Sales orders' }], canEdit },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

describe('ScriptDeploymentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.replaceChildren()
    listTenantScriptDeployments.mockResolvedValue({ deployments: [], timeZone: 'UTC' })
  })

  it('saves a new deployment as a daily cron for the chosen space and saved run', async () => {
    saveTenantScriptDeployment.mockResolvedValue({ deployment: deployment() })
    const wrapper = await mountPanel()
    expect(wrapper.find('[data-testid="script-deploy-summary"]').text()).toContain('Not deployed')
    expect((wrapper.find('[data-testid="script-deploy-preview"]').element as HTMLButtonElement).disabled).toBe(true)

    await wrapper.find('[data-testid="script-deploy-time"]').setValue('07:30')
    ;(wrapper.vm as unknown as { form: { chatSpaceId: string; inputSavedRunId: string; isActive: boolean } }).form.chatSpaceId = 'S1'
    ;(wrapper.vm as unknown as { form: { inputSavedRunId: string } }).form.inputSavedRunId = 'RS_SALES'
    ;(wrapper.vm as unknown as { form: { isActive: boolean } }).form.isActive = true
    await flushPromises()
    await wrapper.find('[data-testid="script-deploy-save"]').trigger('click')
    await flushPromises()

    expect(saveTenantScriptDeployment).toHaveBeenCalledWith({
      tenantScriptDeploymentId: undefined, tenantScriptId: '100', scheduleExpr: '0 30 7 * * ?',
      inputSavedRunId: 'RS_SALES', chatSpaceId: 'S1', isActive: true,
    })
    expect(wrapper.find('[data-testid="script-deploy-summary"]').text()).toContain('Every day at 09:00 (UTC)')
  })

  it('previews the message without sending, and sends only on the second click', async () => {
    listTenantScriptDeployments.mockResolvedValue({ deployments: [deployment()], timeZone: 'UTC' })
    runTenantScriptDeployment
      .mockResolvedValueOnce({ outcome: { status: 'PREVIEW', message: 'Preview only: nothing was sent.', text: 'Backordered units by SKU\nA:S: 3' }, deployment: deployment() })
      .mockResolvedValueOnce({ outcome: { status: 'SENT', message: 'Sent 32 characters.', text: 'Backordered units by SKU\nA:S: 3' },
        deployment: deployment({ lastRunStatus: 'SENT', lastRunDate: '2026-10-30T08:00:00Z' }) })
    const wrapper = await mountPanel()

    await wrapper.find('[data-testid="script-deploy-preview"]').trigger('click')
    await flushPromises()
    expect(runTenantScriptDeployment).toHaveBeenLastCalledWith({ tenantScriptDeploymentId: 'D1', send: false })
    expect(wrapper.find('[data-testid="script-deploy-text"]').text()).toBe('Backordered units by SKU\nA:S: 3')

    await wrapper.find('[data-testid="script-deploy-send"]').trigger('click')
    expect(runTenantScriptDeployment).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="script-deploy-send"]').text()).toBe('Confirm send to Ops')
    await wrapper.find('[data-testid="script-deploy-send"]').trigger('click')
    await flushPromises()
    expect(runTenantScriptDeployment).toHaveBeenLastCalledWith({ tenantScriptDeploymentId: 'D1', send: true })
    expect(wrapper.find('[data-testid="script-deploy-outcome-message"]').text()).toBe('Sent 32 characters.')
    expect(wrapper.find('[data-testid="script-deploy-summary"]').text()).toContain('last: Sent')
  })

  it('a non-daily cron is edited as a cron', async () => {
    listTenantScriptDeployments.mockResolvedValue({ deployments: [deployment({ scheduleExpr: '0 0 9 ? * MON' })], timeZone: 'UTC' })
    const wrapper = await mountPanel()
    expect(wrapper.find('[data-testid="script-deploy-time"]').exists()).toBe(false)
    expect((wrapper.find('[data-testid="script-deploy-cron"]').element as HTMLInputElement).value).toBe('0 0 9 ? * MON')
  })

  it('a sample-input script asks for no saved run; a viewer sees no actions', async () => {
    const wrapper = await mountPanel({ inputSource: 'SAMPLE' }, false)
    expect(wrapper.find('[data-testid="script-deploy-run"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-deploy-save"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-deploy-send"]').exists()).toBe(false)
  })
})
