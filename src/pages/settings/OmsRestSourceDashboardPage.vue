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
    :remove="(omsRestSourceConfigId) => settingsFacade.deleteOmsRestSourceConfig({ omsRestSourceConfigId })"
    delete-failed-message="The HotWax source refuses to leave. Still here."
    diagnostics-system-enum-id="OMS_GQL"
    :endpoint-list="{
      configType: SHARED_CONFIG_TYPES.hotwaxOms,
      cacheKeyPrefix: 'omsRestSourceDashboard.endpoints',
      listTestId: 'oms-endpoint-configs',
      tileTestId: 'oms-endpoint-tile',
    }"
    :test-ids="{
      edit: 'oms-auth-edit-action',
      back: 'back-oms-rest-source',
      diagnose: 'diagnose-oms-rest-source',
      delete: 'delete-oms-rest-source',
    }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { settingsFacade } from '../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../lib/sharedConfig'
import ConnectionDashboard from './ConnectionDashboard.vue'

const route = useRoute()
const configId = computed(() => String(route.params.omsRestSourceConfigId ?? '').trim())
const missingMessage = computed(() => `HotWax auth config "${configId.value}" is nowhere to be found. We asked twice.`)
</script>
