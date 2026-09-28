<template>
  <!--
    The warning's own surface, built to the shipped popup contract rather than a bespoke one:
    role and labelling on the OVERLAY, a .workflow-panel-header with an h2 for the title, body copy
    as .section-note, and NO gap override — .workflow-panel already sets grid gap --space-3, and
    overriding it to --space-2 is what made the title sit flush against the body.

    Modelled on ConnectionDiagnosticsPopup and the ruleset-manager auth popup, which is also how
    the exclusion editor on the rules board is built.
  -->
  <Teleport to="body">
    <div
      v-if="mascot.popupOpen && mascot.hasWarnings"
      class="popup-workflow-overlay"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      data-testid="mascot-warning-popup"
      @click.self="close"
    >
      <section class="popup-workflow-modal workflow-panel mascot-warning-popup">
        <template v-for="(warning, index) in mascot.warnings" :key="warning.id">
          <header class="workflow-panel-header section-header-row" data-testid="mascot-warning">
            <h2 :id="index === 0 ? titleId : undefined">{{ warning.title }}</h2>
          </header>
          <p class="section-note">{{ warning.body }}</p>
        </template>

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
const dismissEl = ref<HTMLButtonElement | null>(null)

/* The dialog is labelled BY its first heading, the way every other popup here is, rather than by a
   string built beside it — so the accessible name cannot drift from what is drawn. */
const titleId = 'mascot-warning-title'

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
