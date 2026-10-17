<template>
  <WorkflowPage :progress-percent="'100'" aria-label="Lifecycle settings" center-stage edit-surface>
    <InlineValidation
      v-if="error || rules.error.value || stageRules.error.value"
      tone="error"
      :message="(error || rules.error.value || stageRules.error.value) ?? ''"
    />

    <WorkflowStepForm
      :class="['workflow-form--compact', 'workflow-form--edit-single-page']"
      question="Update the lifecycle."
      primary-label="Save"
      primary-action-variant="save"
      :show-enter-hint="false"
      :show-back="false"
      :show-cancel-action="true"
      :cancel-disabled="saving"
      cancel-test-id="lifecycle-settings-cancel"
      :submit-disabled="saving || !source"
      primary-test-id="lifecycle-settings-save"
      @submit="save"
      @cancel="back"
    >
      <div class="lifecycle-spine-layout">
        <!-- The lifecycle as one line, top to bottom. A rule sits where it acts: what is left out under the
             starting records, what a stage is not expected of on the gap into it. Add-actions show on approach. -->
        <div class="lifecycle-spine" data-testid="lifecycle-spine">
          <div class="lifecycle-spine-group">
            <div class="lifecycle-spine-node lifecycle-spine-node--start">
              <span class="lifecycle-spine-name" data-testid="lifecycle-settings-records">{{ recordWord }}</span>
              <span class="lifecycle-spine-quiet">{{ accountLabel }}</span>
            </div>
            <div class="lifecycle-spine-gap">
              <!-- A line opens in place as its editing row; a new one opens at the end. -->
              <template v-for="row in filterRows" :key="row.key">
                <div v-if="row.editing" class="lifecycle-spine-editing" data-testid="lifecycle-settings-adding-filter">
                  <span class="lifecycle-spine-quiet">except</span>
                  <AppSelect
                    :model-value="newField"
                    :options="fieldOptions"
                    :disabled="rules.loadingFields.value"
                    :placeholder="rules.loadingFields.value ? 'Loading...' : 'field'"
                    searchable
                    test-id="lifecycle-settings-field"
                    @update:model-value="chooseField"
                  />
                  <span class="lifecycle-spine-quiet">is</span>
                  <AppSelect
                    v-model="newValue"
                    :options="newValueOptions"
                    :disabled="!newField || rules.loadingValuesFor.value === newField"
                    :placeholder="rules.loadingValuesFor.value === newField ? 'Loading...' : 'value'"
                    searchable
                    test-id="lifecycle-settings-value"
                  />
                  <button
                    type="button"
                    class="wizard-secondary-link"
                    :aria-label="row.rule ? 'Change this filter' : 'Add this filter'"
                    :disabled="!newField || !newValue"
                    data-testid="lifecycle-settings-add-rule"
                    @click="addRule"
                  >
                    {{ row.rule ? 'Change' : 'Add' }}
                  </button>
                  <button type="button" class="lifecycle-spine-remove lifecycle-spine-remove--shown" aria-label="Stop editing" @click="adding = null">×</button>
                </div>
                <div v-else-if="row.rule" class="lifecycle-spine-phrase" :data-testid="`lifecycle-settings-rule-${row.index}`">
                  <button
                    type="button"
                    class="lifecycle-spine-line"
                    :aria-label="`Change rule ${row.rule.fieldLabel} is ${row.rule.valueLabel}`"
                    :data-testid="`lifecycle-settings-edit-rule-${row.index}`"
                    @click="editRule(row.index)"
                  >
                    <span class="lifecycle-spine-quiet">except</span> {{ row.rule.fieldLabel }} <span class="lifecycle-spine-quiet">is</span> {{ row.rule.valueLabel }}
                  </button>
                  <button type="button" class="lifecycle-spine-remove" :aria-label="`Remove rule ${row.rule.fieldLabel} is ${row.rule.valueLabel}`" :data-testid="`lifecycle-settings-remove-${row.index}`" @click="removeRule(row.index)">×</button>
                </div>
              </template>
              <button v-if="adding?.kind !== 'filter'" type="button" class="lifecycle-spine-ghost" aria-label="Add filter" data-testid="lifecycle-settings-add-filter" @click="startAdding({ kind: 'filter' })">+ except</button>
              <!-- What each record shows beside its order, date, status, customer, total, shipping method and reference. -->
              <div v-for="(detail, index) in keptDetails" :key="detail.fieldId" class="lifecycle-spine-phrase" :data-testid="`lifecycle-settings-detail-${index}`">
                <span><span class="lifecycle-spine-quiet">shows</span> {{ detail.label }}</span>
                <button type="button" class="lifecycle-spine-remove" :aria-label="`Stop showing ${detail.label}`" @click="keptDetails.splice(index, 1)">×</button>
              </div>
              <div v-if="adding?.kind === 'detail'" class="lifecycle-spine-editing" data-testid="lifecycle-settings-adding-detail">
                <span class="lifecycle-spine-quiet">shows</span>
                <AppSelect
                  v-model="newDetail"
                  :options="detailOptions"
                  :disabled="rules.loadingFields.value"
                  :placeholder="rules.loadingFields.value ? 'Loading...' : 'field'"
                  searchable
                  test-id="lifecycle-settings-detail-field"
                />
                <button type="button" class="wizard-secondary-link" aria-label="Show this field" :disabled="!newDetail" data-testid="lifecycle-settings-add-detail" @click="addDetail">Add</button>
                <button type="button" class="lifecycle-spine-remove lifecycle-spine-remove--shown" aria-label="Stop editing" @click="adding = null">×</button>
              </div>
              <button v-else type="button" class="lifecycle-spine-ghost" aria-label="Show a field" data-testid="lifecycle-settings-show-field" @click="startAdding({ kind: 'detail' })">+ shows</button>
              <div class="lifecycle-spine-editing">
                <span class="lifecycle-spine-quiet">judged after</span>
                <AppSelect v-model="lateAfter" :options="lateOptions" :disabled="!source" test-id="lifecycle-settings-late" />
              </div>
            </div>
          </div>

          <div v-for="(stage, stageIndex) in stages" :key="stage.recordType" class="lifecycle-spine-group">
            <div class="lifecycle-spine-node">
              <span class="lifecycle-spine-name">{{ stage.label }}</span>
              <button
                type="button"
                class="lifecycle-spine-remove"
                :aria-label="`Move ${stage.label} up`"
                :disabled="stageIndex === 0"
                :data-testid="`lifecycle-settings-up-${stage.recordType}`"
                @click="moveStage(stageIndex, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="lifecycle-spine-remove"
                :aria-label="`Move ${stage.label} down`"
                :disabled="stageIndex === stages.length - 1"
                :data-testid="`lifecycle-settings-down-${stage.recordType}`"
                @click="moveStage(stageIndex, 1)"
              >
                ↓
              </button>
            </div>
            <div class="lifecycle-spine-gap">
              <template v-for="row in exceptionRows(stage.recordType)" :key="row.key">
                <div v-if="row.editing" class="lifecycle-spine-editing" :data-testid="`lifecycle-settings-adding-exception-${stage.recordType}`">
                  <span class="lifecycle-spine-quiet">not expected for</span>
                  <AppSelect
                    :model-value="exField"
                    :options="exFieldOptions"
                    :disabled="stageRules.loadingFields.value"
                    :placeholder="stageRules.loadingFields.value ? 'Loading...' : 'field'"
                    searchable
                    test-id="lifecycle-settings-exception-field"
                    @update:model-value="chooseExField"
                  />
                  <span class="lifecycle-spine-quiet">is</span>
                  <AppSelect
                    v-model="exValue"
                    :options="exValueOptions"
                    :disabled="!exField || stageRules.loadingValuesFor.value === exField"
                    :placeholder="stageRules.loadingValuesFor.value === exField ? 'Loading...' : 'value'"
                    searchable
                    test-id="lifecycle-settings-exception-value"
                  />
                  <button
                    type="button"
                    class="wizard-secondary-link"
                    :aria-label="row.exception ? 'Change this exception' : 'Add this exception'"
                    :disabled="!exField || !exValue"
                    data-testid="lifecycle-settings-add-exception"
                    @click="addException(stage)"
                  >
                    {{ row.exception ? 'Change' : 'Add' }}
                  </button>
                  <button type="button" class="lifecycle-spine-remove lifecycle-spine-remove--shown" aria-label="Stop editing" @click="adding = null">×</button>
                </div>
                <div v-else-if="row.exception" class="lifecycle-spine-phrase" :data-testid="`lifecycle-settings-exception-${stage.recordType}-${row.index}`">
                  <button
                    type="button"
                    class="lifecycle-spine-line"
                    :aria-label="`Change exception ${stage.label} ${row.exception.fieldLabel} is ${row.exception.value}`"
                    :data-testid="`lifecycle-settings-edit-exception-${stage.recordType}-${row.index}`"
                    @click="editException(row.exception)"
                  >
                    <span class="lifecycle-spine-quiet">not expected for</span> {{ row.exception.fieldLabel }} <span class="lifecycle-spine-quiet">is</span> {{ row.exception.value }}
                  </button>
                  <button type="button" class="lifecycle-spine-remove" :aria-label="`Remove exception ${stage.label} ${row.exception.value}`" @click="removeException(row.exception)">×</button>
                </div>
              </template>
              <button
                v-if="!(adding?.kind === 'exception' && adding.stage === stage.recordType)"
                type="button"
                class="lifecycle-spine-ghost"
                aria-label="Add exception"
                :data-testid="`lifecycle-settings-add-exception-${stage.recordType}`"
                @click="startAdding({ kind: 'exception', stage: stage.recordType })"
              >
                + not expected for
              </button>
              <!-- Where records stop at this stage, and whether each place's records are findings. Hidden while the
                   order is being changed: the places follow the order once it is saved. -->
              <template v-if="!orderChanged">
                <div
                  v-for="place in placesAt(stage.label)"
                  :key="place.key"
                  class="lifecycle-spine-phrase"
                  :data-testid="`lifecycle-settings-place-${place.key}`"
                >
                  <span><span class="lifecycle-spine-quiet">stops at</span> {{ place.label }}</span>
                  <button
                    type="button"
                    class="lifecycle-spine-finding"
                    :class="{ 'lifecycle-spine-finding--off': keptNotFinding.includes(place.key) }"
                    :aria-pressed="keptNotFinding.includes(place.key) ? 'false' : 'true'"
                    :aria-label="`${place.label} is a finding`"
                    :data-testid="`lifecycle-settings-finding-${place.key}`"
                    @click="toggleFinding(place.key)"
                  >
                    {{ keptNotFinding.includes(place.key) ? 'not a finding' : 'finding' }}
                  </button>
                </div>
              </template>
              <!-- Findings written for this stage: records that reached it and whose field matches. -->
              <div
                v-for="(finding, index) in findingsFor(stage.recordType)"
                :key="`${finding.fieldId}=${finding.op}=${finding.value}`"
                class="lifecycle-spine-phrase"
                :data-testid="`lifecycle-settings-written-${stage.recordType}-${index}`"
              >
                <span><span class="lifecycle-spine-quiet">finding when</span> {{ finding.fieldLabel }} <span class="lifecycle-spine-quiet">{{ finding.op === 'GT' ? 'more than' : 'is' }}</span> {{ finding.valueLabel }}</span>
                <button type="button" class="lifecycle-spine-remove" :aria-label="`Remove finding ${finding.fieldLabel} ${finding.valueLabel}`" @click="removeWritten(finding)">×</button>
              </div>
              <div v-if="adding?.kind === 'finding' && adding.stage === stage.recordType" class="lifecycle-spine-editing" :data-testid="`lifecycle-settings-adding-finding-${stage.recordType}`">
                <span class="lifecycle-spine-quiet">finding when</span>
                <AppSelect
                  :model-value="fdField"
                  :options="fdFieldOptions"
                  :disabled="findingRules.loadingFields.value"
                  :placeholder="findingRules.loadingFields.value ? 'Loading...' : 'field'"
                  searchable
                  test-id="lifecycle-settings-finding-field"
                  @update:model-value="chooseFdField"
                />
                <span v-if="fdField && !fdIsNumber" class="lifecycle-spine-quiet">is</span>
                <AppSelect
                  v-model="fdValue"
                  :options="fdValueOptions"
                  :disabled="!fdField || findingRules.loadingValuesFor.value === fdField"
                  :placeholder="findingRules.loadingValuesFor.value === fdField ? 'Loading...' : 'value'"
                  searchable
                  test-id="lifecycle-settings-finding-value"
                />
                <button type="button" class="wizard-secondary-link" aria-label="Add this finding" :disabled="!fdField || !fdValue" data-testid="lifecycle-settings-add-written" @click="addWritten(stage)">Add</button>
                <button type="button" class="lifecycle-spine-remove lifecycle-spine-remove--shown" aria-label="Stop editing" @click="adding = null">×</button>
              </div>
              <button
                v-else
                type="button"
                class="lifecycle-spine-ghost"
                aria-label="Add finding"
                :data-testid="`lifecycle-settings-add-finding-${stage.recordType}`"
                @click="startAdding({ kind: 'finding', stage: stage.recordType })"
              >
                + finding
              </button>
            </div>
          </div>
        </div>
      </div>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSelect from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { reconciliationFacade } from '../../lib/api/facade'
