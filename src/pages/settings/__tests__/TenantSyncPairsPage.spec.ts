import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const listSyncPairs = vi.hoisted(() => vi.fn())
const getSyncPair = vi.hoisted(() => vi.fn())
const listPeakPeriods = vi.hoisted(() => vi.fn())
const getPeakPeriod = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({ pulseFacade: { listSyncPairs, getSyncPair }, peakFacade: { listPeakPeriods, getPeakPeriod } }))
vi.mock('../../../stores/permissions', () => ({ usePermissionsStore: () => permissions }))
vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    useRouter: () => ({ push }),
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup(props, { slots, attrs }) {
        return () => h('a', { ...attrs, 'data-to': JSON.stringify(props.to) }, slots.default?.())
      },
    }),
  }
})

import TenantSyncPairsPage from '../TenantSyncPairsPage.vue'

const pair = (over: Record<string, unknown>) => ({
  syncPairId: 'SP1', label: 'Approved orders', automationId: 'A1', automationName: 'Daily', allowanceMinutes: 120,
  pulseEveryMinutes: 120, isActive: 'Y', lastPulseStamp: null, waitingCount: 4, pastAllowanceCount: 1, ...over,
})

async function mountPage() {
  const wrapper = mount(TenantSyncPairsPage, { global: { directives: { explain: {} } } })
  await flushPromises()
  return wrapper
}

describe('TenantSyncPairsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    getSyncPair.mockResolvedValue({ ok: true, errors: [], messages: [], automations: [], chatSpaces: [], samplesToday: [], pastOrders: [] })
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [] })
  })

  // DAR-UI-153, GORJANA on prod 2026-11-26: 16 pairs, 2 pulse.
  it('lists only pulsing pairs, labelled by the check\'s sides; the allowance-only ones closed in their own group', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [
      pair({ syncPairId: '100000', label: 'HotWax → NetSuite orders', automationId: '100518', automationName: 'Daily Order Reconciliation - NetSuite', pulseEveryMinutes: null }),
      pair({ syncPairId: '100001', label: 'HotWax → NetSuite orders', automationId: '100520', automationName: 'Daily Return Reconciliation - NetSuite', pulseEveryMinutes: null }),
      pair({ syncPairId: '100053', label: 'NetSuite → Target orders', automationId: '100107', automationName: 'Month close: Credit memos', pulseEveryMinutes: null }),
      pair({ syncPairId: '100102', label: 'Shopify → HotWax orders', automationId: '100102', automationName: 'Daily Order Reconciliation', pulseEveryMinutes: 60 }),
    ] })
    getSyncPair.mockResolvedValue({ ok: true, errors: [], messages: [], chatSpaces: [], samplesToday: [], pastOrders: [], automations: [
      { automationId: '100102', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'Shopify' }, { upstreamSide: 'FILE_2', label: 'HotWax orders' }] },
      { automationId: '100518', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'HotWax orders' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
      { automationId: '100520', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'HotWax returns' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
      { automationId: '100107', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'NetSuite SuiteQL' }] },
    ] })
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [
      { peakPeriodId: 'P1', periodName: 'Sale', fromDate: '2026-11-24', thruDate: '2026-11-26', isActive: 'Y', state: 'on' },
      { peakPeriodId: 'P0', periodName: 'Old', fromDate: '2026-11-01', thruDate: '2026-11-02', isActive: 'Y', state: 'ended' },
    ] })
    getPeakPeriod.mockResolvedValue({ ok: true, errors: [], messages: [], syncRows: [
      { syncPairId: '100000', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 240, normalPulseMinutes: null, periodPulseMinutes: 60 },
      { syncPairId: '100053', label: '', normalAllowanceMinutes: 15, periodAllowanceMinutes: 1440, normalPulseMinutes: null, periodPulseMinutes: null },
    ] })
    const wrapper = await mountPage()

    expect(getPeakPeriod).toHaveBeenCalledTimes(1)
    expect(getPeakPeriod).toHaveBeenCalledWith({ peakPeriodId: 'P1' }, expect.anything())
    const rows = wrapper.findAll('[data-testid="sync-pair-row"]')
    expect(rows.map((r) => r.attributes('aria-label'))).toEqual([
      'Open sync pair HotWax orders → NetSuite SuiteQL', 'Open sync pair Shopify → HotWax orders'])
    expect(rows[0]!.text()).toContain('Daily Order Reconciliation - NetSuite')
    expect(rows[0]!.text()).toContain('Every 1h in peak periods')
    const toggle = wrapper.get('[data-testid="sync-allowance-toggle"]')
    expect(toggle.text()).toContain('Start allowance only')
    expect(toggle.text()).toContain('2')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[data-testid="sync-allowance-rows"]').exists()).toBe(false)
    await toggle.trigger('click')
    const hidden = wrapper.findAll('[data-testid="sync-allowance-row"]')
    expect(hidden.map((r) => r.attributes('aria-label'))).toEqual([
      'Open sync pair HotWax returns → NetSuite SuiteQL', 'Open sync pair NetSuite SuiteQL only'])
  })

  it('keeps the backend label and the pair\'s own cadence when the checks and periods fail to load', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [pair({}), pair({ syncPairId: 'SP2', label: 'Returns', pulseEveryMinutes: null })] })
    getSyncPair.mockRejectedValue(new Error('down'))
    listPeakPeriods.mockRejectedValue(new Error('down'))
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-testid="sync-pair-row"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="sync-pair-row"]').text()).toContain('Daily')
    expect(wrapper.get('[data-testid="sync-allowance-toggle"]').text()).toContain('1')
  })

  it('renders label, check, cadence and counts per pulsing row', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [pair({})] })
    const wrapper = await mountPage()
    const rows = wrapper.findAll('[data-testid="sync-pair-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Daily')
    expect(rows[0]!.text()).toContain('Every 2h')
    expect(rows[0]!.text()).toContain('4 waiting · 1 past')
    expect(wrapper.find('[data-testid="sync-allowance-group"]').exists()).toBe(false)
  })

  it('opens the record when a row is clicked', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [pair({ syncPairId: '77' })] })
    const wrapper = await mountPage()
    const row = wrapper.get('[data-testid="sync-pair-row"]')
    expect(row.attributes('aria-label')).toBe('Open sync pair Daily')
    await row.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-sync-pair', params: { syncPairId: '77' } })
  })

  it('shows add to editors only, pointing at the new route', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [] })
    let wrapper = await mountPage()
    expect(wrapper.get('[data-testid="sync-pair-add"]').attributes('aria-label')).toBe('Add sync pair')
    expect(wrapper.get('[data-testid="sync-pair-add"]').attributes('data-to')).toContain('settings-tenant-sync-pair-new')
    permissions.canEditTenantSettings = false
    wrapper = await mountPage()
    expect(wrapper.find('[data-testid="sync-pair-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sync-pair-back"]').exists()).toBe(true)
  })

  it('shows the empty state for no pairs', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No sync pairs.')
  })

  it('shows the backend error when the list is refused', async () => {
    listSyncPairs.mockResolvedValue({ ok: false, errors: ['Not allowed.'], messages: [], syncPairs: [] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Not allowed.')
  })
})
