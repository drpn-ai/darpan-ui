<template>
  <WorkflowPage :progress-percent="progress" aria-label="Create a lifecycle" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        v-if="step === 'account'"
        question="Which account?"
        :submit-disabled="!accountId"
        :allow-select-enter="true"
        :show-back="true"
        @back="backToTypeChoice"
        @submit="goToRecords"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect
            v-model="accountId"
            :options="accountOptions"
            :disabled="loadingAccounts"
            :placeholder="loadingAccounts ? 'Loading...' : 'pick an account'"
            test-id="lifecycle-create-account"
          />
        </div>
        <InlineValidation v-if="error" tone="error" :message="error" />
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else-if="step === 'records'"
        question="Which records?"
        :submit-disabled="!recordType || loadingStages"
        :allow-select-enter="true"
        :show-back="true"
        @back="backFromRecords"
        @submit="goToStages"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect
            v-model="recordType"
            :options="recordTypeOptions"
            :disabled="loadingRecordTypes || loadingStages"
            :placeholder="loadingRecordTypes ? `Reading ${accountLabel}...` : loadingStages ? `Reading what follows them...` : 'pick records'"
            test-id="lifecycle-create-records"
          />
        </div>
        <InlineValidation v-if="error" tone="error" :message="error" />
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else-if="step === 'stages'"
        :question="`What happens to ${recordWordOne}?`"
        :submit-disabled="!chosenStages.length"
        :show-back="true"
        @back="step = 'records'"
        @submit="goToLeave"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect
            v-model="chosenStages"
            multiple
            :options="stageOptions"
            :placeholder="stageOptions.length ? 'pick what happens next' : 'nothing follows these records here'"
            test-id="lifecycle-create-stages"
          />
        </div>
        <InlineValidation v-if="error" tone="error" :message="error" />
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else-if="step === 'leave'"
        :question="pendingRules.length ? `Leave out any other ${recordWordMany}?` : `Leave out any ${recordWordMany}?`"
        :submit-disabled="rules.loadingFields.value || Boolean(rules.loadingValuesFor.value)"
        :allow-select-enter="true"
        :show-back="true"
        @back="step = 'stages'"
        @submit="leaveNext"
      >
        <p v-for="rule in pendingRules" :key="`${rule.fieldId}=${rule.value}`" class="workflow-context-label" data-testid="lifecycle-create-pending-rule">
          Leaving out where {{ rule.fieldLabel }} is {{ rule.valueLabel }}
        </p>
        <div class="wizard-input-shell">
          <WorkflowSelect
            v-model="leaveField"
            :options="leaveFieldOptions"
            :disabled="rules.loadingFields.value"
            :placeholder="rules.loadingFields.value ? 'Loading...' : 'pick a field'"
            test-id="lifecycle-create-leave-field"
          />
        </div>
        <InlineValidation v-if="error || rules.error.value" tone="error" :message="(error || rules.error.value) ?? ''" />
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else-if="step === 'leaveValue'"
        :question="`Leave out where ${rules.fieldLabel(leaveField)} is`"
        :submit-disabled="!leaveValue"
        :allow-select-enter="true"
        :show-back="true"
        @back="step = 'leave'"
        @submit="addPendingRule"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect
            v-model="leaveValue"
            :options="leaveValueOptions"
            :disabled="rules.loadingValuesFor.value === leaveField"
            :placeholder="rules.loadingValuesFor.value === leaveField ? 'Loading...' : 'pick a value'"
            test-id="lifecycle-create-leave-value"
          />
        </div>
        <InlineValidation v-if="rules.error.value" tone="error" :message="rules.error.value ?? ''" />
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else
        :question="`When is ${recordWordOne} late?`"
        primary-action-variant="save"
        primary-label="Save lifecycle"
        :submit-disabled="saving || lateAfter === ''"
        :allow-select-enter="true"
        :show-back="true"
        :show-cancel-action="true"
        @back="step = 'leave'"
        @cancel="cancel"
        @submit="create"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect v-model="lateAfter" :options="lateOptions" placeholder="pick a day" test-id="lifecycle-create-late" />
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
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { reconciliationFacade, settingsFacade } from '../../lib/api/facade'
import type { LifecycleRecordTypeOption, LifecycleStageOption } from '../../lib/api/flowchartTypes'
import { orderedStages, lateAfterOptions, defaultLateAfter, stageOptionLabel, stageReach } from '../../lib/lifecycleOptions'
import { useLifecycleRuleOptions, type LifecycleRuleDraft } from '../../lib/useLifecycleRuleOptions'

// DAR-UI-050. A lifecycle in four dropdowns, one per step. Every option is read from the account itself
// (get#LifecycleOptions), so nothing is typed and nothing is offered that the data does not contain. Leave-out
// rules are part of setting it up: a field then a value, each from the account. The name, the stage order and
// every place name are made by the backend.
type Step = 'account' | 'records' | 'stages' | 'leave' | 'leaveValue' | 'late'
const router = useRouter()
const step = ref<Step>('account')
const accounts = ref<{ id: string; label: string }[]>([])
const accountId = ref('')
const recordTypes = ref<LifecycleRecordTypeOption[]>([])
const recordType = ref('')
const stages = ref<LifecycleStageOption[]>([])
const chosenStages = ref<string[]>([])
const lateAfter = ref('')
const loadingAccounts = ref(true)
const loadingRecordTypes = ref(false)
const loadingStages = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
// One account skips its card, so Back from records goes to the type choice instead.
const skippedAccount = ref(false)

