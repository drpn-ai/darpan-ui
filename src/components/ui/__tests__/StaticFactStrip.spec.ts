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

  // DAR-UI-146. The strip sits in a frame that measures its own width; the container rule that turns it 2 x 2 applies
  // by fact count (four or more at 34rem, three at 25.5rem). Two facts never wrap: each cell already has half the row.
  it('marks which strips may go 2 x 2 in a narrow column, by how many facts they hold', () => {
    const frameOf = (list: StaticFact[]) => {
      const wrapper = mountStrip(list)
      const strip = wrapper.get('[data-testid="strip"]')
      expect(strip.element.parentElement?.classList.contains('static-fact-frame')).toBe(true)
      return strip.classes()
    }
    expect(frameOf(facts)).toContain('static-fact-strip--many')
    expect(frameOf([...facts, { key: 'five', label: 'Five', value: '5' }])).toContain('static-fact-strip--many')
    const three = frameOf(facts.slice(0, 3))
    expect(three).toContain('static-fact-strip--three')
    expect(three).not.toContain('static-fact-strip--many')
    const two = frameOf(facts.slice(0, 2))
    expect(two).not.toContain('static-fact-strip--many')
    expect(two).not.toContain('static-fact-strip--three')
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
