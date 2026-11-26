import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { GetSyncPairResponse, SyncPair } from '../../../lib/api/pulseTypes'
import { lookupAction } from '../../../lib/mascotActions'
import { setDefaultDisplayTimeZone } from '../../../lib/utils/date'
import AppToggleSwitch from '../../../components/ui/AppToggleSwitch.vue'
import PulseOldestChart from '../../../components/pulse/PulseOldestChart.vue'
import PulseWaitingChart from '../../../components/pulse/PulseWaitingChart.vue'

const getSyncPair = vi.hoisted(() => vi.fn())
const saveSyncPair = vi.hoisted(() => vi.fn())
const deleteSyncPair = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({ params: { syncPairId: 'SP1' } as Record<string, string> }))
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  pulseFacade: { getSyncPair, saveSyncPair, deleteSyncPair },
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

import TenantSyncPairPage from '../TenantSyncPairPage.vue'

const pair = (over: Partial<SyncPair> = {}): SyncPair => ({
  syncPairId: 'SP1', label: 'HotWax → NetSuite orders', automationId: 'A1', automationName: 'Daily Order Reconciliation',
  allowanceMinutes: 360, pulseEveryMinutes: 60, isActive: 'Y', lastPulseStamp: '2026-11-21T11:00:00Z',
  waitingCount: 1240, pastAllowanceCount: 12, periodName: null, upstreamSide: 'FILE_1', chatSpaceId: 'CS1',
  hourlySummary: 'N', ...over,
})

const got = (over: Partial<GetSyncPairResponse> = {}): GetSyncPairResponse => ({
  ok: true, messages: [], errors: [],
  syncPair: pair(),
  samplesToday: [
    { sampleStamp: '2026-11-21T09:55:00Z', waitingCount: 1610, oldestWaitingMinutes: 300, pastAllowanceCount: 0, statusEnumId: 'SPS_OK' },
    { sampleStamp: '2026-11-21T11:00:00Z', waitingCount: 1240, oldestWaitingMinutes: 400, pastAllowanceCount: 12, statusEnumId: 'SPS_OK' },
  ],
  pastOrders: [
    { recordKey: 'O1', orderName: 'M1301877', otherSystemId: '#GOR197004512', sourceCreatedStamp: '2026-11-21T04:20:00Z',
      waitingMinutes: 400, reportedInRunId: null, reportedInSavedRunId: null },
    { recordKey: 'O2', orderName: 'M1301902', otherSystemId: null, sourceCreatedStamp: '2026-11-21T04:26:00Z',
      waitingMinutes: 394, reportedInRunId: null, reportedInSavedRunId: null },
  ],
  automations: [
    { automationId: 'A1', label: 'Daily Order Reconciliation',
      upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'HotWax' }, { upstreamSide: 'FILE_2', label: 'NetSuite' }] },
    { automationId: 'A2', label: 'Daily Returns',
      upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'Shopify' }, { upstreamSide: 'FILE_2', label: 'HotWax' }] },
  ],
  chatSpaces: [{ chatSpaceId: 'CS1', label: 'Ops alerts' }, { chatSpaceId: 'CS2', label: 'Night shift' }],
  ...over,
})

async function mountPage() {
  const wrapper = mount(TenantSyncPairPage, { attachTo: document.body })
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

function optionLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.text())
}

