<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isPopupOpen }">
    <template #hero>
      <h1>Config history</h1>
    </template>

    <p class="section-note">A version is kept a minute after an audit, check, run or connection changes.</p>
    <LoadingState v-if="loading" noun="config history" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />
    <p v-if="statusMessage" class="section-note" role="status" data-testid="config-history-status">{{ statusMessage }}</p>

    <StaticPageSection v-if="canEdit" title="Now">
      <div class="static-page-tile-grid static-page-record-grid tenant-settings-list-grid">
        <button
          type="button"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="config-keep-version"
          :disabled="keeping"
          @click="keepVersion"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">Keep a version now</span>
            </span>
            <span class="tenant-settings-list-status">{{ keeping ? 'Keeping…' : latestLabel }}</span>
          </span>
        </button>
      </div>
    </StaticPageSection>

    <StaticPageSection title="Versions">
      <p v-if="!loading && !pageError && versions.length === 0" class="section-note">No versions yet.</p>
      <div v-else class="static-page-tile-grid static-page-record-grid tenant-settings-list-grid">
        <component
          :is="canRestore(version) ? 'button' : 'div'"
          v-for="version in versions"
          :key="version.id"
          :type="canRestore(version) ? 'button' : undefined"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="config-version"
          @click="openRestore(version)"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">Version {{ version.seq }}</span>
              <span class="static-page-list-tile__meta">{{ versionMeta(version) }}</span>
              <span class="static-page-list-tile__meta">{{ detailLine(version) }}</span>
            </span>
            <span class="tenant-settings-list-status">{{ statusOf(version) }}</span>
          </span>
        </component>
      </div>
    </StaticPageSection>
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
// DAR-BE-160. The active tenant's audit config versions (whole tenant, not one audit): keep one now, and restore an
// older one through the plan the backend previews, applied exactly as shown (planHash).
import { computed, onMounted, ref } from 'vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { configFacade } from '../../lib/api/facade'
import type { ConfigVersion, PreviewTenantConfigRestoreResponse } from '../../lib/api/configTypes'
import { countsSummary, restoreChangesNothing, restoreSections, versionMeta } from '../../lib/configHistory'
import { usePermissionsStore } from '../../stores/permissions'

const AUTOMATIC_REASON = 'Saved in Darpan'

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
const latestId = computed(() => versions.value[0]?.id ?? null)
const latestLabel = computed(() => (versions.value[0] ? `Latest is version ${versions.value[0].seq}` : 'No versions yet'))
const sections = computed(() => (preview.value ? restoreSections(preview.value.plan) : []))
const nothingToChange = computed(() => (preview.value ? restoreChangesNothing(preview.value.plan) : false))
const applyDisabled = computed(() =>
  previewLoading.value || applying.value || !preview.value || preview.value.plan.blocking.length > 0 || nothingToChange.value)

function canRestore(version: ConfigVersion): boolean {
  return canEdit.value && version.id !== latestId.value
}

function statusOf(version: ConfigVersion): string {
  if (version.id === latestId.value) return 'Current'
  return canEdit.value ? 'Restore' : ''
}

function detailLine(version: ConfigVersion): string {
  const reason = version.reason && version.reason !== AUTOMATIC_REASON ? version.reason : ''
  return [countsSummary(version.counts), reason].filter(Boolean).join(' · ')
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
</style>
