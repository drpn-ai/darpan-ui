<template>
  <!-- DAR-BE-328. How many orders were waiting, hour by hour today: one bar per hour at the oldest chart's x, the hour
       pointed at (else the latest) in full ink. The readout lives on the oldest chart above; this one only moves it. -->
  <figure class="pulse-chart" data-testid="pulse-waiting-chart">
    <figcaption class="pulse-chart__head">
      <span v-explain="'syncPulseWaitingChart'" class="pulse-chart__title">Waiting, orders</span>
    </figcaption>
    <!-- Focusable so the arrow keys can move the readout along the hours. -->
    <div
      class="pulse-chart__plot"
      tabindex="0"
      role="group"
      aria-label="Orders waiting by hour. Arrow keys move between hours."
      data-testid="pulse-waiting-plot"
      @keydown="onKey"
      @mouseleave="emit('update:active', null)"
    >
      <svg
        class="pulse-chart__svg"
        role="img"
        :aria-label="summary"
        :viewBox="`0 0 ${CHART.width} ${CHART.height}`"
      >
        <line class="pulse-chart__base" :x1="CHART.left" :x2="CHART.right" :y1="CHART.bottom" :y2="CHART.bottom" />
        <text
          v-for="tick in ticks"
          :key="tick.y"
          class="pulse-chart__tick"
          :x="CHART.left - 8"
          :y="tick.y + 4"
          text-anchor="end"
        >{{ tick.text }}</text>
        <g v-for="(hour, index) in hours" :key="hour.hour">
          <rect
            class="pulse-chart__bar"
            :class="{ 'pulse-chart__bar--active': index === currentIndex }"
            data-testid="pulse-waiting-bar"
            :x="(xs[index] ?? 0) - barWidth / 2"
            :y="yFor(hour.waitingCount, yMax)"
            :width="barWidth"
            :height="CHART.bottom - yFor(hour.waitingCount, yMax)"
            rx="3"
          />
          <text
            class="pulse-chart__tick"
            data-testid="pulse-hour-tick"
            :x="xs[index]"
            :y="CHART.tickY"
            text-anchor="middle"
          >{{ hour.hour }}</text>
          <rect
            class="pulse-chart__hit"
            data-testid="pulse-hour-hit"
            :x="(xs[index] ?? 0) - slot / 2"
            :y="CHART.top"
            :width="slot"
            :height="CHART.bottom - CHART.top"
            @mouseenter="emit('update:active', index)"
          />
        </g>
      </svg>
    </div>
  </figure>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { vExplain } from '../../directives/vExplain'
import type { SyncSample } from '../../lib/api/pulseTypes'
import { activeIndex, CHART, hourXs, pulseHours, slotWidth, steppedIndex, yFor } from './pulseChart'

const props = withDefaults(defineProps<{
  samples: readonly SyncSample[]
  /** Taken for symmetry with the oldest chart; a count has no allowance line. */
  allowanceMinutes: number
  /** The hour pointed at on either chart (an index into the drawn hours); null is the latest. */
  active?: number | null
  /** The clock the hours are read on; the display zone (the tenant's, when it has one) by default. */
  timeZone?: string
}>(), { active: null, timeZone: undefined })

const emit = defineEmits<{ 'update:active': [index: number | null] }>()

const hours = computed(() => pulseHours(props.samples, props.timeZone))
const xs = computed(() => hourXs(hours.value))
const slot = computed(() => slotWidth(hours.value))
const barWidth = computed(() => Math.min(36, slot.value * 0.6))
const currentIndex = computed(() => activeIndex(hours.value.length, props.active))

/**
 * A round, even top for the scale, so its middle tick is a whole count too: the highest count up to the next half of
 * its order of magnitude (1,610 → 2,000; 3 → 4; 15 → 20).
 */
const yMax = computed(() => {
  const highest = Math.max(0, ...hours.value.map((hour) => hour.waitingCount))
  if (highest <= 0) return 10
  const step = Math.max(1, 10 ** Math.floor(Math.log10(highest)) / 2)
  const top = Math.ceil(highest / step) * step
  return top % 2 ? top + step : top
})

function count(value: number): string {
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(value)
}

const ticks = computed(() => [0, yMax.value / 2, yMax.value].map((value) => ({ text: count(value), y: yFor(value, yMax.value) })))

const summary = computed(() => {
  const list = hours.value
  const first = list[0]
  const last = list[list.length - 1]
  if (!first || !last) return 'No pulses today.'
  const words = (value: number) => value.toLocaleString('en-US')
  const highest = list.reduce((top, hour) => (hour.waitingCount > top.waitingCount ? hour : top), first)
  const span = first === last
    ? `${words(first.waitingCount)} at ${first.hour}:00`
    : `${words(first.waitingCount)} at ${first.hour}:00, ${words(last.waitingCount)} at ${last.hour}:00`
  return `Orders waiting by hour today: ${span}, highest ${words(highest.waitingCount)} at ${highest.hour}:00.`
})

function onKey(event: KeyboardEvent): void {
  const next = steppedIndex(event.key, currentIndex.value, hours.value.length)
  if (next === null) return
  event.preventDefault()
  emit('update:active', next)
}
</script>

<style scoped src="./pulseChart.css"></style>
