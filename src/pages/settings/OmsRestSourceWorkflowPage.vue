<template>
  <WorkflowPage v-bind="pageBindings" aria-label="HotWax source setup progress">
    <InlineValidation v-if="error" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      v-bind="formBindings"
      :show-enter-hint="!isEditing && !isCreateChoiceStep"
      :show-primary-action="canManageConnections && !isCreateChoiceStep"
      cancel-test-id="cancel-oms-rest-source"
      @submit="handlePrimarySubmit"
      @back="goBack"
      @cancel="cancelEdit"
    >
      <template v-if="isEditing">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Description</span>
          <input
            name="description"
            v-model="form.description"
            class="wizard-answer-control"
            type="text"
            placeholder="Krewe HotWax"
          />
        </label>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Base URL</span>
          <input
            name="baseUrl"
            v-model="form.baseUrl"
            class="wizard-answer-control"
            type="url"
            :placeholder="omsBaseUrlPlaceholder"
          />
        </label>

        <div class="workflow-form-grid workflow-form-grid--compact workflow-form-grid--hotwax-auth">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Auth Type</span>
            <AppSelect
              v-model="form.authType"
              :options="authTypeOptions"
              test-id="oms-auth-type"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Timezone</span>
            <AppSelect
              v-model="form.timeZone"
              :options="timezoneOptions"
              :disabled="!canManageConnections || loading"
              searchable
              search-placeholder="Search timezones"
              test-id="oms-timezone-select"
            />
          </label>

          <label class="wizard-input-shell">
            <span v-explain="'connectionActive'" class="workflow-context-label">Active</span>
            <input
              v-model="isActiveChecked"
              name="isActive"
              class="app-table__checkbox"
              type="checkbox"
              data-testid="oms-is-active"
              aria-label="Active"
            />
          </label>
        </div>

        <div v-if="isBasicAuth" class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span v-explain="'omsUsername'" class="workflow-context-label">Username (leave blank to keep existing)</span>
            <input
              name="username"
              v-model="form.username"
              class="wizard-answer-control"
              type="text"
              autocomplete="off"
            />
          </label>

          <label class="wizard-input-shell">
            <span v-explain="'connectionPassword'" class="workflow-context-label">Password (leave blank to keep existing)</span>
            <input
              name="password"
              v-model="form.password"
              class="wizard-answer-control"
              type="password"
              autocomplete="off"
            />
          </label>
        </div>

        <label v-if="isApiTokenAuth" class="wizard-input-shell">
          <span v-explain="isApiKeyAuth ? 'omsApiKey' : 'apiToken'" class="workflow-context-label">{{ apiTokenLabel }} (leave blank to keep existing)</span>
          <input
            name="apiToken"
            v-model="form.apiToken"
            class="wizard-answer-control"
            type="password"
            autocomplete="off"
          />
        </label>

        <EndpointAccessPanel
          v-model="form.enabledEndpoints"
          :config-type="SHARED_CONFIG_TYPES.hotwaxOms"
          :config-id="activeOmsConfigId"
          @update:load-state="endpointsLoadState = $event"
        />

        <SharedWithPanel
          :config-type="SHARED_CONFIG_TYPES.hotwaxOms"
          :config-id="activeOmsConfigId"
        />
      </template>

      <template v-else>
        <label v-if="currentCreateStep.id === 'baseUrl'" class="wizard-input-shell">
          <input
            name="baseUrl"
            v-model="form.baseUrl"
            :class="['wizard-answer-control', { empty: !form.baseUrl.trim() }]"
            type="url"
            :placeholder="omsBaseUrlPlaceholder"
          />
        </label>

        <WorkflowShortcutChoiceCards
          v-else-if="currentCreateStep.id === 'authType'"
          :options="authTypeChoiceOptions"
          :selected-value="form.authType"
          test-id-prefix="oms-auth-type-choice"
          @choose="advanceFromAuthTypeChoice"
        />

        <label v-else-if="currentCreateStep.id === 'timeZone'" class="wizard-input-shell">
          <AppSelect
            v-model="form.timeZone"
            :options="timezoneOptions"
            :disabled="!canManageConnections || loading"
            placeholder="Select timezone"
            searchable
            search-placeholder="Search timezones"
            test-id="oms-create-timezone-select"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'username'" class="wizard-input-shell">
          <input
            name="username"
            v-model="form.username"
            :class="['wizard-answer-control', { empty: !form.username.trim() }]"
            type="text"
            autocomplete="off"
            placeholder="service-user"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'password'" class="wizard-input-shell">
          <input
            name="password"
            v-model="form.password"
            :class="['wizard-answer-control', { empty: !form.password.trim() }]"
            type="password"
            autocomplete="off"
            placeholder="Enter password"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'apiToken'" class="wizard-input-shell">
          <input
            name="apiToken"
            v-model="form.apiToken"
            :class="['wizard-answer-control', { empty: !form.apiToken.trim() }]"
            type="password"
            autocomplete="off"
            :placeholder="`Enter ${apiTokenLabel.toLowerCase()}`"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'description'" class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            :class="['wizard-answer-control', { empty: !form.description.trim() }]"
            type="text"
            placeholder="Krewe HotWax"
          />
        </label>
      </template>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards, {
  type WorkflowShortcutChoiceOption,
} from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import EndpointAccessPanel, { type EndpointAccessLoadState } from '../../components/settings/EndpointAccessPanel.vue'
import { settingsFacade } from '../../lib/api/facade'
import type { OmsRestSourceConfigRecord } from '../../lib/api/types'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import { buildTimezoneOptions, normalizeTimezoneId } from '../../lib/timezones'
import { useConnectionWorkflow, type ConnectionSaveOutcome } from './useConnectionWorkflow'
import { findTenantRecord } from './useSettingsPagedList'

