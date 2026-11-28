import { mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isTypingTarget, matchChoiceShortcut } from '../../lib/keyboard'
import { useChoiceShortcuts, type ChoiceShortcutOptions } from '../useChoiceShortcuts'

/**
 * DAR-OPS-029 S99-102. One letter-key choice handler for every page with choice cards (RunCreateTypePage,
 * AuditRunStartPage, RunFlowchartStartPage, JsonSchemaWizardPage, ReconciliationCreateFlowPage, TwoFactorEnrolSteps),
 * which each wired the same checks by hand.
 */
const CHOICES = [{ shortcutKey: 'A', value: 'alpha' }, { shortcutKey: 'B', value: 'beta' }]

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('matchChoiceShortcut', () => {
  it('picks a choice by its letter, either case, and nothing for other keys', () => {
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'a' }), CHOICES)).toBe('alpha')
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'B' }), CHOICES)).toBe('beta')
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'c' }), CHOICES)).toBeNull()
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'Enter' }), CHOICES)).toBeNull()
  })

  it('ignores a held, composing or modified key, and Shift where the page blocks it', () => {
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'a', repeat: true }), CHOICES)).toBeNull()
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'a', isComposing: true }), CHOICES)).toBeNull()
    for (const mod of ['altKey', 'ctrlKey', 'metaKey'] as const) {
      expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'a', [mod]: true }), CHOICES)).toBeNull()
    }
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }), CHOICES)).toBe('alpha')
    expect(matchChoiceShortcut(new KeyboardEvent('keydown', { key: 'A', shiftKey: true }), CHOICES, { blockShift: true })).toBeNull()
  })

  it('treats inputs, text areas, selects and editable content as typing', () => {
    for (const tag of ['input', 'textarea', 'select']) expect(isTypingTarget(document.createElement(tag))).toBe(true)
    const editable = document.createElement('div')
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(isTypingTarget(editable)).toBe(true)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('useChoiceShortcuts', () => {
  const mounted: Array<{ unmount: () => void }> = []
  afterEach(() => {
    mounted.splice(0).forEach((w) => w.unmount())
    document.body.replaceChildren()
  })

  function host(options: Partial<ChoiceShortcutOptions<string>> & Pick<ChoiceShortcutOptions<string>, 'choose'>) {
    const wrapper = mount(defineComponent({
      setup() {
        useChoiceShortcuts({ active: () => true, choices: () => CHOICES, ...options })
        return () => h('div')
      },
    }), { attachTo: document.body })
    mounted.push(wrapper)
    return wrapper
  }

  it('chooses on a letter while active, and stops listening once unmounted', () => {
    const choose = vi.fn()
    const wrapper = host({ choose })
    expect(press('b').defaultPrevented).toBe(true)
    expect(choose).toHaveBeenCalledWith('beta')
    wrapper.unmount()
    mounted.splice(0)
    press('a')
    expect(choose).toHaveBeenCalledTimes(1)
  })

  it('does nothing while inactive or while typing (the command palette keeps its letters)', () => {
    const active = ref(false)
    const choose = vi.fn()
    host({ choose, active: () => active.value })
    press('a')
    active.value = true
    const input = document.createElement('input')
    document.body.appendChild(input)
    press('a', {}, input)
    expect(choose).not.toHaveBeenCalled()
  })

  it('runs the step on Enter outside any form, and leaves Enter inside a form to the form', () => {
    const onEnterOutsideForm = vi.fn()
    host({ choose: vi.fn(), onEnterOutsideForm })
    const form = document.createElement('form')
    const button = document.createElement('button')
    form.appendChild(button)
    document.body.appendChild(form)
    press('Enter', {}, button)
    expect(onEnterOutsideForm).not.toHaveBeenCalled()
    expect(press('Enter').defaultPrevented).toBe(true)
    expect(onEnterOutsideForm).toHaveBeenCalledTimes(1)
  })

  it('without an Enter action, Enter is left alone', () => {
    const choose = vi.fn()
    host({ choose })
    expect(press('Enter').defaultPrevented).toBe(false)
    expect(choose).not.toHaveBeenCalled()
  })
})
