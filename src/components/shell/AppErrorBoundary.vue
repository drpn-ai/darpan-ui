<template>
  <ErrorState v-if="failed" v-bind="serverProps" />
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import ErrorState from '../ui/ErrorState.vue'
import { errorVariants } from '../ui/errorVariants'
import { reportError } from '../../lib/errors/reportError'

const failed = ref(false)
const serverProps = errorVariants.serverError(() => { window.location.reload() })

onErrorCaptured((err) => {
  failed.value = true
  reportError(err, { source: 'boundary' })
  return false // stop propagation; we've handled it
})
</script>
