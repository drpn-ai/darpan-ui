import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type { AuditFeedbackNote } from '../../../lib/api/auditTypes'

// DAR-UI-144. The feedback bubble: the team's recent notes on a statement + cause, and a box to send another.

const getFindingFeedback = vi.hoisted(() => vi.fn())
const sendFindingFeedback = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  auditFacade: { getFindingFeedback, sendFindingFeedback },
}))

import AuditFeedbackBubble from '../AuditFeedbackBubble.vue'

const NOTES: AuditFeedbackNote[] = [
  { feedbackId: 'N1', note: 'Older note', sentAt: '2026-11-20T09:00:00Z', by: { id: 'U1', label: 'Sam R.' }, record: '#1001' },
  { feedbackId: 'N2', note: 'Newer note', sentAt: '2026-11-24T09:00:00Z', by: { id: 'U2', label: 'Ana K.' }, record: '#1002' },
]

function mountBubble(count = 2) {
  return mount(AuditFeedbackBubble, { props: { findingId: 'F-1', recordLabel: '#1003', count }, attachTo: document.body })
}

beforeEach(() => {
  getFindingFeedback.mockReset()
  sendFindingFeedback.mockReset()
  getFindingFeedback.mockResolvedValue({ ok: true, notes: NOTES, shownDays: 14 })
})

describe('AuditFeedbackBubble', () => {
  it('shows the count on the badge, hides it at 0 and labels the trigger', () => {
    const w = mountBubble(2)
    expect(w.get('[data-testid="audit-feedback-badge"]').text()).toBe('2')
    expect(w.get('[data-testid="audit-feedback"]').attributes('aria-label')).toBe('Feedback, 2 recent notes')
    expect(w.get('[data-testid="audit-feedback"]').attributes('aria-haspopup')).toBe('dialog')
    const none = mountBubble(0)
    expect(none.find('[data-testid="audit-feedback-badge"]').exists()).toBe(false)
    expect(none.get('[data-testid="audit-feedback"]').attributes('aria-label')).toBe('Feedback')
  })

  it('opens, loads the notes newest first with who, record and day, and no reply or status text', async () => {
    const w = mountBubble()
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    await flushPromises()
    expect(getFindingFeedback).toHaveBeenCalledWith('F-1')
    const items = w.findAll('[data-testid="audit-feedback-note"]')
    expect(items.map((i) => i.text())).toEqual([
      expect.stringContaining('Newer note'),
      expect.stringContaining('Older note'),
    ])
    expect(items[0]!.text()).toContain('Ana K.')
    expect(items[0]!.text()).toContain('#1002')
    expect(items[0]!.text()).toContain('Nov 24')
    const text = w.get('[data-testid="audit-feedback-popover"]').text()
    expect(text).not.toMatch(/reply received|answered|received/i)
    expect(w.get('[data-testid="audit-feedback-heading"]').text()).toBe('Previous notes')
    expect(text).not.toContain('Sent in the last')
    expect(text).toContain('Darpan replies by email')
  })

  // DAR-OPS-029 U05b. sentAt is written in the tenant's zone; the day is the tenant's, as the acknowledgement line reads
  // it, not the browser's (10pm in Los Angeles is the next morning in India).
  it('reads a note\'s day as the tenant wrote it, whatever zone the browser is in', async () => {
    getFindingFeedback.mockResolvedValue({ ok: true, notes: [{ ...NOTES[0]!, sentAt: '2026-11-24T22:00:00-08:00' }], shownDays: 14 })
    const w = mountBubble()
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="audit-feedback-note"]').text()).toContain('Nov 24')
    w.unmount()
  })

  // DAR-OPS-029 U05b. The notes asked for on one finding never land on the next one opened.
  it('drops the notes of a finding the person has moved on from', async () => {
    let answerFirst: (value: unknown) => void = () => {}
    getFindingFeedback.mockReturnValueOnce(new Promise((resolve) => { answerFirst = resolve }))
    getFindingFeedback.mockReturnValueOnce(new Promise(() => {}))
    const w = mountBubble()
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    await w.setProps({ findingId: 'F-2' })
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    answerFirst({ ok: true, notes: NOTES, shownDays: 14 })
    await flushPromises()
    expect(getFindingFeedback).toHaveBeenLastCalledWith('F-2')
    expect(w.findAll('[data-testid="audit-feedback-note"]')).toHaveLength(0)
    w.unmount()
  })

  it('shows no header and no sentence when there are no notes yet', async () => {
    getFindingFeedback.mockResolvedValue({ ok: true, notes: [], shownDays: 14 })
    const w = mountBubble(0)
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="audit-feedback-heading"]').exists()).toBe(false)
    expect(w.get('[data-testid="audit-feedback-popover"]').text()).not.toContain('Sent in the last')
  })

  it('keeps Send disabled while blank, then sends, prepends the note and bumps the badge', async () => {
    sendFindingFeedback.mockResolvedValue({ ok: true, feedback: { feedbackId: 'N3', note: 'Looks wrong', sentAt: '2026-11-25T10:00:00Z', by: { id: 'U3', label: 'Me T.' } } })
    const w = mountBubble()
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    await flushPromises()
    const send = w.get('[data-testid="audit-feedback-send"]')
    expect(send.attributes('disabled')).toBeDefined()
    await w.get('[data-testid="audit-feedback-input"]').setValue('   ')
    expect(send.attributes('disabled')).toBeDefined()
    await w.get('[data-testid="audit-feedback-input"]').setValue('  Looks wrong  ')
    expect(send.attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="audit-feedback-form"]').trigger('submit')
    await flushPromises()
    expect(sendFindingFeedback).toHaveBeenCalledWith('F-1', 'Looks wrong')
    const items = w.findAll('[data-testid="audit-feedback-note"]')
    expect(items).toHaveLength(3)
    expect(items[0]!.text()).toContain('Looks wrong')
    expect(items[0]!.text()).toContain('#1003')
    expect(items[0]!.text()).toContain('Me T.')
    expect(items[0]!.text()).toContain('Nov 25')
    expect(w.get('[data-testid="audit-feedback-badge"]').text()).toBe('3')
    expect((w.get('[data-testid="audit-feedback-input"]').element as HTMLTextAreaElement).value).toBe('')
  })

  it('shows the service error inline and keeps the text', async () => {
    sendFindingFeedback.mockRejectedValue(new Error('HTML not allowed'))
    const w = mountBubble()
    await w.get('[data-testid="audit-feedback"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="audit-feedback-input"]').setValue('a <b>')
    await w.get('[data-testid="audit-feedback-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="audit-feedback-error"]').text()).toContain('HTML not allowed')
    expect((w.get('[data-testid="audit-feedback-input"]').element as HTMLTextAreaElement).value).toBe('a <b>')
  })

  it('closes on Esc and hands focus back to the trigger', async () => {
    const w = mountBubble()
    const trigger = w.get('[data-testid="audit-feedback"]')
    await trigger.trigger('click')
    await flushPromises()
    await w.get('[data-testid="audit-feedback-popover"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(w.find('[data-testid="audit-feedback-popover"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    w.unmount()
  })
})
