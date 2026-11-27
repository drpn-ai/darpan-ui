<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isPopupOpen }">
    <template #hero>
      <h1>Config history</h1>
    </template>

    <LoadingState v-if="loading" noun="config history" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />
    <p v-if="statusMessage" class="section-note" role="status" data-testid="config-history-status">{{ statusMessage }}</p>
    <p v-if="!loading && !pageError && versions.length === 0" class="section-note">No versions yet.</p>

    <!-- The newest version: what this tenant runs on now. Read-only; only older versions restore. -->
    <StaticFactStrip v-if="current" :facts="currentFacts" test-id="config-current" />

    <StaticPageSection v-if="earlier.length" class="config-history-days">
      <template v-for="group in dayGroups" :key="group.key">
        <h2 class="micro-label config-history-day" data-testid="config-day">{{ group.label }}</h2>
        <ul class="config-history-rows">
          <li v-for="version in group.versions" :key="version.id">
            <component
              :is="canRestore(version) ? 'button' : 'div'"
              :type="canRestore(version) ? 'button' : undefined"
              :aria-label="canRestore(version) ? `Restore version ${version.seq}` : undefined"
              class="config-history-row"
              data-testid="config-version"
              @click="openRestore(version)"
            >
              <span class="config-history-row__name">Version {{ version.seq }}</span>
              <span class="config-history-row__cell">
                <span>{{ versionTime(version.createdDate) }}</span>
                <span class="config-history-dim">{{ whoOf(version) }} · {{ sourceLabel(version) }}</span>
              </span>
              <span class="config-history-row__cell">
                <span data-testid="config-version-delta">{{ deltaOf(version) }}</span>
                <span v-if="reasonOf(version)" class="config-history-dim">{{ reasonOf(version) }}</span>
              </span>
            </component>
          </li>
        </ul>
      </template>
      <AppListPager
        :page-index="pageIndex"
        :page-count="pageCount"
        aria-label="Config version pages"
        previous-test-id="config-page-previous"
        next-test-id="config-page-next"
        @update:page-index="goToPage"
      />
    </StaticPageSection>

    <button
      v-if="canEdit"
      type="button"
      class="static-page-action-tile static-page-create-action"
      data-testid="config-keep-version"
      aria-label="Keep a version now"
      :aria-busy="keeping"
      :disabled="keeping"
      @click="keepVersion"
    >
      {{ keeping ? 'Keeping…' : 'Keep a version now' }}
    </button>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant' }"
          class="app-icon-action app-icon-action--large"
          data-testid="config-history-back"
          aria-label="Back to Tenant Settings"
          title="Back to Tenant Settings"
        >
          <AppIcon name="back" />
        </RouterLink>
      </div>
    </template>
  </StaticPageFrame>

  <div
    v-if="isPopupOpen && restoreTarget"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="config-restore-title"
    @click.self="closeRestore"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="config-restore-title">Config history</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          :question="`Restore version ${restoreTarget.seq}?`"
          primary-label="Restore"
          primary-test-id="config-restore-apply"
          :submit-disabled="applyDisabled"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="config-restore-cancel"
          @cancel="closeRestore"
          @submit="applyRestore"
        >
          <LoadingState v-if="previewLoading" noun="restore plan" />
          <InlineValidation v-if="restoreError" tone="error" :message="restoreError" />
          <template v-if="preview">
            <InlineValidation
              v-for="block in preview.plan.blocking"
              :key="`${block.code}-${block.ref}`"
              tone="error"
              :message="block.message"
            />
            <p v-if="nothingToChange" class="section-note">Your config already matches version {{ restoreTarget.seq }}.</p>
            <div v-for="section in sections" :key="section.title" class="config-restore-section">
              <span class="workflow-context-label">{{ section.title }}</span>
              <ul class="workflow-list">
                <li v-for="item in section.items" :key="item">{{ item }}</li>
              </ul>
            </div>
            <p v-if="!nothingToChange" class="section-note">Your config now is kept as a version first.</p>
          </template>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
// DAR-BE-160. The active tenant's audit config versions (whole tenant, not one audit): keep one now, and restore an
// older one through the plan the backend previews, applied exactly as shown (planHash). DAR-UI-125: the newest version
// as a facts strip, the earlier ones by day with what changed against the one before, paged.
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppListPager from '../../components/ui/AppListPager.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { configFacade } from '../../lib/api/facade'
import type { ConfigVersion, PreviewTenantConfigRestoreResponse } from '../../lib/api/configTypes'
import { countsDelta, countsSummary, groupVersionsByDay, restoreChangesNothing, restoreSections, sourceLabel, versionTime } from '../../lib/configHistory'
import { useListPagination } from '../../lib/listPagination'
import { formatDateTime } from '../../lib/utils/date'
import { usePermissionsStore } from '../../stores/permissions'

const AUTOMATIC_REASON = 'Saved in Darpan'
const PAGE_SIZE = 10

const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const versions = ref<ConfigVersion[]>([])
const loading = ref(false)
const pageError = ref('')
const statusMessage = ref('')
const keeping = ref(false)

const restoreTarget = ref<ConfigVersion | null>(null)
const preview = ref<PreviewTenantConfigRestoreResponse | null>(null)
const previewLoading = ref(false)
const applying = ref(false)
const restoreError = ref('')