import type { FlowchartQuestion, LifecycleFinding, LifecycleRule, LifecycleStageException } from '../../lib/api/flowchartTypes'
import { lifecycleBoard, notFindingPlacesOf } from '../../lib/lifecycleBoard'
import { accountLabelOf } from '../../lib/nsAccountLabel'
import { lifecycleChart } from '../../lib/api/queries'
import { readQueryOnce } from '../../lib/api/readCache'
import { useLifecycleRuleOptions, type LifecycleRuleSource } from '../../lib/useLifecycleRuleOptions'

// DAR-UI-050. A lifecycle's settings as one line that grows downward (research: funnel builders put an exclusion
// between the two steps it affects; progressive disclosure shows only the next action). The starting records, with
// what is left out under them and when a record is judged; then each stage, with what it is not expected of on the
// lines under it. Position is the order (a stage moves with ↑ ↓); add-actions appear on approach.
// Rules are set up here and in the create flow, never on the run page, which shows results.
// What is open for editing: a new filter or exception, or an existing one (by its place among the filters, or itself).
type Adding = { kind: 'filter'; index?: number } | { kind: 'exception'; stage: string; editing?: LifecycleStageException } | { kind: 'detail' }
  | { kind: 'finding'; stage: string }

const LATE_DAYS = [0, 1, 2, 3, 5, 7, 14, 30]
const route = useRoute()
const router = useRouter()
const reconciliationId = computed(() => String(route.params.reconciliationId ?? ''))
const rules = useLifecycleRuleOptions()
const stageRules = useLifecycleRuleOptions('STAGE')
const source = ref<(LifecycleRuleSource & { recordLabel: string }) | null>(null)
const stages = ref<{ recordType: string; label: string }[]>([])
const original = ref<LifecycleRule[]>([])
const kept = ref<LifecycleRule[]>([])
const originalExceptions = ref<LifecycleStageException[]>([])
const keptExceptions = ref<LifecycleStageException[]>([])
const adding = ref<Adding | null>(null)
const newField = ref('')
const newValue = ref('')
const exField = ref('')
const exValue = ref('')
const newDetail = ref('')
// The custom fields each record shows, in order (beside the standard columns every record has).
const originalDetails = ref<string[]>([])
const keptDetails = ref<{ fieldId: string; label: string }[]>([])
const lateAfter = ref('0')
const originalLate = ref('0')
const saving = ref(false)
const error = ref<string | null>(null)

