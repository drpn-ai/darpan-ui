<template>
  <!-- data-enter-submit="off" and the Enter capture keep this editor's keys from saving the settings form it sits in. -->
  <div class="audit-check-editor" data-enter-submit="off" data-testid="audit-check-editor" @keydown.enter.capture="keepEnterHere">
    <div v-if="errors.length" class="audit-check-errors" data-testid="audit-check-errors">
      <InlineValidation v-for="message in errors" :key="message" tone="error" :message="message" />
    </div>
    <p v-if="notice" class="section-note" data-testid="audit-check-notice">{{ notice }}</p>

    <template v-if="options">
      <label class="wizard-input-shell">
        <span class="workflow-context-label">Run</span>
        <AppSelect
          :model-value="form.savedRunId"
          :options="runOptions"
          placeholder="Select run"
          test-id="audit-check-run"
          searchable
          search-placeholder="Search runs"
          :disabled="busy"
          @update:model-value="selectRun"
        />
      </label>
      <div class="audit-check-actions">
        <RouterLink :to="NEW_RUN_LINK" class="audit-check-text-action" data-testid="audit-check-new-run">New run</RouterLink>
        <RouterLink :to="NEW_EVALUATE_RUN_LINK" class="audit-check-text-action" data-testid="audit-check-new-evaluate-run">
          New one-system run
        </RouterLink>
      </div>

      <div class="workflow-form-grid workflow-form-grid--two">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Name</span>
          <input
            :value="form.label"
            name="checkLabel"
            class="wizard-answer-control"
            type="text"
            data-testid="audit-check-label"
            :disabled="busy"
            @input="setLabel"
          />
        </label>
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Check ID</span>
          <input
            :value="form.id"
            name="checkId"
            class="wizard-answer-control"
            type="text"
            :maxlength="CODE_MAX_LENGTH"
            data-testid="audit-check-id"
            :disabled="isEditing || busy"
            @input="editId"
          />
        </label>
      </div>

      <div class="audit-check-group">
        <span class="workflow-context-label">Statements</span>
        <div
          v-for="(row, index) in links"
          :key="row.key"
          class="audit-check-link"
          data-testid="audit-check-link"
        >
          <div class="audit-check-link-row">
            <AppSelect
              v-model="row.id"
              :options="statementOptionsFor(row)"
              placeholder="Select statement"
              :test-id="`audit-check-statement-${index}`"
              :disabled="busy"
            />
            <WorkflowSelect
              :model-value="row.diffTypes"
              @update:model-value="row.diffTypes = asList($event)"
              :options="diffTypeOptions"
              placeholder="Any row"
              aria-label="Rows"
              multiple
              :test-id="`audit-check-diff-types-${index}`"
              :disabled="busy"
            />
            <button
              type="button"
              class="app-table__icon-action app-table__icon-action--danger"
              aria-label="Remove statement"
              :data-testid="`audit-check-remove-link-${index}`"
              :disabled="busy || links.length < 2"
              @click="removeLink(index)"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
              </svg>
            </button>
          </div>
          <div v-if="showRules(row) || showConclusions(row)" class="audit-check-link-row audit-check-link-row--detail">
            <WorkflowSelect
              v-if="showRules(row)"
              :model-value="row.ruleIds"
              @update:model-value="row.ruleIds = asList($event)"
              :options="ruleOptions"
              placeholder="Any rule"
              aria-label="Rules"
              multiple
              :test-id="`audit-check-rules-${index}`"
              :disabled="busy"
            />
            <WorkflowSelect
              v-if="showConclusions(row)"
              :model-value="row.conclusionCodes"
              @update:model-value="row.conclusionCodes = asList($event)"
              :options="conclusionOptions"
              placeholder="Any conclusion"
              aria-label="Conclusions"
              multiple
              :test-id="`audit-check-conclusions-${index}`"
              :disabled="busy"
            />
          </div>
        </div>
        <button
          v-if="links.length < options.statements.length"
          type="button"
          class="app-table__icon-action"
          aria-label="Add statement"
          data-testid="audit-check-add-link"
          :disabled="busy"
          @click="addLink"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="plusIconPath" fill="currentColor" />
          </svg>
        </button>
      </div>

      <div :class="['workflow-form-grid', { 'workflow-form-grid--two': !isEvaluate }]">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">File 1 record</span>
          <input v-model="form.file1RecordType" name="file1RecordType" class="wizard-answer-control" type="text" :disabled="busy" />
        </label>
        <label v-if="!isEvaluate" class="wizard-input-shell" data-testid="audit-check-file2">
          <span class="workflow-context-label">File 2 record</span>
          <input v-model="form.file2RecordType" name="file2RecordType" class="wizard-answer-control" type="text" :disabled="busy" />
        </label>
      </div>

      <label class="wizard-input-shell">
        <span class="workflow-context-label">Matched by</span>
        <input v-model="form.matchedBy" name="matchedBy" class="wizard-answer-control" type="text" :disabled="busy" />
      </label>

      <div class="workflow-form-grid audit-check-grid--three">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Grace days</span>
          <input
            v-model="form.graceDays"
            name="graceDays"
            class="wizard-answer-control"
            type="number"
            min="0"
            :max="MAX_GRACE_DAYS"
            :disabled="busy"
          />
        </label>
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Fix owner</span>
          <input v-model="form.fixOwner" name="fixOwner" class="wizard-answer-control" type="text" :disabled="busy" />
        </label>
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Fix where</span>
          <AppSelect
            v-model="form.fixWhereEnumId"
            :options="fixWhereOptions"
            placeholder="None"
            test-id="audit-check-fix-where"
            :disabled="busy"
          />
        </label>
      </div>

      <div class="audit-check-group">
        <button
          type="button"
          class="audit-check-text-action"
          :aria-expanded="moneyOpen ? 'true' : 'false'"
          data-testid="audit-check-money-toggle"
          :disabled="busy"
          @click="moneyOpen = !moneyOpen"
        >
          Money
        </button>
        <div v-if="moneyOpen" class="workflow-form-grid audit-check-grid--three" data-testid="audit-check-money">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Currency</span>
            <input
              v-model="form.amountCurrencyUomId"
              name="amountCurrencyUomId"
              class="wizard-answer-control"
              type="text"
              maxlength="3"
              placeholder="USD"
              :disabled="busy"
            />
          </label>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Expected from</span>
            <input v-model="form.expectedSource" name="expectedSource" class="wizard-answer-control" type="text" :disabled="busy" />
          </label>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Actual from</span>
            <input v-model="form.actualSource" name="actualSource" class="wizard-answer-control" type="text" :disabled="busy" />
          </label>
        </div>
      </div>

      <div class="audit-check-group">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Headline</span>
          <textarea
            v-model="form.headlineTemplate"
            name="headlineTemplate"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
            :disabled="busy"
          />
        </label>
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Fix action</span>
          <textarea
            v-model="form.fixActionTemplate"
            name="fixActionTemplate"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
            :disabled="busy"
          />
        </label>
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Passes when</span>
          <textarea
            v-model="form.passesWhenTemplate"
            name="passesWhenTemplate"
            class="wizard-answer-control workflow-form-textarea workflow-form-textarea--single-row"
            rows="1"
            :disabled="busy"
          />
        </label>
        <p class="section-note">{name} is the finding's field of that name.</p>
      </div>

      <div v-if="confirmingRemove" class="audit-check-actions" data-testid="audit-check-remove-confirm">
        <span>Remove {{ form.label || form.id }} from {{ options.audit.name }}?</span>
        <button type="button" class="audit-check-text-action" data-testid="audit-check-remove-yes" :disabled="busy" @click="void remove()">
          Remove
        </button>
        <button type="button" class="audit-check-text-action" data-testid="audit-check-remove-no" :disabled="busy" @click="confirmingRemove = false">
          Keep
        </button>
      </div>
      <div v-else class="audit-check-actions">
        <AppSaveAction test-id="audit-check-save" :disabled="busy" @click="void save()" />
        <AppCancelAction test-id="audit-check-cancel" :disabled="saving" @click="emit('cancel')" />
        <button
          v-if="isEditing"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger"
          aria-label="Remove check"
          data-testid="audit-check-remove"
          :disabled="busy"
          @click="confirmingRemove = true"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import AppCancelAction from '../ui/AppCancelAction.vue'
