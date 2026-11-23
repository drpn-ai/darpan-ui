import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { TenantQuery, TenantQuerySchedule } from '../../../lib/api/scriptTypes'

const listTenantQueries = vi.hoisted(() => vi.fn())
const listTenantQuerySchedules = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: { listTenantQueries, listTenantQuerySchedules },
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

const query = (over: Partial<TenantQuery> = {}): TenantQuery => ({
  tenantQueryId: '100', queryName: 'Open backorders', description: null, readSpecJson: '{"inputs":[]}',
  readText: 'Reads dataset DS_ORDERS, last 30 days, status = B, 2 fields', scriptBody: "'x'", sampleInputJson: null,
  isActive: true, ownerUserId: 'U1', ...over,
})

const schedule = (over: Partial<TenantQuerySchedule> = {}): TenantQuerySchedule => ({
  scheduleId: 'S100', tenantQueryId: '100', cronExpression: '0 0 7 * * ?', timeZone: 'UTC', isActive: 'Y',
  ownerUserId: 'U1', ownerName: 'Aditi', emailTo: 'ops@krewe.example, cfo@krewe.example', emailCc: null, chatSpaceId: 'C1',
  recipientCount: 2, nextRunDate: null, lastRunDate: '2026-11-18T07:00:00Z', lastRunStatus: 'OK', lastRunMessage: null,
  deliveries: [], ...over,
})

async function mountPage() {
  const wrapper = mount(TenantScriptsPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('TenantScriptsPage (queries)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    document.body.replaceChildren()
    listTenantQueries.mockResolvedValue({
      queries: [
        query(),
        query({ tenantQueryId: '200', queryName: 'Refund total', readSpecJson: null, readText: null }),
        query({ tenantQueryId: '300', queryName: 'Late payments' }),
        query({ tenantQueryId: '400', queryName: 'Owner left' }),
      ],
      library: [],
      limits: {},
    })
    listTenantQuerySchedules.mockResolvedValue({
      timeZone: 'UTC',
      schedules: [
        schedule(),
        schedule({ scheduleId: 'S200', tenantQueryId: '200', isActive: 'N', lastRunDate: null, lastRunStatus: null, emailTo: null,
          recipientCount: 0 }),
        schedule({ scheduleId: 'S400', tenantQueryId: '400', isActive: 'N', lastRunStatus: 'OWNER_LOST' }),
      ],
    })
    listTenantChatSpaces.mockResolvedValue({ chatSpaces: [{ chatSpaceId: 'C1', spaceName: '#ops-daily', chatProviderLabel: 'Slack', isActive: 'Y' }] })
  })

  it('lists each query with its read in words', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('h1').text()).toBe('Queries')
    expect(listTenantQuerySchedules).toHaveBeenCalledWith()
    const rows = wrapper.findAll('[data-testid="script-row"]')
    expect(rows).toHaveLength(4)
    expect(rows[0]!.text()).toContain('Open backorders')
    expect(rows[0]!.find('[data-testid="script-row-reads"]').text()).toBe('Reads dataset DS_ORDERS, last 30 days, status = B, 2 fields')
    expect(rows[1]!.find('[data-testid="script-row-reads"]').text()).toBe('Reads nothing: script only')
  })

  it('says when each sends, to how many, and how its last scheduled run went', async () => {
    const wrapper = await mountPage()
    const schedules = wrapper.findAll('[data-testid="script-row-schedule"]')
    const lastRuns = wrapper.findAll('[data-testid="script-row-last-run"]')
    const dots = wrapper.findAll('.script-row__dot')

    expect(schedules[0]!.text()).toBe('Daily at 7:00 AM → 2 addresses · #ops-daily')
    expect(dots[0]!.attributes('data-state')).toBe('on')
    expect(lastRuns[0]!.text()).toMatch(/^Last run .+ · sent$/)

    expect(schedules[1]!.text()).toBe('Off · sends to #ops-daily')
    expect(dots[1]!.attributes('data-state')).toBe('off')
    expect(lastRuns[1]!.text()).toBe('Never run on a schedule')

    expect(schedules[2]!.text()).toBe('Not scheduled')
    expect(dots[2]!.attributes('data-state')).toBe('none')

    expect(dots[3]!.attributes('data-state')).toBe('failed')
    expect(lastRuns[3]!.text()).toMatch(/^Last run .+ · owner can no longer send it$/)
  })

  it('opens a query on its own page', async () => {
    const wrapper = await mountPage()
    const open = wrapper.findAll('[data-testid="script-row-open"]')[0]!
    expect(open.attributes('aria-label')).toBe('Open query Open backorders')
    await open.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-script', params: { tenantScriptId: '100' } })
  })

  it('offers New query under the list, to editors only', async () => {
    const wrapper = await mountPage()
    const create = wrapper.find('[data-testid="script-new"]')
    expect(create.text()).toBe('New query')
    expect(JSON.parse(create.attributes('data-to')!)).toEqual({ name: 'settings-tenant-script-new' })

    permissions.canEditTenantSettings = false
    const viewer = await mountPage()
    expect(viewer.find('[data-testid="script-new"]').exists()).toBe(false)
    expect(viewer.findAll('[data-testid="script-row"]')).toHaveLength(4)
  })

  it('still lists the queries when space names cannot be read', async () => {
    listTenantChatSpaces.mockRejectedValue(new Error('down'))
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-testid="script-row-schedule"]')[0]!.text()).toBe('Daily at 7:00 AM → 2 addresses · C1')
  })
})
