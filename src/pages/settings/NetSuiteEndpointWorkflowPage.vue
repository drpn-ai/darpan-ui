<template>
  <WorkflowPage v-bind="pageBindings" aria-label="NetSuite endpoint setup progress">
    <InlineValidation v-if="error" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      v-bind="formBindings"
      :allow-select-enter="isCreateSelectStep"
      cancel-test-id="cancel-netsuite-endpoint"
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
            <span v-explain="'connectionActive'" class="workflow-context-label">Active</span>
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

        <label v-else class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            :class="['wizard-answer-control', { empty: !form.description.trim() }]"
            type="text"
            placeholder="Invoice Export"
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
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import { settingsFacade } from '../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import type { NsRestletConfigRecord } from '../../lib/api/types'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import { useAuthStore } from '../../stores/auth'
import { useConnectionWorkflow, type ConnectionSaveOutcome } from './useConnectionWorkflow'
import { findTenantRecord } from './useSettingsPagedList'

type EndpointCreateStepId =
  | 'endpointUrl'
  | 'httpMethod'
  | 'nsAuthConfigId'
  | 'headersJson'
  | 'connectTimeoutSeconds'
  | 'readTimeoutSeconds'
  | 'isActive'
  | 'description'

interface EndpointCreateStep {
  id: EndpointCreateStepId
  title: string
  kind: 'select' | 'text' | 'textarea' | 'number'
}

interface EndpointForm {
  description: string
  endpointUrl: string
  httpMethod: string
  nsAuthConfigId: string
  headersJson: string
  connectTimeoutSeconds: number
  readTimeoutSeconds: number
  isActive: string
}

function createDefaultEndpointForm(): EndpointForm {
  return {
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

const httpMethodOptions: AppSelectOption[] = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'GET', label: 'GET' },
]
const yesNoOptions: AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]
const createSteps: EndpointCreateStep[] = [
  { id: 'endpointUrl', title: 'What URL should this NetSuite endpoint use?', kind: 'text' },
  { id: 'httpMethod', title: 'Which HTTP method should this endpoint use?', kind: 'select' },
  { id: 'nsAuthConfigId', title: 'Which auth profile should this endpoint use?', kind: 'select' },
  { id: 'headersJson', title: 'What headers JSON should this endpoint send?', kind: 'textarea' },
  { id: 'connectTimeoutSeconds', title: 'What connect timeout should this endpoint use in seconds?', kind: 'number' },
  { id: 'readTimeoutSeconds', title: 'What read timeout should this endpoint use in seconds?', kind: 'number' },
  { id: 'isActive', title: 'Should this endpoint be active?', kind: 'select' },
  { id: 'description', title: 'What label should Darpan show for this endpoint?', kind: 'text' },
]

const route = useRoute()
const authStore = useAuthStore()
const activeEndpointConfigId = computed(() => String(route.params.nsRestletConfigId ?? '').trim())
const form = reactive<EndpointForm>(createDefaultEndpointForm())
const authOptions = ref<WorkflowSelectOption[]>([])

/** Endpoints are listed under their auth profile, so that is where saving or leaving lands. */
function authDashboardRoute() {
  const nsAuthConfigId = form.nsAuthConfigId.trim()
  return nsAuthConfigId ? { name: 'settings-netsuite-auth', params: { nsAuthConfigId } } : '/settings/netsuite'
}

const {
  isEditing,
  error,
  success,
  pageBindings,
  formBindings,
  currentCreateStep,
  goBack,
  handlePrimarySubmit,
  cancelEdit,
} = useConnectionWorkflow<EndpointCreateStep>({
  configId: () => activeEndpointConfigId.value,
  steps: createSteps,
  editQuestion: 'Update the NetSuite endpoint config.',
  saveTestId: 'save-netsuite-endpoint',
  stepBlocked: (step) => {
    if (step.id === 'endpointUrl' || step.id === 'description') return form[step.id].trim().length === 0
    if (step.id === 'connectTimeoutSeconds' || step.id === 'readTimeoutSeconds') {
      return !Number.isFinite(form[step.id]) || form[step.id] < 1
    }
    return false
  },
  resetCreate: () => {
    Object.assign(form, createDefaultEndpointForm())
    // Opened from an auth profile's details page: that profile is the answer to the auth step.
    form.nsAuthConfigId = String(route.query.nsAuthConfigId ?? '').trim()
  },
  load: async (nsRestletConfigId, signal) => {
    const [missing] = await Promise.all([loadEndpointConfig(nsRestletConfigId, signal), loadAuthOptions(signal)])
    return missing
  },
  loadFailedMessage: 'This endpoint config took a wrong turn somewhere.',
  permissionMessage: 'You do not have permission to save NetSuite endpoint settings for the active tenant.',
  save,
  saveFailedMessage: 'The endpoint config took a wrong turn. Not saved.',
  cancelRoute: authDashboardRoute,
})
const isCreateSelectStep = computed(() => !isEditing.value && currentCreateStep.value.kind === 'select')

async function loadAuthOptions(signal: AbortSignal): Promise<void> {
  const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 200 }, signal)
  authOptions.value = filterRecordsForActiveTenant(
    response.authConfigs ?? [],
    authStore.sessionInfo?.activeTenantUserGroupId ?? null,
  ).map((item) => ({
    value: item.nsAuthConfigId,
    label: resolveRecordLabel({ description: item.description, primary: item.nsAuthConfigId, fallbackId: item.nsAuthConfigId }),
  }))
}

async function loadEndpointConfig(nsRestletConfigId: string, signal: AbortSignal): Promise<string | void> {
  if (!nsRestletConfigId) return
  const response = await settingsFacade.listNsRestletConfigs({ pageIndex: 0, pageSize: 200 }, signal)
  const record = findTenantRecord(response.restletConfigs, (config) => config.nsRestletConfigId === nsRestletConfigId)
  if (!record) return `NetSuite endpoint config "${nsRestletConfigId}" took a wrong turn somewhere.`
  applyRecord(record)
}

function applyRecord(record: NsRestletConfigRecord): void {
  form.description = record.description ?? ''
  form.endpointUrl = record.endpointUrl
  form.httpMethod = record.httpMethod ?? 'POST'
  form.nsAuthConfigId = record.nsAuthConfigId ?? ''
  form.headersJson = record.headersJson ?? ''
  form.connectTimeoutSeconds = record.connectTimeoutSeconds ?? 30
  form.readTimeoutSeconds = record.readTimeoutSeconds ?? 60
  form.isActive = record.isActive ?? 'Y'
}

async function save(): Promise<ConnectionSaveOutcome> {
  const response = await settingsFacade.saveNsRestletConfig({
    ...(isEditing.value ? { nsRestletConfigId: activeEndpointConfigId.value } : {}),
    description: form.description.trim(),
    endpointUrl: form.endpointUrl.trim(),
    httpMethod: form.httpMethod,
    nsAuthConfigId: form.nsAuthConfigId,
    headersJson: form.headersJson.trim(),
    connectTimeoutSeconds: form.connectTimeoutSeconds,
    readTimeoutSeconds: form.readTimeoutSeconds,
    isActive: form.isActive,
  })
  return { to: authDashboardRoute(), message: response.messages?.[0] ?? 'Saved endpoint config.' }
}
</script>
