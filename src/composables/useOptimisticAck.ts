import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { AuditAcknowledgement } from '../lib/api/auditTypes'
import { auditFacade } from '../lib/api/facade'
import { pendingAcknowledgement } from '../lib/auditColumns'

/**
 * DAR-UI-155 (Aditi: "UI changes should always be immediate.. backend can do its thing"). The open finding's
 * acknowledgement: Acknowledge, change and Reopen show at once and save behind. The saves run one after another, so a
 * Reopen pressed while its acknowledge is still saving lands after it. Only a refusal changes the screen again: the
 * acknowledgement goes back to what the backend holds and the reason is said.
 *
 * Owned by the board, which outlives the finding detail: a save still queued when the person moves on still reports.
 */
export interface OptimisticAckEvents {
  /** Shown at once: the acknowledgement as the person set it (null: reopened), what the backend holds, the save's number. */
  shown: (findingId: string, acknowledgement: AuditAcknowledgement | null, was: AuditAcknowledgement | null, seq: number) => void
  /** The backend saved it. */
  saved: (findingId: string, seq: number) => void
  /** The backend refused it: why, whether it was said here (the finding still open), and what the backend holds. */
  refused: (findingId: string, reason: string, shown: boolean, held: AuditAcknowledgement | null, seq: number) => void
}

export interface OptimisticAckOptions {
  /** The finding open on the page; a new one starts clean. */
  finding: () => string
  /** The row the acknowledgement is on: the finding's own id once it is read, else the finding open on the page. */
  target: () => string
  /**
   * What the reads hold for that row: the finding's once it is read (the backend resolves it for the whole row, and a line
   * that broke after it gives null), else its list row's while it loads. A different word from a reload replaces what was
   * just shown.
   */
  held: () => AuditAcknowledgement | null
  remindDays: () => number
  /** The person signed in: who an acknowledgement is by until the backend's answer replaces it. */
  me: () => { id: string; label: string | null }
  timeZone: () => string | null | undefined
  on: OptimisticAckEvents
}

export interface OptimisticAck {
  acknowledgement: ComputedRef<AuditAcknowledgement | null>
  /** A refusal of the open finding's save, in the backend's words; empty when none. */
  error: Ref<string>
  acknowledge: (note: string, remind: boolean) => void
  change: (note: string, remind: boolean) => void
  reopen: () => void
}

type AckAnswer = { ok?: boolean; errors?: string[]; acknowledgement?: AuditAcknowledgement }

export function useOptimisticAck(options: OptimisticAckOptions): OptimisticAck {
  const override = ref<{ id: string; acknowledgement: AuditAcknowledgement | null } | null>(null)
  const error = ref('')
  const acknowledgement = computed(() =>
    override.value && override.value.id === options.target() ? override.value.acknowledgement : options.held())

  watch(options.finding, () => {
    override.value = null
    error.value = ''
  })
  watch(() => JSON.stringify(options.held()), () => { override.value = null })

  let saves: Promise<void> = Promise.resolve()
  // Which show() is on screen (the ref holds a reactive copy, so the object itself cannot be compared).
  let shownSeq = 0
  // Per finding while its saves are queued: what the backend holds (as of the last answer), and how many are queued.
  // A refusal puts that back, never the value an earlier save in the queue showed but the backend may not have kept.
  const server = new Map<string, AuditAcknowledgement | null>()
  const queued = new Map<string, number>()

  function show(next: AuditAcknowledgement | null, save: (id: string) => Promise<AckAnswer>, refused: string): void {
    const id = options.target()
    if (!queued.get(id)) server.set(id, acknowledgement.value)
    queued.set(id, (queued.get(id) ?? 0) + 1)
    const was = server.get(id) ?? null
    const seq = ++shownSeq
    override.value = { id, acknowledgement: next }
    error.value = ''
    options.on.shown(id, next, was, seq)
    const stillShown = () => shownSeq === seq && override.value?.id === id
    saves = saves.then(async () => {
      try {
        const response = await save(id)
        if (response.ok === false) throw new Error(response.errors?.[0] || refused)
        server.set(id, next === null ? null : (response.acknowledgement ?? next))
        if (stillShown() && response.acknowledgement) override.value = { id, acknowledgement: response.acknowledgement }
        options.on.saved(id, seq)
      } catch (err) {
        const reason = err instanceof Error && err.message ? err.message : refused
        const held = server.get(id) ?? null
        if (stillShown()) override.value = { id, acknowledgement: held }
        // Said here while this finding is open; the page has the mascot say it once the person has moved on.
        const said = options.target() === id
        if (said) error.value = reason
        options.on.refused(id, reason, said, held, seq)
      } finally {
        const left = (queued.get(id) ?? 1) - 1
        if (left > 0) queued.set(id, left)
        else {
          queued.delete(id)
          server.delete(id)
        }
      }
    })
  }

  function pending(note: string, remind: boolean, initial: AuditAcknowledgement | null): AuditAcknowledgement {
    return pendingAcknowledgement({
      note, remind, remindDays: options.remindDays(), me: options.me(), timeZone: options.timeZone(), initial,
    })
  }

  return {
    acknowledgement,
    error,
    acknowledge: (note, remind) => show(pending(note, remind, null),
      (id) => auditFacade.acknowledgeFinding(id, note, remind), 'The note did not save. Try again.'),
    change: (note, remind) => show(pending(note, remind, acknowledgement.value),
      (id) => auditFacade.updateAcknowledgement(id, note, remind), 'The note did not save. Try again.'),
    reopen: () => show(null, (id) => auditFacade.reopenAcknowledgement(id), 'Reopen did not go through. Try again.'),
  }
}
