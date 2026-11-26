import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const listSyncPairs = vi.hoisted(() => vi.fn())
const getSyncPair = vi.hoisted(() => vi.fn())
const listPeakPeriods = vi.hoisted(() => vi.fn())
const getPeakPeriod = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: false }))

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

import PulsesPage from '../PulsesPage.vue'

const envelope = { ok: true, errors: [], messages: [] }
const summary = (over: Record<string, unknown>) => ({
  syncPairId: 'SP', label: 'HotWax → NetSuite orders', automationId: 'A', automationName: 'Check', allowanceMinutes: 120,
  pulseEveryMinutes: null, isActive: 'Y', lastPulseStamp: null, waitingCount: 0, pastAllowanceCount: 0, ...over,
})

// GORJANA on prod 2026-11-26 19:02 IST: both pulses are off normally and in sale periods, hourly on PEAK days only
// (100102 Shopify → HotWax 2h, 100000 HotWax → NetSuite 6h); 100001 carries an allowance only. Today is a sale day.
function gorjana(): void {
  listSyncPairs.mockResolvedValue({ ...envelope, syncPairs: [
    summary({ syncPairId: '100000', automationId: '100518', automationName: 'Daily Order Reconciliation - NetSuite', waitingCount: 4, pastAllowanceCount: 12 }),
    summary({ syncPairId: '100001', automationId: '100520', automationName: 'Daily Return Reconciliation - NetSuite' }),
    summary({ syncPairId: '100102', label: 'Shopify → HotWax orders', automationId: '100102', automationName: 'Daily Order Reconciliation' }),
  ] })
  getSyncPair.mockImplementation(({ syncPairId }: { syncPairId?: string }) => {
    if (!syncPairId) {
      return Promise.resolve({ ...envelope, chatSpaces: [], samplesToday: [], pastOrders: [], automations: [
        { automationId: '100102', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'Shopify' }, { upstreamSide: 'FILE_2', label: 'HotWax orders' }] },
        { automationId: '100518', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'HotWax orders' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
        { automationId: '100520', label: 'x', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'HotWax returns' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
      ] })
    }
    if (syncPairId === '100000') {
      return Promise.resolve({ ...envelope, automations: [], chatSpaces: [],
        syncPair: { ...summary({ syncPairId, allowanceMinutes: 360, pulseEveryMinutes: null, waitingCount: 4, pastAllowanceCount: 12,
          lastPulseStamp: '2026-11-26T11:03:13Z' }), normalAllowanceMinutes: 120, normalPulseEveryMinutes: null,
        periodName: 'Sale Nov 24-26', lastPulseStatusEnumId: 'SPS_OK' },
        samplesToday: [{ sampleStamp: '2026-11-26T11:03:13Z', waitingCount: 4, oldestWaitingMinutes: 1301, pastAllowanceCount: 12, statusEnumId: 'SPS_OK' }],
        pastOrders: [{ recordKey: 'K', orderName: '#GOR1', otherSystemId: null, sourceCreatedStamp: null, waitingMinutes: 1301,
          reportedInRunId: null, reportedInSavedRunId: null }] })
    }
    return Promise.resolve({ ...envelope, automations: [], chatSpaces: [], samplesToday: [], pastOrders: [],
      syncPair: { ...summary({ syncPairId, allowanceMinutes: 120, pulseEveryMinutes: null, lastPulseStamp: '2026-11-26T12:47:32Z' }),
        normalAllowanceMinutes: 120, normalPulseEveryMinutes: null, periodName: null, lastPulseStatusEnumId: 'SPS_SKIPPED' } })
  })
  listPeakPeriods.mockResolvedValue({ ...envelope, peakPeriods: [
    { peakPeriodId: 'P1', periodName: 'Sale Nov 24-26', fromDate: '2026-11-24', thruDate: '2026-11-26', isActive: 'Y', state: 'on' },
    { peakPeriodId: 'P2', periodName: 'PEAK Nov 27', fromDate: '2026-11-27', thruDate: '2026-11-27', isActive: 'Y', state: 'upcoming' },
  ] })
  getPeakPeriod.mockImplementation(({ peakPeriodId }: { peakPeriodId: string }) => Promise.resolve({ ...envelope, syncRows: peakPeriodId === 'P1'
    ? [{ syncPairId: '100000', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 360, normalPulseMinutes: null, periodPulseMinutes: 0 },
      { syncPairId: '100102', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: null, normalPulseMinutes: null, periodPulseMinutes: null }]
    : [{ syncPairId: '100000', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 360, normalPulseMinutes: null, periodPulseMinutes: 60 },
      { syncPairId: '100102', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 120, normalPulseMinutes: null, periodPulseMinutes: 60 }] }))
}

async function mountPage() {
  const wrapper = mount(PulsesPage, { global: { directives: { explain: {} } } })
  await flushPromises()
  return wrapper
}

