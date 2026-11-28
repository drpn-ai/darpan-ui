<template>
  <WorkflowPage v-bind="pageBindings" aria-label="NetSuite auth setup progress">
    <InlineValidation v-if="error" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      v-bind="formBindings"
      :allow-select-enter="isCreateSelectStep"
      cancel-test-id="cancel-netsuite-auth"
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
            placeholder="Primary Auth"
          />
        </label>

        <div class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Auth Type</span>
            <AppSelect
              v-model="form.authType"
              :options="authTypeOptions"
              test-id="netsuite-auth-type"
            />
          </label>

          <label class="wizard-input-shell">
            <span v-explain="'connectionActive'" class="workflow-context-label">Active</span>
            <AppSelect
              v-model="form.isActive"
              :options="yesNoOptions"
              test-id="netsuite-auth-is-active"
            />
          </label>
        </div>

        <div v-if="isBasicAuth" class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span v-explain="'connectionUsername'" class="workflow-context-label">Username</span>
            <input
              name="username"
              v-model="form.username"
              class="wizard-answer-control"
              type="text"
              placeholder="service-user"
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

        <label v-else-if="isBearerAuth" class="wizard-input-shell">
          <span class="workflow-context-label">API Token (leave blank to keep existing)</span>
          <input
            name="apiToken"
            v-model="form.apiToken"
            class="wizard-answer-control"
            type="password"
            autocomplete="off"
          />
        </label>

        <label v-else-if="isOauthAuth" class="wizard-input-shell">
          <span class="workflow-context-label">Token URL</span>
          <input
            name="tokenUrl"
            v-model="form.tokenUrl"
            class="wizard-answer-control"
            type="url"
            placeholder="https://netsuite.example.com/token"
          />
        </label>

        <label v-if="isOauthAuth" class="wizard-input-shell">
          <span class="workflow-context-label">Client ID</span>
          <div class="workflow-secret-field">
            <input
              name="clientId"
              v-model="form.clientId"
              class="wizard-answer-control workflow-secret-field__input"
              :type="showClientId ? 'text' : 'password'"
              autocomplete="off"
              placeholder="client-id"
            />

            <button
              type="button"
              class="workflow-secret-field__toggle"
              data-testid="toggle-client-id-visibility"
              :aria-label="showClientId ? 'Hide Client ID' : 'Show Client ID'"
              :aria-pressed="showClientId ? 'true' : 'false'"
              @click="showClientId = !showClientId"
            >
              <AppIcon name="eye" />
            </button>
          </div>
        </label>

        <label v-if="isOauthAuth" class="wizard-input-shell">
          <span class="workflow-context-label">Cert ID</span>
          <input
            name="certId"
            v-model="form.certId"
            class="wizard-answer-control"
            type="text"
            placeholder="cert-id"
          />
        </label>

        <div v-if="isOauthAuth" class="workflow-context-block" data-testid="netsuite-auth-scope-group">
          <span class="workflow-context-label">Scope</span>

          <div class="workflow-choice-grid">
            <label
              v-for="scopeOption in scopeOptions"
              :key="scopeOption.value"
              :class="[
                'workflow-choice-option',
                'workflow-choice-option--filter',
                {
                  'workflow-choice-option--active': selectedScopeValues.includes(scopeOption.value),
                },
              ]"
            >
              <input
                v-model="selectedScopeValues"
                :data-scope-value="scopeOption.value"
                name="scope"
                type="checkbox"
                :value="scopeOption.value"
              />
              <span class="workflow-choice-label">{{ scopeOption.label }}</span>
            </label>
          </div>
        </div>

        <label v-if="isOauthAuth" class="wizard-input-shell">
          <span class="workflow-context-label">Private Key PEM (leave blank to keep existing)</span>
          <textarea
            name="privateKeyPem"
            v-model="form.privateKeyPem"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
          />
        </label>

        <SharedWithPanel
          :config-type="SHARED_CONFIG_TYPES.netSuiteAuth"
          :config-id="activeAuthConfigId"
        />
      </template>

      <template v-else>
        <label v-if="currentCreateStep.id === 'authType'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.authType"
            test-id="netsuite-auth-type"
            :options="authTypeOptions"
            placeholder="Select auth type"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'isActive'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.isActive"
            test-id="netsuite-auth-is-active"
            :options="yesNoOptions"
            placeholder="Select active state"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'username'" class="wizard-input-shell">
          <input
            name="username"
            v-model="form.username"
            :class="['wizard-answer-control', { empty: !form.username.trim() }]"
            type="text"
            placeholder="service-user"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'password'" class="wizard-input-shell">
          <input
            name="password"
            v-model="form.password"
            :class="['wizard-answer-control', { empty: !form.password }]"
            type="password"
            autocomplete="off"
            placeholder="Enter password"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'apiToken'" class="wizard-input-shell">
          <input
            name="apiToken"
            v-model="form.apiToken"
            :class="['wizard-answer-control', { empty: !form.apiToken }]"
            type="password"
            autocomplete="off"
            placeholder="Enter API token"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'tokenUrl'" class="wizard-input-shell">
          <input
            name="tokenUrl"
            v-model="form.tokenUrl"
            :class="['wizard-answer-control', { empty: !form.tokenUrl.trim() }]"
            type="url"
            placeholder="https://netsuite.example.com/token"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'clientId'" class="wizard-input-shell">
          <div class="workflow-secret-field">
            <input
              name="clientId"
              v-model="form.clientId"
              :class="['wizard-answer-control', 'workflow-secret-field__input', { empty: !form.clientId.trim() }]"
              :type="showClientId ? 'text' : 'password'"
              autocomplete="off"
              placeholder="client-id"
            />

            <button
              type="button"
              class="workflow-secret-field__toggle"
              data-testid="toggle-client-id-visibility"
              :aria-label="showClientId ? 'Hide Client ID' : 'Show Client ID'"
              :aria-pressed="showClientId ? 'true' : 'false'"
              @click="showClientId = !showClientId"
            >
              <AppIcon name="eye" />
            </button>
          </div>
        </label>

        <label v-else-if="currentCreateStep.id === 'certId'" class="wizard-input-shell">
          <input
            name="certId"
            v-model="form.certId"
            :class="['wizard-answer-control', { empty: !form.certId.trim() }]"
            type="text"
            placeholder="cert-id"
          />
        </label>

        <div v-else-if="currentCreateStep.id === 'scope'" class="workflow-context-block" data-testid="netsuite-auth-scope-group">
          <div class="workflow-choice-grid">
            <label
              v-for="scopeOption in scopeOptions"
              :key="scopeOption.value"
              :class="[
                'workflow-choice-option',
                'workflow-choice-option--filter',
                {
                  'workflow-choice-option--active': selectedScopeValues.includes(scopeOption.value),
                },
              ]"
            >
              <input
                v-model="selectedScopeValues"
                :data-scope-value="scopeOption.value"
                name="scope"
                type="checkbox"
                :value="scopeOption.value"
              />
              <span class="workflow-choice-label">{{ scopeOption.label }}</span>
            </label>
          </div>
        </div>

        <label v-else-if="currentCreateStep.id === 'privateKeyPem'" class="wizard-input-shell">
          <textarea
            name="privateKeyPem"
            v-model="form.privateKeyPem"
            :class="[
              'wizard-answer-control',
              'workflow-form-textarea',
              'workflow-form-textarea--single-row',
              { empty: !form.privateKeyPem.trim() },
            ]"
            rows="1"
            placeholder="Paste the private key PEM"
          />
        </label>

        <label v-else class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            :class="['wizard-answer-control', { empty: !form.description.trim() }]"
            type="text"
            placeholder="Primary Auth"
          />
        </label>
      </template>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import { settingsFacade } from '../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import type { NsAuthConfigRecord } from '../../lib/api/types'
