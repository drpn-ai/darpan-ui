<template>
  <div class="workflow-time-select" role="group" :aria-label="ariaLabel">
    <WorkflowSelect
      class="workflow-time-select-part workflow-time-select-part--hour"
      :model-value="parts.hour"
      :options="HOUR_OPTIONS"
      :disabled="disabled"
      :test-id="testId ? `${testId}-hour` : ''"
      aria-label="Hour"
      placeholder="HH"
      @update:model-value="(value) => commitPart('hour', value)"
    />

    <span class="workflow-time-select-separator" aria-hidden="true">:</span>

    <WorkflowSelect
      class="workflow-time-select-part workflow-time-select-part--minute"
      :model-value="parts.minute"
      :options="MINUTE_OPTIONS"
      :disabled="disabled"
      :test-id="testId ? `${testId}-minute` : ''"
      aria-label="Minute"
      placeholder="MM"
      @update:model-value="(value) => commitPart('minute', value)"
    />

    <WorkflowSelect
      class="workflow-time-select-part workflow-time-select-part--meridiem"
      :model-value="parts.meridiem"
      :options="MERIDIEM_OPTIONS"
      :disabled="disabled"
      :test-id="testId ? `${testId}-meridiem` : ''"
      aria-label="AM or PM"
      placeholder="AM"
      @update:model-value="(value) => commitPart('meridiem', value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import WorkflowSelect, { type WorkflowSelectOption } from './WorkflowSelect.vue'

/**
 * A 24-hour `HH:mm` value edited through the app's own selects.
 *
 * `<input type="time">` opens Chrome's built-in picker: a panel in the browser's shadow DOM whose
 * selection highlight is the OS accent colour. `color-scheme` reaches its background and nothing
 * reaches that highlight, so on this product's monochrome surfaces it reads as another app's UI
 * dropped into the page. Owning the control is the only way to theme it — the same call the diff
 * page's calendar widget already made for dates.
 *
 * Twelve-hour parts, because that is how the schedule reads back everywhere else in the product
 * ("Daily at 2:00 AM"); the model stays 24-hour so the cron helper is untouched.
 */

type TimePartName = 'hour' | 'minute' | 'meridiem'

interface TimeParts {
  hour: string
  minute: string
  meridiem: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    testId?: string
    ariaLabel?: string
  }>(),
  {
    disabled: false,
    testId: '',
    ariaLabel: 'Time',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const HOUR_OPTIONS: WorkflowSelectOption[] = Array.from({ length: 12 }, (_, index) => {
  const value = padTwo(index + 1)
  return { value, label: value }
})
const MINUTE_OPTIONS: WorkflowSelectOption[] = Array.from({ length: 60 }, (_, minute) => {
  const value = padTwo(minute)
  return { value, label: value }
})
const MERIDIEM_OPTIONS: WorkflowSelectOption[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

const EMPTY_PARTS: TimeParts = { hour: '', minute: '', meridiem: '' }

const parts = computed<TimeParts>(() => parseTimeParts(props.modelValue))

function padTwo(value: number): string {
  return String(value).padStart(2, '0')
}

function parseTimeParts(value: string): TimeParts {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value?.trim() ?? '')
  if (!match) return EMPTY_PARTS

  const hour24 = Number(match[1])
  const minute = Number(match[2])
  if (hour24 > 23 || minute > 59) return EMPTY_PARTS

  return {
    // Midnight and noon are 12, not 0 — `% 12` alone would render 00:30 as "00:30 AM".
    hour: padTwo(hour24 % 12 === 0 ? 12 : hour24 % 12),
    minute: padTwo(minute),
    meridiem: hour24 < 12 ? 'AM' : 'PM',
  }
}

/**
 * Answering one part always emits a whole, valid `HH:mm`. The parts a half-filled value leaves
 * blank fall back to midnight rather than emitting something unparseable, so the cron helper
 * downstream never sees a value it has to defend against.
 */
function commitPart(part: TimePartName, value: string | string[]): void {
  const next: TimeParts = { ...parts.value, [part]: Array.isArray(value) ? value[0] ?? '' : value }
  const hour12 = Number(next.hour) || 12
  const minute = Number(next.minute) || 0
  const hour24 = next.meridiem === 'PM' ? (hour12 % 12) + 12 : hour12 % 12

  emit('update:modelValue', `${padTwo(hour24)}:${padTwo(minute)}`)
}
</script>

<style scoped>
.workflow-time-select {
  display: flex;
  align-items: end;
  gap: var(--space-1);
  min-width: 0;
}

/* The hour and minute carry two characters and the meridiem three, so they are sized by content
   rather than shared evenly — an even split leaves AM/PM clipped in the narrowest schedule
   column. */
.workflow-time-select-part {
  min-width: 0;
  flex: 1 1 0;
}

.workflow-time-select-part--meridiem {
  flex-grow: 1.3;
}

.workflow-time-select-separator {
  padding-bottom: var(--space-1-5);
  color: color-mix(in oklab, var(--text) 45%, transparent);
  line-height: 1.2;
}

/* Narrow parts: the trigger's default gap pushes the caret off the end before the label runs out
   of room, so tighten it here rather than globally. */
.workflow-time-select-part :deep(.workflow-select-trigger) {
  gap: var(--space-1);
}

/* Two-character options in a narrow menu read better centered than ranged left. */
.workflow-time-select-part :deep(.workflow-select-option) {
  text-align: center;
}
</style>