describe('PulsesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = false
  })

  it('shows one card per real pulse with its label, check and today\'s facts; allowance-only pairs are not there', async () => {
    gorjana()
    const wrapper = await mountPage()
    const cards = wrapper.findAll('[data-testid="pulse-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]!.get('[data-testid="pulse-card-open"]').text()).toBe('HotWax → NetSuite')
    expect(cards[0]!.text()).toContain('Daily Order Reconciliation - NetSuite')
    expect(cards[0]!.get('[data-testid="pulse-fact-allowance"]').text()).toContain('6 hours')
    expect(wrapper.findAll('[data-testid="pulse-card"]').map((c) => c.text()).join(' ')).not.toMatch(/Sale|PEAK/)
    expect(cards[0]!.get('[data-testid="pulse-fact-oldest"]').text()).toContain('21h 41m')
    expect(cards[0]!.get('[data-testid="pulse-fact-past"]').text()).toContain('12')
    expect(cards[0]!.get('[data-testid="pulse-fact-every"]').text()).toContain('Off today')
    expect(cards[0]!.get('[data-testid="pulse-fact-every"]').text()).toContain('next: 27 Nov')
    expect(cards[1]!.get('[data-testid="pulse-card-open"]').text()).toBe('Shopify → HotWax')
    expect(cards[1]!.get('[data-testid="pulse-fact-every"]').text()).toContain('Off today')
    expect(cards[1]!.get('[data-testid="pulse-fact-every"]').text()).toContain('next: 27 Nov')
    expect(cards[1]!.get('[data-testid="pulse-fact-allowance"]').text()).toContain('2 hours')
    expect(wrapper.text()).not.toContain('returns')
    expect(wrapper.text()).not.toMatch(/SuiteQL|GraphQL/)
    expect(getSyncPair).not.toHaveBeenCalledWith({ syncPairId: '100001' }, expect.anything())
  })

  it('names no period at the top on a sale day whose periods turn no pulse on', async () => {
    gorjana()
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-testid="pulses-period"]')).toHaveLength(0)
  })

  it('names a period that is on and turns a pulse on, with its dates, linked to its page', async () => {
    gorjana()
    listPeakPeriods.mockResolvedValue({ ...envelope, peakPeriods: [
      { peakPeriodId: 'P2', periodName: 'PEAK Nov 27', fromDate: '2026-11-27', thruDate: '2026-11-27', isActive: 'Y', state: 'on' },
    ] })
    const wrapper = await mountPage()
    const periods = wrapper.findAll('[data-testid="pulses-period"]')
    expect(periods).toHaveLength(1)
    expect(periods[0]!.text()).toContain('PEAK Nov 27')
    expect(periods[0]!.text()).toContain('27 Nov')
    expect(periods[0]!.get('a').attributes('data-to')).toContain('"peakPeriodId":"P2"')
  })

  it('says when the figures were read, and marks them last known with the pulse off today', async () => {
    gorjana()
    const wrapper = await mountPage()
    const asOf = wrapper.findAll('[data-testid="pulse-card-as-of"]').map((p) => p.text())
    expect(asOf[0]).toMatch(/^Last known · as of \d\d:\d\d$/)
    expect(asOf[1]).toBe('Last known figures')
  })

  it('opens the pair page from a card, for a view-role user too, and shows the settings link to editors only', async () => {
    gorjana()
    let wrapper = await mountPage()
    expect(wrapper.find('[data-testid="pulses-settings"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="pulse-card-open"]')[1]!.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'pulse', params: { syncPairId: '100102' } })
    permissions.canEditTenantSettings = true
    wrapper = await mountPage()
    expect(wrapper.get('[data-testid="pulses-settings"]').attributes('data-to')).toContain('settings-tenant-sync-pairs')
  })

  it('says so when nothing pulses, and shows the error when the pairs fail to load', async () => {
    listSyncPairs.mockResolvedValue({ ...envelope, syncPairs: [summary({})] })
    getSyncPair.mockResolvedValue({ ...envelope, automations: [], chatSpaces: [], samplesToday: [], pastOrders: [] })
    listPeakPeriods.mockResolvedValue({ ...envelope, peakPeriods: [] })
    let wrapper = await mountPage()
    expect(wrapper.text()).toContain('No pair pulses.')
    listSyncPairs.mockResolvedValue({ ok: false, errors: ['Not allowed.'], messages: [] })
    wrapper = await mountPage()
    expect(wrapper.text()).toContain('Not allowed.')
  })

  it('keeps the other cards when one pulse fails to load', async () => {
    gorjana()
    const base = getSyncPair.getMockImplementation()!
    getSyncPair.mockImplementation((args: { syncPairId?: string }) => (args.syncPairId === '100102'
      ? Promise.reject(new Error('down')) : base(args)))
    const wrapper = await mountPage()
    const cards = wrapper.findAll('[data-testid="pulse-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[1]!.text()).toContain('Could not load this pulse.')
    expect(cards[0]!.find('[data-testid="pulse-fact-every"]').exists()).toBe(true)
  })
})
