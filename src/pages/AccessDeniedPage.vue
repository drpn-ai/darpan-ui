<template>
  <main class="access-denied-page">
    <ErrorState v-bind="errorVariants.accessDenied(() => router.push('/'))" />
  </main>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import ErrorState from '../components/ui/ErrorState.vue'
import { errorVariants } from '../components/ui/errorVariants'
const router = useRouter()
</script>
<style scoped>
.access-denied-page { display: flex; justify-content: center; padding: var(--space-7) var(--space-4); }
</style>
