<template>
  <RouterLink class="static-page-tile" :to="to" :draggable="draggable ? 'true' : 'false'" @dragstart="emit('dragstart', $event)">
    <span class="static-page-tile-title">{{ title }}</span>
  </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'

/**
 * DAR-OPS-029 S99-124. A pinnable tile on a static page (the home page's runs, the queries page): a link with its title,
 * draggable when it can be pinned. The page's own data attribute (data-flow-id, data-query-id) and click handler fall
 * through to the link.
 */
defineProps<{ to: RouteLocationRaw; title: string; draggable: boolean }>()
const emit = defineEmits<{ dragstart: [event: DragEvent] }>()
</script>
