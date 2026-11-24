import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { AUDIT_LEVELS, LEVEL_LABEL, LEVEL_WORD } from '../../../lib/api/auditTypes'
import AuditPriorityMark from '../AuditPriorityMark.vue'

// DAR-UI-140. The priority mark: monochrome pill, one per level; the level words are shared constants.

describe('AuditPriorityMark', () => {
  it('renders P0 as a filled mark', () => {
    const mark = mount(AuditPriorityMark, { props: { level: 'P0' } }).get('[data-testid="audit-mark"]')
    expect(mark.text()).toBe('P0')
    expect(mark.classes()).toContain('audit-mark--p0')
    expect(mark.attributes('aria-label')).toBe('Priority P0')
  })

  it('renders KNOWN as "Known" with the dashed class', () => {
    const mark = mount(AuditPriorityMark, { props: { level: 'KNOWN' } }).get('[data-testid="audit-mark"]')
    expect(mark.text()).toBe('Known')
    expect(mark.classes()).toContain('audit-mark--known')
    expect(mark.attributes('aria-label')).toBe('Priority Known')
  })

  it('exposes levels in urgency order with their labels and words', () => {
    expect(AUDIT_LEVELS).toEqual(['P0', 'P1', 'P2', 'KNOWN'])
    expect(AUDIT_LEVELS.map((l) => LEVEL_LABEL[l])).toEqual(['P0', 'P1', 'P2', 'Known'])
    expect(AUDIT_LEVELS.map((l) => LEVEL_WORD[l])).toEqual(['today', 'this week', 'later', 'owned'])
  })
})
