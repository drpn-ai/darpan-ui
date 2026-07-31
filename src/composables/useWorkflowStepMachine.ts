import { computed, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue'

/** Minimum shape a create-flow step must have; pages extend this with their own `kind` union. */
export interface WorkflowStep {
  id: string
  title: string
}

export interface UseWorkflowStepMachineOptions<TStep extends WorkflowStep> {
  /** Ordered create-flow steps. Accepts a computed so a page can vary its steps by form state. */
  steps: MaybeRefOrGetter<readonly TStep[]>
  currentStepIndex: Ref<number>
  isEditing: ComputedRef<boolean>
  /** Prompt shown in place of the step title while editing an existing record. */
  editQuestion: string
  /** The step whose primary action saves instead of advancing. */
  finalStepId: string
  /** `data-testid` for the primary action whenever it saves. */
  saveTestId: string
  /** Cleared by goBack() so a stale submit error does not follow the user backwards. */
  error: Ref<string | null>
}

export interface UseWorkflowStepMachine<TStep extends WorkflowStep> {
  currentCreateStep: ComputedRef<TStep>
  progressPercent: ComputedRef<string>
  currentQuestion: ComputedRef<string>
  primaryLabel: ComputedRef<string>
  primaryTestId: ComputedRef<string>
  primaryActionVariant: ComputedRef<'default' | 'save'>
  showBack: ComputedRef<boolean>
  goNext: () => void
  goBack: () => void
}

/**
 * Shared create/edit wizard state for the settings workflow pages. Every one of them drives the
 * same machine: walk an ordered step list while creating, collapse to a single "update" prompt at
 * full progress while editing, and turn the primary action into Save on the final step.
 */
export function useWorkflowStepMachine<TStep extends WorkflowStep>(
  options: UseWorkflowStepMachineOptions<TStep>,
): UseWorkflowStepMachine<TStep> {
  const { currentStepIndex, isEditing, editQuestion, finalStepId, saveTestId, error } = options

  const steps = computed<readonly TStep[]>(() => toValue(options.steps))

  // A reactive step list can shrink under a step index that was valid a moment ago, so clamp on read.
  const currentCreateStep = computed<TStep>(() => {
    const lastStepIndex = Math.max(0, steps.value.length - 1)
    return steps.value[Math.min(currentStepIndex.value, lastStepIndex)] ?? steps.value[0]!
  })

  const isSaveStep = computed(() => isEditing.value || currentCreateStep.value.id === finalStepId)

  const progressPercent = computed(() => (
    isEditing.value
      ? '100'
      : ((Math.max(1, currentStepIndex.value + 1) / steps.value.length) * 100).toFixed(2)
  ))
  const currentQuestion = computed(() => (isEditing.value ? editQuestion : currentCreateStep.value.title))
  const primaryLabel = computed(() => (isSaveStep.value ? 'Save' : 'OK'))
  const primaryTestId = computed(() => (isSaveStep.value ? saveTestId : 'wizard-next'))
  const primaryActionVariant = computed<'default' | 'save'>(() => (isSaveStep.value ? 'save' : 'default'))
  const showBack = computed(() => !isEditing.value && currentStepIndex.value > 0)

  function goNext(): void {
    currentStepIndex.value = Math.min(currentStepIndex.value + 1, steps.value.length - 1)
  }

  function goBack(): void {
    error.value = null
    currentStepIndex.value = Math.max(currentStepIndex.value - 1, 0)
  }

  return {
    currentCreateStep,
    progressPercent,
    currentQuestion,
    primaryLabel,
    primaryTestId,
    primaryActionVariant,
    showBack,
    goNext,
    goBack,
  }
}
