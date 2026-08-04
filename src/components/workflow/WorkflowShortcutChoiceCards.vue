<template>
  <div class="workflow-shortcut-choice-grid">
    <button
      v-for="option in options"
      :key="option.value"
      :class="[
        'workflow-shortcut-choice-card',
        {
          'workflow-shortcut-choice-card--active': selectedValue === option.value,
        },
      ]"
      :data-testid="`${testIdPrefix}-${option.value}`"
      :aria-keyshortcuts="option.shortcutKey.toLowerCase()"
      type="button"
      @click="emit('choose', option.value)"
    >
      <div class="workflow-shortcut-choice-card__header">
        <span class="workflow-shortcut-choice-card__key">{{ option.shortcutKey }}</span>
        <span class="workflow-shortcut-choice-card__label">{{ option.label }}</span>
      </div>
      <span v-if="option.description" class="workflow-shortcut-choice-card__description">{{ option.description }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
export interface WorkflowShortcutChoiceOption {
  value: string
  label: string
  shortcutKey: string
  description?: string
}

withDefaults(
  defineProps<{
    options: WorkflowShortcutChoiceOption[]
    selectedValue?: string
    testIdPrefix?: string
  }>(),
  {
    selectedValue: '',
    testIdPrefix: 'workflow-shortcut-choice',
  },
)

const emit = defineEmits<{
  choose: [value: string]
}>()
</script>

<style scoped>
.workflow-shortcut-choice-grid {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.85rem;
  max-width: 34rem;
}

.workflow-shortcut-choice-card {
  width: 100%;
  display: grid;
  gap: 0.45rem;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-card-1rem);
  background: var(--surface-2);
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.workflow-shortcut-choice-card--active {
  border-color: var(--text);
  background: color-mix(in oklab, var(--surface-2) 72%, var(--surface));
}

.workflow-shortcut-choice-card__header {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.workflow-shortcut-choice-card__key {
  min-width: 1.75rem;
  min-height: 1.75rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in oklab, var(--text) 20%, transparent);
  /* Off the radius scale (nearest is --radius-sm at 0.48rem). Snapping it is a real, if tiny,
     visual change, so it waits for the phase-02 pass rather than riding along with a lint fix.
     Marked rather than silently exempted so it cannot spread. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  border-radius: 0.45rem;
  color: color-mix(in oklab, var(--text) 72%, transparent);
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1;
}

.workflow-shortcut-choice-card__label {
  font-size: 1rem;
  font-weight: 400;
}

.workflow-shortcut-choice-card__description {
  padding-left: 2.4rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.25;
}
</style>
