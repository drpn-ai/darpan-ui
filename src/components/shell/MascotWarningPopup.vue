<template>
  <!--
    The warning's own surface. It used to share .mascot-say with hints and explanations, which
    made a label and a condition-you-must-act-on look identical — and left a paragraph sitting in
    a bubble sized for one line. This is a dialog instead, on the same mechanism CMD-K already
    uses: teleported to the body, a transparent backdrop that closes on an outside click, Escape
    to leave.

    It uses .popup-workflow-overlay / .popup-workflow-modal — the pair six other surfaces already
    use, including the exclusion editor on the rules board — so it lands viewport-centred at the
    same size, with the same faint wash and the same blurred page behind it as every other popup
    in the product. A bespoke overlay anchored at the mascot is what made this read as one more
    bubble in the corner rather than something that had opened.
  -->
  <Teleport to="body">
    <div
      v-if="mascot.popupOpen && mascot.hasWarnings"
      class="popup-workflow-overlay"
      @click.self="close"
    >
      <section
        ref="panel"
        class="popup-workflow-modal workflow-panel mascot-warning-popup"
        role="dialog"
        aria-modal="true"
        :aria-label="dialogLabel"
        data-testid="mascot-warning-popup"
        @keydown.escape.prevent="close"
      >
        <article
          v-for="warning in mascot.warnings"
          :key="warning.id"
          class="mascot-warning-item"
          data-testid="mascot-warning"
        >
          <h2 class="mascot-warning-title">{{ warning.title }}</h2>
          <p class="mascot-warning-body">{{ warning.body }}</p>
        </article>

        <!-- One row, because they are one choice. Dismiss sits beside the actions rather than
             under them: "sync or dismiss" is the question, and stacking it read as two. -->
        <div class="mascot-warning-actions" data-testid="mascot-warning-actions">
          <button
            v-for="action in openActions"
            :key="action.testId"
            type="button"
            class="mascot-warning-action"
            :data-testid="action.testId"
            @click="void action.run()"
          >
            {{ action.label }}
          </button>
          <button
            ref="dismissEl"
            type="button"
            class="mascot-warning-action"
            data-testid="mascot-warning-dismiss"
            @click="void dismiss()"
          >
            Dismiss
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMascotStore } from '../../stores/mascot'

const mascot = useMascotStore()
const panel = ref<HTMLElement | null>(null)
const dismissEl = ref<HTMLButtonElement | null>(null)

/* Names the conditions rather than saying "Warnings", so a screen-reader user knows what opened
   before tabbing into it. Two warnings really can stand at once. */
const dialogLabel = computed(() =>
  mascot.warnings.map((warning) => warning.title).join(', ') || 'Warning',
)

/* Every standing warning's actions, in one row with Dismiss. A warning that can only be
   acknowledged contributes nothing here, which is what `actions: []` is for. */
const openActions = computed(() => mascot.warnings.flatMap((warning) => warning.actions))

/* Closing is not acknowledging: Escape and an outside click put the dialog away, and the
   condition still stands with the face still holding its posture. Only Dismiss clears it. */
function close(): void {
  mascot.closeWarnings()
}

/* Dismissing must not drop focus onto the document body: a keyboard reader would be returned to
   the top of the page having lost their place. The dock owns the face, so hand it back there. */
async function dismiss(): Promise<void> {
  mascot.dismiss()
  await nextTick()
  document.querySelector<HTMLButtonElement>('.mascot-fab')?.focus()
}

/* Focus lands on the acknowledgement, never on an action: Sync replaces the automation's whole
   source setup and must not be one stray Enter away. */
watch(() => mascot.popupOpen, async (open) => {
  if (!open) return
  await nextTick()
  dismissEl.value?.focus()
})

/* Escape is listened for on the document as well as the panel: the panel only sees the key once
   focus is inside it, and an outside click is not the only way someone leaves. */
function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !mascot.popupOpen) return
  close()
}

onMounted(() => document.addEventListener('keydown', onDocumentKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown))
</script>
