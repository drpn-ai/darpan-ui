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
import { ref } from 'vue'

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
}>()

const pendingValue = ref('')

function commitPendingValue(): void {
  const trimmed = pendingValue.value.trim()
  if (!trimmed || props.modelValue.includes(trimmed)) return

  emit('update:modelValue', [...props.modelValue, trimmed])
  pendingValue.value = ''
}

function removeChip(value: string): void {
  emit('update:modelValue', props.modelValue.filter((entry) => entry !== value))
}
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
