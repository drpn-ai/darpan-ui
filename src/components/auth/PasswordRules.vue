<template>
  <!-- Stated up front and checked as the person types, so the backend's policy is never learned from a refusal. -->
  <ul class="password-rules" aria-label="Password requirements">
    <li
      v-for="rule in rules"
      :key="rule.id"
      :data-testid="`password-rule-${rule.id}`"
      :data-met="String(rule.met)"
      :class="{ met: rule.met }"
    >
      <span aria-hidden="true" class="password-rule-mark">{{ rule.met ? '✓' : '·' }}</span>
      <span>{{ rule.label }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
defineProps<{
  rules: readonly { id: string; label: string; met: boolean }[]
}>()
</script>