const dayWord = (d: number) => (d === 0 ? 'the same day' : d === 1 ? '1 day' : `${d} days`)
const recordWord = computed(() => source.value?.recordLabel ?? 'Records')
const lateOptions = LATE_DAYS.map((d) => ({ value: String(d), label: dayWord(d) }))
const fieldOptions = computed(() => rules.fields.value.map((f) => ({ value: f.fieldId, label: f.label })))
const detailOptions = computed(() => fieldOptions.value.filter((o) => !keptDetails.value.some((d) => d.fieldId === o.value)))
// A value being changed stays offered even when the account no longer shows it (values are read over 30 days).
function withCurrent(options: { value: string; label: string }[], value: string, label: string | undefined) {
  return value && !options.some((o) => o.value === value) ? [{ value, label: label || value }, ...options] : options
}
const editedRule = computed(() => (adding.value?.kind === 'filter' && adding.value.index !== undefined ? kept.value[adding.value.index] : undefined))
const newValueOptions = computed(() => withCurrent((rules.values[newField.value] ?? []).map((v) => ({ value: v.value, label: v.label })),
  editedRule.value?.fieldId === newField.value ? editedRule.value.value : '', editedRule.value?.valueLabel))
const exFieldOptions = computed(() => stageRules.fields.value.map((f) => ({ value: f.fieldId, label: f.label })))
const editedException = computed(() => (adding.value?.kind === 'exception' ? adding.value.editing : undefined))
const exValueOptions = computed(() => withCurrent((stageRules.values[exField.value] ?? []).map((v) => ({ value: v.value, label: v.label })),
  editedException.value?.fieldId === exField.value ? editedException.value.value : '', editedException.value?.value))
