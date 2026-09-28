import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MascotDock from '../MascotDock.vue'
import { useMascotStore } from '../../../stores/mascot'

function mountDock(options: Record<string, unknown> = {}) {
  return mount(MascotDock, { global: { plugins: [createPinia()] }, ...options })
}

describe('MascotDock', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('replaces the old pill with a face that still names itself for screen readers', () => {
    const wrapper = mountDock()
    const fab = wrapper.get('.mascot-fab')

    expect(fab.attributes('aria-label')).toContain('Ask Darpan')
    expect(wrapper.find('.mascot').exists()).toBe(true)
    // Nothing is said until it is asked: an empty corner at rest.
    expect(wrapper.find('.mascot-say').exists()).toBe(false)
  })

  it('opens the launcher when the face is clicked', async () => {
    const wrapper = mountDock()

    await wrapper.get('.mascot-fab').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('offers only the shortcut when you look at the face', async () => {
    const wrapper = mountDock()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })

    const say = wrapper.get('.mascot-say')
    expect(say.classes()).toContain('mascot-say--hint')
    expect(say.text()).toContain('Click me')
    expect(say.text()).toContain('if you’re in a hurry')
  })

  it('ignores a touch tap for the hover label, which would otherwise latch open', async () => {
    const wrapper = mountDock()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'touch' })

    expect(wrapper.find('.mascot-say').exists()).toBe(false)
  })

  it('speaks a glossary entry, leading with the term', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    await wrapper.vm.$nextTick()

    const say = wrapper.get('.mascot-say')
    expect(say.get('.mascot-say-lead').text()).toBe('Differences')
    expect(say.text()).toContain('don’t line up on a compared field')
    expect(say.classes()).not.toContain('mascot-say--hint')
  })

  it('says it does not know rather than opening an empty bubble', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('noSuchTermExists')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-say').text()).toContain('Drawing a blank')
  })

  it('does not let the face label interrupt an explanation already on screen', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.get('.mascot-say-lead').text()).toBe('Differences')
  })

  it('keeps the answer when the pointer moves onto the bubble to read it', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    mascot.beginRelease()
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.mascot-say').classes()).toContain('mascot-say--going')

    await wrapper.get('.mascot-say').trigger('pointerenter')

    expect(mascot.releasing).toBe(false)
    expect(wrapper.get('.mascot-say').classes()).not.toContain('mascot-say--going')
  })

  it('dismisses on Escape without needing the pointer to move', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.explain('differenceCount')
    await wrapper.vm.$nextTick()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(mascot.mode).toBe('idle')
    expect(wrapper.find('.mascot-say').exists()).toBe(false)
  })
})

describe('MascotDock warnings', () => {
  beforeEach(() => setActivePinia(createPinia()))

  const drift = {
    id: 'automation-drift',
    title: 'Out of date',
    body: 'Until you sync, this keeps running the setup it was built with.',
    actions: [],
  }

  it('bursts once when a warning is raised, then stops on its own', async () => {
    vi.useFakeTimers()
    const wrapper = mountDock()
    const mascot = useMascotStore()

    mascot.raise(drift)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.mascot').classes()).toContain('mascot--alerting')

    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.mascot').classes()).not.toContain('mascot--alerting')
    // The posture is what survives the motion -- with no marker left on the page it is the
    // only thing a reader who looked away during the hops has to find.
    expect(wrapper.get('.mascot').classes()).toContain('mascot--alerted')
    vi.useRealTimers()
  })

  it('skips the hops under reduced motion and goes straight to the posture', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList)

    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot').classes()).not.toContain('mascot--alerting')
    expect(wrapper.get('.mascot').classes()).toContain('mascot--alerted')
    matchMedia.mockRestore()
  })

  it('announces the warning on hover instead of the shortcut, so the click is not a surprise', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })

    const say = wrapper.get('.mascot-say')
    expect(say.text()).toContain('Out of date')
    expect(say.text()).not.toContain('in a hurry')
  })

  it('routes the click to the warning rather than the launcher while one stands', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('click')

    expect(mascot.popupOpen).toBe(true)
    expect(wrapper.emitted('open')).toBeUndefined()
    expect(wrapper.find('[data-testid="mascot-warning-popup"]').exists()).toBe(true)
  })

  it('gives the launcher back once the warning is dismissed', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()
    await wrapper.get('.mascot-fab').trigger('click')

    await wrapper.get('[data-testid="mascot-warning-dismiss"]').trigger('click')
    await wrapper.get('.mascot-fab').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.get('.mascot').classes()).not.toContain('mascot--alerted')
  })

  it('tells a screen reader the click has changed destination too', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-fab').attributes('aria-label')).toContain('Out of date')
  })

  it('announces the warning to a screen reader, which the jump reaches not at all', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    const live = wrapper.get('[aria-live="polite"]')
    expect(live.text()).toContain('Out of date')
    expect(live.text()).toContain('keeps running the setup')
  })

  it('returns focus to the face on dismiss rather than dropping it on the body', async () => {
    const wrapper = mountDock({ attachTo: document.body })
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()
    await wrapper.get('.mascot-fab').trigger('click')

    await wrapper.get('[data-testid="mascot-warning-dismiss"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(wrapper.get('.mascot-fab').element)
    wrapper.unmount()
  })

  // Per-visit lifetime, delivered by the watcher that already resets tips -- and therefore
  // by no storage at all.
  it('drops warnings when the route changes', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.setProps({ routeKey: '/somewhere/else' })

    expect(mascot.warnings).toEqual([])
    expect(wrapper.get('.mascot').classes()).not.toContain('mascot--alerted')
  })
})