import AppSaveAction from '../ui/AppSaveAction.vue'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowSelect from '../workflow/WorkflowSelect.vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { auditCheckFacade } from '../../lib/api/authoringFacade'
import type {
  AuditCheckDetail,
  AuditCheckDraft,
  AuditCheckOptions,
  AuditCheckStatementLink,
  AuditDiffType,
  DeleteAuditCheckResponse,
} from '../../lib/api/authoringTypes'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'

// The run builder; scope=EVALUATE builds a run that reads one system.
const NEW_RUN_LINK = { path: '/reconciliation/create' }
const NEW_EVALUATE_RUN_LINK = { path: '/reconciliation/create', query: { scope: 'EVALUATE' } }

// DAR-UI-064 S4. Adds or edits one check on an audit: the run it reads, which statements it tests and which of the
// run's rows break each one, and how a finding reads. Mounted inside the audit settings page, so it is not a form.
const props = defineProps<{
  /** The audit's code, e.g. month-close. */
  audit: string
  /** The statement code the editor was opened from; a new check links it first. */
  statement: string
  /** A check code to edit; absent = a new check. */
  check?: string | null
}>()

const emit = defineEmits<{
  saved: [check: AuditCheckDetail]
  removed: [result: NonNullable<DeleteAuditCheckResponse['result']>]
  cancel: []
}>()

