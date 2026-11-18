import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StaticRecordTitle from '../StaticRecordTitle.vue'

// DAR-UI-126. The settings-page header every record page opens with: the name and a bare switch, then the facts.
describe('StaticRecordTitle', () => {
  it('is the name alone when no switch is asked for', () => {
    const wrapper = mount(StaticRecordTitle, { props: { modelValue: 'Month close', testId: 'name' } })
    expect(wrapper.get('[data-testid="name"]').text()).toBe('Month close')
    expect(wrapper.get('[data-testid="name"]').element.tagName).toBe('H1')
    expect(wrapper.find('[role="switch"]').exists()).toBe(false)
  })

  it('ends the line with a bare switch named only by its aria-label', async () => {
    const wrapper = mount(StaticRecordTitle, {
      props: { modelValue: 'Month close', toggleLabel: 'Daily schedule', on: true, toggleTestId: 'on' },
    })
    const toggle = wrapper.get('[data-testid="on"]')
    expect(toggle.attributes('aria-label')).toBe('Daily schedule')
    expect(toggle.attributes('aria-checked')).toBe('true')
    // No visible words beside it: the line holds the name and the switch, nothing else.
    expect(wrapper.text().replace(/[|O]/g, '').trim()).toBe('Month close')
    await toggle.trigger('click')
    expect(wrapper.emitted('update:on')).toEqual([[false]])
  })

  it('holds the switch still when disabled', async () => {
    const wrapper = mount(StaticRecordTitle, {
      props: { modelValue: 'Month close', toggleLabel: 'Daily schedule', toggleDisabled: true, toggleTestId: 'on' },
    })
    await wrapper.get('[data-testid="on"]').trigger('click')
    expect(wrapper.get('[data-testid="on"]').attributes('disabled')).toBeDefined()
    expect(wrapper.emitted('update:on')).toBeUndefined()
  })

  it('renames in place: typing updates, Enter commits', async () => {
    const wrapper = mount(StaticRecordTitle, { props: { modelValue: 'Month close', testId: 'name' }, attachTo: document.body })
    const title = wrapper.get('[data-testid="name"]')
    expect(title.attributes('contenteditable')).toBe('plaintext-only')
    await title.trigger('focus')
    ;(title.element as HTMLElement).textContent = 'System health'
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['System health']])
    expect(wrapper.emitted('commit')).toEqual([['System health']])
    wrapper.unmount()
  })

  it('is plain text when it cannot be edited', () => {
    const wrapper = mount(StaticRecordTitle, { props: { modelValue: 'Month close', editable: false, testId: 'name' } })
    expect(wrapper.get('[data-testid="name"]').attributes('contenteditable')).toBe('false')
  })

  it('carries the name\'s mascot answer', () => {
    const wrapper = mount(StaticRecordTitle, { props: { modelValue: 'Month close', explain: 'auditName', testId: 'name' } })
    expect(wrapper.get('[data-testid="name"]').classes()).toContain('is-explainable')
  })
})
