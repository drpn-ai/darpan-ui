import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))

import RunCreateTypePage from '../RunCreateTypePage.vue'

beforeEach(() => push.mockReset())
// The page listens on window; a wrapper left mounted would answer the next test's key presses.
enableAutoUnmount(afterEach)

describe('RunCreateTypePage', () => {
  it('asks one thing — which kind of run — with Sync first', async () => {
    const w = mount(RunCreateTypePage)
    await flushPromises()
    expect(w.text()).toContain('What kind of run?')
    expect(w.get('[data-testid="run-type-choice-sync"]').text()).toContain('Sync')
    expect(w.get('[data-testid="run-type-choice-lifecycle"]').text()).toContain('Lifecycle')
  })

  it('hands a Sync run to the existing create flow', async () => {
    const w = mount(RunCreateTypePage)
    await w.get('[data-testid="run-type-choice-sync"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-create' })
  })

  it('hands a Lifecycle run to the flowchart create flow', async () => {
    const w = mount(RunCreateTypePage)
    await w.get('[data-testid="run-type-choice-lifecycle"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart-create' })
  })

  // DAR-UI-055: the cards show A / B; the keys must do what a click does.
  function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  }

  // DAR-UI-078: an audit is made in the app too.
  it('hands an Audit to the audit create flow, on C as on a click', async () => {
    const w = mount(RunCreateTypePage, { attachTo: document.body })
    expect(w.get('[data-testid="run-type-choice-audit"]').text()).toContain('Audit')
    await w.get('[data-testid="run-type-choice-audit"]').trigger('click')
    expect(push).toHaveBeenLastCalledWith({ name: 'audit-create' })
    push.mockReset()
    press('c')
    expect(push).toHaveBeenLastCalledWith({ name: 'audit-create' })
    w.unmount()
  })

  it('opens Sync on A and Lifecycle on B, either case', async () => {
    const w = mount(RunCreateTypePage, { attachTo: document.body })
    press('a')
    expect(push).toHaveBeenLastCalledWith({ name: 'reconciliation-create' })
    press('B')
    expect(push).toHaveBeenLastCalledWith({ name: 'reconciliation-run-flowchart-create' })
    w.unmount()
  })

  it('ignores the keys with a modifier, while typing in a field, and after leaving the page', async () => {
    const w = mount(RunCreateTypePage, { attachTo: document.body })
    press('a', { metaKey: true })
    press('a', { ctrlKey: true })
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('a', {}, input)
    input.remove()
    w.unmount()
    press('a')
    expect(push).not.toHaveBeenCalled()
  })

  it('goes home on back', async () => {
    const w = mount(RunCreateTypePage)
    await w.findComponent({ name: 'WorkflowStepForm' }).vm.$emit('back')
    expect(push).toHaveBeenCalledWith({ name: 'hub' })
  })
})