const exceptionsFor = (stage: string) => keptExceptions.value.filter((e) => e.stageRecordType === stage)

// The lines of the spine, each either read or being changed; a new one being added comes last.
const filterRows = computed(() => {
  const open = adding.value?.kind === 'filter' ? adding.value : null
  const rows: { key: string; index: number; rule?: LifecycleRule; editing: boolean }[] = kept.value.map((rule, index) =>
    ({ key: `${rule.fieldId}=${rule.value}`, index, rule, editing: open?.index === index }))
  if (open && open.index === undefined) rows.push({ key: 'new', index: rows.length, editing: true })
  return rows
})
function exceptionRows(stage: string) {
  const open = adding.value?.kind === 'exception' && adding.value.stage === stage ? adding.value : null
  const rows: { key: string; index: number; exception?: LifecycleStageException; editing: boolean }[] = exceptionsFor(stage).map((exception, index) =>
    ({ key: `${exception.fieldId}=${exception.value}`, index, exception, editing: Boolean(open?.editing && sameException(open.editing, exception)) }))
  if (open && !open.editing) rows.push({ key: 'new', index: rows.length, editing: true })
  return rows
}

const originalOrder = ref<string[]>([])
// The account by its description, as the create flow names it.
const accountLabel = ref('')
const orderChanged = computed(() => stages.value.map((st) => st.recordType).join() !== originalOrder.value.join())

