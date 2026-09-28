import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import MascotWarningPopup from '../MascotWarningPopup.vue'
import { useMascotStore } from '../../../stores/mascot'

/**
 * The warning's own surface. It used to share the speech bubble, which meant a hint and a
 * condition-you-must-act-on looked identical — the bubble is for labels and explanations, and a
 * warning is neither. This is a dialog, on the CommandPalette's mechanism.
 */
describe('MascotWarningPopup', () => {
  // Teleport puts the dialog on document.body, which outlives the wrapper. Without unmounting,
  // every querySelector below could find a PREVIOUS test's popup — still bound to a dead Pinia,
  // so its buttons do nothing and the failure reads like a broken component.
  let wrapper: ReturnType<typeof mount> | null = null

  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  const drift = {
    id: 'automation-drift',
    title: 'Out of date',
    body: 'Until you sync, this keeps running the setup it was built with.',
    actions: [],
  }

  function mountPopup() {
    wrapper = mount(MascotWarningPopup, { attachTo: document.body })
    return wrapper
  }

  it('renders nothing until the store opens it', async () => {
    const wrapper = mountPopup()
    useMascotStore().raise(drift)
    await wrapper.vm.$nextTick()

    // Standing is not open: the face's posture carries a standing warning.
    expect(document.querySelector('[data-testid="mascot-warning-popup"]')).toBeNull()
  })

  it('shows every standing warning with its title and body once opened', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.raise({ id: 'chat', title: 'Chat space is inactive', body: 'nothing lands there', actions: [] })
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    const popup = document.querySelector('[data-testid="mascot-warning-popup"]')
    expect(popup).not.toBeNull()
    expect(popup?.textContent).toContain('Out of date')
    expect(popup?.textContent).toContain('keeps running the setup')
    // One page really can raise two; open, it must carry both rather than only the first.
    expect(popup?.textContent).toContain('Chat space is inactive')
  })

  it('puts every action in one row with Dismiss, and an acknowledge-only warning adds none', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: vi.fn() }] })
    mascot.raise({ id: 'chat', title: 'Chat space is inactive', body: 'nothing lands there', actions: [] })
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    const row = document.querySelector('[data-testid="mascot-warning-actions"]')
    expect([...(row?.querySelectorAll('button') ?? [])].map((b) => b.textContent?.trim()))
      .toEqual(['Sync', 'Dismiss'])
  })

  it('runs an action when it is pressed', async () => {
    const run = vi.fn()
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run }] })
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    document.querySelector<HTMLButtonElement>('[data-testid="mascot-warning-action-sync"]')?.click()
    expect(run).toHaveBeenCalledOnce()
  })

  it('dismisses on the Dismiss button, clearing the warnings', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    document.querySelector<HTMLButtonElement>('[data-testid="mascot-warning-dismiss"]')?.click()
    await wrapper.vm.$nextTick()

    expect(mascot.hasWarnings).toBe(false)
    expect(document.querySelector('[data-testid="mascot-warning-popup"]')).toBeNull()
  })

  it('closes on Escape without dismissing the warning', async () => {
    // Closing is not acknowledging. Escape puts the dialog away; the condition still stands and
    // the face still holds its posture.
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(mascot.popupOpen).toBe(false)
    expect(mascot.hasWarnings).toBe(true)
  })

  it('returns focus to the face on dismiss rather than dropping it on the body', async () => {
    // A keyboard reader would otherwise be returned to the top of the page having lost their
    // place. Moved here from MascotDock.spec with the button it follows.
    document.body.innerHTML = '<button class="mascot-fab"></button>'
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    document.querySelector<HTMLButtonElement>('[data-testid="mascot-warning-dismiss"]')?.click()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(document.activeElement).toBe(document.querySelector('.mascot-fab'))
  })

  it('focuses Dismiss, never an action', async () => {
    // Sync replaces the automation's whole source setup and must not be one stray Enter away.
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: vi.fn() }] })
    mascot.openWarnings()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(document.activeElement)
      .toBe(document.querySelector('[data-testid="mascot-warning-dismiss"]'))
  })

  it('wears the app-wide popup classes rather than a surface of its own', async () => {
    // Six other surfaces already use .popup-workflow-overlay / .popup-workflow-modal — the
    // exclusion editor on this very board among them. A bespoke overlay is how this ended up
    // reading as a corner bubble instead of a popup.
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    // The shipped contract splits these: the OVERLAY is the dialog and carries the labelling, the
    // inner section wears the panel classes. ConnectionDiagnosticsPopup and the ruleset-manager
    // auth popup are both built this way.
    const overlay = document.querySelector('[data-testid="mascot-warning-popup"]')
    expect(overlay?.classList.contains('popup-workflow-overlay')).toBe(true)
    const panel = overlay?.querySelector('section')
    expect(panel?.classList.contains('popup-workflow-modal')).toBe(true)
    expect(panel?.classList.contains('workflow-panel')).toBe(true)
    // No gap override: the panel's own --space-3 must survive, which is what keeps the title off
    // the body the way every other popup does.
    expect(panel?.getAttribute('style')).toBeNull()
  })

  it('is a labelled dialog', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    const dialog = document.querySelector('[data-testid="mascot-warning-popup"]')
    expect(dialog?.getAttribute('role')).toBe('dialog')
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    // Labelled BY the heading it draws, not by a string assembled beside it — so the accessible
    // name cannot drift from what is on screen.
    const labelledBy = dialog?.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)?.textContent).toContain('Out of date')
  })
})
