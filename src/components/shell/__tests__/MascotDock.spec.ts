import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

    // DAR-UI-056: the character is Tara; the search she opens is still Ask Darpan.
    expect(fab.attributes('aria-label')).toMatch(/^Tara: /)
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

  // DAR-UI-119: the bow names the tenant; clicking it goes straight to switching.
  it('wears the active tenant and sends a bow click to switching, even with a warning standing', async () => {
    const wrapper = mountDock({ props: { tenantLabel: 'Acme Retail' } })
    const mascot = useMascotStore()
    mascot.raise({ id: 'w1', title: 'Two runs failed', prompt: 'Two runs failed', body: 'Overnight.', actions: [] })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-bow').text()).toContain('Acme Retail')
    await wrapper.get('.mascot-bow-knot').trigger('click')

    expect(wrapper.emitted('switch-tenant')).toHaveLength(1)
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('names the tenant to a screen reader, who cannot see the bow', () => {
    const wrapper = mountDock({ props: { tenantLabel: 'Acme Retail' } })

    expect(wrapper.get('.mascot-fab').attributes('aria-label')).toContain('Acme Retail')
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
    expect(say.text()).toContain('it is not a record count')
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
  afterEach(() => { document.body.innerHTML = '' })

  const drift = {
    id: 'automation-drift',
    title: 'Out of date',
    prompt: 'Sync this automation with its run?',
    body: 'It currently runs the setup it was built with.',
    actions: [],
  }

  /* The dock's whole job for a warning is now: burst, hold the posture, name it in one line on
     hover, and open the dialog on click. What is INSIDE the dialog — the prose, the actions,
     Dismiss, focus, Escape — belongs to MascotWarningPopup.spec, because that is where it lives. */

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
    // The posture is what survives the motion -- with nothing on screen it is the only thing a
    // reader who looked away during the hops has to find.
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

  it('says nothing at idle — the posture carries it', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.mascot-say').exists()).toBe(false)
    expect(document.querySelector('[data-testid="mascot-warning-popup"]')).toBeNull()
    expect(wrapper.get('.mascot').classes()).toContain('mascot--alerted')
  })

  it('names the warning in one line on hover, and sends you to the dialog for the rest', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.vm.$nextTick()

    const say = wrapper.get('.mascot-say')
    // A label, which is what this bubble is for. The prose lives in the dialog.
    expect(say.text()).toBe('Out of date — click to see')
    expect(say.text()).not.toContain('keeps running the setup')
    // It IS a one-liner now, so the nowrap label styling is correct again — the gate that used to
    // withhold it went away with the warning that made it necessary.
    expect(say.classes()).toContain('mascot-say--hint')
  })

  it('gives the shortcut label back on hover once nothing stands', async () => {
    const wrapper = mountDock()
    await wrapper.get('.mascot-fab').trigger('pointerenter', { pointerType: 'mouse' })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('.mascot-say').text()).toContain('in a hurry')
  })

  it('routes the click to the dialog rather than the launcher while one stands', async () => {
    const wrapper = mountDock({ attachTo: document.body })
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()

    await wrapper.get('.mascot-fab').trigger('click')
    await wrapper.vm.$nextTick()

    expect(mascot.popupOpen).toBe(true)
    expect(wrapper.emitted('open')).toBeUndefined()
    // What opens is the dialog, not more bubble.
    expect(document.querySelector('[data-testid="mascot-warning-popup"]')).not.toBeNull()
    wrapper.unmount()
  })

  it('gives the launcher back once the warning is dismissed', async () => {
    const wrapper = mountDock()
    const mascot = useMascotStore()
    mascot.raise(drift)
    await wrapper.vm.$nextTick()
    await wrapper.get('.mascot-fab').trigger('click')

    mascot.dismiss()
    await wrapper.vm.$nextTick()
    await wrapper.get('.mascot-fab').trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.get('.mascot').classes()).not.toContain('mascot--alerted')
  })

  it('announces the warning to a screen reader without waiting for a hover', async () => {
    const wrapper = mountDock()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    // Nothing is drawn at idle, so the live region is the only thing carrying it for a reader
    // who cannot see the posture.
    expect(wrapper.get('p.sr-only[aria-live="polite"]').text()).toContain('Out of date')
  })
})

