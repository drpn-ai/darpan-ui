<template>
  <WorkflowPage :progress-percent="progress" aria-label="Create a run" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        v-if="step === 'start'"
        question="Where does this run start?"
        :show-primary-action="false"
        :show-enter-hint="false"
        :show-back="true"
        @back="cancel"
      >
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
        <div class="wizard-input-shell">
          <WorkflowSelect v-model="startRuleId" :options="startRuleOptions" placeholder="pick a rule" test-id="flowchart-create-rule" />
        </div>
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else-if="step === 'days'"
        question="How many days should a run look back?"
        :submit-disabled="days < 1"
        :show-back="true"
        @back="step = startChoice === 'records' ? 'rule' : 'start'"
        @submit="step = 'name'"
      >
        <div class="wizard-input-shell">
          <input v-model.number="days" type="number" min="1" inputmode="numeric" class="wizard-answer-control" data-testid="flowchart-create-days" />
        </div>
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else
        question="What should we call this run?"
        primary-action-variant="save"
        primary-label="Save run"
        :submit-disabled="saving || !name.trim()"
        :show-back="true"
        :show-cancel-action="true"
        @back="step = 'days'"
        @cancel="cancel"
        @submit="create"
      >
        <div class="wizard-input-shell">
          <input
            v-model="name"
            type="text"
            :class="['wizard-answer-control', { empty: !name }]"
            placeholder="NetSuite order chain"
            data-testid="flowchart-create-name"
          />
        </div>
        <InlineValidation v-if="error" tone="error" :message="error" />
      </WorkflowStepForm>
    </div>
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

// DAR-UI-048. A workflow flow, one question per step, the record name on the last step (design system
// rule 5): where it starts, the starting rule, the look-back, then the name.
type Step = 'start' | 'rule' | 'days' | 'name'
const router = useRouter()
const step = ref<Step>('start')
const name = ref('')
const startChoice = ref<'records' | 'none' | ''>('')
const startRuleId = ref('')
const days = ref(1)
const rules = ref<SavedRunSummary[]>([])
const saving = ref(false)
const error = ref<string | null>(null)

const startOptions = [
  { value: 'records', label: 'From a list of records', shortcutKey: 'A', description: 'Every record the rule lists is asked the first question' },
  { value: 'none', label: 'No start', shortcutKey: 'B', description: 'Each question asks about the records its own rule fetches' },
]
const startRuleOptions = computed(() => rules.value
  .filter((r) => r.scopeMode === 'EVALUATE' && !r.isArchived)
  .map((r) => ({ value: r.savedRunId, label: r.runName || r.savedRunId })))
const progress = computed(() => ({ start: 0, rule: 25, days: 50, name: 75 })[step.value])

function chooseStart(value: string) {
  startChoice.value = value as 'records' | 'none'
  step.value = value === 'records' ? 'rule' : 'days'
}

function cancel() { void router.push({ name: 'reconciliation-run-flowcharts' }) }

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