const accountOptions = computed(() => accounts.value.map((a) => ({ value: a.id, label: a.label })))
const accountLabel = computed(() => accounts.value.find((a) => a.id === accountId.value)?.label ?? 'the account')
// The account decides which record types are offered (only those with records); the label is just the name.
const recordTypeOptions = computed(() => recordTypes.value.map((r) => ({ value: r.recordType, label: r.label })))
// Leave-out rules, one field then one value per card, repeated until "Nothing" / "Nothing else".
const NOTHING = '__nothing'
const rules = useLifecycleRuleOptions()
const pendingRules = ref<LifecycleRuleDraft[]>([])
const leaveField = ref(NOTHING)
const leaveValue = ref('')
const ruleSource = computed(() => ({ nsAuthConfigId: accountId.value, recordType: recordType.value }))
const recordWordMany = computed(() => (recordTypes.value.find((r) => r.recordType === recordType.value)?.label ?? 'records').toLowerCase())
const leaveFieldOptions = computed(() => [{ value: NOTHING, label: pendingRules.value.length ? 'Nothing else' : 'Nothing' },
  ...rules.fields.value.map((f) => ({ value: f.fieldId, label: f.label }))])
const leaveValueOptions = computed(() => (rules.values[leaveField.value] ?? []).map((v) => ({ value: v.value, label: v.label })))

function goToLeave() {
  leaveField.value = NOTHING
  step.value = 'leave'
  void rules.loadFields(ruleSource.value)
}

function leaveNext() {
  if (leaveField.value === NOTHING) { goToLate(); return }
  leaveValue.value = ''
  step.value = 'leaveValue'
  void rules.loadValues(ruleSource.value, leaveField.value)
}

function addPendingRule() {
  const rule = { fieldId: leaveField.value, fieldLabel: rules.fieldLabel(leaveField.value), value: leaveValue.value,
    valueLabel: rules.valueLabel(leaveField.value, leaveValue.value) }
  if (!pendingRules.value.some((r) => r.fieldId === rule.fieldId && r.value === rule.value)) pendingRules.value.push(rule)
  leaveField.value = NOTHING
  step.value = 'leave'
}

const recordWordOne = computed(() => {
  const label = recordTypes.value.find((r) => r.recordType === recordType.value)?.label ?? 'a record'
  return `a ${label.replace(/s$/, '').toLowerCase()}`
})
const stageOptions = computed(() => stages.value.map((s) => ({ value: s.recordType, label: stageOptionLabel(s) })))
const chosenInOrder = computed(() => orderedStages(stages.value, chosenStages.value))
const lateOptions = computed(() => lateAfterOptions(chosenInOrder.value))
const progress = computed(() => ({ account: 0, records: 20, stages: 40, leave: 60, leaveValue: 70, late: 85 })[step.value])

function backToTypeChoice() { void router.push({ name: 'run-create' }) }
function backFromRecords() { if (skippedAccount.value) backToTypeChoice(); else step.value = 'account' }
function cancel() { void router.push({ name: 'hub' }) }
function message(caught: unknown) { return caught instanceof Error ? caught.message : String(caught) }

async function goToRecords() {
  error.value = null
  step.value = 'records'
  recordType.value = ''
  loadingRecordTypes.value = true
  try {
    recordTypes.value = (await reconciliationFacade.getLifecycleOptions({ nsAuthConfigId: accountId.value })).recordTypes ?? []
  } catch (caught) {
    error.value = message(caught)
  } finally {
    loadingRecordTypes.value = false
  }
}

async function goToStages() {
  error.value = null
  loadingStages.value = true
  try {
    stages.value = (await reconciliationFacade.getLifecycleOptions({ nsAuthConfigId: accountId.value, recordType: recordType.value })).stages ?? []
    // Data-driven default: what at least half of these records go on to.
    chosenStages.value = stages.value.filter((s) => s.rate >= 50).map((s) => s.recordType)
    step.value = 'stages'
  } catch (caught) {
    error.value = message(caught)
  } finally {
    loadingStages.value = false
  }
}

function goToLate() {
  lateAfter.value = defaultLateAfter(chosenInOrder.value)
  step.value = 'late'
}

async function create() {
  saving.value = true
  error.value = null
  try {
    // DAR-UI-052: a stage found by a shared field (a return's credit memo by HC Return Id) says so; linked ones need nothing.
    const reach = stageReach(chosenInOrder.value)
    const saved = await reconciliationFacade.saveLifecycle({
      nsAuthConfigId: accountId.value,
      recordType: recordType.value,
      stageRecordTypes: chosenInOrder.value.map((s) => s.recordType),
      lateAfterDays: Number(lateAfter.value),
      rules: pendingRules.value.map(({ fieldId, fieldLabel, value }) => ({ fieldId, fieldLabel, value })),
      ...(reach.length ? { stageReach: reach } : {}),
    })
    await router.push({ name: 'reconciliation-run-flowchart', params: { reconciliationId: saved.reconciliationId } })
  } catch (caught) {
    error.value = message(caught)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const response = await settingsFacade.listNsAuthConfigs({ pageIndex: 0, pageSize: 100 })
    accounts.value = (response.authConfigs ?? []).map((c) => ({ id: c.nsAuthConfigId, label: c.description || c.nsAuthConfigId }))
    if (accounts.value.length === 1) {
      accountId.value = accounts.value[0]!.id
      skippedAccount.value = true
      await goToRecords()
    }
  } catch (caught) {
    error.value = message(caught)
  } finally {
    loadingAccounts.value = false
  }
})
</script>