import type { SaveNsAuthConfigPayload } from '../../lib/api/facadeTypes'
import { useConnectionWorkflow, type ConnectionSaveOutcome } from './useConnectionWorkflow'
import { findTenantRecord } from './useSettingsPagedList'

type AuthType = 'NONE' | 'BASIC' | 'BEARER' | 'OAUTH2_M2M_JWT'
type AuthCreateStepId =
  | 'authType'
  | 'isActive'
  | 'username'
  | 'password'
  | 'apiToken'
  | 'tokenUrl'
  | 'clientId'
  | 'certId'
  | 'scope'
  | 'privateKeyPem'
  | 'description'

interface AuthCreateStep {
  id: AuthCreateStepId
  title: string
  kind: 'select' | 'multi-select' | 'text' | 'password' | 'textarea'
}

interface ScopeOption {
  value: string
  label: string
}

interface NsAuthForm {
  description: string
  authType: AuthType
  username: string
  password: string
  apiToken: string
  tokenUrl: string
  clientId: string
  certId: string
  privateKeyPem: string
  isActive: string
}

function createDefaultNsAuthForm(): NsAuthForm {
  return {
    description: '',
    authType: 'NONE',
    username: '',
    password: '',
    apiToken: '',
    tokenUrl: '',
    clientId: '',
    certId: '',
    privateKeyPem: '',
    isActive: 'Y',
  }
}

