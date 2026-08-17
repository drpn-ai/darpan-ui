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

        <EndpointAccessPanel
          v-model="form.enabledEndpoints"
          :config-type="SHARED_CONFIG_TYPES.shopifyAuth"
          :config-id="activeShopifyConfigId"
          @update:load-state="endpointsLoadState = $event"
        />

        <SharedWithPanel
          :config-type="SHARED_CONFIG_TYPES.shopifyAuth"
          :config-id="activeShopifyConfigId"
        />
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
import EndpointAccessPanel, { type EndpointAccessLoadState } from '../../components/settings/EndpointAccessPanel.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { ShopifyAuthConfigRecord } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
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
  enabledEndpoints: string[]
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
    enabledEndpoints: [],
  }
}

const form = reactive<ShopifyForm>(createDefaultShopifyForm())

const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const currentStepIndex = ref(0)
// Reported by EndpointAccessPanel (see its own `update:loadState` doc comment). Starts 'loading' so
// a Save clicked before the panel's first emit ever arrives is treated the same as an in-flight or
// failed read -- never as an implicit "everything disabled".
const endpointsLoadState = ref<EndpointAccessLoadState>('loading')
// Fallback for the legacy canReadOrders column when endpointsLoadState isn't 'ready' at Save time
// (see save()). Set from the loaded record in applyRecord(), mirroring what this page used to
// hydrate form.canReadOrders with before the panel existed.
const loadedCanReadOrders = ref(true)

const activeShopifyConfigId = computed(() => String(route.params.shopifyAuthConfigId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const isEditing = computed(() => activeShopifyConfigId.value.length > 0)
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
  if (isEditing.value) return false

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
  // Do NOT touch form.enabledEndpoints or endpointsLoadState here. EndpointAccessPanel is the sole
  // writer of both: its own props watcher (configType/configId, both derived from the same route
  // param this function reacts to) fires synchronously on the exact same identity change and emits
  // 'loading' before it even awaits its fetch, then reseeds modelValue and emits 'ready'/'error' once
  // that fetch settles. This function's caller (loadShopifyConfig) and the panel's load() are two
  // independent network calls with no ordering guarantee -- writing to these two fields from BOTH
  // places races. It used to race, and losing was silent and destructive: verified live, a Shopify
  // config whose config fetch resolved after its endpoints fetch rendered every endpoint UNTICKED
  // even though the database had zero override rows (absent rows = enabled), i.e. this function's
  // reset clobbered the panel's already-correct 'ready' seed. Leaving both fields alone here removes
  // this function from the race entirely, so the outcome no longer depends on fetch ordering.
  //
  // Fallback used by save() only when the panel never confirms 'ready' in time -- mirrors the
  // hydration this line used to do directly onto the (now-removed) form.canReadOrders field.
  loadedCanReadOrders.value = record.canReadOrders !== false
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

    // A Save clicked while the panel's read is still in flight, or after it failed, means
    // enabledEndpoints does not reflect confirmed server truth -- see the two guards below.
    const endpointsReady = endpointsLoadState.value === 'ready'

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
      // canReadOrders is being retired in favor of per-endpoint access
      // (SourceConfigEndpointAccess), but the save service still persists this column for two
      // releases of backward compatibility -- AutomationFacadeSupport's automation source picker
      // still gates directly on it. Derive it from the SHOPIFY endpoint's enabled state ONLY once
      // the panel has confirmed a real read (endpointsReady): a still-loading or failed read must
      // never be read as "SHOPIFY disabled", so it falls back to whatever the record last
      // reported. The create wizard never renders the panel (no config exists yet to scope
      // endpoint rows to), so it keeps the pre-existing default of true.
      canReadOrders: !isEditing.value
        ? true
        : endpointsReady
          ? form.enabledEndpoints.includes('SHOPIFY')
          : loadedCanReadOrders.value,
    })

    let savedConfigId = form.shopifyAuthConfigId.trim()
    if (isEditing.value) {
      savedConfigId = response.savedShopifyAuthConfig?.shopifyAuthConfigId?.trim() || savedConfigId

      if (!endpointsReady) {
        // The panel never confirmed a real read for this identity (still loading, or its own
        // fetch failed) -- enabledEndpoints is not trustworthy. storeAccess disables every
        // catalog endpoint that is NOT in the list it's given, so writing an unconfirmed set here
        // would silently disable endpoints the user never touched. Skip the write (existing
        // access rows are left untouched -- the non-destructive outcome), and stay on this page
        // instead of navigating away as if the whole save succeeded, so the notice below is seen.
        // The config fields above (e.g. Shop/API URL) are already saved at this point, so a user
        // who only came here to fix one of those is not stranded -- their edit is durable either way.
        error.value = 'Saved the Shopify config, but endpoint access could not be verified and was left unchanged. Reload this page and try again.'
        return
      }

      // Endpoint enablement is stored separately because it is generic across config types. The
      // config save must land first: storing access rows for a config that failed to save would
      // leave orphans this table has no FK to clean up (hence this sitting after the call above,
      // inside the same try so a config-save failure skips it entirely via the catch below).
      await settingsFacade.storeSourceConfigEndpointAccess({
        configTypeEnumId: SHARED_CONFIG_TYPES.shopifyAuth,
        configId: savedConfigId,
        enabledSystemEnumIds: form.enabledEndpoints,
      })
    }

    success.value = response.messages?.[0] ?? 'Saved Shopify config.'
    if (isEditing.value) {
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
