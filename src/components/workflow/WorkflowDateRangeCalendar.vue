<template>
  <div class="wizard-api-range-selector wizard-input-shell">
    <div class="wizard-api-range-panel wizard-api-range-panel--custom">
      <div class="wizard-api-window-shell">
        <button
          type="button"
          :class="[
            'wizard-api-window-field',
            { 'wizard-api-window-field--active': selecting === 'start' },
          ]"
          :data-testid="`${testIdPrefix}-start`"
          @click="calendar.setSelectionSide('start')"
        >
          <span class="workflow-context-label">Start</span>
          <span :class="['wizard-api-window-value', { empty: !startDate }]">
            {{ startLabel }}
          </span>
        </button>
        <button
          type="button"
          :class="[
            'wizard-api-window-field',
            { 'wizard-api-window-field--active': selecting === 'end' },
          ]"
          :data-testid="`${testIdPrefix}-end`"
          @click="calendar.setSelectionSide('end')"
        >
          <span class="workflow-context-label">End</span>
          <span :class="['wizard-api-window-value', { empty: !endDate }]">
            {{ endLabel }}
          </span>
        </button>
      </div>

      <div class="wizard-api-calendar-grid">
        <section
          v-for="(month, monthIndex) in calendarMonths"
          :key="month.key"
          class="wizard-api-calendar-month"
        >
          <div class="wizard-api-calendar-month__head">
            <button
              v-if="monthIndex === 0"
              type="button"
              class="wizard-api-calendar-nav"
              aria-label="Show previous month"
              :data-testid="`${testIdPrefix}-previous-month`"
              @click="calendar.shiftMonth(-1)"
            >
              ‹
            </button>
            <span v-else class="wizard-api-calendar-nav-spacer" aria-hidden="true"></span>
            <h3>{{ month.label }}</h3>
            <button
              v-if="monthIndex === calendarMonths.length - 1 && calendar.canShiftMonth(1)"
              type="button"
              class="wizard-api-calendar-nav"
              aria-label="Show next month"
              :data-testid="`${testIdPrefix}-next-month`"
              @click="calendar.shiftMonth(1)"
            >
              ›
            </button>
            <span v-else class="wizard-api-calendar-nav-spacer" aria-hidden="true"></span>
          </div>
          <div class="wizard-api-calendar-weekdays" aria-hidden="true">
            <span v-for="(weekday, weekdayIndex) in weekdayLabels" :key="`${month.key}-${weekdayIndex}`">
              {{ weekday }}
            </span>
          </div>
          <div class="wizard-api-calendar-days">
            <button
              v-for="cell in month.cells"
              :key="cell.key"
              type="button"
              class="wizard-api-calendar-day"
              :class="calendar.cellClasses(cell)"
              :disabled="calendar.isCellDisabled(cell)"
              :data-testid="cell.isCurrentMonth ? `${testIdPrefix}-day-${cell.key}` : undefined"
              @click="calendar.selectCell(cell)"
            >
              <span class="wizard-api-calendar-day__label">{{ cell.day }}</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { UseCalendarWidget } from '../../composables/useCalendarWidget'

// The Sync run's Custom Dates calendar: Start and End fields over two months. DAR-UI-060 lifted it out of
// ReconciliationDiffPage so a lifecycle's start page asks for its days the same way.
const props = withDefaults(defineProps<{ calendar: UseCalendarWidget; testIdPrefix?: string }>(), { testIdPrefix: 'api-window-custom' })

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const startDate = computed(() => props.calendar.startDate.value)
const endDate = computed(() => props.calendar.endDate.value)
const selecting = computed(() => props.calendar.selecting.value)
const calendarMonths = computed(() => props.calendar.calendarMonths.value)
const startLabel = computed(() => formatDateInputLabel(startDate.value))
const endLabel = computed(() => formatDateInputLabel(endDate.value))

function formatDateInputLabel(value: string): string {
  if (!value) return 'mm/dd/yyyy'
  return value.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$2/$3/$1')
}
</script>

<style scoped>
.wizard-api-range-selector {
  width: min(42rem, 100%);
  min-width: 0;
  max-width: 100%;
  justify-self: center;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-3);
}

.wizard-api-range-panel {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 82%, var(--surface));
  box-shadow: 0 0.8rem 1.8rem color-mix(in oklab, black 8%, transparent);
}

.wizard-api-range-panel--custom {
  gap: var(--space-3);
  padding: var(--space-3);
}

.wizard-api-window-shell {
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  align-items: end;
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border-soft);
}

