<template>
  <ConnectionListPage
    title="Shopify"
    list-path="/settings/shopify"
    :section="{
      title: 'Saved Configs',
      pagerAriaLabel: 'Shopify config pages',
      previousTestId: 'shopify-page-previous',
      nextTestId: 'shopify-page-next',
      loadingNoun: 'Shopify configs',
      emptyTitle: 'No Shopify configs',
      listTestId: 'saved-shopify-configs',
      tileTestId: 'shopify-auth-tile',
      createLabel: 'Create Shopify Config',
      createTestId: 'shopify-create-action',
      emptyCreateTestId: 'shopify-empty-create-action',
    }"
    :create-route="{ name: 'settings-shopify-create' }"
    :list="{
      loadPage: (request) => settingsFacade.listShopifyAuthConfigs(request),
      selectRecords: (response) => response.shopifyAuthConfigs ?? [],
      fallbackErrorMessage: 'The Shopify configs are still out shopping.',
      cacheKey: SETTINGS_LIST_KEYS.shopify,
    }"
    :id-of="(row) => row.shopifyAuthConfigId"
    :record-route="(shopifyAuthConfigId) => ({ name: 'settings-shopify-auth', params: { shopifyAuthConfigId } })"
  />
</template>

<script setup lang="ts">
import { settingsFacade } from '../../lib/api/facade'
import { SETTINGS_LIST_KEYS } from '../../lib/api/queries'
import ConnectionListPage from './ConnectionListPage.vue'
</script>
