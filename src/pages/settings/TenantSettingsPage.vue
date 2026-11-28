<template>
  <!-- DAR-UI-159. The settings header: the tenant's name, then its facts (each opens its popup or page); then Schedule,
       the busy days and the pulse that watches them. AI provider settings left the app; Config history moved to Audit
       settings (it is audit config, and not every client has audits). -->
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': timezoneOpen }">
    <template #hero>
      <StaticRecordTitle :model-value="tenantSettingsTitle" :editable="false" test-id="tenant-settings-name" />
    </template>

    <LoadingState v-if="summaryLoading" noun="tenant settings" />
    <InlineValidation v-if="summaryError" tone="error" :message="summaryError" />

    <StaticFactStrip :facts="facts" test-id="tenant-settings-facts" @open="openFact" />
    <p v-if="timezoneWorkflowSuccess" class="section-note" role="status">{{ timezoneWorkflowSuccess }}</p>

    <StaticPageSection data-testid="tenant-section-schedule">
      <template #header>
        <h2 v-explain="'tenantSchedule'" class="static-page-section-heading">Schedule</h2>
      </template>
      <ul class="tenant-settings-rows">
        <!-- DAR-BE-328. Busy windows that move runs out of the way. Each row is its own button (no Open text). -->
        <li>
          <button
            type="button"
            class="tenant-settings-row"
            :aria-label="peakPeriods.length || peakError ? 'Open peak periods' : 'Set up peak periods'"
            :disabled="!peakLoaded"
            data-testid="tenant-module-peak-periods"
            @click="router.push({ name: 'settings-tenant-peak-periods' })"
          >
            <span class="tenant-settings-row__label">Peak periods</span>
            <span class="tenant-settings-row__value" :class="{ 'tenant-settings-row__dim': !peakPeriods.length }" data-testid="tenant-peak-value">{{ peakLoaded ? peakValue : 'Loading…' }}</span>
            <span class="tenant-settings-row__go" aria-hidden="true">→</span>
          </button>
        </li>
        <!-- DAR-BE-328. Orders waiting to reach the other system, watched on a pulse. -->
        <li>
          <button
            type="button"
            class="tenant-settings-row"
            :aria-label="syncPairs.length || syncError ? 'Open sync pulse' : 'Set up sync pulse'"
            :disabled="!syncLoaded"
            data-testid="tenant-module-sync-pulse"
            @click="router.push({ name: 'settings-tenant-sync-pairs' })"
          >
            <span class="tenant-settings-row__label">Sync pulse</span>
            <span class="tenant-settings-row__value" :class="{ 'tenant-settings-row__dim': !syncView.pulsing.length }" data-testid="tenant-sync-value">{{ syncLoaded ? syncValue : 'Loading…' }}</span>
            <span class="tenant-settings-row__go" aria-hidden="true">→</span>
          </button>
        </li>
      </ul>
    </StaticPageSection>
  </StaticPageFrame>

  <div
    v-if="timezoneOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tenant-settings-workflow-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="tenant-settings-workflow-title">Timezone</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Set the tenant timezone."
          :primary-label="timezonePrimaryLabel"
          primary-action-variant="save"
          primary-test-id="save-tenant-timezone"
          :submit-disabled="timezoneSaveDisabled"
          :show-primary-action="canEditTenantSettings"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="tenant-timezone-workflow-cancel"
          @cancel="closePopup"
          @submit="saveTimezoneSettings"
        >
          <InlineValidation v-if="timezoneWorkflowError" tone="error" :message="timezoneWorkflowError" />

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Timezone</span>
            <AppSelect
              v-model="timezoneForm.timeZone"
              :options="timezoneOptions"
              :disabled="!canEditTenantSettings || timezoneWorkflowSaving"
              searchable
              search-placeholder="Search timezones"
              test-id="tenant-timezone-select"
            />
          </label>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { peakFacade, settingsFacade } from '../../lib/api/facade'
import type { SyncPairSummary } from '../../lib/api/pulseTypes'
import type { PeakPeriodSummary } from '../../lib/api/peakTypes'
import { peakSettingsValue } from '../../lib/peakPeriodWords'
import { loadSyncPulseView, syncPulseSettingsValue, type SyncPulseView } from '../../lib/syncPulseView'
import type { TenantChatSpace, TenantSettings } from '../../lib/api/types'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReferenceDataStore } from '../../stores/referenceData'
import { buildTimezoneOptions } from '../../lib/timezones'
import { normalizeStringOrEmpty } from '../../lib/utils/strings'

const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const referenceDataStore = useReferenceDataStore()

