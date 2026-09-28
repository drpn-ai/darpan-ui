<template>
  <!--
    Anchored beside the face, never over the page. Two reasons, and the second is the stronger:
    a help layer opens beside what it explains so the form stays readable, and a centred modal
    would break the causal line the jump just drew — that object moved, so its answer belongs
    next to it rather than in the middle of the screen. Hence .popup-workflow-modal's chrome
    without .popup-workflow-overlay's centring grid and scrim.
  -->
  <section
    class="popup-workflow-modal workflow-panel mascot-warning-popup"
    role="dialog"
    :aria-labelledby="titleId"
    data-testid="mascot-warning-popup"
  >
    <article
      v-for="(warning, index) in warnings"
      :key="warning.id"
      class="mascot-warning"
      data-testid="mascot-warning"
    >
      <h2
        :id="index === 0 ? titleId : undefined"
        class="mascot-warning__title"
        data-testid="mascot-warning-title"
      >{{ warning.title }}</h2>
      <p class="mascot-warning__body">{{ warning.body }}</p>

      <!-- Empty actions is legal and load-bearing: a deleted saved run cannot be synced, and a
           button that always fails is worse than no button. -->
      <div
        v-if="warning.actions.length"
        class="mascot-warning__actions"
        data-testid="mascot-warning-actions"
      >
        <button
          v-for="action in warning.actions"
          :key="action.testId"
          type="button"
          class="mascot-warning__action"
          :data-testid="action.testId"
          @click="void action.run()"
        >
          {{ action.label }}
        </button>
      </div>
    </article>

    <!-- One dismiss for the popup, not one per warning: dismissal acknowledges the whole
         standing set for this visit, which is what the store's dismiss() models. -->
    <button
      ref="dismissEl"
      type="button"
      class="mascot-warning__action mascot-warning__dismiss"
      data-testid="mascot-warning-dismiss"
      @click="emit('dismiss')"
    >
      Dismiss
    </button>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { MascotWarning } from '../../stores/mascot'

defineProps<{ warnings: MascotWarning[] }>()
const emit = defineEmits<{ (event: 'dismiss'): void }>()

const titleId = 'mascot-warning-title'
const dismissEl = ref<HTMLButtonElement | null>(null)

// Focus lands on the acknowledgement, never on an action. Sync replaces the automation's
// whole source setup, and it must not be one stray Enter away from a popup that just opened.
onMounted(() => dismissEl.value?.focus())
</script>

<style scoped>
/* Grows up and left out of the dock, which is fixed bottom-right with align-items: flex-end.
   Right-anchoring is what keeps it on screen at any width. */
.mascot-warning-popup {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2));
  display: grid;
  gap: var(--space-2);
  width: min(22rem, calc(100vw - 2rem));
  text-align: left;
}

.mascot-warning {
  display: grid;
  gap: var(--space-1);
}

/* Hierarchy from size and colour, never weight — the stylelint gate rejects any other value. */
.mascot-warning__title {
  font-size: var(--type-badge-size);
  font-weight: 400;
  color: var(--warning);
  letter-spacing: var(--type-summary-label-tracking);
  text-transform: uppercase;
}

.mascot-warning__body {
  color: var(--text-soft);
}

.mascot-warning__actions {
  display: flex;
  gap: var(--space-2);
}

/* The product's plain-text button, as used by the Saved Run row's Sync control. */
.mascot-warning__action {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--text-soft);
  text-decoration: underline;
  cursor: pointer;
  white-space: nowrap;
}

.mascot-warning__dismiss {
  justify-self: start;
}
</style>
