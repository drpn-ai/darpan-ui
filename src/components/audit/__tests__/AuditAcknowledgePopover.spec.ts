import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { AuditAcknowledgement } from '../../../lib/api/auditTypes'

// DAR-UI-144. Acknowledge a finding's row: a required note and whether to raise it again if it is still open.

const acknowledgeFinding = vi.hoisted(() => vi.fn())
const updateAcknowledgement = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  auditFacade: { acknowledgeFinding, updateAcknowledgement },
}))

import AuditAcknowledgePopover from '../AuditAcknowledgePopover.vue'

const ACK: AuditAcknowledgement = {
  note: 'Refunded',
  by: { id: 'U1', label: 'Sam R.' },
  at: '2026-10-08T09:00:00-07:00',
  remindOn: '2026-10-13',
  reminded: false,
}

function mountPopover(props: Partial<{ initial: AuditAcknowledgement | null; remindDays: number }> = {}) {
  return mount(AuditAcknowledgePopover, { props: { findingId: 'F-1', initial: null, remindDays: 5, ...props } })
}

beforeEach(() => {
  acknowledgeFinding.mockReset()
  updateAcknowledgement.mockReset()
})

describe('AuditAcknowledgePopover', () => {
  it('needs a note, reminds by default and reads the remind days', async () => {
    const w = mountPopover()
    const submit = w.get('[data-testid="audit-ack-submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    await w.get('[data-testid="audit-ack-note-input"]').setValue('   ')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="audit-ack-remind"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-testid="audit-ack-remind-label"]').text()).toBe('Remind me in 5 days if still open')
    expect(mountPopover({ remindDays: 1 }).get('[data-testid="audit-ack-remind-label"]').text()).toBe('Remind me in 1 day if still open')
  })

  it('acknowledges with the note and the remind choice, then says it is saved', async () => {
    acknowledgeFinding.mockResolvedValue({ ok: true, acknowledgement: ACK })
    const w = mountPopover()
    await w.get('[data-testid="audit-ack-note-input"]').setValue('Refunded')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(acknowledgeFinding).toHaveBeenCalledWith('F-1', 'Refunded', true)
    expect(updateAcknowledgement).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toEqual([[ACK]])
  })

  it('changes an acknowledgement in place: the note and toggle start from it', async () => {
    updateAcknowledgement.mockResolvedValue({ ok: true, acknowledgement: { ...ACK, note: 'Refunded twice', remindOn: null } })
    const w = mountPopover({ initial: { ...ACK, remindOn: null } })
    expect((w.get('[data-testid="audit-ack-note-input"]').element as HTMLTextAreaElement).value).toBe('Refunded')
    expect(w.get('[data-testid="audit-ack-remind"]').attributes('aria-checked')).toBe('false')
    await w.get('[data-testid="audit-ack-remind"]').trigger('click')
    await w.get('[data-testid="audit-ack-note-input"]').setValue('Refunded twice')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(updateAcknowledgement).toHaveBeenCalledWith('F-1', 'Refunded twice', true)
    expect(acknowledgeFinding).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('shows the service\'s refusal in the popover and stays open', async () => {
    acknowledgeFinding.mockRejectedValue(new ApiCallError('HTML not allowed'))
    const w = mountPopover()
    await w.get('[data-testid="audit-ack-note-input"]').setValue('<b>done</b>')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="audit-ack-error"]').text()).toBe('HTML not allowed')
    expect(w.emitted('saved')).toBeUndefined()

    acknowledgeFinding.mockResolvedValue({ ok: false, errors: ['Keep the note under 4,000 characters'] })
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="audit-ack-error"]').text()).toBe('Keep the note under 4,000 characters')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('closes on Escape', async () => {
    const w = mountPopover()
    await w.get('[data-testid="audit-ack-popover"]').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('close')).toHaveLength(1)
  })
})
