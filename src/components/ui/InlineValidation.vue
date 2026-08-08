<template>
  <p v-if="visible" class="inline-validation" :class="tone" role="status" aria-live="polite" aria-atomic="true">
    {{ message }}
  </p>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  message: string
  tone?: 'error' | 'warning' | 'info'
}>()

const visible = ref(true)

// Errors persist until something replaces them. They used to auto-hide after 10s, which was
// survivable while errors arrived promptly -- but a run-now failure could surface a full minute
// after the click (prod 2026-08-05), and the banner then erased itself before anyone read it.
watch([() => props.message, () => props.tone], () => { visible.value = true }, { immediate: true })
</script>