// Which places' records are findings. Every place is one unless the lifecycle says not; the places are the ones its
// questions end in, named in the exceptions' words as the board names them.
const questions = ref<FlowchartQuestion[]>([])
const originalNotFinding = ref<string[]>([])
const keptNotFinding = ref<string[]>([])
const placesByStage = computed(() => {
  const byStage: Record<string, string[]> = {}
  for (const e of keptExceptions.value) (byStage[e.stageLabel] ??= []).push(e.value)
  const names = Object.fromEntries(Object.entries(byStage).map(([stage, values]) => [stage, values.join(' or ')]))
  return lifecycleBoard(questions.value, [], names).stages
})
// Written findings have their own lines; the places listed are where records stop.
const placesAt = (stageLabel: string) => (placesByStage.value.find((st) => st.label === stageLabel)?.places ?? []).filter((p) => p.kind !== 'check')

// Findings people write for a stage: a field and a value ("is"), or a number the field is more than.
const findingRules = useLifecycleRuleOptions('FINDING')
const originalWritten = ref<LifecycleFinding[]>([])
const keptWritten = ref<LifecycleFinding[]>([])
const fdField = ref('')
const fdValue = ref('')
const fdIsNumber = computed(() => findingRules.fields.value.find((f) => f.fieldId === fdField.value)?.kind === 'number')
const fdFieldOptions = computed(() => findingRules.fields.value.map((f) => ({ value: f.fieldId, label: f.label })))
const fdValueOptions = computed(() => (findingRules.values[fdField.value] ?? []).map((v) => ({ value: v.value, label: v.label })))
const sameWritten = (a: LifecycleFinding, b: LifecycleFinding) =>
  a.stageRecordType === b.stageRecordType && a.fieldId === b.fieldId && a.op === b.op && a.value === b.value
const findingsFor = (stage: string) => keptWritten.value.filter((f) => f.stageRecordType === stage)
function chooseFdField(fieldId: string) {
  fdField.value = fieldId
  fdValue.value = ''
  if (source.value) void findingRules.loadValues(source.value, fieldId)
}
function addWritten(stage: { recordType: string; label: string }) {
  const number = fdIsNumber.value
  const finding: LifecycleFinding = { stageRecordType: stage.recordType, fieldId: fdField.value, fieldLabel: findingRules.fieldLabel(fdField.value),
    op: number ? 'GT' : 'IN', value: fdValue.value, valueLabel: number ? fdValue.value : findingRules.valueLabel(fdField.value, fdValue.value) }
  if (!keptWritten.value.some((f) => sameWritten(f, finding))) keptWritten.value.push(finding)
  adding.value = null
}
function removeWritten(finding: LifecycleFinding) {
  keptWritten.value = keptWritten.value.filter((f) => !sameWritten(f, finding))
}
function toggleFinding(key: string) {
  keptNotFinding.value = keptNotFinding.value.includes(key) ? keptNotFinding.value.filter((k) => k !== key) : [...keptNotFinding.value, key]
}

