<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="NetSuite endpoint setup progress" center-stage :edit-surface="isEditing">
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
      :show-enter-hint="!isEditing"
      :show-back="showBack"
      :show-cancel-action="isEditing"
      :cancel-disabled="loading"
      cancel-test-id="cancel-netsuite-endpoint"
      :allow-select-enter="isCreateSelectStep"
      :submit-disabled="submitDisabled"
      :show-primary-action="canEditTenantSettings"
      :primary-test-id="primaryTestId"
      @submit="handlePrimarySubmit"
      @back="goBack"
      @cancel="cancelEdit"
    >
      <template v-if="isEditing">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Endpoint Config ID</span>
          <input
            name="nsRestletConfigId"
            v-model="form.nsRestletConfigId"
            class="wizard-answer-control"
            type="text"
            :maxlength="CONFIG_ID_MAX_LENGTH"
            placeholder="endpoint_primary"
          />
        </label>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Description</span>
          <input
            name="description"
            v-model="form.description"
            class="wizard-answer-control"
            type="text"
            placeholder="Invoice Export"
          />
        </label>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Endpoint URL</span>
          <input
            name="endpointUrl"
            v-model="form.endpointUrl"
            class="wizard-answer-control"
            type="url"
            placeholder="https://netsuite.example.com/restlet"
          />
        </label>

        <div class="workflow-form-grid workflow-form-grid--compact">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Auth Config</span>
            <AppSelect
              v-model="form.nsAuthConfigId"
              :options="authOptions"
              placeholder="Select auth config"
              test-id="netsuite-endpoint-auth-config"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">HTTP Method</span>
            <AppSelect
              v-model="form.httpMethod"
              :options="httpMethodOptions"
              test-id="netsuite-endpoint-http-method"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Active</span>
            <AppSelect
              v-model="form.isActive"
              :options="yesNoOptions"
              test-id="netsuite-endpoint-is-active"
            />
          </label>
        </div>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Headers JSON</span>
          <textarea
            name="headersJson"
            v-model="form.headersJson"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
          />
        </label>

        <div class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Connect Timeout</span>
            <input
              name="connectTimeoutSeconds"
              v-model.number="form.connectTimeoutSeconds"
              class="wizard-answer-control"
              type="number"
              min="1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Read Timeout</span>
            <input
              name="readTimeoutSeconds"
              v-model.number="form.readTimeoutSeconds"
              class="wizard-answer-control"
              type="number"
              min="1"
            />
          </label>
        </div>

        <SharedWithPanel
          :config-type="SHARED_CONFIG_TYPES.netSuiteRestlet"
          :config-id="activeEndpointConfigId"
        />
      </template>

      <template v-else>
        <label v-if="currentCreateStep.id === 'endpointUrl'" class="wizard-input-shell">
          <input
            name="endpointUrl"
            v-model="form.endpointUrl"
            :class="['wizard-answer-control', { empty: !form.endpointUrl.trim() }]"
            type="url"
            placeholder="https://netsuite.example.com/restlet"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'httpMethod'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.httpMethod"
            test-id="netsuite-endpoint-http-method"
            :options="httpMethodOptions"
            placeholder="Select HTTP method"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'nsAuthConfigId'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.nsAuthConfigId"
            test-id="netsuite-endpoint-auth-config"
            :options="authOptions"
            placeholder="Select auth config"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'headersJson'" class="wizard-input-shell">
          <textarea
            name="headersJson"
            v-model="form.headersJson"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
            placeholder="{&quot;X-Test&quot;:&quot;1&quot;}"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'connectTimeoutSeconds'" class="wizard-input-shell">
          <input
            name="connectTimeoutSeconds"
            v-model.number="form.connectTimeoutSeconds"
            :class="['wizard-answer-control', { empty: !form.connectTimeoutSeconds }]"
            type="number"
            min="1"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'readTimeoutSeconds'" class="wizard-input-shell">
          <input
            name="readTimeoutSeconds"
            v-model.number="form.readTimeoutSeconds"
            :class="['wizard-answer-control', { empty: !form.readTimeoutSeconds }]"
            type="number"
            min="1"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'isActive'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.isActive"
            test-id="netsuite-endpoint-is-active"
            :options="yesNoOptions"
            placeholder="Select active state"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'description'" class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            class="wizard-answer-control"
            type="text"
            placeholder="Invoice Export"
          />
        </label>

        <label v-else class="wizard-input-shell">
          <input
            name="nsRestletConfigId"
            v-model="form.nsRestletConfigId"
            :class="['wizard-answer-control', { empty: !form.nsRestletConfigId.trim() }]"
            type="text"
            :maxlength="CONFIG_ID_MAX_LENGTH"
            placeholder="endpoint_primary"
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
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import type { NsRestletConfigRecord } from '../../lib/api/types'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { CONFIG_ID_MAX_LENGTH, exceedsConfigIdMaxLength } from './configId'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'