const chatSpaces = ref<TenantChatSpace[]>([])
const chatSpacesLoading = ref(false)
const chatSpacesError = ref<string | null>(null)
const summaryLoading = computed(() => (
  referenceDataStore.tenantSettingsLoading || chatSpacesLoading.value
))
// A read that failed is not an answer: its fact or row holds '—' and this line says so (never "None").
const summaryError = computed(() => {
  const failed = [referenceDataStore.tenantSettingsError, chatSpacesError.value, peakError.value, syncError.value].some(Boolean)
  return failed ? 'Some tenant settings could not be loaded.' : null
})
const tenantSettings = computed<TenantSettings | null>(() => referenceDataStore.tenantSettings)
// The effective tenant timezone, resolved through the same fallback chain the save form seeds
// from. Always a real zone id — never a placeholder — because the edit form writes this value.
const resolvedTenantTimezone = computed(() => (
  normalizeStringOrEmpty(tenantSettings.value?.timeZone)
  || normalizeStringOrEmpty(authStore.sessionInfo?.timeZone)
  || 'UTC'
))
// Display-only. Until the tenant settings land, the fallback chain reports the SESSION user's
// zone (or UTC) as though it were the tenant's — a wrong answer stated confidently. Withhold it
// rather than show a value that is about to change.
const tenantTimezoneSummary = computed(() => (
  referenceDataStore.tenantSettingsLoading ? '—' : resolvedTenantTimezone.value
))
const timezoneOpen = ref(false)
const timezoneWorkflowError = ref<string | null>(null)
const timezoneWorkflowSuccess = ref<string | null>(null)
const timezoneWorkflowSaving = ref(false)
// An in-flight fetch leaves `chatSpaces` empty, which is indistinguishable from "loaded and
// genuinely empty" unless the loading flag is consulted here. Asserting "None" during the load
// window renders a definitive claim that is simply wrong, then flips once the fetch lands — so
// hold a neutral placeholder until there is an answer to report.
const notificationSummary = computed(() => {
  if (chatSpacesLoading.value || chatSpacesError.value) return '—'
  const count = chatSpaces.value.length
  if (count === 0) return 'No spaces'
  return count === 1 ? '1 space' : `${count} spaces`
})
const timezoneForm = reactive({
  timeZone: 'UTC',
})

const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const activeTenantUserGroupId = computed(() => authStore.sessionInfo?.activeTenantUserGroupId ?? null)
const tenantLabel = computed(() => (
  authStore.sessionInfo?.activeTenantLabel
  || authStore.sessionInfo?.availableTenants?.find((tenant) => tenant.userGroupId === activeTenantUserGroupId.value)?.label
  || activeTenantUserGroupId.value
  || 'Active tenant'
))
// DAR-UI-159: the record's name, as every settings page's header has it ("Rails", not "Rails Settings").
const tenantSettingsTitle = computed(() => (activeTenantUserGroupId.value ? tenantLabel.value : 'Tenant Settings'))

// The header strip (DAR-UI-126): each fact is the button that opens its popup or page.
const facts = computed<StaticFact[]>(() => [
  { key: 'timezone', label: 'Timezone', value: tenantTimezoneSummary.value, explain: 'timezone', interactive: true,
    ariaLabel: `Change tenant timezone: ${tenantTimezoneSummary.value}`, testId: 'tenant-module-timezone' },
  { key: 'notifications', label: 'Notifications', value: notificationSummary.value, explain: 'notificationRoutes',
    interactive: true, ariaLabel: `Open notifications: ${notificationSummary.value}`, testId: 'tenant-module-notifications' },
])

function openFact(key: string): void {
  if (key === 'timezone') openTimezoneWorkflow()
  else if (key === 'notifications') void router.push({ name: 'settings-notifications' })
}

const selectedTimeZone = computed(() => normalizeStringOrEmpty(timezoneForm.timeZone) || resolvedTenantTimezone.value)
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(selectedTimeZone.value))
const timezoneSaveDisabled = computed(() => (
  timezoneWorkflowSaving.value ||
  !canEditTenantSettings.value ||
  normalizeStringOrEmpty(timezoneForm.timeZone).length === 0
))
const timezonePrimaryLabel = computed(() => (
  timezoneWorkflowSaving.value ? 'Saving timezone' : 'Save Timezone'
))

function openTimezoneWorkflow(): void {
  timezoneWorkflowError.value = null
  timezoneWorkflowSuccess.value = null
  timezoneForm.timeZone = resolvedTenantTimezone.value
  timezoneOpen.value = true
}

