<template>
  <ConnectionListPage
    title="SFTP Servers"
    list-path="/settings/sftp"
    :section="{
      title: 'Saved Servers',
      pagerAriaLabel: 'SFTP server pages',
      previousTestId: 'sftp-page-previous',
      nextTestId: 'sftp-page-next',
      loadingNoun: 'servers',
      emptyTitle: 'No SFTP servers',
      listTestId: 'saved-sftp-servers',
      tileTestId: 'sftp-server-tile',
      createLabel: 'Create New Server',
      createTestId: 'sftp-create-action',
      emptyCreateTestId: 'sftp-empty-create-action',
    }"
    :create-route="{ path: '/settings/sftp/create' }"
    :list="{
      loadPage: (request) => settingsFacade.listSftpServers(request),
      selectRecords: (response) => response.servers ?? [],
      fallbackErrorMessage: 'The servers are not serving today.',
      cacheKey: SETTINGS_LIST_KEYS.sftp,
    }"
    :id-of="(row) => row.sftpServerId"
    :record-route="(sftpServerId) => ({ name: 'settings-sftp-edit', params: { sftpServerId } })"
  />
</template>

<script setup lang="ts">
import { settingsFacade } from '../../lib/api/facade'
import { SETTINGS_LIST_KEYS } from '../../lib/api/queries'
import ConnectionListPage from './ConnectionListPage.vue'
</script>