describe('TenantSyncPairPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDefaultDisplayTimeZone('UTC')
    permissions.canEditTenantSettings = true
    route.params = { syncPairId: 'SP1' }
    document.body.replaceChildren()
    getSyncPair.mockResolvedValue(got())
    saveSyncPair.mockResolvedValue({ ok: true, messages: [], errors: [], syncPairId: 'SP1' })
    deleteSyncPair.mockResolvedValue({ ok: true, messages: [], errors: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
    setDefaultDisplayTimeZone(undefined)
  })

  it('a past order the daily check has reported links to that run', async () => {
    const base = got()
    getSyncPair.mockResolvedValue({
      ...base,
      pastOrders: [{ ...base.pastOrders![0], reportedInRunId: 'RR9', reportedInSavedRunId: 'RS9' }, base.pastOrders![1]],
    })
    const wrapper = await mountPage()
    const links = wrapper.findAll('[data-testid="sync-pair-past-run"]')
    expect(links).toHaveLength(1)
    expect(links[0]!.text()).toBe('in run RR9')
    expect(JSON.parse(links[0]!.attributes('data-to')!)).toMatchObject({
      name: 'reconciliation-run-live',
      params: { savedRunId: 'RS9', runResultId: 'RR9' },
    })
  })

  it('shows the label, the switch, the five facts, today’s charts and the orders past the allowance', async () => {
    const wrapper = await mountPage()
    expect(getSyncPair).toHaveBeenCalledWith({ syncPairId: 'SP1' })
    expect(text(wrapper, 'sync-pair-name')).toBe('HotWax → NetSuite')
    expect(wrapper.find('[data-testid="sync-pair-name"] input').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sync-pair-on"]').attributes('aria-checked')).toBe('true')

    expect(wrapper.findAll('[data-testid="sync-pair-facts"] .static-fact')).toHaveLength(5)
    expect(text(wrapper, 'sync-pair-fact-every')).toMatch(/Every\s*Hour\s*last 11:00/)
    expect(text(wrapper, 'sync-pair-fact-allowance')).toMatch(/Allowance\s*6 hours\s*normal/)
    expect(text(wrapper, 'sync-pair-fact-waiting')).toMatch(/Waiting\s*1,240\s*orders/)
    expect(text(wrapper, 'sync-pair-fact-oldest')).toMatch(/Oldest\s*6h 40m\s*M1301877/)
    expect(text(wrapper, 'sync-pair-fact-past')).toMatch(/Past allowance\s*12\s*findings/)

    const oldest = wrapper.findComponent(PulseOldestChart)
    expect(oldest.props('allowanceMinutes')).toBe(360)
    expect(oldest.props('samples')).toHaveLength(2)
    expect(wrapper.findComponent(PulseWaitingChart).props('samples')).toHaveLength(2)

    const rows = wrapper.findAll('[data-testid="sync-pair-past-order"]')
    expect(rows.map((row) => row.text())).toEqual([
      expect.stringMatching(/M1301877\s*04:20\s*6h 40m\s*#GOR197004512/),
      expect.stringMatching(/M1301902\s*04:26\s*6h 34m\s*—/),
    ])
    // The fourth column is named for the other side of the pair.
    expect(text(wrapper, 'sync-pair-past-head')).toContain('NetSuite')
    expect(wrapper.find('[data-testid="sync-pair-save"]').exists()).toBe(false)
  })

  it('hovering an hour on either chart moves the one readout', async () => {
    const wrapper = await mountPage()
    expect(text(wrapper, 'pulse-readout')).toBe('11:00 · oldest 6h 40m · 1,240 waiting · 12 past allowance')
    await wrapper.findComponent(PulseWaitingChart).findAll('[data-testid="pulse-hour-hit"]')[0]!.trigger('mouseenter')
    expect(text(wrapper, 'pulse-readout')).toBe('09:00 · oldest 5h · 1,610 waiting · 0 past allowance')
    expect(wrapper.findAll('[data-testid="pulse-readout"]')).toHaveLength(1)
  })

  it('says so when nothing is past the allowance and no pulse ran today', async () => {
    getSyncPair.mockResolvedValue(got({ samplesToday: [], pastOrders: [], syncPair: pair({ waitingCount: 0, pastAllowanceCount: 0, lastPulseStamp: null }) }))
    const wrapper = await mountPage()
    expect(text(wrapper, 'sync-pair-past-empty')).toBe('Nothing past the allowance.')
    expect(text(wrapper, 'sync-pair-today-empty')).toBe('No pulses today.')
    expect(wrapper.findComponent(PulseOldestChart).exists()).toBe(false)
    expect(text(wrapper, 'sync-pair-fact-oldest')).toMatch(/Oldest\s*None/)
  })

  it('changes Every and Allowance in popups and saves the pair with exactly what it has', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-fact-every"]').trigger('click')
    await wrapper.find('[data-testid="sync-pair-every-select"]').trigger('click')
    expect(optionLabels(wrapper)).toEqual(['Off', '1 hour', '2 hours', '3 hours', '4 hours', '6 hours'])
    await wrapper.find('[data-testid="app-select-option"][data-option-value="120"]').trigger('click')
    await wrapper.find('[data-testid="sync-pair-every-save"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(text(wrapper, 'sync-pair-fact-every')).toContain('2 hours')

    await wrapper.find('[data-testid="sync-pair-fact-allowance"]').trigger('click')
    await wrapper.find('[data-testid="sync-pair-allowance-select"]').trigger('click')
    expect(optionLabels(wrapper)).toEqual(['15 min', '30 min', '1 hour', '2 hours', '3 hours', '4 hours', '6 hours', '8 hours',
      '12 hours', '24 hours', '48 hours'])
    await wrapper.find('[data-testid="app-select-option"][data-option-value="480"]').trigger('click')
    await wrapper.find('[data-testid="sync-pair-allowance-save"]').trigger('click')
    expect(text(wrapper, 'sync-pair-fact-allowance')).toContain('8 hours')
    expect(wrapper.find('[data-testid="sync-pair-edited"]').exists()).toBe(true)
    expect(saveSyncPair).not.toHaveBeenCalled()

    await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
    await flushPromises()
    expect(saveSyncPair).toHaveBeenCalledWith({
      syncPairId: 'SP1', automationId: 'A1', upstreamSide: 'FILE_1', allowanceMinutes: 480, pulseEveryMinutes: 120,
      chatSpaceId: 'CS1', hourlySummary: false, isActive: true,
    })
    expect(getSyncPair).toHaveBeenCalledTimes(2)
    expect(replace).not.toHaveBeenCalled()
  })

  it('turns the pulse off with Every and the pair off with its switch', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-fact-every"]').trigger('click')
    await choose(wrapper, 'sync-pair-every-select', 'off')
    await wrapper.find('[data-testid="sync-pair-every-save"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-pair-fact-every"] .static-fact__value').text()).toBe('Off')
    await wrapper.find('[data-testid="sync-pair-on"]').trigger('click')
    await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
    await flushPromises()
    expect(saveSyncPair).toHaveBeenCalledWith(expect.objectContaining({ pulseEveryMinutes: null, isActive: false }))
  })

  it('shows the server’s sentences word for word', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-on"]').trigger('click')
    saveSyncPair.mockRejectedValueOnce(new ApiCallError('Allowance must be 15 minutes to 48 hours.'))
    await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'sync-pair-page-error')).toBe('Allowance must be 15 minutes to 48 hours.')

    saveSyncPair.mockResolvedValueOnce({ ok: false, messages: [], errors: ['Choose a chat space of this tenant.'], syncPairId: '' })
    await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'sync-pair-page-error')).toBe('Choose a chat space of this tenant.')
  })

  it('shows a refused read as the page error', async () => {
    getSyncPair.mockResolvedValue({ ok: false, messages: [], errors: ['Sync pair SP1 not found.'] })
    const wrapper = await mountPage()
    expect(text(wrapper, 'sync-pair-page-error')).toBe('Sync pair SP1 not found.')
    expect(wrapper.find('[data-testid="sync-pair-facts"]').exists()).toBe(false)
  })

  it('names the peak period in the facts but edits the pair normal values, switch included', async () => {
    getSyncPair.mockResolvedValue(got({ syncPair: pair({
      allowanceMinutes: 720, periodName: 'Black Friday sale', normalAllowanceMinutes: 360, normalPulseEveryMinutes: 60,
    }) }))
    const wrapper = await mountPage()
    expect(text(wrapper, 'sync-pair-fact-allowance')).toMatch(/Allowance\s*12 hours\s*Black Friday sale/)
    expect(wrapper.find('[data-testid="sync-pair-fact-allowance"]').element.tagName).toBe('BUTTON')
    expect(wrapper.find('[data-testid="sync-pair-fact-every"]').element.tagName).toBe('BUTTON')
    expect(wrapper.find('[data-testid="sync-pair-on"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('[data-testid="sync-pair-on"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-pair-edited"]').exists()).toBe(true)
    await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
    await flushPromises()
    expect(saveSyncPair).toHaveBeenCalledWith(expect.objectContaining({
      allowanceMinutes: 360, pulseEveryMinutes: 60, isActive: false,
    }))
  })

  it('notes the period in the allowance popup and keeps the period value after a draft change', async () => {
    getSyncPair.mockResolvedValue(got({ syncPair: pair({
      allowanceMinutes: 720, periodName: 'Black Friday sale', normalAllowanceMinutes: 360, normalPulseEveryMinutes: 60, periodThruDate: '2026-12-01',
    }) }))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-fact-allowance"]').trigger('click')
    expect(text(wrapper, 'sync-pair-allowance-period-note')).toBe('Normal days. Black Friday sale uses 12 hours through 1 Dec.')
    expect(wrapper.find('[data-testid="sync-pair-every-period-note"]').exists()).toBe(false)
    await wrapper.find('[data-testid="sync-pair-allowance-select"]').trigger('click')
    // Pick the 3-hour choice through the select's model.
    ;(wrapper.findComponent({ name: 'AppSelect' }) as { vm: { $emit: (e: string, v: string) => void } }).vm.$emit('update:modelValue', '180')
    await wrapper.find('[data-testid="sync-pair-allowance-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'sync-pair-fact-allowance')).toMatch(/Allowance\s*12 hours\s*normal: 3 hours/)
  })

  it('names the period end as the same calendar day in a US zone', async () => {
    setDefaultDisplayTimeZone('America/Los_Angeles')
    try {
      getSyncPair.mockResolvedValue(got({ syncPair: pair({
        allowanceMinutes: 720, periodName: 'Black Friday sale', normalAllowanceMinutes: 360, periodThruDate: '2026-12-01',
      }) }))
      const wrapper = await mountPage()
      await wrapper.find('[data-testid="sync-pair-fact-allowance"]').trigger('click')
      expect(text(wrapper, 'sync-pair-allowance-period-note')).toContain('through 1 Dec.')
    } finally {
      setDefaultDisplayTimeZone(undefined)
    }
  })

  it('notes the period in the Every popup and keeps the period cadence after a draft change', async () => {
    getSyncPair.mockResolvedValue(got({ syncPair: pair({
      pulseEveryMinutes: 120, periodName: 'Black Friday sale', normalAllowanceMinutes: 360, normalPulseEveryMinutes: 60,
    }) }))
    const wrapper = await mountPage()
    expect(text(wrapper, 'sync-pair-fact-every')).toContain('Black Friday sale')
    await wrapper.find('[data-testid="sync-pair-fact-every"]').trigger('click')
    expect(text(wrapper, 'sync-pair-every-period-note')).toBe('Normal days. Black Friday sale pulses every 2 hours.')
    ;(wrapper.findComponent({ name: 'AppSelect' }) as { vm: { $emit: (e: string, v: string) => void } }).vm.$emit('update:modelValue', '240')
    await wrapper.find('[data-testid="sync-pair-every-save"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'sync-pair-fact-every')).toMatch(/Every\s*2 hours\s*normal: 4 hours/)
  })

  it.each([
    [60, 120, 'pulses every hour'],
    [120, 60, 'pulses every 2 hours'],
    [0, 60, 'turns the pulse off'],
  ])('words a period cadence of %i minutes in the Every note', async (minutes, normal, words) => {
    getSyncPair.mockResolvedValue(got({ syncPair: pair({
      pulseEveryMinutes: minutes, periodName: 'Black Friday sale', normalAllowanceMinutes: 360,
      normalPulseEveryMinutes: normal, periodThruDate: '2026-12-01',
    }) }))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-fact-every"]').trigger('click')
    expect(text(wrapper, 'sync-pair-every-period-note')).toBe(`Normal days. Black Friday sale ${words} through 1 Dec.`)
  })

  it('shows no period note when no period overrides the allowance', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-fact-allowance"]').trigger('click')
    expect(wrapper.find('[data-testid="sync-pair-allowance-period-note"]').exists()).toBe(false)
  })

  it('shows a failed last pulse as the Every sub and keeps the last OK sample in Waiting', async () => {
    getSyncPair.mockResolvedValue(got({ syncPair: pair({ lastPulseStatusEnumId: 'SPS_FAILED' }) }))
    const wrapper = await mountPage()
    expect(text(wrapper, 'sync-pair-fact-every')).toMatch(/last pulse failed \d{1,2}:\d{2}/)
    expect(text(wrapper, 'sync-pair-fact-waiting')).toContain('1,240')
    expect(text(wrapper, 'sync-pair-fact-oldest')).toContain('6h 40m')
  })

  it('deletes the pair after asking, then goes back to the list', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-delete"]').trigger('click')
    expect(text(wrapper, 'sync-pair-popup-title')).toBe('Delete sync pair')
    expect(deleteSyncPair).not.toHaveBeenCalled()
    await wrapper.find('[data-testid="sync-pair-delete-confirm"]').trigger('click')
    await flushPromises()
    expect(deleteSyncPair).toHaveBeenCalledWith({ syncPairId: 'SP1' })
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-sync-pairs' })
  })

  it('shows a refused delete in its popup', async () => {
    deleteSyncPair.mockResolvedValueOnce({ ok: false, messages: [], errors: ['Sync pair SP1 not found.'] })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="sync-pair-delete"]').trigger('click')
    await wrapper.find('[data-testid="sync-pair-delete-confirm"]').trigger('click')
    await flushPromises()
    expect(text(wrapper, 'sync-pair-popup-error')).toBe('Sync pair SP1 not found.')
    expect(push).not.toHaveBeenCalled()
  })

  it('is read-only without tenant-settings edit', async () => {
    permissions.canEditTenantSettings = false
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="sync-pair-fact-every"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="sync-pair-fact-allowance"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="sync-pair-on"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="sync-pair-save"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sync-pair-delete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sync-pair-back"]').attributes('data-to')).toBe(JSON.stringify({ name: 'settings-tenant-sync-pairs' }))
  })

  it('reads the pair again every minute, skips while edited, and stops when the page closes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const wrapper = await mountPage()
    expect(getSyncPair).toHaveBeenCalledTimes(1)

    getSyncPair.mockResolvedValue(got({ syncPair: pair({ waitingCount: 1300 }) }))
    await vi.advanceTimersByTimeAsync(59_000)
    expect(getSyncPair).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1_000)
    await flushPromises()
    expect(getSyncPair).toHaveBeenCalledTimes(2)
    expect(text(wrapper, 'sync-pair-fact-waiting')).toContain('1,300')

    // An unsaved edit is never read over.
    await wrapper.find('[data-testid="sync-pair-on"]').trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(getSyncPair).toHaveBeenCalledTimes(2)
    await wrapper.find('[data-testid="sync-pair-on"]').trigger('click')

    // Nor while a popup is open.
    await wrapper.find('[data-testid="sync-pair-fact-allowance"]').trigger('click')
    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(getSyncPair).toHaveBeenCalledTimes(2)
    await wrapper.find('[data-testid="sync-pair-allowance-cancel"]').trigger('click')

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()
    expect(getSyncPair).toHaveBeenCalledTimes(3)

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(180_000)
    expect(getSyncPair).toHaveBeenCalledTimes(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('a new pair', () => {
    beforeEach(() => {
      route.params = {}
      getSyncPair.mockResolvedValue(got({ syncPair: undefined as unknown as SyncPair, samplesToday: [], pastOrders: [] }))
      saveSyncPair.mockResolvedValue({ ok: true, messages: [], errors: [], syncPairId: 'SP9' })
    })

    it('reads only the pickers, and offers Run, Upstream side, Every, Allowance, Chat space and Hourly summary', async () => {
      const wrapper = await mountPage()
      expect(getSyncPair).toHaveBeenCalledWith({})
      expect(text(wrapper, 'sync-pair-name')).toBe('New sync pair')
      const facts = wrapper.findAll('[data-testid="sync-pair-facts"] .static-fact')
      expect(facts.map((fact) => fact.find('.static-page-summary-label').text()))
        .toEqual(['Run', 'Upstream side', 'Every', 'Allowance', 'Chat space', 'Hourly summary'])
      expect(text(wrapper, 'sync-pair-fact-run')).toContain('Not set')
      expect(wrapper.find('[data-testid="sync-pair-fact-upstream"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-testid="sync-pair-today"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="sync-pair-delete"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="sync-pair-save"]').attributes('disabled')).toBeDefined()
    })

    it('creates the pair from its popups with the exact payload, then moves to its own address', async () => {
      const wrapper = await mountPage()
      await wrapper.find('[data-testid="sync-pair-fact-run"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-run-select"]').trigger('click')
      expect(wrapper.find('[data-testid="app-select-search"]').exists()).toBe(true)
      await wrapper.find('[data-testid="app-select-option"][data-option-value="A2"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-run-save"]').trigger('click')
      expect(text(wrapper, 'sync-pair-name')).toBe('Daily Returns')

      await wrapper.find('[data-testid="sync-pair-fact-upstream"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-upstream-select"]').trigger('click')
      expect(optionLabels(wrapper)).toEqual(['Shopify', 'HotWax'])
      await wrapper.find('[data-testid="app-select-option"][data-option-value="FILE_2"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-upstream-save"]').trigger('click')
      expect(text(wrapper, 'sync-pair-fact-upstream')).toContain('HotWax')

      await wrapper.find('[data-testid="sync-pair-fact-chat"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-chat-select"]').trigger('click')
      expect(optionLabels(wrapper)).toEqual(['None', 'Ops alerts', 'Night shift'])
      await wrapper.find('[data-testid="app-select-option"][data-option-value="CS2"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-chat-save"]').trigger('click')
      expect(text(wrapper, 'sync-pair-fact-chat')).toContain('Night shift')

      await wrapper.find('[data-testid="sync-pair-fact-hourly"]').trigger('click')
      const toggle = wrapper.findAllComponents(AppToggleSwitch).find((item) => item.props('label') === 'Hourly summary')!
      expect(toggle.props('modelValue')).toBe(false)
      await wrapper.find('[data-testid="sync-pair-hourly-toggle"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-hourly-save"]').trigger('click')
      expect(text(wrapper, 'sync-pair-fact-hourly')).toContain('On')

      await wrapper.find('[data-testid="sync-pair-fact-allowance"]').trigger('click')
      await choose(wrapper, 'sync-pair-allowance-select', '30')
      await wrapper.find('[data-testid="sync-pair-allowance-save"]').trigger('click')

      await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
      await flushPromises()
      expect(saveSyncPair).toHaveBeenCalledWith({
        automationId: 'A2', upstreamSide: 'FILE_2', allowanceMinutes: 30, pulseEveryMinutes: 60,
        chatSpaceId: 'CS2', hourlySummary: true, isActive: true,
      })
      expect(replace).toHaveBeenCalledWith({ name: 'settings-tenant-sync-pair', params: { syncPairId: 'SP9' } })
      expect(getSyncPair).toHaveBeenLastCalledWith({ syncPairId: 'SP9' })
    })

    it('a new run clears the upstream side chosen for the old one', async () => {
      const wrapper = await mountPage()
      await wrapper.find('[data-testid="sync-pair-fact-run"]').trigger('click')
      await choose(wrapper, 'sync-pair-run-select', 'A1')
      await wrapper.find('[data-testid="sync-pair-run-save"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-fact-upstream"]').trigger('click')
      await choose(wrapper, 'sync-pair-upstream-select', 'FILE_1')
      await wrapper.find('[data-testid="sync-pair-upstream-save"]').trigger('click')

      await wrapper.find('[data-testid="sync-pair-fact-run"]').trigger('click')
      await choose(wrapper, 'sync-pair-run-select', 'A2')
      await wrapper.find('[data-testid="sync-pair-run-save"]').trigger('click')
      expect(text(wrapper, 'sync-pair-fact-upstream')).toContain('Not set')
      expect(wrapper.find('[data-testid="sync-pair-save"]').attributes('disabled')).toBeDefined()
    })

    it('shows the server’s refusal of a new pair word for word and stays on the new page', async () => {
      saveSyncPair.mockResolvedValueOnce({ ok: false, messages: [], errors: ['A pulse needs HotWax as the upstream side.'], syncPairId: '' })
      const wrapper = await mountPage()
      await wrapper.find('[data-testid="sync-pair-fact-run"]').trigger('click')
      await choose(wrapper, 'sync-pair-run-select', 'A1')
      await wrapper.find('[data-testid="sync-pair-run-save"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-fact-upstream"]').trigger('click')
      await choose(wrapper, 'sync-pair-upstream-select', 'FILE_2')
      await wrapper.find('[data-testid="sync-pair-upstream-save"]').trigger('click')
      await wrapper.find('[data-testid="sync-pair-save"]').trigger('click')
      await flushPromises()
      expect(text(wrapper, 'sync-pair-page-error')).toBe('A pulse needs HotWax as the upstream side.')
      expect(replace).not.toHaveBeenCalled()
    })
  })

  it('answers the facts’ names when the mascot is asked about them', () => {
    for (const name of ['every: hour', 'allowance: 6 hours', 'run: daily returns', 'upstream side: hotwax',
      'chat space: none', 'hourly summary: off']) {
      expect(lookupAction(name), name).toBeTruthy()
    }
    for (const name of ['sync pulse on', 'save sync pair', 'delete sync pair', 'back to sync pulse', 'hourly summary']) {
      expect(lookupAction(name), name).toBeTruthy()
    }
  })
})
