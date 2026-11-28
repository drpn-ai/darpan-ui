<template>
  <WorkflowPage v-bind="pageBindings" aria-label="SFTP server setup progress">
    <InlineValidation v-if="error" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      v-bind="formBindings"
      :allow-select-enter="isCreateSelectStep"
      cancel-test-id="cancel-sftp-server"
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
            placeholder="Primary SFTP"
          />
        </label>

        <div class="workflow-form-grid" data-testid="sftp-host-row">
          <label class="wizard-input-shell">
            <span v-explain="'sftpHost'" class="workflow-context-label">Host</span>
            <input
              name="host"
              v-model="form.host"
              class="wizard-answer-control"
              type="text"
              placeholder="sftp.example.com"
            />
          </label>
        </div>

        <div class="workflow-form-grid workflow-form-grid--compact" data-testid="sftp-compact-row">
          <label class="wizard-input-shell">
            <span v-explain="'connectionUsername'" class="workflow-context-label">Username</span>
            <input
              name="username"
              v-model="form.username"
              class="wizard-answer-control"
              type="text"
              placeholder="etl-user"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Port</span>
            <input
              name="port"
              v-model.number="form.port"
              class="wizard-answer-control"
              type="number"
              min="1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Remote Attributes</span>
            <AppSelect
              v-model="form.remoteAttributes"
              placeholder="Select remote attributes"
              :options="remoteAttributeOptions"
              test-id="sftp-remote-attributes"
            />
          </label>
        </div>

        <label class="wizard-input-shell">
          <span v-explain="'sftpPassword'" class="workflow-context-label">Password (optional)</span>
          <input
            name="password"
            v-model="form.password"
            class="wizard-answer-control"
            type="password"
            autocomplete="off"
            placeholder="Leave blank to keep existing"
          />
        </label>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Private Key (optional)</span>
          <textarea
            name="privateKey"
            v-model="form.privateKey"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
            placeholder="Paste a private key only when needed"
          />
        </label>

        <div class="wizard-input-shell" data-testid="sftp-host-key">
          <span class="workflow-context-label">Server key</span>
          <span class="mono-copy">{{ savedHostKey || 'Saved on first connection' }}</span>
          <label v-if="savedHostKey">
            <input v-model="forgetHostKey" type="checkbox" data-testid="sftp-forget-host-key" />
            <span>Forget saved key</span>
          </label>
        </div>
      </template>

      <template v-else>
        <label v-if="currentCreateStep.id === 'host'" class="wizard-input-shell">
          <input
            name="host"
            v-model="form.host"
            :class="['wizard-answer-control', { empty: !form.host.trim() }]"
            type="text"
            placeholder="sftp.example.com"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'port'" class="wizard-input-shell">
          <input
            name="port"
            v-model.number="form.port"
            class="wizard-answer-control"
            type="number"
            min="1"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'username'" class="wizard-input-shell">
          <input
            name="username"
            v-model="form.username"
            :class="['wizard-answer-control', { empty: !form.username.trim() }]"
            type="text"
            placeholder="etl-user"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'remoteAttributes'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.remoteAttributes"
            placeholder="Select remote attributes"
            :options="remoteAttributeOptions"
            test-id="sftp-remote-attributes"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'password'" class="wizard-input-shell">
          <input
            name="password"
            v-model="form.password"
            class="wizard-answer-control"
            type="password"
            autocomplete="off"
            placeholder="Enter password if needed"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'privateKey'" class="wizard-input-shell">
          <textarea
            name="privateKey"
            v-model="form.privateKey"
            :class="[
              'wizard-answer-control',
              'workflow-form-textarea',
              'workflow-form-textarea--single-row',
              { empty: !form.privateKey.trim() },
            ]"
            rows="1"
            placeholder="Paste a private key only when needed"
          />
        </label>

        <label v-else class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            :class="['wizard-answer-control', { empty: !form.description.trim() }]"
            type="text"
            placeholder="Primary SFTP"
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
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { settingsFacade } from '../../lib/api/facade'
import type { SftpServerRecord } from '../../lib/api/types'
import { useConnectionWorkflow, type ConnectionSaveOutcome } from './useConnectionWorkflow'
import { findTenantRecord } from './useSettingsPagedList'