// A stage moves up or down; its exceptions move with it (they are kept by stage, not by place).
function moveStage(index: number, by: -1 | 1) {
  const next = [...stages.value]
  const [moved] = next.splice(index, 1)
  next.splice(index + by, 0, moved!)
  stages.value = next
}

function startAdding(next: Adding) {
  adding.value = next
  newField.value = newValue.value = exField.value = exValue.value = newDetail.value = fdField.value = fdValue.value = ''
}

function addDetail() {
  if (newDetail.value && !keptDetails.value.some((d) => d.fieldId === newDetail.value)) {
    keptDetails.value.push({ fieldId: newDetail.value, label: rules.fieldLabel(newDetail.value) })
  }
  adding.value = null
}

// Changing a line opens it with what it says, and its field's values loading.
function editRule(index: number) {
  const rule = kept.value[index]
  if (!rule) return
  startAdding({ kind: 'filter', index })
  newField.value = rule.fieldId
  newValue.value = rule.value
  if (source.value) void rules.loadValues(source.value, rule.fieldId)
}

function editException(exception: LifecycleStageException) {
  startAdding({ kind: 'exception', stage: exception.stageRecordType, editing: exception })
  exField.value = exception.fieldId
  exValue.value = exception.value
  if (source.value) void stageRules.loadValues(source.value, exception.fieldId)
}

function removeRule(index: number) {
  kept.value.splice(index, 1)
  adding.value = null
}

function chooseField(fieldId: string) {
  newField.value = fieldId
  newValue.value = ''
  if (source.value) void rules.loadValues(source.value, fieldId)
}

function chooseExField(fieldId: string) {
  exField.value = fieldId
  exValue.value = ''
  if (source.value) void stageRules.loadValues(source.value, fieldId)
}

function addRule() {
  const open = adding.value?.kind === 'filter' ? adding.value : null
  const was = open?.index !== undefined ? kept.value[open.index] : undefined
  const rule = { fieldId: newField.value, fieldLabel: rules.fieldLabel(newField.value) || was?.fieldLabel || newField.value, value: newValue.value,
    valueLabel: rules.valueLabel(newField.value, newValue.value) || (was && same(was, { fieldId: newField.value, value: newValue.value }) ? was.valueLabel : newValue.value) }
  // A change replaces its line; one that now says what another line says folds into it.
  const others = kept.value.filter((_, i) => i !== open?.index)
  if (was && open?.index !== undefined) kept.value = others.some((r) => same(r, rule)) ? others : kept.value.map((r, i) => (i === open.index ? rule : r))
  else if (!kept.value.some((r) => same(r, rule))) kept.value.push(rule)
  adding.value = null
}

function addException(stage: { recordType: string; label: string }) {
  const was = adding.value?.kind === 'exception' ? adding.value.editing : undefined
  const exception = { stageRecordType: stage.recordType, stageLabel: stage.label, fieldId: exField.value,
    fieldLabel: stageRules.fieldLabel(exField.value) || was?.fieldLabel || exField.value, value: exValue.value }
  const others = was ? keptExceptions.value.filter((e) => !sameException(e, was)) : keptExceptions.value
  if (was && !others.some((e) => sameException(e, exception))) {
    keptExceptions.value = keptExceptions.value.map((e) => (sameException(e, was) ? exception : e))
  } else if (was) {
    keptExceptions.value = others
  } else if (!keptExceptions.value.some((e) => sameException(e, exception))) {
    keptExceptions.value.push(exception)
  }
  adding.value = null
}

function removeException(exception: LifecycleStageException) {
  keptExceptions.value = keptExceptions.value.filter((e) => !sameException(e, exception))
  adding.value = null
}

function back() { void router.push({ name: 'reconciliation-run-flowchart', params: { reconciliationId: reconciliationId.value } }) }
function message(caught: unknown) { return caught instanceof Error ? caught.message : String(caught) }
const same = (a: { fieldId: string; value: string }, b: { fieldId: string; value: string }) => a.fieldId === b.fieldId && a.value === b.value
const sameException = (a: LifecycleStageException, b: LifecycleStageException) =>
  a.stageRecordType === b.stageRecordType && a.fieldId === b.fieldId && a.value === b.value

