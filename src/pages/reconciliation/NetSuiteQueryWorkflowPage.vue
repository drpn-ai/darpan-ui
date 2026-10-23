<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="SuiteQL query setup progress" center-stage :edit-surface="isEditing">
    <div v-if="errors.length" class="netsuite-query-errors" data-testid="netsuite-query-errors">
      <InlineValidation v-for="message in errors" :key="message" tone="error" :message="message" />
    </div>
    <p v-if="success" class="success-copy">{{ success }}</p>

    <datalist id="netsuite-query-record-types">
      <option v-for="recordType in recordTypeValues" :key="recordType" :value="recordType" />
    </datalist>
    <datalist id="netsuite-query-match-fields">
      <option v-for="field in matchFieldValues" :key="field" :value="field" />
    </datalist>

    <WorkflowStepForm
      :class="[
        'workflow-form--compact',
        {
          'workflow-form--edit-single-page': isEditing,
          'workflow-form--board-stage': isWideStep,
        },
      ]"
      :data-step-id="isEditing ? 'edit' : currentCreateStep.id"
      :question="currentQuestion"
      :primary-label="primaryLabel"
      :primary-action-variant="primaryActionVariant"
      :show-enter-hint="!isEditing"
      :show-back="showBack"
      :show-cancel-action="isEditing && Boolean(returnTo)"
      :cancel-disabled="loading"
      cancel-test-id="cancel-netsuite-query"
      :allow-select-enter="isCreateSelectStep"
      :submit-disabled="submitDisabled"
      :show-primary-action="canEditTenantSettings"
      :primary-test-id="primaryTestId"
      @submit="handlePrimarySubmit"
      @back="goBack"
      @cancel="leave"
    >
      <template v-if="isEditing">
        <div class="workflow-form-grid workflow-form-grid--compact">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Query ID</span>
            <input
              name="nsSuiteQlSourceQueryId"
              :value="form.nsSuiteQlSourceQueryId"
              class="wizard-answer-control"
              type="text"
              disabled
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Account</span>
            <AppSelect
              v-model="form.nsAuthConfigId"
              :options="accountOptions"
              placeholder="Select account"
              test-id="netsuite-query-account"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Active</span>
            <AppSelect v-model="form.isActive" :options="yesNoOptions" test-id="netsuite-query-is-active" />
          </label>
        </div>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Description</span>
          <input name="description" v-model="form.description" class="wizard-answer-control" type="text" />
        </label>

        <div class="workflow-form-grid workflow-form-grid--compact">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Record Type</span>
            <input
              name="recordType"
              v-model="form.recordType"
              class="wizard-answer-control"
              type="text"
              list="netsuite-query-record-types"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Date Column</span>
            <AppSelect v-model="form.dateColumn" :options="dateColumnOptions" test-id="netsuite-query-date-column" />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Records</span>
            <AppSelect v-model="form.queryTemplate" :options="templateOptions" test-id="netsuite-query-template" />
          </label>
        </div>
      </template>

      <template v-else>
        <label v-if="currentCreateStep.id === 'nsAuthConfigId'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.nsAuthConfigId"
            test-id="netsuite-query-account"
            :options="accountOptions"
            placeholder="Select account"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'nsSuiteQlSourceQueryId'" class="wizard-input-shell">
          <input
            name="nsSuiteQlSourceQueryId"
            v-model="form.nsSuiteQlSourceQueryId"
            :class="['wizard-answer-control', { empty: !form.nsSuiteQlSourceQueryId.trim() }]"
            type="text"
            placeholder="NS_WARRANTY_CLAIM"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'description'" class="wizard-input-shell">
          <input
            name="description"
            v-model="form.description"
            class="wizard-answer-control"
            type="text"
            placeholder="Warranty claims"
          />
        </label>

        <div v-else-if="currentCreateStep.id === 'recordType'" class="wizard-input-shell">
          <WorkflowSelect
            :model-value="recordTypeSelectValue"
            test-id="netsuite-query-record-type"
            :options="recordTypeOptions"
            placeholder="Select record type"
            @update:model-value="selectRecordType"
          />
          <p class="wizard-or">Or</p>
          <input
            name="recordTypeOther"
            v-model="otherRecordType"
            class="wizard-answer-control"
            type="text"
            placeholder="Another record type"
          />
        </div>

        <label v-else-if="currentCreateStep.id === 'dateColumn'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.dateColumn"
            test-id="netsuite-query-date-column"
            :options="dateColumnOptions"
            placeholder="Select date column"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'queryTemplate'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.queryTemplate"
            test-id="netsuite-query-template"
            :options="templateOptions"
            placeholder="Select records"
          />
        </label>

        <label v-else-if="currentCreateStep.id === 'joinKeyFieldName'" class="wizard-input-shell">
          <WorkflowSelect
            v-model="form.joinKeyFieldName"
            test-id="netsuite-query-join-key"
            :options="keyFieldOptions"
            placeholder="Select key field"
          />
        </label>
      </template>

      <div v-if="showMatchEditor" class="workflow-context-block">
        <span v-if="isEditing" class="workflow-context-label">Match</span>
        <AppTableFrame :columns="matchRuleColumns" :rows="matchRuleTableRows" row-test-id="netsuite-query-match-row">
          <template #cell-fieldId="{ row }">
            <input v-model="row.fieldId" name="matchFieldId" type="text" list="netsuite-query-match-fields" />
          </template>
          <template #cell-op="{ row, index }">
            <AppSelect
              :model-value="String(row.op ?? '')"
              :options="matchOpOptions"
              test-id="netsuite-query-match-op"
              @update:model-value="setMatchOp(index, $event)"
            />
          </template>
          <template #cell-valuesText="{ row }">
            <input
              v-model="row.valuesText"
              name="matchValues"
              type="text"
              :disabled="row.op === 'NOT_EMPTY'"
            />
          </template>
          <template #cell-actions="{ index }">
            <div class="app-table__control-wrap app-table__control-wrap--end">
              <button
                type="button"
                :class="rowDeleteActionClass"
                aria-label="Remove match rule"
                data-testid="netsuite-query-remove-match-rule"
                @click="removeMatchRule(index)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" fill="currentColor" />
                </svg>
              </button>
            </div>
          </template>
          <template #append-row="{ columnCount }">
            <tr>
              <td :colspan="columnCount" class="app-table__append-cell">
                <div class="app-table__append-action">
                  <button
                    type="button"
                    class="app-table__icon-action"
                    aria-label="Add match rule"
                    data-testid="netsuite-query-add-match-rule"
                    @click="addMatchRule"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path :d="plusIconPath" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </AppTableFrame>
      </div>

      <div v-if="showFieldEditor" class="workflow-context-block">
        <span v-if="isEditing" class="workflow-context-label">Columns</span>
        <AppTableFrame :columns="fieldColumns" :rows="fieldTableRows" row-test-id="netsuite-query-field-row">
          <template #cell-recordFieldName="{ row }">
            <input v-model="row.recordFieldName" name="recordFieldName" type="text" placeholder="returnId" />
          </template>
          <template #cell-sourceColumn="{ row }">
            <input v-model="row.sourceColumn" name="sourceColumn" type="text" placeholder="custbody_hc_return_id" />
          </template>
          <template #cell-actions="{ index }">
            <div class="app-table__control-wrap app-table__control-wrap--end">
              <button
                type="button"
                :class="rowDeleteActionClass"
                aria-label="Remove column"
                data-testid="netsuite-query-remove-field"
                @click="removeField(index)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" fill="currentColor" />
                </svg>
              </button>
            </div>
          </template>
          <template #append-row="{ columnCount }">
            <tr>
              <td :colspan="columnCount" class="app-table__append-cell">
                <div class="app-table__append-action">
                  <button
                    type="button"
                    class="app-table__icon-action"
                    aria-label="Add column"
                    data-testid="netsuite-query-add-field"
                    @click="addField"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path :d="plusIconPath" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </AppTableFrame>
      </div>

      <div v-if="isEditing" class="workflow-form-grid workflow-form-grid--two">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Key Field</span>
          <AppSelect
            v-model="form.joinKeyFieldName"
            :options="keyFieldOptions"
            placeholder="Select key field"
            test-id="netsuite-query-join-key"
          />
        </label>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Origin Field</span>
          <input name="originFieldName" v-model="form.originFieldName" class="wizard-answer-control" type="text" />
        </label>
      </div>

      <div v-if="isEditing || currentCreateStep.id === 'review'" class="workflow-context-block netsuite-query-preview">
        <div class="netsuite-query-preview__bar">
          <label class="netsuite-query-preview__day">
            <span class="workflow-context-label">Day</span>
            <input name="previewDay" v-model="previewDay" type="date" />
          </label>
          <button
            type="button"
            data-testid="netsuite-query-preview"
            :disabled="previewing || fieldsPayload.length === 0 || !form.nsAuthConfigId"
            @click="runPreview"
          >
            Preview
          </button>
        </div>

        <div v-if="previewErrors.length" data-testid="netsuite-query-preview-errors">
          <InlineValidation v-for="message in previewErrors" :key="message" tone="error" :message="message" />
        </div>

        <template v-if="preview">
          <pre class="netsuite-query-preview__sql" data-testid="netsuite-query-preview-sql">{{ preview.sql }}</pre>
          <AppTableFrame
            v-if="preview.records.length"
            :columns="previewColumns"
            :rows="preview.records"
            row-test-id="netsuite-query-preview-row"
          />
          <p v-else-if="!previewErrors.length" class="section-note" data-testid="netsuite-query-preview-empty">
            No records on {{ preview.day }}.
          </p>
          <p v-if="preview.more" class="section-note">First {{ preview.records.length }} shown.</p>
        </template>
      </div>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkflowStepMachine } from '../../composables/useWorkflowStepMachine'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { netSuiteQueryFacade } from '../../lib/api/authoringFacade'
