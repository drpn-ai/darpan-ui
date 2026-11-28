<template>
  <!-- DAR-UI-126. The settings-page title line: the record's name, renamed in place (caret only), and an optional bare
       on/off switch at the line's right end. No pill, no label, no meta line. -->
  <div class="static-record-title">
    <StaticEditableTitle
      ref="nameElement"
      v-explain="explain ?? ''"
      class="static-record-title__name"
      :model-value="modelValue"
      :editable="editable"
      :aria-label="ariaLabel"
      :test-id="testId"
      :fallback="fallback"
      :placeholder="placeholder"
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
      @update:model-value="emit('update:on', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
  /** Muted text while the name is blank: the name still has to be given. */
  placeholder?: string
  /** Glossary key the mascot answers the name with. */
  explain?: string
  /** The switch's accessible name; the switch renders only when this is given. */
  toggleLabel?: string
  on?: boolean
  toggleTestId?: string
  /** Held while the change is in flight (callers pass their saving flag). */
  toggleDisabled?: boolean
}>(), {
  editable: true,
  ariaLabel: 'Name',
  testId: undefined,
  fallback: '',
  placeholder: '',
  explain: undefined,
  toggleLabel: undefined,
  on: false,
  toggleTestId: undefined,
  toggleDisabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  /** Enter or blur on the name. */
  commit: [value: string]
  'update:on': [value: boolean]
}>()

const nameElement = ref<InstanceType<typeof StaticEditableTitle> | null>(null)

/** Puts the caret in the name, e.g. when a save is refused for want of one. */
function focus(): void {
  nameElement.value?.focus()
}

defineExpose({ focus })
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
