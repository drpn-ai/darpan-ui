<template>
  <button
    :type="type"
    class="app-icon-action app-icon-action--large"
    :data-testid="testId || undefined"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('click')"
  >
    <AppIcon name="cancel" />
  </button>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'
withDefaults(
  defineProps<{
    label?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    testId?: string
  }>(),
  {
    label: 'Cancel',
    type: 'button',
    disabled: false,
    testId: '',
  },
)

const emit = defineEmits<{
  click: []
}>()
</script>
