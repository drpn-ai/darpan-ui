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

  // The four states of a standing warning, one test each. The bubble used to speak unprompted;
  // it now waits to be asked, and the jump plus the held posture carry the announcement.
  it('says nothing at idle — the posture carries it', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.mascot-say').exists()).toBe(false)
    expect(wrapper.get('.mascot').classes()).toContain('mascot--alerted')
  })

  it('speaks the warning on hover, without the actions', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.vm.$nextTick()

    const say = wrapper.get('.mascot-say')
    expect(say.text()).toContain('Out of date')
    expect(say.text()).toContain('keeps running the setup')
    // The warning takes the slot the shortcut label would have had.
    expect(say.text()).not.toContain('in a hurry')
    // Hovering asks what it is, not what to do about it.
    expect(wrapper.find('[data-testid="mascot-warning-dismiss"]').exists()).toBe(false)
  })

  it('adds the actions once the face is clicked', async () => {
    const wrapper = mountDock()
    useMascotStore().raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: vi.fn() }] })
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-say').text()).toContain('Out of date')
    expect(wrapper.find('[data-testid="mascot-warning-action-sync"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="mascot-warning-dismiss"]').exists()).toBe(true)
  })

  it('keeps an opened warning up after the pointer leaves', async () => {
    // A popup someone opened deliberately must not evaporate on mouse-out; only Dismiss or a
    // click outside closes it.
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()
    await wrapper.get('.mascot-fab').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('pointerleave', { pointerType: 'mouse' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-say').text()).toContain('Out of date')
  })

  it('keeps the shortcut label once the warning is gone', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()
    mascot.dismiss()
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })

    expect(wrapper.get('.mascot-say').text()).toContain('in a hurry')
  })

  it('does not style a standing warning as a one-line hint label when the face is hovered', async () => {
    // .mascot-say--hint is white-space: nowrap, written for the face's own short label. A warning
    // is prose. Hovering the face sets mode 'hint', and warningSpeaking only steps aside for
    // 'explain' — so the bubble kept rendering the warning while wearing the nowrap label style,
    // and a paragraph was laid out on a single line.
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.vm.$nextTick()

    const say = wrapper.get('.mascot-say')
    expect(say.text()).toContain('Out of date')
    expect(say.classes()).not.toContain('mascot-say--hint')
  })

  // The reason warnings are orthogonal to `mode` rather than a fifth one.
  it('yields the bubble to an explanation somebody asked for', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()

    mascot.explain('differenceCount')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-say').text()).not.toContain('Out of date')
    // ...and the warning is still standing underneath it.
    expect(mascot.hasWarnings).toBe(true)
    expect(wrapper.get('.mascot').classes()).toContain('mascot--alerted')
  })

  it('routes the click to the warning rather than the launcher while one stands', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('click')

    expect(mascot.popupOpen).toBe(true)
    expect(wrapper.emitted('open')).toBeUndefined()
    // The actions join the bubble that was already speaking, rather than opening a second surface.
    expect(wrapper.findAll('.mascot-say')).toHaveLength(1)
    expect(wrapper.find('[data-testid="mascot-warning-dismiss"]').exists()).toBe(true)
  })

  it('shows both warnings and their actions once opened', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: vi.fn() }] })
    mascot.raise({ id: 'chat', title: 'Chat space is inactive', body: 'nothing lands there', actions: [] })
    await wrapper.vm.$nextTick()
    // Closed is now silent entirely — no bubble, the posture carries it.
    expect(wrapper.findAll('[data-testid="mascot-warning"]')).toHaveLength(0)

    // Hovered but not opened, the bubble still carries only the first: "what is it?" is answered
    // by the one that matters most, not by a list.
    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-testid="mascot-warning"]')).toHaveLength(1)

    await wrapper.get('.mascot-fab').trigger('click')

    expect(wrapper.findAll('[data-testid="mascot-warning"]')).toHaveLength(2)
    // Sync and Dismiss are one choice, so they share one row -- and the acknowledge-only
    // warning contributes no button to it.
    const actions = wrapper.get('[data-testid="mascot-warning-actions"]')
    expect(actions.findAll('button').map((b) => b.text())).toEqual(['Sync', 'Dismiss'])
    expect(wrapper.findAll('[data-testid="mascot-warning-actions"]')).toHaveLength(1)
  })

  it('runs the action the page handed over', async () => {
    const run = vi.fn()
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run }] })
    await wrapper.vm.$nextTick()
    await wrapper.get('.mascot-fab').trigger('click')

    await wrapper.get('[data-testid="mascot-warning-action-sync"]').trigger('click')

    expect(run).toHaveBeenCalledTimes(1)
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
