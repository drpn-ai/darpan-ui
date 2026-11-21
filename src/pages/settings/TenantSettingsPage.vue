<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isPopupOpen }">
    <template #hero>
      <h1>{{ tenantSettingsTitle }}</h1>
    </template>

    <LoadingState v-if="summaryLoading" noun="tenant settings" />
    <InlineValidation v-if="summaryError" tone="error" :message="summaryError" />

    <StaticPageSection title="Chat" data-testid="tenant-section-chat">
      <ul class="tenant-settings-rows">
        <!-- DAR-UI-123. The spaces, and what posts to each, are on their own page. -->
        <li class="tenant-settings-row">
          <span v-explain="'notificationRoutes'" class="tenant-settings-row__label">Notifications</span>
          <span class="tenant-settings-row__value">{{ notificationSummary }}</span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              aria-label="Open notifications"
              data-testid="tenant-module-notifications"
              @click="router.push({ name: 'settings-notifications' })"
            >
              Open <span aria-hidden="true">→</span>
            </button>
          </span>
        </li>
      </ul>
    </StaticPageSection>

    <StaticPageSection title="Time" data-testid="tenant-section-time">
      <ul class="tenant-settings-rows">
        <li class="tenant-settings-row">
          <span class="tenant-settings-row__label">Timezone</span>
          <span class="tenant-settings-row__value">{{ tenantTimezoneSummary }}</span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              class="app-icon-action"
              aria-label="Change tenant timezone"
              title="Change tenant timezone"
              data-testid="tenant-module-timezone"
              @click="openTimezoneWorkflow"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="editIconPath" fill="currentColor" />
              </svg>
            </button>
          </span>
        </li>
      </ul>
      <p v-if="timezoneWorkflowSuccess" class="section-note" role="status">{{ timezoneWorkflowSuccess }}</p>
    </StaticPageSection>

    <StaticPageSection title="Audit" data-testid="tenant-section-audit">
      <ul class="tenant-settings-rows">
        <!-- DAR-BE-160. Versions of this tenant's audit config, and restoring one. -->
        <li class="tenant-settings-row">
          <span class="tenant-settings-row__label">Config history</span>
          <span class="tenant-settings-row__value tenant-settings-row__dim">Versions and restores</span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              aria-label="Open config history"
              data-testid="tenant-module-config-history"
              @click="router.push({ name: 'settings-tenant-config-history' })"
            >
              Open <span aria-hidden="true">→</span>
            </button>
          </span>
        </li>
        <!-- DAR-BE-164. This tenant's JEXL scripts. -->
        <li class="tenant-settings-row">
          <span class="tenant-settings-row__label">Scripts</span>
          <span class="tenant-settings-row__value tenant-settings-row__dim">JEXL used by checks</span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              aria-label="Open scripts"
              data-testid="tenant-module-scripts"
              @click="router.push({ name: 'settings-tenant-scripts' })"
            >
              Open <span aria-hidden="true">→</span>
            </button>
          </span>
        </li>
        <!-- DAR-BE-328. Busy windows that move runs out of the way. -->
        <li class="tenant-settings-row">
          <span class="tenant-settings-row__label">Peak periods</span>
          <span class="tenant-settings-row__value" :class="{ 'tenant-settings-row__dim': !peakPeriods.length }" data-testid="tenant-peak-value">{{ peakValue }}</span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              :aria-label="peakPeriods.length ? 'Open peak periods' : 'Set up peak periods'"
              data-testid="tenant-module-peak-periods"
              @click="router.push({ name: 'settings-tenant-peak-periods' })"
            >
              <template v-if="peakPeriods.length">Open <span aria-hidden="true">→</span></template>
              <template v-else>Set up</template>
            </button>
          </span>
        </li>
        <!-- DAR-BE-328. Orders waiting to reach the other system, watched on a pulse. -->
        <li class="tenant-settings-row">
          <span class="tenant-settings-row__label">Sync pulse</span>
          <span class="tenant-settings-row__value" :class="{ 'tenant-settings-row__dim': !syncPairs.length }" data-testid="tenant-sync-value">{{ syncValue }}</span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              :aria-label="syncPairs.length ? 'Open sync pulse' : 'Set up sync pulse'"
              data-testid="tenant-module-sync-pulse"
              @click="router.push({ name: 'settings-tenant-sync-pairs' })"
            >
              <template v-if="syncPairs.length">Open <span aria-hidden="true">→</span></template>
              <template v-else>Set up</template>
            </button>
          </span>
        </li>
      </ul>
    </StaticPageSection>

    <StaticPageSection v-if="canManageGlobalSettings" title="AI" data-testid="tenant-section-ai">
      <p v-if="aiLoading" class="section-note">Loading AI provider settings...</p>
      <InlineValidation v-else-if="aiError" tone="error" :message="aiError" />
      <ul v-else-if="selectedAiProvider" class="tenant-settings-rows" data-testid="tenant-ai-providers">
        <li class="tenant-settings-row">
          <span class="tenant-settings-row__label">Provider</span>
          <span class="tenant-settings-row__value">
            {{ selectedAiProvider.label }}<span class="tenant-settings-row__dim"> · {{ selectedAiProvider.llmModel || 'Model not set' }} · {{ providerSummary(selectedAiProvider) }}</span>
          </span>
          <span class="tenant-settings-row__actions">
            <button
              type="button"
              class="app-icon-action"
              aria-label="Edit AI provider"
              title="Edit AI provider"
              data-testid="tenant-ai-provider-tile"
              @click="openAiProviderWorkflow"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="editIconPath" fill="currentColor" />
              </svg>
            </button>
          </span>
        </li>
      </ul>
      <p v-if="aiSuccess" class="section-note" role="status">{{ aiSuccess }}</p>
    </StaticPageSection>
  </StaticPageFrame>

  <div
    v-if="isPopupOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="tenant-settings-workflow-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="tenant-settings-workflow-title">{{ popupTitle }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          v-if="activePopup?.type === 'timezone'"
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

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'ai-menu'"
          class="workflow-form--popup-compact"
          question="What do you want to do with the AI provider?"
          :show-primary-action="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="tenant-ai-workflow-cancel"
          @cancel="closePopup"
        >
          <WorkflowShortcutChoiceCards
            :options="aiProviderWorkflowOptions"
            test-id-prefix="tenant-ai-provider-workflow"
            @choose="handleAiProviderWorkflowChoice"
          />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'ai'"
          :class="[
            'workflow-form--popup-compact',
            {
              'workflow-form--edit-single-page': isAiEditing,
            },
          ]"
          :question="aiCurrentQuestion"
          :primary-label="aiPrimaryLabel"
          :primary-action-variant="aiPrimaryActionVariant"
          :show-back="showAiBack"
          :show-enter-hint="!isAiEditing"
          :allow-select-enter="isAiCreateSelectStep"
          :submit-disabled="aiSubmitDisabled"
          :show-primary-action="canManageGlobalSettings"
          show-cancel-action
          cancel-test-id="tenant-ai-workflow-cancel"
          primary-test-id="save-tenant-llm-settings"
          @back="goBackAiStep"
          @cancel="closePopup"
          @submit="handleAiSubmit"
        >
          <InlineValidation v-if="aiWorkflowError" tone="error" :message="aiWorkflowError" />

          <template v-if="isAiEditing">
            <div class="workflow-form-grid workflow-form-grid--two">
              <label class="wizard-input-shell">
                <span class="workflow-context-label">Provider</span>
                <AppSelect
                  v-model="aiForm.llmProvider"
                  :options="providerOptions"
                  :disabled="true"
                  test-id="tenant-llm-provider"
                />
              </label>

              <label class="wizard-input-shell">
                <span class="workflow-context-label">Enabled</span>
                <AppSelect
                  v-model="aiForm.llmEnabled"
                  :options="yesNoOptions"
                  test-id="tenant-llm-enabled"
                />
              </label>
            </div>

            <div class="workflow-form-grid workflow-form-grid--two">
              <label class="wizard-input-shell">
                <span class="workflow-context-label">Model</span>
                <input
                  v-model="aiForm.llmModel"
                  class="wizard-answer-control"
                  name="llmModel"
                  type="text"
                  placeholder="gpt-4.1-mini"
                />
              </label>

              <label class="wizard-input-shell">
                <span class="workflow-context-label">Timeout (seconds)</span>
                <input
                  v-model="aiForm.llmTimeoutSeconds"
                  class="wizard-answer-control"
                  name="llmTimeoutSeconds"
                  type="number"
                  min="1"
                />
              </label>
            </div>

            <label class="wizard-input-shell">
              <span class="workflow-context-label">Base URL</span>
              <input
                v-model="aiForm.llmBaseUrl"
                class="wizard-answer-control"
                name="llmBaseUrl"
                type="url"
                placeholder="https://api.openai.com"
              />
            </label>

            <label class="wizard-input-shell">
              <span v-explain="'aiApiKey'" class="workflow-context-label">API Key (leave blank to keep existing)</span>
              <textarea
                v-model="aiForm.llmApiKey"
                class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
                name="llmApiKey"
                rows="1"
                placeholder="Enter a new API key only when needed"
              />
            </label>

            <p v-if="storedKeyStatus" class="muted-copy">{{ storedKeyStatus }}</p>
          </template>

          <template v-else>
            <label v-if="currentAiCreateStep.id === 'llmProvider'" class="wizard-input-shell">
              <WorkflowSelect
                v-model="aiForm.llmProvider"
                test-id="tenant-llm-provider"
                :options="providerOptions"
                placeholder="Select provider"
              />
            </label>

            <label v-else-if="currentAiCreateStep.id === 'llmEnabled'" class="wizard-input-shell">
              <WorkflowSelect
                v-model="aiForm.llmEnabled"
                test-id="tenant-llm-enabled"
                :options="yesNoOptions"
                placeholder="Select enabled state"
              />
            </label>

            <label v-else-if="currentAiCreateStep.id === 'llmModel'" class="wizard-input-shell">
              <input
                v-model="aiForm.llmModel"
                :class="['wizard-answer-control', { empty: !aiForm.llmModel.trim() }]"
                name="llmModel"
                type="text"
                :placeholder="createModelPlaceholder"
              />
            </label>

            <label v-else-if="currentAiCreateStep.id === 'llmBaseUrl'" class="wizard-input-shell">
              <input
                v-model="aiForm.llmBaseUrl"
                :class="['wizard-answer-control', { empty: !normalizeStringOrEmpty(aiForm.llmBaseUrl) }]"
                name="llmBaseUrl"
                type="url"
                :placeholder="createBaseUrlPlaceholder"
              />
            </label>

            <label v-else-if="currentAiCreateStep.id === 'llmTimeoutSeconds'" class="wizard-input-shell">
              <input
                v-model="aiForm.llmTimeoutSeconds"
                :class="['wizard-answer-control', { empty: !normalizeStringOrEmpty(aiForm.llmTimeoutSeconds) }]"
                name="llmTimeoutSeconds"
                type="number"
                min="1"
                :placeholder="createTimeoutPlaceholder"
              />
            </label>

            <label v-else class="wizard-input-shell">
              <input
                v-model="aiForm.llmApiKey"
                class="wizard-answer-control"
                name="llmApiKey"
                type="password"
                autocomplete="off"
                placeholder="Enter API key if needed"
              />
            </label>
          </template>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { ApiCallError } from '../../lib/api/client'
