<template>
  <component
    :is="tag"
    ref="titleElement"
    class="static-page-inline-edit-title"
    :contenteditable="editable ? 'plaintext-only' : 'false'"
    :aria-label="editable ? ariaLabel : undefined"
    :spellcheck="false"
    :data-testid="testId"
    @focus="handleFocus"
    @input="handleInput"
    @keydown.enter.prevent="handleEnterCommit"
    @keydown.esc="handleEscapeCancel"
    @blur="handleBlurCommit"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  editable?: boolean
  /** span: a value renamed in place inside a summary card, not a heading. */
  tag?: 'h1' | 'h2' | 'h3' | 'span'
  ariaLabel?: string
  testId?: string
  fallback?: string
}>(), {
  editable: true,
  tag: 'h1',
  ariaLabel: 'Title',
  testId: undefined,
  fallback: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  commit: [value: string]
}>()

const titleElement = ref<HTMLElement | null>(null)
const displayValue = computed(() => props.modelValue || props.fallback)
let skipNextBlurCommit = false
// What the title read when editing began, so Esc can put it back (DAR-UI-121).
let textAtFocus: string | null = null
let editedSinceFocus = false

function normalizeTitle(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').trim()
}

function readTitle(event: Event): string | null {
  if (!props.editable) return null

  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return null

  return normalizeTitle(target.textContent ?? '')
}

function handleFocus(event: Event): void {
  if (!props.editable || !(event.currentTarget instanceof HTMLElement)) return
  textAtFocus = event.currentTarget.textContent ?? ''
  editedSinceFocus = false
}

function handleInput(event: Event): void {
  const nextTitle = readTitle(event)
  if (nextTitle == null) return

  editedSinceFocus = true
  emit('update:modelValue', nextTitle)
}

// Esc leaves without committing: the text goes back to what it read on focus, and the key stops
// here so the shell does not also treat it as leaving the page or a popup.
function handleEscapeCancel(event: KeyboardEvent): void {
  if (!props.editable || !(event.currentTarget instanceof HTMLElement)) return
  event.preventDefault()
  const target = event.currentTarget
  const restored = textAtFocus ?? displayValue.value
  target.textContent = restored
  if (editedSinceFocus) emit('update:modelValue', normalizeTitle(restored))
  editedSinceFocus = false
  if (document.activeElement === target) {
    skipNextBlurCommit = true
    target.blur()
  }
}

/** Puts the caret in the title with its text selected, as a Rename button beside it asks for. */
function focus(): void {
  const element = titleElement.value
  if (!element || !props.editable) return
  element.focus()
  const selection = typeof window.getSelection === 'function' ? window.getSelection() : null
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
}

defineExpose({ focus })

function renderCommittedTitle(element: HTMLElement, nextTitle: string): void {
  element.textContent = nextTitle || displayValue.value
}

function commitTitle(event: Event): HTMLElement | null {
  const nextTitle = readTitle(event)
  if (nextTitle == null) return null

  emit('commit', nextTitle)

  if (event.currentTarget instanceof HTMLElement) {
    renderCommittedTitle(event.currentTarget, nextTitle)
    return event.currentTarget
  }

  return null
}

function handleEnterCommit(event: Event): void {
  const target = commitTitle(event)
  if (!target) return

  if (document.activeElement === target) {
    skipNextBlurCommit = true
    target.blur()
  }
}

function handleBlurCommit(event: Event): void {
  if (skipNextBlurCommit) {
    skipNextBlurCommit = false
    return
  }

  commitTitle(event)
}

function syncRenderedTitle(): void {
  const element = titleElement.value
  if (!element || document.activeElement === element) return

  const nextValue = displayValue.value
  if (element.textContent !== nextValue) element.textContent = nextValue
}

watch(displayValue, () => {
  void nextTick(syncRenderedTitle)
})

onMounted(() => {
  syncRenderedTitle()
})
</script>

<style scoped>
.static-page-inline-edit-title {
  cursor: text;
}

.static-page-inline-edit-title[contenteditable='false'] {
  cursor: inherit;
}

.static-page-inline-edit-title:focus,
.static-page-inline-edit-title:focus-visible {
  outline: none;
}
</style>
