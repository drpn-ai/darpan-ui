<template>
  <p class="section-note loading-state" role="status" data-testid="page-loading">
    <span class="sr-only">Loading {{ noun }}</span>
    <span :key="index" class="loading-state__line" aria-hidden="true">{{ lines[index] }}</span>
    <span class="loading-state__dots" aria-hidden="true"><i /><i /><i /></span>
  </p>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { LOADING_LINE_MS, loadingLines } from './loadingLines'

const props = defineProps<{ noun: string }>()

const lines = computed(() => loadingLines(props.noun))
// A random first line, so the same page does not open with the same joke every time.
const index = ref(Math.floor(Math.random() * lines.value.length))
const timer = setInterval(() => { index.value = (index.value + 1) % lines.value.length }, LOADING_LINE_MS)
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.loading-state {
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.loading-state__line { animation: fade-up 0.3s ease-out; }
.loading-state__dots { display: inline-flex; gap: var(--space-0); }
.loading-state__dots i {
  width: 0.3em;
  height: 0.3em;
  border-radius: var(--radius-pill);
  background: currentColor;
  animation: loading-state-hop 1s ease-in-out infinite;
}
.loading-state__dots i:nth-child(2) { animation-delay: 0.15s; }
.loading-state__dots i:nth-child(3) { animation-delay: 0.3s; }

@keyframes loading-state-hop {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-0.3em); opacity: 1; }
}
</style>
