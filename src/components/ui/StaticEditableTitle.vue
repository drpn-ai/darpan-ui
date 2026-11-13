<template>
  <component
    :is="tag"
    ref="titleElement"
    class="static-page-inline-edit-title"
    :contenteditable="editable ? 'plaintext-only' : 'false'"
    :aria-label="editable ? ariaLabel : undefined"
    :spellcheck="false"
    :data-testid="testId"
    @input="handleInput"
    @keydown.enter.prevent="handleEnterCommit"
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

function normalizeTitle(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').trim()
}

function readTitle(event: Event): string | null {
  if (!props.editable) return null

  const target = event.currentTarget
  if (!(target instanceof HTMLElement)) return null

  return normalizeTitle(target.textContent ?? '')
}

function handleInput(event: Event): void {
  const nextTitle = readTitle(event)
  if (nextTitle == null) return

  emit('update:modelValue', nextTitle)
}

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