import type {
  NsMatchOp,
  NsMatchRule,
  NsQueryField,
  NsSuiteQlQuery,
  NsSuiteQlQueryOptions,
  NsSuiteQlQueryPreview,
} from '../../lib/api/authoringTypes'
import { trashIconPath } from '../../lib/iconPaths'
import { resolveInternalRedirectTarget } from '../../lib/navigation'
import { usePermissionsStore } from '../../stores/permissions'

type QueryCreateStepId =
  | 'nsAuthConfigId'
  | 'nsSuiteQlSourceQueryId'
  | 'description'
  | 'recordType'
  | 'dateColumn'
  | 'queryTemplate'
  | 'matchRules'
  | 'fields'
  | 'joinKeyFieldName'
  | 'review'

interface QueryCreateStep {
  id: QueryCreateStepId
  title: string
  kind: 'select' | 'text' | 'list' | 'review'
}

interface QueryForm {
  nsSuiteQlSourceQueryId: string
  nsAuthConfigId: string
  description: string
  recordType: string
  fromTable: string
  dateColumn: string
  queryTemplate: string
  joinKeyFieldName: string
  originFieldName: string
  isActive: string
}

interface MatchRuleRow {
  fieldId: string
  op: NsMatchOp
  valuesText: string
}

interface FieldRow {
  recordFieldName: string
  sourceColumn: string
}

