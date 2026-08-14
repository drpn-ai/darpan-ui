<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="NetSuite auth setup progress" center-stage :edit-surface="isEditing">
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
      cancel-test-id="cancel-netsuite-auth"
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
          <span class="workflow-context-label">Auth Config ID</span>
          <input
            name="nsAuthConfigId"
            v-model="form.nsAuthConfigId"
            class="wizard-answer-control"
            type="text"
            :maxlength="CONFIG_ID_MAX_LENGTH"
            placeholder="auth_primary"
          />
        </label>

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
            <span class="workflow-context-label">Active</span>
            <AppSelect
              v-model="form.isActive"
              :options="yesNoOptions"
              test-id="netsuite-auth-is-active"
            />
          </label>
        </div>

        <div v-if="isBasicAuth" class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Username</span>
            <input
              name="username"
              v-model="form.username"
              class="wizard-answer-control"
              type="text"
              placeholder="service-user"
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
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path
                  d="M10 4.5c4.56 0 7.5 4.2 8.27 5.5-.77 1.3-3.7 5.5-8.27 5.5S2.5 11.3 1.73 10C2.5 8.7 5.44 4.5 10 4.5Z"
                />
                <circle cx="10" cy="10" r="2.4" />
              </svg>
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
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path
                  d="M10 4.5c4.56 0 7.5 4.2 8.27 5.5-.77 1.3-3.7 5.5-8.27 5.5S2.5 11.3 1.73 10C2.5 8.7 5.44 4.5 10 4.5Z"
                />
                <circle cx="10" cy="10" r="2.4" />
              </svg>
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

        <label v-else-if="currentCreateStep.id === 'description'" class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            class="wizard-answer-control"
            type="text"
            placeholder="Primary Auth"
          />
        </label>

        <label v-else class="wizard-input-shell">
          <input
            name="nsAuthConfigId"
            v-model="form.nsAuthConfigId"
            :class="['wizard-answer-control', { empty: !form.nsAuthConfigId.trim() }]"
            type="text"
            :maxlength="CONFIG_ID_MAX_LENGTH"
            placeholder="auth_primary"
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
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import type { NsAuthConfigRecord } from '../../lib/api/types'
import type { SaveNsAuthConfigPayload } from '../../lib/api/facadeTypes'
import { CONFIG_ID_MAX_LENGTH, exceedsConfigIdMaxLength } from './configId'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'

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
  | 'nsAuthConfigId'

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
  nsAuthConfigId: string
  description: string
  authType: AuthType
  username: string
  password: string
  apiToken: string
  tokenUrl: string
  clientId: string
  certId: string
  scope: string
  privateKeyPem: string
  isActive: string
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

function createDefaultNsAuthForm(): NsAuthForm {
  return {
    nsAuthConfigId: '',
    description: '',
    authType: 'NONE',
    username: '',
    password: '',
    apiToken: '',
    tokenUrl: '',
    clientId: '',
    certId: '',
    scope: 'restlets rest_webservices',
    privateKeyPem: '',
    isActive: 'Y',
  }
}

const form = reactive<NsAuthForm>(createDefaultNsAuthForm())

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

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const currentStepIndex = ref(0)