type Run = AuditCheckOptions['runs'][number]

interface LinkRow {
  key: number
  id: string
  diffTypes: string[]
  conclusionCodes: string[]
  ruleIds: string[]
}

interface CheckForm {
  id: string
  label: string
  savedRunId: string
  file1RecordType: string
  file2RecordType: string
  graceDays: string | number
  matchedBy: string
  fixOwner: string
  fixWhereEnumId: string
  expectedSource: string
  actualSource: string
  amountCurrencyUomId: string
  headlineTemplate: string
  fixActionTemplate: string
  passesWhenTemplate: string
}

const CODE_MAX_LENGTH = 60
const MAX_GRACE_DAYS = 60
const plusIconPath =
  'M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z'

const DIFF_TYPE_LABELS: Record<AuditDiffType, string> = {
  MISSING_IN_FILE_1: 'Missing in file 1',
  MISSING_IN_FILE_2: 'Missing in file 2',
  FIELD_MISMATCH: 'Field mismatch',
  FINDING: 'Finding',
  DUPLICATE_IN_FILE_1: 'Duplicate in file 1',
  DUPLICATE_IN_FILE_2: 'Duplicate in file 2',
}
// An EVALUATE run reads one side, so only its findings and its duplicates can break a statement.
const EVALUATE_DIFF_TYPES: AuditDiffType[] = ['FINDING', 'DUPLICATE_IN_FILE_1']
const COMPARE_DIFF_TYPES: AuditDiffType[] = [
  'MISSING_IN_FILE_1',
  'MISSING_IN_FILE_2',
  'FIELD_MISMATCH',
  'FINDING',
  'DUPLICATE_IN_FILE_1',
  'DUPLICATE_IN_FILE_2',
]
const FIX_WHERE_LABELS: Record<string, string> = { OMS: 'HotWax', NETSUITE: 'NetSuite', SHOPIFY: 'Shopify' }

function emptyForm(): CheckForm {
  return {
    id: '',
    label: '',
    savedRunId: '',
    file1RecordType: '',
    file2RecordType: '',
    graceDays: '',
    matchedBy: '',
    fixOwner: '',
    fixWhereEnumId: '',
    expectedSource: '',
    actualSource: '',
    amountCurrencyUomId: '',
    headlineTemplate: '',
    fixActionTemplate: '',
    passesWhenTemplate: '',
  }
}