import { peakFacade, pulseFacade, settingsFacade } from '../../lib/api/facade'
import type { SyncPairSummary } from '../../lib/api/pulseTypes'
import type { PeakPeriodSummary } from '../../lib/api/peakTypes'
import { peakSettingsValue } from '../../lib/peakPeriodWords'
import { pulseSettingsValue } from '../../lib/pulseWords'
import type { LlmSettings, TenantChatSpace, TenantSettings } from '../../lib/api/types'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReferenceDataStore } from '../../stores/referenceData'
import { buildTimezoneOptions } from '../../lib/timezones'
import { editIconPath } from '../../lib/iconPaths'
import { normalizeStringOrEmpty } from '../../lib/utils/strings'
import { useTenantSettingsPopup } from '../../composables/useActivePopup'

type LlmProvider = 'OPENAI' | 'GEMINI'

interface ProviderProfile extends LlmSettings {
  activeProvider: LlmProvider
  llmProvider: LlmProvider
  label: string
}

type CreateStepId = 'llmProvider' | 'llmEnabled' | 'llmModel' | 'llmBaseUrl' | 'llmTimeoutSeconds' | 'llmApiKey'

interface CreateStep {
  id: CreateStepId
  title: string
  kind: 'select' | 'text' | 'password' | 'number'
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const referenceDataStore = useReferenceDataStore()

const providerOrder: LlmProvider[] = ['OPENAI', 'GEMINI']
const providerLabels: Record<LlmProvider, string> = {
  OPENAI: 'OpenAI',
  GEMINI: 'Gemini',
}
const providerDefaults: Record<LlmProvider, { llmModel: string; llmBaseUrl: string; llmTimeoutSeconds: string }> = {
  OPENAI: {
    llmModel: 'gpt-4.1-mini',
    llmBaseUrl: 'https://api.openai.com',
    llmTimeoutSeconds: '45',
  },
  GEMINI: {
    llmModel: 'gemini-2.0-flash',
    llmBaseUrl: 'https://generativelanguage.googleapis.com',
    llmTimeoutSeconds: '45',
  },
}
const providerOptions: WorkflowSelectOption[] & AppSelectOption[] = [
  { value: 'OPENAI', label: 'OpenAI' },
  { value: 'GEMINI', label: 'Gemini' },
]
const yesNoOptions: WorkflowSelectOption[] & AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]
const createSteps: CreateStep[] = [
  { id: 'llmProvider', title: 'Which AI provider should Darpan configure?', kind: 'select' },
  { id: 'llmEnabled', title: 'Should this provider be enabled?', kind: 'select' },
  { id: 'llmModel', title: 'What model should this provider use?', kind: 'text' },
  { id: 'llmBaseUrl', title: 'What base URL should this provider use?', kind: 'text' },
  { id: 'llmTimeoutSeconds', title: 'What timeout should this provider use in seconds?', kind: 'number' },
  { id: 'llmApiKey', title: 'What API key should this provider use?', kind: 'password' },
]