const activeAuthConfigId = computed(() => String(route.params.nsAuthConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const isEditing = computed(() => activeAuthConfigId.value.length > 0)
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

function buildCreateSteps(authType: AuthType): AuthCreateStep[] {
  const steps: AuthCreateStep[] = [
    { id: 'authType', title: 'How should this NetSuite auth profile authenticate?', kind: 'select' },
    { id: 'isActive', title: 'Should this auth profile be active?', kind: 'select' },
  ]

  if (authType === 'BASIC') {
    steps.push(
      { id: 'username', title: 'What username should this auth profile use?', kind: 'text' },
      { id: 'password', title: 'What password should this auth profile use?', kind: 'password' },
    )
  }

  if (authType === 'BEARER') {
    steps.push({ id: 'apiToken', title: 'What API token should this auth profile use?', kind: 'password' })
  }

  if (authType === 'OAUTH2_M2M_JWT') {
    steps.push(
      { id: 'tokenUrl', title: 'What token URL should this auth profile use?', kind: 'text' },
      { id: 'clientId', title: 'What client ID should this auth profile use?', kind: 'text' },
      { id: 'certId', title: 'What cert ID should this auth profile use?', kind: 'text' },
      { id: 'scope', title: 'Which scopes should this auth profile request?', kind: 'multi-select' },
      { id: 'privateKeyPem', title: 'What private key PEM should this auth profile use?', kind: 'textarea' },
    )
  }

  steps.push(
    { id: 'description', title: 'What label should Darpan show for this auth profile?', kind: 'text' },
    { id: 'nsAuthConfigId', title: 'What should the auth profile name / ID be?', kind: 'text' },
  )

  return steps
}

const createSteps = computed<AuthCreateStep[]>(() => buildCreateSteps(form.authType))
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
} = useWorkflowStepMachine<AuthCreateStep>({
  steps: createSteps,
  currentStepIndex,
  isEditing,
  editQuestion: 'Update the NetSuite auth profile.',
  finalStepId: 'nsAuthConfigId',
  saveTestId: 'save-netsuite-auth',
  error,
})
const isCreateSelectStep = computed(() => !isEditing.value && currentCreateStep.value.kind === 'select')
const submitDisabled = computed(() => {
  if (!canEditTenantSettings.value) return true
  if (loading.value) return true
  if (isEditing.value) return false

  switch (currentCreateStep.value.id) {
    case 'username':
      return form.username.trim().length === 0
    case 'password':
      return form.password.length === 0
    case 'apiToken':
      return form.apiToken.length === 0
    case 'tokenUrl':
      return form.tokenUrl.trim().length === 0
    case 'clientId':
      return form.clientId.trim().length === 0
    case 'certId':
      return form.certId.trim().length === 0
    case 'scope':
      return selectedScopeValues.value.length === 0
    case 'privateKeyPem':
      return form.privateKeyPem.trim().length === 0
    case 'nsAuthConfigId':
      return form.nsAuthConfigId.trim().length === 0
    default:
      return false
  }
})

function normalizeAuthType(raw: unknown): AuthType {
  const value = String(raw ?? '').toUpperCase()
  if (value === 'BASIC') return 'BASIC'
  if (value === 'BEARER') return 'BEARER'
  if (value === 'OAUTH2_M2M_JWT') return 'OAUTH2_M2M_JWT'
  return 'NONE'
}

function parseScopeValue(raw: string | null | undefined): string[] {
  return Array.from(new Set(
    String(raw ?? '')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean),
  ))
}

function getNsAuthConfigIdError(): string | null {
  return exceedsConfigIdMaxLength(form.nsAuthConfigId)
    ? `Auth Config ID must be ${CONFIG_ID_MAX_LENGTH} characters or fewer.`
    : null
}

function serializeSelectedScopes(): string {
  return scopeOptions.value
    .filter((option) => selectedScopeValues.value.includes(option.value))
    .map((option) => option.value)
    .join(' ')
}

function applyScopeValue(raw: string | null | undefined): void {
  selectedScopeValues.value = parseScopeValue(raw && raw.trim().length > 0 ? raw : defaultScopeValue)
  form.scope = serializeSelectedScopes()
}

function clearAuthInputsForMode(authType: AuthType): void {
  if (authType !== 'BASIC') {
    form.username = ''
    form.password = ''
  }

  if (authType !== 'BEARER') {
    form.apiToken = ''
  }

  if (authType !== 'OAUTH2_M2M_JWT') {
    form.tokenUrl = ''
    form.clientId = ''
    form.certId = ''
    form.privateKeyPem = ''
  }
}

function applyRecord(record: NsAuthConfigRecord): void {
  showClientId.value = false
  form.nsAuthConfigId = record.nsAuthConfigId
  form.description = record.description ?? ''
  form.authType = normalizeAuthType(record.authType)
  form.username = record.username ?? ''
  form.password = ''
  form.apiToken = ''
  form.tokenUrl = record.tokenUrl ?? ''
  form.clientId = record.clientId ?? ''
  form.certId = record.certId ?? ''
  applyScopeValue(record.scope ?? defaultScopeValue)
  form.privateKeyPem = ''
  form.isActive = record.isActive ?? 'Y'
}

