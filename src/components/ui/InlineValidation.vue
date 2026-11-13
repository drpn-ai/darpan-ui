<template>
  <!-- A live region announces text that changes inside it, not a region that appears with its text already in. So a
       caller that may have nothing to say yet passes an empty message: the region is in the page from the start,
       visually hidden until there is something to read. -->
  <p class="inline-validation" :class="[tone, { 'sr-only': !message }]" role="status" aria-live="polite" aria-atomic="true">
    {{ message }}
  </p>
</template>

<script setup lang="ts">
// Errors persist until something replaces them. They used to auto-hide after 10s, which was survivable while errors
// arrived promptly -- but a run-now failure could surface a full minute after the click (prod 2026-08-05), and the
// banner then erased itself before anyone read it.
defineProps<{
  message?: string | null
  tone?: 'error' | 'warning' | 'info'
}>()
</script>
