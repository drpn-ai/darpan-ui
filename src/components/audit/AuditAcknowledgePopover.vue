<template>
  <!-- DAR-UI-144. Acknowledge a finding's row: why the problem is known, and whether to raise it again if it is still open.
       Anchored to its trigger and scaling from it; with an acknowledgement in hand it changes that one in place. -->
  <div ref="root" class="audit-ack-popover" role="dialog" aria-label="Acknowledgement" data-testid="audit-ack-popover" @keydown.esc.stop="emit('close')">
    <form class="audit-ack-form" @submit.prevent="save">
      <textarea
        ref="input"
        v-model="note"
        class="audit-ack-input"
        rows="2"
        aria-label="Note"
        placeholder="Why it is known"
        data-testid="audit-ack-note-input"
      />
      <div class="audit-ack-remind">
        <span class="audit-ack-remind-label" data-testid="audit-ack-remind-label">{{ remindLabel }}</span>
        <AppToggleSwitch v-model="remind" :label="remindLabel" test-id="audit-ack-remind" />
      </div>
      <InlineValidation v-if="error" tone="error" :message="error" data-testid="audit-ack-error" />
      <button type="submit" class="btn-primary audit-ack-submit" :disabled="!note.trim() || saving" data-testid="audit-ack-submit">
        {{ initial ? 'Save' : 'Acknowledge' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppToggleSwitch from '../ui/AppToggleSwitch.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import { auditFacade } from '../../lib/api/facade'
import type { AuditAcknowledgement } from '../../lib/api/auditTypes'

const props = defineProps<{
  findingId: string
  /** The row's acknowledgement when changing it; null to acknowledge afresh. */
  initial: AuditAcknowledgement | null
  /** The report's audit.acknowledge.remindDays. */
  remindDays: number
}>()

const emit = defineEmits<{ saved: [acknowledgement: AuditAcknowledgement]; close: [] }>()

const note = ref(props.initial?.note ?? '')
// Default on: a "handled" that did not work is the costlier miss.
const remind = ref(props.initial ? props.initial.remindOn != null : true)
const saving = ref(false)
const error = ref('')
const remindLabel = computed(() => `Remind me in ${props.remindDays} ${props.remindDays === 1 ? 'day' : 'days'} if still open`)

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

async function save(): Promise<void> {
  const text = note.value.trim()
  if (!text || saving.value) return
  saving.value = true
  error.value = ''
  try {
    const response = props.initial
      ? await auditFacade.updateAcknowledgement(props.findingId, text, remind.value)
      : await auditFacade.acknowledgeFinding(props.findingId, text, remind.value)
    if (response.ok === false || !response.acknowledgement) {
      error.value = response.errors?.[0] || 'The note did not save. Try again.'
      return
    }
    emit('saved', response.acknowledgement)
  } catch (err) {
    // The service's own words: a note with '<' ("HTML not allowed") or over 4,000 characters.
    error.value = err instanceof Error && err.message ? err.message : 'The note did not save. Try again.'
  } finally {
    saving.value = false
  }
}

// A press outside the popover and its trigger closes it; the trigger toggles it itself.
function onPointerDown(event: PointerEvent): void {
  const anchor = root.value?.parentElement ?? root.value
  if (anchor && event.target instanceof Node && !anchor.contains(event.target)) emit('close')
}
onMounted(() => {
  input.value?.focus()
  document.addEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<style scoped>
.audit-ack-popover {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 6;
  width: min(20rem, calc(100vw - 2 * var(--space-4)));
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  text-align: left;
  /* Scales from its trigger, above and to the right (playbook: Motion). */
  transform-origin: right top;
}

.audit-ack-form {
  display: grid;
  gap: var(--space-2);
}

.audit-ack-input {
  min-height: 3.6rem;
}

.audit-ack-remind {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.audit-ack-remind-label {
  color: var(--text-muted);
  font-size: var(--type-meta-size);
}

.audit-ack-submit {
  justify-self: end;
  margin-top: 0;
}

.audit-ack-submit:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