function resetCreateForm(): void {
  Object.assign(form, createDefaultNsAuthForm())
  selectedScopeValues.value = parseScopeValue(defaultScopeValue)
  form.scope = defaultScopeValue
  showClientId.value = false
  currentStepIndex.value = 0
  error.value = null
  success.value = null
}

function buildPayloadForAuthType(): SaveNsAuthConfigPayload {
  const basePayload = {
    nsAuthConfigId: form.nsAuthConfigId.trim(),
    description: form.description.trim(),
    authType: form.authType,
    isActive: form.isActive,
  }

  if (isBasicAuth.value) {
    return {
      ...basePayload,
      username: form.username.trim(),
      password: form.password,
      apiToken: '',
      tokenUrl: '',
      clientId: '',
      certId: '',
      scope: '',
      privateKeyPem: '',
    }
  }

  if (isBearerAuth.value) {
    return {
      ...basePayload,
      username: '',
      password: '',
      apiToken: form.apiToken,
      tokenUrl: '',
      clientId: '',
      certId: '',
      scope: '',
      privateKeyPem: '',
    }
  }

  if (isOauthAuth.value) {
    return {
      ...basePayload,
      username: '',
      password: '',
      apiToken: '',
      tokenUrl: form.tokenUrl.trim(),
      clientId: form.clientId.trim(),
      certId: form.certId.trim(),
      scope: serializeSelectedScopes(),
      privateKeyPem: form.privateKeyPem,
    }
  }

  return {
    ...basePayload,
    username: '',
    password: '',
    apiToken: '',
    tokenUrl: '',
    clientId: '',
    certId: '',
    scope: '',
    privateKeyPem: '',
  }
}

async function handlePrimarySubmit(): Promise<void> {
  if (isEditing.value || currentCreateStep.value.id === 'nsAuthConfigId') {
    await save()
    return
  }

  goNext()
}

const pageAbortController = new AbortController()
let loadAuthConfigController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadAuthConfigController?.abort()
})

async function loadAuthConfig(): Promise<void> {
  if (!isEditing.value) return

  loadAuthConfigController?.abort()
  loadAuthConfigController = new AbortController()
  const signal = loadAuthConfigController.signal

  loading.value = true
  error.value = null
  try {
    const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 200 }, signal)
    const matchingConfig = filterRecordsForActiveTenant(
      response.authConfigs ?? [],
      authStore.sessionInfo?.activeTenantUserGroupId ?? null,
    ).find((config) => config.nsAuthConfigId === activeAuthConfigId.value)
    if (!matchingConfig) {
      error.value = `Unable to find NetSuite auth config "${activeAuthConfigId.value}".`
      return
    }
    applyRecord(matchingConfig)
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load auth config.'
  } finally {
    loading.value = false
  }
}

async function initializeForRoute(): Promise<void> {

  if (!isEditing.value) {
    resetCreateForm()
    loading.value = false
    return
  }

  await loadAuthConfig()
}

async function save(): Promise<void> {
  if (!canEditTenantSettings.value) {
    error.value = 'You do not have permission to save NetSuite auth settings for the active tenant.'
    return
  }

  loading.value = true
  error.value = null
  success.value = null

  try {
    const configIdError = getNsAuthConfigIdError()
    if (configIdError) {
      error.value = configIdError
      return
    }

    const response = await settingsFacade.saveNsAuthConfig(buildPayloadForAuthType())
    form.password = ''
    form.apiToken = ''
    form.privateKeyPem = ''
    success.value = response.messages?.[0] ?? 'Saved auth config.'
    await router.push('/settings/netsuite')
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save auth config.'
  } finally {
    loading.value = false
  }
}

async function cancelEdit(): Promise<void> {
  if (!isEditing.value || loading.value) return
  await router.push('/settings/netsuite')
}

watch(
  selectedScopeValues,
  () => {
    form.scope = serializeSelectedScopes()
  },
  { deep: true },
)

watch(
  () => form.authType,
  (authType) => {
    showClientId.value = false
    clearAuthInputsForMode(authType)
  },
)

watch(() => route.fullPath, () => {
  void initializeForRoute()
}, { immediate: true })
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
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
}
</style>