const providers = computed<ProviderProfile[]>(() => {
  if (!canManageGlobalSettings.value) return []
  return (['OPENAI', 'GEMINI'] as LlmProvider[]).map((provider) =>
    buildProfile(provider, referenceDataStore.getLlmProvider(provider)),
  )
})
const aiLoading = computed(() => referenceDataStore.llmProvidersLoading)
const aiError = computed(() => referenceDataStore.llmProvidersError)
const aiSuccess = ref<string | null>(null)
const chatSpaces = ref<TenantChatSpace[]>([])
const chatSpacesLoading = ref(false)
const chatSpacesError = ref<string | null>(null)
const summaryLoading = computed(() => (
  referenceDataStore.tenantSettingsLoading || chatSpacesLoading.value
))
const summaryError = computed(() => {
  const errs = [referenceDataStore.tenantSettingsError, chatSpacesError.value].filter(Boolean)
  return errs.length > 0 ? 'Some tenant settings could not be loaded.' : null
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
const timezoneWorkflowError = ref<string | null>(null)
const timezoneWorkflowSuccess = ref<string | null>(null)
const timezoneWorkflowSaving = ref(false)
// An in-flight fetch leaves `chatSpaces` empty, which is indistinguishable from "loaded and
// genuinely empty" unless the loading flag is consulted here. Asserting "None" during the load
// window renders a definitive claim that is simply wrong, then flips once the fetch lands — so
// hold a neutral placeholder until there is an answer to report.
const notificationSummary = computed(() => {
  if (chatSpacesLoading.value) return '—'
  const count = chatSpaces.value.length
  if (count === 0) return 'No spaces'
  return count === 1 ? '1 space' : `${count} spaces`
})
const popup = useTenantSettingsPopup()
const {
  activePopup,
  isPopupOpen,
  isAiEditing,
  openTimezone,
  openAiMenu,
  openAiCreate: openAiCreatePopup,
  openAiEdit: openAiEditPopup,
  close: closeActivePopup,
} = popup
const aiCreateStepIndex = ref(0)
const aiWorkflowSaving = ref(false)
const aiWorkflowLoading = ref(false)
const aiWorkflowError = ref<string | null>(null)
const hasStoredLlmApiKey = ref(false)
const hasFallbackLlmApiKey = ref(false)
const fallbackLlmKeyEnvName = ref('')
const aiForm = reactive({
  llmProvider: '',
  llmModel: '',
  llmBaseUrl: '',
  llmTimeoutSeconds: '',
  llmEnabled: 'Y',
  llmApiKey: '',
})
const timezoneForm = reactive({
  timeZone: 'UTC',
})

const canManageGlobalSettings = computed(() => permissionsStore.canManageGlobalSettings)
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const activeTenantUserGroupId = computed(() => authStore.sessionInfo?.activeTenantUserGroupId ?? null)
const tenantLabel = computed(() => (
  authStore.sessionInfo?.activeTenantLabel
  || authStore.sessionInfo?.availableTenants?.find((tenant) => tenant.userGroupId === activeTenantUserGroupId.value)?.label
  || activeTenantUserGroupId.value
  || 'Active tenant'
))
const tenantSettingsTitle = computed(() => {
  if (!activeTenantUserGroupId.value) return 'Tenant Settings'
  return `${tenantLabel.value} Settings`
})
const selectedAiProvider = computed(() => {
  const directPrimary = providers.value.find((provider) => provider.activeProvider === provider.llmProvider)
  if (directPrimary) return directPrimary

  const activeProvider = providers.value.map((provider) => provider.activeProvider).find((provider) => providerOrder.includes(provider))
  return providers.value.find((provider) => provider.llmProvider === activeProvider) ?? providers.value[0] ?? null
})
const popupTitle = computed(() => {
  if (activePopup.value?.type === 'timezone') return 'Timezone'
  if (activePopup.value?.type === 'ai-menu') return 'AI Provider'
  if (activePopup.value?.type === 'ai') return isAiEditing.value ? 'Edit AI Provider' : 'Configure AI Provider'
  return tenantSettingsTitle.value
})
const aiProviderWorkflowOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const selectedProvider = selectedAiProvider.value
  const options: Array<{ value: string; label: string }> = []
  if (selectedProvider) options.push({ value: 'update', label: `Update ${selectedProvider.label}` })
  options.push(
    { value: 'change', label: 'Change selected provider' },
    { value: 'add', label: 'Add provider settings' },
  )

  return options.map((option, index) => ({
    ...option,
    shortcutKey: String.fromCharCode(65 + index),
  }))
})
const currentAiCreateStep = computed<CreateStep>(() => (
  createSteps[Math.min(aiCreateStepIndex.value, createSteps.length - 1)] ?? createSteps[0]!
))
const aiCurrentQuestion = computed(() => (
  isAiEditing.value
    ? 'Update the AI provider settings.'
    : currentAiCreateStep.value.title
))
const showAiBack = computed(() => !isAiEditing.value && aiCreateStepIndex.value > 0)
const isAiCreateSelectStep = computed(() => !isAiEditing.value && currentAiCreateStep.value.kind === 'select')
const aiPrimaryActionVariant = computed<'default' | 'save'>(() => (
  isAiEditing.value || currentAiCreateStep.value.id === 'llmApiKey'
    ? 'save'
    : 'default'
))
const aiPrimaryLabel = computed(() => (
  isAiEditing.value || currentAiCreateStep.value.id === 'llmApiKey'
    ? (aiWorkflowSaving.value ? 'Saving' : 'Save')
    : 'OK'
))
const aiSubmitDisabled = computed(() => {
  if (!canManageGlobalSettings.value || aiWorkflowSaving.value || aiWorkflowLoading.value) return true
  if (isAiEditing.value) return false

  switch (currentAiCreateStep.value.id) {
    case 'llmProvider':
      return normalizeProvider(aiForm.llmProvider) === null
    case 'llmModel':
      return normalizeStringOrEmpty(aiForm.llmModel).length === 0
    case 'llmBaseUrl':
      return normalizeStringOrEmpty(aiForm.llmBaseUrl).length === 0
    case 'llmTimeoutSeconds':
      return !/^\d+$/.test(normalizeStringOrEmpty(aiForm.llmTimeoutSeconds)) || Number(aiForm.llmTimeoutSeconds) < 1
    default:
      return false
  }
})
const storedKeyStatus = computed(() => {
  if (hasStoredLlmApiKey.value) return 'A stored API key is already configured for this provider.'
  if (hasFallbackLlmApiKey.value && fallbackLlmKeyEnvName.value) {
    return `Environment fallback ${fallbackLlmKeyEnvName.value} is currently active.`
  }
  return 'No stored API key is configured yet.'
})
const createProviderDefaults = computed(() => {
  const normalizedProvider = normalizeProvider(aiForm.llmProvider)
  return normalizedProvider ? providerDefaults[normalizedProvider] : null
})
const createModelPlaceholder = computed(() => createProviderDefaults.value?.llmModel ?? 'Enter model')
const createBaseUrlPlaceholder = computed(() => createProviderDefaults.value?.llmBaseUrl ?? 'Enter base URL')
const createTimeoutPlaceholder = computed(() => createProviderDefaults.value?.llmTimeoutSeconds ?? 'Enter timeout')
const selectedTimeZone = computed(() => (
  normalizeStringOrEmpty(timezoneForm.timeZone)
  || normalizeStringOrEmpty(tenantSettings.value?.timeZone)
  || normalizeStringOrEmpty(authStore.sessionInfo?.timeZone)
  || 'UTC'
))
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(selectedTimeZone.value))
const timezoneSaveDisabled = computed(() => (
  timezoneWorkflowSaving.value ||
  !canEditTenantSettings.value ||
  normalizeStringOrEmpty(timezoneForm.timeZone).length === 0
))
const timezonePrimaryLabel = computed(() => (
  timezoneWorkflowSaving.value ? 'Saving timezone' : 'Save Timezone'
))

