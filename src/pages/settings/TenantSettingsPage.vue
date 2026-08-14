<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isPopupOpen }">
    <template #hero>
      <h1>{{ tenantSettingsTitle }}</h1>
    </template>

    <p v-if="summaryLoading" class="section-note">Loading tenant settings...</p>
    <InlineValidation v-if="summaryError" tone="error" :message="summaryError" />

    <StaticPageSection>
      <template #header>
        <div class="static-page-section-header-row">
          <h2 class="static-page-section-heading">AI Configuration</h2>
        </div>
      </template>

      <p v-if="!canManageGlobalSettings" class="section-note">Darpan admin only</p>
      <p v-else-if="aiLoading" class="section-note">Loading AI provider settings...</p>
      <InlineValidation v-else-if="aiError" tone="error" :message="aiError" />

      <div
        v-else-if="selectedAiProvider"
        class="static-page-tile-grid static-page-record-grid tenant-settings-list-grid"
        data-testid="tenant-ai-providers"
      >
        <button
          type="button"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="tenant-ai-provider-tile"
          @click="openAiProviderWorkflow"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">{{ selectedAiProvider.label }}</span>
              <span class="static-page-list-tile__meta">{{ selectedAiProvider.llmModel || 'Model not set' }}</span>
            </span>
            <span class="tenant-settings-list-status">{{ providerSummary(selectedAiProvider) }}</span>
          </span>
        </button>
      </div>
      <button
        v-else
        type="button"
        class="static-page-tile static-page-record-tile static-page-list-tile"
        data-testid="tenant-ai-provider-tile"
        @click="openAiProviderWorkflow"
      >
        <span class="tenant-settings-list-row">
          <span class="tenant-settings-list-main">
            <span class="static-page-tile-title static-page-list-tile__title">No AI provider selected</span>
            <span class="static-page-list-tile__meta">Configure a provider for this tenant.</span>
          </span>
          <span class="tenant-settings-list-status">Not configured</span>
        </span>
      </button>

      <p v-if="aiSuccess" class="section-note" role="status">{{ aiSuccess }}</p>
    </StaticPageSection>

    <StaticPageSection title="Localization">
      <div class="static-page-tile-grid static-page-record-grid tenant-settings-list-grid">
        <button
          type="button"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="tenant-module-timezone"
          @click="openTimezoneWorkflow"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">Timezone</span>
            </span>
            <span class="tenant-settings-list-status">{{ tenantTimezoneSummary }}</span>
          </span>
        </button>
      </div>
      <p v-if="timezoneWorkflowSuccess" class="section-note" role="status">{{ timezoneWorkflowSuccess }}</p>
    </StaticPageSection>

    <StaticPageSection title="Operations">
      <div class="static-page-tile-grid static-page-record-grid tenant-settings-list-grid">
        <button
          type="button"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="tenant-module-notifications"
          @click="openNotificationWorkflow"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">Notifications</span>
            </span>
            <span class="tenant-settings-list-status">{{ notificationSummary }}</span>
          </span>
        </button>
      </div>
      <p v-if="notificationWorkflowSuccess" class="section-note" role="status">{{ notificationWorkflowSuccess }}</p>
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
          v-else-if="activePopup?.type === 'notification-menu'"
          class="workflow-form--popup-compact"
          question="Which Google Chat space?"
          :show-primary-action="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="tenant-notification-workflow-close"
          @cancel="closePopup"
        >
          <InlineValidation v-if="chatSpacesError" tone="error" :message="chatSpacesError" />
          <WorkflowShortcutChoiceCards
            :options="chatSpaceListOptions"
            test-id-prefix="tenant-chat-space"
            @choose="handleChatSpaceListChoice"
          />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'chat-space-menu'"
          class="workflow-form--popup-compact"
          :question="chatSpaceMenuQuestion"
          :show-primary-action="false"
          show-back
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="tenant-chat-space-menu-cancel"
          @back="backToChatSpaceList"
          @cancel="closePopup"
        >
          <InlineValidation v-if="notificationWorkflowError" tone="error" :message="notificationWorkflowError" />
          <WorkflowShortcutChoiceCards
            :options="chatSpaceActionOptions"
            test-id-prefix="tenant-chat-space-menu"
            @choose="handleChatSpaceMenuChoice"
          />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'chat-space-form'"
          class="workflow-form--popup-compact workflow-form--dense-popup"
          :question="chatSpaceFormQuestion"
          :primary-label="chatSpaceFormPrimaryLabel"
          :primary-action-variant="chatSpaceFormPrimaryVariant"
          :primary-test-id="chatSpaceFormPrimaryTestId"
          :submit-disabled="chatSpaceFormSubmitDisabled"
          :show-primary-action="canEditTenantSettings"
          :show-back="chatSpaceFormStepIndex > 0"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="tenant-chat-space-form-cancel"
          @back="goBackChatSpaceFormStep"
          @cancel="closePopup"
          @submit="submitChatSpaceFormStep"
        >
          <InlineValidation v-if="notificationWorkflowError" tone="error" :message="notificationWorkflowError" />

          <label v-if="currentChatSpaceFormStep.id === 'name'" class="wizard-input-shell">
            <span class="workflow-context-label">Space name</span>
            <input
              v-model="chatSpaceForm.spaceName"
              class="wizard-answer-control"
              name="chatSpaceName"
              type="text"
              autocomplete="off"
              placeholder="Operations"
              :disabled="!canEditTenantSettings || chatSpaceFormSaving"
            />
          </label>

          <label v-else class="wizard-input-shell">
            <span class="workflow-context-label">Webhook URL</span>
            <input
              v-model="chatSpaceForm.googleChatWebhookUrl"
              class="wizard-answer-control"
              name="googleChatWebhookUrl"
              type="password"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              :placeholder="chatSpaceWebhookPlaceholder"
              :disabled="!canEditTenantSettings || chatSpaceFormSaving"
            />
          </label>

          <p
            v-if="currentChatSpaceFormStep.id === 'webhook' && isChatSpaceEditing && activeChatSpace?.googleChatConfigured"
            class="tenant-notification-current-webhook"
            data-testid="google-chat-webhook-status"
          >
            Current webhook: {{ activeChatSpace.googleChatWebhookUrl || 'Configured' }}
          </p>
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
              <span class="workflow-context-label">API Key (leave blank to keep existing)</span>
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
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { LlmSettings, TenantChatSpace, TenantSettings } from '../../lib/api/types'
import type { SaveTenantChatSpacePayload } from '../../lib/api/facadeTypes'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { useReferenceDataStore } from '../../stores/referenceData'
import { buildTimezoneOptions } from '../../lib/timezones'
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