const TEMPLATE_RECORDS_MATCHING = 'RECORDS_MATCHING'
/** Everything this editor writes; any other stored spec field (a lifecycle template's) rides through untouched. */
const EDITOR_KEYS = new Set([
  'nsSuiteQlSourceQueryId', 'nsAuthConfigId', 'description', 'recordType', 'fromTable', 'dateColumn',
  'queryTemplate', 'matchRules', 'joinKeyFieldName', 'originFieldName', 'isActive', 'fields',
])
const FALLBACK_OPTIONS: NsSuiteQlQueryOptions = {
  templates: ['RECORDS', TEMPLATE_RECORDS_MATCHING],
  dateColumns: ['trandate', 'lastmodifieddate', 'createddate'],
  recordTypes: [],
  matchFields: [],
  matchOps: ['IN', 'GT', 'NOT_EMPTY', 'STARTS_WITH'],
  customFieldPattern: 'custbody_...',
  accounts: [],
}
const TEMPLATE_LABELS: Record<string, string> = { RECORDS: 'All records', RECORDS_MATCHING: 'Matching records' }
const OP_LABELS: Record<string, string> = {
  IN: 'is one of',
  GT: 'more than',
  NOT_EMPTY: 'has a value',
  STARTS_WITH: 'starts with',
}
const plusIconPath =
  'M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z'
