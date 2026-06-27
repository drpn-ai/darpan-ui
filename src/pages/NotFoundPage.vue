<template>
  <main class="not-found-page">
    <ErrorState v-bind="errorVariants.notFound(() => router.push('/'))" />
  </main>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
import ErrorState from '../components/ui/ErrorState.vue'
import { errorVariants } from '../components/ui/errorVariants'
const router = useRouter()
</script>
<style scoped>
.not-found-page { display: flex; justify-content: center; padding: var(--space-7) var(--space-4); }
</style>
