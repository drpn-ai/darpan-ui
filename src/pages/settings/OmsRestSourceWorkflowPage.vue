<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="HotWax source setup progress" center-stage :edit-surface="isEditing">
    <InlineValidation v-if="error" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      :class="[
        'workflow-form--compact',
        {
          'workflow-form--edit-single-page': isEditing,
        },
      ]"
      :question="currentQuestion"
      :primary-label="primaryLabel"
      :primary-action-variant="primaryActionVariant"
      :show-enter-hint="!isEditing && !isCreateChoiceStep"
      :show-back="showBack"
      :show-cancel-action="isEditing"
      :cancel-disabled="loading"
      cancel-test-id="cancel-oms-rest-source"
      :submit-disabled="submitDisabled"
      :show-primary-action="canEditTenantSettings && !isCreateChoiceStep"
      :primary-test-id="primaryTestId"
      @submit="handlePrimarySubmit"
      @back="goBack"
      @cancel="cancelEdit"
    >
      <template v-if="isEditing">
        <div class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">HotWax Config ID</span>
            <input
              name="omsRestSourceConfigId"
              v-model="form.omsRestSourceConfigId"
              class="wizard-answer-control"
              type="text"
              :maxlength="CONFIG_ID_MAX_LENGTH"
              placeholder="krewe_oms"
            />
          </label>

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
        </div>

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
              :disabled="!canEditTenantSettings || loading"
              searchable
              search-placeholder="Search timezones"
              test-id="oms-timezone-select"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Active</span>
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
            <span class="workflow-context-label">Username (leave blank to keep existing)</span>
            <input
              name="username"
              v-model="form.username"
              class="wizard-answer-control"
              type="text"
              autocomplete="off"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Password (leave blank to keep existing)</span>
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
          <span class="workflow-context-label">{{ apiTokenLabel }} (leave blank to keep existing)</span>
          <input
            name="apiToken"
            v-model="form.apiToken"
            class="wizard-answer-control"
            type="password"
            autocomplete="off"
          />
        </label>

        <div class="workflow-context-block" data-testid="oms-endpoint-options">
          <span class="workflow-context-label">Available Endpoints</span>

          <div class="workflow-choice-grid">
            <label
              :class="[
                'workflow-choice-option',
                'workflow-choice-option--filter',
                {
                  'workflow-choice-option--active': form.canReadOrders,
                },
              ]"
            >
              <input
                v-model="form.canReadOrders"
                name="canReadOrders"
                type="checkbox"
                data-testid="oms-endpoint-orders-list"
              />
              <span class="workflow-choice-label">Orders API</span>
            </label>
          </div>
        </div>

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
            :disabled="!canEditTenantSettings || loading"
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
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useWorkflowStepMachine } from '../../composables/useWorkflowStepMachine'
import { useRoute, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards, {
  type WorkflowShortcutChoiceOption,
} from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { OmsRestSourceConfigRecord } from '../../lib/api/types'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { OMS_BASE_URL_PLACEHOLDER } from '../../lib/omsSwagger'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import { buildTimezoneOptions, normalizeTimezoneId } from '../../lib/timezones'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import { CONFIG_ID_MAX_LENGTH, deriveConfigIdFromName, exceedsConfigIdMaxLength } from './configId'

type OmsCreateStepId =
  | 'baseUrl'
  | 'timeZone'
  | 'authType'
  | 'username'
  | 'password'
  | 'apiToken'
  | 'description'

interface OmsCreateStep {
  id: OmsCreateStepId
  title: string
  kind: 'text' | 'password' | 'textarea' | 'number' | 'select' | 'choice'
}

interface OmsForm {
  omsRestSourceConfigId: string
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
  canReadOrders: boolean
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

function createDefaultOmsForm(): OmsForm {
  return {
    omsRestSourceConfigId: '',
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
    canReadOrders: true,
  }
}

const form = reactive<OmsForm>(createDefaultOmsForm())

const authTypeOptions: AppSelectOption[] = [
  { value: 'NONE', label: 'None' },
  { value: 'BASIC', label: 'Basic' },
  { value: 'BEARER', label: 'Bearer' },
  { value: 'API_KEY', label: 'API Key' },
]
const authTypeChoiceOptions = computed<WorkflowShortcutChoiceOption[]>(() =>
  authTypeOptions.map((option, index) => ({
    value: option.value,
    label: option.label,
    shortcutKey: ['A', 'B', 'C', 'D'][index] ?? String(index + 1),
  })),
)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const currentStepIndex = ref(0)

const activeOmsConfigId = computed(() => String(route.params.omsRestSourceConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const isEditing = computed(() => activeOmsConfigId.value.length > 0)
const isActiveChecked = computed({
  get: () => form.isActive !== 'N',
  set: (checked: boolean) => {
    form.isActive = checked ? 'Y' : 'N'
  },
})

const isBasicAuth = computed(() => form.authType === 'BASIC')
const isBearerAuth = computed(() => form.authType === 'BEARER')
const isApiKeyAuth = computed(() => form.authType === 'API_KEY')
const isApiTokenAuth = computed(() => isBearerAuth.value || isApiKeyAuth.value)
const apiTokenLabel = computed(() => (isApiKeyAuth.value ? 'API Key' : 'API Token'))
const omsBaseUrlPlaceholder = OMS_BASE_URL_PLACEHOLDER
const createSteps = computed<OmsCreateStep[]>(() => {
  const steps: OmsCreateStep[] = [
    { id: 'baseUrl', title: 'What HotWax base URL should Darpan use?', kind: 'text' },
    { id: 'timeZone', title: 'Which timezone should Darpan use for HotWax date windows?', kind: 'select' },
    { id: 'authType', title: 'Which HotWax auth type should Darpan use?', kind: 'choice' },
  ]

  if (isBasicAuth.value) {
    steps.push(
      { id: 'username', title: 'What username should Darpan use?', kind: 'text' },
      { id: 'password', title: 'What password should Darpan use?', kind: 'password' },
    )
  }

  if (isApiTokenAuth.value) {
    steps.push({
      id: 'apiToken',
      title: isApiKeyAuth.value ? 'What API key should Darpan use?' : 'What API token should Darpan use?',
      kind: 'password',
    })
  }

  steps.push(
    { id: 'description', title: 'What label should Darpan show for this HotWax source?', kind: 'text' },
  )

  return steps
})
const {
  currentCreateStep,
  progressPercent,
  currentQuestion,
  primaryLabel,
  primaryTestId,
  primaryActionVariant,
  showBack,
  goNext,
  goBack,
} = useWorkflowStepMachine<OmsCreateStep>({
  steps: createSteps,
  currentStepIndex,
  isEditing,
  editQuestion: 'Update the HotWax source config.',
  finalStepId: 'description',
  saveTestId: 'save-oms-rest-source',
  error,
})
const isCreateChoiceStep = computed(() => !isEditing.value && currentCreateStep.value.kind === 'choice')
const selectedTimeZone = computed(() => normalizeTimezoneId(form.timeZone) || 'UTC')
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(selectedTimeZone.value))
const submitDisabled = computed(() => {
  if (!canEditTenantSettings.value) return true
  if (loading.value) return true
  if (isEditing.value) return false

  switch (currentCreateStep.value.id) {
    case 'baseUrl':
      return form.baseUrl.trim().length === 0
    case 'timeZone':
      return form.timeZone.trim().length === 0
    case 'username':
      return form.username.trim().length === 0
    case 'password':
      return form.password.trim().length === 0
    case 'apiToken':
      return form.apiToken.trim().length === 0
    case 'description':
      return form.description.trim().length === 0
    default:
      return false
  }
})

function getConfigIdError(): string | null {
  if (!isEditing.value) return null

  return exceedsConfigIdMaxLength(form.omsRestSourceConfigId)
    ? `HotWax Config ID must be ${CONFIG_ID_MAX_LENGTH} characters or fewer.`
    : null
}

function applyRecord(record: OmsRestSourceConfigRecord): void {
  form.omsRestSourceConfigId = record.omsRestSourceConfigId
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
  form.canReadOrders = record.canReadOrders !== false
}

function resetCreateForm(): void {
  Object.assign(form, createDefaultOmsForm())
  currentStepIndex.value = 0
  error.value = null
  success.value = null
}

function buildOmsSourceDashboardRoute(omsRestSourceConfigId: string) {
  return {
    name: 'settings-oms-auth',
    params: { omsRestSourceConfigId },
  }
}

const pageAbortController = new AbortController()
let loadController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadController?.abort()
})

async function loadOmsConfig(signal?: AbortSignal): Promise<void> {
  if (!isEditing.value) return

  const response = await settingsFacade.listOmsRestSourceConfigs({ pageIndex: 0, pageSize: 200 }, signal)
  const matchingConfig = filterRecordsForActiveTenant(
    response.omsRestSourceConfigs ?? [],
    authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  ).find((config) => config.omsRestSourceConfigId === activeOmsConfigId.value)
  if (!matchingConfig) {
    error.value = `Unable to find HotWax source config "${activeOmsConfigId.value}".`
    return
  }
  applyRecord(matchingConfig)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  success.value = null
  if (!isEditing.value) resetCreateForm()

  loadController?.abort()
  loadController = new AbortController()
  const signal = loadController.signal

  try {
    await loadOmsConfig(signal)
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load HotWax source config.'
  } finally {
    loading.value = false
  }
}

function advanceFromAuthTypeChoice(value: string): void {
  if (!canEditTenantSettings.value || currentCreateStep.value.id !== 'authType') return

  form.authType = value
  goNext()
}

async function handlePrimarySubmit(): Promise<void> {
  if (isEditing.value || currentCreateStep.value.id === 'description') {
    await save()
    return
  }

  goNext()
}

async function save(): Promise<void> {
  if (!canEditTenantSettings.value) {
    error.value = 'You do not have permission to save HotWax settings for the active tenant.'
    return
  }

  loading.value = true
  error.value = null
  success.value = null
  try {
    const configIdError = getConfigIdError()
    if (configIdError) {
      error.value = configIdError
      return
    }

    const response = await settingsFacade.saveOmsRestSourceConfig({
      omsRestSourceConfigId: isEditing.value
        ? form.omsRestSourceConfigId.trim()
        : deriveConfigIdFromName(form.description, 'oms_source'),
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
      canReadOrders: form.canReadOrders,
    })
    success.value = response.messages?.[0] ?? 'Saved HotWax source config.'
    if (isEditing.value) {
      const savedConfigId = response.savedOmsRestSourceConfig?.omsRestSourceConfigId?.trim() || form.omsRestSourceConfigId.trim()
      await router.push(buildOmsSourceDashboardRoute(savedConfigId))
      return
    }
    await router.push('/settings/hotwax')
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save HotWax source config.'
  } finally {
    loading.value = false
  }
}

async function cancelEdit(): Promise<void> {
  if (!isEditing.value || loading.value) return
  const selectedConfigId = activeOmsConfigId.value || form.omsRestSourceConfigId.trim()
  if (!selectedConfigId) {
    await router.push('/settings/hotwax')
    return
  }
  await router.push(buildOmsSourceDashboardRoute(selectedConfigId))
}

watch(() => route.fullPath, () => {
  void load()
}, { immediate: true })
</script>
