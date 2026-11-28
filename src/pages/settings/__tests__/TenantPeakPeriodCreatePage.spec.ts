import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { push, savePeakPeriod } = vi.hoisted(() => ({ push: vi.fn(), savePeakPeriod: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {}, params: {} }) }))
vi.mock('../../../lib/api/facade', () => ({ peakFacade: { savePeakPeriod } }))

import { setDefaultDisplayTimeZone } from '../../../lib/utils/date'
import TenantPeakPeriodCreatePage from '../TenantPeakPeriodCreatePage.vue'

function form(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowStepForm' }) }

async function toDates(w: ReturnType<typeof mount>, name = 'Black Friday') {
  await w.get('[data-testid="peak-create-name"]').setValue(name)
  await form(w).vm.$emit('submit')
}

async function pickDays(w: ReturnType<typeof mount>, from: string, thru: string) {
  await w.get(`[data-testid="peak-create-dates-day-${from}"]`).trigger('click')
  await w.get(`[data-testid="peak-create-dates-day-${thru}"]`).trigger('click')
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 9, 0))
  push.mockReset()
  savePeakPeriod.mockReset()
  savePeakPeriod.mockResolvedValue({ ok: true, messages: [], errors: [], peakPeriodId: 'PP9' })
})

afterEach(() => {
  vi.useRealTimers()
})

// DAR-UI-161 (Aditi 2026-11-27: "creating a new peak period should be a workflow like anything else").
describe('TenantPeakPeriodCreatePage', () => {
  it('asks the name, then the days, makes the period switched on, and opens its page', async () => {
    const w = mount(TenantPeakPeriodCreatePage)
    expect(w.text()).toContain('What is the busy period called?')
    expect(form(w).props('submitDisabled')).toBe(true)
    await toDates(w, '  Black Friday ')
    expect(w.text()).toContain('Which days?')
    expect(form(w).props('submitDisabled')).toBe(true)
    await pickDays(w, '2026-11-27', '2026-11-30')
    expect(form(w).props('submitDisabled')).toBe(false)
    await form(w).vm.$emit('submit')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith({ periodName: 'Black Friday', fromDate: '2026-11-27', thruDate: '2026-11-30', isActive: true })
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-period', params: { peakPeriodId: 'PP9' } })
  })

  it('takes a one-day period', async () => {
    const w = mount(TenantPeakPeriodCreatePage)
    await toDates(w, 'Black Friday')
    await pickDays(w, '2026-11-27', '2026-11-27')
    await form(w).vm.$emit('submit')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith({ periodName: 'Black Friday', fromDate: '2026-11-27', thruDate: '2026-11-27', isActive: true })
  })

  it('says a refusal on the days step and stays there', async () => {
    savePeakPeriod.mockResolvedValue({ ok: false, messages: [], errors: ['These days overlap Cyber Monday.'], peakPeriodId: '' })
    const w = mount(TenantPeakPeriodCreatePage)
    await toDates(w)
    await pickDays(w, '2026-11-27', '2026-11-30')
    await form(w).vm.$emit('submit')
    await flushPromises()
    expect(w.text()).toContain('Which days?')
    expect(w.get('[data-testid="peak-create-error"]').text()).toBe('These days overlap Cyber Monday.')
    expect(push).not.toHaveBeenCalled()
  })

  // DAR-OPS-029 U10a: the calendar opens on the tenant's month. At 20:00 UTC on Nov 30 it is already December in
  // Kolkata and still November in Los Angeles, whatever zone the browser runs in.
  it.each([
    ['Asia/Kolkata', ['December 2026', 'January 2027']],
    ['America/Los_Angeles', ['November 2026', 'December 2026']],
  ])('opens the days on the tenant’s month (%s)', async (zone, months) => {
    vi.setSystemTime(new Date('2026-11-30T20:00:00Z'))
    setDefaultDisplayTimeZone(zone)
    try {
      const w = mount(TenantPeakPeriodCreatePage)
      await toDates(w)
      expect(w.findAll('.wizard-api-calendar-month h3').map((month) => month.text())).toEqual(months)
    } finally {
      setDefaultDisplayTimeZone(undefined)
    }
  })

  it('goes back to the list from the name and on cancel, and back to the name from the days with it kept', async () => {
    const w = mount(TenantPeakPeriodCreatePage)
    await form(w).vm.$emit('back')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-periods' })
    await toDates(w)
    await form(w).vm.$emit('back')
    expect((w.get('[data-testid="peak-create-name"]').element as HTMLInputElement).value).toBe('Black Friday')
    await form(w).vm.$emit('submit')
    push.mockReset()
    await form(w).vm.$emit('cancel')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-periods' })
  })
})
