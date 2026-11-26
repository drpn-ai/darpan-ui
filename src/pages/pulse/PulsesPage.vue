<template>
  <StaticPageFrame>
    <template #hero>
      <h1 v-explain="'syncPulse'">Pulses</h1>
    </template>

    <p v-for="period in onPeriods" :key="period.peakPeriodId" class="pulses-period" data-testid="pulses-period">
      <RouterLink
        v-explain="'peakPeriodName'"
        :to="{ name: 'settings-tenant-peak-period', params: { peakPeriodId: period.peakPeriodId } }"
      >
        {{ period.periodName }}
      </RouterLink>
      <span class="pulses-period__dates">{{ periodDates(period) }}</span>
    </p>

    <LoadingState v-if="loading" noun="pulses" />
    <InlineValidation v-else-if="pageError" tone="error" :message="pageError" />
    <EmptyState v-else-if="cards.length === 0" title="No pair pulses." />

    <template v-else>
      <StaticPageSection v-for="card in cards" :key="card.syncPairId" data-testid="pulse-card">
        <template #header>
          <h2 class="static-page-section-heading pulse-card__title">
            <button
              type="button"
              :aria-label="`Open sync pair ${card.label}`"
              data-testid="pulse-card-open"
              @click="open(card.syncPairId)"
            >
              {{ card.label }}
            </button>
          </h2>
          <span class="pulse-card__check">{{ card.checkName }}</span>
        </template>
        <StaticFactStrip :facts="card.facts" test-id="pulse-card-facts" />
        <p v-if="card.asOf" class="pulse-card__as-of" data-testid="pulse-card-as-of">{{ card.asOf }}</p>
        <InlineValidation v-if="card.error" tone="error" :message="card.error" />
      </StaticPageSection>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          v-if="canEdit"
          :to="{ name: 'settings-tenant-sync-pairs' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Open sync pulse"
          title="Open sync pulse"
          data-testid="pulses-settings"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="settingsIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
// DAR-UI-154. Pulses to watch, outside Settings and reachable from Tara (Ask Darpan → Go to Pulses): every pair that
// pulses (DAR-UI-153's filter) with its effective cadence and allowance today, its last pulse and how it ended, and
// what the last read found. Read-only; a card opens the pair's own page (Today charts), editors get the settings list.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { pulseFacade } from '../../lib/api/facade'
import type { PeakPeriodSummary } from '../../lib/api/peakTypes'
import { settingsIconPath } from '../../lib/iconPaths'
import { calendarDayWords, loadSyncPulseView, pulseAsOfWords, pulseWatchFacts, type NextPulse, type SyncPulseRow } from '../../lib/syncPulseView'
import { formatClockTime } from '../../lib/utils/date'
import { usePermissionsStore } from '../../stores/permissions'

interface PulseCard {
  syncPairId: string
  label: string
  checkName: string
  facts: StaticFact[]
  /** When the waiting figures were read: "as of 18:32", or "Last known · as of 18:32" with the pulse off today. */
  asOf: string
  error: string
}

const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const cards = ref<PulseCard[]>([])
const periods = ref<PeakPeriodSummary[]>([])
const pulsingPeriodIds = ref<Set<string>>(new Set())
const loading = ref(false)
const pageError = ref('')
const controller = new AbortController()

// Only a period that is on AND turns a pulse on is named: "Sale Nov 24-26" with every pulse off is not news here.
const onPeriods = computed(() => periods.value.filter((p) => p.state === 'on' && pulsingPeriodIds.value.has(p.peakPeriodId)))

/** "27 Nov" or "24 Nov – 25 Dec": calendar dates, the same in every zone. */
function periodDates(period: PeakPeriodSummary): string {
  return period.fromDate === period.thruDate
    ? calendarDayWords(period.fromDate)
    : `${calendarDayWords(period.fromDate)} – ${calendarDayWords(period.thruDate)}`
}

function open(syncPairId: string): void {
  void router.push({ name: 'settings-tenant-sync-pair', params: { syncPairId } })
}

async function cardFor(row: SyncPulseRow, nextPulse: Map<string, NextPulse>): Promise<PulseCard> {
  const base = { syncPairId: row.syncPairId, label: row.label, checkName: row.checkName }
  try {
    const response = await pulseFacade.getSyncPair({ syncPairId: row.syncPairId }, controller.signal)
    if (response.ok === false || !response.syncPair) {
      return { ...base, facts: [], asOf: '', error: response.errors?.[0] ?? 'Could not load this pulse.' }
    }
    const facts = pulseWatchFacts(response.syncPair, response.samplesToday ?? [], response.pastOrders ?? [],
      (value) => formatClockTime(value), nextPulse.get(row.syncPairId))
    const asOf = pulseAsOfWords(response.syncPair, response.samplesToday ?? [], (value) => formatClockTime(value))
    return { ...base, facts: facts.map((f) => ({ ...f, testId: `pulse-fact-${f.key}` })), asOf, error: '' }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') throw error
    return { ...base, facts: [], asOf: '', error: 'Could not load this pulse.' }
  }
}

async function load(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const loaded = await loadSyncPulseView(controller.signal)
    periods.value = loaded.periods
    pulsingPeriodIds.value = loaded.pulsingPeriodIds
    cards.value = await Promise.all(loaded.view.pulsing.map((row) => cardFor(row, loaded.nextPulse)))
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof Error && error.message ? error.message : 'Could not load the pulses.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.pulses-period {
  display: flex;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  font-size: var(--static-tile-text-size);
}

.pulses-period__dates {
  color: var(--text-dim);
}

/* The section's title opens the pair's own page. */
.pulse-card__title {
  margin: 0;
}

.pulse-card__title button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.pulse-card__as-of {
  margin: var(--space-2) 0 0;
  color: var(--text-dim);
  font-size: var(--static-tile-text-size);
}

.pulse-card__check {
  color: var(--text-dim);
  font-size: var(--static-tile-text-size);
}
</style>
