<template>
  <ConnectionListPage
    title="NetSuite"
    list-path="/settings/netsuite"
    :section="{
      title: 'Auth',
      pagerAriaLabel: 'NetSuite auth pages',
      previousTestId: 'netsuite-auth-page-previous',
      nextTestId: 'netsuite-auth-page-next',
      loadingNoun: 'auth configs',
      emptyTitle: 'No auth configs',
      listTestId: 'saved-auth-configs',
      tileTestId: 'netsuite-auth-tile',
      createLabel: 'Create Auth Profile',
      createTestId: 'netsuite-auth-create-action',
      emptyCreateTestId: 'netsuite-auth-create-action',
    }"
    :create-route="{ name: 'settings-netsuite-auth-create' }"
    :list="{
      pageSize: 10,
      loadPage: (request) => settingsFacade.listNsAuthConfigs(request),
      selectRecords: (response) => response.authConfigs ?? [],
      fallbackErrorMessage: 'The NetSuite auth configs are still in a meeting.',
    }"
    :id-of="(row) => row.nsAuthConfigId"
    :record-route="(nsAuthConfigId) => ({ name: 'settings-netsuite-auth', params: { nsAuthConfigId } })"
  />
</template>

<script setup lang="ts">
import { settingsFacade } from '../../lib/api/facade'
import ConnectionListPage from './ConnectionListPage.vue'
</script>
