import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const listSyncPairs = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({ pulseFacade: { listSyncPairs } }))
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
  })

  it('renders label, cadence and counts per row', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [
      pair({}),
      pair({ syncPairId: 'SP2', label: 'Returns', pulseEveryMinutes: null, waitingCount: 0, pastAllowanceCount: 0 }),
    ] })
    const wrapper = await mountPage()
    const rows = wrapper.findAll('[data-testid="sync-pair-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Approved orders')
    expect(rows[0]!.text()).toContain('Every 2h')
    expect(rows[0]!.text()).toContain('4 waiting · 1 past')
    expect(rows[1]!.text()).toContain('Off')
    expect(rows[1]!.text()).toContain('0 waiting · 0 past')
  })

  it('opens the record when a row is clicked', async () => {
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [pair({ syncPairId: '77' })] })
    const wrapper = await mountPage()
    const row = wrapper.get('[data-testid="sync-pair-row"]')
    expect(row.attributes('aria-label')).toBe('Open sync pair Approved orders')
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
