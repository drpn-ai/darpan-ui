<template>
  <WorkflowPage :progress-percent="0" aria-label="Create a run" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        class="run-create-type-step"
        question="What kind of run?"
        :show-primary-action="false"
        :show-enter-hint="false"
        :show-back="true"
        @back="goHome"
      >
        <WorkflowShortcutChoiceCards :options="options" test-id-prefix="run-type-choice" @choose="choose" />
      </WorkflowStepForm>
    </div>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { RUN_TYPES, RUN_TYPE_ORDER, type RunTypeId } from '../../lib/runTypes'

// DAR-UI-049. One Create Run, one question: which kind. Each answer hands off to the create flow
// that already exists for it, so neither flow changes.
const router = useRouter()
const options = RUN_TYPE_ORDER.map((id, index) => ({
  value: id,
  label: RUN_TYPES[id].label,
  shortcutKey: String.fromCharCode(65 + index),
  description: RUN_TYPES[id].description,
}))

function choose(value: string) {
  const definition = RUN_TYPES[value as RunTypeId]
  if (definition?.createRoute) void router.push(definition.createRoute)
}

function goHome() { void router.push({ name: 'hub' }) }

// DAR-UI-055. The cards only draw the A / B badges; each page wires the keys itself, as
// ReconciliationCreateFlowPage does. Skipped while typing so the command palette keeps its letters.
function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

function handleShortcutKeydown(event: KeyboardEvent) {
  if (typeof event.key !== 'string' || event.key.length !== 1) return
  if (event.defaultPrevented || event.repeat || event.isComposing) return
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (isTypingTarget(event.target)) return

  const option = options.find((candidate) => candidate.shortcutKey === event.key.toUpperCase())
  if (!option) return
  event.preventDefault()
  choose(option.value)
}

onMounted(() => window.addEventListener('keydown', handleShortcutKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcutKeydown))
</script>

<style scoped>
/* Sized to the choice grid, as RunFlowchartCreatePage's start step is, so question, cards and
   Back centre as one block. */
.run-create-type-step {
  width: min(34rem, 100%);
}
</style>