const rowDeleteActionClass = 'app-table__icon-action app-table__icon-action--danger'
const actionColumn = {
  key: 'actions',
  label: '',
  headerAlign: 'end' as const,
  colClass: 'app-table__action-column',
  colStyle: { width: '4rem' },
  headerClass: 'app-table__action-header',
  cellClass: 'app-table__action-cell',
}
const matchRuleColumns = [
  { key: 'fieldId', label: 'Field', cellClass: 'app-table__control-cell' },
  { key: 'op', label: 'Test', colStyle: { width: '11rem' }, cellClass: 'app-table__control-cell' },
  { key: 'valuesText', label: 'Values', cellClass: 'app-table__control-cell' },
  actionColumn,
]
const fieldColumns = [
  { key: 'recordFieldName', label: 'Record Field', colStyle: { width: '14rem' }, cellClass: 'app-table__control-cell' },
  { key: 'sourceColumn', label: 'Column', cellClass: 'app-table__control-cell' },
  actionColumn,
]
const yesNoOptions: AppSelectOption[] = [
  { value: 'Y', label: 'Yes' },
  { value: 'N', label: 'No' },
]

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()

function createDefaultForm(): QueryForm {
  return {
    nsSuiteQlSourceQueryId: '',
    nsAuthConfigId: '',
    description: '',
    recordType: '',
    fromTable: 'transaction',
    dateColumn: 'trandate',
    queryTemplate: 'RECORDS',
    joinKeyFieldName: '',
    originFieldName: '',
    isActive: 'Y',
  }
}

const form = reactive<QueryForm>(createDefaultForm())
const matchRuleRows = ref<MatchRuleRow[]>([])
const fieldRows = ref<FieldRow[]>([])
const otherRecordType = ref('')
/** Stored spec fields this editor does not show; sent back on save so editing never clears them. */
const carriedFields = ref<Record<string, unknown>>({})
const options = ref<NsSuiteQlQueryOptions>(FALLBACK_OPTIONS)
const loading = ref(false)
const errors = ref<string[]>([])
const success = ref<string | null>(null)
const previewing = ref(false)
const previewDay = ref('')
const preview = ref<NsSuiteQlQueryPreview | null>(null)
const previewErrors = ref<string[]>([])
const currentStepIndex = ref(0)

const activeQueryId = computed(() => String(route.params.queryId ?? '').trim())
const isEditing = computed(() => activeQueryId.value.length > 0)
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const returnTo = computed(() => resolveInternalRedirectTarget(route.query.returnTo, ''))
const returnSide = computed(() => String(route.query.side ?? '').trim())
const isMatching = computed(() => form.queryTemplate === TEMPLATE_RECORDS_MATCHING)
const showMatchEditor = computed(() => (isEditing.value ? isMatching.value : currentCreateStep.value.id === 'matchRules'))
const showFieldEditor = computed(() => isEditing.value || currentCreateStep.value.id === 'fields')

const createSteps = computed<QueryCreateStep[]>(() => [
  { id: 'nsAuthConfigId', title: 'Which NetSuite account should this query read?', kind: 'select' },
  { id: 'nsSuiteQlSourceQueryId', title: 'What should the query ID be?', kind: 'text' },
  { id: 'description', title: 'What label should Darpan show for this query?', kind: 'text' },
  { id: 'recordType', title: 'Which record type?', kind: 'select' },
  { id: 'dateColumn', title: 'Which date puts a record on a day?', kind: 'select' },
  { id: 'queryTemplate', title: 'Every record, or only matching ones?', kind: 'select' },
  ...(isMatching.value
    ? [{ id: 'matchRules', title: 'Which records match?', kind: 'list' } as QueryCreateStep]
    : []),
  { id: 'fields', title: 'Which columns should it read?', kind: 'list' },
  { id: 'joinKeyFieldName', title: 'Which field is the key?', kind: 'select' },
  { id: 'review', title: 'Preview, then save.', kind: 'review' },
])

const errorRef = computed<string | null>({
  get: () => errors.value[0] ?? null,
  set: (value) => { errors.value = value ? [value] : [] },
})

const {
  currentCreateStep,
  progressPercent,
  currentQuestion,
  primaryLabel,
  primaryTestId,
  primaryActionVariant,
  showBack,
  goNext,
  goBack,
} = useWorkflowStepMachine<QueryCreateStep>({
  steps: createSteps,
  currentStepIndex,
  isEditing,
  editQuestion: 'Update the SuiteQL query.',
  finalStepId: 'review',
  saveTestId: 'save-netsuite-query',
  error: errorRef,
})

const isCreateSelectStep = computed(() => !isEditing.value && currentCreateStep.value.kind === 'select')
const isWideStep = computed(() => isEditing.value || ['list', 'review'].includes(currentCreateStep.value.kind))

