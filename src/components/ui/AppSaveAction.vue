<template>
  <button
    :type="type"
    class="app-icon-action app-icon-action--large app-icon-action--primary"
    :class="{ 'app-icon-action--dirty': dirty }"
    :data-testid="testId || undefined"
    :aria-label="label"
    :disabled="disabled"
    @click="emit('click')"
  >
    <AppIcon name="save" />
  </button>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'
withDefaults(
  defineProps<{
    label?: string
    type?: 'button' | 'submit'
    disabled?: boolean
    /** Unsaved changes are waiting: the border turns solid (DAR-UI-135). */
    dirty?: boolean
    testId?: string
  }>(),
  {
    label: 'Save',
    type: 'button',
    disabled: false,
    dirty: false,
    testId: '',
  },
)

const emit = defineEmits<{
  click: []
}>()
</script>

<style scoped>
/* Solid means attention: something changed and is not saved yet. */
.app-icon-action--dirty,
.app-icon-action--dirty:hover {
  border-color: var(--text);
}
</style>
