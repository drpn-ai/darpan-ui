import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { GetPeakPeriodResponse, PeakPeriod } from '../../../lib/api/peakTypes'
import WorkflowDateRangeCalendar from '../../../components/workflow/WorkflowDateRangeCalendar.vue'
import WorkflowTimeSelect from '../../../components/workflow/WorkflowTimeSelect.vue'

const getPeakPeriod = vi.hoisted(() => vi.fn())
const savePeakPeriod = vi.hoisted(() => vi.fn())
const deletePeakPeriod = vi.hoisted(() => vi.fn())
const savePeakRunTime = vi.hoisted(() => vi.fn())
const deletePeakRunTime = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({ params: { peakPeriodId: 'PP1' } as Record<string, string> }))
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  peakFacade: { getPeakPeriod, savePeakPeriod, deletePeakPeriod, savePeakRunTime, deletePeakRunTime },
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

import TenantPeakPeriodPage from '../TenantPeakPeriodPage.vue'

const period = (over: Partial<PeakPeriod> = {}): PeakPeriod => ({
  peakPeriodId: 'PP1', periodName: 'Black Friday sale', fromDate: '2026-11-24', thruDate: '2026-12-01', isActive: 'Y',
  state: 'upcoming', peakHoursStart: '08:00', peakHoursEnd: '23:00', hotwaxReadSharePct: null, netsuiteSerial: 'N',
  timeZone: 'America/Los_Angeles', createdByUserId: 'U1', lastUpdatedDate: null, ...over,
})

const got = (over: Partial<GetPeakPeriodResponse> = {}): GetPeakPeriodResponse => ({
  ok: true, messages: [], errors: [],
  peakPeriod: period(),
  runTimes: [
    { runTimeId: 'RT1', automationId: '100518', auditId: null, targetLabel: 'Daily Order Reconciliation - NetSuite',
      onDate: '2026-11-28', runTime: '06:00', normalTime: '02:15' },
    { runTimeId: 'RT2', automationId: null, auditId: 'AU1', targetLabel: 'Month close audit',
      onDate: null, runTime: '06:30', normalTime: '01:30' },
  ],
  heldRuns: [{ targetLabel: 'Weekly returns audit', normalTime: '10:00', startsAt: '23:00', reason: '10:00 is in peak hours' }],
  targets: [
    { automationId: '100518', label: 'Daily Order Reconciliation - NetSuite' },
    { auditId: 'AU1', label: 'Month close audit' },
    { automationId: '100520', label: 'Daily Returns - NetSuite' },
  ],
  ...over,
})

async function mountPage() {
  const wrapper = mount(TenantPeakPeriodPage, { attachTo: document.body })
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

function optionValues(wrapper: VueWrapper): string[] {
  return wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.attributes('data-option-value') ?? '')
}

