import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { AuditAcknowledgement } from '../../../lib/api/auditTypes'

// DAR-UI-144. Acknowledge a finding's row: a note and whether to raise it again if it is still open.
// DAR-UI-155: the popover saves nothing. Submit hands the note to the board, which shows it at once and saves behind it.

import AuditAcknowledgePopover from '../AuditAcknowledgePopover.vue'

const ACK: AuditAcknowledgement = {
  note: 'Refunded',
  by: { id: 'U1', label: 'Sam R.' },
  at: '2026-10-08T09:00:00-07:00',
  remindOn: '2026-10-13',
  reminded: false,
}

function mountPopover(props: Partial<{ initial: AuditAcknowledgement | null; remindDays: number; open: boolean }> = {}) {
  const testId = props.initial ? 'audit-ack-edit' : 'audit-acknowledge'
  return mount(AuditAcknowledgePopover, { props: { initial: null, remindDays: 5, open: true, testId, ...props } })
}

describe('AuditAcknowledgePopover', () => {
  // DAR-UI-152 (Aditi: "typing something doesnt need to be required").
  it('submits with no note, reminds by default and reads the remind days', async () => {
    const w = mountPopover()
    const submit = w.get('[data-testid="audit-ack-submit"]')
    expect(submit.attributes('disabled')).toBeUndefined()
    await w.get('[data-testid="audit-ack-note-input"]').setValue('   ')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toEqual([['', true]])
    expect(w.get('[data-testid="audit-ack-remind"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-testid="audit-ack-remind-label"]').text()).toBe('Remind me in 5 days if still open')
    expect(mountPopover({ remindDays: 1 }).get('[data-testid="audit-ack-remind-label"]').text()).toBe('Remind me in 1 day if still open')
  })

  // DAR-UI-155. Submitting is synchronous: nothing waits on the backend here.
  it('submits the note and the remind choice at once, with the button never held', async () => {
    const w = mountPopover()
    await w.get('[data-testid="audit-ack-note-input"]').setValue(' Refunded ')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toEqual([['Refunded', true]])
    expect(w.get('[data-testid="audit-ack-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('changes an acknowledgement in place: the note and toggle start from it', async () => {
    const w = mountPopover({ initial: { ...ACK, remindOn: null } })
    expect((w.get('[data-testid="audit-ack-note-input"]').element as HTMLTextAreaElement).value).toBe('Refunded')
    expect(w.get('[data-testid="audit-ack-remind"]').attributes('aria-checked')).toBe('false')
    expect(w.get('[data-testid="audit-ack-submit"]').text()).toBe('Save')
    await w.get('[data-testid="audit-ack-remind"]').trigger('click')
    await w.get('[data-testid="audit-ack-note-input"]').setValue('Refunded twice')
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toEqual([['Refunded twice', true]])
  })

  // The two notes the service refuses stay in the popover with the text typed, so nothing is shown and then taken back.
  it('keeps a note the service would refuse, with its words, and submits nothing', async () => {
    const w = mountPopover()
    await w.get('[data-testid="audit-ack-note-input"]').setValue('<b>done</b>')
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid="audit-ack-error"]').text()).toBe('HTML not allowed')
    await w.get('[data-testid="audit-ack-note-input"]').setValue('x'.repeat(4001))
    await w.get('form').trigger('submit')
    expect(w.get('[data-testid="audit-ack-error"]').text()).toBe('Keep the note under 4,000 characters')
    expect(w.emitted('submit')).toBeUndefined()
    await w.get('[data-testid="audit-ack-note-input"]').setValue('x'.repeat(4000))
    await w.get('form').trigger('submit')
    expect(w.emitted('submit')).toHaveLength(1)
  })

  it('closes on Escape', async () => {
    const w = mountPopover()
    await w.get('[data-testid="audit-ack-popover"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(1)
  })

  // DAR-OPS-029 U05b. The trigger is the Acknowledge icon, or the pencil with an acknowledgement in hand; closed, it keeps
  // nothing open and leaves Esc to the page.
  it('is the icon or the pencil, and a closed one leaves Esc to the page', async () => {
    const closed = mountPopover({ open: false })
    expect(closed.find('[data-testid="audit-ack-popover"]').exists()).toBe(false)
    expect(closed.get('[data-testid="audit-acknowledge"]').attributes('aria-expanded')).toBe('false')
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    closed.get('[data-testid="audit-acknowledge"]').element.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(false)
    expect(closed.emitted('close')).toBeUndefined()
    await closed.get('[data-testid="audit-acknowledge"]').trigger('click')
    expect(closed.emitted('toggle')).toHaveLength(1)

    const pencil = mountPopover({ initial: ACK, open: false })
    expect(pencil.get('[data-testid="audit-ack-edit"]').attributes('aria-label')).toBe('Edit acknowledgement')
  })

  // Each opening starts from the acknowledgement as it stands, not from what was typed and closed last time.
  it('starts each opening afresh', async () => {
    const w = mountPopover({ initial: ACK })
    await w.get('[data-testid="audit-ack-note-input"]').setValue('half typed')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    expect((w.get('[data-testid="audit-ack-note-input"]').element as HTMLTextAreaElement).value).toBe('Refunded')
  })
})