// DAR-UI-131: Tara can be carried anywhere; the spot lasts only as long as the page.
describe('MascotDock dragging', () => {
  const FACE = { left: 900, top: 650, width: 98, height: 98, right: 998, bottom: 748, x: 900, y: 650 }
  // jsdom's viewport: 1024 x 768.
  const press = (extra: Record<string, unknown> = {}) => ({ pointerId: 1, pointerType: 'mouse', button: 0, ...extra })

  beforeEach(() => {
    setActivePinia(createPinia())
    window.sessionStorage.clear()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ ...FACE, toJSON: () => FACE } as DOMRect)
  })

  afterEach(() => vi.restoreAllMocks())

  it('starts in the corner with no inline position', () => {
    const wrapper = mountDock()

    expect(wrapper.get('.mascot-dock').classes()).not.toContain('mascot-dock--moved')
    expect(wrapper.get('.mascot-dock').attributes('style')).toBeUndefined()
  })

  it('moves where she is dropped, stores nothing, and the drop does not open the launcher', async () => {
    const wrapper = mountDock()
    const fab = wrapper.get('.mascot-fab')

    await fab.trigger('pointerdown', press({ clientX: 949, clientY: 699 }))
    await fab.trigger('pointermove', press({ clientX: 300, clientY: 300 }))
    await fab.trigger('pointerup', press({ clientX: 300, clientY: 300 }))
    await fab.trigger('click')

    expect(wrapper.emitted('open')).toBeUndefined()
    const dock = wrapper.get('.mascot-dock')
    // Centre went 949,699 -> 300,300: the left half, so anchored left with the bubble on her right.
    expect(dock.classes()).toEqual(expect.arrayContaining(['mascot-dock--moved', 'mascot-dock--flipped']))
    expect(dock.attributes('style')).toContain('left: 251px')
    expect(dock.attributes('style')).toContain('bottom: 419px')
    // Nothing outlives the page: a reload, hard or soft, is how she goes home.
    expect(window.sessionStorage.length).toBe(0)
  })

  it('captures the pointer on the press, so a flick whose first move is already off her face still carries her', async () => {
    const wrapper = mountDock()
    const fab = wrapper.get('.mascot-fab')
    const capture = vi.fn()
    ;(fab.element as HTMLElement).setPointerCapture = capture

    await fab.trigger('pointerdown', press({ clientX: 949, clientY: 699 }))

    expect(capture).toHaveBeenCalledWith(1)
  })

  it('treats a wobble under the threshold as a click', async () => {
    const wrapper = mountDock()
    const fab = wrapper.get('.mascot-fab')

    await fab.trigger('pointerdown', press({ clientX: 949, clientY: 699 }))
    await fab.trigger('pointermove', press({ clientX: 952, clientY: 701 }))
    await fab.trigger('pointerup', press({ clientX: 952, clientY: 701 }))
    await fab.trigger('click')

    expect(wrapper.emitted('open')).toHaveLength(1)
    expect(wrapper.get('.mascot-dock').classes()).not.toContain('mascot-dock--moved')
  })

  it('is back in the corner after a reload', async () => {
    const first = mountDock()
    const fab = first.get('.mascot-fab')
    await fab.trigger('pointerdown', press({ clientX: 949, clientY: 699 }))
    await fab.trigger('pointermove', press({ clientX: 300, clientY: 300 }))
    await fab.trigger('pointerup', press({ clientX: 300, clientY: 300 }))
    first.unmount()

    const reloaded = mountDock()
    await reloaded.vm.$nextTick()

    expect(reloaded.get('.mascot-dock').classes()).not.toContain('mascot-dock--moved')
    expect(reloaded.get('.mascot-dock').attributes('style')).toBeUndefined()
  })
})
