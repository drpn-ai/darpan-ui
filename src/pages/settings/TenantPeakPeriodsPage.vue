<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Peak periods</h1>
    </template>

    <LoadingState v-if="loading" noun="peak periods" />
    <InlineValidation v-else-if="pageError" tone="error" :message="pageError" />
    <EmptyState v-else-if="periods.length === 0" title="No peak periods." />

    <template v-else>
      <ul v-if="current.length" class="peak-rows" data-testid="peak-rows">
        <li v-for="row in current" :key="row.peakPeriodId">
          <button type="button" class="peak-row" :aria-label="`Open peak period ${row.periodName}`" data-testid="peak-row" @click="open(row.peakPeriodId)">
            <span class="peak-row__name">{{ row.periodName }}</span>
            <span class="peak-row__dates">{{ row.dates }}</span>
            <span class="peak-row__when">{{ row.when }}</span>
          </button>
        </li>
      </ul>

      <template v-if="ended.length">
        <h2 v-explain="'peakPeriodsEnded'" class="static-page-section-heading">Ended</h2>
        <ul class="peak-rows peak-rows--ended" data-testid="peak-rows-ended">
          <li v-for="row in ended" :key="row.peakPeriodId">
            <button type="button" class="peak-row" :aria-label="`Open peak period ${row.periodName}`" data-testid="peak-row-ended" @click="open(row.peakPeriodId)">
              <span class="peak-row__name">{{ row.periodName }}</span>
              <span class="peak-row__dates">{{ row.dates }}</span>
              <span class="peak-row__when">{{ row.when }}</span>
            </button>
          </li>
        </ul>
      </template>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to tenant settings"
          title="Back to tenant settings"
          data-testid="peak-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <RouterLink
          v-if="canEdit"
          :to="{ name: 'settings-tenant-peak-period-new' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Add peak period"
          title="Add peak period"
          data-testid="peak-add"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="plusIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
// DAR-BE-328. The active tenant's peak periods as one list: name, dates and when. Each row opens its own page.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { peakFacade } from '../../lib/api/facade'
import type { PeakPeriodSummary } from '../../lib/api/peakTypes'
import { backIconPath, plusIconPath } from '../../lib/iconPaths'
import { peakDateRange, peakWhen } from '../../lib/peakPeriodWords'
import { usePermissionsStore } from '../../stores/permissions'

const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const periods = ref<PeakPeriodSummary[]>([])
const loading = ref(false)
const pageError = ref('')
const controller = new AbortController()

const rows = computed(() => periods.value.map((period) => ({
  peakPeriodId: period.peakPeriodId,
  periodName: period.periodName,
  dates: peakDateRange(period.fromDate, period.thruDate),
  when: peakWhen(period),
  state: period.state,
})))
const current = computed(() => rows.value.filter((row) => row.state !== 'ended'))
const ended = computed(() => rows.value.filter((row) => row.state === 'ended'))

function open(peakPeriodId: string): void {
  void router.push({ name: 'settings-tenant-peak-period', params: { peakPeriodId } })
}

async function load(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const response = await peakFacade.listPeakPeriods(controller.signal)
    if (response.ok === false) {
      pageError.value = response.errors?.[0] ?? 'Could not load the peak periods.'
      return
    }
    periods.value = response.peakPeriods ?? []
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof Error && error.message ? error.message : 'Could not load the peak periods.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.peak-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.peak-rows li + li {
  border-top: 1px solid var(--static-tile-border);
}

/* The whole row is the button. */
.peak-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 3.5rem;
  padding: var(--space-1) var(--space-3);
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: var(--static-tile-text-size);
  text-align: left;
  cursor: pointer;
}

.peak-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.peak-row__when {
  color: var(--text-dim);
}

.peak-rows--ended .peak-row {
  color: var(--text-dim);
}

@media (max-width: 768px) {
  .peak-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .peak-row__dates {
    grid-row: 2;
  }

  .peak-row__when {
    grid-row: 1;
    grid-column: 2;
  }
}
</style>