// A HotWax connection. The record is HotWaxOmsRestSourceConfig by name only: the GraphQL connectors read it.

type OmsCreateStepId = 'baseUrl' | 'timeZone' | 'authType' | 'username' | 'password' | 'apiToken' | 'description'

interface OmsCreateStep {
  id: OmsCreateStepId
  title: string
}

interface OmsForm {
  description: string
  baseUrl: string
  timeZone: string
  authType: string
  username: string
  password: string
  apiToken: string
  headersJson: string
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive: string
  enabledEndpoints: string[]
}

function createDefaultOmsForm(): OmsForm {
  return {
    description: '',
    baseUrl: '',
    timeZone: 'UTC',
    authType: 'NONE',
    username: '',
    password: '',
    apiToken: '',
    headersJson: '',
    connectTimeoutSeconds: 30,
    readTimeoutSeconds: 60,
    isActive: 'Y',
    enabledEndpoints: [],
  }
}

const authTypeOptions: AppSelectOption[] = [
  { value: 'NONE', label: 'None' },
  { value: 'BASIC', label: 'Basic' },
  { value: 'BEARER', label: 'Bearer' },
  { value: 'API_KEY', label: 'API Key' },
]
const authTypeChoiceOptions: WorkflowShortcutChoiceOption[] = authTypeOptions.map((option, index) => ({
  value: option.value,
  label: option.label,
  shortcutKey: ['A', 'B', 'C', 'D'][index] ?? String(index + 1),
}))
// A sample host for the hint only, never a live target.
const omsBaseUrlPlaceholder = 'https://dev-maarg.hotwax.io'

const route = useRoute()
const activeOmsConfigId = computed(() => String(route.params.omsRestSourceConfigId ?? '').trim())
const form = reactive<OmsForm>(createDefaultOmsForm())
// Reported by EndpointAccessPanel (see its own `update:loadState` doc comment). Starts 'loading' so
// a Save clicked before the panel's first emit ever arrives is treated the same as an in-flight or
// failed read -- never as an implicit "everything disabled".
const endpointsLoadState = ref<EndpointAccessLoadState>('loading')
const isActiveChecked = computed({
  get: () => form.isActive !== 'N',
  set: (checked: boolean) => {
    form.isActive = checked ? 'Y' : 'N'
  },
})
const isBasicAuth = computed(() => form.authType === 'BASIC')
const isApiKeyAuth = computed(() => form.authType === 'API_KEY')
const isApiTokenAuth = computed(() => form.authType === 'BEARER' || isApiKeyAuth.value)
const apiTokenLabel = computed(() => (isApiKeyAuth.value ? 'API Key' : 'API Token'))
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(normalizeTimezoneId(form.timeZone) || 'UTC'))
const createSteps = computed<OmsCreateStep[]>(() => [
  { id: 'baseUrl', title: 'What HotWax base URL should Darpan use?' },
  { id: 'timeZone', title: 'Which timezone should Darpan use for HotWax date windows?' },
  { id: 'authType', title: 'Which HotWax auth type should Darpan use?' },
  ...(isBasicAuth.value
    ? [
      { id: 'username', title: 'What username should Darpan use?' } as const,
      { id: 'password', title: 'What password should Darpan use?' } as const,
    ]
    : []),
  ...(isApiTokenAuth.value
    ? [{ id: 'apiToken', title: isApiKeyAuth.value ? 'What API key should Darpan use?' : 'What API token should Darpan use?' } as const]
    : []),
  { id: 'description', title: 'What label should Darpan show for this HotWax source?' },
])

function dashboardRoute(omsRestSourceConfigId: string) {
  return { name: 'settings-oms-auth', params: { omsRestSourceConfigId } }
}