function normalizeProvider(rawProvider: unknown): LlmProvider | null {
  const normalized = normalizeStringOrEmpty(rawProvider).toUpperCase()
  if (normalized === 'OPENAI' || normalized === 'GEMINI') return normalized
  return null
}

function buildProfile(llmProvider: LlmProvider, settings?: LlmSettings | null): ProviderProfile {
  return {
    activeProvider: normalizeProvider(settings?.activeProvider) ?? llmProvider,
    llmProvider,
    llmModel: settings?.llmModel ?? '',
    llmBaseUrl: settings?.llmBaseUrl ?? '',
    llmTimeoutSeconds: settings?.llmTimeoutSeconds ?? '',
    llmEnabled: settings?.llmEnabled ?? 'Y',
    hasStoredLlmApiKey: settings?.hasStoredLlmApiKey,
    hasFallbackLlmApiKey: settings?.hasFallbackLlmApiKey,
    fallbackLlmKeyEnvName: settings?.fallbackLlmKeyEnvName,
    label: providerLabels[llmProvider],
  }
}

function providerSummary(provider: ProviderProfile): string {
  const parts = [
    provider.activeProvider === provider.llmProvider ? 'Primary' : 'Available',
    provider.llmEnabled === 'N' ? 'Disabled' : 'Enabled',
    provider.hasStoredLlmApiKey ? 'Key stored' : 'No stored key',
  ]
  return parts.join(' · ')
}

