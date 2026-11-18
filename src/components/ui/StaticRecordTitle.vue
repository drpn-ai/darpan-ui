<template>
  <!-- DAR-UI-126. The settings-page title line: the record's name, renamed in place (caret only), and an optional bare
       on/off switch at the line's right end. No pill, no label, no meta line. -->
  <div class="static-record-title">
    <StaticEditableTitle
      v-explain="explain ?? ''"
      class="static-record-title__name"
      :model-value="modelValue"
      :editable="editable"
      :aria-label="ariaLabel"
      :test-id="testId"
      :fallback="fallback"
      @update:model-value="emit('update:modelValue', $event)"
      @commit="emit('commit', $event)"
    />
    <slot />
    <AppToggleSwitch
      v-if="toggleLabel"
      class="static-record-title__toggle"
      :model-value="on"
      :label="toggleLabel"
      :test-id="toggleTestId"
      :disabled="toggleDisabled"
      :busy="toggleBusy"
      @update:model-value="emit('update:on', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import AppToggleSwitch from './AppToggleSwitch.vue'
import StaticEditableTitle from './StaticEditableTitle.vue'
import { vExplain } from '../../directives/vExplain'

withDefaults(defineProps<{
  /** The record's name. */
  modelValue: string
  editable?: boolean
  /** The name's accessible label while it is editable, e.g. "Audit name". */
  ariaLabel?: string
  testId?: string
  fallback?: string
  /** Glossary key the mascot answers the name with. */
  explain?: string
  /** The switch's accessible name; the switch renders only when this is given. */
  toggleLabel?: string
  on?: boolean
  toggleTestId?: string
  toggleDisabled?: boolean
  toggleBusy?: boolean
}>(), {
  editable: true,
  ariaLabel: 'Name',
  testId: undefined,
  fallback: '',
  explain: undefined,
  toggleLabel: undefined,
  on: false,
  toggleTestId: undefined,
  toggleDisabled: false,
  toggleBusy: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Enter or blur on the name. */
  commit: [value: string]
  'update:on': [value: boolean]
}>()
</script>

<style scoped>
.static-record-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  min-width: 0;
}

.static-record-title__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.static-record-title__toggle {
  margin-left: auto;
}
</style>
