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
      <!-- Rendered on the PAGE, not only inside the popup. The Slack callback returns the admin here
           with no popup open, so a failure reported only in the workflow panel would be invisible —
           a refused authorisation would look exactly like nothing having happened. -->
      <InlineValidation
        v-if="notificationWorkflowError && !isPopupOpen"
        tone="error"
        :message="notificationWorkflowError"
        data-testid="tenant-notification-page-error"
      />
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
          question="Which chat space?"
          :show-primary-action="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="tenant-notification-workflow-close"
          @cancel="closePopup"
        >
          <InlineValidation v-if="chatSpacesError" tone="error" :message="chatSpacesError" />
          <InlineValidation
            v-if="slackLoadError"
            tone="error"
            :message="slackLoadError"
            data-testid="slack-load-error"
          />
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
          v-else-if="activePopup?.type === 'slack-menu'"
          class="workflow-form--popup-compact"
          :question="slackMenuQuestion"
          :show-primary-action="false"
          show-back
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="tenant-slack-menu-cancel"
          @back="backToChatSpaceList"
          @cancel="closePopup"
        >
          <InlineValidation v-if="notificationWorkflowError" tone="error" :message="notificationWorkflowError" />
          <WorkflowShortcutChoiceCards
            :options="slackMenuOptions"
            test-id-prefix="tenant-slack-menu"
            @choose="handleSlackMenuChoice"
          />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'slack-token'"
          class="workflow-form--popup-compact workflow-form--dense-popup"
          question="Paste the bot user OAuth token."
          :primary-label="slackTokenSaving ? 'Checking' : 'Connect'"
          primary-action-variant="save"
          primary-test-id="save-slack-bot-token"
          :submit-disabled="slackTokenSubmitDisabled"
          :show-primary-action="canEditTenantSettings"
          :show-enter-hint="false"
          show-back
          show-cancel-action
          cancel-test-id="tenant-slack-token-cancel"
          @back="openSlackMenu"
          @cancel="closePopup"
          @submit="saveSlackToken"
        >
          <InlineValidation v-if="notificationWorkflowError" tone="error" :message="notificationWorkflowError" />
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Bot user OAuth token</span>
            <input
              v-model="slackTokenInput"
              class="wizard-answer-control"
              name="slackBotToken"
              type="password"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              placeholder="xoxb-..."
              data-testid="slack-bot-token-input"
              :disabled="!canEditTenantSettings || slackTokenSaving"
            />
          </label>
          <p class="section-note">
            Slack app → OAuth &amp; Permissions → Bot User OAuth Token. Darpan checks it with Slack
            before saving.
          </p>
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

          <label v-else-if="currentChatSpaceFormStep.id === 'provider'" class="wizard-input-shell">
            <span class="workflow-context-label">Chat product</span>
            <AppSelect
              v-model="chatSpaceForm.chatProviderEnumId"
              :options="chatProviderOptions"
              :disabled="!canEditTenantSettings || chatSpaceFormSaving"
              test-id="tenant-chat-provider-select"
            />
          </label>

          <template v-else-if="currentChatSpaceFormStep.id === 'channel'">
            <label class="wizard-input-shell">
              <span class="workflow-context-label">Slack channel</span>
              <AppSelect
                v-model="chatSpaceForm.slackChannelId"
                :options="slackChannelOptions"
                :disabled="!canEditTenantSettings || chatSpaceFormSaving || slackChannelsLoading"
                searchable
                search-placeholder="Search channels"
                test-id="tenant-slack-channel-select"
              />
            </label>
            <p v-if="slackChannelsLoading" class="section-note">Loading channels...</p>
            <p
              v-else-if="slackChannelNeedsInvite"
              class="tenant-notification-current-webhook"
              data-testid="slack-invite-note"
            >
              That channel is private — invite the Darpan app to it, or the first run will fail.
            </p>
          </template>

          <label v-else class="wizard-input-shell">
            <span class="workflow-context-label">Webhook URL</span>
            <input
              v-model="chatSpaceForm.webhookUrl"
              class="wizard-answer-control"
              name="webhookUrl"
              type="password"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              :placeholder="chatSpaceWebhookPlaceholder"
              :disabled="!canEditTenantSettings || chatSpaceFormSaving"
            />
          </label>

          <p
            v-if="currentChatSpaceFormStep.id === 'webhook' && chatSpaceProviderChangedOnEdit"
            class="tenant-notification-current-webhook"
            data-testid="chat-provider-changed-note"
          >
            Switching to {{ activeChatProviderLabel }} — paste that product's webhook URL.
          </p>
          <p
            v-else-if="currentChatSpaceFormStep.id === 'webhook' && isChatSpaceEditing && activeChatSpace?.webhookConfigured"
            class="tenant-notification-current-webhook"
            data-testid="google-chat-webhook-status"
          >
            Current webhook: {{ activeChatSpace.webhookUrl || 'Configured' }}
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
import type { ChatProviderId, LlmSettings, SlackChannel, SlackWorkspaceInstall, TenantChatSpace, TenantSettings } from '../../lib/api/types'
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