function resetAiForm(): void {
  aiCreateStepIndex.value = 0
  aiWorkflowSaving.value = false
  aiWorkflowLoading.value = false
  aiWorkflowError.value = null
  aiForm.llmProvider = ''
  aiForm.llmModel = ''
  aiForm.llmBaseUrl = ''
  aiForm.llmTimeoutSeconds = ''
  aiForm.llmEnabled = 'Y'
  aiForm.llmApiKey = ''
  hasStoredLlmApiKey.value = false
  hasFallbackLlmApiKey.value = false
  fallbackLlmKeyEnvName.value = ''
}

function applyTenantSettings(nextSettings?: TenantSettings | null): void {
  referenceDataStore.setTenantSettings(nextSettings)
  const nextTimeZone = normalizeStringOrEmpty(nextSettings?.timeZone) || normalizeStringOrEmpty(authStore.sessionInfo?.timeZone) || 'UTC'
  timezoneForm.timeZone = nextTimeZone
}

function openTimezoneWorkflow(): void {
  timezoneWorkflowError.value = null
  timezoneWorkflowSuccess.value = null
  timezoneForm.timeZone = normalizeStringOrEmpty(resolvedTenantTimezone.value) || 'UTC'
  openTimezone()
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

    applyTenantSettings(response.tenantSettings)
    timezoneWorkflowSuccess.value = response.messages?.[0] ?? 'Saved tenant settings.'
    closeActivePopup()
  } catch (saveError) {
    timezoneWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'The timezone is stuck in yesterday. Not saved.'
  } finally {
    timezoneWorkflowSaving.value = false
  }
}

