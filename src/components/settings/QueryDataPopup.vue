<template>
  <div
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="query-data-title"
    data-testid="query-data-popup"
    @click.self="emit('cancel')"
  >
    <section class="popup-workflow-modal workflow-panel query-data-popup">
      <header class="workflow-panel-header">
        <h2 id="query-data-title" v-explain="'queryData'">Data</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="What should this query read?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="query-data-save"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="query-data-cancel"
          @cancel="emit('cancel')"
          @submit="save"
        >
          <InlineValidation v-if="catalogError" tone="error" :message="catalogError" data-testid="query-data-catalog-error" />

          <WorkflowShortcutChoiceCards
            :options="KIND_OPTIONS"
            :selected-value="kind"
            test-id-prefix="query-data-kind"
            @choose="chooseKind"
          />

          <div class="query-data-pair">
            <label class="wizard-input-shell">
              <span class="workflow-context-label">{{ SOURCE_LABEL[kind] }}</span>
              <AppSelect
                :model-value="sourceId"
                :options="sourceOptions"
                :placeholder="`Pick ${SOURCE_PICK[kind]}`"
                searchable
                :search-placeholder="`Find ${SOURCE_PICK[kind]}`"
                test-id="query-data-source"
                @update:model-value="chooseSource"
              />
            </label>
            <label v-if="windowField" class="wizard-input-shell">
              <span v-explain="'queryDataWindow'" class="workflow-context-label">{{ windowLabel }} · last days</span>
              <input
                v-model="lastDays"
                class="wizard-answer-control"
                type="number"
                inputmode="numeric"
                min="1"
                :max="MAX_LAST_DAYS"
                placeholder="Any time"
                data-testid="query-data-window"
              >
            </label>
          </div>

          <div class="query-data-block">
            <span v-explain="'queryDataOnly'" class="workflow-context-label">Only</span>
            <div v-for="row in rows" :key="row.key" class="query-data-condition" data-testid="query-data-condition">
              <AppSelect
                v-model="row.field"
                :options="fieldOptions"
                placeholder="Field"
                searchable
                search-placeholder="Find a field"
                test-id="query-data-condition-field"
              />
              <AppSelect v-model="row.op" :options="OP_OPTIONS" test-id="query-data-condition-op" />
              <input
                v-if="!NO_VALUE_OPS.has(row.op)"
                v-model="row.text"
                class="wizard-answer-control"
                type="text"
                :placeholder="valuePlaceholder(row.op)"
                aria-label="Value"
                data-testid="query-data-condition-value"
              >
              <span v-else aria-hidden="true"></span>
              <button
                type="button"
                class="app-icon-action"
                aria-label="Remove condition"
                title="Remove condition"
                data-testid="query-data-condition-remove"
                @click="removeCondition(row.key)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="app-icon-action query-data-add"
              aria-label="Add a condition"
              title="Add a condition"
              data-testid="query-data-condition-add"
              @click="addCondition"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="plusIconPath" fill="currentColor" />
              </svg>
            </button>
          </div>

          <div v-if="kind === 'auditFindings'" class="query-data-toggle">
            <AppToggleSwitch v-model="includeClosed" label="Closed findings too" test-id="query-data-include-closed" />
            <span>Closed findings too</span>
          </div>

          <div class="query-data-block">
            <span v-explain="'queryDataKeep'" class="workflow-context-label">Keep</span>
            <div v-if="toggleFields.length" class="workflow-select-chip-row query-data-keep">
              <button
                v-for="field in toggleFields"
                :key="field"
                type="button"
                class="workflow-select-chip query-data-keep__chip"
                :class="{ 'query-data-keep__chip--on': fields.includes(field) }"
                :aria-pressed="fields.includes(field) ? 'true' : 'false'"
                data-testid="query-data-keep"
                @click="toggleField(field)"
              >
                {{ field }}
              </button>
            </div>
            <WorkflowChipTextInput
              v-if="typedFields"
              ref="fieldInput"
              v-model="extraFields"
              placeholder="Another field, Enter adds it"
              :accept="isFieldName"
              data-testid="query-data-keep-typed"
              @reject="rejectField"
            />
          </div>

          <label class="wizard-input-shell query-data-name">
            <span v-explain="'queryDataName'" class="workflow-context-label">The script calls it</span>
            <span class="query-data-name__row">
              <span class="query-data-name__prefix">input.</span>
              <input
                v-model="name"
                class="wizard-answer-control"
                type="text"
                spellcheck="false"
                autocomplete="off"
                aria-label="Input name"
                data-testid="query-data-name"
                @input="nameTouched = true"
              >
            </span>
          </label>

          <InlineValidation v-if="error" tone="error" :message="error" data-testid="query-data-error" />
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// DAR-UI-138. One input of a query's read, picked by name: what it reads (an audit's findings, a saved run's newest
// result, a dataset's kept records), which one, only the rows that meet some conditions, a window of the last N days,
// the fields to keep, and the name the script calls it. Saving hands the input back with every key it does not touch
// as it was; the page writes it into the read JSON. Inputs with or-conditions, groups, measures or an order are not
// opened here (queryRead.editLimits): the page sends those to the JSON.
import { computed, ref } from 'vue'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import AppToggleSwitch from '../ui/AppToggleSwitch.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowChipTextInput from '../workflow/WorkflowChipTextInput.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import { plusIconPath, trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import { vExplain } from '../../directives/vExplain'
import {
  CONDITION_OPS,
  FIELD_NAME,
  INPUT_NAME,
  LIST_VALUE_OPS,
  MAX_LAST_DAYS,
  NO_VALUE_OPS,
  SOURCE_ID_KEY,
  catalogFields,
  conditionsOf,
  freshName,
  inputFields,
  inputName,
  inputSourceId,
  isSourceKind,
  valueFrom,
  valueText,
  whereFrom,
  windowDays,
  windowFieldFor,
  type QueryCatalog,
  type ReadCondition,
  type ReadInput,
  type ReadSourceKind,
} from '../../lib/queryRead'

interface ConditionRow {
  key: number
  field: string
  op: string
  text: string
  /** The condition as it was read, kept when the row is left as it was (its value's type, its other keys). */
  original: ReadCondition | null
}

const props = withDefaults(defineProps<{
  /** The input to change; null adds one. */
  input: ReadInput | null
  catalog: QueryCatalog | null
  /** Set when the catalog could not be read: sources then show as ids and fields are typed. */
  catalogError?: string
  /** The other inputs' names: a name must differ from them. */
  takenNames?: string[]
}>(), {
  catalogError: '',
  takenNames: () => [],
})

const emit = defineEmits<{
  save: [input: ReadInput]
  cancel: []
}>()

const KIND_OPTIONS: WorkflowShortcutChoiceOption[] = [
  { value: 'auditFindings', label: 'Audit findings', shortcutKey: 'A', description: 'What an audit found, one row per finding' },
  { value: 'runResult', label: "A run's result", shortcutKey: 'B', description: 'The newest differences of a saved run' },
  { value: 'dataset', label: 'Kept records', shortcutKey: 'C', description: "A system's records an audit keeps" },
]
const SOURCE_LABEL: Record<ReadSourceKind, string> = { auditFindings: 'Audit', runResult: 'Saved run', dataset: 'Dataset' }
const SOURCE_PICK: Record<ReadSourceKind, string> = { auditFindings: 'an audit', runResult: 'a saved run', dataset: 'a dataset' }
const DEFAULT_NAME: Record<ReadSourceKind, string> = { auditFindings: 'findings', runResult: 'differences', dataset: 'records' }
const DEFAULT_FINDING_FIELDS = ['recordKey', 'headline', 'firstFoundDate']
const OP_OPTIONS: AppSelectOption[] = CONDITION_OPS.map((item) => ({ value: item.op, label: item.words }))

const start = props.input
const startKind: ReadSourceKind = start && isSourceKind(start.source) ? start.source : 'auditFindings'
let nextKey = 0

const kind = ref<ReadSourceKind>(startKind)
const sourceId = ref(start ? inputSourceId(start) : '')
const includeClosed = ref(Boolean(start?.includeClosed))
const rows = ref<ConditionRow[]>((start ? conditionsOf(start) ?? [] : []).map(toRow))
const lastDays = ref(start ? String(windowDays(start) ?? '') : '')
const fields = ref<string[]>(start ? inputFields(start) : [])
const name = ref(start ? inputName(start) : freshName(DEFAULT_NAME[startKind], props.takenNames))
const nameTouched = ref(Boolean(start))
const error = ref('')
const fieldInput = ref<InstanceType<typeof WorkflowChipTextInput> | null>(null)

function toRow(condition: ReadCondition): ConditionRow {
  nextKey += 1
  return { key: nextKey, field: String(condition.field ?? ''), op: String(condition.op ?? 'equals'),
    text: valueText(condition.value), original: condition }
}

const sourceOptions = computed<AppSelectOption[]>(() => {
  const catalog = props.catalog
  let options: AppSelectOption[] = []
  if (kind.value === 'auditFindings') {
    options = (catalog?.audits ?? []).map((audit) => ({
      value: audit.auditId,
      label: audit.auditName ? [audit.auditName, audit.auditCode].filter(Boolean).join(' · ') : audit.auditCode || audit.auditId,
    }))
  } else if (kind.value === 'runResult') {
    options = (catalog?.savedRuns ?? []).map((run) => ({ value: run.savedRunId, label: run.runName || run.savedRunId }))
  } else {
    options = (catalog?.datasets ?? []).map((dataset) => ({
      value: dataset.datasetId,
      label: `${dataset.system} ${dataset.datasetId}${dataset.recordCount != null ? ` · ${dataset.recordCount.toLocaleString()} records` : ''}`,
    }))
  }
  // The input's own source stays choosable even when the catalog does not list it (or could not be read).
  if (sourceId.value && !options.some((option) => option.value === sourceId.value)) {
    options = [{ value: sourceId.value, label: sourceId.value }, ...options]
  }
  return options
})

const windowField = computed(() => windowFieldFor(kind.value, sourceId.value, props.catalog))
const windowLabel = computed(() => (kind.value === 'auditFindings' ? 'First found' : windowField.value ?? ''))

/** The source's listed fields, or null when it lists none (a run's flat record fields, a dataset kept whole). */
const listedFields = computed(() => catalogFields(kind.value, sourceId.value, props.catalog))
/** Fields are typed when the list is open-ended: a run's result, a dataset kept whole, a source the catalog lacks. */
const typedFields = computed(() => kind.value === 'runResult' || listedFields.value == null)
/** On/off chips: the listed fields, plus kept ones the list no longer has (so they can be turned off). */
const toggleFields = computed(() => {
  const listed = listedFields.value ?? []
  const stray = typedFields.value ? [] : fields.value.filter((field) => !listed.includes(field))
  return [...listed, ...stray]
})
const extraFields = computed<string[]>({
  get: () => fields.value.filter((field) => !toggleFields.value.includes(field)),
  set: (typed) => {
    fields.value = [...fields.value.filter((field) => toggleFields.value.includes(field)), ...typed]
  },
})
const fieldOptions = computed<AppSelectOption[]>(() => {
  const names = new Set([...(listedFields.value ?? []), ...fields.value, ...rows.value.map((row) => row.field)].filter(Boolean))
  return [...names].map((field) => ({ value: field, label: field }))
})

function defaultFields(nextKind: ReadSourceKind, id: string): string[] {
  const listed = catalogFields(nextKind, id, props.catalog)
  if (nextKind === 'auditFindings') return DEFAULT_FINDING_FIELDS.filter((field) => !listed || listed.includes(field))
  if (nextKind === 'runResult') return listed ?? ['bucket', 'key']
  if (listed) return [...listed]
  const dataset = props.catalog?.datasets.find((item) => item.datasetId === id)
  return dataset?.idField ? [dataset.idField] : []
}

function chooseKind(value: string): void {
  if (!isSourceKind(value) || value === kind.value) return
  kind.value = value
  sourceId.value = ''
  error.value = ''
  // A source of another kind has other fields: start its conditions and fields afresh; a lone choice is taken.
  const only = sourceOptions.value.length === 1 ? sourceOptions.value[0]?.value ?? '' : ''
  sourceId.value = only
  rows.value = []
  lastDays.value = ''
  includeClosed.value = false
  fields.value = defaultFields(value, only)
  if (!nameTouched.value) name.value = freshName(DEFAULT_NAME[value], props.takenNames)
}

function chooseSource(id: string): void {
  if (id === sourceId.value) return
  sourceId.value = id
  error.value = ''
  // Every audit's findings and every run's result have the same fields; a dataset keeps its own.
  if (kind.value === 'dataset' || !fields.value.length) fields.value = defaultFields(kind.value, id)
}

function toggleField(field: string): void {
  fields.value = fields.value.includes(field) ? fields.value.filter((item) => item !== field) : [...fields.value, field]
}

function addCondition(): void {
  nextKey += 1
  rows.value = [...rows.value, { key: nextKey, field: '', op: 'equals', text: '', original: null }]
}

function removeCondition(key: number): void {
  rows.value = rows.value.filter((row) => row.key !== key)
}

function isFieldName(value: string): boolean {
  return FIELD_NAME.test(value)
}

function rejectField(value: string): void {
  error.value = `${value} is not a field name.`
}

function valuePlaceholder(op: string): string {
  if (op === 'between') return 'from, to'
  return LIST_VALUE_OPS.has(op) ? 'a, b, c' : 'Value'
}

function conditionOf(row: ConditionRow): ReadCondition {
  const original = row.original
  if (original && original.field === row.field && original.op === row.op && valueText(original.value) === row.text.trim()) {
    return original
  }
  const condition: ReadCondition = { ...(original ?? {}), field: row.field, op: row.op, value: valueFrom(row.text, row.op) }
  if (NO_VALUE_OPS.has(row.op)) delete condition.value
  return condition
}

function problem(): string {
  if (!sourceId.value) return `Pick ${SOURCE_PICK[kind.value]}.`
  for (const row of rows.value) {
    if (!row.field) return 'Pick a field for each condition.'
    if (!FIELD_NAME.test(row.field)) return `${row.field} is not a field name.`
    if (NO_VALUE_OPS.has(row.op)) continue
    const value = valueFrom(row.text, row.op)
    if (row.op === 'between' && (value as string[]).length !== 2) return `${row.field} is between two values: from, to.`
    if (Array.isArray(value) ? !value.length : !value) return `Give ${row.field} a value.`
  }
  const days = lastDays.value === '' ? null : Number(lastDays.value)
  if (windowField.value && days != null && (!Number.isInteger(days) || days < 1 || days > MAX_LAST_DAYS)) {
    return `Last days is a whole number from 1 to ${MAX_LAST_DAYS}.`
  }
  if (!fields.value.length) return 'Keep at least one field.'
  if (!INPUT_NAME.test(name.value)) return 'The name starts with a lower-case letter and has only letters and digits (up to 40).'
  if (props.takenNames.includes(name.value)) return `Another input is already called input.${name.value}.`
  return ''
}

function save(): void {
  // Text typed into the field box but not yet Entered is a field too.
  if (fieldInput.value && !fieldInput.value.commitPendingValue()) return
  error.value = problem()
  if (error.value) return

  const original = props.input
  const out: ReadInput = { ...(original ?? {}) }
  out.name = name.value
  out.source = kind.value
  // Only the other kinds' id keys go; this kind's is set in place, so an unchanged save keeps the key order (and the page clean).
  for (const [other, key] of Object.entries(SOURCE_ID_KEY)) if (other !== kind.value) delete out[key]
  out[SOURCE_ID_KEY[kind.value]] = sourceId.value
  if (kind.value === 'auditFindings' && includeClosed.value) out.includeClosed = true
  else delete out.includeClosed
  out.fields = [...fields.value]

  const where = whereFrom(rows.value.map(conditionOf))
  if (where) out.where = where
  else delete out.where

  const field = windowField.value
  if (field) {
    const before = original?.window
    if (lastDays.value === '') delete out.window
    else out.window = { ...(before && typeof before === 'object' ? before : {}), field, lastDays: Number(lastDays.value) }
  } else if (!original || original.source !== kind.value) {
    // A run's result takes no window; one this page cannot place (a dataset the catalog lacks) is kept as written.
    delete out.window
  }
  emit('save', out)
}
</script>

<style scoped>
.popup-workflow-modal.workflow-panel.query-data-popup {
  width: min(46rem, calc(100vw - 2rem));
  max-width: min(46rem, calc(100vw - 2rem));
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

.query-data-popup :deep(.workflow-shortcut-choice-grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  max-width: none;
}

.query-data-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.query-data-block {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.query-data-condition {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1.2fr) auto;
  align-items: center;
  gap: var(--space-1);
}

.query-data-add {
  justify-self: start;
}

.query-data-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-soft);
}

.query-data-keep {
  margin-top: 0;
}

.query-data-keep__chip {
  cursor: pointer;
  font: inherit;
  font-size: var(--type-meta-size);
  transition: background-color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}

.query-data-keep__chip--on {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-ink);
}

.query-data-keep__chip:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: 2px;
}

.query-data-name__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-0);
  max-width: 20rem;
}

.query-data-name__prefix {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .query-data-popup :deep(.workflow-shortcut-choice-grid),
  .query-data-pair {
    grid-template-columns: minmax(0, 1fr);
  }

  .query-data-condition {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  }

  .query-data-condition > input,
  .query-data-condition > span {
    grid-column: 1 / 3;
  }
}
</style>
