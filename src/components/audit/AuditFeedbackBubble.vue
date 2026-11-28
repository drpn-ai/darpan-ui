<template>
  <!-- DAR-UI-144. Feedback on a finding: the team's recent notes on the same statement and cause, and a box to send another.
       A plain list, no replies and no statuses; Darpan answers by email. -->
  <AuditPopover
    :open="open"
    :label="triggerLabel"
    icon="feedback"
    test-id="audit-feedback"
    dialog-label="Feedback"
    dialog-test-id="audit-feedback-popover"
    width="22rem"
    @toggle="toggle"
    @close="open = false"
  >
    <template #badge>
      <span v-if="shownCount > 0" class="audit-feedback-badge" data-testid="audit-feedback-badge" aria-hidden="true">{{ shownCount }}</span>
    </template>
    <InlineValidation v-if="loadError" tone="error" :message="loadError" data-testid="audit-feedback-load-error" />
    <p v-if="notes.length" class="audit-feedback-heading" data-testid="audit-feedback-heading">Previous notes</p>
    <ul v-if="notes.length" class="audit-feedback-list" aria-label="Previous notes">
      <li v-for="item in notes" :key="item.feedbackId" class="audit-feedback-note" data-testid="audit-feedback-note">
        <span class="audit-feedback-meta">{{ meta(item) }}</span>
        <span class="audit-feedback-text">{{ item.note }}</span>
      </li>
    </ul>
    <form class="audit-feedback-form" data-testid="audit-feedback-form" @submit.prevent="send">
      <textarea v-model="draft" class="audit-feedback-input" rows="2" aria-label="Feedback note" placeholder="What should Darpan know" data-testid="audit-feedback-input" />
      <InlineValidation v-if="error" tone="error" :message="error" data-testid="audit-feedback-error" />
      <div class="audit-feedback-foot">
        <span class="audit-feedback-reply">Darpan replies by email</span>
        <button type="submit" class="btn-primary audit-feedback-send" :disabled="!draft.trim() || sending" data-testid="audit-feedback-send">Send</button>
      </div>
    </form>
  </AuditPopover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import AuditPopover from './AuditPopover.vue'
import { auditFacade } from '../../lib/api/facade'
import type { AuditFeedbackNote } from '../../lib/api/auditTypes'
import { shortDate } from '../../lib/auditReport'

const props = defineProps<{
  findingId: string
  /**
   * S99-104: the record a just-sent note shows only when the reply names none (a server from before darpan d5ceeff1).
   * Delete it, and useFindingDetail's feedbackRecord, once every instance runs d5ceeff1.
   */
  recordLabel: string | null
  /** finding.feedback.recentCount. */
  count: number
}>()

const open = ref(false)
const notes = ref<AuditFeedbackNote[]>([])
const sentCount = ref<number | null>(null)
const draft = ref('')
const sending = ref(false)
const error = ref('')
const loadError = ref('')

const shownCount = computed(() => sentCount.value ?? props.count)
const triggerLabel = computed(() => shownCount.value > 0 ? `Feedback, ${shownCount.value} recent ${shownCount.value === 1 ? 'note' : 'notes'}` : 'Feedback')

// A fresh count from a reload wins over the local bump.
watch(() => props.count, () => { sentCount.value = null })

// A new finding starts over.
watch(() => props.findingId, () => {
  open.value = false
  notes.value = []
  sentCount.value = null
  draft.value = ''
  error.value = ''
  loadError.value = ''
})

// sentAt is written in the tenant's zone: its day is the tenant's, as the acknowledgement line reads it, not the browser's.
function meta(item: AuditFeedbackNote): string {
  return [item.by.label || item.by.id, item.record, shortDate(item.sentAt.slice(0, 10))].filter(Boolean).join(' · ')
}

// An answer for a finding the person has moved on from is dropped: it is not this finding's.
async function load(): Promise<void> {
  const findingId = props.findingId
  loadError.value = ''
  try {
    const response = await auditFacade.getFindingFeedback(findingId)
    if (findingId !== props.findingId) return
    if (response.ok === false) {
      loadError.value = response.errors?.[0] || 'The notes did not load.'
      return
    }
    notes.value = [...(response.notes ?? [])].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  } catch (err) {
    if (findingId !== props.findingId) return
    loadError.value = err instanceof Error && err.message ? err.message : 'The notes did not load.'
  }
}

function toggle(): void {
  open.value = !open.value
  if (open.value) void load()
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || sending.value) return
  const findingId = props.findingId
  sending.value = true
  error.value = ''
  try {
    const response = await auditFacade.sendFindingFeedback(findingId, text)
    if (findingId !== props.findingId) return
    if (response.ok === false) {
      error.value = response.errors?.[0] || 'The note did not send. Try again.'
      return
    }
    const back = response.feedback
    if (!back) {
      error.value = response.errors?.[0] || 'The note did not send. Try again.'
      return
    }
    notes.value = [{ ...back, record: back.record ?? props.recordLabel }, ...notes.value]
    sentCount.value = shownCount.value + 1
    draft.value = ''
  } catch (err) {
    if (findingId !== props.findingId) return
    // The service's own words: a note with '<' ("HTML not allowed") or over 4,000 characters.
    error.value = err instanceof Error && err.message ? err.message : 'The note did not send. Try again.'
  } finally {
    sending.value = false
  }
}

</script>

<style scoped>
.audit-feedback-badge {
  position: absolute;
  top: -0.2rem;
  right: -0.2rem;
  min-width: 1rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-md);
  background: var(--accent, var(--text));
  color: var(--surface);
  font-size: var(--type-meta-size);
  line-height: 1rem;
  text-align: center;
}

.audit-feedback-heading,
.audit-feedback-reply,
.audit-feedback-meta {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--type-meta-size);
}

.audit-feedback-list {
  display: grid;
  gap: var(--space-2);
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.audit-feedback-note {
  display: grid;
  gap: var(--space-1);
}

.audit-feedback-text {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.audit-feedback-form {
  display: grid;
  gap: var(--space-2);
}

.audit-feedback-input {
  min-height: 3.6rem;
}

.audit-feedback-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.audit-feedback-send {
  margin-top: 0;
}
</style>