async function save() {
  saving.value = true
  error.value = null
  try {
    const id = reconciliationId.value
    // The order first: it rebuilds the stages' checks, and the exception changes below land on the new ones.
    const order = stages.value.map((st) => st.recordType)
    if (order.join() !== originalOrder.value.join()) {
      await reconciliationFacade.saveLifecycleStages({ reconciliationId: id, stageRecordTypes: order })
    }
    for (const gone of original.value.filter((o) => !kept.value.some((r) => same(r, o)))) {
      await reconciliationFacade.deleteLifecycleRule({ reconciliationId: id, fieldId: gone.fieldId, value: gone.value })
    }
    for (const added of kept.value.filter((r) => !original.value.some((o) => same(r, o)))) {
      await reconciliationFacade.saveLifecycleRule({ reconciliationId: id, fieldId: added.fieldId, fieldLabel: added.fieldLabel || added.fieldId, value: added.value })
    }
    for (const gone of originalExceptions.value.filter((o) => !keptExceptions.value.some((k) => sameException(k, o)))) {
      await reconciliationFacade.deleteLifecycleStageException({ reconciliationId: id, stageRecordType: gone.stageRecordType, fieldId: gone.fieldId, value: gone.value })
    }
    for (const added of keptExceptions.value.filter((k) => !originalExceptions.value.some((o) => sameException(k, o)))) {
      await reconciliationFacade.saveLifecycleStageException({ reconciliationId: id, stageRecordType: added.stageRecordType,
        fieldId: added.fieldId, fieldLabel: added.fieldLabel, value: added.value })
    }
    for (const gone of originalWritten.value.filter((o) => !keptWritten.value.some((k) => sameWritten(k, o)))) {
      if (gone.reconciliationRunId) await reconciliationFacade.deleteLifecycleFinding({ reconciliationId: id, reconciliationRunId: gone.reconciliationRunId })
    }
    for (const added of keptWritten.value.filter((k) => !originalWritten.value.some((o) => sameWritten(k, o)))) {
      await reconciliationFacade.saveLifecycleFinding({ reconciliationId: id, stageRecordType: added.stageRecordType, fieldId: added.fieldId,
        fieldLabel: added.fieldLabel, op: added.op, value: added.value, valueLabel: added.valueLabel })
    }
    if (keptDetails.value.map((d) => d.fieldId).join() !== originalDetails.value.join()) {
      await reconciliationFacade.saveLifecycleDetails({ reconciliationId: id, details: keptDetails.value })
    }
    const findingsChanged = [...keptNotFinding.value].sort().join('|') !== [...originalNotFinding.value].sort().join('|')
    if (lateAfter.value !== originalLate.value || findingsChanged) {
      await reconciliationFacade.saveReconciliation({ reconciliationId: id,
        ...(lateAfter.value !== originalLate.value ? { lateAfterDays: Number(lateAfter.value) } : {}),
        ...(findingsChanged ? { notFindingPlaces: keptNotFinding.value } : {}) })
    }
    back()
  } catch (caught) {
    error.value = message(caught)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  // DAR-UI-051: one answer, never two — it seeds the edits this page saves, so a second landing late would undo
  // them. The lifecycle page, or a hover on the link here, will usually have read it moments ago.
  try {
    const { got, accountLabels } = await readQueryOnce(lifecycleChart(reconciliationId.value))
    lateAfter.value = originalLate.value = String(got.reconciliation?.lateAfterDays ?? 0)
    original.value = got.rules ?? []
    kept.value = [...original.value]
    stages.value = got.stages ?? []
    originalOrder.value = stages.value.map((st) => st.recordType)
    questions.value = got.questions ?? []
    originalWritten.value = got.findings ?? []
    keptWritten.value = [...originalWritten.value]
    originalNotFinding.value = notFindingPlacesOf(got.reconciliation?.notFindingPlaces)
    keptNotFinding.value = [...originalNotFinding.value]
    originalExceptions.value = got.exceptions ?? []
    keptExceptions.value = [...originalExceptions.value]
    originalDetails.value = (got.details ?? []).map((d) => d.fieldId)
    keptDetails.value = originalDetails.value.map((fieldId) => ({ fieldId, label: fieldId }))
    if (got.lifecycle) {
      source.value = got.lifecycle
      accountLabel.value = accountLabelOf(accountLabels, got.lifecycle.nsAuthConfigId)
      await Promise.all([rules.loadFields(got.lifecycle), stageRules.loadFields(got.lifecycle), findingRules.loadFields(got.lifecycle)])
      // Named as the account names them, once its fields are read.
      keptDetails.value = keptDetails.value.map((d) => ({ ...d, label: rules.fieldLabel(d.fieldId) }))
    }
  } catch (caught) {
    error.value = message(caught)
  }
})
</script>