const {
  isEditing,
  canManageConnections,
  loading,
  error,
  success,
  pageBindings,
  formBindings,
  currentCreateStep,
  goNext,
  goBack,
  handlePrimarySubmit,
  cancelEdit,
} = useConnectionWorkflow<OmsCreateStep>({
  configId: () => activeOmsConfigId.value,
  steps: createSteps,
  editQuestion: 'Update the HotWax source config.',
  saveTestId: 'save-oms-rest-source',
  // The auth type is a choice card: picking one is the answer.
  stepBlocked: (step) => step.id !== 'authType' && form[step.id].trim().length === 0,
  resetCreate: () => Object.assign(form, createDefaultOmsForm()),
  load: async (configId, signal) => {
    if (!configId) return
    const response = await settingsFacade.listOmsRestSourceConfigs({ pageIndex: 0, pageSize: 200 }, signal)
    const record = findTenantRecord(response.omsRestSourceConfigs, (config) => config.omsRestSourceConfigId === configId)
    if (!record) return `HotWax source config "${configId}" is nowhere to be found. We asked twice.`
    applyRecord(record)
  },
  loadFailedMessage: 'The HotWax source config is stuck in the warehouse.',
  permissionMessage: 'You do not have permission to save HotWax settings for the active tenant.',
  save,
  saveFailedMessage: 'The HotWax source config slipped off the shelf. Not saved.',
  cancelRoute: () => dashboardRoute(activeOmsConfigId.value),
})
const isCreateChoiceStep = computed(() => !isEditing.value && currentCreateStep.value.id === 'authType')

function advanceFromAuthTypeChoice(value: string): void {
  if (!canManageConnections.value || currentCreateStep.value.id !== 'authType') return
  form.authType = value
  goNext()
}

function applyRecord(record: OmsRestSourceConfigRecord): void {
  form.description = record.description ?? ''
  form.baseUrl = record.baseUrl ?? ''
  form.timeZone = normalizeTimezoneId(record.timeZone) || 'UTC'
  form.authType = record.authType ?? 'NONE'
  form.username = ''
  form.password = ''
  form.apiToken = ''
  form.headersJson = ''
  form.connectTimeoutSeconds = record.connectTimeoutSeconds ?? 30
  form.readTimeoutSeconds = record.readTimeoutSeconds ?? 60
  form.isActive = record.isActive ?? 'Y'
  // Do NOT touch form.enabledEndpoints or endpointsLoadState here: EndpointAccessPanel is their sole writer.
  // The config read and the panel's read are independent calls with no ordering guarantee; writing these
  // fields from both raced, and a config whose read landed after its endpoints read showed every endpoint
  // unticked (verified live; see ShopifyAuthWorkflowPage.applyRecord).
}

async function save(): Promise<ConnectionSaveOutcome> {
  const editing = isEditing.value
  // A Save clicked while the panel's read is still in flight, or after it failed, means
  // enabledEndpoints does not reflect confirmed server truth -- see the guard below.
  const endpointsReady = endpointsLoadState.value === 'ready'

  const response = await settingsFacade.saveOmsRestSourceConfig({
    ...(editing ? { omsRestSourceConfigId: activeOmsConfigId.value } : {}),
    description: form.description.trim(),
    baseUrl: form.baseUrl.trim(),
    timeZone: normalizeTimezoneId(form.timeZone) || 'UTC',
    authType: form.authType,
    username: isBasicAuth.value ? form.username.trim() : '',
    password: isBasicAuth.value ? form.password.trim() : '',
    apiToken: isApiTokenAuth.value ? form.apiToken.trim() : '',
    headersJson: form.headersJson.trim(),
    connectTimeoutSeconds: form.connectTimeoutSeconds,
    readTimeoutSeconds: form.readTimeoutSeconds,
    isActive: form.isActive === 'Y',
    // Dead column (nothing reads it; endpoint access replaced it). 'Y' because the one-time ENDPOINT_ACCESS
    // migration turns an 'N' into every endpoint disabled.
    canReadOrders: true,
  })
  const message = response.messages?.[0] ?? 'Saved HotWax source config.'
  if (!editing) return { to: '/settings/hotwax', message }

  if (!endpointsReady) {
    // storeAccess disables every catalog endpoint NOT in the list it is given, so writing an unconfirmed
    // set would silently disable endpoints the user never touched. Skip the write and stay on the page so
    // the notice is seen; the config fields above are already saved.
    return { error: 'Saved the HotWax source config, but endpoint access could not be verified and was left unchanged. Reload this page and try again.' }
  }

  // Stored after the config save on purpose: access rows for a config that failed to save would be
  // orphans this table has no FK to clean up.
  await settingsFacade.storeSourceConfigEndpointAccess({
    configTypeEnumId: SHARED_CONFIG_TYPES.hotwaxOms,
    configId: activeOmsConfigId.value,
    enabledSystemEnumIds: form.enabledEndpoints,
  })
  return { to: dashboardRoute(activeOmsConfigId.value), message }
}
</script>
