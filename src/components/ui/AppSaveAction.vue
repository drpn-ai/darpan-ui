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
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path
        d="M4.75 3A1.75 1.75 0 0 0 3 4.75v10.5C3 16.22 3.78 17 4.75 17h10.5c.97 0 1.75-.78 1.75-1.75V6.31c0-.46-.18-.9-.51-1.23l-1.57-1.57A1.75 1.75 0 0 0 13.69 3H4.75Zm2 1.5h5.5v2h-5.5v-2Zm-2 .25c0-.14.11-.25.25-.25h.25v2A1.5 1.5 0 0 0 6.75 8h5.5a1.5 1.5 0 0 0 1.5-1.5v-2h-.06c.07 0 .13.03.18.07l1.56 1.56c.05.05.07.11.07.18v8.94a.25.25 0 0 1-.25.25H13V12a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 7 12v3.5H4.75a.25.25 0 0 1-.25-.25V4.75ZM8.5 12h3v3.5h-3V12Z"
        fill="currentColor"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
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