type ChatSpaceFormStepId = 'name' | 'provider' | 'webhook' | 'channel'

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
/**
 * The third card depends on how this space will actually deliver. With a connected Slack workspace
 * the admin picks a channel from a list Darpan fetches; otherwise they paste a webhook URL, which is
 * also the fallback for a workspace whose admins do not permit app installation.
 */
const chatSpaceFormSteps = computed<ChatSpaceFormStep[]>(() => {
  const steps: ChatSpaceFormStep[] = [{ id: 'name', question: 'Name this chat space.' }]
  // Omitted entirely rather than shown pre-filled: arriving from the Slack menu already answered
  // this, and a card that only needs Next is a step that reads as a mistake.
  if (!chatSpaceProviderPreset.value) {
    steps.push({ id: 'provider', question: 'Which chat product does it post to?' })
  }
  steps.push(usesSlackChannelPicker.value
    ? { id: 'channel', question: 'Which Slack channel should it post to?' }
    : { id: 'webhook', question: 'Paste the incoming webhook URL.' })
  return steps
})
const chatProviderOptions: Array<{ value: ChatProviderId; label: string }> = [
  { value: 'CHAT_PROV_GOOGLE', label: 'Google Chat' },
  { value: 'CHAT_PROV_SLACK', label: 'Slack' },
]
const chatProviderWebhookPlaceholders: Record<ChatProviderId, string> = {
  CHAT_PROV_GOOGLE: 'https://chat.googleapis.com/v1/spaces/.../messages?key=...&token=...',
  CHAT_PROV_SLACK: 'https://hooks.slack.com/services/T.../B.../...',
}

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
const slackInstalls = ref<SlackWorkspaceInstall[]>([])
const slackConfigured = ref(false)
const slackChannels = ref<SlackChannel[]>([])
const slackChannelsLoading = ref(false)
const slackBotUserId = ref<string | null>(null)
const slackConnecting = ref(false)
const slackLoadError = ref<string | null>(null)
/**
 * True when the create form was opened from the Slack menu, which already establishes the provider.
 * Asking again on the next card is a question the operator has just answered by navigating.
 */
