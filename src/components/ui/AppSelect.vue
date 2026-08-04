<template>
  <div
    ref="root"
    class="app-select"
    :data-enter-submit="isOpen ? 'off' : undefined"
  >
    <button
      ref="trigger"
      type="button"
      :class="[
        'app-select-trigger',
        { empty: isEmpty, 'app-select-trigger--open': isOpen, 'app-select-trigger--disabled': disabled },
      ]"
      :disabled="disabled"
      :aria-expanded="isOpen ? 'true' : 'false'"
      aria-haspopup="listbox"
      :aria-controls="listboxId"
      :data-testid="testId || undefined"
      @mousedown.stop
      @click.stop="toggleMenu"
      @keydown.enter.prevent="handleTriggerEnter"
      @keydown.space.prevent="toggleMenu"
      @keydown.down.prevent="openMenuAndFocus('selected')"
      @keydown.up.prevent="openMenuAndFocus('last')"
      @keydown.escape.prevent="closeMenu"
    >
      <span class="app-select-trigger-label">{{ triggerSelectedLabel || placeholder }}</span>
      <span class="app-select-trigger-icon" aria-hidden="true">
        <svg viewBox="0 0 12 8" focusable="false">
          <polyline points="1 1 6 7 11 1" />
        </svg>
      </span>
    </button>

    <div
      v-if="isOpen"
      class="app-select-menu"
      @mousedown.stop
    >
      <input
        v-if="searchable"
        ref="searchInput"
        v-model="searchQuery"
        class="app-select-search"
        type="search"
        :placeholder="searchPlaceholder"
        aria-label="Search options"
        data-testid="app-select-search"
        @click.stop
        @mousedown.stop
        @keydown.down.prevent="focusOption(0)"
        @keydown.up.prevent="focusOption(filteredOptions.length - 1)"
        @keydown.enter.prevent="handleSearchEnter"
        @keydown.escape.prevent="closeAndFocusTrigger"
      />

      <div :id="listboxId" class="app-select-options" role="listbox">
        <button
          v-for="(option, index) in filteredOptions"
          :key="option.value"
          :ref="setOptionRef"
          type="button"
          class="app-select-option"
          :class="{ 'app-select-option--selected': option.value === modelValue }"
          role="option"
          :aria-selected="option.value === modelValue ? 'true' : 'false'"
          data-testid="app-select-option"
          :data-option-value="option.value"
          @click="selectOption(option.value)"
          @keydown.down.prevent="focusRelative(index, 1)"
          @keydown.up.prevent="focusRelative(index, -1)"
          @keydown.home.prevent="focusOption(0)"
          @keydown.end.prevent="focusOption(filteredOptions.length - 1)"
          @keydown.enter.prevent="handleOptionEnter(option.value)"
          @keydown.space.prevent="selectOption(option.value)"
          @keydown.escape.prevent="closeAndFocusTrigger"
        >
          {{ option.label }}
        </button>
        <p v-if="searchable && filteredOptions.length === 0" class="app-select-empty" data-testid="app-select-empty">
          {{ emptySearchLabel }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useInlineSelect, type InlineSelectOption } from '../../lib/useInlineSelect'

export type AppSelectOption = InlineSelectOption

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: AppSelectOption[]
    placeholder?: string
    disabled?: boolean
    testId?: string
    submitOnEnter?: boolean
    searchable?: boolean
    searchPlaceholder?: string
    emptySearchLabel?: string
  }>(),
  {
    placeholder: '',
    disabled: false,
    testId: '',
    submitOnEnter: false,
    searchable: false,
    searchPlaceholder: 'Search options',
    emptySearchLabel: 'No matching options',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const searchInput = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const triggerSelectedLabel = computed(() => props.options.find((option) => option.value === props.modelValue)?.label ?? '')
const filteredOptions = computed(() => {
  if (!props.searchable) return props.options

  const query = normalizeSearchValue(searchQuery.value)
  if (!query) return props.options

  return props.options.filter((option) => {
    const searchableText = normalizeSearchValue(`${option.label} ${option.value}`)
    return searchableText.includes(query)
  })
})

const {
  root,
  trigger,
  isOpen,
  listboxId,
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
  closeAndFocusTrigger,
} = useInlineSelect({
  idPrefix: 'app-select',
  options: () => filteredOptions.value,
  modelValue: () => props.modelValue,
  disabled: () => props.disabled,
  emitValue: (value) => emit('update:modelValue', value),
})

watch(isOpen, async (open) => {
  if (!open) {
    searchQuery.value = ''
    return
  }

  if (!props.searchable) return
  await nextTick()
  searchInput.value?.focus()
})

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase()
}

async function handleOptionEnter(value: string): Promise<void> {
  if (props.submitOnEnter) {
    await selectOptionAndSubmit(value)
    return
  }

  await selectOption(value)
}

async function handleSearchEnter(): Promise<void> {
  if (filteredOptions.value.length !== 1) {
    focusOption(0)
    return
  }

  const onlyOption = filteredOptions.value[0]
  if (!onlyOption) return

  await handleOptionEnter(onlyOption.value)
}

async function handleTriggerEnter(): Promise<void> {
  if (props.disabled || filteredOptions.value.length === 0) return

  if (props.submitOnEnter && hasSelection.value) {
    await selectOptionAndSubmit(props.modelValue)
    return
  }

  await openMenuAndFocus('selected')
}
</script>

<style scoped>
.app-select {
  position: relative;
  width: 100%;
}

.app-select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text);
  padding: 0.65rem 0.8rem;
  min-height: 2.55rem;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.app-select-trigger.empty {
  color: color-mix(in oklab, var(--text) 40%, transparent);
}

.app-select-trigger--disabled {
  cursor: default;
  opacity: 0.55;
}

.app-select-trigger:focus-visible {
  outline: none;
  border-color: color-mix(in oklab, var(--text) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--text) 14%, transparent);
}

.app-select-trigger-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-trigger-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in oklab, var(--text) 58%, transparent);
  transition: transform 140ms ease;
}

.app-select-trigger-icon svg {
  width: 0.7rem;
  height: 0.46rem;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}

.app-select-trigger--open .app-select-trigger-icon {
  transform: rotate(180deg);
}

.app-select-menu {
  position: absolute;
  top: calc(100% + 0.45rem);
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
  overflow: hidden;
}

.app-select-search {
  min-height: 2.35rem;
  padding: 0.55rem 0.7rem;
  border-radius: calc(var(--radius-sm) - 0.02rem);
  background: var(--surface);
}

.app-select-search::-webkit-search-cancel-button {
  appearance: none;
}

.app-select-options {
  display: grid;
  gap: 0.2rem;
  max-height: min(18rem, 48vh);
  overflow: auto;
}

.app-select-option {
  border: 0;
  border-radius: calc(var(--radius-sm) - 0.02rem);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
  line-height: 1.15;
}

.app-select-option:hover {
  background: color-mix(in oklab, var(--text) 8%, var(--surface-2));
}

.app-select-option--selected {
  background: color-mix(in oklab, var(--text) 12%, var(--surface-2));
}

.app-select-option:focus-visible {
  outline: none;
  background: color-mix(in oklab, var(--text) 10%, var(--surface-2));
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--text) 18%, transparent);
}

.app-select-empty {
  margin: 0;
  padding: 0.75rem 0.8rem;
  color: var(--text-muted);
  font-size: var(--type-muted-size);
}
</style>
