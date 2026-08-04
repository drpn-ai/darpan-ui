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




</style>