.wizard-api-window-field {
  min-width: 0;
  display: grid;
  gap: var(--space-0);
  /* Sits between scale steps by more than the fold tolerance; snapping it would be a visible shift rather than a sub-pixel one. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding: 0.65rem var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.wizard-api-window-field--active,
.wizard-api-window-field:focus-visible {
  border-color: color-mix(in oklab, var(--accent) 72%, var(--border));
  outline: none;
}

.wizard-api-window-value {
  min-width: 0;
  overflow: hidden;
  font-size: clamp(0.9rem, 1vw, 1.02rem);
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wizard-api-window-value.empty {
  color: var(--text-muted);
}

.wizard-api-calendar-grid {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.wizard-api-calendar-month {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  gap: var(--space-1-5);
}

.wizard-api-calendar-month__head {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr) 1.75rem;
  align-items: center;
  gap: var(--space-1);
}

.wizard-api-calendar-month__head h3 {
  margin: 0;
  overflow: hidden;
  color: var(--text);
  font-size: var(--type-tile-size);
  font-weight: 400;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wizard-api-calendar-nav,
.wizard-api-calendar-nav-spacer {
  width: 1.75rem;
  height: 1.75rem;
}

.wizard-api-calendar-nav {
  display: inline-grid;
  place-items: center;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-muted);
  /* Sizes an icon glyph, not text. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  font-size: 1.45rem;
  line-height: 1;
  cursor: pointer;
}

.wizard-api-calendar-nav:hover,
.wizard-api-calendar-nav:focus-visible {
  background: color-mix(in oklab, var(--surface) 74%, var(--accent) 26%);
  color: var(--accent);
  outline: none;
}

.wizard-api-calendar-weekdays,
.wizard-api-calendar-days {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.wizard-api-calendar-weekdays {
  color: var(--text-muted);
  font-size: var(--type-eyebrow-size);
  font-weight: 400;
  line-height: 1.1;
  text-align: center;
}

.wizard-api-calendar-weekdays span {
  min-width: 0;
  min-height: 1.75rem;
  display: grid;
  place-items: center;
  padding: 0;
}

.wizard-api-calendar-days {
  row-gap: 0.2rem;
}

.wizard-api-calendar-day {
  position: relative;
  width: 100%;
  inline-size: 100%;
  height: 2rem;
  min-width: 0;
  min-inline-size: 0;
  max-width: 100%;
  display: grid;
  place-items: center;
  justify-self: stretch;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: var(--type-muted-size);
  line-height: 1;
  cursor: pointer;
  z-index: 0;
}

.wizard-api-calendar-day__label {
  position: relative;
  z-index: 2;
  display: inline-grid;
  width: min(1.95rem, 100%);
  inline-size: min(1.95rem, 100%);
  min-width: 0;
  max-width: 100%;
  height: 1.95rem;
  place-items: center;
  line-height: 1;
}

.wizard-api-calendar-day::before,
.wizard-api-calendar-day::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.wizard-api-calendar-day::before {
  top: 0.18rem;
  right: 0;
  bottom: 0.18rem;
  left: 0;
  background: transparent;
  z-index: 0;
}

.wizard-api-calendar-day::after {
  top: 50%;
  left: 50%;
  width: min(1.95rem, 100%);
  inline-size: min(1.95rem, 100%);
  height: 1.95rem;
  border-radius: var(--radius-pill);
  background: transparent;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.wizard-api-calendar-day--in-range::before,
.wizard-api-calendar-day--range-start::before,
.wizard-api-calendar-day--range-end::before {
  background: color-mix(in oklab, var(--accent) 16%, var(--surface));
}

.wizard-api-calendar-day--range-start::before {
  left: 50%;
}

.wizard-api-calendar-day--range-end::before {
  right: 50%;
}

.wizard-api-calendar-day--range-start.wizard-api-calendar-day--range-end::before {
  background: transparent;
}

.wizard-api-calendar-day--range-start,
.wizard-api-calendar-day--range-end {
  color: var(--surface);
  font-weight: 400;
}

.wizard-api-calendar-day--range-start::after,
.wizard-api-calendar-day--range-end::after {
  background: color-mix(in oklab, var(--accent) 66%, var(--surface));
}

.wizard-api-calendar-day--outside {
  color: color-mix(in oklab, var(--text-muted) 58%, transparent);
}

.wizard-api-calendar-day:disabled,
.wizard-api-calendar-day--disabled {
  color: color-mix(in oklab, var(--text-muted) 56%, transparent);
  cursor: not-allowed;
}

.wizard-api-calendar-day:disabled::before,
.wizard-api-calendar-day:disabled::after {
  background: transparent;
  box-shadow: none;
}

.wizard-api-calendar-day:hover,
.wizard-api-calendar-day:focus-visible {
  outline: none;
}

.wizard-api-calendar-day:hover::after,
.wizard-api-calendar-day:focus-visible::after {
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--accent) 65%, var(--border));
}

@media (max-width: 720px) {
  .wizard-api-window-shell,
  .wizard-api-calendar-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .wizard-api-window-shell {
    grid-template-columns: 1fr;
  }
}
</style>
