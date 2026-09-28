<template>
  <!--
    The warning dialog, built to the shipped popup contract: .popup-workflow-overlay carries the
    role and the labelling, .popup-workflow-modal.workflow-panel the surface, and the question shell
    the type scale — a 0.875rem title, the prompt at --popup-workflow-prompt-size, detail beneath at
    answer size. The earlier version set everything at 0.84-0.875rem and so had no focal line at all,
    which is why no amount of chrome made it look like the other popups.

    ONE WARNING AT A TIME. Two prompts at 1.5rem is two focal lines, which is none — and a shared
    action row could not say which warning a button answered. Paging also makes Dismiss mean the one
    you are looking at, instead of silencing conditions nobody addressed.
  -->
  <Teleport to="body">
    <div
      v-if="mascot.popupOpen && current"
      class="popup-workflow-overlay"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      data-testid="mascot-warning-popup"
      @click.self="close"
    >
      <section class="popup-workflow-modal workflow-panel mascot-warning-popup">
        <p
          v-if="total > 1"
          class="mascot-warning-counter"
          data-testid="mascot-warning-counter"
        >
          {{ position }} of {{ total }}
        </p>

        <header class="workflow-panel-header section-header-row" data-testid="mascot-warning">
          <h2 :id="titleId">{{ current.title }}</h2>
        </header>

        <!--
          These are this component's OWN classes, not WorkflowStepForm's. Its .wizard-question rules
          live in a <style scoped> block, so borrowing the names gave a template that read like reuse
          and delivered nothing: no size on the prompt, and no margin above the actions. The sizes
          come from --popup-workflow-* instead, which ARE global and are inherited from the panel.
        -->
        <div class="mascot-warning-shell">
          <p class="mascot-warning-prompt" data-testid="mascot-warning-prompt">{{ current.prompt }}</p>
          <p class="mascot-warning-detail" data-testid="mascot-warning-detail">{{ current.body }}</p>

          <!-- One row, because they are one choice. Next sits apart from them: it moves between
               warnings rather than answering this one. -->
          <div class="mascot-warning-actions" data-testid="mascot-warning-actions">
            <button
              v-for="action in current.actions"
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
              class="mascot-warning-action mascot-warning-action--quiet"
              data-testid="mascot-warning-dismiss"
              @click="void dismiss()"
            >
              Dismiss
            </button>
            <button
              v-if="total > 1"
              type="button"
              class="mascot-warning-action mascot-warning-action--quiet mascot-warning-next"
              data-testid="mascot-warning-next"
              @click="mascot.nextWarning()"
            >
              Next ›
            </button>
          </div>
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

const current = computed(() => mascot.currentWarning)
const total = computed(() => mascot.warnings.length)
const position = computed(() => mascot.warningIndex + 1)

/* Closing is not acknowledging: Escape and an outside click put the dialog away, and the
   condition still stands with the face still holding its posture. Only Dismiss clears it. */
function close(): void {
  mascot.closeWarnings()
}

/* Dismissing must not drop focus onto the document body: a keyboard reader would be returned to
   the top of the page having lost their place. The dock owns the face, so hand it back there. */
/* Acknowledges the ONE on screen and advances. Focus only returns to the face when that was the
   last of them — otherwise the reader is still in the dialog, looking at the next warning. */
async function dismiss(): Promise<void> {
  mascot.dismissCurrent()
  await nextTick()
  if (mascot.popupOpen) { dismissEl.value?.focus(); return }
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
