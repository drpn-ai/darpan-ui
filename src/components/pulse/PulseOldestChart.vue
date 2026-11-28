<template>
  <!-- DAR-BE-328. How long the oldest waiting order had waited, hour by hour today, against the allowance. The line is
       the reading at each hour's last pulse; the dashed line is the allowance. The readout above names one hour: the
       one pointed at on either Today chart, else the latest. -->
  <figure class="pulse-chart" data-testid="pulse-oldest-chart">
    <figcaption class="pulse-chart__head">
      <span v-explain="'syncPulseOldestChart'" class="pulse-chart__title">Oldest waiting, hours</span>
      <span class="pulse-chart__readout" aria-live="polite" data-testid="pulse-readout">{{ current ? hourReadout(current) : '' }}</span>
    </figcaption>
    <!-- Focusable so the arrow keys can move the readout along the hours. -->
    <div
      class="pulse-chart__plot"
      tabindex="0"
      role="group"
      aria-label="Oldest waiting by hour. Arrow keys move between hours."
      data-testid="pulse-oldest-plot"
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
          :key="tick.value"
          class="pulse-chart__tick"
          :x="CHART.left - 8"
          :y="tick.y + 4"
          text-anchor="end"
        >{{ tick.value }}</text>
        <line
          class="pulse-chart__allowance"
          data-testid="pulse-allowance-line"
          :x1="CHART.left"
          :x2="CHART.right"
          :y1="allowanceY"
          :y2="allowanceY"
        />
        <text
          class="pulse-chart__allowance-text"
          data-testid="pulse-allowance-text"
          :x="CHART.left + 4"
          :y="allowanceY - 6"
        >allowance {{ durationWords(allowanceMinutes) }}</text>
        <!-- One line per run of consecutive hours: a missing hour breaks it. A lone hour is a small dot. -->
        <template v-for="(run, runIndex) in runs" :key="runIndex">
          <polyline v-if="run.length > 1" class="pulse-chart__line" data-testid="pulse-oldest-line" :points="pointsOf(run)" />
          <circle
            v-else
            class="pulse-chart__dot pulse-chart__dot--lone"
            data-testid="pulse-oldest-lone"
            :cx="xs[run[0] ?? 0]"
            :cy="yAt(run[0] ?? 0)"
            r="3"
          />
        </template>
        <circle
          v-if="current"
          class="pulse-chart__dot"
          :cx="xs[currentIndex]"
          :cy="yAt(currentIndex)"
          r="4"
        />
        <g v-for="(hour, index) in hours" :key="hour.hour">
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
import { durationWords } from '../../lib/pulseWords'
import { CHART, consecutiveRuns, daySpanWords, hourReadout, usePulseChart, yFor } from './pulseChart'

const props = withDefaults(defineProps<{
  samples: readonly SyncSample[]
  allowanceMinutes: number
  /** The hour pointed at on either chart (an index into the drawn hours); null is the latest. */
  active?: number | null
  /** The clock the hours are read on; the display zone (the tenant's, when it has one) by default. */
  timeZone?: string
}>(), { active: null, timeZone: undefined })

const emit = defineEmits<{ 'update:active': [index: number | null] }>()

const { hours, xs, slot, currentIndex, onKey } = usePulseChart(props, (index) => emit('update:active', index))
const runs = computed(() => consecutiveRuns(hours.value))
const current = computed(() => hours.value[currentIndex.value] ?? null)

/** The scale in whole hours, even so its middle tick is whole: the highest reading or the allowance, with headroom. */
const yMaxHours = computed(() => {
  const highest = Math.max(props.allowanceMinutes, ...hours.value.map((hour) => hour.oldestMinutes)) / 60
  const top = Math.max(2, Math.ceil(highest * 1.1))
  return top % 2 ? top + 1 : top
})

const ticks = computed(() => [0, yMaxHours.value / 2, yMaxHours.value].map((value) => ({ value, y: yFor(value, yMaxHours.value) })))
const allowanceY = computed(() => yFor(props.allowanceMinutes / 60, yMaxHours.value))

function yAt(index: number): number {
  return yFor((hours.value[index]?.oldestMinutes ?? 0) / 60, yMaxHours.value)
}

function pointsOf(run: number[]): string {
  return run.map((index) => `${(xs.value[index] ?? 0).toFixed(1)},${yAt(index).toFixed(1)}`).join(' ')
}

const summary = computed(() => {
  const span = daySpanWords(hours.value, (hour) => hour.oldestMinutes, durationWords)
  if (!span) return 'No pulses today.'
  // An order that has waited the whole allowance is past it (the pulse's own rule).
  const passed = hours.value.find((hour) => hour.oldestMinutes >= props.allowanceMinutes)
  const allowance = `Allowance ${durationWords(props.allowanceMinutes)}${passed ? `, passed at ${passed.hour}:00` : ''}.`
  return `Oldest waiting order by hour today: ${span}. ${allowance}`
})
</script>

<style scoped src="./pulseChart.css"></style>
