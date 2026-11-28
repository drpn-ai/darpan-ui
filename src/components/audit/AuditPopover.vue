<template>
  <!-- DAR-OPS-029 U05b. An icon on a finding that opens a small dialog hanging from it: the acknowledgement and the feedback
       popovers. Anchored to its trigger and scaling from it; a press outside or Esc closes it and hands focus back. -->
  <span ref="anchor" class="audit-popover-anchor" @keydown.esc="onEscape">
    <button
      ref="trigger"
      type="button"
      class="app-icon-action audit-popover-trigger"
      :aria-label="label"
      :title="label"
      :data-testid="testId"
      aria-haspopup="dialog"
      :aria-expanded="open ? 'true' : 'false'"
      @click="emit('toggle')"
    >
      <AppIcon :name="icon" />
      <slot name="badge" />
    </button>
    <Transition name="audit-popover-pop">
      <div v-if="open" ref="dialog" class="audit-popover" :style="{ '--audit-popover-width': width }" role="dialog" :aria-label="dialogLabel" :data-testid="dialogTestId">
        <slot />
      </div>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import type { IconName } from '../../lib/icons'

const props = withDefaults(defineProps<{
  open: boolean
  /** The trigger's words (aria-label and title). */
  label: string
  icon: IconName
  testId: string
  dialogLabel: string
  dialogTestId: string
  /** The dialog's width, held inside a phone's window. */
  width?: string
}>(), { width: '20rem' })

const emit = defineEmits<{ toggle: []; close: [] }>()

const anchor = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)

// Opened, the box to write in takes the focus.
watch(() => props.open, (open) => {
  if (open) void nextTick(() => dialog.value?.querySelector<HTMLElement>('textarea, input')?.focus())
})

// Focus never falls to the page: closed by Esc or a press outside, it goes back to the trigger, unless the press sent it elsewhere.
function close(): void {
  emit('close')
  void nextTick(() => {
    const active = document.activeElement
    if (!active || active === document.body || anchor.value?.contains(active)) trigger.value?.focus()
  })
}

// Esc is this dialog's only while it is open; on a closed trigger it is the page's.
function onEscape(event: KeyboardEvent): void {
  if (!props.open) return
  event.preventDefault()
  event.stopPropagation()
  close()
}

function onPointerDown(event: PointerEvent): void {
  if (props.open && anchor.value && event.target instanceof Node && !anchor.value.contains(event.target)) close()
}
onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))

defineExpose({ focus: () => trigger.value?.focus() })
</script>

<style scoped>
.audit-popover-anchor {
  position: relative;
  display: inline-flex;
}

.audit-popover-trigger {
  position: relative;
}

.audit-popover {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 6;
  display: grid;
  width: min(var(--audit-popover-width), calc(100vw - 2 * var(--space-4)));
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  text-align: left;
  /* Scales from its trigger, above and to the right (playbook: Motion). */
  transform-origin: right top;
}

.audit-popover-pop-enter-active {
  transition: opacity var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out);
}

/* The exit is the shorter one. */
.audit-popover-pop-leave-active {
  transition: opacity var(--motion-exit) var(--ease-out), transform var(--motion-exit) var(--ease-out);
}

.audit-popover-pop-enter-from,
.audit-popover-pop-leave-to {
  opacity: 0;
  transform: scale(var(--motion-enter-scale));
}
</style>
