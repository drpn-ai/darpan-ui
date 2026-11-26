<template>
  <!-- DAR-UI-144. Acknowledge a finding's row: why the problem is known, and whether to raise it again if it is still open.
       Anchored to its trigger and scaling from it; with an acknowledgement in hand it changes that one in place.
       DAR-UI-155: it saves nothing itself. Submit hands the note to the board, which shows it at once and saves behind it. -->
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
      <button type="submit" class="btn-primary audit-ack-submit" data-testid="audit-ack-submit">
        {{ initial ? 'Save' : 'Acknowledge' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppToggleSwitch from '../ui/AppToggleSwitch.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import type { AuditAcknowledgement } from '../../lib/api/auditTypes'

const props = defineProps<{
  /** The row's acknowledgement when changing it; null to acknowledge afresh. */
  initial: AuditAcknowledgement | null
  /** The report's audit.acknowledge.remindDays. */
  remindDays: number
}>()

const emit = defineEmits<{ submit: [note: string, remind: boolean]; close: [] }>()

const note = ref(props.initial?.note ?? '')
// Default on: a "handled" that did not work is the costlier miss.
const remind = ref(props.initial ? props.initial.remindOn != null : true)
const error = ref('')
const remindLabel = computed(() => `Remind me in ${props.remindDays} ${props.remindDays === 1 ? 'day' : 'days'} if still open`)

const root = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

// DAR-UI-152 (Aditi: "typing something doesnt need to be required"): a blank note acknowledges too.
// DAR-UI-155: the two notes the service refuses (its own words) stay here with the text, before anything is shown.
function save(): void {
  const text = note.value.trim()
  if (text.includes('<')) error.value = 'HTML not allowed'
  else if (text.length > 4000) error.value = 'Keep the note under 4,000 characters'
  else emit('submit', text, remind.value)
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

</style>
