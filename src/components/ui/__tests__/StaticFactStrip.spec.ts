import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StaticFactStrip, { type StaticFact } from '../StaticFactStrip.vue'

// DAR-UI-126. The facts strip under a settings page's title.
describe('StaticFactStrip', () => {
  const facts: StaticFact[] = [
    { key: 'schedule', label: 'Schedule', value: 'Daily at 6:00 AM', sub: 'America/Los_Angeles', interactive: true, testId: 'f-schedule', explain: 'auditScheduleTime' },
    { key: 'email', label: 'After each run', value: 'Off', interactive: true, ariaLabel: 'After each run: Off', testId: 'f-email' },
    { key: 'busy', label: 'Posts to', value: 'Gorjana ops', interactive: true, disabled: true, testId: 'f-busy' },
    { key: 'count', label: 'Statements', value: '2 of 3 on', testId: 'f-count' },
  ]

  function mountStrip(list: StaticFact[] = facts) {
    return mount(StaticFactStrip, { props: { facts: list, testId: 'strip' } })
  }

  it('lays out one equal cell per fact: label, value and the dim line', () => {
    const wrapper = mountStrip()
    expect(wrapper.get('[data-testid="strip"]').attributes('style')).toContain('--static-fact-count: 4')
    const cells = wrapper.findAll('.static-fact')
    expect(cells).toHaveLength(4)
    const first = wrapper.get('[data-testid="f-schedule"]')
    expect(first.get('.static-page-summary-label').text()).toBe('Schedule')
    expect(first.get('.static-fact__value').text()).toBe('Daily at 6:00 AM')
    expect(first.get('.static-fact__sub').text()).toBe('America/Los_Angeles')
    expect(wrapper.get('[data-testid="f-email"]').find('.static-fact__sub').exists()).toBe(false)
  })

  it('makes a changeable fact the button itself, with no Change text', async () => {
    const wrapper = mountStrip()
    const cell = wrapper.get('[data-testid="f-schedule"]')
    expect(cell.element.tagName).toBe('BUTTON')
    expect(cell.attributes('aria-label')).toBe('Schedule: Daily at 6:00 AM')
    expect(cell.text()).not.toMatch(/change/i)
    await cell.trigger('click')
    expect(wrapper.emitted('open')).toEqual([['schedule']])
    expect(wrapper.get('[data-testid="f-email"]').attributes('aria-label')).toBe('After each run: Off')
  })

  it('keeps a read-only fact plain text that opens nothing', async () => {
    const wrapper = mountStrip()
    const cell = wrapper.get('[data-testid="f-count"]')
    expect(cell.element.tagName).toBe('DIV')
    expect(cell.attributes('aria-label')).toBeUndefined()
    await cell.trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('holds a disabled fact as a button that does not open', async () => {
    const wrapper = mountStrip()
    const cell = wrapper.get('[data-testid="f-busy"]')
    expect(cell.element.tagName).toBe('BUTTON')
    expect(cell.attributes('disabled')).toBeDefined()
    await cell.trigger('click')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('carries each label\'s mascot answer, and none where none is given', () => {
    const wrapper = mountStrip()
    expect(wrapper.get('[data-testid="f-schedule"] .static-page-summary-label').classes()).toContain('is-explainable')
    expect(wrapper.get('[data-testid="f-count"] .static-page-summary-label').classes()).not.toContain('is-explainable')
  })

  it('sizes its columns to the facts it holds', () => {
    const wrapper = mountStrip(facts.slice(0, 3))
    expect(wrapper.get('[data-testid="strip"]').attributes('style')).toContain('--static-fact-count: 3')
  })
})
