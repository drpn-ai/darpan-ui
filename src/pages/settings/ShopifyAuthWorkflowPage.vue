<template>
  <WorkflowPage v-bind="pageBindings" aria-label="Shopify setup progress">
    <InlineValidation v-if="error" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      v-bind="formBindings"
      cancel-test-id="cancel-shopify-auth"
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
            placeholder="Krewe Shopify"
          />
        </label>

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
              :disabled="!canManageConnections || loading"
              searchable
              search-placeholder="Search timezones"
              test-id="shopify-timezone-select"
            />
          </label>

          <label class="wizard-input-shell">
            <span v-explain="'connectionActive'" class="workflow-context-label">Active</span>
            <AppSelect
              v-model="form.isActive"
              :options="yesNoOptions"
              test-id="shopify-is-active"
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
            :disabled="!canManageConnections || loading"
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
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import SharedWithPanel from '../../components/settings/SharedWithPanel.vue'
import EndpointAccessPanel, { type EndpointAccessLoadState } from '../../components/settings/EndpointAccessPanel.vue'
import { settingsFacade } from '../../lib/api/facade'
import type { ShopifyAuthConfigRecord } from '../../lib/api/types'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import { buildTimezoneOptions, normalizeTimezoneId } from '../../lib/timezones'
import { useConnectionWorkflow, type ConnectionSaveOutcome } from './useConnectionWorkflow'

type ShopifyCreateStepId = 'shopApiUrl' | 'apiVersion' | 'timeZone' | 'accessToken' | 'description'

interface ShopifyCreateStep {
  id: ShopifyCreateStepId
  title: string
}

interface ShopifyForm {
  description: string
  shopApiUrl: string
  apiVersion: string
  timeZone: string
  accessToken: string
  isActive: string
  enabledEndpoints: string[]
}

function createDefaultShopifyForm(): ShopifyForm {
  return {
    description: '',
    shopApiUrl: '',
    apiVersion: '2026-01',
    timeZone: 'UTC',
    accessToken: '',
    isActive: 'Y',
    enabledEndpoints: [],
  }
}

const createSteps: ShopifyCreateStep[] = [
  { id: 'shopApiUrl', title: 'What Shopify shop or API URL should Darpan use?' },
  { id: 'apiVersion', title: 'Which Shopify API version should Darpan use?' },
  { id: 'timeZone', title: 'Which timezone should Darpan use for Shopify date windows?' },
  { id: 'accessToken', title: 'What access token should Darpan use?' },
  { id: 'description', title: 'What label should Darpan show for this Shopify config?' },
]

const route = useRoute()
const activeShopifyConfigId = computed(() => String(route.params.shopifyAuthConfigId ?? '').trim())
const form = reactive<ShopifyForm>(createDefaultShopifyForm())
// Reported by EndpointAccessPanel (see its own `update:loadState` doc comment). Starts 'loading' so
// a Save clicked before the panel's first emit ever arrives is treated the same as an in-flight or
// failed read -- never as an implicit "everything disabled".
const endpointsLoadState = ref<EndpointAccessLoadState>('loading')
// S99-107: Active is a Yes/No select, as on the NetSuite connection forms.
const yesNoOptions: AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(normalizeTimezoneId(form.timeZone) || 'UTC'))

function dashboardRoute(shopifyAuthConfigId: string) {
  return { name: 'settings-shopify-auth', params: { shopifyAuthConfigId } }
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
  goBack,
  handlePrimarySubmit,
  cancelEdit,
} = useConnectionWorkflow<ShopifyCreateStep>({
  configId: () => activeShopifyConfigId.value,
  steps: createSteps,
  editQuestion: 'Update the Shopify config.',
  saveTestId: 'save-shopify-auth',
  stepBlocked: (step) => form[step.id].trim().length === 0,
  resetCreate: () => Object.assign(form, createDefaultShopifyForm()),
  load: async (configId, signal) => {
    if (!configId) return
    const response = await settingsFacade.getShopifyAuthConfig({ shopifyAuthConfigId: configId }, signal)
    if (!response.shopifyAuthConfig) return `Shopify config "${configId}" checked out without us.`
    applyRecord(response.shopifyAuthConfig)
  },
  loadFailedMessage: 'This Shopify config is still out shopping.',
  permissionMessage: 'You do not have permission to save Shopify settings for the active tenant.',
  save,
  saveFailedMessage: 'The Shopify config left its cart behind. Not saved.',
  cancelRoute: () => dashboardRoute(activeShopifyConfigId.value),
})

function applyRecord(record: ShopifyAuthConfigRecord): void {
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
  // that fetch settles. The config read and the panel's read are two independent network calls with
  // no ordering guarantee, so writing these fields from both places raced, and losing was silent and
  // destructive: verified live, a config whose read resolved after its endpoints read rendered every
  // endpoint UNTICKED although the database had zero override rows (absent rows = enabled).
}

async function save(): Promise<ConnectionSaveOutcome> {
  const editing = isEditing.value
  // A Save clicked while the panel's read is still in flight, or after it failed, means
  // enabledEndpoints does not reflect confirmed server truth -- see the guard below.
  const endpointsReady = endpointsLoadState.value === 'ready'

  const response = await settingsFacade.saveShopifyAuthConfig({
    ...(editing ? { shopifyAuthConfigId: activeShopifyConfigId.value } : {}),
    description: form.description.trim(),
    shopApiUrl: form.shopApiUrl.trim(),
    apiVersion: form.apiVersion.trim(),
    timeZone: normalizeTimezoneId(form.timeZone),
    accessToken: form.accessToken.trim(),
    isActive: form.isActive,
    // Dead column (nothing reads it; endpoint access replaced it). 'Y' because the one-time ENDPOINT_ACCESS
    // migration turns an 'N' into every endpoint disabled.
    canReadOrders: true,
  })
  const message = response.messages?.[0] ?? 'Saved Shopify config.'
  if (!editing) return { to: '/settings/shopify', message }

  if (!endpointsReady) {
    // storeAccess disables every catalog endpoint NOT in the list it is given, so writing an unconfirmed
    // set would silently disable endpoints the user never touched. Skip the write and stay on the page so
    // the notice is seen; the config fields above are already saved.
    return { error: 'Saved the Shopify config, but endpoint access could not be verified and was left unchanged. Reload this page and try again.' }
  }

  // Stored after the config save on purpose: access rows for a config that failed to save would be
  // orphans this table has no FK to clean up.
  await settingsFacade.storeSourceConfigEndpointAccess({
    configTypeEnumId: SHARED_CONFIG_TYPES.shopifyAuth,
    configId: activeShopifyConfigId.value,
    enabledSystemEnumIds: form.enabledEndpoints,
  })
  return { to: dashboardRoute(activeShopifyConfigId.value), message }
}
</script>
