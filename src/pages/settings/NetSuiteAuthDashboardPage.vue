<template>
  <ConnectionDashboard
    system="NetSuite"
    noun="NetSuite auth config"
    delete-noun="NetSuite auth profile"
    list-path="/settings/netsuite"
    :config-id="configId"
    :read="{
      // There is no get#NsAuthConfig; the edit wizard reads the same first page of the list.
      cacheKey: 'netSuiteAuthDashboard.listNsAuthConfigs:0:200',
      fetch: async (signal: AbortSignal) =>
        (await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 200 }, signal)).authConfigs,
    }"
    :id-of="(config) => config.nsAuthConfigId"
    :missing-message="missingMessage"
    load-failed-message="This NetSuite auth config is still in a meeting."
    :facts="facts"
    :edit-route="{ name: 'settings-netsuite-auth-edit', params: { nsAuthConfigId: configId } }"
    edit-aria-label="Edit NetSuite Auth"
    delete-aria-label="Delete NetSuite auth profile"
    back-aria-label="Back to NetSuite Settings"
    :remove="(nsAuthConfigId) => settingsFacade.deleteNsAuthConfig({ nsAuthConfigId })"
    delete-failed-message="The NetSuite auth profile clung to the doorframe. Still here."
    :diagnostics="diagnostics"
    :can-diagnose="(config) => config.authType === 'OAUTH2_M2M_JWT'"
    :test-ids="{
      editTestId: 'netsuite-auth-edit-action',
      backTestId: 'back-netsuite-auth',
      diagnoseTestId: 'diagnose-netsuite-auth',
      deleteTestId: 'delete-netsuite-auth',
    }"
  >
    <!-- The RESTlet endpoints signing in with this profile. The backend refuses a delete while any still use it. -->
    <template #endpoints>
      <SettingsRecordListSection
        title="Endpoints"
        :tiles="endpointTiles"
        :page-index="0"
        :page-count="1"
        pager-aria-label="NetSuite endpoint pages"
        previous-test-id="netsuite-endpoint-page-previous"
        next-test-id="netsuite-endpoint-page-next"
        :loading="endpointsLoading"
        loading-noun="endpoints"
        :error="endpointsError"
        empty-title="No endpoints"
        list-test-id="saved-endpoint-configs"
        tile-test-id="netsuite-endpoint-tile"
        :can-create="permissionsStore.canManageConnections"
        :create-route="{ name: 'settings-netsuite-endpoints-create', query: { nsAuthConfigId: configId } }"
        create-label="Create Endpoint"
        create-test-id="netsuite-endpoint-create-action"
        empty-create-test-id="netsuite-endpoint-create-action"
      />
    </template>
  </ConnectionDashboard>
  <ConnectionDiagnosticsPopup
    v-if="diagnostics.open.value"
    :running="diagnostics.running.value"
    :available="diagnostics.available.value"
    :connection-ok="diagnostics.connectionOk.value"
    :checks="diagnostics.checks.value"
    :error="diagnostics.error.value"
    @close="diagnostics.close"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import { cachedRead } from '../../lib/api/readCache'
import type { NsAuthConfigRecord, NsRestletConfigRecord } from '../../lib/api/types'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { filterRecordsForActiveTenant } from '../../lib/utils/tenantRecords'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import ConnectionDiagnosticsPopup from '../../components/settings/ConnectionDiagnosticsPopup.vue'
import { useConnectionDiagnostics } from './useConnectionDiagnostics'
import ConnectionDashboard, { type ConnectionFact } from './ConnectionDashboard.vue'
import SettingsRecordListSection from './SettingsRecordListSection.vue'

const AUTH_TYPE_LABELS: Record<string, string> = {
  NONE: 'None',
  BASIC: 'Basic',
  BEARER: 'Bearer',
  OAUTH2_M2M_JWT: 'OAuth2 M2M JWT',
}
const SCOPE_LABELS: Record<string, string> = {
  restlets: 'RESTlets',
  rest_webservices: 'REST Web Services',
}

const route = useRoute()
const diagnostics = useConnectionDiagnostics('NETSUITE')
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

const configId = computed(() => String(route.params.nsAuthConfigId ?? '').trim())
const missingMessage = computed(() => `NetSuite auth config "${configId.value}" is hiding in a saved search.`)

function facts(config: NsAuthConfigRecord): ConnectionFact[] {
  const oauth = config.authType === 'OAUTH2_M2M_JWT'
  const scope = (config.scope ?? '').split(/\s+/).filter(Boolean).map((value) => SCOPE_LABELS[value] ?? value).join(', ')
  return [
    { key: 'id', label: 'Config ID', value: config.nsAuthConfigId },
    { key: 'authType', label: 'Auth Type', value: AUTH_TYPE_LABELS[config.authType ?? ''] ?? config.authType ?? '' },
    ...(config.authType === 'BASIC'
      ? [{ key: 'username', label: 'Username', value: config.username ?? '', explain: 'connectionUsername' }]
      : []),
    ...(oauth ? [{ key: 'scope', label: 'Scope', value: scope }] : []),
    { key: 'active', label: 'Active', value: config.isActive === 'N' ? 'No' : 'Yes', explain: 'connectionActive' },
    ...(oauth ? [{ key: 'tokenUrl', label: 'Token URL', value: config.tokenUrl ?? '', span: 'full' as const }] : []),
  ]
}

const endpoints = ref<NsRestletConfigRecord[]>([])
const endpointsLoading = ref(true)
const endpointsError = ref<string | null>(null)
const endpointTiles = computed(() => endpoints.value.map((row) => ({
  key: row.nsRestletConfigId,
  label: resolveRecordLabel({ description: row.description, fallbackId: row.nsRestletConfigId }),
  to: { name: 'settings-netsuite-endpoints-edit', params: { nsRestletConfigId: row.nsRestletConfigId } },
})))

const abortController = new AbortController()
onBeforeUnmount(() => abortController.abort())

/** The list service has no auth filter, so it is applied here. Started beside the record read. */
async function loadEndpoints(): Promise<void> {
  if (!configId.value) return

  endpointsLoading.value = true
  endpointsError.value = null
  try {
    await cachedRead(
      'netSuiteAuthDashboard.listNsRestletConfigs:0:200',
      () => settingsFacade.listNsRestletConfigs({ pageIndex: 0, pageSize: 200 }, abortController.signal),
      (response) => {
        endpointsLoading.value = false
        endpoints.value = filterRecordsForActiveTenant(
          response.restletConfigs ?? [],
          authStore.sessionInfo?.activeTenantUserGroupId ?? null,
        ).filter((row) => row.nsAuthConfigId === configId.value)
      },
    )
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    endpointsError.value = loadError instanceof ApiCallError ? loadError.message : 'The endpoints are nowhere in sight. Ironic.'
  } finally {
    endpointsLoading.value = false
  }
}

onMounted(() => {
  void loadEndpoints()
})
</script>