const isPopupOpen = computed(() => restoreTarget.value !== null)
const current = computed(() => versions.value[0] ?? null)
const earlier = computed(() => versions.value.slice(1))
const currentFacts = computed<StaticFact[]>(() => {
  const version = current.value
  if (!version) return []
  return [
    { key: 'current', label: 'Current', value: `Version ${version.seq}`, explain: 'configVersionCurrent' },
    { key: 'kept', label: 'Kept', value: formatDateTime(version.createdDate), sub: sourceLabel(version), explain: 'configVersionKept' },
    { key: 'by', label: 'By', value: whoOf(version), explain: 'configVersionBy' },
    { key: 'holds', label: 'Holds', value: countsSummary(version.counts), explain: 'configVersionHolds' },
  ]
})
const { pageIndex, pageCount, pagedItems, goToPage } = useListPagination(earlier, { pageSize: PAGE_SIZE })
const dayGroups = computed(() => groupVersionsByDay(pagedItems.value))
// Against the version before it in the whole list, not the page: the last row on a page still has one.
const deltas = computed(() => new Map(versions.value.map((version, index) => [version.id, countsDelta(version, versions.value[index + 1])])))
const sections = computed(() => (preview.value ? restoreSections(preview.value.plan) : []))
const nothingToChange = computed(() => (preview.value ? restoreChangesNothing(preview.value.plan) : false))
const applyDisabled = computed(() =>
  previewLoading.value || applying.value || !preview.value || preview.value.plan.blocking.length > 0 || nothingToChange.value)

function canRestore(version: ConfigVersion): boolean {
  return canEdit.value && version.id !== current.value?.id
}

function whoOf(version: ConfigVersion): string {
  return version.createdByName || 'Darpan'
}

function deltaOf(version: ConfigVersion): string {
  return deltas.value.get(version.id) ?? ''
}

function reasonOf(version: ConfigVersion): string {
  return version.reason && version.reason !== AUTOMATIC_REASON ? version.reason : ''
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

async function loadVersions(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    versions.value = (await configFacade.getTenantConfigVersions()).versions ?? []
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the config history.')
  } finally {
    loading.value = false
  }
}

async function keepVersion(): Promise<void> {
  if (keeping.value) return
  keeping.value = true
  statusMessage.value = ''
  pageError.value = ''
  try {
    const out = await configFacade.snapshotTenantConfig()
    statusMessage.value = out.created ? `Kept version ${out.version.seq}.` : `Nothing changed since version ${out.version.seq}.`
    await loadVersions()
  } catch (error) {
    pageError.value = messageOf(error, 'Could not keep a version.')
  } finally {
    keeping.value = false
  }
}

async function openRestore(version: ConfigVersion): Promise<void> {
  if (!canRestore(version)) return
  restoreTarget.value = version
  preview.value = null
  restoreError.value = ''
  previewLoading.value = true
  try {
    const out = await configFacade.previewTenantConfigRestore({ id: version.id })
    if (restoreTarget.value?.id === version.id) preview.value = out
  } catch (error) {
    restoreError.value = messageOf(error, 'Could not work out what the restore would change.')
  } finally {
    previewLoading.value = false
  }
}

function closeRestore(): void {
  if (applying.value) return
  restoreTarget.value = null
  preview.value = null
  restoreError.value = ''
}

async function applyRestore(): Promise<void> {
  const target = restoreTarget.value
  if (!target || !preview.value || applyDisabled.value) return
  applying.value = true
  restoreError.value = ''
  try {
    const out = await configFacade.restoreTenantConfigVersion({ id: target.id, planHash: preview.value.planHash })
    applying.value = false
    closeRestore()
    statusMessage.value = `Restored version ${target.seq}. Your config before it is version ${out.before.seq}.`
    await loadVersions()
  } catch (error) {
    restoreError.value = messageOf(error, 'Could not restore. Preview the restore again.')
  } finally {
    applying.value = false
  }
}

onMounted(loadVersions)
</script>

<style scoped>
.config-restore-section {
  display: grid;
  gap: var(--space-1);
}

/* The Tenant Settings row pattern (DAR-UI-122): one bordered list, every row the same minimum height. */
.config-history-rows {
  margin: 0;
  padding: 0;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  font-size: var(--static-tile-text-size);
}

.config-history-day {
  margin: var(--space-2) 0 0;
  font-weight: 400;
}

.config-history-rows {
  display: grid;
  list-style: none;
  overflow: hidden;
}

.config-history-rows > li + li {
  border-top: 1px solid var(--static-tile-border);
}

.config-history-row {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr) minmax(0, 1.3fr);
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 3.5rem;
  padding: var(--space-1) var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
}

button.config-history-row {
  cursor: pointer;
}

button.config-history-row:hover {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

button.config-history-row:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--text) 30%, transparent);
}

.config-history-row__name,
.config-history-row__cell {
  min-width: 0;
  overflow-wrap: anywhere;
}

.config-history-row__cell {
  display: grid;
}

.config-history-dim {
  color: var(--text-dim);
}

@media (max-width: 768px) {
  .config-history-row {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
  }
}
</style>