const accountOptions = computed<WorkflowSelectOption[]>(() => options.value.accounts.map((account) => ({
  value: account.nsAuthConfigId,
  label: account.description?.trim() || account.nsAuthConfigId,
})))
const recordTypeValues = computed(() => options.value.recordTypes)
const recordTypeOptions = computed<WorkflowSelectOption[]>(() => recordTypeValues.value.map((value) => ({ value, label: value })))
const recordTypeSelectValue = computed(() => (recordTypeValues.value.includes(form.recordType) ? form.recordType : ''))
const dateColumnOptions = computed<WorkflowSelectOption[]>(() => withCurrent(options.value.dateColumns, form.dateColumn)
  .map((value) => ({ value, label: value })))
const templateOptions = computed<WorkflowSelectOption[]>(() => withCurrent(options.value.templates, form.queryTemplate)
  .map((value) => ({ value, label: TEMPLATE_LABELS[value] ?? value })))
const matchFieldValues = computed(() => options.value.matchFields)
const matchOpOptions = computed<AppSelectOption[]>(() => options.value.matchOps
  .map((value) => ({ value, label: OP_LABELS[value] ?? value })))
const keyFieldOptions = computed<WorkflowSelectOption[]>(() => {
  const names = Array.from(new Set(fieldRows.value.map((row) => row.recordFieldName.trim()).filter(Boolean)))
  return names.map((value) => ({ value, label: value }))
})
const matchRuleTableRows = computed(() => matchRuleRows.value as unknown as Array<Record<string, unknown>>)
const fieldTableRows = computed(() => fieldRows.value as unknown as Array<Record<string, unknown>>)
const previewColumns = computed(() => {
  const keys: string[] = []
  for (const record of preview.value?.records ?? []) {
    for (const key of Object.keys(record)) if (!keys.includes(key)) keys.push(key)
  }
  return keys.map((key) => ({ key, label: key }))
})

const fieldsPayload = computed<NsQueryField[]>(() => fieldRows.value
  .map((row) => ({ recordFieldName: row.recordFieldName.trim(), sourceColumn: row.sourceColumn.trim() }))
  .filter((row) => row.recordFieldName || row.sourceColumn)
  .map((row, index) => ({ ...row, sequenceNum: index + 1 })))

const matchRulesPayload = computed<NsMatchRule[]>(() => {
  if (!isMatching.value) return []
  return matchRuleRows.value
    .filter((row) => row.fieldId.trim())
    .map((row) => ({
      fieldId: row.fieldId.trim(),
      op: row.op,
      values: row.op === 'NOT_EMPTY' ? [] : splitValues(row.valuesText),
    }))
})

const submitDisabled = computed(() => {
  if (!canEditTenantSettings.value || loading.value) return true
  if (isEditing.value) return false

  switch (currentCreateStep.value.id) {
    case 'nsAuthConfigId':
      return !form.nsAuthConfigId
    case 'nsSuiteQlSourceQueryId':
      return !form.nsSuiteQlSourceQueryId.trim()
    case 'recordType':
      return !form.recordType.trim()
    case 'dateColumn':
      return !form.dateColumn
    case 'queryTemplate':
      return !form.queryTemplate
    case 'matchRules':
      return matchRulesPayload.value.length === 0
        || matchRulesPayload.value.some((rule) => rule.op !== 'NOT_EMPTY' && rule.values.length === 0)
    case 'fields':
      return fieldsPayload.value.length === 0
        || fieldsPayload.value.some((field) => !field.recordFieldName || !field.sourceColumn)
    case 'joinKeyFieldName':
      return !form.joinKeyFieldName
    default:
      return false
  }
})

function withCurrent(values: string[], current: string): string[] {
  return current && !values.includes(current) ? [...values, current] : values
}

function splitValues(text: string): string[] {
  return text.split(',').map((value) => value.trim()).filter(Boolean)
}

function emptyMatchRule(): MatchRuleRow {
  return { fieldId: '', op: 'NOT_EMPTY', valuesText: '' }
}

function addMatchRule(): void {
  matchRuleRows.value.push(emptyMatchRule())
}

function removeMatchRule(index: number): void {
  matchRuleRows.value.splice(index, 1)
}

function setMatchOp(index: number, op: string): void {
  const row = matchRuleRows.value[index]
  if (!row) return
  row.op = op as NsMatchOp
  if (op === 'NOT_EMPTY') row.valuesText = ''
}

