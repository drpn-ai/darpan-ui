import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SyncSample } from '../../../lib/api/pulseTypes'
import { setDefaultDisplayTimeZone } from '../../../lib/utils/date'
import PulseOldestChart from '../PulseOldestChart.vue'
import PulseWaitingChart from '../PulseWaitingChart.vue'

const ok = (stamp: string, waitingCount: number, oldestWaitingMinutes: number | null, pastAllowanceCount = 0): SyncSample => ({
  sampleStamp: stamp, waitingCount, oldestWaitingMinutes, pastAllowanceCount, statusEnumId: 'SPS_OK',
})

// Three hours with readings (09 twice: the later one counts), one hour with only a failed pulse.
const samples: SyncSample[] = [
  ok('2026-11-21T08:55:00Z', 40, 30),
  ok('2026-11-21T09:05:00Z', 900, 200),
  ok('2026-11-21T09:55:00Z', 1610, 300, 0),
  { sampleStamp: '2026-11-21T10:05:00Z', waitingCount: 0, oldestWaitingMinutes: null, pastAllowanceCount: 0, statusEnumId: 'SPS_FAILED' },
  ok('2026-11-21T11:00:00Z', 1240, 400, 12),
]

describe('PulseOldestChart', () => {
  beforeEach(() => setDefaultDisplayTimeZone('UTC'))
  afterEach(() => setDefaultDisplayTimeZone(undefined))

  it('draws one point per hour with a reading, on the hour ticks, and the dashed allowance line', () => {
    const wrapper = mount(PulseOldestChart, { props: { samples, allowanceMinutes: 360 } })
    const points = wrapper.find('[data-testid="pulse-oldest-line"]').attributes('points')!.trim().split(/\s+/)
    expect(points).toHaveLength(3)
    expect(wrapper.findAll('[data-testid="pulse-hour-tick"]').map((tick) => tick.text())).toEqual(['08', '09', '11'])

    // 400 minutes is the highest; with the 6h allowance the scale runs to 8 hours, so the line sits at 6/8 up.
    const allowance = wrapper.find('[data-testid="pulse-allowance-line"]')
    expect(allowance.attributes('y1')).toBe('58')
    expect(allowance.attributes('y2')).toBe('58')
    expect(allowance.classes()).toContain('pulse-chart__allowance')
    expect(wrapper.find('[data-testid="pulse-allowance-text"]').text()).toBe('allowance 6h')
  })

  it('reads the latest hour until another is pointed at, then that one', async () => {
    const wrapper = mount(PulseOldestChart, { props: { samples, allowanceMinutes: 360 } })
    expect(wrapper.find('[data-testid="pulse-readout"]').text()).toBe('11:00 · oldest 6h 40m · 1,240 waiting · 12 past allowance')

    await wrapper.findAll('[data-testid="pulse-hour-hit"]')[1]!.trigger('mouseenter')
    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([1])

    await wrapper.setProps({ active: 1 })
    expect(wrapper.find('[data-testid="pulse-readout"]').text()).toBe('09:00 · oldest 5h · 1,610 waiting · 0 past allowance')
  })

  it('moves along the hours with the arrow keys once focused', async () => {
    const wrapper = mount(PulseOldestChart, { props: { samples, allowanceMinutes: 360, active: null } })
    await wrapper.find('[data-testid="pulse-oldest-plot"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([1])
    await wrapper.find('[data-testid="pulse-oldest-plot"]').trigger('keydown', { key: 'Home' })
    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([0])
  })

  it('is one image to a screen reader, summarising the day', () => {
    const wrapper = mount(PulseOldestChart, { props: { samples, allowanceMinutes: 360 } })
    const svg = wrapper.find('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe(
      'Oldest waiting order by hour today: 30m at 08:00, 6h 40m at 11:00, highest 6h 40m at 11:00. Allowance 6h, passed at 11:00.',
    )
  })

  it('says so when there is no pulse today', () => {
    const wrapper = mount(PulseOldestChart, { props: { samples: [], allowanceMinutes: 360 } })
    expect(wrapper.find('svg').attributes('aria-label')).toBe('No pulses today.')
    expect(wrapper.find('[data-testid="pulse-oldest-line"]').exists()).toBe(false)
  })
})

describe('PulseWaitingChart', () => {
  beforeEach(() => setDefaultDisplayTimeZone('UTC'))
  afterEach(() => setDefaultDisplayTimeZone(undefined))

  it('draws one bar per hour, at the same x as the oldest chart’s points, the latest in full ink', () => {
    const wrapper = mount(PulseWaitingChart, { props: { samples, allowanceMinutes: 360 } })
    const bars = wrapper.findAll('[data-testid="pulse-waiting-bar"]')
    expect(bars).toHaveLength(3)

    const oldest = mount(PulseOldestChart, { props: { samples, allowanceMinutes: 360 } })
    const pointXs = oldest.find('[data-testid="pulse-oldest-line"]').attributes('points')!.trim().split(/\s+/)
      .map((point) => Number(point.split(',')[0]))
    const barCentres = bars.map((bar) => Number(bar.attributes('x')) + Number(bar.attributes('width')) / 2)
    barCentres.forEach((centre, index) => expect(centre).toBeCloseTo(pointXs[index]!, 1))

    // 1,610 is the most; the scale runs to 2,000.
    expect(Number(bars[1]!.attributes('height'))).toBeCloseTo((1610 / 2000) * 168, 1)
    expect(bars.map((bar) => bar.classes().includes('pulse-chart__bar--active'))).toEqual([false, false, true])
  })

  it('puts the pointed-at hour in full ink and tells the page which one', async () => {
    const wrapper = mount(PulseWaitingChart, { props: { samples, allowanceMinutes: 360, active: 0 } })
    expect(wrapper.findAll('[data-testid="pulse-waiting-bar"]').map((bar) => bar.classes().includes('pulse-chart__bar--active')))
      .toEqual([true, false, false])
    await wrapper.findAll('[data-testid="pulse-hour-hit"]')[2]!.trigger('mouseenter')
    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([2])
    await wrapper.find('[data-testid="pulse-waiting-plot"]').trigger('mouseleave')
    expect(wrapper.emitted('update:active')?.at(-1)).toEqual([null])
  })

  it('summarises the day for a screen reader', () => {
    const wrapper = mount(PulseWaitingChart, { props: { samples, allowanceMinutes: 360 } })
    expect(wrapper.find('svg').attributes('role')).toBe('img')
    expect(wrapper.find('svg').attributes('aria-label')).toBe(
      'Orders waiting by hour today: 40 at 08:00, 1,240 at 11:00, highest 1,610 at 09:00.',
    )
  })
})