function applyAiSettings(settings: ProviderProfile | LlmSettings, fallbackProvider?: LlmProvider): void {
  const provider = normalizeProvider(settings.llmProvider) ?? fallbackProvider ?? 'OPENAI'
  aiForm.llmProvider = provider
  aiForm.llmModel = settings.llmModel ?? ''
  aiForm.llmBaseUrl = settings.llmBaseUrl ?? ''
  aiForm.llmTimeoutSeconds = settings.llmTimeoutSeconds ?? ''
  aiForm.llmEnabled = settings.llmEnabled ?? 'Y'
  aiForm.llmApiKey = ''
  hasStoredLlmApiKey.value = !!settings.hasStoredLlmApiKey
  hasFallbackLlmApiKey.value = !!settings.hasFallbackLlmApiKey
  fallbackLlmKeyEnvName.value = settings.fallbackLlmKeyEnvName ?? ''
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
    if ((loadError as { name?: string })?.name === 'AbortError') return
    chatSpacesError.value = loadError instanceof ApiCallError ? loadError.message : 'The chat spaces drifted into outer space.'
  } finally {
    chatSpacesLoading.value = false
  }
}

const peakPeriods = ref<PeakPeriodSummary[]>([])
const peakValue = computed(() => peakSettingsValue(peakPeriods.value))