<style scoped>
/* The spine: a dot per node, one rule line between them, phrases in the gaps. Monochrome, borders only. */
.lifecycle-spine-layout { width: 100%; }
.lifecycle-spine { display: flex; flex-direction: column; min-width: 0; }
.lifecycle-spine-node {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding-left: var(--space-4);
}
.lifecycle-spine-node::before {
  content: "";
  position: absolute;
  left: 0.2rem;
  top: 0.45rem;
  width: 0.7rem;
  height: 0.7rem;
  border: 1.5px solid var(--text);
  border-radius: var(--radius-pill);
  background: var(--surface);
}
.lifecycle-spine-node--start::before { background: var(--text); }
.lifecycle-spine-name { font-size: var(--type-tile-size); color: var(--text); }
.lifecycle-spine-quiet { color: var(--text-dim); }
.lifecycle-spine-gap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-1-5) 0 var(--space-2) var(--space-4);
}
.lifecycle-spine-gap::before {
  content: "";
  position: absolute;
  left: 0.55rem;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--border);
}
/* A rule reads as one line of text; only a row with controls lays out as a row. */
.lifecycle-spine-phrase {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  color: var(--text-soft);
  font-size: var(--type-muted-size);
  line-height: 1.6;
}
/* A saved line is its own edit control: it reads as text and opens as its editing row. */
.lifecycle-spine-line {
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: left;
  cursor: pointer;
}
.lifecycle-spine-line:hover,
.lifecycle-spine-line:focus-visible { text-decoration: underline; text-underline-offset: 3px; }
/* A place's finding switch: a quiet word, "finding" in text colour, "not a finding" dimmed. */
.lifecycle-spine-finding {
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.lifecycle-spine-finding--off { color: var(--text-dim); }
.lifecycle-spine-finding:hover,
.lifecycle-spine-finding:focus-visible { text-decoration: underline; text-underline-offset: 3px; }
.lifecycle-spine-editing {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-1-5);
  color: var(--text-soft);
  font-size: var(--type-muted-size);
}
.lifecycle-spine-editing > .app-select { width: auto; min-width: 9rem; max-width: 16rem; flex: 0 1 auto; }
/* The trigger is narrow on this line, so its menu sizes to its options (to a cap), one line each: a field name that
   wrapped inside a trigger-wide menu ran into the next one. */
.lifecycle-spine-editing > .app-select :deep(.app-select-menu) { right: auto; min-width: 100%; width: max-content; max-width: 22rem; }
.lifecycle-spine-editing > .app-select :deep(.app-select-option) {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.lifecycle-spine-remove {
  min-height: 0;
  margin-left: var(--space-1);
  padding: 0 var(--space-0);
  border: 0;
  background: transparent;
  color: var(--text-dim);
  opacity: 0;
  transition: opacity 160ms ease;
}
.lifecycle-spine-ghost {
  align-self: flex-start;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-dim);
  font-size: var(--type-muted-size);
  line-height: 1.6;
  opacity: 0;
  transition: opacity 160ms ease;
}
/* Progressive disclosure: a part's next action shows when you approach it, and always where hover does not exist. */
.lifecycle-spine-group:hover .lifecycle-spine-ghost,
.lifecycle-spine-group:focus-within .lifecycle-spine-ghost,
.lifecycle-spine-phrase:hover .lifecycle-spine-remove,
.lifecycle-spine-phrase:focus-within .lifecycle-spine-remove,
.lifecycle-spine-remove--shown { opacity: 1; }
.lifecycle-spine-ghost:hover { color: var(--text); }
@media (hover: none) {
  .lifecycle-spine-ghost,
  .lifecycle-spine-remove { opacity: 0.75; }
}
/* A stage's own controls (move up / down) show as you approach it, like the rest. */
.lifecycle-spine-group:hover .lifecycle-spine-node .lifecycle-spine-remove,
.lifecycle-spine-node:focus-within .lifecycle-spine-remove { opacity: 1; }
.lifecycle-spine-remove:disabled { visibility: hidden; }
/* The last stage's lines hang under it without a rule line running past the end. */
.lifecycle-spine-group:last-child .lifecycle-spine-gap::before { display: none; }
@media (prefers-reduced-motion: reduce) {
  .lifecycle-spine-ghost,
  .lifecycle-spine-remove { transition: none; }
}
</style>