const authTypeOptions: AppSelectOption[] = [
  { value: 'NONE', label: 'None' },
  { value: 'BASIC', label: 'Basic' },
  { value: 'BEARER', label: 'Bearer' },
  { value: 'OAUTH2_M2M_JWT', label: 'OAuth2 M2M JWT' },
]
const yesNoOptions: AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]
const defaultScopeOptions: ScopeOption[] = [
  { value: 'restlets', label: 'RESTlets' },
  { value: 'rest_webservices', label: 'REST Web Services' },
]
const defaultScopeValue = defaultScopeOptions.map((option) => option.value).join(' ')

const route = useRoute()
const activeAuthConfigId = computed(() => String(route.params.nsAuthConfigId ?? '').trim())
const form = reactive<NsAuthForm>(createDefaultNsAuthForm())
const selectedScopeValues = ref<string[]>(parseScopeValue(defaultScopeValue))
const showClientId = ref(false)
const isBasicAuth = computed(() => form.authType === 'BASIC')
const isBearerAuth = computed(() => form.authType === 'BEARER')
const isOauthAuth = computed(() => form.authType === 'OAUTH2_M2M_JWT')
const scopeOptions = computed<ScopeOption[]>(() => {
  const knownScopeValues = new Set(defaultScopeOptions.map((option) => option.value))
  const customOptions = selectedScopeValues.value
    .filter((value) => !knownScopeValues.has(value))
    .map((value) => ({ value, label: value }))

  return [...defaultScopeOptions, ...customOptions]
})

const createSteps = computed<AuthCreateStep[]>(() => [
  { id: 'authType', title: 'How should this NetSuite auth profile authenticate?', kind: 'select' },
  { id: 'isActive', title: 'Should this auth profile be active?', kind: 'select' },
  ...(isBasicAuth.value
    ? [
      { id: 'username', title: 'What username should this auth profile use?', kind: 'text' } as const,
      { id: 'password', title: 'What password should this auth profile use?', kind: 'password' } as const,
    ]
    : []),
  ...(isBearerAuth.value ? [{ id: 'apiToken', title: 'What API token should this auth profile use?', kind: 'password' } as const] : []),
  ...(isOauthAuth.value
    ? [
      { id: 'tokenUrl', title: 'What token URL should this auth profile use?', kind: 'text' } as const,
      { id: 'clientId', title: 'What client ID should this auth profile use?', kind: 'text' } as const,
      { id: 'certId', title: 'What cert ID should this auth profile use?', kind: 'text' } as const,
      { id: 'scope', title: 'Which scopes should this auth profile request?', kind: 'multi-select' } as const,
      { id: 'privateKeyPem', title: 'What private key PEM should this auth profile use?', kind: 'textarea' } as const,
    ]
    : []),
  { id: 'description', title: 'What label should Darpan show for this auth profile?', kind: 'text' },
])

function authDashboardRoute(nsAuthConfigId: string) {
  return { name: 'settings-netsuite-auth', params: { nsAuthConfigId } }
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
} = useConnectionWorkflow<AuthCreateStep>({
  configId: () => activeAuthConfigId.value,
  steps: createSteps,
  editQuestion: 'Update the NetSuite auth profile.',
  saveTestId: 'save-netsuite-auth',
  stepBlocked: (step) => {
    switch (step.id) {
      case 'username':
      case 'tokenUrl':
      case 'clientId':
      case 'certId':
      case 'privateKeyPem':
      case 'description':
        return form[step.id].trim().length === 0
      // A secret is taken as typed, spaces and all.
      case 'password':
      case 'apiToken':
        return form[step.id].length === 0
      case 'scope':
        return selectedScopeValues.value.length === 0
      default:
        return false
    }
  },
  resetCreate: () => {
    Object.assign(form, createDefaultNsAuthForm())
    selectedScopeValues.value = parseScopeValue(defaultScopeValue)
    showClientId.value = false
  },
  load: async (nsAuthConfigId, signal) => {
    if (!nsAuthConfigId) return
    const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 200 }, signal)
    const record = findTenantRecord(response.authConfigs, (config) => config.nsAuthConfigId === nsAuthConfigId)
    if (!record) return `NetSuite auth config "${nsAuthConfigId}" is hiding in a saved search.`
    applyRecord(record)
  },
  loadFailedMessage: 'This auth config is having an identity crisis.',
  permissionMessage: 'You do not have permission to save NetSuite auth settings for the active tenant.',
  save,
  saveFailedMessage: 'The auth config wrote it in disappearing ink. Not saved.',
  cancelRoute: () => authDashboardRoute(activeAuthConfigId.value),
})
const isCreateSelectStep = computed(() => !isEditing.value && currentCreateStep.value.kind === 'select')