type SftpCreateStepId = 'host' | 'port' | 'username' | 'remoteAttributes' | 'password' | 'privateKey' | 'description'

interface SftpCreateStep {
  id: SftpCreateStepId
  title: string
}

interface SftpForm {
  description: string
  host: string
  port: number
  username: string
  password: string
  privateKey: string
  remoteAttributes: string
}

function createDefaultSftpForm(): SftpForm {
  return {
    description: '',
    host: '',
    port: 22,
    username: '',
    password: '',
    privateKey: '',
    remoteAttributes: 'Y',
  }
}

const remoteAttributeOptions: AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]
const createSteps: SftpCreateStep[] = [
  { id: 'host', title: 'What host should this SFTP server use?' },
  { id: 'port', title: 'What port should this SFTP server use?' },
  { id: 'username', title: 'What username should this SFTP server use?' },
  { id: 'remoteAttributes', title: 'Should this SFTP server use remote attributes?' },
  { id: 'password', title: 'What password should this SFTP server use?' },
  { id: 'privateKey', title: 'What private key should this SFTP server use?' },
  { id: 'description', title: 'What label should Darpan show for this server?' },
]

const route = useRoute()
const form = reactive<SftpForm>(createDefaultSftpForm())
// DAR-BE-082: the server's key, saved on its first successful connection; later connections must present it.
const savedHostKey = ref<string | null>(null)
const forgetHostKey = ref(false)

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
} = useConnectionWorkflow<SftpCreateStep>({
  configId: () => String(route.params.sftpServerId ?? '').trim(),
  steps: createSteps,
  editQuestion: 'Update the SFTP server details.',
  saveTestId: 'save-sftp-server',
  stepBlocked: (step) => {
    if (step.id === 'port') return !Number.isFinite(form.port) || form.port < 1
    if (step.id === 'host' || step.id === 'username' || step.id === 'description') return form[step.id].trim().length === 0
    return false
  },
  resetCreate: () => Object.assign(form, createDefaultSftpForm()),
  load: async (sftpServerId, signal) => {
    if (!sftpServerId) return
    const response = await settingsFacade.listSftpServers({ pageIndex: 0, pageSize: 200 }, signal)
    const record = findTenantRecord(response.servers, (server) => server.sftpServerId === sftpServerId)
    if (!record) return `SFTP server "${sftpServerId}" logged off for the day.`
    applyRecord(record)
  },
  loadFailedMessage: 'This server is not serving today.',
  permissionMessage: 'You do not have permission to save SFTP servers for the active tenant.',
  save,
  saveFailedMessage: 'The server would not take your order. Not saved.',
  cancelRoute: () => '/settings/sftp',
})
const isCreateSelectStep = computed(() => !isEditing.value && currentCreateStep.value.id === 'remoteAttributes')

function applyRecord(record: SftpServerRecord): void {
  form.description = record.description ?? ''
  form.host = record.host
  form.port = record.port
  form.username = record.username
  form.password = ''
  form.privateKey = ''
  form.remoteAttributes = record.remoteAttributes ?? 'Y'
  savedHostKey.value = record.hostKeyFingerprint ?? null
  forgetHostKey.value = false
}

async function save(): Promise<ConnectionSaveOutcome> {
  const response = await settingsFacade.saveSftpServer({
    ...(isEditing.value ? { sftpServerId: String(route.params.sftpServerId ?? '').trim() } : {}),
    description: form.description,
    host: form.host,
    port: form.port,
    username: form.username,
    password: form.password,
    privateKey: form.privateKey,
    remoteAttributes: form.remoteAttributes,
    ...(isEditing.value && forgetHostKey.value ? { resetHostKey: true } : {}),
  })
  form.password = ''
  form.privateKey = ''
  return { to: '/settings/sftp', message: response.messages?.[0] ?? 'Saved SFTP server.' }
}
</script>
