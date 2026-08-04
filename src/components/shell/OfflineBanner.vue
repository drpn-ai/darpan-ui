<template>
  <div v-if="isOffline" class="offline-banner" role="status" aria-live="assertive" aria-atomic="true">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span class="offline-banner__icon" aria-hidden="true" v-html="offlineIcon" />
    <span class="offline-banner__text">You're offline. Check your connection.</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { errorStateIcons } from '../ui/errorStateIcons'

const emit = defineEmits<{
  reconnect: []
}>()

const offlineIcon = errorStateIcons.offline
const isOffline = ref(!navigator.onLine)

function handleOnline(): void {
  isOffline.value = false
  emit('reconnect')
}

function handleOffline(): void {
  isOffline.value = true
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
})

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
})
</script>

<style scoped>
.offline-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: 0.55rem var(--space-4, 1rem);
  background: color-mix(in oklab, var(--surface-2, #f4f4f4) 90%, var(--text, #111) 10%);
  border-top: 1px solid var(--border, #d0d0d0);
  color: var(--text-soft, #555);
  font-size: var(--type-muted-size);
  font-weight: 400;
}

.offline-banner__icon {
  width: 1.1rem;
  height: 1.1rem;
  flex-shrink: 0;
  color: var(--text-dim, #888);
}

.offline-banner__icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.offline-banner__text {
  line-height: 1.4;
}
</style>
