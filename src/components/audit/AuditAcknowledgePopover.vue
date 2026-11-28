<template>
  <!-- DAR-UI-144. Acknowledge a finding's row: why the problem is known, and whether to raise it again if it is still open.
       The Acknowledge icon, or with an acknowledgement in hand the pencil that changes that one in place.
       DAR-UI-155: it saves nothing itself. Submit hands the note to the board, which shows it at once and saves behind it. -->
  <AuditPopover
    ref="popover"
    :open="open"
    :label="initial ? 'Edit acknowledgement' : 'Acknowledge'"
    :icon="initial ? 'edit' : 'acknowledge'"
    :test-id="initial ? 'audit-ack-edit' : 'audit-acknowledge'"
    dialog-label="Acknowledgement"
    dialog-test-id="audit-ack-popover"
    @toggle="emit('toggle')"
    @close="emit('close')"
  >
    <form class="audit-ack-form" @submit.prevent="save">
      <textarea
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
  </AuditPopover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppToggleSwitch from '../ui/AppToggleSwitch.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import AuditPopover from './AuditPopover.vue'
import type { AuditAcknowledgement } from '../../lib/api/auditTypes'

const props = defineProps<{
  /** The row's acknowledgement when changing it; null to acknowledge afresh. */
  initial: AuditAcknowledgement | null
  /** The report's audit.acknowledge.remindDays. */
  remindDays: number
  open: boolean
}>()

const emit = defineEmits<{ submit: [note: string, remind: boolean]; toggle: []; close: [] }>()

const note = ref('')
const remind = ref(true)
const error = ref('')
const remindLabel = computed(() => `Remind me in ${props.remindDays} ${props.remindDays === 1 ? 'day' : 'days'} if still open`)

// Each opening starts from the acknowledgement as it stands. Default on: a "handled" that did not work is the costlier miss.
watch(() => props.open, (open) => {
  if (!open) return
  note.value = props.initial?.note ?? ''
  remind.value = props.initial ? props.initial.remindOn != null : true
  error.value = ''
}, { immediate: true })

// DAR-UI-152 (Aditi: "typing something doesnt need to be required"): a blank note acknowledges too.
// DAR-UI-155: the two notes the service refuses (its own words) stay here with the text, before anything is shown.
function save(): void {
  const text = note.value.trim()
  if (text.includes('<')) error.value = 'HTML not allowed'
  else if (text.length > 4000) error.value = 'Keep the note under 4,000 characters'
  else emit('submit', text, remind.value)
}

const popover = ref<InstanceType<typeof AuditPopover> | null>(null)
defineExpose({ focus: () => popover.value?.focus() })
</script>

<style scoped>
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