function addField(): void {
  fieldRows.value.push({ recordFieldName: '', sourceColumn: '' })
}

function removeField(index: number): void {
  fieldRows.value.splice(index, 1)
}

function selectRecordType(value: string | string[]): void {
  form.recordType = Array.isArray(value) ? (value[0] ?? '') : value
  otherRecordType.value = ''
}

/** A service refusal carries every normalizeSpec message in `errors`; the thrown error names only the first. */
function serviceErrors(error: unknown, fallback: string): string[] {
  if (error instanceof ApiCallError) {
    const result = (error.details as { result?: { errors?: unknown } } | undefined)?.result
    const listed = Array.isArray(result?.errors) ? result.errors.map((item) => String(item)).filter(Boolean) : []
    return listed.length ? listed : [error.message]
  }
  return [fallback]
}

function parseMatchRules(raw: NsSuiteQlQuery['matchRules']): MatchRuleRow[] {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = raw.trim() ? JSON.parse(raw) : []
    } catch {
      parsed = []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed.map((rule: Partial<NsMatchRule>) => ({
    fieldId: String(rule?.fieldId ?? ''),
    op: (rule?.op ?? 'IN') as NsMatchOp,
    valuesText: Array.isArray(rule?.values) ? rule.values.join(', ') : '',
  }))
}

function applyQuery(query: NsSuiteQlQuery): void {
  form.nsSuiteQlSourceQueryId = query.nsSuiteQlSourceQueryId
  form.nsAuthConfigId = query.nsAuthConfigId ?? ''
  form.description = query.description ?? ''
  form.recordType = query.recordType ?? ''
  form.fromTable = query.fromTable || 'transaction'
  form.dateColumn = query.dateColumn || 'trandate'
  form.queryTemplate = query.queryTemplate || 'RECORDS'
  form.joinKeyFieldName = query.joinKeyFieldName ?? ''
  form.originFieldName = query.originFieldName ?? ''
  form.isActive = query.isActive === false || query.isActive === 'N' ? 'N' : 'Y'
  matchRuleRows.value = parseMatchRules(query.matchRules)
  if (isMatching.value && matchRuleRows.value.length === 0) matchRuleRows.value = [emptyMatchRule()]
  fieldRows.value = [...(query.fields ?? [])]
    .sort((a, b) => (a.sequenceNum ?? 0) - (b.sequenceNum ?? 0))
    .map((field) => ({ recordFieldName: field.recordFieldName ?? '', sourceColumn: field.sourceColumn ?? '' }))
  carriedFields.value = Object.fromEntries(Object.entries(query)
    .filter(([key, value]) => !EDITOR_KEYS.has(key) && value !== null && value !== undefined && value !== ''))
}

function resetCreateForm(): void {
  Object.assign(form, createDefaultForm())
  matchRuleRows.value = [emptyMatchRule()]
  fieldRows.value = [{ recordFieldName: '', sourceColumn: '' }]
  otherRecordType.value = ''
  carriedFields.value = {}
  currentStepIndex.value = 0
}

function basePayload(): NsSuiteQlQuery {
  return {
    nsSuiteQlSourceQueryId: form.nsSuiteQlSourceQueryId.trim(),
    nsAuthConfigId: form.nsAuthConfigId,
    recordType: form.recordType.trim(),
    fromTable: form.fromTable.trim() || 'transaction',
    dateColumn: form.dateColumn,
    queryTemplate: form.queryTemplate,
    matchRules: matchRulesPayload.value,
    joinKeyFieldName: form.joinKeyFieldName.trim(),
    originFieldName: form.originFieldName.trim(),
    fields: fieldsPayload.value,
  }
}

const pageAbortController = new AbortController()
let loadController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadController?.abort()
})

async function load(): Promise<void> {
  loading.value = true
  errors.value = []
  success.value = null
  preview.value = null
  previewErrors.value = []
  if (!isEditing.value) resetCreateForm()

  loadController?.abort()
  loadController = new AbortController()
  const signal = loadController.signal

  try {
    const [optionsResponse, queryResponse] = await Promise.all([
      netSuiteQueryFacade.getOptions(signal),
      isEditing.value ? netSuiteQueryFacade.get(activeQueryId.value, signal) : Promise.resolve(null),
    ])
    options.value = { ...FALLBACK_OPTIONS, ...(optionsResponse.options ?? {}) }
    if (queryResponse) {
      if (queryResponse.query) applyQuery(queryResponse.query)
      else errors.value = [`Unable to find SuiteQL query "${activeQueryId.value}".`]
    }
  } catch (loadError) {
    if (isAbortError(loadError)) return
    errors.value = serviceErrors(loadError, 'Failed to load the SuiteQL query.')
  } finally {
    loading.value = false
  }
}

