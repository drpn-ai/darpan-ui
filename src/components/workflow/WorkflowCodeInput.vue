<template>
  <!-- One box per digit. The first box carries autocomplete="one-time-code", so an autofilled or pasted code
       lands there whole and is spread across the boxes. -->
  <div
    class="workflow-code-input"
    role="group"
    :aria-label="label"
    :data-testid="testId"
    :style="{ '--workflow-code-length': length }"
  >
    <input
      v-for="index in boxIndexes"
      :key="index"
      :ref="(element) => setBox(element, index)"
      class="workflow-code-box"
      :class="{ 'workflow-code-box--filled': Boolean(digits[index]) }"
      :data-testid="`${testId}-${index}`"
      :value="digits[index] ?? ''"
      :aria-label="`${label}, digit ${index + 1} of ${length}`"
      :autocomplete="index === 0 ? 'one-time-code' : 'off'"
      type="text"
      inputmode="numeric"
      @input="handleInput($event, index)"
      @keydown="handleKeydown($event, index)"
      @paste="handlePaste($event, index)"
      @focus="handleFocus(index)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  length?: number
  label?: string
  testId?: string
}>(), {
  length: 6,
  label: 'Code',
  testId: 'workflow-code',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  complete: [value: string]
}>()

const boxes: Array<HTMLInputElement | null> = []
const boxIndexes = computed(() => Array.from({ length: props.length }, (_, index) => index))

// The value has no gaps: digits fill from the left, and focus never rests on a box past the first empty one.
const digits = computed(() => props.modelValue.replace(/\D/g, '').slice(0, props.length).split(''))

function setBox(element: unknown, index: number): void {
  boxes[index] = element instanceof HTMLInputElement ? element : null
}

function focusBox(index: number): void {
  void nextTick(() => boxes[Math.max(0, Math.min(index, props.length - 1))]?.focus())
}

function write(next: string[], focusIndex: number): void {
  const value = next.join('').slice(0, props.length)
  emit('update:modelValue', value)
  focusBox(focusIndex)
  if (value.length === props.length) emit('complete', value)
}

/** Put typed or pasted digits in from this box on, replacing what was there. */
function fillFrom(index: number, typed: string): boolean {
  const incoming = typed.replace(/\D/g, '').split('')
  if (incoming.length === 0) return false
  const start = Math.min(index, digits.value.length)
  const next = [
    ...digits.value.slice(0, start),
    ...incoming,
    ...digits.value.slice(start + incoming.length),
  ].slice(0, props.length)
  write(next, start + incoming.length)
  return true
}

function handleInput(event: Event, index: number): void {
  const box = event.target as HTMLInputElement
  const typed = box.value
  // Vue only re-renders a box whose digit changed, so a rejected letter is cleared here.
  box.value = digits.value[index] ?? ''
  fillFrom(index, typed)
}

function handlePaste(event: ClipboardEvent, index: number): void {
  event.preventDefault()
  fillFrom(index, event.clipboardData?.getData('text') ?? '')
}

function handleKeydown(event: KeyboardEvent, index: number): void {
  if (event.key === 'Backspace') {
    event.preventDefault()
    const target = digits.value[index] ? index : index - 1
    if (target < 0) return
    write(digits.value.filter((_, position) => position !== target), target)
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    focusBox(index - 1)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    focusBox(Math.min(index + 1, digits.value.length))
  }
}

function handleFocus(index: number): void {
  if (index > digits.value.length) {
    focusBox(digits.value.length)
    return
  }
  // Selected, so typing over a filled box replaces its digit.
  boxes[index]?.select()
}
</script>

<style scoped>
.workflow-code-input {
  display: grid;
  grid-template-columns: repeat(var(--workflow-code-length), minmax(0, 1fr));
  gap: var(--space-2);
  width: min(100%, 24rem);
}

/* Dashed while empty, solid once a digit is in: the design system's empty / filled border language. */
.workflow-code-box {
  min-height: 3.4rem;
  padding: 0;
  border-style: dashed;
  border-radius: var(--radius-md);
  text-align: center;
  font-size: var(--workflow-form-answer-size);
  font-variant-numeric: tabular-nums;
  caret-color: var(--text);
}

.workflow-code-box--filled {
  border-style: solid;
}
</style>