// The row reads "None" until the list arrives; a failed load leaves it so.
async function loadPeakPeriods(): Promise<void> {
  try {
    const response = await peakFacade.listPeakPeriods(pageAbortController.signal)
    peakPeriods.value = response.peakPeriods ?? []
  } catch {
    peakPeriods.value = []
  }
}

async function loadAiProvider(llmProvider: LlmProvider): Promise<void> {
  aiWorkflowLoading.value = true
  aiWorkflowError.value = null
  try {
    let llmSettings = referenceDataStore.getLlmProvider(llmProvider)
    if (!llmSettings) {
      const response = await settingsFacade.getLlmSettings({ llmProvider }, pageAbortController.signal)
      llmSettings = response.llmSettings ?? null
      if (llmSettings) referenceDataStore.setLlmProvider(llmProvider, llmSettings)
    }
    if (!llmSettings) {
      aiWorkflowError.value = `AI provider "${llmProvider}" hallucinated itself out of existence.`
      return
    }
    applyAiSettings(llmSettings, llmProvider)
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    aiWorkflowError.value = loadError instanceof ApiCallError ? loadError.message : 'The AI provider settings are thinking really hard. Too hard.'
  } finally {
    aiWorkflowLoading.value = false
  }
}

function openAiProviderWorkflow(): void {
  if (!canManageGlobalSettings.value) return
  aiSuccess.value = null
  resetAiForm()
  openAiMenu()
}

function handleAiProviderWorkflowChoice(value: string): void {
  if (value === 'update') {
    openAiEdit(selectedAiProvider.value?.llmProvider)
    return
  }

  if (value === 'change' || value === 'add') {
    openAiCreate()
  }
}

function openAiCreate(): void {
  if (!canManageGlobalSettings.value) return
  aiSuccess.value = null
  resetAiForm()
  openAiCreatePopup()
}

function openAiEdit(rawProvider: unknown): void {
  if (!canManageGlobalSettings.value) return
  const llmProvider = normalizeProvider(rawProvider)
  if (!llmProvider) return

  aiSuccess.value = null
  resetAiForm()
  openAiEditPopup()
  const provider = providers.value.find((nextProvider) => nextProvider.llmProvider === llmProvider)
  if (provider) {
    applyAiSettings(provider, llmProvider)
  } else {
    aiForm.llmProvider = llmProvider
    void loadAiProvider(llmProvider)
  }
}

function closePopup(): void {
  closeActivePopup()
  resetAiForm()
  timezoneWorkflowError.value = null
  if (route.query.workflow) {
    void router.replace('/settings/tenant')
  }
}

function applyCreateDefaults(): void {
  const provider = normalizeProvider(aiForm.llmProvider)
  if (!provider) return

  const defaults = providerDefaults[provider]
  if (!normalizeStringOrEmpty(aiForm.llmModel)) aiForm.llmModel = defaults.llmModel
  if (!normalizeStringOrEmpty(aiForm.llmBaseUrl)) aiForm.llmBaseUrl = defaults.llmBaseUrl
  if (!normalizeStringOrEmpty(aiForm.llmTimeoutSeconds)) aiForm.llmTimeoutSeconds = defaults.llmTimeoutSeconds
}