type ChatSpaceFormStepId = 'name' | 'webhook'

interface ChatSpaceFormStep {
  id: ChatSpaceFormStepId
  question: string
}

type ChatSpaceMenuChoice = 'edit' | 'activate' | 'deactivate' | 'delete'

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
const chatSpaceFormSteps: ChatSpaceFormStep[] = [
  { id: 'name', question: 'Name this Google Chat space.' },
  { id: 'webhook', question: 'Paste the Google Chat webhook URL.' },
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
// genuinely empty" unless the loading flag is consulted here. Asserting "Not configured" during
// the load window renders a definitive claim that is simply wrong, then flips once the fetch
// lands — so hold a neutral placeholder until there is an answer to report.
const notificationSummary = computed(() => {
  if (chatSpacesLoading.value) return '—'
  return chatSpaces.value.length > 0 ? `${chatSpaces.value.length} spaces` : 'Not configured'
})
const notificationWorkflowError = ref<string | null>(null)
const notificationWorkflowSuccess = ref<string | null>(null)
const chatSpaceMenuSaving = ref(false)
const popup = useTenantSettingsPopup()
const {
  activePopup,
  isPopupOpen,
  isAiEditing,
  isChatSpaceEditing,
  openTimezone,
  openNotificationMenu,
  openChatSpaceMenu,
  openChatSpaceCreate,
  openChatSpaceEdit,
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
const chatSpaceFormStepIndex = ref(0)
const chatSpaceFormSaving = ref(false)
const chatSpaceForm = reactive({
  spaceName: '',
  googleChatWebhookUrl: '',
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
  if (
    activePopup.value?.type === 'notification-menu'
    || activePopup.value?.type === 'chat-space-menu'
    || activePopup.value?.type === 'chat-space-form'
  ) return 'Notifications'
  if (activePopup.value?.type === 'ai-menu') return 'AI Provider'
  if (activePopup.value?.type === 'ai') return isAiEditing.value ? 'Edit AI Provider' : 'Configure AI Provider'
  return tenantSettingsTitle.value
})
const activeChatSpaceId = computed<string | null>(() => {
  if (activePopup.value?.type === 'chat-space-menu') return activePopup.value.chatSpaceId
  if (activePopup.value?.type === 'chat-space-form') return activePopup.value.chatSpaceId ?? null
  return null
})
const activeChatSpace = computed<TenantChatSpace | null>(() => (
  chatSpaces.value.find((space) => space.chatSpaceId === activeChatSpaceId.value) ?? null
))
function chatSpaceStatusLabel(space: TenantChatSpace): string {
  if (!space.googleChatConfigured) return 'Not configured'
  return space.isActive === 'N' ? 'Configured, disabled' : 'Configured'
}
const chatSpaceListOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const options: Array<{ value: string; label: string; description?: string }> = chatSpaces.value.map((space) => ({
    value: space.chatSpaceId,
    label: space.spaceName,
    description: chatSpaceStatusLabel(space),
  }))
  options.push({ value: 'add', label: 'Add a chat space' })

  return options.map((option, index) => ({
    ...option,
    shortcutKey: String.fromCharCode(65 + index),
  }))
})
const chatSpaceMenuQuestion = computed(() => (
  activeChatSpace.value ? `What do you want to do with ${activeChatSpace.value.spaceName}?` : 'What do you want to do with this chat space?'
))
const chatSpaceActionOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const space = activeChatSpace.value
  if (!space) return []

  const options: Array<{ value: ChatSpaceMenuChoice; label: string }> = [
    { value: 'edit', label: 'Edit chat space' },
  ]
  options.push(
    space.isActive === 'N'
      ? { value: 'activate', label: 'Activate space' }
      : { value: 'deactivate', label: 'Deactivate space' },
  )
  if (!space.inUse) options.push({ value: 'delete', label: 'Delete space' })

  return options.map((option, index) => ({
    ...option,
    shortcutKey: String.fromCharCode(65 + index),
  }))
})
const currentChatSpaceFormStep = computed<ChatSpaceFormStep>(() => (
  chatSpaceFormSteps[chatSpaceFormStepIndex.value] ?? chatSpaceFormSteps[0]!
))
const chatSpaceFormQuestion = computed(() => currentChatSpaceFormStep.value.question)
const chatSpaceFormPrimaryVariant = computed<'default' | 'save'>(() => (
  currentChatSpaceFormStep.value.id === 'name' ? 'default' : 'save'
))
const chatSpaceFormPrimaryTestId = computed(() => (
  currentChatSpaceFormStep.value.id === 'name' ? 'chat-space-form-next' : 'save-tenant-chat-space'
))
const chatSpaceFormPrimaryLabel = computed(() => {
  if (currentChatSpaceFormStep.value.id === 'name') return 'Next'
  return chatSpaceFormSaving.value ? 'Saving' : 'Save'
})
const chatSpaceWebhookInput = computed(() => normalizeStringOrEmpty(chatSpaceForm.googleChatWebhookUrl))
const chatSpaceFormHasWebhookForSave = computed(() => (
  chatSpaceWebhookInput.value.length > 0 || (isChatSpaceEditing.value && !!activeChatSpace.value?.googleChatConfigured)
))
const chatSpaceWebhookPlaceholder = computed(() => (
  activeChatSpace.value?.googleChatWebhookUrl
  || 'https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...'
))
const chatSpaceFormSubmitDisabled = computed(() => {
  if (chatSpaceFormSaving.value || !canEditTenantSettings.value) return true
  if (currentChatSpaceFormStep.value.id === 'name') {
    return normalizeStringOrEmpty(chatSpaceForm.spaceName).length === 0
  }
  return !chatSpaceFormHasWebhookForSave.value
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

function applySavedChatSpace(space?: TenantChatSpace | null): void {
  if (!space) return
  const index = chatSpaces.value.findIndex((existing) => existing.chatSpaceId === space.chatSpaceId)
  if (index === -1) {
    chatSpaces.value = [...chatSpaces.value, space]
  } else {
    const next = [...chatSpaces.value]
    next[index] = space
    chatSpaces.value = next
  }
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
      timezoneWorkflowError.value = response?.errors?.[0] ?? authStore.error ?? 'Failed to save tenant timezone.'
      return
    }

    applyTenantSettings(response.tenantSettings)
    timezoneWorkflowSuccess.value = response.messages?.[0] ?? 'Saved tenant settings.'
    closeActivePopup()
  } catch (saveError) {
    timezoneWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save tenant timezone.'
  } finally {
    timezoneWorkflowSaving.value = false
  }
}

