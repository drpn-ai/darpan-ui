<template>
  <div
    ref="root"
    :class="['workflow-select', { 'workflow-select--open': isOpen }]"
    :data-enter-submit="isOpen ? 'off' : undefined"
  >
    <button
      ref="trigger"
      type="button"
      :class="[
        'wizard-answer-control',
        'workflow-select-trigger',
        { empty: isEmpty, 'workflow-select-trigger--open': isOpen, 'workflow-select-trigger--disabled': disabled },
      ]"
      :disabled="disabled"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      :data-testid="testId || 'workflow-select-trigger'"
      @mousedown.stop
      @click.stop="toggleMenu"
      @keydown.enter.prevent="handleTriggerEnter"
      @keydown.space.prevent="toggleMenu"
      @keydown.down.prevent="openMenuAndFocus('selected')"
      @keydown.up.prevent="openMenuAndFocus('last')"
      @keydown.escape.prevent="closeMenu"
    >
      <span class="workflow-select-trigger-label">{{ selectedLabel || placeholder }}</span>
      <span class="workflow-select-trigger-icon" aria-hidden="true">
        <svg viewBox="0 0 12 8" focusable="false">
          <polyline points="1 1 6 7 11 1" />
        </svg>
      </span>
    </button>

    <div v-if="multiple && modelValueArray.length" class="workflow-select-chip-row">
      <span
        v-for="value in modelValueArray"
        :key="value"
        class="workflow-select-chip"
        data-testid="workflow-select-chip"
      >
        {{ labelForValue(value) }}
        <button
          type="button"
          data-testid="workflow-select-chip-remove"
          class="workflow-select-chip-remove"
          :aria-label="`Remove ${labelForValue(value)}`"
          @click="removeChip(value)"
        >&times;</button>
      </span>
    </div>

    <div
      v-if="isOpen"
      :id="listboxId"
      class="workflow-select-menu"
      role="listbox"
      @mousedown.stop
    >
      <button
        v-for="(option, index) in options"
        :key="option.value"
        :ref="setOptionRef"
        type="button"
        class="workflow-select-option"
        :class="{ 'workflow-select-option--selected': isOptionSelected(option.value) }"
        role="option"
        :aria-selected="isOptionSelected(option.value) ? 'true' : 'false'"
        data-testid="workflow-select-option"
        :data-option-value="option.value"
        @click="selectOptionForMode(option.value)"
        @keydown.down.prevent="focusRelative(index, 1)"
        @keydown.up.prevent="focusRelative(index, -1)"
        @keydown.home.prevent="focusOption(0)"
        @keydown.end.prevent="focusOption(options.length - 1)"
        @keydown.enter.prevent="selectOptionForModeAndMaybeSubmit(option.value)"
        @keydown.escape.prevent="closeAndFocusTrigger"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useInlineSelect, type InlineSelectOption } from '../../lib/useInlineSelect'

export type WorkflowSelectOption = InlineSelectOption

const props = withDefaults(
  defineProps<{
    modelValue: string | string[]
    options: WorkflowSelectOption[]
    placeholder: string
    disabled?: boolean
    testId?: string
    multiple?: boolean
  }>(),
  {
    disabled: false,
    testId: '',
    multiple: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const modelValueArray = computed<string[]>(() => Array.isArray(props.modelValue) ? props.modelValue : [])
const modelValueSingle = computed<string>(() => Array.isArray(props.modelValue) ? '' : props.modelValue)

function isOptionSelected(value: string): boolean {
  return props.multiple ? modelValueArray.value.includes(value) : value === modelValueSingle.value
}

function labelForValue(value: string): string {
  return props.options.find((option) => option.value === value)?.label ?? value
}

function removeChip(value: string): void {
  emit('update:modelValue', modelValueArray.value.filter((entry) => entry !== value))
}

const {
  root,
  trigger,
  isOpen,
  listboxId,
  selectedLabel,
  isEmpty,
  hasSelection,
  setOptionRef,
  closeMenu,
  toggleMenu,
  focusOption,
  focusRelative,
  openMenuAndFocus,
  selectOption,
  selectOptionAndSubmit,
  submitClosestForm,
  closeAndFocusTrigger,
} = useInlineSelect({
  idPrefix: 'workflow-select',
  options: () => props.options,
  modelValue: () => modelValueSingle.value,
  disabled: () => props.disabled,
  emitValue: (value) => emit('update:modelValue', value),
})

function selectOptionForMode(value: string): void {
  if (!props.multiple) {
    selectOption(value)
    return
  }
  const current = modelValueArray.value
  const next = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
  emit('update:modelValue', next)
}

async function selectOptionForModeAndMaybeSubmit(value: string): Promise<void> {
  if (!props.multiple) {
    await selectOptionAndSubmit(value)
    return
  }
  selectOptionForMode(value)
}

async function handleTriggerEnter(): Promise<void> {
  if (props.disabled || props.options.length === 0) return

  if (!hasSelection.value && !props.multiple) {
    await openMenuAndFocus('selected')
    return
  }

  if (isOpen.value) {
    if (props.multiple) {
      closeMenu()
      if (submitClosestForm()) return
      trigger.value?.focus()
      return
    }
    await selectOptionAndSubmit(modelValueSingle.value)
    return
  }

  if (submitClosestForm()) return

  trigger.value?.focus()
}
</script>

<style scoped>
.workflow-select--open {
  z-index: 60;
}

.workflow-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  cursor: pointer;
  user-select: none;
}

.workflow-select-trigger:focus-visible {
  outline: none;
  border-bottom-color: var(--text);
}

/* Chip role lives in style.css - shared with the other component that renders chips. */

.workflow-select-menu {
  position: absolute;
  top: calc(100% + 0.55rem);
  left: 0;
  right: 0;
  z-index: 70;
  display: grid;
  gap: 0.2rem;
  padding: 0.35rem;
  border: 1px solid color-mix(in oklab, var(--text) 12%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 94%, var(--surface));
  box-shadow: 0 18px 48px color-mix(in oklab, var(--bg) 56%, transparent);
  max-height: min(18rem, 48vh);
  overflow: auto;
}
</style>
