import { readFileSync } from 'node:fs'
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
    prompt: 'Sync this automation with its run?',
    body: 'It currently runs the setup it was built with.',
    actions: [],
  }
  const chat = {
    id: 'chat',
    title: 'Chat space is inactive',
    prompt: 'Outlet Ops is no longer active.',
    body: 'This automation’s results will not reach anyone there.',
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

  it('shows the title, the prompt and the detail at their three sizes', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    expect(document.querySelector('[data-testid="mascot-warning"]')?.textContent).toContain('Out of date')
    // The focal line, set by the shell at --popup-workflow-prompt-size.
    expect(document.querySelector('[data-testid="mascot-warning-prompt"]')?.textContent)
      .toContain('Sync this automation with its run?')
    expect(document.querySelector('[data-testid="mascot-warning-detail"]')?.textContent)
      .toContain('runs the setup it was built with')
    // The prompt carries this component's own class, whose global rule consumes the popup token.
    expect(document.querySelector('.mascot-warning-prompt')).not.toBeNull()
  })

  it('shows one warning at a time, with a counter, never two prompts at once', async () => {
    // Two lines at prompt size is two focal lines, which is none.
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.raise(chat)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    expect(document.querySelectorAll('[data-testid="mascot-warning-prompt"]')).toHaveLength(1)
    expect(document.querySelector('[data-testid="mascot-warning-counter"]')?.textContent).toBe('1 of 2')
    const popup = document.querySelector('[data-testid="mascot-warning-popup"]')
    expect(popup?.textContent).toContain('Out of date')
    expect(popup?.textContent).not.toContain('Chat space is inactive')
  })

  it('pages to the next warning', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.raise(chat)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    document.querySelector<HTMLButtonElement>('[data-testid="mascot-warning-next"]')?.click()
    await wrapper.vm.$nextTick()

    expect(document.querySelector('[data-testid="mascot-warning-counter"]')?.textContent).toBe('2 of 2')
    expect(document.querySelector('[data-testid="mascot-warning-prompt"]')?.textContent)
      .toContain('Outlet Ops is no longer active')
  })

  it('hides the counter and the pager when only one stands', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    expect(document.querySelector('[data-testid="mascot-warning-counter"]')).toBeNull()
    expect(document.querySelector('[data-testid="mascot-warning-next"]')).toBeNull()
  })

  it('dismisses only the warning on screen and stays open for the next', async () => {
    // The bug this replaces: one Dismiss silenced every standing condition, including ones the
    // operator had never been shown.
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.raise(chat)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    document.querySelector<HTMLButtonElement>('[data-testid="mascot-warning-dismiss"]')?.click()
    await wrapper.vm.$nextTick()

    expect(mascot.warnings.map((w) => w.id)).toEqual(['chat'])
    expect(mascot.popupOpen).toBe(true)
    expect(document.querySelector('[data-testid="mascot-warning-prompt"]')?.textContent)
      .toContain('Outlet Ops is no longer active')
  })

  it('shows only the current warning’s actions, so a button cannot answer the wrong one', async () => {
    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise({ ...drift, actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: vi.fn() }] })
    mascot.raise(chat)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    const row = document.querySelector('[data-testid="mascot-warning-actions"]')
    expect([...(row?.querySelectorAll('button') ?? [])].map((b) => b.textContent?.trim()))
      .toEqual(['Sync', 'Dismiss', 'Next ›'])

    // Paging to the acknowledge-only warning leaves no Sync behind to press.
    document.querySelector<HTMLButtonElement>('[data-testid="mascot-warning-next"]')?.click()
    await wrapper.vm.$nextTick()
    expect(document.querySelector('[data-testid="mascot-warning-action-sync"]')).toBeNull()
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

  it('styles its own classes globally, because WorkflowStepForm\u2019s are scoped', async () => {
    // The failure this guards: the template carried .wizard-question / .wizard-actions, which live
    // in WorkflowStepForm's <style scoped> block and therefore never reached this component. The
    // names read as reuse, the prompt got no size at all, and the actions sat hard against the copy.
    const styleSource = readFileSync('src/style.css', 'utf8')

    expect(styleSource).toContain('.mascot-warning-prompt {')
    expect(styleSource).toContain('font-size: var(--popup-workflow-prompt-size);')
    expect(styleSource).toContain('.mascot-warning-actions {')
    expect(styleSource).toContain('margin-top: 0.85rem;')

    const wrapper = mountPopup()
    const mascot = useMascotStore()
    mascot.raise(drift)
    mascot.openWarnings()
    await wrapper.vm.$nextTick()

    // And the template must not reach for a scoped class it cannot have.
    const popup = document.querySelector('[data-testid="mascot-warning-popup"]')
    expect(popup?.querySelector('.wizard-question')).toBeNull()
    expect(popup?.querySelector('.wizard-actions')).toBeNull()
    expect(popup?.querySelector('.mascot-warning-prompt')).not.toBeNull()
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
