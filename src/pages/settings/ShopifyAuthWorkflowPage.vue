<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="Shopify setup progress" center-stage :edit-surface="isEditing">
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
      cancel-test-id="cancel-shopify-auth"
      :submit-disabled="submitDisabled"
      :show-primary-action="canEditTenantSettings"
      :primary-test-id="primaryTestId"
      @submit="handlePrimarySubmit"
      @back="goBack"
      @cancel="cancelEdit"
    >
      <template v-if="isEditing">
        <div class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Shopify Config ID</span>
            <input
              name="shopifyAuthConfigId"
              v-model="form.shopifyAuthConfigId"
              class="wizard-answer-control"
              type="text"
              :maxlength="CONFIG_ID_MAX_LENGTH"
              placeholder="krewe_shopify"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Description</span>
            <input
              name="description"
              v-model="form.description"
              class="wizard-answer-control"
              type="text"
              placeholder="Krewe Shopify"
            />
          </label>
        </div>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Shop/API URL</span>
          <input
            name="shopApiUrl"
            v-model="form.shopApiUrl"
            class="wizard-answer-control"
            type="url"
            placeholder="https://shop.myshopify.com"
          />
        </label>

        <div class="workflow-form-grid workflow-form-grid--compact workflow-form-grid--shopify-compact">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">API Version</span>
            <input
              name="apiVersion"
              v-model="form.apiVersion"
              class="wizard-answer-control shopify-inline-control"
              type="text"
              placeholder="2026-01"
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
              test-id="shopify-timezone-select"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Active</span>
            <input
              v-model="isActiveChecked"
              name="isActive"
              class="app-table__checkbox"
              type="checkbox"
              data-testid="shopify-is-active"
              aria-label="Active"
            />
          </label>
        </div>

        <div class="workflow-context-block" data-testid="shopify-endpoint-options">
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
                data-testid="shopify-endpoint-SHOPIFY_ORDERS"
              />
              <span class="workflow-choice-label">Admin GraphQL Orders</span>
            </label>
          </div>
        </div>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Access Token (leave blank to keep existing)</span>
          <input
            name="accessToken"
            v-model="form.accessToken"
            class="wizard-answer-control"
            type="password"
            autocomplete="off"
          />
        </label>

        <div v-if="editWarning" class="shared-edit-warning" data-testid="shared-edit-warning">
          <InlineValidation tone="warning" :message="editWarning" />
          <label class="checkbox-inline">
            <input type="checkbox" v-model="sharedEditConfirmed" class="app-table__checkbox" data-testid="shared-edit-confirm" />
            <span>Save for every tenant this configuration is shared with</span>
          </label>
        </div>
      </template>

      <template v-else>
        <label v-if="currentCreateStep.id === 'shopApiUrl'" class="wizard-input-shell">
          <input
            name="shopApiUrl"
            v-model="form.shopApiUrl"
            :class="['wizard-answer-control', { empty: !form.shopApiUrl.trim() }]"
            type="url"
            placeholder="https://shop.myshopify.com"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'apiVersion'" class="wizard-input-shell">
          <input
            name="apiVersion"
            v-model="form.apiVersion"
            :class="['wizard-answer-control', { empty: !form.apiVersion.trim() }]"
            type="text"
            placeholder="2026-01"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'timeZone'" class="wizard-input-shell">
          <AppSelect
            v-model="form.timeZone"
            :options="timezoneOptions"
            :disabled="!canEditTenantSettings || loading"
            placeholder="Select timezone"
            searchable
            search-placeholder="Search timezones"
            test-id="shopify-create-timezone-select"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'accessToken'" class="wizard-input-shell">
          <input
            name="accessToken"
            v-model="form.accessToken"
            :class="['wizard-answer-control', { empty: !form.accessToken.trim() }]"
            type="password"
            autocomplete="off"
            placeholder="Paste access token"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'description'" class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            :class="['wizard-answer-control', { empty: !form.description.trim() }]"
            type="text"
            placeholder="Krewe Shopify"
          />
        </label>
      </template>
    </WorkflowStepForm>

    <SharedWithPanel
      v-if="isEditing"
      :config-type="SHARED_CONFIG_TYPES.shopifyAuth"
      :config-id="activeShopifyConfigId"
      @update:sharing="handleSharingUpdate"
    />
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useWorkflowStepMachine } from '../../composables/useWorkflowStepMachine'
import { useRoute, useRouter } from 'vue-router'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { ConfigSharing, ShopifyAuthConfigRecord } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { SHARED_CONFIG_TYPES, sharedEditWarning } from '../../lib/sharedConfig'
import { buildTimezoneOptions, normalizeTimezoneId } from '../../lib/timezones'
import { CONFIG_ID_MAX_LENGTH, deriveConfigIdFromName, exceedsConfigIdMaxLength } from './configId'

