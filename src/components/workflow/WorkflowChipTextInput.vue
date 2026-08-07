<template>
  <div class="workflow-chip-text">
    <input
      type="text"
      data-testid="workflow-chip-text-input"
      class="wizard-answer-control workflow-chip-text-input"
      :placeholder="placeholder"
      :disabled="disabled"
      v-model="pendingValue"
      @keydown.enter.prevent="commitPendingValue"
      @blur="commitPendingValue"
    />
    <div v-if="modelValue.length" class="workflow-select-chip-row">
      <span
        v-for="value in modelValue"
        :key="value"
        data-testid="workflow-chip-text-chip"
        class="workflow-select-chip"
      >
        {{ value }}
        <button
          type="button"
          data-testid="workflow-chip-text-chip-remove"
          class="workflow-select-chip-remove"
          :aria-label="`Remove ${value}`"
          @click="removeChip(value)"
        >&times;</button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    placeholder: string
    disabled?: boolean
    testId?: string
  }>(),
  {
    disabled: false,
    testId: '',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'update:pending': [value: string]
}>()

const pendingValue = ref('')

// Report uncommitted text upward so a step can tell "typed but not Entered" apart from "empty".
// Without this the wizard's canProceed sees only committed chips, disables its own OK button, and
// the operator cannot submit OR blur their way out of it -- a disabled button receives no mouse
// events and takes no focus, so @blur below never fires either.
watch(pendingValue, (value) => emit('update:pending', value))

function commitPendingValue(): void {
  const trimmed = pendingValue.value.trim()
  if (!trimmed || props.modelValue.includes(trimmed)) return

  emit('update:modelValue', [...props.modelValue, trimmed])
  pendingValue.value = ''
}

function removeChip(value: string): void {
  emit('update:modelValue', props.modelValue.filter((entry) => entry !== value))
}

// Typed text only becomes a chip on Enter, so anything still pending when the step is submitted
// would be silently dropped -- and because the step's canProceed reads the committed chips, the
// operator gets a Next button that does nothing rather than an error. @blur covers the ordinary
// browser sequence (pointerdown blurs the input before the button's click fires); this exposed
// flush is what a parent calls to guarantee it regardless of where focus happens to be.
defineExpose({ commitPendingValue })
</script>

<style scoped>
.workflow-chip-text {
  display: grid;
  gap: var(--space-00);
}

.workflow-chip-text-input {
  width: 100%;
}
</style>
