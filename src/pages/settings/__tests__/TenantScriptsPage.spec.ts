import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { TenantScript, TenantScriptDeployment } from '../../../lib/api/scriptTypes'

const listTenantScripts = vi.hoisted(() => vi.fn())
const listTenantScriptDeployments = vi.hoisted(() => vi.fn())
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: { listTenantScripts, listTenantScriptDeployments },
  reconciliationFacade: { listGeneratedOutputs },
  settingsFacade: { listTenantChatSpaces },
}))
vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))
vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRouter: () => ({ push }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup(props, { slots }) {
        return () => h('a', { 'data-to': JSON.stringify(props.to) }, slots.default?.())
      },
    }),
  }
})

import TenantScriptsPage from '../TenantScriptsPage.vue'

const script = (over: Partial<TenantScript> = {}): TenantScript => ({
  tenantScriptId: '100', scriptName: 'Orders only in OMS', description: null, scriptProfile: 'SCRIPT', inputSource: 'RUN_RESULT',
  scriptBody: "'x'", sampleInputJson: null, isActive: true, createdByUserId: 'U1', createdDate: null, lastUpdatedDate: null, ...over,
})

const deployment = (over: Partial<TenantScriptDeployment> = {}): TenantScriptDeployment => ({
  tenantScriptDeploymentId: 'D1', tenantScriptId: '100', scheduleExpr: '0 0 7 * * ?', inputSavedRunId: 'RS_SALES',
  chatSpaceId: 'S1', isActive: true, nextRunDate: null, lastRunDate: '2026-11-18T07:00:00Z', lastRunStatus: 'SENT',
  lastRunMessage: null, lastRunUnits: null, ...over,
})

async function mountPage() {
  const wrapper = mount(TenantScriptsPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('TenantScriptsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    document.body.replaceChildren()
    listTenantScripts.mockResolvedValue({
      scripts: [
        script(),
        script({ tenantScriptId: '200', scriptName: 'Refund total', scriptProfile: 'EXPRESSION' }),
        script({ tenantScriptId: '300', scriptName: 'Tender mix', inputSource: 'SAMPLE' }),
        script({ tenantScriptId: '400', scriptName: 'Late payments' }),
      ],
      library: [{ name: 'dec(x)', help: 'x as a decimal number' }],
      limits: {},
    })
    listTenantScriptDeployments.mockResolvedValue({
      timeZone: 'UTC',
      deployments: [
        deployment(),
        deployment({ tenantScriptDeploymentId: 'D2', tenantScriptId: '200', isActive: false, lastRunDate: null, lastRunStatus: null }),
        deployment({ tenantScriptDeploymentId: 'D4', tenantScriptId: '400', lastRunStatus: 'NOT_DELIVERED' }),
      ],
    })
    listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [{ fileName: 'r1.json', savedRunId: 'RS_SALES', savedRunName: 'Sales Orders' }] })
    listTenantChatSpaces.mockResolvedValue({ chatSpaces: [{ chatSpaceId: 'S1', spaceName: '#ops-daily', chatProviderLabel: 'Slack', isActive: 'Y' }] })
  })

  it('reads every deployment in one call and shows one row per script', async () => {
    const wrapper = await mountPage()
    expect(listTenantScriptDeployments).toHaveBeenCalledWith()
    const rows = wrapper.findAll('[data-testid="script-row"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('Orders only in OMS')
    expect(rows[0]!.text()).toContain('Script · reads Sales Orders')
    expect(rows[1]!.text()).toContain('Expression · reads Sales Orders')
    expect(rows[2]!.text()).toContain('Script · reads Sample JSON')
    expect(wrapper.text()).not.toContain('d:dec')
  })

  it('says when each posts, where, and how its last scheduled run went', async () => {
    const wrapper = await mountPage()
    const schedules = wrapper.findAll('[data-testid="script-row-schedule"]')
    const lastRuns = wrapper.findAll('[data-testid="script-row-last-run"]')
    const dots = wrapper.findAll('.script-row__dot')

    expect(schedules[0]!.text()).toBe('Daily at 7:00 AM → #ops-daily')
    expect(dots[0]!.attributes('data-state')).toBe('on')
    expect(lastRuns[0]!.text()).toMatch(/^Last run .+ · sent$/)

    expect(schedules[1]!.text()).toBe('Off · posts to #ops-daily')
    expect(dots[1]!.attributes('data-state')).toBe('off')
    expect(lastRuns[1]!.text()).toBe('Never run on a schedule')

    expect(schedules[2]!.text()).toBe('Not scheduled')
    expect(dots[2]!.attributes('data-state')).toBe('none')

    expect(dots[3]!.attributes('data-state')).toBe('failed')
    expect(lastRuns[3]!.text()).toMatch(/^Last run .+ · failed$/)
  })

  it('opens a script on its own page', async () => {
    const wrapper = await mountPage()
    const open = wrapper.findAll('[data-testid="script-row-open"]')[0]!
    expect(open.text()).toBe('Open →')
    expect(open.attributes('aria-label')).toBe('Open script Orders only in OMS')
    await open.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-script', params: { tenantScriptId: '100' } })
  })

  it('offers New script under the list, to editors only', async () => {
    const wrapper = await mountPage()
    const create = wrapper.find('[data-testid="script-new"]')
    expect(create.text()).toBe('New script')
    expect(JSON.parse(create.attributes('data-to')!)).toEqual({ name: 'settings-tenant-script-new' })

    permissions.canEditTenantSettings = false
    const viewer = await mountPage()
    expect(viewer.find('[data-testid="script-new"]').exists()).toBe(false)
    expect(viewer.findAll('[data-testid="script-row"]')).toHaveLength(4)
  })

  it('still lists the scripts when names cannot be read', async () => {
    listGeneratedOutputs.mockRejectedValue(new Error('down'))
    listTenantChatSpaces.mockRejectedValue(new Error('down'))
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-testid="script-row-schedule"]')[0]!.text()).toBe('Daily at 7:00 AM → S1')
    expect(wrapper.findAll('[data-testid="script-row"]')[0]!.text()).toContain('reads RS_SALES')
  })
})