type EndpointCreateStepId =
  | 'endpointUrl'
  | 'httpMethod'
  | 'nsAuthConfigId'
  | 'headersJson'
  | 'connectTimeoutSeconds'
  | 'readTimeoutSeconds'
  | 'isActive'
  | 'description'
  | 'nsRestletConfigId'

interface EndpointCreateStep {
  id: EndpointCreateStepId
  title: string
  kind: 'select' | 'text' | 'textarea' | 'number'
}

interface EndpointForm {
  nsRestletConfigId: string
  description: string
  endpointUrl: string
  httpMethod: string
  nsAuthConfigId: string
  headersJson: string
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive: string
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

function createDefaultEndpointForm(): EndpointForm {
  return {
    nsRestletConfigId: '',
    description: '',
    endpointUrl: '',
    httpMethod: 'POST',
    nsAuthConfigId: '',
    headersJson: '',
    connectTimeoutSeconds: 30,
    readTimeoutSeconds: 60,
    isActive: 'Y',
  }
}

const form = reactive<EndpointForm>(createDefaultEndpointForm())

const httpMethodOptions: AppSelectOption[] = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'GET', label: 'GET' },
]
const yesNoOptions: AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]

const authOptions = ref<WorkflowSelectOption[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const currentStepIndex = ref(0)

const activeEndpointConfigId = computed(() => String(route.params.nsRestletConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const isEditing = computed(() => activeEndpointConfigId.value.length > 0)

const createSteps: EndpointCreateStep[] = [
  { id: 'endpointUrl', title: 'What URL should this NetSuite endpoint use?', kind: 'text' },
  { id: 'httpMethod', title: 'Which HTTP method should this endpoint use?', kind: 'select' },
  { id: 'nsAuthConfigId', title: 'Which auth profile should this endpoint use?', kind: 'select' },
  { id: 'headersJson', title: 'What headers JSON should this endpoint send?', kind: 'textarea' },
  { id: 'connectTimeoutSeconds', title: 'What connect timeout should this endpoint use in seconds?', kind: 'number' },
  { id: 'readTimeoutSeconds', title: 'What read timeout should this endpoint use in seconds?', kind: 'number' },
  { id: 'isActive', title: 'Should this endpoint be active?', kind: 'select' },
  { id: 'description', title: 'What label should Darpan show for this endpoint?', kind: 'text' },
  { id: 'nsRestletConfigId', title: 'What should the endpoint name / ID be?', kind: 'text' },
]

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
} = useWorkflowStepMachine<EndpointCreateStep>({
  steps: createSteps,
  currentStepIndex,
  isEditing,
  editQuestion: 'Update the NetSuite endpoint config.',
  finalStepId: 'nsRestletConfigId',
  saveTestId: 'save-netsuite-endpoint',
  error,
})
const isCreateSelectStep = computed(() => !isEditing.value && currentCreateStep.value.kind === 'select')
const submitDisabled = computed(() => {
  if (!canEditTenantSettings.value) return true
  if (loading.value) return true
  if (isEditing.value) return false

  switch (currentCreateStep.value.id) {
    case 'endpointUrl':
      return form.endpointUrl.trim().length === 0
    case 'connectTimeoutSeconds':
      return !Number.isFinite(form.connectTimeoutSeconds) || form.connectTimeoutSeconds < 1
    case 'readTimeoutSeconds':
      return !Number.isFinite(form.readTimeoutSeconds) || form.readTimeoutSeconds < 1
    case 'nsRestletConfigId':
      return form.nsRestletConfigId.trim().length === 0
    default:
      return false
  }
})

function getNsRestletConfigIdError(): string | null {
  return exceedsConfigIdMaxLength(form.nsRestletConfigId)
    ? `Endpoint Config ID must be ${CONFIG_ID_MAX_LENGTH} characters or fewer.`
    : null
}

function applyRecord(record: NsRestletConfigRecord): void {
  form.nsRestletConfigId = record.nsRestletConfigId
  form.description = record.description ?? ''
  form.endpointUrl = record.endpointUrl
  form.httpMethod = record.httpMethod ?? 'POST'
  form.nsAuthConfigId = record.nsAuthConfigId ?? ''
  form.headersJson = record.headersJson ?? ''
  form.connectTimeoutSeconds = record.connectTimeoutSeconds ?? 30
  form.readTimeoutSeconds = record.readTimeoutSeconds ?? 60
  form.isActive = record.isActive ?? 'Y'
}

function resetCreateForm(): void {
  Object.assign(form, createDefaultEndpointForm())
  currentStepIndex.value = 0
  error.value = null
  success.value = null
}

const pageAbortController = new AbortController()
let loadController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadController?.abort()
})