const options = ref<AuditCheckOptions | null>(null)
const form = reactive<CheckForm>(emptyForm())
const links = ref<LinkRow[]>([])
const idEdited = ref(false)
const moneyOpen = ref(false)
const confirmingRemove = ref(false)
const loading = ref(false)
const saving = ref(false)
const errors = ref<string[]>([])
const notice = ref<string | null>(null)
let nextKey = 0

const isEditing = computed(() => Boolean(props.check))
const busy = computed(() => loading.value || saving.value)
const run = computed<Run | null>(() => options.value?.runs.find((item) => item.savedRunId === form.savedRunId) ?? null)
const isEvaluate = computed(() => run.value?.scopeMode === 'EVALUATE')

const runOptions = computed<AppSelectOption[]>(() =>
  (options.value?.runs ?? []).map((item) => ({ value: item.savedRunId, label: item.runName || item.savedRunId })),
)
const allowedDiffTypes = computed<AuditDiffType[]>(() => {
  const offered = options.value?.diffTypes ?? []
  const forMode = isEvaluate.value ? EVALUATE_DIFF_TYPES : COMPARE_DIFF_TYPES
  return offered.length ? forMode.filter((type) => offered.includes(type)) : forMode
})
const diffTypeOptions = computed<AppSelectOption[]>(() =>
  allowedDiffTypes.value.map((type) => ({ value: type, label: DIFF_TYPE_LABELS[type] ?? type })),
)
const ruleOptions = computed<AppSelectOption[]>(() =>
  (run.value?.rules ?? []).map((rule) => ({ value: rule.ruleId, label: rule.ruleText || rule.ruleId })),
)
const conclusionOptions = computed<AppSelectOption[]>(() =>
  (run.value?.conclusions ?? []).map((item) => ({ value: item.code, label: item.label || item.code })),
)
const fixWhereOptions = computed<AppSelectOption[]>(() => [
  { value: '', label: 'None' },
  ...(options.value?.fixWhere ?? []).map((value) => ({ value, label: FIX_WHERE_LABELS[value] ?? value })),
])

function statementOptionsFor(row: LinkRow): AppSelectOption[] {
  const taken = new Set(links.value.filter((other) => other !== row).map((other) => other.id))
  return (options.value?.statements ?? [])
    .filter((statement) => !taken.has(statement.id))
    .map((statement) => ({ value: statement.id, label: `${statement.id} · ${statement.text}` }))
}

function showRules(row: LinkRow): boolean {
  return ruleOptions.value.length > 0 && row.diffTypes.includes('FIELD_MISMATCH')
}

function showConclusions(row: LinkRow): boolean {
  return conclusionOptions.value.length > 0
    && row.diffTypes.some((type) => type === 'FINDING' || type === 'MISSING_IN_FILE_1' || type === 'MISSING_IN_FILE_2')
}

function toCode(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, CODE_MAX_LENGTH)
    .replace(/-+$/, '')
}

function setLabel(event: Event): void {
  form.label = (event.target as HTMLInputElement).value
  deriveId()
}

function deriveId(): void {
  if (!isEditing.value && !idEdited.value) form.id = toCode(form.label)
}

function editId(event: Event): void {
  form.id = (event.target as HTMLInputElement).value
  // Cleared by hand: follow the name again.
  idEdited.value = form.id.trim().length > 0
  if (!idEdited.value) deriveId()
}

function makeLink(link?: Partial<AuditCheckStatementLink>): LinkRow {
  nextKey += 1
  return {
    key: nextKey,
    id: link?.id ?? '',
    diffTypes: [...(link?.diffTypes ?? [])],
    conclusionCodes: [...(link?.conclusionCodes ?? [])],
    ruleIds: [...(link?.ruleIds ?? [])],
  }
}

function addLink(): void {
  const first = statementOptionsFor(makeLink())[0]?.value ?? ''
  links.value.push(makeLink({ id: first }))
}

function removeLink(index: number): void {
  if (links.value.length > 1) links.value.splice(index, 1)
}

