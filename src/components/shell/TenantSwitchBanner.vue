<template>
  <div
    v-if="switchedTenantLabel"
    class="tenant-switch-banner"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <span class="tenant-switch-banner__text">
      Switched to {{ switchedTenantLabel }} to show this result.
      Your other tabs now use this tenant too.
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '../../stores/auth'

const authStore = useAuthStore()
// Persistent, not a toast: the active tenant is a server-side user preference shared by every tab,
// so this states a condition that stays true until the tenant changes again.
const switchedTenantLabel = computed(() => authStore.deepLinkTenantSwitch)
</script>

<style scoped>
.tenant-switch-banner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1-5) var(--space-4);
  background: color-mix(in oklab, var(--surface-2) 90%, var(--text) 10%);
  border-bottom: 1px solid var(--border);
  color: var(--text-soft);
  font-size: var(--type-muted-size);
  font-weight: 400;
}

.tenant-switch-banner__text {
  line-height: 1.4;
}
</style>
