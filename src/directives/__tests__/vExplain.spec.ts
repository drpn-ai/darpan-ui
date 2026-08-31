import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { vExplain } from '../vExplain'
import { useMascotStore } from '../../stores/mascot'
import { DWELL_MS, RELEASE_MS } from '../../composables/useMascotDwell'

/** Mounts a span carrying v-explain, since the directive is the unit under test. */
function mountTarget(term = 'differenceCount') {
  return mount(
    defineComponent({
      directives: { explain: vExplain },
      props: { term: { type: String, default: term } },
      template: `<span class="target" v-explain="term">Differences</span>`,
    }),
    { props: { term }, global: { plugins: [createPinia()] }, attachTo: document.body },
  )
}

describe('v-explain', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    // jsdom has no matchMedia; the directive treats that as a fine pointer so the
    // hover path stays testable.
    vi.stubGlobal('matchMedia', undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('marks the element as explainable and reachable by keyboard', () => {
    const wrapper = mountTarget()
    const el = wrapper.get('.target')

    expect(el.classes()).toContain('is-explainable')
    expect(el.attributes('tabindex')).toBe('0')
  })

  it('explains the term only after the pointer has rested for the full dwell', async () => {
    const wrapper = mountTarget()
    const mascot = useMascotStore()

    await wrapper.get('.target').trigger('pointerenter', { pointerType: 'mouse' })
    expect(mascot.listening).toBe(true)
    expect(mascot.mode).toBe('idle')

    vi.advanceTimersByTime(DWELL_MS)

    expect(mascot.mode).toBe('explain')
    expect(mascot.entry?.title).toBe('Differences')
  })

  it('never fires for a touch pointer, which has no hover to leave', async () => {
    const wrapper = mountTarget()
    const mascot = useMascotStore()

    await wrapper.get('.target').trigger('pointerenter', { pointerType: 'touch' })
    vi.advanceTimersByTime(DWELL_MS * 2)

    expect(mascot.mode).toBe('idle')
  })

  it('clears the answer a half second after the pointer leaves', async () => {
    const wrapper = mountTarget()
    const mascot = useMascotStore()
    const target = wrapper.get('.target')

    await target.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(DWELL_MS)
    await target.trigger('pointerleave')

    vi.advanceTimersByTime(RELEASE_MS - 1)
    expect(mascot.mode).toBe('explain')

    vi.advanceTimersByTime(1)
    expect(mascot.mode).toBe('idle')
  })

  it('opens at once on focus, with no dwell to wait out', async () => {
    const wrapper = mountTarget()
    const mascot = useMascotStore()

    await wrapper.get('.target').trigger('focus')

    expect(mascot.mode).toBe('explain')
    expect(mascot.entry?.title).toBe('Differences')
  })

  it('does nothing at all when the column has no glossary key', async () => {
    const wrapper = mountTarget('')
    const mascot = useMascotStore()
    const target = wrapper.get('.target')

    expect(target.classes()).not.toContain('is-explainable')
    await target.trigger('pointerenter', { pointerType: 'mouse' })
    vi.advanceTimersByTime(DWELL_MS * 2)

    expect(mascot.mode).toBe('idle')
  })

  it('stops listening once the element goes away mid-dwell', async () => {
    const wrapper = mountTarget()
    const mascot = useMascotStore()

    await wrapper.get('.target').trigger('pointerenter', { pointerType: 'mouse' })
    wrapper.unmount()
    vi.advanceTimersByTime(DWELL_MS * 2)

    expect(mascot.mode).toBe('idle')
  })
})
