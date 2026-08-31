import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppTableFrame from '../AppTableFrame.vue'
import { useMascotStore } from '../../../stores/mascot'
import { DWELL_MS } from '../../../composables/useMascotDwell'

/**
 * The integration the unit tests miss: a column opts in through its config, and the
 * header it renders has to actually carry the dwell. A directive that works in
 * isolation but never reaches the header is the failure mode worth a test.
 */
function mountTable(columns: Array<Record<string, unknown>>) {
  return mount(AppTableFrame, {
    props: {
      columns: columns as never,
      rows: [{ id: '1', counts: 2 }],
    },
    global: { plugins: [createPinia()] },
    attachTo: document.body,
  })
}

describe('AppTableFrame column explanations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('marks an opted-in header as explainable', () => {
    const wrapper = mountTable([{ key: 'counts', label: 'Differences', explain: 'differenceCount' }])

    const header = wrapper.get('th span')
    expect(header.classes()).toContain('is-explainable')
    expect(header.attributes('tabindex')).toBe('0')
  })

  it('leaves every other column exactly as it was', () => {
    const wrapper = mountTable([{ key: 'name', label: 'Name' }])

    const header = wrapper.get('th span')
    expect(header.classes()).not.toContain('is-explainable')
    expect(header.attributes('tabindex')).toBeUndefined()
  })

  it('explains the column after a dwell on its header', async () => {
    const wrapper = mountTable([{ key: 'counts', label: 'Differences', explain: 'differenceCount' }])
    const mascot = useMascotStore()

    await wrapper.get('th span').trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(DWELL_MS)

    expect(mascot.mode).toBe('explain')
    expect(mascot.entry?.title).toBe('Differences')
  })

  it('stays silent on a coarse pointer, where hover would latch with no way out', async () => {
    // jsdom has no matchMedia, so the guard is exercised explicitly rather than
    // relying on the environment's default.
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    const wrapper = mountTable([{ key: 'counts', label: 'Differences', explain: 'differenceCount' }])
    const mascot = useMascotStore()

    await wrapper.get('th span').trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(DWELL_MS * 2)

    expect(mascot.mode).toBe('idle')
  })
})
