<template>
  <button
    type="button"
    role="switch"
    class="app-toggle-switch"
    :class="{ 'app-toggle-switch--on': modelValue }"
    :aria-checked="modelValue ? 'true' : 'false'"
    :aria-label="label"
    :aria-busy="busy ? 'true' : undefined"
    :disabled="disabled || busy"
    :data-testid="testId"
    @click="flip"
  >
    <!-- Only the glyph in the half the knob has vacated stays visible, so the symbol and the knob
         position always agree instead of showing both states at once. Both are aria-hidden: the
         switch role plus aria-checked is what assistive tech reads. -->
    <span
      class="app-toggle-switch-glyph app-toggle-switch-glyph--on"
      :class="{ 'app-toggle-switch-glyph--visible': modelValue }"
      data-testid="toggle-glyph-on"
      aria-hidden="true"
    >I</span>
    <span
      class="app-toggle-switch-glyph app-toggle-switch-glyph--off"
      :class="{ 'app-toggle-switch-glyph--visible': !modelValue }"
      data-testid="toggle-glyph-off"
      aria-hidden="true"
    >O</span>
    <span class="app-toggle-switch-knob" aria-hidden="true" />
  </button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  /** Accessible name. The switch carries no visible text, so this is the only name it has. */
  label: string
  disabled?: boolean
  /** Held true while the change this switch triggered is still in flight. */
  busy?: boolean
  testId?: string
}>(), {
  disabled: false,
  busy: false,
  testId: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

function flip(): void {
  if (props.disabled || props.busy) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.app-toggle-switch {
  position: relative;
  flex: 0 0 auto;
  /* Track geometry. Not scale spacing -- these are the control's own proportions, and every
     position below is derived from them as a percentage rather than a hand-computed offset.
     The box is border-box but absolutely-positioned children offset from the padding edge, so
     any rem arithmetic here would silently double-count the border. */
  width: 3.5rem;
  height: 2rem;
  min-height: 2rem;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: transparent;
  transition: background-color 160ms ease, border-color 160ms ease;
}

.app-toggle-switch--on {
  /* Inherits the tint the status pill used before this control replaced it, so the change reads
     as the same state indicator gaining a control rather than as a new visual language. */
  border-color: color-mix(in oklab, var(--accent) 36%, var(--border));
  background: color-mix(in oklab, var(--accent) 10%, transparent);
}

.app-toggle-switch:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* Each glyph owns one half of the track and centres itself in it, so it always lands in the
   half the knob is not occupying -- no overlap, and no retuning if the track resizes. */
.app-toggle-switch-glyph {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-soft);
  font-size: var(--type-muted-size);
  line-height: 1;
  opacity: 0;
  transition: opacity 160ms ease;
}

.app-toggle-switch-glyph--on {
  left: 0;
}

.app-toggle-switch-glyph--off {
  right: 0;
}

.app-toggle-switch-glyph--visible {
  opacity: 1;
}

.app-toggle-switch--on .app-toggle-switch-glyph--on {
  color: var(--text);
}

.app-toggle-switch-knob {
  position: absolute;
  top: 50%;
  left: 0.25rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-pill);
  background: var(--text-soft);
  transform: translateY(-50%);
  transition: transform 160ms ease, background-color 160ms ease;
}

.app-toggle-switch--on .app-toggle-switch-knob {
  background: var(--text);
  /* Travel spans the padding box less the knob and both insets, expressed against the knob's own
     width so it stays exact: 100% of the track minus the knob, minus 0.25rem at each end. */
  transform: translate(calc(3.5rem - 2px - 1.25rem - 0.5rem), -50%);
}
</style>