async function saveTimezoneSettings(): Promise<void> {
  if (timezoneSaveDisabled.value) return

  timezoneWorkflowSaving.value = true
  timezoneWorkflowError.value = null
  timezoneWorkflowSuccess.value = null
  try {
    const response = await authStore.saveTenantSettings({
      timeZone: normalizeStringOrEmpty(timezoneForm.timeZone),
    })
    if (!response?.ok) {
      timezoneWorkflowError.value = response?.errors?.[0] ?? authStore.error ?? 'The timezone is stuck in yesterday. Not saved.'
      return
    }

    // The popup closes here, and reopening it seeds the form from these settings again.
    referenceDataStore.setTenantSettings(response.tenantSettings)
    timezoneWorkflowSuccess.value = response.messages?.[0] ?? 'Saved tenant settings.'
    timezoneOpen.value = false
  } catch (saveError) {
    timezoneWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'The timezone is stuck in yesterday. Not saved.'
  } finally {
    timezoneWorkflowSaving.value = false
  }
}

const pageAbortController = new AbortController()

onBeforeUnmount(() => {
  pageAbortController.abort()
})

async function loadChatSpaces(): Promise<void> {
  chatSpacesLoading.value = true
  chatSpacesError.value = null
  try {
    const response = await settingsFacade.listTenantChatSpaces(pageAbortController.signal)
    chatSpaces.value = response.chatSpaces ?? []
  } catch (loadError) {
    if (isAbortError(loadError)) return
    chatSpacesError.value = loadError instanceof ApiCallError ? loadError.message : 'The chat spaces drifted into outer space.'
  } finally {
    chatSpacesLoading.value = false
  }
}

const peakPeriods = ref<PeakPeriodSummary[]>([])
// DAR-UI-154: the row reads "Loading…", and cannot be pressed, until the list arrives (it read "None · Set up" for a moment first).
const peakLoaded = ref(false)
const peakError = ref(false)
const peakValue = computed(() => (peakError.value ? '—' : peakSettingsValue(peakPeriods.value)))

async function loadPeakPeriods(): Promise<void> {
  try {
    const response = await peakFacade.listPeakPeriods(pageAbortController.signal)
    peakPeriods.value = response.peakPeriods ?? []
  } catch (loadError) {
    if (isAbortError(loadError)) return
    peakPeriods.value = []
    peakError.value = true
  } finally {
    peakLoaded.value = true
  }
}

function closePopup(): void {
  timezoneOpen.value = false
  timezoneWorkflowError.value = null
}

const syncPairs = ref<SyncPairSummary[]>([])
const syncView = ref<SyncPulseView>({ pulsing: [], allowanceOnly: [] })
// DAR-UI-153: the pairs that pulse, not the allowance-only ones a peak period uses.
const syncError = ref(false)
const syncValue = computed(() => (syncError.value ? '—' : syncPulseSettingsValue(syncView.value)))

// Same as the peak row: "Loading…" and not pressable until the reads return, '—' after a failed load.
const syncLoaded = ref(false)
async function loadSyncPairs(): Promise<void> {
  try {
    const loaded = await loadSyncPulseView(pageAbortController.signal)
    syncPairs.value = loaded.pairs
    syncView.value = loaded.view
  } catch (loadError) {
    if (isAbortError(loadError)) return
    syncPairs.value = []
    syncView.value = { pulsing: [], allowanceOnly: [] }
    syncError.value = true
  } finally {
    syncLoaded.value = true
  }
}

onMounted(() => {
  // Reference data is prefetched at login; ensureLoaded() returns the
  // in-flight promise (or resolves immediately if hydration already finished).
  void referenceDataStore.ensureLoaded()
  void loadChatSpaces()
  void loadPeakPeriods()
  void loadSyncPairs()
})
</script>

<style scoped>
/* One bordered list: label | value | arrow, each row its own button with the same minimum height. */
.tenant-settings-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
}

.tenant-settings-rows > li + li {
  border-top: 1px solid var(--static-tile-border);
}

.tenant-settings-row {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) auto;
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
  transition: background-color var(--motion-fast) var(--ease-out);
}

.tenant-settings-row:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.tenant-settings-row:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

/* Loading: the row still reads, it is only inert. */
.tenant-settings-row:disabled {
  cursor: default;
}

.tenant-settings-row__label,
.tenant-settings-row__value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.tenant-settings-row__dim {
  color: var(--text-dim);
}

.tenant-settings-row__go {
  color: var(--text-dim);
}

@media (max-width: 768px) {
  .tenant-settings-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'label go'
      'value go';
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .tenant-settings-row__label {
    grid-area: label;
  }

  .tenant-settings-row__value {
    grid-area: value;
  }

  .tenant-settings-row__go {
    grid-area: go;
  }
}
</style>