/** A new run keeps only the row types, rules and conclusions it can produce. */
function selectRun(savedRunId: string): void {
  form.savedRunId = savedRunId
  const allowed = new Set<string>(allowedDiffTypes.value)
  const rules = new Set(ruleOptions.value.map((option) => option.value))
  const conclusions = new Set(conclusionOptions.value.map((option) => option.value))
  for (const row of links.value) {
    row.diffTypes = row.diffTypes.filter((type) => allowed.has(type))
    row.ruleIds = row.ruleIds.filter((id) => rules.has(id))
    row.conclusionCodes = row.conclusionCodes.filter((code) => conclusions.has(code))
  }
}

function asList(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value].filter(Boolean)
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function showCheck(detail: AuditCheckDetail): void {
  Object.assign(form, {
    id: text(detail.id),
    label: text(detail.label),
    savedRunId: text(detail.savedRunId),
    file1RecordType: text(detail.file1RecordType),
    file2RecordType: text(detail.file2RecordType),
    graceDays: text(detail.graceDays),
    matchedBy: text(detail.matchedBy),
    fixOwner: text(detail.fixOwner),
    fixWhereEnumId: text(detail.fixWhereEnumId),
    expectedSource: text(detail.expectedSource),
    actualSource: text(detail.actualSource),
    amountCurrencyUomId: text(detail.amountCurrencyUomId),
    headlineTemplate: text(detail.headlineTemplate),
    fixActionTemplate: text(detail.fixActionTemplate),
    passesWhenTemplate: text(detail.passesWhenTemplate),
  })
  idEdited.value = true
  moneyOpen.value = Boolean(form.amountCurrencyUomId || form.expectedSource || form.actualSource)
  links.value = (detail.statements ?? []).map((link) => makeLink(link))
}

/** A refusal carries every sentence in `errors`; the thrown error names only the first. */
function serviceErrors(caught: unknown, fallback: string): string[] {
  if (caught instanceof ApiCallError) {
    const result = (caught.details as { result?: { errors?: unknown } } | undefined)?.result
    const listed = Array.isArray(result?.errors) ? result.errors.map((item) => String(item)).filter(Boolean) : []
    return listed.length ? listed : [caught.message]
  }
  return [caught instanceof Error && caught.message ? caught.message : fallback]
}

let abort = new AbortController()
onBeforeUnmount(() => abort.abort())