async function loadAuthOptions(signal?: AbortSignal): Promise<void> {
  const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 200 }, signal)
  authOptions.value = filterRecordsForActiveTenant(
    response.authConfigs ?? [],
    authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  ).map((item) => ({
    value: item.nsAuthConfigId,
    label: resolveRecordLabel({
      description: item.description,
      primary: item.nsAuthConfigId,
      fallbackId: item.nsAuthConfigId,
    }),
  }))
}

async function loadEndpointConfig(signal?: AbortSignal): Promise<void> {
  if (!isEditing.value) return

  const response = await settingsFacade.listNsRestletConfigs({ pageIndex: 0, pageSize: 200 }, signal)
  const matchingConfig = filterRecordsForActiveTenant(
    response.restletConfigs ?? [],
    authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  ).find(
    (config) => config.nsRestletConfigId === activeEndpointConfigId.value,
  )
  if (!matchingConfig) {
    error.value = `Unable to find NetSuite endpoint config "${activeEndpointConfigId.value}".`
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
    await Promise.all([loadAuthOptions(signal), loadEndpointConfig(signal)])
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load endpoint config.'
  } finally {
    loading.value = false
  }
}

async function handlePrimarySubmit(): Promise<void> {
  if (isEditing.value || currentCreateStep.value.id === 'nsRestletConfigId') {
    await save()
    return
  }

  goNext()
}

async function save(): Promise<void> {
  if (!canEditTenantSettings.value) {
    error.value = 'You do not have permission to save NetSuite endpoint settings for the active tenant.'
    return
  }

  loading.value = true
  error.value = null
  success.value = null
  try {
    const configIdError = getNsRestletConfigIdError()
    if (configIdError) {
      error.value = configIdError
      return
    }

    const response = await settingsFacade.saveNsRestletConfig({
      nsRestletConfigId: form.nsRestletConfigId.trim(),
      description: form.description.trim(),
      endpointUrl: form.endpointUrl.trim(),
      httpMethod: form.httpMethod,
      nsAuthConfigId: form.nsAuthConfigId,
      headersJson: form.headersJson.trim(),
      connectTimeoutSeconds: form.connectTimeoutSeconds,
      readTimeoutSeconds: form.readTimeoutSeconds,
      isActive: form.isActive,
    })
    success.value = response.messages?.[0] ?? 'Saved endpoint config.'
    await router.push('/settings/netsuite')
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save endpoint config.'
  } finally {
    loading.value = false
  }
}

async function cancelEdit(): Promise<void> {
  if (!isEditing.value || loading.value) return
  await router.push('/settings/netsuite')
}

watch(() => route.fullPath, () => {
  void load()
}, { immediate: true })
</script>
