import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useWorkflowStepMachine } from '../useWorkflowStepMachine'

interface TestStep {
  id: string
  title: string
  kind?: 'text' | 'select'
}

const STEPS: TestStep[] = [
  { id: 'host', title: 'What is the host?', kind: 'text' },
  { id: 'authType', title: 'Which auth type?', kind: 'select' },
  { id: 'name', title: 'What should it be called?', kind: 'text' },
]

function setup(overrides: { editing?: boolean; steps?: unknown } = {}) {
  const currentStepIndex = ref(0)
  const editing = ref(overrides.editing ?? false)
  const isEditing = computed(() => editing.value)
  const error = ref<string | null>(null)
  const machine = useWorkflowStepMachine<TestStep>({
    steps: (overrides.steps ?? STEPS) as TestStep[],
    currentStepIndex,
    isEditing,
    editQuestion: 'Update the record.',
    finalStepId: 'name',
    saveTestId: 'save-thing',
    error,
  })
  return { machine, currentStepIndex, editing, error }
}

describe('useWorkflowStepMachine — create flow', () => {
  it('starts on the first step and reports proportional progress', () => {
    const { machine } = setup()
    expect(machine.currentCreateStep.value.id).toBe('host')
    expect(machine.currentQuestion.value).toBe('What is the host?')
    expect(machine.progressPercent.value).toBe('33.33')
    expect(machine.showBack.value).toBe(false)
  })

  it('advances and steps back, clearing a stale error on the way back', () => {
    const { machine, currentStepIndex, error } = setup()
    machine.goNext()
    expect(currentStepIndex.value).toBe(1)
    expect(machine.showBack.value).toBe(true)

    error.value = 'Save failed'
    machine.goBack()
    expect(currentStepIndex.value).toBe(0)
    expect(error.value).toBeNull()
  })

  it('clamps navigation at both ends', () => {
    const { machine, currentStepIndex } = setup()
    machine.goBack()
    expect(currentStepIndex.value).toBe(0)
    machine.goNext(); machine.goNext(); machine.goNext(); machine.goNext()
    expect(currentStepIndex.value).toBe(STEPS.length - 1)
  })

  it('offers OK until the final step, then Save', () => {
    const { machine } = setup()
    expect(machine.primaryLabel.value).toBe('OK')
    expect(machine.primaryTestId.value).toBe('wizard-next')
    expect(machine.primaryActionVariant.value).toBe('default')

    machine.goNext()
    machine.goNext()
    expect(machine.currentCreateStep.value.id).toBe('name')
    expect(machine.primaryLabel.value).toBe('Save')
    expect(machine.primaryTestId.value).toBe('save-thing')
    expect(machine.primaryActionVariant.value).toBe('save')
  })

  it('clamps a step index that overruns a shrinking step list', () => {
    const extra = [...STEPS, { id: 'extra', title: 'Extra?', kind: 'text' as const }]
    const steps = ref(extra)
    const currentStepIndex = ref(3)
    const isEditing = computed(() => false)
    const machine = useWorkflowStepMachine<TestStep>({
      steps,
      currentStepIndex,
      isEditing,
      editQuestion: 'Update the record.',
      finalStepId: 'name',
      saveTestId: 'save-thing',
      error: ref<string | null>(null),
    })
    expect(machine.currentCreateStep.value.id).toBe('extra')

    // Reactive step lists shrink when form state changes (e.g. a different auth type).
    steps.value = STEPS
    expect(machine.currentCreateStep.value.id).toBe('name')
  })
})

describe('useWorkflowStepMachine — edit flow', () => {
  it('collapses to a single save prompt at full progress', () => {
    const { machine } = setup({ editing: true })
    expect(machine.currentQuestion.value).toBe('Update the record.')
    expect(machine.progressPercent.value).toBe('100')
    expect(machine.primaryLabel.value).toBe('Save')
    expect(machine.primaryTestId.value).toBe('save-thing')
    expect(machine.primaryActionVariant.value).toBe('save')
    expect(machine.showBack.value).toBe(false)
  })

  it('never shows Back while editing, even past the first step', () => {
    const { machine, currentStepIndex } = setup({ editing: true })
    currentStepIndex.value = 2
    expect(machine.showBack.value).toBe(false)
  })
})