async function load(): Promise<void> {
  abort.abort()
  abort = new AbortController()
  const signal = abort.signal
  loading.value = true
  errors.value = []
  notice.value = null
  confirmingRemove.value = false
  Object.assign(form, emptyForm())
  idEdited.value = false
  moneyOpen.value = false
  links.value = []
  try {
    const [optionsResponse, checkResponse] = await Promise.all([
      auditCheckFacade.getOptions(props.audit, signal),
      props.check ? auditCheckFacade.get(props.audit, props.check, signal) : Promise.resolve(null),
    ])
    if (!optionsResponse.options) {
      errors.value = optionsResponse.errors?.length ? optionsResponse.errors : ['Unable to load the audit.']
      return
    }
    if (checkResponse && !checkResponse.check) {
      errors.value = checkResponse.errors?.length ? checkResponse.errors : [`Check '${props.check}' was not found.`]
      return
    }
    options.value = optionsResponse.options
    if (checkResponse?.check) showCheck(checkResponse.check)
    if (!links.value.length) links.value = [makeLink({ id: props.statement })]
  } catch (caught) {
    if (!isAbortError(caught) && !signal.aborted) errors.value = serviceErrors(caught, 'Unable to load the check.')
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

function orNull(value: string | number): string | null {
  const trimmed = String(value ?? '').trim()
  return trimmed ? trimmed : null
}

function draft(): AuditCheckDraft {
  const graceDays = orNull(form.graceDays)
  return {
    id: form.id.trim(),
    label: form.label.trim(),
    savedRunId: orNull(form.savedRunId),
    file1RecordType: orNull(form.file1RecordType),
    file2RecordType: isEvaluate.value ? null : orNull(form.file2RecordType),
    graceDays: graceDays === null ? null : Number(graceDays),
    matchedBy: orNull(form.matchedBy),
    fixOwner: orNull(form.fixOwner),
    fixWhereEnumId: orNull(form.fixWhereEnumId),
    expectedSource: orNull(form.expectedSource),
    actualSource: orNull(form.actualSource),
    amountCurrencyUomId: orNull(form.amountCurrencyUomId.toUpperCase()),
    headlineTemplate: orNull(form.headlineTemplate),
    fixActionTemplate: orNull(form.fixActionTemplate),
    passesWhenTemplate: orNull(form.passesWhenTemplate),
    // A new check may not take over a code another audit already uses; the backend refuses it (DAR-UI-064).
    ...(isEditing.value ? {} : { create: true }),
  }
}

/** Each chosen statement, with only the picks its row types can use. */
function statementLinks(): AuditCheckStatementLink[] {
  return links.value
    .filter((row) => row.id)
    .map((row) => ({
      id: row.id,
      diffTypes: [...row.diffTypes] as AuditDiffType[],
      conclusionCodes: showConclusions(row) ? [...row.conclusionCodes] : [],
      ruleIds: showRules(row) ? [...row.ruleIds] : [],
    }))
}

async function save(): Promise<void> {
  if (busy.value || !options.value) return
  const check = draft()
  if (!isEditing.value && options.value.checks.some((existing) => existing.id === check.id)) {
    errors.value = [`Check '${check.id}' is already on this audit.`]
    return
  }
  saving.value = true
  errors.value = []
  notice.value = null
  try {
    const response = await auditCheckFacade.save(props.audit, check, statementLinks())
    if (response.savedCheck) emit('saved', response.savedCheck)
    else errors.value = response.errors?.length ? response.errors : ['Unable to save the check.']
  } catch (caught) {
    errors.value = serviceErrors(caught, 'Unable to save the check.')
  } finally {
    saving.value = false
  }
}

async function remove(): Promise<void> {
  if (busy.value || !props.check) return
  saving.value = true
  errors.value = []
  notice.value = null
  try {
    const response = await auditCheckFacade.delete(props.audit, props.check)
    const result = response.result
    if (!result) {
      errors.value = response.errors?.length ? response.errors : ['Unable to remove the check.']
      return
    }
    confirmingRemove.value = false
    notice.value = result.removed ? 'Check removed.' : 'Unlinked from this audit; its findings or other audits keep the check.'
    emit('removed', result)
  } catch (caught) {
    errors.value = serviceErrors(caught, 'Unable to remove the check.')
  } finally {
    saving.value = false
  }
}

// A select's Enter would submit the host page's form; here it only opens the menu or picks the option.
function keepEnterHere(event: KeyboardEvent): void {
  const target = event.target
  if (!(target instanceof HTMLButtonElement) || !target.closest('.app-select, .workflow-select')) return
  event.preventDefault()
  event.stopPropagation()
  target.click()
}

watch(() => [props.audit, props.check], () => void load(), { immediate: true })
</script>

<style scoped>
.audit-check-editor {
  display: grid;
  gap: var(--space-3);
  width: 100%;
  min-width: 0;
}

.audit-check-errors {
  display: grid;
  gap: var(--space-1);
}

.audit-check-group {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  min-width: 0;
}

.audit-check-group > * {
  width: 100%;
}

.audit-check-group > .app-table__icon-action,
.audit-check-group > .audit-check-text-action {
  width: auto;
}

.audit-check-link {
  display: grid;
  gap: var(--space-2);
  padding-block: var(--space-1);
  border-bottom: 1px solid var(--workflow-underline);
}

.audit-check-link-row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: start;
}

.audit-check-link-row--detail {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.audit-check-grid--three {
  grid-template-columns: minmax(6rem, 0.6fr) minmax(0, 1fr) minmax(9rem, 0.9fr);
  align-items: start;
}

.audit-check-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

/* Borderless and underlined, as the settings page's inline actions read. */
.audit-check-text-action {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--text-soft);
  text-decoration: underline;
  cursor: pointer;
}

.audit-check-text-action:disabled {
  cursor: default;
  opacity: 0.6;
}

@media (max-width: 768px) {
  .audit-check-link-row,
  .audit-check-link-row--detail,
  .audit-check-grid--three {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