function openNotificationWorkflow(): void {
  notificationWorkflowError.value = null
  notificationWorkflowSuccess.value = null
  openNotificationMenu()
}

function backToChatSpaceList(): void {
  notificationWorkflowError.value = null
  openNotificationMenu()
}

function resetChatSpaceForm(): void {
  chatSpaceFormStepIndex.value = 0
  chatSpaceFormSaving.value = false
  chatSpaceForm.spaceName = ''
  chatSpaceForm.googleChatWebhookUrl = ''
}

function openChatSpaceCreateForm(): void {
  notificationWorkflowError.value = null
  resetChatSpaceForm()
  openChatSpaceCreate()
}

function openChatSpaceEditForm(): void {
  const space = activeChatSpace.value
  if (!space) return

  notificationWorkflowError.value = null
  resetChatSpaceForm()
  chatSpaceForm.spaceName = space.spaceName
  openChatSpaceEdit(space.chatSpaceId)
}

function handleChatSpaceListChoice(value: string): void {
  if (value === 'add') {
    openChatSpaceCreateForm()
    return
  }

  notificationWorkflowError.value = null
  openChatSpaceMenu(value)
}

function handleChatSpaceMenuChoice(value: string): void {
  if (value === 'edit') {
    openChatSpaceEditForm()
    return
  }

  if (value === 'activate' || value === 'deactivate') {
    void toggleChatSpaceActive(value === 'activate')
    return
  }

  if (value === 'delete') {
    void deleteChatSpace()
  }
}