function goNextAiStep(): void {
  if (currentAiCreateStep.value.id === 'llmProvider') applyCreateDefaults()
  aiCreateStepIndex.value = Math.min(aiCreateStepIndex.value + 1, createSteps.length - 1)
}

function goBackAiStep(): void {
  aiWorkflowError.value = null
  aiCreateStepIndex.value = Math.max(aiCreateStepIndex.value - 1, 0)
}

async function handleAiSubmit(): Promise<void> {
  if (isAiEditing.value || currentAiCreateStep.value.id === 'llmApiKey') {
    await saveAiSettings()
    return
  }

  goNextAiStep()
}

async function saveAiSettings(): Promise<void> {
  if (!canManageGlobalSettings.value) {
    aiWorkflowError.value = 'Only Darpan admins can update AI settings.'
    return
  }

  const provider = normalizeProvider(aiForm.llmProvider)
  if (!provider) {
    aiWorkflowError.value = 'Choose an AI provider.'
    return
  }

  aiWorkflowSaving.value = true
  aiWorkflowError.value = null
  try {
    const response = await settingsFacade.saveLlmSettings({
      llmProvider: provider,
      llmModel: normalizeStringOrEmpty(aiForm.llmModel),
      llmBaseUrl: normalizeStringOrEmpty(aiForm.llmBaseUrl),
      llmTimeoutSeconds: normalizeStringOrEmpty(aiForm.llmTimeoutSeconds),
      llmEnabled: aiForm.llmEnabled,
      llmApiKey: aiForm.llmApiKey,
    })
    closeActivePopup()
    resetAiForm()
    aiSuccess.value = response.messages?.[0] ?? 'Saved LLM settings.'
    await referenceDataStore.refreshLlmProviders()
  } catch (saveError) {
    aiWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'The AI provider settings forgot what you said. Not saved.'
  } finally {
    aiWorkflowSaving.value = false
  }
}


function openRouteRequestedWorkflow(): void {
  const workflow = String(route.query.workflow ?? '')
  if (workflow === 'ai-create') {
    openAiCreate()
    return
  }

  if (workflow === 'ai-edit') {
    openAiEdit(route.query.llmProvider)
    return
  }

  if (workflow === 'timezone') {
    openTimezoneWorkflow()
  }
}

watch(
  () => [route.query.workflow, route.query.llmProvider],
  openRouteRequestedWorkflow,
  { immediate: true },
)

const syncPairs = ref<SyncPairSummary[]>([])
const syncValue = computed(() => pulseSettingsValue(syncPairs.value))

// Same as the peak row: "None" until the list arrives, and after a failed load.
async function loadSyncPairs(): Promise<void> {
  try {
    const response = await pulseFacade.listSyncPairs(pageAbortController.signal)
    syncPairs.value = response.syncPairs ?? []
  } catch {
    syncPairs.value = []
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
/* One bordered list per group: label | value | actions, every row the same minimum height. */
.tenant-settings-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.tenant-settings-row {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.5rem;
  padding: var(--space-1) var(--space-3);
  font-size: var(--static-tile-text-size);
}

.tenant-settings-row + .tenant-settings-row {
  border-top: 1px solid var(--static-tile-border);
}

.tenant-settings-row__label,
.tenant-settings-row__name,
.tenant-settings-row__value {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* A chat space sits under Spaces. Its name is this tenant's data, so it is not a *label* class
   the mascot would look up in the glossary. */
.tenant-settings-row--sub .tenant-settings-row__name {
  padding-left: var(--space-3);
}

.tenant-settings-row__dim {
  color: var(--text-dim);
}

.tenant-settings-row__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-1);
}

.tenant-settings-row__actions button:not(.app-icon-action) {
  min-height: 2.2rem;
  padding: var(--space-0) var(--space-2);
  font-size: var(--type-label-size);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .tenant-settings-row {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'label label'
      'value actions';
    gap: var(--space-1) var(--space-2);
    padding: var(--space-2) var(--space-3);
  }

  .tenant-settings-row__label,
  .tenant-settings-row__name {
    grid-area: label;
  }

  .tenant-settings-row__value {
    grid-area: value;
  }

  .tenant-settings-row__actions {
    grid-area: actions;
  }
}
</style>
