<template>
  <StaticPageFrame>
    <template #hero>
      <h1 v-explain="'syncPulse'">Sync pulse</h1>
    </template>

    <LoadingState v-if="loading" noun="sync pairs" />
    <InlineValidation v-else-if="pageError" tone="error" :message="pageError" />
    <EmptyState v-else-if="pairs.length === 0" title="No sync pairs." />

    <ul v-else class="pair-rows" data-testid="sync-pair-rows">
      <li v-for="row in rows" :key="row.syncPairId">
        <button type="button" class="pair-row" :aria-label="`Open sync pair ${row.label}`" data-testid="sync-pair-row" @click="open(row.syncPairId)">
          <span class="pair-row__name">{{ row.label }}</span>
          <span class="pair-row__cadence">{{ row.cadence }}</span>
          <span class="pair-row__counts">{{ row.counts }}</span>
        </button>
      </li>
    </ul>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to tenant settings"
          title="Back to tenant settings"
          data-testid="sync-pair-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <RouterLink
          v-if="canEdit"
          :to="{ name: 'settings-tenant-sync-pair-new' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Add sync pair"
          title="Add sync pair"
          data-testid="sync-pair-add"
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
// DAR-BE-328. The active tenant's sync pairs as one list: label, how often it pulses, and what is waiting.
// Each row opens its own page.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { pulseFacade } from '../../lib/api/facade'
import type { SyncPairSummary } from '../../lib/api/pulseTypes'
import { backIconPath, plusIconPath } from '../../lib/iconPaths'
import { pulseCadence } from '../../lib/pulseWords'
import { usePermissionsStore } from '../../stores/permissions'

const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const pairs = ref<SyncPairSummary[]>([])
const loading = ref(false)
const pageError = ref('')
const controller = new AbortController()

const rows = computed(() => pairs.value.map((pair) => ({
  syncPairId: pair.syncPairId,
  label: pair.label,
  cadence: pulseCadence(pair.pulseEveryMinutes),
  counts: `${pair.waitingCount} waiting · ${pair.pastAllowanceCount} past`,
})))

function open(syncPairId: string): void {
  void router.push({ name: 'settings-tenant-sync-pair', params: { syncPairId } })
}

async function load(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const response = await pulseFacade.listSyncPairs(controller.signal)
    if (response.ok === false) {
      pageError.value = response.errors?.[0] ?? 'Could not load the sync pairs.'
      return
    }
    pairs.value = response.syncPairs ?? []
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof Error && error.message ? error.message : 'Could not load the sync pairs.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
onBeforeUnmount(() => controller.abort())
</script>

<style scoped>
.pair-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.pair-rows li + li {
  border-top: 1px solid var(--static-tile-border);
}

/* The whole row is the button. */
.pair-row {
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

.pair-row > span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.pair-row__counts {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .pair-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .pair-row__counts {
    grid-row: 2;
  }

  .pair-row__cadence {
    grid-row: 1;
    grid-column: 2;
  }
}
</style>
