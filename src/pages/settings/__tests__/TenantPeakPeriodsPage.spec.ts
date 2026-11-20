import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const listPeakPeriods = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({ peakFacade: { listPeakPeriods } }))
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

import TenantPeakPeriodsPage from '../TenantPeakPeriodsPage.vue'

function iso(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const period = (over: Record<string, unknown>) => ({
  peakPeriodId: '1', periodName: 'Black Friday sale', fromDate: iso(5), thruDate: iso(12), isActive: 'Y', state: 'upcoming', ...over,
})

async function mountPage() {
  const wrapper = mount(TenantPeakPeriodsPage, { global: { directives: { explain: {} } } })
  await flushPromises()
  return wrapper
}

describe('TenantPeakPeriodsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
  })

  it('renders name, dates and when for each row, and the ended one under Ended', async () => {
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [
      period({ peakPeriodId: '1' }),
      period({ peakPeriodId: '2', periodName: 'Cyber week', fromDate: iso(-2), thruDate: iso(3), state: 'on' }),
      period({ peakPeriodId: '3', periodName: 'Paused sale', fromDate: iso(40), thruDate: iso(44), state: 'off' }),
      period({ peakPeriodId: '4', periodName: 'Spring event', fromDate: iso(60), thruDate: iso(62) }),
      period({ peakPeriodId: '5', periodName: 'Tomorrow sale', fromDate: iso(1), thruDate: iso(2) }),
      period({ peakPeriodId: '6', periodName: 'Old sale', fromDate: iso(-30), thruDate: iso(-25), state: 'ended' }),
    ] })
    const wrapper = await mountPage()
    const rows = wrapper.findAll('[data-testid="peak-row"]')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.text()).toContain('Black Friday sale')
    expect(rows[0]!.text()).toContain('–')
    expect(rows[0]!.text()).toContain('Starts in 5 days')
    expect(rows[1]!.text()).toContain('On now')
    expect(rows[2]!.text()).toContain('Off')
    expect(rows[3]!.text()).toMatch(/Starts [A-Z][a-z]{2} \d+/)
    expect(rows[3]!.text()).not.toContain('Starts in')
    expect(rows[4]!.text()).toContain('Starts tomorrow')
    expect(wrapper.get('h2').text()).toBe('Ended')
    const ended = wrapper.findAll('[data-testid="peak-row-ended"]')
    expect(ended).toHaveLength(1)
    expect(ended[0]!.text()).toContain('Old sale')
    expect(ended[0]!.text()).toContain('Ended')
  })

  it('opens the record when a row is clicked', async () => {
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [period({ peakPeriodId: '77' })] })
    const wrapper = await mountPage()
    const row = wrapper.get('[data-testid="peak-row"]')
    expect(row.attributes('aria-label')).toBe('Open peak period Black Friday sale')
    await row.trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-period', params: { peakPeriodId: '77' } })
  })

  it('shows add to editors only, pointing at the new route', async () => {
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [] })
    let wrapper = await mountPage()
    expect(wrapper.get('[data-testid="peak-add"]').attributes('aria-label')).toBe('Add peak period')
    expect(wrapper.get('[data-testid="peak-add"]').attributes('data-to')).toContain('settings-tenant-peak-period-new')
    permissions.canEditTenantSettings = false
    wrapper = await mountPage()
    expect(wrapper.find('[data-testid="peak-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="peak-back"]').exists()).toBe(true)
  })

  it('shows the empty state for no periods', async () => {
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No peak periods.')
    expect(wrapper.find('[data-testid="peak-row"]').exists()).toBe(false)
  })

  it('shows the backend error when the list is refused', async () => {
    listPeakPeriods.mockResolvedValue({ ok: false, errors: ['Not allowed.'], messages: [], peakPeriods: [] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Not allowed.')
  })
})