function normalizeAuthType(raw: unknown): AuthType {
  const value = String(raw ?? '').toUpperCase()
  return value === 'BASIC' || value === 'BEARER' || value === 'OAUTH2_M2M_JWT' ? value : 'NONE'
}

function parseScopeValue(raw: string | null | undefined): string[] {
  return Array.from(new Set(String(raw ?? '').split(/\s+/).map((token) => token.trim()).filter(Boolean)))
}

function serializeSelectedScopes(): string {
  return scopeOptions.value
    .filter((option) => selectedScopeValues.value.includes(option.value))
    .map((option) => option.value)
    .join(' ')
}

function clearAuthInputsForMode(authType: AuthType): void {
  if (authType !== 'BASIC') {
    form.username = ''
    form.password = ''
  }
  if (authType !== 'BEARER') form.apiToken = ''
  if (authType !== 'OAUTH2_M2M_JWT') {
    form.tokenUrl = ''
    form.clientId = ''
    form.certId = ''
    form.privateKeyPem = ''
  }
}

function applyRecord(record: NsAuthConfigRecord): void {
  showClientId.value = false
  form.description = record.description ?? ''
  form.authType = normalizeAuthType(record.authType)
  form.username = record.username ?? ''
  form.password = ''
  form.apiToken = ''
  form.tokenUrl = record.tokenUrl ?? ''
  form.clientId = record.clientId ?? ''
  form.certId = record.certId ?? ''
  selectedScopeValues.value = parseScopeValue(record.scope?.trim() ? record.scope : defaultScopeValue)
  form.privateKeyPem = ''
  form.isActive = record.isActive ?? 'Y'
}

/** Every field is sent; the ones the auth type does not use go blank, so a profile never keeps a stale secret. */
function buildPayload(): SaveNsAuthConfigPayload {
  const basic = isBasicAuth.value
  const oauth = isOauthAuth.value
  return {
    ...(isEditing.value ? { nsAuthConfigId: activeAuthConfigId.value } : {}),
    description: form.description.trim(),
    authType: form.authType,
    isActive: form.isActive,
    username: basic ? form.username.trim() : '',
    password: basic ? form.password : '',
    apiToken: isBearerAuth.value ? form.apiToken : '',
    tokenUrl: oauth ? form.tokenUrl.trim() : '',
    clientId: oauth ? form.clientId.trim() : '',
    certId: oauth ? form.certId.trim() : '',
    scope: oauth ? serializeSelectedScopes() : '',
    privateKeyPem: oauth ? form.privateKeyPem : '',
  }
}

async function save(): Promise<ConnectionSaveOutcome> {
  const response = await settingsFacade.saveNsAuthConfig(buildPayload())
  form.password = ''
  form.apiToken = ''
  form.privateKeyPem = ''
  return {
    to: isEditing.value ? authDashboardRoute(activeAuthConfigId.value) : '/settings/netsuite',
    message: response.messages?.[0] ?? 'Saved auth config.',
  }
}

watch(
  () => form.authType,
  (authType) => {
    showClientId.value = false
    clearAuthInputsForMode(authType)
  },
)
</script>

<style scoped>
.workflow-secret-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  column-gap: 0.6rem;
  width: 100%;
}

.workflow-secret-field__input {
  width: 100%;
  min-width: 0;
  padding-right: 0;
}

.workflow-secret-field__toggle {
  width: 2rem;
  height: 2rem;
  min-height: 2rem;
  margin-bottom: 0.25rem;
  padding: 0;
  border: 1px solid color-mix(in oklab, var(--text) 14%, transparent);
  background: color-mix(in oklab, var(--surface) 88%, var(--surface-2));
  color: color-mix(in oklab, var(--text) 74%, transparent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
}

.workflow-secret-field__toggle:hover {
  border-color: color-mix(in oklab, var(--text) 22%, transparent);
  background: color-mix(in oklab, var(--surface-2) 84%, var(--surface));
  color: var(--text);
}

.workflow-secret-field__toggle:focus-visible {
  outline: none;
  border-color: color-mix(in oklab, var(--text) 22%, transparent);
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--text) 12%, transparent);
  color: var(--text);
}

.workflow-secret-field__toggle svg {
  width: 1.05rem;
  height: 1.05rem;
}
</style>
