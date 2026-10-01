<template>
  <WorkflowPage :progress-percent="progress" aria-label="Create a run">
    <WorkflowStepForm
      v-if="step === 'name'"
      question="What is this run called?"
      :submit-disabled="!name.trim()"
      @submit="step = 'start'"
    >
      <input v-model="name" type="text" class="wizard-input" data-testid="flowchart-create-name" />
    </WorkflowStepForm>

    <WorkflowStepForm v-else-if="step === 'start'" question="Where does it start?" :show-primary-action="false" :show-back="true" @back="step = 'name'">
      <WorkflowShortcutChoiceCards
        :options="startOptions"
        :selected-value="startChoice"
        test-id-prefix="flowchart-start-choice"
        @choose="chooseStart"
      />
    </WorkflowStepForm>

    <WorkflowStepForm
      v-else-if="step === 'rule'"
      question="Which rule lists the starting records?"
      :submit-disabled="!startRuleId"
      :show-back="true"
      @back="step = 'start'"
      @submit="step = 'days'"
    >
      <WorkflowSelect v-model="startRuleId" :options="startRuleOptions" placeholder="Choose a rule" test-id="flowchart-create-rule" />
    </WorkflowStepForm>

    <WorkflowStepForm
      v-else
      question="How many days does a run look back?"
      primary-label="Create run"
      :submit-disabled="saving || days < 1"
      :show-back="true"
      @back="step = startChoice === 'records' ? 'rule' : 'start'"
      @submit="create"
    >
      <input v-model.number="days" type="number" min="1" class="wizard-input" data-testid="flowchart-create-days" />
      <InlineValidation v-if="error" tone="error" :message="error" />
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowShortcutChoiceCards from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type { SavedRunSummary } from '../../lib/api/types'

// DAR-UI-048. One data point per card: name, where it starts, the starting rule, the look-back.
type Step = 'name' | 'start' | 'rule' | 'days'
const router = useRouter()
const step = ref<Step>('name')
const name = ref('')
const startChoice = ref<'records' | 'none' | ''>('')
const startRuleId = ref('')
const days = ref(1)
const rules = ref<SavedRunSummary[]>([])
const saving = ref(false)
const error = ref<string | null>(null)

const startOptions = [
  { value: 'records', label: 'Start from a list of records', shortcutKey: 'A' },
  { value: 'none', label: 'No start, questions stand alone', shortcutKey: 'B' },
]
const startRuleOptions = computed(() => rules.value
  .filter((r) => r.scopeMode === 'EVALUATE' && !r.isArchived)
  .map((r) => ({ value: r.savedRunId, label: r.runName || r.savedRunId })))
const progress = computed(() => ({ name: 20, start: 45, rule: 70, days: 90 })[step.value])

function chooseStart(value: string) {
  startChoice.value = value as 'records' | 'none'
  step.value = value === 'records' ? 'rule' : 'days'
}

async function create() {
  saving.value = true
  error.value = null
  try {
    const { reconciliation } = await reconciliationFacade.saveReconciliation({ reconciliationName: name.value.trim(), defaultTimeWindow: `${days.value}d` })
    if (startChoice.value === 'records' && startRuleId.value) {
      const rule = rules.value.find((r) => r.savedRunId === startRuleId.value)
      await reconciliationFacade.saveReconciliationQuestion({
        reconciliationId: reconciliation.reconciliationId, ruleSetId: startRuleId.value, questionRole: 'START', runName: rule?.runName ?? undefined,
      })
    }
    await router.push({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliation.reconciliationId } })
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    rules.value = (await reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: 200 })).savedRuns ?? []
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
})
</script>
