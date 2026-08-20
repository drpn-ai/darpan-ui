import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppToggleSwitch from '../AppToggleSwitch.vue'

function mountSwitch(props: Record<string, unknown> = {}) {
  return mount(AppToggleSwitch, {
    props: {
      modelValue: true,
      label: 'Automation is running',
      ...props,
    },
  })
}

describe('AppToggleSwitch', () => {
  it('exposes the ARIA switch contract rather than a bare button', () => {
    const wrapper = mountSwitch()
    const control = wrapper.get('button')

    expect(control.attributes('role')).toBe('switch')
    expect(control.attributes('aria-checked')).toBe('true')
    expect(control.attributes('aria-label')).toBe('Automation is running')
    // A submit-typed button inside a form would navigate instead of toggling.
    expect(control.attributes('type')).toBe('button')
  })

  it('reports aria-checked false when off', () => {
    const wrapper = mountSwitch({ modelValue: false })
    expect(wrapper.get('button').attributes('aria-checked')).toBe('false')
  })

  it('emits the flipped value on click', async () => {
    const wrapper = mountSwitch({ modelValue: true })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])

    const offWrapper = mountSwitch({ modelValue: false })
    await offWrapper.get('button').trigger('click')
    expect(offWrapper.emitted('update:modelValue')).toEqual([[true]])
  })

  it('carries an on-state class so the track and knob can move', () => {
    expect(mountSwitch({ modelValue: true }).get('button').classes()).toContain('app-toggle-switch--on')
    expect(mountSwitch({ modelValue: false }).get('button').classes()).not.toContain('app-toggle-switch--on')
  })

  it('shows only the glyph naming the current state', () => {
    // The knob occupies one end of the track; the glyph that stays visible is the one in the
    // space the knob vacated, so it always names the state the switch is actually in.
    const on = mountSwitch({ modelValue: true })
    expect(on.get('[data-testid="toggle-glyph-on"]').classes()).toContain('app-toggle-switch-glyph--visible')
    expect(on.get('[data-testid="toggle-glyph-off"]').classes()).not.toContain('app-toggle-switch-glyph--visible')

    const off = mountSwitch({ modelValue: false })
    expect(off.get('[data-testid="toggle-glyph-off"]').classes()).toContain('app-toggle-switch-glyph--visible')
    expect(off.get('[data-testid="toggle-glyph-on"]').classes()).not.toContain('app-toggle-switch-glyph--visible')
  })

  it('uses the power-bar pipe for on and O for off', () => {
    // Pinned deliberately: the on glyph is U+007C, not a capital I. Plex Mono renders capital I
    // with full serifs, which reads as a letter in the track instead of the IEC 60417 power bar.
    const wrapper = mountSwitch()
    expect(wrapper.get('[data-testid="toggle-glyph-on"]').text()).toBe('|')
    expect(wrapper.get('[data-testid="toggle-glyph-off"]').text()).toBe('O')
  })

  it('hides both glyphs from assistive tech, which reads aria-checked instead', () => {
    const wrapper = mountSwitch()
    expect(wrapper.get('[data-testid="toggle-glyph-on"]').attributes('aria-hidden')).toBe('true')
    expect(wrapper.get('[data-testid="toggle-glyph-off"]').attributes('aria-hidden')).toBe('true')
  })

  it('does not emit while disabled', async () => {
    const wrapper = mountSwitch({ disabled: true })
    const control = wrapper.get('button')

    expect(control.attributes('disabled')).toBeDefined()
    await control.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not emit while busy, so an in-flight call cannot be double-submitted', async () => {
    const wrapper = mountSwitch({ busy: true })
    const control = wrapper.get('button')

    expect(control.attributes('disabled')).toBeDefined()
    expect(control.attributes('aria-busy')).toBe('true')
    await control.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('passes a test id through when given one', () => {
    const wrapper = mountSwitch({ testId: 'automation-active-toggle' })
    expect(wrapper.get('button').attributes('data-testid')).toBe('automation-active-toggle')
  })
})
