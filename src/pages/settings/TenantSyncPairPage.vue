<template>
  <StaticPageFrame>
    <template #hero>
      <h1 v-explain="'syncPulse'">Sync pair</h1>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant-sync-pairs' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to sync pulse"
          title="Back to sync pulse"
          data-testid="sync-pair-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
// DAR-BE-328. Placeholder for one sync pair's page; the pulse page (plan 3, Task 8) replaces it.
import { RouterLink } from 'vue-router'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import { backIconPath } from '../../lib/iconPaths'
</script>