describe('TenantPeakPeriodPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 9, 0))
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    route.params = { peakPeriodId: 'PP1' }
    document.body.replaceChildren()
    getPeakPeriod.mockResolvedValue(got())
    savePeakPeriod.mockResolvedValue({ ok: true, messages: [], errors: [], peakPeriodId: 'PP1' })
    deletePeakPeriod.mockResolvedValue({ ok: true, messages: [], errors: [] })
    savePeakRunTime.mockResolvedValue({ ok: true, messages: [], errors: [], runTimeId: 'RT9' })
    deletePeakRunTime.mockResolvedValue({ ok: true, messages: [], errors: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the name, the two facts, the run times and the runs that wait', async () => {
    const wrapper = await mountPage()
    expect(getPeakPeriod).toHaveBeenCalledWith({ peakPeriodId: 'PP1' })
    expect(text(wrapper, 'peak-name')).toBe('Black Friday sale')
    expect(wrapper.find('[data-testid="peak-on"]').attributes('aria-checked')).toBe('true')

    const facts = wrapper.findAll('[data-testid="peak-facts"] .static-fact')
    expect(facts).toHaveLength(4)
    expect(text(wrapper, 'peak-fact-dates')).toContain('Nov 24 – Dec 1')
    expect(text(wrapper, 'peak-fact-dates')).toContain('America/Los_Angeles')
    expect(text(wrapper, 'peak-fact-hours')).toContain('08:00 – 23:00')
    expect(text(wrapper, 'peak-fact-hours')).toContain('heavy runs wait')
    expect(text(wrapper, 'peak-fact-hotwax')).toContain('HotWax reads')
    expect(text(wrapper, 'peak-fact-hotwax')).toContain('Normal')
    expect(text(wrapper, 'peak-fact-hotwax')).toContain('of its read budget')
    expect(text(wrapper, 'peak-fact-netsuite')).toContain('NetSuite reads')
    expect(text(wrapper, 'peak-fact-netsuite')).toContain('Parallel')
    expect(text(wrapper, 'peak-fact-netsuite')).toContain('this period')

    const rows = wrapper.findAll('[data-testid="peak-run-time"]')
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringMatching(/Daily Order Reconciliation - NetSuite\s*02:15\s*06:00 on Nov 28/),
      expect.stringMatching(/Month close audit\s*01:30\s*06:30 every day/),
    ])

    const held = wrapper.findAll('[data-testid="peak-held-run"]')
    expect(held).toHaveLength(1)
    expect(held[0]!.text()).toContain('Weekly returns audit')
    expect(held[0]!.text()).toContain('23:00')
    expect(held[0]!.text()).toContain('10:00 is in peak hours')
    expect(wrapper.find('[data-testid="peak-edited"]').exists()).toBe(false)
  })

  it('reads None for peak hours that are not set', async () => {
    getPeakPeriod.mockResolvedValue(got({ peakPeriod: period({ peakHoursStart: null, peakHoursEnd: null }) }))
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="peak-fact-hours"] .static-fact__value').text()).toBe('None')
  })

  it('sets peak hours in a popup with two time selects; Save sends them as HH:mm', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-hours"]').trigger('click')
    const selects = wrapper.findAllComponents(WorkflowTimeSelect)
    expect(selects).toHaveLength(2)
    expect(selects.map((select) => select.props('modelValue'))).toEqual(['08:00', '23:00'])

    selects[0]!.vm.$emit('update:modelValue', '07:30')
    selects[1]!.vm.$emit('update:modelValue', '22:00')
    await wrapper.find('[data-testid="peak-hours-save"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(text(wrapper, 'peak-fact-hours')).toContain('07:30 – 22:00')
    expect(wrapper.find('[data-testid="peak-edited"]').exists()).toBe(true)
    expect(savePeakPeriod).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith({
      peakPeriodId: 'PP1', periodName: 'Black Friday sale', fromDate: '2026-11-24', thruDate: '2026-12-01',
      peakHoursStart: '07:30', peakHoursEnd: '22:00', hotwaxReadSharePct: null, netsuiteSerial: false, isActive: true,
    })
    // The runs that wait depend on the hours, so the page reads the period again.
    expect(getPeakPeriod).toHaveBeenCalledTimes(2)
  })

  it('clears peak hours from the popup; Save sends them blank', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-hours"]').trigger('click')
    await wrapper.find('[data-testid="peak-hours-clear"]').trigger('click')
    expect(wrapper.findAllComponents(WorkflowTimeSelect).map((select) => select.props('modelValue'))).toEqual(['', ''])
    await wrapper.find('[data-testid="peak-hours-save"]').trigger('click')
    expect(wrapper.find('[data-testid="peak-fact-hours"] .static-fact__value').text()).toBe('None')

    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ peakHoursStart: '', peakHoursEnd: '' }))
  })

  it('will not keep half of a peak-hours window', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-hours"]').trigger('click')
    wrapper.findAllComponents(WorkflowTimeSelect)[1]!.vm.$emit('update:modelValue', '')
    await flushPromises()
    expect(wrapper.find('[data-testid="peak-hours-save"]').attributes('disabled')).toBeDefined()
  })

  it('shows the server’s overlap sentence word for word under the title', async () => {
    const sentence = 'Black Friday sale overlaps Cyber week (Nov 30 – Dec 2). Active peak periods may not overlap.'
    savePeakPeriod.mockRejectedValueOnce(new ApiCallError(sentence))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'peak-page-error')).toBe(sentence)

    savePeakPeriod.mockResolvedValueOnce({ ok: false, messages: [], errors: ['Name is required.'], peakPeriodId: null })
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'peak-page-error')).toBe('Name is required.')
  })

  it('picks the dates on the calendar in a popup', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-dates"]').trigger('click')
    expect(wrapper.findComponent(WorkflowDateRangeCalendar).exists()).toBe(true)
    // Opens on the period's own months, which are still to come.
    expect(wrapper.findAll('.wizard-api-calendar-month h3').map((month) => month.text())).toEqual(['November 2026', 'December 2026'])

    await wrapper.find('[data-testid="peak-dates-day-2026-11-25"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-11-30"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-save"]').trigger('click')
    expect(text(wrapper, 'peak-fact-dates')).toContain('Nov 25 – Nov 30')

    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ fromDate: '2026-11-25', thruDate: '2026-11-30' }))
  })

  it('marks a run time outside narrowed dates instead of hiding it', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-dates"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-11-24"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-11-27"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-save"]').trigger('click')

    const rows = wrapper.findAll('[data-testid="peak-run-time"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Outside the dates')
    expect(rows[1]!.text()).not.toContain('Outside the dates')
  })

  it('offers run-time dates from the saved period, and waits on the plus while the dates are unsaved', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-dates"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-11-25"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-11-27"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-save"]').trigger('click')

    const plus = wrapper.find('[data-testid="peak-run-time-add"]')
    expect(plus.attributes('disabled')).toBeDefined()
    expect(plus.attributes('aria-label')).toBe('Move another run')

    await wrapper.findAll('[data-testid="peak-run-time"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="peak-run-time-on"]').trigger('click')
    expect(optionValues(wrapper)).toEqual([
      'every', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01',
    ])
  })

  it('flipping the switch marks the page edited and Save keeps it off', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-on"]').trigger('click')
    expect(savePeakPeriod).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="peak-edited"]').exists()).toBe(true)

    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }))
  })

  it('opens a run time pre-filled, with Every day and each date of the period', async () => {
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="peak-run-time"]')[0]!.trigger('click')
    expect(text(wrapper, 'peak-run-time-target')).toContain('Daily Order Reconciliation - NetSuite')
    expect(text(wrapper, 'peak-run-time-on')).toContain('Nov 28')
    expect(wrapper.findComponent(WorkflowTimeSelect).props('modelValue')).toBe('06:00')

    await wrapper.find('[data-testid="peak-run-time-on"]').trigger('click')
    expect(optionValues(wrapper)).toEqual([
      'every', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01',
    ])
    await wrapper.find('[data-testid="app-select-option"][data-option-value="every"]').trigger('click')
    wrapper.findComponent(WorkflowTimeSelect).vm.$emit('update:modelValue', '05:45')
    await flushPromises()
    await wrapper.find('[data-testid="peak-run-time-save"]').trigger('click')
    await flushPromises()

    expect(savePeakRunTime).toHaveBeenCalledWith({ runTimeId: 'RT1', peakPeriodId: 'PP1', automationId: '100518', runTime: '05:45' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(getPeakPeriod).toHaveBeenCalledTimes(2)
  })

  it('adds a run time for an audit on one date', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-run-time-add"]').trigger('click')
    expect(wrapper.find('[data-testid="peak-run-time-delete"]').exists()).toBe(false)
    await choose(wrapper, 'peak-run-time-target', 'audit:AU1')
    await choose(wrapper, 'peak-run-time-on', '2026-11-28')
    wrapper.findComponent(WorkflowTimeSelect).vm.$emit('update:modelValue', '06:30')
    await flushPromises()
    await wrapper.find('[data-testid="peak-run-time-save"]').trigger('click')
    await flushPromises()
    expect(savePeakRunTime).toHaveBeenCalledWith({ peakPeriodId: 'PP1', auditId: 'AU1', onDate: '2026-11-28', runTime: '06:30' })
  })

  it('shows a run-time refusal in its popup, word for word', async () => {
    savePeakRunTime.mockRejectedValueOnce(new ApiCallError('On date must be inside the peak period.'))
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="peak-run-time"]')[1]!.trigger('click')
    await wrapper.find('[data-testid="peak-run-time-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(text(wrapper, 'peak-popup-error')).toBe('On date must be inside the peak period.')
  })

  it('deletes a run time from its popup', async () => {
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="peak-run-time"]')[1]!.trigger('click')
    await wrapper.find('[data-testid="peak-run-time-delete"]').trigger('click')
    await flushPromises()
    expect(deletePeakRunTime).toHaveBeenCalledWith({ runTimeId: 'RT2' })
    expect(getPeakPeriod).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('hides Waits for peak hours when nothing waits', async () => {
    getPeakPeriod.mockResolvedValue(got({ heldRuns: [] }))
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="peak-held-runs"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Waits for peak hours')
  })

  it('starts a new period with the plus disabled; the first Save moves to its own address', async () => {
    route.params = {}
    savePeakPeriod.mockResolvedValue({ ok: true, messages: [], errors: [], peakPeriodId: 'PP9' })
    getPeakPeriod.mockResolvedValue(got({ peakPeriod: period({ peakPeriodId: 'PP9', periodName: 'New peak period' }), runTimes: [], heldRuns: [] }))
    const wrapper = await mountPage()
    expect(getPeakPeriod).not.toHaveBeenCalled()
    expect(text(wrapper, 'peak-name')).toBe('New peak period')
    expect(wrapper.find('[data-testid="peak-run-time-add"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="peak-delete"]').exists()).toBe(false)
    // No dates yet, so nothing to save.
    expect(wrapper.find('[data-testid="peak-save"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="peak-fact-dates"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-11-24"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-day-2026-12-01"]').trigger('click')
    await wrapper.find('[data-testid="peak-dates-save"]').trigger('click')
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()

    expect(savePeakPeriod).toHaveBeenCalledWith({
      periodName: 'New peak period', fromDate: '2026-11-24', thruDate: '2026-12-01', peakHoursStart: '', peakHoursEnd: '', hotwaxReadSharePct: null, netsuiteSerial: false, isActive: true,
    })
    expect(replace).toHaveBeenCalledWith({ name: 'settings-tenant-peak-period', params: { peakPeriodId: 'PP9' } })
    expect(getPeakPeriod).toHaveBeenCalledWith({ peakPeriodId: 'PP9' })
    expect(wrapper.find('[data-testid="peak-run-time-add"]').attributes('disabled')).toBeUndefined()
  })

  it('deletes only after the popup confirms, then goes back to the list', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-delete"]').trigger('click')
    expect(deletePeakPeriod).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="peak-delete-cancel"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    await wrapper.find('[data-testid="peak-delete"]').trigger('click')
    await wrapper.find('[data-testid="peak-delete-confirm"]').trigger('click')
    await flushPromises()
    expect(deletePeakPeriod).toHaveBeenCalledWith({ peakPeriodId: 'PP1' })
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-periods' })
  })

  it('shows the saved HotWax share and NetSuite setting', async () => {
    getPeakPeriod.mockResolvedValue(got({ peakPeriod: period({ hotwaxReadSharePct: 25, netsuiteSerial: 'Y' }) }))
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="peak-fact-hotwax"] .static-fact__value').text()).toBe('25%')
    expect(wrapper.find('[data-testid="peak-fact-netsuite"] .static-fact__value').text()).toBe('One at a time')
  })

  it('sets the HotWax share in a popup; Save sends it as a whole number', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-hotwax"]').trigger('click')
    expect(wrapper.text()).toContain('How much of the HotWax read budget can Darpan use?')
    await wrapper.find('[data-testid="peak-hotwax-select"]').trigger('click')
    expect(wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.text()))
      .toEqual(['Normal', '10%', '25%', '50%', '75%'])
    await wrapper.find('[data-testid="app-select-option"][data-option-value="25"]').trigger('click')
    await wrapper.find('[data-testid="peak-hotwax-save"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(text(wrapper, 'peak-fact-hotwax')).toContain('25%')
    expect(wrapper.find('[data-testid="peak-edited"]').exists()).toBe(true)
    expect(savePeakPeriod).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ hotwaxReadSharePct: 25, netsuiteSerial: false }))
  })

  it('Normal sends a null HotWax share', async () => {
    getPeakPeriod.mockResolvedValue(got({ peakPeriod: period({ hotwaxReadSharePct: 50 }) }))
    const wrapper = await mountPage()
    expect(text(wrapper, 'peak-fact-hotwax')).toContain('50%')
    await wrapper.find('[data-testid="peak-fact-hotwax"]').trigger('click')
    await choose(wrapper, 'peak-hotwax-select', 'normal')
    await wrapper.find('[data-testid="peak-hotwax-save"]').trigger('click')
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ hotwaxReadSharePct: null }))
  })

  it('sets NetSuite reads to one at a time in a popup; Save sends netsuiteSerial true', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-netsuite"]').trigger('click')
    expect(wrapper.text()).toContain('How many NetSuite requests at once?')
    await wrapper.find('[data-testid="peak-netsuite-select"]').trigger('click')
    expect(wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.text()))
      .toEqual(['Parallel', 'One at a time'])
    await wrapper.find('[data-testid="app-select-option"][data-option-value="serial"]').trigger('click')
    await wrapper.find('[data-testid="peak-netsuite-save"]').trigger('click')
    expect(text(wrapper, 'peak-fact-netsuite')).toContain('One at a time')
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ netsuiteSerial: true }))
  })

  it('Parallel sends netsuiteSerial false', async () => {
    getPeakPeriod.mockResolvedValue(got({ peakPeriod: period({ netsuiteSerial: 'Y' }) }))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-netsuite"]').trigger('click')
    await choose(wrapper, 'peak-netsuite-select', 'parallel')
    await wrapper.find('[data-testid="peak-netsuite-save"]').trigger('click')
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(savePeakPeriod).toHaveBeenCalledWith(expect.objectContaining({ netsuiteSerial: false }))
  })

  it('shows the server share error verbatim', async () => {
    savePeakPeriod.mockResolvedValueOnce({
      ok: false, messages: [], errors: ['HotWax share must be a whole number from 1 to 100.'], peakPeriodId: null,
    })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="peak-fact-hotwax"]').trigger('click')
    await choose(wrapper, 'peak-hotwax-select', '10')
    await wrapper.find('[data-testid="peak-hotwax-save"]').trigger('click')
    await wrapper.find('[data-testid="peak-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'peak-page-error')).toBe('HotWax share must be a whole number from 1 to 100.')
  })

  it('reads only, without edit rights', async () => {
    permissions.canEditTenantSettings = false
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="peak-run-time-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="peak-save"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="peak-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="peak-fact-dates"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="peak-fact-hours"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="peak-fact-hotwax"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="peak-fact-netsuite"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="peak-run-time"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="peak-on"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="peak-back"]').attributes('data-to')).toBe(JSON.stringify({ name: 'settings-tenant-peak-periods' }))
  })
})
