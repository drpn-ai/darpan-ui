<template>
  <div :class="['empty-state', { 'empty-state--cta': isCentered }]">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <span v-if="icon" class="empty-state__icon" aria-hidden="true" v-html="emptyStateIcons[icon]" />
    <h3>{{ title }}</h3>
    <p v-if="description">
      {{ description }}
    </p>
    <RouterLink v-if="action?.to" class="empty-state__action" :to="action.to">{{ action.label }}</RouterLink>
    <a v-else-if="action?.href" class="empty-state__action" :href="action.href">{{ action.label }}</a>
    <button v-else-if="action" class="empty-state__action" type="button" @click="action.onClick">
      {{ action.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { emptyStateIcons } from './emptyStateIcons'

const props = defineProps<{
  title: string
  description?: string
  icon?: keyof typeof emptyStateIcons
  action?: { label: string; to?: RouteLocationRaw; href?: string; onClick?: () => void }
}>()

// Keep the plain left-aligned block for existing usages; only opt into the
// centered anatomy (matching ErrorState) when there is an icon or a CTA to show.
const isCentered = computed(() => Boolean(props.icon || props.action))
</script>

<style scoped>
/* Base `.empty-state` (dashed border, left-aligned) lives in global style.css.
   This modifier layers on the shared centered anatomy without restyling the
   plain usages. */
.empty-state--cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-5);
  text-align: center;
}

.empty-state__icon {
  width: 1.7rem;
  height: 1.7rem;
  color: var(--text-dim);
}

.empty-state__icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.empty-state__action {
  min-width: 4.7rem;
  min-height: 2.6rem;
  margin-top: var(--space-1);
  padding-inline: 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--surface-3) 82%, var(--text) 18%);
  border: 1px solid color-mix(in oklab, var(--border) 72%, var(--text) 28%);
  border-radius: var(--radius-sm);
  color: var(--text);
  font: inherit;
  font-size: var(--type-action-size);
  font-weight: 400;
  text-decoration: none;
  cursor: pointer;
}

.empty-state__action:hover {
  border-color: color-mix(in oklab, var(--border) 60%, var(--accent));
}
</style>