async function toggleChatSpaceActive(nextActive: boolean): Promise<void> {
  const space = activeChatSpace.value
  if (!space || !canEditTenantSettings.value || chatSpaceMenuSaving.value) return

  chatSpaceMenuSaving.value = true
  notificationWorkflowError.value = null
  try {
    const response = await settingsFacade.saveTenantChatSpace({
      chatSpaceId: space.chatSpaceId,
      spaceName: space.spaceName,
      isActive: nextActive,
    }, pageAbortController.signal)
    applySavedChatSpace(response.chatSpace)
    notificationWorkflowSuccess.value = response.messages?.[0] ?? 'Saved chat space.'
    closePopup()
  } catch (saveError) {
    notificationWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to update chat space.'
  } finally {
    chatSpaceMenuSaving.value = false
  }
}

async function deleteChatSpace(): Promise<void> {
  const space = activeChatSpace.value
  if (!space || !canEditTenantSettings.value || chatSpaceMenuSaving.value) return

  chatSpaceMenuSaving.value = true
  notificationWorkflowError.value = null
  try {
    const response = await settingsFacade.deleteTenantChatSpace({ chatSpaceId: space.chatSpaceId }, pageAbortController.signal)
    chatSpaces.value = chatSpaces.value.filter((existing) => existing.chatSpaceId !== space.chatSpaceId)
    notificationWorkflowSuccess.value = response.messages?.[0] ?? 'Deleted chat space.'
    closePopup()
  } catch (deleteError) {
    notificationWorkflowError.value = deleteError instanceof ApiCallError ? deleteError.message : 'Failed to delete chat space.'
  } finally {
    chatSpaceMenuSaving.value = false
  }
}

function goBackChatSpaceFormStep(): void {
  notificationWorkflowError.value = null
  chatSpaceFormStepIndex.value = Math.max(chatSpaceFormStepIndex.value - 1, 0)
}

async function submitChatSpaceFormStep(): Promise<void> {
  if (chatSpaceFormSubmitDisabled.value) return

  if (currentChatSpaceFormStep.value.id === 'name') {
    chatSpaceFormStepIndex.value = 1
    return
  }

  await saveChatSpaceForm()
}

async function saveChatSpaceForm(): Promise<void> {
  if (chatSpaceFormSubmitDisabled.value) return

  chatSpaceFormSaving.value = true
  notificationWorkflowError.value = null
  try {
    const payload: SaveTenantChatSpacePayload = {
      spaceName: normalizeStringOrEmpty(chatSpaceForm.spaceName),
      isActive: isChatSpaceEditing.value ? (activeChatSpace.value?.isActive ?? 'Y') !== 'N' : true,
    }
    if (isChatSpaceEditing.value && activeChatSpaceId.value) payload.chatSpaceId = activeChatSpaceId.value
    if (chatSpaceWebhookInput.value.length > 0) payload.googleChatWebhookUrl = chatSpaceWebhookInput.value

    const response = await settingsFacade.saveTenantChatSpace(payload, pageAbortController.signal)
    applySavedChatSpace(response.chatSpace)
    notificationWorkflowSuccess.value = response.messages?.[0] ?? 'Saved chat space.'
    closePopup()
  } catch (saveError) {
    notificationWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save chat space.'
  } finally {
    chatSpaceFormSaving.value = false
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
    chatSpacesError.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load chat spaces.'
  } finally {
    chatSpacesLoading.value = false
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
      aiWorkflowError.value = `Unable to find AI provider "${llmProvider}".`
      return
    }
    applyAiSettings(llmSettings, llmProvider)
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    aiWorkflowError.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load AI provider settings.'
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
  resetChatSpaceForm()
  timezoneWorkflowError.value = null
  notificationWorkflowError.value = null
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
    aiWorkflowError.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save AI provider settings.'
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

  if (workflow === 'notifications') {
    openNotificationWorkflow()
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

onMounted(() => {
  // Reference data is prefetched at login; ensureLoaded() returns the
  // in-flight promise (or resolves immediately if hydration already finished).
  void referenceDataStore.ensureLoaded()
  void loadChatSpaces()
})
</script>