async function handlePrimarySubmit(): Promise<void> {
  if (isEditing.value || currentCreateStep.value.id === 'review') {
    await save()
    return
  }
  if (submitDisabled.value) return
  goNext()
}

async function runPreview(): Promise<void> {
  previewing.value = true
  previewErrors.value = []
  preview.value = null
  try {
    const day = previewDay.value.trim()
    const response = await netSuiteQueryFacade.preview(
      { ...basePayload(), ...(day ? { day } : {}) },
      pageAbortController.signal,
    )
    preview.value = response.preview ?? null
  } catch (previewError) {
    if (isAbortError(previewError)) return
    previewErrors.value = serviceErrors(previewError, 'Preview failed.')
    // NetSuite refusing the query still answers the SuiteQL that was sent, which is what explains the refusal.
    const refused = (previewError as ApiCallError)?.details as { result?: { preview?: NsSuiteQlQueryPreview } } | undefined
    if (refused?.result?.preview?.sql) preview.value = { ...refused.result.preview, records: [], more: false }
  } finally {
    previewing.value = false
  }
}

async function save(): Promise<void> {
  if (!canEditTenantSettings.value) {
    errors.value = ['You do not have permission to save NetSuite queries for the active tenant.']
    return
  }

  loading.value = true
  errors.value = []
  success.value = null
  try {
    const payload: NsSuiteQlQuery = {
      ...carriedFields.value,
      ...basePayload(),
      description: form.description.trim(),
      isActive: form.isActive,
    }
    const response = await netSuiteQueryFacade.save(payload, pageAbortController.signal)
    const savedId = response.savedQuery?.nsSuiteQlSourceQueryId ?? payload.nsSuiteQlSourceQueryId
    if (returnTo.value) {
      await router.push(withReturnParams(returnTo.value, savedId))
      return
    }
    if (!isEditing.value) {
      await router.replace({ name: 'reconciliation-netsuite-query-edit', params: { queryId: savedId } })
      return
    }
    if (response.savedQuery) applyQuery(response.savedQuery)
    success.value = 'Saved.'
  } catch (saveError) {
    if (isAbortError(saveError)) return
    errors.value = serviceErrors(saveError, 'Failed to save the SuiteQL query.')
  } finally {
    loading.value = false
  }
}

/** The page that sent us here learns which query was saved, and for which side of its run. */
function withReturnParams(target: string, queryId: string): string {
  const hashIndex = target.indexOf('#')
  const base = hashIndex >= 0 ? target.slice(0, hashIndex) : target
  const hash = hashIndex >= 0 ? target.slice(hashIndex) : ''
  const params = new URLSearchParams({ newQuery: queryId })
  if (returnSide.value) params.set('side', returnSide.value)
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}${hash}`
}

async function leave(): Promise<void> {
  if (loading.value || !returnTo.value) return
  await router.push(returnTo.value)
}

// A typed record type wins over the list; clearing it leaves nothing chosen rather than a stale identifier.
watch(otherRecordType, (typed) => {
  const value = typed.trim()
  if (value) form.recordType = value
  else if (!recordTypeValues.value.includes(form.recordType)) form.recordType = ''
})

watch(isMatching, (matching) => {
  if (matching && matchRuleRows.value.length === 0) matchRuleRows.value = [emptyMatchRule()]
})

watch(() => route.fullPath, () => {
  void load()
}, { immediate: true })
</script>

<style scoped>
.netsuite-query-errors {
  display: grid;
  gap: var(--space-1);
}

.netsuite-query-preview {
  margin-top: var(--space-3);
}

.netsuite-query-preview__bar {
  display: flex;
  align-items: end;
  gap: var(--space-2);
}

.netsuite-query-preview__day {
  width: 12rem;
}

.netsuite-query-preview__sql {
  margin: 0;
  padding: var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--surface-2);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--type-label-size);
  line-height: 1.55;
  color: var(--text);
}
</style>