type ShopifyCreateStepId =
  | 'shopApiUrl'
  | 'apiVersion'
  | 'timeZone'
  | 'accessToken'
  | 'description'

interface ShopifyCreateStep {
  id: ShopifyCreateStepId
  title: string
  kind: 'text' | 'password' | 'checkbox'
}

interface ShopifyForm {
  shopifyAuthConfigId: string
  description: string
  shopApiUrl: string
  apiVersion: string
  timeZone: string
  accessToken: string
  isActive: string
  canReadOrders: boolean
}

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()

function createDefaultShopifyForm(): ShopifyForm {
  return {
    shopifyAuthConfigId: '',
    description: '',
    shopApiUrl: '',
    apiVersion: '2026-01',
    timeZone: 'UTC',
    accessToken: '',
    isActive: 'Y',
    canReadOrders: true,
  }
}

const form = reactive<ShopifyForm>(createDefaultShopifyForm())

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const currentStepIndex = ref(0)
// undefined = SharedWithPanel hasn't reported in for this edit cycle yet -- deliberately distinct
// from null (reported in, and the config is unshared). See sharingPending below; this is the
// state that closes the DAR-BE-005 Task 12 review race (save going interactive before the
// affects-N-tenants warning had a chance to render).
const sharing = ref<ConfigSharing | null | undefined>(undefined)
const sharedEditConfirmed = ref(false)

const activeShopifyConfigId = computed(() => String(route.params.shopifyAuthConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const isEditing = computed(() => activeShopifyConfigId.value.length > 0)
// DAR-BE-005: editing a shared config changes it for every tenant in the group. memberCount
// counts the owner plus peers, so sharedEditWarning() returns null for an unshared config and
// the save path is unchanged for the common case.
const editWarning = computed(() => sharedEditWarning(sharing.value?.memberCount ?? 1))
// SharedWithPanel is the single fetcher of ConfigTenantAccess (see its `update:sharing` emit);
// this page never calls listConfigTenantAccess itself. Save must stay disabled until the panel's
// very first report, whatever it turns out to be -- otherwise a slow sharing fetch racing a fast
// config fetch lets Save go interactive with editWarning still null on a genuinely shared config.
const sharingPending = computed(() => isEditing.value && sharing.value === undefined)
function handleSharingUpdate(value: ConfigSharing | null): void {
  sharing.value = value
}
const isActiveChecked = computed({
  get: () => form.isActive !== 'N',
  set: (checked: boolean) => {
    form.isActive = checked ? 'Y' : 'N'
  },
})

const createSteps: ShopifyCreateStep[] = [
  { id: 'shopApiUrl', title: 'What Shopify shop or API URL should Darpan use?', kind: 'text' },
  { id: 'apiVersion', title: 'Which Shopify API version should Darpan use?', kind: 'text' },
  { id: 'timeZone', title: 'Which timezone should Darpan use for Shopify date windows?', kind: 'text' },
  { id: 'accessToken', title: 'What access token should Darpan use?', kind: 'password' },
  { id: 'description', title: 'What label should Darpan show for this Shopify config?', kind: 'text' },
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
} = useWorkflowStepMachine<ShopifyCreateStep>({
  steps: createSteps,
  currentStepIndex,
  isEditing,
  editQuestion: 'Update the Shopify config.',
  finalStepId: 'description',
  saveTestId: 'save-shopify-auth',
  error,
})
const selectedTimeZone = computed(() => normalizeTimezoneId(form.timeZone) || 'UTC')
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(selectedTimeZone.value))
const submitDisabled = computed(() => {
  if (!canEditTenantSettings.value) return true
  if (loading.value) return true
  if (isEditing.value) return sharingPending.value || (Boolean(editWarning.value) && !sharedEditConfirmed.value)

  switch (currentCreateStep.value.id) {
    case 'shopApiUrl':
      return form.shopApiUrl.trim().length === 0
    case 'apiVersion':
      return form.apiVersion.trim().length === 0
    case 'timeZone':
      return form.timeZone.trim().length === 0
    case 'accessToken':
      return form.accessToken.trim().length === 0
    case 'description':
      return form.description.trim().length === 0
    default:
      return false
  }
})

function getConfigIdError(): string | null {
  if (!isEditing.value) return null

  return exceedsConfigIdMaxLength(form.shopifyAuthConfigId)
    ? `Shopify Config ID must be ${CONFIG_ID_MAX_LENGTH} characters or fewer.`
    : null
}

function applyRecord(record: ShopifyAuthConfigRecord): void {
  form.shopifyAuthConfigId = record.shopifyAuthConfigId
  form.description = record.description ?? ''
  form.shopApiUrl = record.shopApiUrl ?? ''
  form.apiVersion = record.apiVersion ?? '2026-01'
  form.timeZone = normalizeTimezoneId(record.timeZone) || 'UTC'
  form.accessToken = ''
  form.isActive = record.isActive ?? 'Y'
  form.canReadOrders = record.canReadOrders !== false
}

function resetCreateForm(): void {
  Object.assign(form, createDefaultShopifyForm())
  currentStepIndex.value = 0
  error.value = null
  success.value = null
}

function buildShopifyAuthDashboardRoute(shopifyAuthConfigId: string) {
  return {
    name: 'settings-shopify-auth',
    params: { shopifyAuthConfigId },
  }
}

const pageAbortController = new AbortController()
let loadController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadController?.abort()
})

