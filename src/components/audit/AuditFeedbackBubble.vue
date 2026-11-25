<template>
  <!-- DAR-UI-144. Feedback on a finding: the team's recent notes on the same statement and cause, and a box to send another.
       A plain list, no replies and no statuses; Darpan answers by email. Anchored to its trigger and scaling from it. -->
  <span class="audit-feedback-anchor" @keydown.esc="close">
    <button
      ref="trigger"
      type="button"
      class="app-icon-action audit-feedback-trigger"
      :aria-label="triggerLabel"
      :title="triggerLabel"
      data-testid="audit-feedback"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="feedbackIconPath" /></svg>
      <span v-if="shownCount > 0" class="audit-feedback-badge" data-testid="audit-feedback-badge" aria-hidden="true">{{ shownCount }}</span>
    </button>
    <Transition name="audit-feedback-pop">
      <div v-if="open" ref="root" class="audit-feedback-popover" role="dialog" aria-label="Feedback" data-testid="audit-feedback-popover">
        <InlineValidation v-if="loadError" tone="error" :message="loadError" data-testid="audit-feedback-load-error" />
        <p v-if="notes.length" class="audit-feedback-heading" data-testid="audit-feedback-heading">Previous notes</p>
        <ul v-if="notes.length" class="audit-feedback-list" aria-label="Previous notes">
          <li v-for="item in notes" :key="item.feedbackId" class="audit-feedback-note" data-testid="audit-feedback-note">
            <span class="audit-feedback-meta">{{ meta(item) }}</span>
            <span class="audit-feedback-text">{{ item.note }}</span>
          </li>
        </ul>
        <form class="audit-feedback-form" data-testid="audit-feedback-form" @submit.prevent="send">
          <textarea ref="input" v-model="draft" class="audit-feedback-input" rows="2" aria-label="Feedback note" placeholder="What should Darpan know" data-testid="audit-feedback-input" />
          <InlineValidation v-if="error" tone="error" :message="error" data-testid="audit-feedback-error" />
          <div class="audit-feedback-foot">
            <span class="audit-feedback-reply">Darpan replies by email</span>
            <button type="submit" class="btn-primary audit-feedback-send" :disabled="!draft.trim() || sending" data-testid="audit-feedback-send">Send</button>
          </div>
        </form>
      </div>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import { auditFacade } from '../../lib/api/facade'
import { feedbackIconPath } from '../../lib/iconPaths'
import type { AuditFeedbackNote } from '../../lib/api/auditTypes'

const props = defineProps<{
  findingId: string
  /** The finding's record, shown on a note just sent. */
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

const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

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

function day(sentAt: string): string {
  const d = new Date(sentAt)
  return Number.isNaN(d.getTime()) ? sentAt.slice(0, 10) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function meta(item: AuditFeedbackNote): string {
  return [item.by.label || item.by.id, item.record, day(item.sentAt)].filter(Boolean).join(' · ')
}

async function load(): Promise<void> {
  loadError.value = ''
  try {
    const response = await auditFacade.getFindingFeedback(props.findingId)
    if (response.ok === false) {
      loadError.value = response.errors?.[0] || 'The notes did not load.'
      return
    }
    notes.value = [...(response.notes ?? [])].sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  } catch (err) {
    loadError.value = err instanceof Error && err.message ? err.message : 'The notes did not load.'
  }
}

function toggle(): void {
  if (open.value) {
    close()
    return
  }
  open.value = true
  void load()
  void nextTick(() => input.value?.focus())
}

// Focus never falls to the page: a closed popover hands it back to its trigger, unless a press outside sent it elsewhere.
function close(): void {
  if (!open.value) return
  open.value = false
  void nextTick(() => {
    const active = document.activeElement
    if (!active || active === document.body || trigger.value?.parentElement?.contains(active)) trigger.value?.focus()
  })
}

async function send(): Promise<void> {
  const text = draft.value.trim()
  if (!text || sending.value) return
  sending.value = true
  error.value = ''
  try {
    const response = await auditFacade.sendFindingFeedback(props.findingId, text)
    if (response.ok === false) {
      error.value = response.errors?.[0] || 'The note did not send. Try again.'
      return
    }
    const back = response.feedback
    if (!back) {
      error.value = response.errors?.[0] || 'The note did not send. Try again.'
      return
    }
    notes.value = [{ ...back, record: props.recordLabel }, ...notes.value]
    sentCount.value = shownCount.value + 1
    draft.value = ''
  } catch (err) {
    // The service's own words: a note with '<' ("HTML not allowed") or over 4,000 characters.
    error.value = err instanceof Error && err.message ? err.message : 'The note did not send. Try again.'
  } finally {
    sending.value = false
  }
}

function onPointerDown(event: PointerEvent): void {
  const anchor = root.value?.parentElement
  if (open.value && anchor && event.target instanceof Node && !anchor.contains(event.target)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<style scoped>
.audit-feedback-anchor {
  position: relative;
  display: inline-flex;
}

.audit-feedback-trigger {
  position: relative;
}

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

.audit-feedback-popover {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 6;
  display: grid;
  gap: var(--space-2);
  width: min(22rem, calc(100vw - 2 * var(--space-4)));
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  text-align: left;
  /* Scales from its trigger, above and to the right (playbook: Motion). */
  transform-origin: right top;
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

.audit-feedback-send:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.audit-feedback-pop-enter-active {
  transition: opacity var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out);
}

.audit-feedback-pop-leave-active {
  transition: opacity var(--motion-exit) var(--ease-out), transform var(--motion-exit) var(--ease-out);
}

.audit-feedback-pop-enter-from,
.audit-feedback-pop-leave-to {
  opacity: 0;
  transform: scale(var(--motion-enter-scale));
}
</style>
