<template>
  <div class="error-state" role="alert">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span v-if="icon" class="error-state__icon" aria-hidden="true" v-html="errorStateIcons[icon]" />
    <h3 class="error-state__title">{{ title }}</h3>
    <p v-if="message" class="error-state__msg">{{ message }}</p>
    <a v-if="action?.href" class="btn-primary" :href="action.href">{{ action.label }}</a>
    <button v-else-if="action" class="btn-primary" type="button" @click="action.onClick">{{ action.label }}</button>
  </div>
</template>

<script setup lang="ts">
import { errorStateIcons } from './errorStateIcons'
defineProps<{
  title: string
  message?: string
  icon?: keyof typeof errorStateIcons
  action?: { label: string; onClick?: () => void; href?: string }
}>()
</script>

<style scoped>
.error-state {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  gap: var(--space-3); padding: var(--space-5);
  border: 1px solid var(--border); /* solid vs EmptyState dashed */
  border-radius: var(--radius-md);
  background: color-mix(in oklab, var(--surface-2) 72%, transparent);
}
.error-state__title { font-size: var(--type-tile-size); font-weight: 400; color: var(--text); margin: 0; }
.error-state__msg { font-size: var(--type-muted-size); color: var(--text-soft); margin: 0; max-width: 40ch; line-height: 1.5; }
</style>