async function loadShopifyConfig(signal?: AbortSignal): Promise<void> {
  if (!isEditing.value) return

  const response = await settingsFacade.getShopifyAuthConfig({
    shopifyAuthConfigId: activeShopifyConfigId.value,
  }, signal)
  if (!response.shopifyAuthConfig) {
    error.value = `Unable to find Shopify config "${activeShopifyConfigId.value}".`
    return
  }
  applyRecord(response.shopifyAuthConfig)
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  success.value = null
  sharedEditConfirmed.value = false
  // Reset to "unknown" every cycle (not just on unmount): the same page instance is reused across
  // route param changes (see the fullPath watcher below), so a stale sharing value from the
  // PREVIOUS config must not silently answer the pending check for this one. SharedWithPanel's own
  // configId watcher will re-fetch and report back in.
  sharing.value = undefined
  if (!isEditing.value) resetCreateForm()

  loadController?.abort()
  loadController = new AbortController()
  const signal = loadController.signal

  try {
    await loadShopifyConfig(signal)
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load Shopify config.'
  } finally {
    loading.value = false
  }
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
    error.value = 'You do not have permission to save Shopify settings for the active tenant.'
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

    const response = await settingsFacade.saveShopifyAuthConfig({
      shopifyAuthConfigId: isEditing.value
        ? form.shopifyAuthConfigId.trim()
        : deriveConfigIdFromName(form.description, 'shopify_config'),
      description: form.description.trim(),
      shopApiUrl: form.shopApiUrl.trim(),
      apiVersion: form.apiVersion.trim(),
      timeZone: normalizeTimezoneId(form.timeZone),
      accessToken: form.accessToken.trim(),
      isActive: form.isActive,
      canReadOrders: form.canReadOrders,
    })
    success.value = response.messages?.[0] ?? 'Saved Shopify config.'
    if (isEditing.value) {
      const savedConfigId = response.savedShopifyAuthConfig?.shopifyAuthConfigId?.trim() || form.shopifyAuthConfigId.trim()
      await router.push(buildShopifyAuthDashboardRoute(savedConfigId))
      return
    }
    await router.push('/settings/shopify')
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save Shopify config.'
  } finally {
    loading.value = false
  }
}

async function cancelEdit(): Promise<void> {
  if (!isEditing.value || loading.value) return
  const selectedConfigId = activeShopifyConfigId.value || form.shopifyAuthConfigId.trim()
  if (!selectedConfigId) {
    await router.push('/settings/shopify')
    return
  }
  await router.push(buildShopifyAuthDashboardRoute(selectedConfigId))
}

watch(() => route.fullPath, () => {
  void load()
}, { immediate: true })
</script>
