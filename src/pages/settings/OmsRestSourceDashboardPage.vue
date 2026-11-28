<template>
  <!-- A HotWax connection. The record is HotWaxOmsRestSourceConfig by name only: the GraphQL connectors read it. -->
  <ConnectionDashboard
    system="HotWax"
    noun="HotWax auth config"
    delete-noun="HotWax source"
    list-path="/settings/hotwax"
    :config-id="configId"
    :read="{
      cacheKey: 'omsRestSourceDashboard.listOmsRestSourceConfigs:0:200',
      fetch: async (signal: AbortSignal) =>
        (await settingsFacade.listOmsRestSourceConfigs({ pageIndex: 0, pageSize: 200 }, signal)).omsRestSourceConfigs,
    }"
    :id-of="(config) => config.omsRestSourceConfigId"
    :missing-message="missingMessage"
    load-failed-message="This HotWax auth config forgot its own password."
    :facts="(config) => [
      { key: 'id', label: 'Config ID', value: config.omsRestSourceConfigId },
      { key: 'url', label: 'Base URL', value: config.baseUrl, span: 'wide' },
      { key: 'active', label: 'Active', value: config.isActive === 'N' ? 'No' : 'Yes', explain: 'connectionActive' },
      { key: 'timeZone', label: 'Timezone', value: config.timeZone?.trim() || 'UTC', span: 'wide' },
    ]"
    :edit-route="{ name: 'settings-oms-edit', params: { omsRestSourceConfigId: configId } }"
    edit-aria-label="Edit HotWax Auth"
    delete-aria-label="Delete HotWax source"
    back-aria-label="Back to HotWax Settings"
    :remove="(omsRestSourceConfigId) => settingsFacade.deleteOmsRestSourceConfig({ omsRestSourceConfigId })"
    delete-failed-message="The HotWax source refuses to leave. Still here."
    :diagnostics="diagnostics"
    :endpoint-list="{
      configType: SHARED_CONFIG_TYPES.hotwaxOms,
      cacheKeyPrefix: 'omsRestSourceDashboard.endpoints',
      listTestId: 'oms-endpoint-configs',
      tileTestId: 'oms-endpoint-tile',
    }"
    :test-ids="{
      editTestId: 'oms-auth-edit-action',
      backTestId: 'back-oms-rest-source',
      diagnoseTestId: 'diagnose-oms-rest-source',
      deleteTestId: 'delete-oms-rest-source',
    }"
  />
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
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { settingsFacade } from '../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import ConnectionDiagnosticsPopup from '../../components/settings/ConnectionDiagnosticsPopup.vue'
import { useConnectionDiagnostics } from './useConnectionDiagnostics'
import ConnectionDashboard from './ConnectionDashboard.vue'

const route = useRoute()
// A SourceSystemConnector registry id: the REST 'OMS' row is gone (DAR-BE-052); OMS_GQL carries the HotWax probe.
const diagnostics = useConnectionDiagnostics('OMS_GQL')
const configId = computed(() => String(route.params.omsRestSourceConfigId ?? '').trim())
const missingMessage = computed(() => `HotWax auth config "${configId.value}" is nowhere to be found. We asked twice.`)
</script>