const chatSpaceProviderPreset = ref(false)
const slackOauthAvailable = ref(false)
const slackTokenInput = ref('')
const slackTokenSaving = ref(false)
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
  openSlackMenu,
  openSlackTokenForm,
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
  chatProviderEnumId: 'CHAT_PROV_GOOGLE' as ChatProviderId,
  webhookUrl: '',
  slackChannelId: '',
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
    || activePopup.value?.type === 'slack-menu'
    || activePopup.value?.type === 'slack-token'
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
  // The provider is the useful half of this line now that a tenant can have both kinds: two spaces
  // both reading "Configured" gives no way to tell which one posts where.
  const provider = space.chatProviderLabel || 'Google Chat'
  if (!space.webhookConfigured) return `${provider} — not configured`
  return space.isActive === 'N' ? `${provider} — disabled` : provider
}
const chatSpaceListOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const options: Array<{ value: string; label: string; description?: string }> = chatSpaces.value.map((space) => ({
    value: space.chatSpaceId,
    label: space.spaceName,
    description: chatSpaceStatusLabel(space),
  }))
  options.push({ value: 'add', label: 'Add a chat space' })
  options.push(connectedSlackInstall.value
    ? { value: 'slack', label: `Slack: ${connectedSlackInstall.value.teamName ?? 'connected'}` }
    : { value: 'slack', label: 'Connect a Slack workspace' })

  return options.map((option, index) => ({
    ...option,
    shortcutKey: String.fromCharCode(65 + index),
  }))
})
const slackMenuQuestion = computed(() => (
  connectedSlackInstall.value
    ? `${connectedSlackInstall.value.teamName ?? 'This workspace'} is connected. What do you want to do?`
    : 'Connect a Slack workspace to Darpan?'
))
const slackMenuOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const options: Array<{ value: string; label: string; description?: string }> = []
  if (connectedSlackInstall.value) {
    // FIRST, because it is the only reason anyone connected a workspace. Without it this menu offers
    // nothing but workspace maintenance, and the operator who just connected is left with no route
    // to the thing they came for — a channel that actually receives notifications.
    options.push({ value: 'add-space', label: 'Add a chat space', description: 'Choose the channel that gets notified' })
    // The token path is offered here too: re-pasting is how a rotated token gets replaced.
    if (slackOauthAvailable.value) {
      options.push({ value: 'reconnect', label: 'Reconnect workspace', description: 'Re-authorise through Slack' })
    }
    options.push({ value: 'token', label: 'Replace bot token', description: 'Paste a new xoxb- token' })
    options.push({ value: 'disconnect', label: 'Disconnect workspace' })
  } else {
    if (slackOauthAvailable.value) {
      options.push({ value: 'connect', label: 'Connect Slack', description: 'Opens Slack to authorise Darpan' })
    }
    // Always available: it needs nothing configured on the deployment, and it is the only route for
    // a workspace whose admins do not permit installing apps.
    options.push({ value: 'token', label: 'Connect with a bot token', description: 'Paste an xoxb- token from your Slack app' })
  }
  return options.map((option, index) => ({ ...option, shortcutKey: String.fromCharCode(65 + index) }))
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
  chatSpaceFormSteps.value[chatSpaceFormStepIndex.value] ?? chatSpaceFormSteps.value[0]!
))
const chatSpaceFormQuestion = computed(() => currentChatSpaceFormStep.value.question)
// The last card is whichever destination card the provider produced; everything before it advances.
const isChatSpaceFinalStep = computed(() => (
  currentChatSpaceFormStep.value.id === 'webhook' || currentChatSpaceFormStep.value.id === 'channel'
))
const chatSpaceFormPrimaryVariant = computed<'default' | 'save'>(() => (
  isChatSpaceFinalStep.value ? 'save' : 'default'
))
const chatSpaceFormPrimaryTestId = computed(() => (
  isChatSpaceFinalStep.value ? 'save-tenant-chat-space' : 'chat-space-form-next'
))
const chatSpaceFormPrimaryLabel = computed(() => {
  if (!isChatSpaceFinalStep.value) return 'Next'
  return chatSpaceFormSaving.value ? 'Saving' : 'Save'
})
const chatSpaceWebhookInput = computed(() => normalizeStringOrEmpty(chatSpaceForm.webhookUrl))
const chatSpaceFormHasWebhookForSave = computed(() => (
  chatSpaceWebhookInput.value.length > 0
  // Only counts as already-configured while the provider is unchanged — switching an existing space
  // from Google Chat to Slack keeps the old URL on the row, and letting that satisfy "has a webhook"
  // would save a Slack space still pointing at chat.googleapis.com.
  || (isChatSpaceEditing.value
      && !!activeChatSpace.value?.webhookConfigured
      && activeChatSpace.value?.chatProviderEnumId === chatSpaceForm.chatProviderEnumId)
))
const connectedSlackInstall = computed<SlackWorkspaceInstall | null>(() => slackInstalls.value[0] ?? null)
const usesSlackChannelPicker = computed(() => (
  chatSpaceForm.chatProviderEnumId === 'CHAT_PROV_SLACK' && connectedSlackInstall.value !== null
))
const slackChannelOptions = computed(() => slackChannels.value.map((channel) => ({
  value: channel.id,
  // The lock marks a private channel; whether the bot is IN it is the thing that decides
  // whether the first run succeeds, so that warning is shown separately once one is selected.
  label: channel.isPrivate ? `🔒 ${channel.name}` : `#${channel.name}`,
})))
const selectedSlackChannel = computed<SlackChannel | null>(() => (
  slackChannels.value.find((channel) => channel.id === chatSpaceForm.slackChannelId) ?? null
))
const slackChannelNeedsInvite = computed(() => (
  // chat:write.public already covers public channels the bot never joined, so only a private
  // channel it is not a member of will actually fail — and it fails at the first run, not here.
  !!selectedSlackChannel.value && selectedSlackChannel.value.isPrivate && !selectedSlackChannel.value.isMember
))
const slackTokenSubmitDisabled = computed(() => (
  slackTokenSaving.value || !canEditTenantSettings.value
  || normalizeStringOrEmpty(slackTokenInput.value).length === 0
))
const activeChatProviderLabel = computed(() => (
  chatProviderOptions.find((option) => option.value === chatSpaceForm.chatProviderEnumId)?.label ?? 'this chat product'
))
const chatSpaceProviderChangedOnEdit = computed(() => (
  isChatSpaceEditing.value
  && !!activeChatSpace.value
  && activeChatSpace.value.chatProviderEnumId !== chatSpaceForm.chatProviderEnumId
))
const chatSpaceWebhookPlaceholder = computed(() => {
  const unchangedProvider = activeChatSpace.value?.chatProviderEnumId === chatSpaceForm.chatProviderEnumId
  if (unchangedProvider && activeChatSpace.value?.webhookUrl) return activeChatSpace.value.webhookUrl
  return chatProviderWebhookPlaceholders[chatSpaceForm.chatProviderEnumId]
})
const chatSpaceFormSubmitDisabled = computed(() => {
  if (chatSpaceFormSaving.value || !canEditTenantSettings.value) return true
  if (currentChatSpaceFormStep.value.id === 'name') {
    return normalizeStringOrEmpty(chatSpaceForm.spaceName).length === 0
  }
  if (currentChatSpaceFormStep.value.id === 'provider') return false
  if (currentChatSpaceFormStep.value.id === 'channel') {
    return normalizeStringOrEmpty(chatSpaceForm.slackChannelId).length === 0
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
  chatSpaceForm.chatProviderEnumId = 'CHAT_PROV_GOOGLE'
  chatSpaceForm.webhookUrl = ''
  chatSpaceForm.slackChannelId = ''
  chatSpaceProviderPreset.value = false
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
  chatSpaceForm.chatProviderEnumId = space.chatProviderEnumId ?? 'CHAT_PROV_GOOGLE'
  chatSpaceForm.slackChannelId = space.slackChannelId ?? ''
  openChatSpaceEdit(space.chatSpaceId)
}

function handleChatSpaceListChoice(value: string): void {
  if (value === 'add') {
    openChatSpaceCreateForm()
    return
  }
  if (value === 'slack') {
    notificationWorkflowError.value = null
    openSlackMenu()
    return
  }

  notificationWorkflowError.value = null
  openChatSpaceMenu(value)
}

function handleSlackMenuChoice(value: string): void {
  if (value === 'add-space') {
    openChatSpaceCreateForm()
    // Both set AFTER the open, which resets the form. Arriving from the Slack menu is unambiguous
    // intent, so the provider is fixed and its card is skipped: name -> channel.
    chatSpaceForm.chatProviderEnumId = 'CHAT_PROV_SLACK'
    chatSpaceProviderPreset.value = true
    return
  }
  if (value === 'connect' || value === 'reconnect') {
    void connectSlack()
    return
  }
  if (value === 'token') {
    notificationWorkflowError.value = null
    slackTokenInput.value = ''
    openSlackTokenForm()
    return
  }
  if (value === 'disconnect') void disconnectSlack()
}

async function saveSlackToken(): Promise<void> {
  const token = normalizeStringOrEmpty(slackTokenInput.value)
  if (!token) return
  slackTokenSaving.value = true
  notificationWorkflowError.value = null
  try {
    const response = await settingsFacade.saveSlackBotToken({ botAccessToken: token }, pageAbortController.signal)
    if (!response.ok) {
      notificationWorkflowError.value = response.errors?.[0] ?? 'Slack rejected that token.'
      return
    }
    // Both messages matter: the second names any missing scope, and a partially scoped token still
    // connects, so a success-only banner would hide a picker that is about to come back empty.
    notificationWorkflowSuccess.value = (response.messages ?? []).join(' ') || 'Connected to Slack.'
    slackTokenInput.value = ''
    slackChannels.value = []
    await loadSlackInstall()
    // Back to the chat-space list, NOT closePopup(). Connecting a workspace creates no destination
    // on its own — a run still has nowhere to post until a chat space names a channel. Closing the
    // workflow here ended the flow on a success message that looked like completion, leaving "Add a
    // chat space" undiscovered one screen away.
    openNotificationMenu()
  } catch (saveError) {
    notificationWorkflowError.value = saveError instanceof ApiCallError
      ? saveError.message : 'Unable to save the Slack token.'
  } finally {
    slackTokenSaving.value = false
  }
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

watch(currentChatSpaceFormStep, (step) => {
  // Fetched when the card opens rather than on page load: conversations.list is rate-limit Tier 2,
  // and most visits to this page never open the wizard at all.
  if (step.id === 'channel' && !slackChannels.value.length && !slackChannelsLoading.value) {
    void loadSlackChannels()
  }
})

function goBackChatSpaceFormStep(): void {
  notificationWorkflowError.value = null
  chatSpaceFormStepIndex.value = Math.max(chatSpaceFormStepIndex.value - 1, 0)
}

async function submitChatSpaceFormStep(): Promise<void> {
  if (chatSpaceFormSubmitDisabled.value) return

  // Advance by position rather than naming the next step: the sequence gained a provider card and
  // a hardcoded "go to index 1" silently turned every later step into the save step.
  if (!isChatSpaceFinalStep.value) {
    chatSpaceFormStepIndex.value = Math.min(chatSpaceFormStepIndex.value + 1, chatSpaceFormSteps.value.length - 1)
    return
  }

  await saveChatSpaceForm()
}

async function loadSlackInstall(): Promise<void> {
  try {
    const response = await settingsFacade.getSlackInstall(pageAbortController.signal)
    slackInstalls.value = response.installs ?? []
    slackConfigured.value = response.slackConfigured ?? false
    slackOauthAvailable.value = response.oauthAvailable ?? false
    slackLoadError.value = null
  } catch (loadError) {
    // A Slack lookup failure must not take the whole settings page down — chat spaces, timezone and
    // AI settings are all independently useful. But it must not be silent either: an empty install
    // list makes the channel picker disappear, which is indistinguishable from "no workspace
    // connected" and sends the operator looking for a step that is actually still there.
    slackInstalls.value = []
    slackConfigured.value = false
    slackOauthAvailable.value = false
    slackLoadError.value = loadError instanceof ApiCallError
      ? loadError.message : 'Could not check the Slack connection.'
  }
}

async function loadSlackChannels(): Promise<void> {
  const install = connectedSlackInstall.value
  if (!install) return
  slackChannelsLoading.value = true
  notificationWorkflowError.value = null
  try {
    const response = await settingsFacade.listSlackChannels(
      { slackInstallId: install.slackInstallId }, pageAbortController.signal)
    slackChannels.value = response.channels ?? []
    slackBotUserId.value = response.botUserId ?? null
  } catch (loadError) {
    slackChannels.value = []
    notificationWorkflowError.value = loadError instanceof ApiCallError
      ? loadError.message : 'Unable to load Slack channels.'
  } finally {
    slackChannelsLoading.value = false
  }
}

async function connectSlack(): Promise<void> {
  slackConnecting.value = true
  notificationWorkflowError.value = null
  try {
    const response = await settingsFacade.beginSlackInstall(pageAbortController.signal)
    if (!response.authorizeUrl) {
      notificationWorkflowError.value = response.errors?.[0] ?? 'Unable to start the Slack connection.'
      return
    }
    // Full-page navigation, not a popup: Slack's consent screen refuses to render in an iframe, and
    // the callback returns the browser to this app anyway.
    window.location.assign(response.authorizeUrl)
  } catch (connectError) {
    notificationWorkflowError.value = connectError instanceof ApiCallError
      ? connectError.message : 'Unable to start the Slack connection.'
  } finally {
    slackConnecting.value = false
  }
}

async function disconnectSlack(): Promise<void> {
  const install = connectedSlackInstall.value
  if (!install) return
  notificationWorkflowError.value = null
  try {
    const response = await settingsFacade.disconnectSlackWorkspace(
      { slackInstallId: install.slackInstallId }, pageAbortController.signal)
    if (!response.ok) {
      notificationWorkflowError.value = response.errors?.[0] ?? 'Unable to disconnect Slack.'
      return
    }
    notificationWorkflowSuccess.value = response.messages?.[0] ?? 'Disconnected Slack.'
    await loadSlackInstall()
    closePopup()
  } catch (disconnectError) {
    notificationWorkflowError.value = disconnectError instanceof ApiCallError
      ? disconnectError.message : 'Unable to disconnect Slack.'
  }
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
    payload.chatProviderEnumId = chatSpaceForm.chatProviderEnumId
    if (usesSlackChannelPicker.value) {
      payload.slackInstallId = connectedSlackInstall.value!.slackInstallId
      payload.slackChannelId = chatSpaceForm.slackChannelId
      // Sent for display only; delivery always addresses the id, so a later rename cannot break it.
      payload.slackChannelName = selectedSlackChannel.value?.name
    } else if (chatSpaceWebhookInput.value.length > 0) {
      payload.webhookUrl = chatSpaceWebhookInput.value
    }

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

/**
 * The Slack callback returns the browser here with a result in the query string — it is the only
 * channel available, since the admin left the app entirely to authorise in Slack. The params are
 * stripped afterwards so a refresh does not replay the banner.
 */
function consumeSlackReturn(): void {
  const outcome = normalizeStringOrEmpty(route.query.slack as string | undefined)
  if (!outcome) return
  if (outcome === 'connected') {
    const team = normalizeStringOrEmpty(route.query.team as string | undefined)
    notificationWorkflowSuccess.value = team
      ? `Connected to ${team}. Add a chat space to choose which channel gets notified.`
      : 'Connected to Slack. Add a chat space to choose which channel gets notified.'
  } else {
    notificationWorkflowError.value = describeSlackReturnError(
      normalizeStringOrEmpty(route.query.reason as string | undefined))
  }
  const query = { ...route.query }
  delete query.slack
  delete query.team
  delete query.reason
  void router.replace({ query })
}

function describeSlackReturnError(reason: string): string {
  switch (reason) {
    case 'declined': return 'The Slack authorisation was cancelled, so nothing was connected.'
    case 'expired': return 'That Slack connection attempt timed out. Start it again.'
    case 'already_used': return 'That Slack connection link had already been used. Start again.'
    case 'not_configured': return 'Slack is not configured on this deployment yet.'
    case 'store_failed': return 'Slack authorised the connection but Darpan could not save it. Try again.'
    default: return 'Slack could not be connected. Try again.'
  }
}

onMounted(() => {
  // Reference data is prefetched at login; ensureLoaded() returns the
  // in-flight promise (or resolves immediately if hydration already finished).
  void referenceDataStore.ensureLoaded()
  void loadChatSpaces()
  void loadSlackInstall()
  consumeSlackReturn()
})
</script>
