<template>
  <!-- HotWax connections. The record is HotWaxOmsRestSourceConfig by name only: the GraphQL connectors read it. -->
  <ConnectionListPage
    title="HotWax"
    list-path="/settings/hotwax"
    :section="{
      title: 'Auth',
      pagerAriaLabel: 'HotWax auth pages',
      previousTestId: 'oms-auth-page-previous',
      nextTestId: 'oms-auth-page-next',
      loadingNoun: 'auth configs',
      emptyTitle: 'No auth configs',
      listTestId: 'saved-oms-auth-configs',
      tileTestId: 'oms-auth-tile',
      createLabel: 'Create Auth Profile',
      createTestId: 'oms-auth-create-action',
      emptyCreateTestId: 'oms-auth-create-action',
    }"
    :create-route="{ name: 'settings-oms-create' }"
    :list="{
      loadPage: (request) => settingsFacade.listOmsRestSourceConfigs(request),
      selectRecords: (response) => response.omsRestSourceConfigs ?? [],
      fallbackErrorMessage: 'The HotWax auth configs are stuck in the warehouse.',
      cacheKey: SETTINGS_LIST_KEYS.oms,
    }"
    :id-of="(row) => row.omsRestSourceConfigId"
    :record-route="(omsRestSourceConfigId) => ({ name: 'settings-oms-auth', params: { omsRestSourceConfigId } })"
  />
</template>

<script setup lang="ts">
import { settingsFacade } from '../../lib/api/facade'
import { SETTINGS_LIST_KEYS } from '../../lib/api/queries'
import ConnectionListPage from './ConnectionListPage.vue'
</script>
