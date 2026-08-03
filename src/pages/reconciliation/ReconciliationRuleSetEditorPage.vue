<template>
  <WorkflowPage
    :progress-percent="'100'"
    aria-label="RuleSet rules edit progress"
    class="workflow-page--ruleset-editor"
    center-stage
    edit-surface
  >
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />

    <WorkflowStepForm
      v-if="draft"
      class="workflow-form--compact workflow-form--edit-single-page ruleset-editor-form"
      question=""
      primary-label="Save"
      primary-action-variant="save"
      primary-test-id="save-ruleset-rules"
      cancel-test-id="cancel-ruleset-rules"
      :show-enter-hint="false"
      :show-cancel-action="true"
      :submit-disabled="loadingFields"
      :cancel-disabled="loadingFields"
      @submit="finishRuleEdit"
      @cancel="cancelRuleEdit"
    >
      <div
        ref="boardRef"
        :class="[
          'ruleset-editor-board',
          {
            'ruleset-editor-board--drawing': isDrawing,
            'ruleset-editor-board--popup-open': editingRule || editingExclusion,
          },
        ]"
        :style="{ minHeight: `${boardMinHeight}px` }"
        data-testid="ruleset-editor-board"
        @pointermove="handleBoardPointerMove"
        @pointerup="handleBoardPointerUp"
        @pointercancel="cancelPendingConnection"
      >
        <svg
          class="ruleset-editor-lines"
          :viewBox="`0 0 ${boardSize.width} ${boardSize.height}`"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            v-for="rule in orderedRules"
            :key="rule.id"
            :class="['ruleset-editor-line', { 'ruleset-editor-line--active': isRuleActive(rule) }]"
            :d="ruleLinePath(rule)"
          />
          <path
            v-if="drawingLinePath"
            class="ruleset-editor-line ruleset-editor-line--draft"
            :d="drawingLinePath"
          />
        </svg>

        <section class="ruleset-field-column ruleset-field-column--left" data-testid="ruleset-field-list-file1">
          <header>
            <span>{{ file1Title }}</span>
          </header>
          <div
            v-for="(field, index) in file1Fields"
            :key="field.fieldPath"
            :ref="(element) => setFieldNodeRef('file1', field.fieldPath, element)"
            role="button"
            tabindex="0"
            :class="[
              'ruleset-field-item',
              {
                'ruleset-field-item--connection-active': isConnectionFieldHighlighted('file1', field.fieldPath),
                'ruleset-field-item--rule-active': isActiveRuleField('file1', field.fieldPath),
              },
            ]"
            :data-testid="`ruleset-field-file1-${index}`"
            data-rule-side="file1"
            :data-field-path="field.fieldPath"
            @pointerdown="handleFieldPointerDown($event, 'file1', field.fieldPath, index)"
            @pointerup.stop="handleFieldPointerUp($event, 'file1', field.fieldPath)"
            @keydown.enter.prevent.stop
            @keydown.space.prevent.stop
          >
            <span class="ruleset-field-label">{{ field.label }}</span>
            <span class="ruleset-field-meta" :aria-label="fieldSubtitle(field)" :title="fieldSubtitle(field)">
              <span
                v-for="(segment, segmentIndex) in fieldPathSegments(field)"
                :key="`${field.fieldPath}-${segmentIndex}`"
                class="ruleset-field-path-segment"
              >{{ segment }}</span>
            </span>
            <button
              type="button"
              :class="['ruleset-field-exclude', { 'ruleset-field-exclude--set': hasExclusion('file1', field.fieldPath) }]"
              :data-testid="`ruleset-field-exclude-file1-${index}`"
              :aria-label="`${hasExclusion('file1', field.fieldPath) ? 'Edit' : 'Add'} exclusion on ${field.label}`"
              @pointerdown.stop
              @pointerup.stop
              @click.stop="openExclusionEditor('file1', field.fieldPath)"
            >
              ⊘
            </button>
          </div>
        </section>

        <section class="ruleset-field-column ruleset-field-column--right" data-testid="ruleset-field-list-file2">
          <header>
            <span>{{ file2Title }}</span>
          </header>
          <div
            v-for="(field, index) in file2Fields"
            :key="field.fieldPath"
            :ref="(element) => setFieldNodeRef('file2', field.fieldPath, element)"
            role="button"
            tabindex="0"
            :class="[
              'ruleset-field-item',
              {
                'ruleset-field-item--connection-active': isConnectionFieldHighlighted('file2', field.fieldPath),
                'ruleset-field-item--rule-active': isActiveRuleField('file2', field.fieldPath),
              },
            ]"
            :data-testid="`ruleset-field-file2-${index}`"
            data-rule-side="file2"
            :data-field-path="field.fieldPath"
            @pointerdown="handleFieldPointerDown($event, 'file2', field.fieldPath, index)"
            @pointerup.stop="handleFieldPointerUp($event, 'file2', field.fieldPath)"
            @keydown.enter.prevent.stop
            @keydown.space.prevent.stop
          >
            <span class="ruleset-field-label">{{ field.label }}</span>
            <span class="ruleset-field-meta" :aria-label="fieldSubtitle(field)" :title="fieldSubtitle(field)">
              <span
                v-for="(segment, segmentIndex) in fieldPathSegments(field)"
                :key="`${field.fieldPath}-${segmentIndex}`"
                class="ruleset-field-path-segment"
              >{{ segment }}</span>
            </span>
            <button
              type="button"
              :class="['ruleset-field-exclude', { 'ruleset-field-exclude--set': hasExclusion('file2', field.fieldPath) }]"
              :data-testid="`ruleset-field-exclude-file2-${index}`"
              :aria-label="`${hasExclusion('file2', field.fieldPath) ? 'Edit' : 'Add'} exclusion on ${field.label}`"
              @pointerdown.stop
              @pointerup.stop
              @click.stop="openExclusionEditor('file2', field.fieldPath)"
            >
              ⊘
            </button>
          </div>
        </section>

        <button
          v-for="rule in orderedRules"
          :key="`operator-${rule.id}`"
          type="button"
          :aria-label="`Edit rule ${rule.sequenceNum}`"
          :class="['ruleset-operator-box', { 'ruleset-operator-box--active': isRuleActive(rule) }]"
          :style="operatorBoxStyle(rule)"
          :data-testid="`ruleset-rule-operator-${rule.id}`"
          @pointerenter="setHoveredRule(rule.id)"
          @pointerleave="clearHoveredRule(rule.id)"
          @focus="setHoveredRule(rule.id)"
          @blur="clearHoveredRule(rule.id)"
          @click="openRuleEditor(rule.id)"
        >
          <span :data-testid="`ruleset-rule-sequence-${rule.id}`">#{{ rule.sequenceNum }}</span>
        </button>

        <div
          v-if="editingRule"
          ref="rulePopoverRef"
          class="ruleset-rule-popover"
          :style="operatorPopoverStyle(editingRule)"
          role="dialog"
          aria-label="Edit rule"
          data-testid="ruleset-rule-popover"
          @keydown.enter.stop.prevent="applyRuleEdit"
        >
          <section class="ruleset-pre-action-section" aria-labelledby="ruleset-pre-action-title">
            <header class="ruleset-pre-action-header">
              <span id="ruleset-pre-action-title">Pre Actions</span>
            </header>
            <div class="ruleset-pre-action-add-row">
              <button
                type="button"
                class="app-icon-action ruleset-pre-action-add"
                data-testid="ruleset-rule-add-pre-action"
                aria-label="Add pre-action"
                @click="addPreActionRow"
              >
                +
              </button>
            </div>
            <div
              v-for="(preAction, index) in editingPreActions"
              :key="preAction.id"
              class="ruleset-pre-action-row"
            >
              <label>
                <span>Field</span>
                <AppSelect
                  v-model="preAction.fieldSide"
                  :options="editingPreActionFieldOptions"
                  :test-id="`ruleset-rule-pre-action-field-${index}`"
                />
              </label>
              <label>
                <span>Action</span>
                <AppSelect
                  v-model="preAction.action"
                  :options="preActionOptions"
                  :test-id="`ruleset-rule-pre-action-action-${index}`"
                />
              </label>
              <button
                type="button"
                class="app-icon-action app-icon-action--danger ruleset-pre-action-delete"
                :data-testid="`ruleset-rule-delete-pre-action-${index}`"
                aria-label="Delete pre-action"
                @click="deletePreActionRow(preAction.id)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
                </svg>
              </button>
            </div>
          </section>
          <label>
            <span>Operator</span>
            <AppSelect
              v-model="editingOperator"
              :options="operatorOptions"
              test-id="ruleset-rule-operator-select"
            />
          </label>
          <label>
            <span>Sequence</span>
            <input
              v-model.number="editingSequence"
              data-testid="ruleset-rule-sequence-input"
              type="number"
              min="1"
              :max="Math.max(orderedRules.length, 1)"
            />
          </label>
          <div class="ruleset-rule-popover-actions">
            <AppSaveAction label="Save rule" test-id="ruleset-rule-apply" @click="applyRuleEdit" />
            <button
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger ruleset-rule-delete-action"
              data-testid="ruleset-rule-delete"
              aria-label="Delete rule"
              @click="deleteEditingRule"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>

        <div
          v-if="editingExclusion"
          ref="exclusionPopoverRef"
          class="ruleset-rule-popover"
          role="dialog"
          aria-label="Edit exclusion"
          data-testid="ruleset-exclusion-popover"
          :style="exclusionPopoverStyle(editingExclusion)"
          @keydown.enter.stop.prevent="applyExclusionEdit"
        >
          <label>
            <span>Exclude on</span>
            <input :value="editingExclusion.fieldPath" readonly data-testid="ruleset-exclusion-field" />
          </label>
          <label>
            <span>Values to exclude</span>
            <input
              v-model="pendingExclusionValue"
              type="text"
              placeholder="Type a value, press Enter"
              data-testid="ruleset-exclusion-value-input"
              @keydown.enter.prevent.stop="commitPendingExclusionValue"
            />
          </label>
          <div v-if="editingExclusionValues.length" class="workflow-select-chip-row">
            <span v-for="value in editingExclusionValues" :key="value" class="workflow-select-chip">
              {{ value }}
              <button
                type="button"
                class="workflow-select-chip-remove"
                :aria-label="`Remove ${value}`"
                @click="editingExclusionValues = editingExclusionValues.filter((entry) => entry !== value)"
              >&times;</button>
            </span>
          </div>
          <div class="ruleset-rule-popover-actions">
            <AppSaveAction label="Save exclusion" test-id="ruleset-exclusion-apply" @click="applyExclusionEdit" />
            <button
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger"
              data-testid="ruleset-exclusion-delete"
              aria-label="Delete exclusion"
              @click="deleteEditingExclusion"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </WorkflowStepForm>

    <template v-else>
      <EmptyState
        title="No run basics defined yet"
        description="Start in reconciliation setup, then open the rules editor after defining the two sources."
      />
      <RouterLink
        class="static-page-action-tile static-page-action-tile--inline"
        :to="{ name: 'reconciliation-create' }"
      >
        Go to Run Setup
      </RouterLink>
    </template>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, reconciliationFacade } from '../../lib/api/facade'
import type {
  AutomationNsRestletOption,
  AutomationPrimaryIdOption,
  AutomationSystemRemoteOption,
  JsonSchemaField,
  SavedRunRule,
} from '../../lib/api/types'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import { normalizeExcludeFilters, parseExcludeFilterValues, type SourceExcludeFilter } from '../../lib/sourceExcludeFilters'
import {
  buildReconciliationFieldPathAliases,
  buildSaveRuleSetRunPayload,
  fieldsReferenceSamePath,
  formatReconciliationFieldKey,
  normalizeReconciliationFieldPath,
  normalizePreActions,
  readReconciliationRuleExpressionPreActions,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftRule,
  type ReconciliationRulePreActionEntry,
} from '../../lib/reconciliationRuleSetDraft'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

type RuleSide = 'file1' | 'file2'
type RuleOperator = '=' | '!=' | '>' | '<' | '>=' | '<='

interface RuleField {
  fieldPath: string
  label: string
  type?: string
  required?: boolean
}

interface RuleConnection {
  id: string
  ruleId?: string
  file1FieldPath: string
  file2FieldPath: string
  operator: RuleOperator
  sequenceNum: number
  preActions: ReconciliationRulePreActionEntry[]
}

interface EditablePreAction extends ReconciliationRulePreActionEntry {
  id: string
}

interface Point {
  x: number
  y: number
}

interface LineLayout extends Point {
  x1: number
  y1: number
  x2: number
  y2: number
  midX: number
  midY: number
}

interface PendingConnection {
  side: RuleSide
  fieldPath: string
  index: number
  pointerId: number
  drawing: boolean
  startX: number
  startY: number
  currentX: number
  currentY: number
}

interface FieldDropTarget {
  side: RuleSide
  fieldPath: string
}

const LONG_PRESS_MS = 320
const FALLBACK_BOARD_WIDTH = 1000
const FIELD_ROW_PITCH = 52
const FIELD_ROW_TOP = 70
const SOURCE_TYPE_API = 'AUT_SRC_API'
const EXCLUSION_POPOVER_WIDTH = 260
const operatorOptions: AppSelectOption[] = [
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
]
const preActionOptions: AppSelectOption[] = [
  { value: 'STRING_TO_INT', label: 'String to int' },
  { value: 'STRING_TO_NUMBER', label: 'String to number' },
]
const validOperators = new Set(operatorOptions.map((option) => option.value))

const router = useRouter()
const draftStore = useReconciliationDraftStore()
const boardRef = ref<HTMLElement | null>(null)
const rulePopoverRef = ref<HTMLElement | null>(null)
const exclusionPopoverRef = ref<HTMLElement | null>(null)
const fieldNodeRefs = new Map<string, HTMLElement>()
const pageError = ref<string | null>(null)
const loadingFields = ref(false)
const nsRestletConfigs = ref<AutomationNsRestletOption[]>([])
const systemRemotes = ref<AutomationSystemRemoteOption[]>([])
const loadedFields = ref<Record<RuleSide, RuleField[]>>({
  file1: [],
  file2: [],
})
const rules = ref<RuleConnection[]>([])
const lineLayouts = ref<Record<string, LineLayout>>({})
const boardSize = ref({ width: FALLBACK_BOARD_WIDTH, height: 520 })
const pendingConnection = ref<PendingConnection | null>(null)
const hoveredDropTarget = ref<FieldDropTarget | null>(null)
const hoveredRuleId = ref<string | null>(null)
const editingRuleId = ref<string | null>(null)
const editingOperator = ref<RuleOperator>('=')
const editingPreActions = ref<EditablePreAction[]>([])
const editingSequence = ref(1)
const editingExclusion = ref<{ side: RuleSide; fieldPath: string } | null>(null)
const editingExclusionValues = ref<string[]>([])
const pendingExclusionValue = ref('')
let longPressTimer: number | null = null
let generatedRuleCounter = 0
let generatedPreActionCounter = 0

const draftState = computed(() => draftStore.ruleSetDraftState)
const draft = computed<ReconciliationRuleSetDraft | null>(() => draftState.value?.draft ?? null)
const file1Title = computed(() => draft.value?.file1SystemLabel || draft.value?.file1SystemEnumId || 'Source 1')
const file2Title = computed(() => draft.value?.file2SystemLabel || draft.value?.file2SystemEnumId || 'Source 2')
const file1Fields = computed(() => withPrimaryField(loadedFields.value.file1, draft.value?.file1PrimaryIdExpression?.[0]))
const file2Fields = computed(() => withPrimaryField(loadedFields.value.file2, draft.value?.file2PrimaryIdExpression?.[0]))
const orderedRules = computed(() => [...rules.value].sort((left, right) => left.sequenceNum - right.sequenceNum || left.id.localeCompare(right.id)))
const boardMinHeight = computed(() => Math.max(430, FIELD_ROW_TOP + (Math.max(file1Fields.value.length, file2Fields.value.length, 3) * FIELD_ROW_PITCH) + 96))
const isDrawing = computed(() => pendingConnection.value?.drawing === true)
const editingRule = computed(() => orderedRules.value.find((rule) => rule.id === editingRuleId.value) ?? null)
const editingPreActionFieldOptions = computed<AppSelectOption[]>(() => {
  const rule = editingRule.value
  if (!rule) return []

  return [
    { value: 'file1', label: `${formatFieldKey(rule.file1FieldPath)} - ${file1Title.value}` },
    { value: 'file2', label: `${formatFieldKey(rule.file2FieldPath)} - ${file2Title.value}` },
  ]
})
const activeRule = computed(() => editingRule.value ?? orderedRules.value.find((rule) => rule.id === hoveredRuleId.value) ?? null)
const drawingLinePath = computed(() => {
  const pending = pendingConnection.value
  if (!pending?.drawing) return ''

  return curvePath({
    x1: pending.startX,
    y1: pending.startY,
    x2: pending.currentX,
    y2: pending.currentY,
  })
})

function fieldRefKey(side: RuleSide, fieldPath: string): string {
  return `${side}:${fieldPath}`
}

function fieldRefKeys(side: RuleSide, fieldPath: string): string[] {
  const aliases = buildReconciliationFieldPathAliases(fieldPath)
  if (aliases.size === 0) return [fieldRefKey(side, fieldPath)]

  return [...aliases].map((alias) => fieldRefKey(side, alias))
}

function setFieldNodeRef(side: RuleSide, fieldPath: string, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    fieldRefKeys(side, fieldPath).forEach((key) => fieldNodeRefs.set(key, element))
    return
  }

  fieldRefKeys(side, fieldPath).forEach((key) => fieldNodeRefs.delete(key))
}

function normalizeOperator(value: string | undefined): RuleOperator {
  return validOperators.has(value ?? '') ? value as RuleOperator : '='
}

const normalizeFieldPathValue = normalizeReconciliationFieldPath
const sameField = fieldsReferenceSamePath
const formatFieldKey = formatReconciliationFieldKey

function toRuleField(field: JsonSchemaField): RuleField {
  return {
    fieldPath: field.fieldPath,
    label: field.fieldName?.trim() || formatFieldKey(field.fieldPath),
    type: field.type,
    required: field.required,
  }
}

function toApiRuleField(field: AutomationPrimaryIdOption): RuleField | null {
  const fieldPath = normalizeFieldPathValue(field.fieldPath)
  if (!fieldPath) return null

  return {
    fieldPath,
    label: field.label?.trim() || formatFieldKey(fieldPath),
    type: field.type,
    required: true,
  }
}

function withPrimaryField(fields: RuleField[], primaryExpression: string | undefined): RuleField[] {
  const primaryPath = normalizeFieldPathValue(primaryExpression)
  if (!primaryPath || fields.some((field) => sameField(field.fieldPath, primaryPath))) return fields

  return [
    {
      fieldPath: primaryPath,
      label: formatFieldKey(primaryPath),
      type: 'id',
      required: true,
    },
    ...fields,
  ]
}

function sourceUsesApi(side: RuleSide): boolean {
  const sourceTypeEnumId = side === 'file1'
    ? draft.value?.file1SourceTypeEnumId
    : draft.value?.file2SourceTypeEnumId
  return sourceTypeEnumId === SOURCE_TYPE_API
}

function sourceConfigMatches(optionConfigId: string | undefined, selectedConfigId: string | undefined): boolean {
  if (!selectedConfigId?.trim()) return true
  return optionConfigId?.trim() === selectedConfigId.trim()
}

function selectedApiSourceOption(side: RuleSide): AutomationNsRestletOption | AutomationSystemRemoteOption | null {
  if (!draft.value) return null

  const nsRestletConfigId = side === 'file1'
    ? draft.value.file1NsRestletConfigId
    : draft.value.file2NsRestletConfigId
  const systemMessageRemoteId = side === 'file1'
    ? draft.value.file1SystemMessageRemoteId
    : draft.value.file2SystemMessageRemoteId
  const sourceConfigId = side === 'file1'
    ? draft.value.file1SourceConfigId
    : draft.value.file2SourceConfigId

  if (nsRestletConfigId?.trim()) {
    return nsRestletConfigs.value.find((config) => (
      config.nsRestletConfigId === nsRestletConfigId.trim()
      && sourceConfigMatches(config.sourceConfigId, sourceConfigId)
    )) ?? null
  }

  if (systemMessageRemoteId?.trim()) {
    return systemRemotes.value.find((remote) => (
      remote.systemMessageRemoteId === systemMessageRemoteId.trim()
      && sourceConfigMatches(remote.sourceConfigId || remote.optionKey, sourceConfigId)
    )) ?? null
  }

  return null
}

const pageAbortController = new AbortController()
let submitController: AbortController | null = null

async function ensureApiSourceOptionsLoaded(): Promise<void> {
  if (!sourceUsesApi('file1') && !sourceUsesApi('file2')) return
  if (nsRestletConfigs.value.length || systemRemotes.value.length) return

  const response = await reconciliationFacade.listAutomationSourceOptions(pageAbortController.signal)
  nsRestletConfigs.value = response.nsRestletConfigs ?? []
  systemRemotes.value = response.systemRemotes ?? []
}

function loadApiSourceFields(side: RuleSide): void {
  const apiFields = selectedApiSourceOption(side)?.primaryIdOptions ?? []
  loadedFields.value = {
    ...loadedFields.value,
    [side]: apiFields
      .map(toApiRuleField)
      .filter((field): field is RuleField => field !== null),
  }
}

function fieldSubtitle(field: RuleField): string {
  return field.fieldPath
}

function fieldPathSegments(field: RuleField): string[] {
  const path = fieldSubtitle(field)
  if (!path) return []

  const segments: string[] = []
  let segment = ''
  let bracketDepth = 0
  for (const char of path) {
    segment += char
    if (char === '[') {
      bracketDepth += 1
    } else if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1)
    }

    if (char === '.' && bracketDepth === 0) {
      segments.push(segment)
      segment = ''
    }
  }

  if (segment) {
    segments.push(segment)
  }

  return segments
}

function schemaInput(side: RuleSide): { schemaId?: string, schemaName?: string } {
  if (!draft.value) return {}
  return side === 'file1'
    ? {
      schemaId: draft.value.file1JsonSchemaId,
      schemaName: draft.value.file1SchemaFileName,
    }
    : {
      schemaId: draft.value.file2JsonSchemaId,
      schemaName: draft.value.file2SchemaFileName,
    }
}

async function resolveSchemaId(side: RuleSide): Promise<string> {
  const { schemaId, schemaName } = schemaInput(side)
  if (schemaId?.trim()) {
    return schemaId.trim()
  }

  const normalizedSchemaName = schemaName?.trim()
  if (!normalizedSchemaName) return ''

  const response = await jsonSchemaFacade.get({ schemaName: normalizedSchemaName }, pageAbortController.signal)
  if (!response.schemaData) return schemaId?.trim() ?? ''

  return response.schemaData.jsonSchemaId
}

async function loadSourceFields(side: RuleSide): Promise<void> {
  if (sourceUsesApi(side)) {
    loadApiSourceFields(side)
    return
  }

  const schemaId = await resolveSchemaId(side)
  if (!schemaId?.trim()) return

  const response = await jsonSchemaFacade.flatten({ jsonSchemaId: schemaId.trim() }, pageAbortController.signal)
  const comparableFields = (response.fieldList ?? [])
    .filter((field) => field.type !== 'object' && field.type !== 'array')
    .map(toRuleField)

  loadedFields.value = {
    ...loadedFields.value,
    [side]: comparableFields,
  }
}

function normalizeRuleSequences(nextRules: RuleConnection[]): RuleConnection[] {
  return nextRules
    .filter((rule) => rule.sequenceNum > 0)
    .sort((left, right) => left.sequenceNum - right.sequenceNum || left.id.localeCompare(right.id))
    .map((rule, index) => ({ ...rule, sequenceNum: index + 1 }))
}

function hydrateRules(): void {
  const draftRules = draft.value?.rules ?? []
  rules.value = normalizeRuleSequences(draftRules.map((rule, index) => ({
    id: rule.ruleId || `draft-rule-${index + 1}`,
    ruleId: rule.ruleId,
    file1FieldPath: normalizeFieldPathValue(rule.file1FieldPath),
    file2FieldPath: normalizeFieldPathValue(rule.file2FieldPath),
    operator: normalizeOperator(rule.operator),
    sequenceNum: rule.sequenceNum,
    preActions: normalizePreActions(rule.preActions),
  })))
}

async function loadEditorData(): Promise<void> {
  if (!draft.value) return

  loadingFields.value = true
  pageError.value = null
  hydrateRules()
  try {
    await ensureApiSourceOptionsLoaded()
    await Promise.all([
      loadSourceFields('file1'),
      loadSourceFields('file2'),
    ])
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof ApiCallError ? error.message : 'Unable to load source fields.'
  } finally {
    loadingFields.value = false
    await nextTick()
    updateLineLayout()
  }
}

function fallbackFieldAnchor(side: RuleSide, fieldPath: string): Point {
  const fields = side === 'file1' ? file1Fields.value : file2Fields.value
  const fieldIndex = Math.max(0, fields.findIndex((field) => sameField(field.fieldPath, fieldPath)))
  return {
    x: side === 'file1' ? boardSize.value.width * 0.32 : boardSize.value.width * 0.68,
    y: FIELD_ROW_TOP + (fieldIndex * FIELD_ROW_PITCH) + 20,
  }
}

function resolveFieldNode(side: RuleSide, fieldPath: string): HTMLElement | null {
  for (const key of fieldRefKeys(side, fieldPath)) {
    const node = fieldNodeRefs.get(key)
    if (node) return node
  }

  return null
}

function resolveFieldAnchor(side: RuleSide, fieldPath: string): Point {
  const board = boardRef.value
  const node = resolveFieldNode(side, fieldPath)
  if (!board || !node) return fallbackFieldAnchor(side, fieldPath)

  const boardRect = board.getBoundingClientRect()
  const nodeRect = node.getBoundingClientRect()
  if (boardRect.width <= 0 || nodeRect.width <= 0) return fallbackFieldAnchor(side, fieldPath)

  return {
    x: side === 'file1' ? nodeRect.right - boardRect.left : nodeRect.left - boardRect.left,
    y: nodeRect.top - boardRect.top + (nodeRect.height / 2),
  }
}

function updateLineLayout(): void {
  const board = boardRef.value
  if (!board) return

  const boardRect = board.getBoundingClientRect()
  boardSize.value = {
    width: boardRect.width > 0 ? boardRect.width : FALLBACK_BOARD_WIDTH,
    height: boardRect.height > 0 ? boardRect.height : boardMinHeight.value,
  }

  lineLayouts.value = orderedRules.value.reduce<Record<string, LineLayout>>((layouts, rule) => {
    const start = resolveFieldAnchor('file1', rule.file1FieldPath)
    const end = resolveFieldAnchor('file2', rule.file2FieldPath)
    layouts[rule.id] = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      midX: (start.x + end.x) / 2,
      midY: (start.y + end.y) / 2,
    }
    return layouts
  }, {})
}

function fallbackRuleLayout(rule: RuleConnection): LineLayout {
  const start = fallbackFieldAnchor('file1', rule.file1FieldPath)
  const end = fallbackFieldAnchor('file2', rule.file2FieldPath)
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
    midX: (start.x + end.x) / 2,
    midY: (start.y + end.y) / 2,
  }
}

function layoutForRule(rule: RuleConnection): LineLayout {
  return lineLayouts.value[rule.id] ?? fallbackRuleLayout(rule)
}

function pillCenterSpanForRule(rule: RuleConnection): { leftCenter: number, rightCenter: number } | null {
  const board = boardRef.value
  const leftNode = resolveFieldNode('file1', rule.file1FieldPath)
  const rightNode = resolveFieldNode('file2', rule.file2FieldPath)
  if (!board || !leftNode || !rightNode) return null

  const boardRect = board.getBoundingClientRect()
  const leftRect = leftNode.getBoundingClientRect()
  const rightRect = rightNode.getBoundingClientRect()
  if (boardRect.width <= 0 || leftRect.width <= 0 || rightRect.width <= 0) return null

  const leftCenter = leftRect.left - boardRect.left + (leftRect.width / 2)
  const rightCenter = rightRect.left - boardRect.left + (rightRect.width / 2)
  return rightCenter > leftCenter ? { leftCenter, rightCenter } : null
}

function operatorPopoverWidth(rule: RuleConnection): number {
  const span = pillCenterSpanForRule(rule)
  return Math.max(1, span ? span.rightCenter - span.leftCenter : boardSize.value.width / 2)
}

function curvePath(points: { x1: number, y1: number, x2: number, y2: number }): string {
  const handle = Math.max(70, Math.abs(points.x2 - points.x1) * 0.36)
  return `M ${points.x1} ${points.y1} C ${points.x1 + handle} ${points.y1} ${points.x2 - handle} ${points.y2} ${points.x2} ${points.y2}`
}

function ruleLinePath(rule: RuleConnection): string {
  return curvePath(layoutForRule(rule))
}

function operatorBoxStyle(rule: RuleConnection): Record<string, string> {
  const layout = layoutForRule(rule)
  return {
    left: `${layout.midX}px`,
    top: `${layout.midY}px`,
    zIndex: isRuleActive(rule) ? '4' : '2',
  }
}

function operatorPopoverStyle(rule: RuleConnection): Record<string, string> {
  return {
    left: `${boardSize.value.width / 2}px`,
    top: `${boardSize.value.height / 2}px`,
    width: `${operatorPopoverWidth(rule)}px`,
  }
}

function excludeFiltersFor(side: RuleSide): SourceExcludeFilter[] {
  return (side === 'file1' ? draft.value?.file1ExcludeFilters : draft.value?.file2ExcludeFilters) ?? []
}

function hasExclusion(side: RuleSide, fieldPath: string): boolean {
  return excludeFiltersFor(side).some((filter) => filter.fieldExpression === fieldPath && filter.values.length > 0)
}

function openExclusionEditor(side: RuleSide, fieldPath: string): void {
  editingExclusion.value = { side, fieldPath }
  editingExclusionValues.value = [...(excludeFiltersFor(side).find((filter) => filter.fieldExpression === fieldPath)?.values ?? [])]
  pendingExclusionValue.value = ''
}

function commitPendingExclusionValue(): void {
  const values = parseExcludeFilterValues(pendingExclusionValue.value)
  for (const value of values) {
    if (!editingExclusionValues.value.includes(value)) editingExclusionValues.value.push(value)
  }
  pendingExclusionValue.value = ''
}

function applyExclusionEdit(): void {
  const editing = editingExclusion.value
  if (!editing || !draft.value) return

  const others = excludeFiltersFor(editing.side).filter((filter) => filter.fieldExpression !== editing.fieldPath)
  const next = editingExclusionValues.value.length
    ? [...others, { fieldExpression: editing.fieldPath, operator: 'EXCLUDE_IN', values: [...editingExclusionValues.value] }]
    : others
  // Always assign the side, never leave it undefined: undefined means "no opinion" to the backend
  // and would leave stale rows in place after the operator cleared them here.
  if (editing.side === 'file1') draft.value.file1ExcludeFilters = normalizeExcludeFilters(next)
  else draft.value.file2ExcludeFilters = normalizeExcludeFilters(next)
  editingExclusion.value = null
}

function deleteEditingExclusion(): void {
  editingExclusionValues.value = []
  applyExclusionEdit()
}

function exclusionPopoverFallbackStyle(): Record<string, string> {
  return {
    left: `${boardSize.value.width / 2}px`,
    top: `${boardSize.value.height / 2}px`,
    width: `${EXCLUSION_POPOVER_WIDTH}px`,
  }
}

function exclusionPopoverStyle(editing: { side: RuleSide; fieldPath: string }): Record<string, string> {
  const board = boardRef.value
  const node = resolveFieldNode(editing.side, editing.fieldPath)
  if (!board || !node) return exclusionPopoverFallbackStyle()

  const boardRect = board.getBoundingClientRect()
  const nodeRect = node.getBoundingClientRect()
  if (boardRect.width <= 0 || nodeRect.width <= 0) return exclusionPopoverFallbackStyle()

  const halfWidth = EXCLUSION_POPOVER_WIDTH / 2
  const margin = 24
  const rawLeft = editing.side === 'file1'
    ? nodeRect.right - boardRect.left + margin + halfWidth
    : nodeRect.left - boardRect.left - margin - halfWidth
  const clampedLeft = Math.min(Math.max(rawLeft, halfWidth), Math.max(halfWidth, boardSize.value.width - halfWidth))
  const rawTop = nodeRect.top - boardRect.top + (nodeRect.height / 2)
  const clampedTop = Math.min(Math.max(rawTop, 40), Math.max(40, boardSize.value.height - 40))

  return {
    left: `${clampedLeft}px`,
    top: `${clampedTop}px`,
    width: `${EXCLUSION_POPOVER_WIDTH}px`,
  }
}

function boardPointFromEvent(event: PointerEvent): Point {
  const board = boardRef.value
  const fallback = pendingConnection.value
    ? { x: pendingConnection.value.startX, y: pendingConnection.value.startY }
    : { x: boardSize.value.width / 2, y: boardSize.value.height / 2 }
  if (!board) return fallback

  const rect = board.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return fallback

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function clearLongPressTimer(): void {
  if (longPressTimer === null) return

  window.clearTimeout(longPressTimer)
  longPressTimer = null
}

function handleFieldPointerDown(event: PointerEvent, side: RuleSide, fieldPath: string, index: number): void {
  if (typeof event.button === 'number' && event.button !== 0) return

  event.preventDefault()
  clearLongPressTimer()
  const anchor = resolveFieldAnchor(side, fieldPath)
  const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 1
  pendingConnection.value = {
    side,
    fieldPath,
    index,
    pointerId,
    drawing: false,
    startX: anchor.x,
    startY: anchor.y,
    currentX: anchor.x,
    currentY: anchor.y,
  }

  const target = event.currentTarget
  if (target instanceof HTMLElement && typeof target.setPointerCapture === 'function') {
    target.setPointerCapture(pointerId)
  }

  longPressTimer = window.setTimeout(() => {
    if (!pendingConnection.value || pendingConnection.value.pointerId !== pointerId) return

    pendingConnection.value = {
      ...pendingConnection.value,
      drawing: true,
    }
  }, LONG_PRESS_MS)
}

function releaseFieldPointerCapture(event: PointerEvent): void {
  const target = event.currentTarget
  if (!(target instanceof HTMLElement) || typeof target.releasePointerCapture !== 'function') return

  const pointerId = Number.isFinite(event.pointerId) ? event.pointerId : 1
  if (typeof target.hasPointerCapture === 'function' && !target.hasPointerCapture(pointerId)) return

  target.releasePointerCapture(pointerId)
}

function fieldDropTargetFromElement(element: Element | null): FieldDropTarget | null {
  const fieldElement = element?.closest<HTMLElement>('[data-rule-side][data-field-path]')
  if (!fieldElement || !boardRef.value?.contains(fieldElement)) return null

  const side = fieldElement.dataset.ruleSide
  const fieldPath = fieldElement.dataset.fieldPath
  if ((side !== 'file1' && side !== 'file2') || !fieldPath) return null

  return { side, fieldPath }
}

function resolveFieldDropTarget(event: PointerEvent, fallbackSide: RuleSide, fallbackFieldPath: string): FieldDropTarget {
  return fieldDropTargetFromEvent(event) ?? {
    side: fallbackSide,
    fieldPath: fallbackFieldPath,
  }
}

function fieldDropTargetFromEvent(event: PointerEvent): FieldDropTarget | null {
  const elementUnderPointer = typeof document.elementFromPoint === 'function'
    ? document.elementFromPoint(event.clientX, event.clientY)
    : null

  return fieldDropTargetFromElement(elementUnderPointer)
}

function updateHoveredDropTarget(event: PointerEvent, pending: PendingConnection): void {
  const nextTarget = fieldDropTargetFromEvent(event)
  hoveredDropTarget.value = nextTarget && nextTarget.side !== pending.side ? nextTarget : null
}

function isConnectionFieldHighlighted(side: RuleSide, fieldPath: string): boolean {
  const pending = pendingConnection.value
  if (!pending) return false
  if (pending.side === side && sameField(pending.fieldPath, fieldPath)) return true

  const target = hoveredDropTarget.value
  return pending.drawing && target?.side === side && sameField(target.fieldPath, fieldPath)
}

function isRuleActive(rule: RuleConnection): boolean {
  return activeRule.value?.id === rule.id
}

function isActiveRuleField(side: RuleSide, fieldPath: string): boolean {
  const rule = activeRule.value
  if (!rule) return false

  return side === 'file1'
    ? sameField(rule.file1FieldPath, fieldPath)
    : sameField(rule.file2FieldPath, fieldPath)
}

function setHoveredRule(ruleId: string): void {
  hoveredRuleId.value = ruleId
}

function clearHoveredRule(ruleId: string): void {
  if (hoveredRuleId.value !== ruleId) return

  hoveredRuleId.value = null
}

function handleBoardPointerMove(event: PointerEvent): void {
  const pending = pendingConnection.value
  if (!pending?.drawing) return

  const point = boardPointFromEvent(event)
  pendingConnection.value = {
    ...pending,
    currentX: point.x,
    currentY: point.y,
  }
  updateHoveredDropTarget(event, pending)
}

function handleFieldPointerUp(event: PointerEvent, side: RuleSide, fieldPath: string): void {
  const pending = pendingConnection.value
  const dropTarget = hoveredDropTarget.value ?? resolveFieldDropTarget(event, side, fieldPath)
  const shouldConnect = pending?.drawing && pending.side !== dropTarget.side
  event.preventDefault()
  releaseFieldPointerCapture(event)
  cancelPendingConnection()

  if (!pending || !shouldConnect) return

  connectFields(pending.side, pending.fieldPath, dropTarget.side, dropTarget.fieldPath)
}

function handleBoardPointerUp(): void {
  cancelPendingConnection()
}

function cancelPendingConnection(): void {
  clearLongPressTimer()
  pendingConnection.value = null
  hoveredDropTarget.value = null
}

function nextGeneratedRuleId(): string {
  const existingRuleIds = new Set(rules.value.map((rule) => rule.id))
  let nextRuleId = ''
  do {
    generatedRuleCounter += 1
    nextRuleId = `draft-rule-${generatedRuleCounter}`
  } while (existingRuleIds.has(nextRuleId))

  return nextRuleId
}

function connectFields(sourceSide: RuleSide, sourceFieldPath: string, targetSide: RuleSide, targetFieldPath: string): void {
  if (sourceSide === targetSide) return

  const file1FieldPath = sourceSide === 'file1' ? sourceFieldPath : targetFieldPath
  const file2FieldPath = sourceSide === 'file2' ? sourceFieldPath : targetFieldPath
  const existingRule = rules.value.find((rule) => (
    sameField(rule.file1FieldPath, file1FieldPath)
    && sameField(rule.file2FieldPath, file2FieldPath)
  ))

  if (existingRule) {
    openRuleEditor(existingRule.id)
    return
  }

  const newRule: RuleConnection = {
    id: nextGeneratedRuleId(),
    file1FieldPath: normalizeFieldPathValue(file1FieldPath),
    file2FieldPath: normalizeFieldPathValue(file2FieldPath),
    operator: '=',
    sequenceNum: Math.max(0, ...rules.value.map((rule) => rule.sequenceNum)) + 1,
    preActions: [],
  }

  rules.value = normalizeRuleSequences([...rules.value, newRule])
  openRuleEditor(newRule.id)
}

function openRuleEditor(ruleId: string): void {
  const rule = rules.value.find((candidate) => candidate.id === ruleId)
  if (!rule) return

  editingRuleId.value = rule.id
  editingOperator.value = rule.operator
  editingPreActions.value = rule.preActions.map(toEditablePreAction)
  editingSequence.value = rule.sequenceNum
}

function closeRuleEditor(): void {
  editingRuleId.value = null
  editingPreActions.value = []
}

function toEditablePreAction(preAction: ReconciliationRulePreActionEntry): EditablePreAction {
  generatedPreActionCounter += 1
  return {
    id: `pre-action-${generatedPreActionCounter}`,
    fieldSide: preAction.fieldSide,
    action: preAction.action,
  }
}

function addPreActionRow(): void {
  editingPreActions.value = [
    ...editingPreActions.value,
    toEditablePreAction({ fieldSide: 'file1', action: 'STRING_TO_INT' }),
  ]
}

function deletePreActionRow(preActionId: string): void {
  editingPreActions.value = editingPreActions.value.filter((preAction) => preAction.id !== preActionId)
}

function resequenceRule(
  ruleId: string,
  nextSequence: number,
  nextOperator: RuleOperator,
  nextPreActions: ReconciliationRulePreActionEntry[],
): RuleConnection[] {
  const sortedRules = orderedRules.value.map((rule) => (
    rule.id === ruleId ? { ...rule, operator: nextOperator, preActions: nextPreActions } : { ...rule }
  ))
  const targetRule = sortedRules.find((rule) => rule.id === ruleId)
  if (!targetRule) return sortedRules

  const remainingRules = sortedRules.filter((rule) => rule.id !== ruleId)
  const insertIndex = Math.min(Math.max(nextSequence, 1), sortedRules.length) - 1
  remainingRules.splice(insertIndex, 0, targetRule)
  return remainingRules.map((rule, index) => ({ ...rule, sequenceNum: index + 1 }))
}

function applyRuleEdit(): void {
  const rule = editingRule.value
  if (!rule) return

  const nextSequence = Number.isFinite(editingSequence.value) ? Math.trunc(editingSequence.value) : rule.sequenceNum
  rules.value = resequenceRule(
    rule.id,
    nextSequence,
    normalizeOperator(editingOperator.value),
    normalizePreActions(editingPreActions.value),
  )
  closeRuleEditor()
}

function deleteEditingRule(): void {
  const rule = editingRule.value
  if (!rule) return

  rules.value = normalizeRuleSequences(rules.value.filter((candidate) => candidate.id !== rule.id))
  closeRuleEditor()
  void nextTick(updateLineLayout)
}

function handleWindowPointerDown(event: Event): void {
  if (!editingRuleId.value && !editingExclusion.value) return

  const target = event.target
  if (!(target instanceof Node)) return

  if (editingRuleId.value && !rulePopoverRef.value?.contains(target)) {
    closeRuleEditor()
  }

  if (editingExclusion.value && !exclusionPopoverRef.value?.contains(target)) {
    editingExclusion.value = null
  }
}

function buildDraftWithRules(): ReconciliationRuleSetDraft | null {
  if (!draft.value) return null

  const draftRules: ReconciliationRuleSetDraftRule[] = orderedRules.value.map((rule) => ({
    ...(rule.ruleId ? { ruleId: rule.ruleId } : {}),
    file1FieldPath: rule.file1FieldPath,
    file2FieldPath: rule.file2FieldPath,
    operator: rule.operator,
    sequenceNum: rule.sequenceNum,
    ...(rule.preActions.length ? { preActions: rule.preActions } : {}),
  }))

  return {
    ...draft.value,
    rules: draftRules,
  }
}

function savedRunRuleToDraftRule(rule: SavedRunRule, index: number): ReconciliationRuleSetDraftRule | null {
  const file1FieldPath = rule.file1FieldPath?.trim()
  const file2FieldPath = rule.file2FieldPath?.trim()
  if (!file1FieldPath || !file2FieldPath) return null

  const preActions = normalizePreActions(rule.preActions)
  return {
    ruleId: rule.ruleId,
    file1FieldPath,
    file2FieldPath,
    operator: normalizeOperator(rule.operator),
    sequenceNum: rule.sequenceNum ?? index + 1,
    preActions: preActions.length
      ? preActions
      : readReconciliationRuleExpressionPreActions(rule.expression),
    ruleText: rule.ruleText,
    ruleLogic: rule.ruleLogic,
    ruleType: rule.ruleType,
    expression: rule.expression,
    enabled: rule.enabled,
    severity: rule.severity,
  }
}

async function persistSavedRunRules(nextDraft: ReconciliationRuleSetDraft): Promise<ReconciliationRuleSetDraft> {
  if (!nextDraft.savedRunId?.trim()) return nextDraft

  submitController?.abort()
  submitController = new AbortController()
  const submitSignal = submitController.signal

  const response = await reconciliationFacade.saveRuleSetRun(buildSaveRuleSetRunPayload(nextDraft), submitSignal)
  const savedRules = response.savedRun?.rules
  if (!Array.isArray(savedRules)) return nextDraft

  return {
    ...nextDraft,
    runName: response.savedRun?.runName || nextDraft.runName,
    description: response.savedRun?.description ?? nextDraft.description,
    rules: savedRules
      .map(savedRunRuleToDraftRule)
      .filter((rule): rule is ReconciliationRuleSetDraftRule => rule !== null),
  }
}

async function finishRuleEdit(): Promise<void> {
  const nextDraft = buildDraftWithRules()
  if (!nextDraft) return

  loadingFields.value = true
  pageError.value = null
  let persistedDraft: ReconciliationRuleSetDraft
  try {
    persistedDraft = await persistSavedRunRules(nextDraft)
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') {
      loadingFields.value = false
      return
    }
    pageError.value = error instanceof ApiCallError ? error.message : 'Unable to save rules.'
    loadingFields.value = false
    return
  }

  const origin = draftStore.workflowOrigin
  draftStore.setRuleSetDraft(persistedDraft, 'ruleset-manager')
  await router.push({ path: origin?.path ?? '/reconciliation/ruleset-manager' })
  loadingFields.value = false
}

async function cancelRuleEdit(): Promise<void> {
  if (!draft.value) return

  const origin = draftStore.workflowOrigin
  draftStore.setRuleSetDraft(draft.value, 'ruleset-manager')
  await router.push({ path: origin?.path ?? '/reconciliation/ruleset-manager' })
}

watch([orderedRules, file1Fields, file2Fields], () => {
  void nextTick(updateLineLayout)
})

onMounted(() => {
  void loadEditorData()
  window.addEventListener('resize', updateLineLayout)
  window.addEventListener('pointerdown', handleWindowPointerDown)
})

onBeforeUnmount(() => {
  clearLongPressTimer()
  window.removeEventListener('resize', updateLineLayout)
  window.removeEventListener('pointerdown', handleWindowPointerDown)
  pageAbortController.abort()
  submitController?.abort()
})
</script>

<style scoped>
.workflow-page--ruleset-editor.workflow-page--edit :deep(.workflow-shell) {
  padding-top: 0;
}

.ruleset-editor-form {
  width: min(var(--workflow-section-width), 100%);
}

.ruleset-editor-form :deep(.wizard-prompt-row) {
  display: none;
}

/* This form is board-width, so the default left-aligned wizard actions land at the
   viewport edge; center them under the board like other pages' action rows. */
.ruleset-editor-form :deep(.wizard-actions) {
  justify-content: center;
}

.ruleset-field-column header span,
.ruleset-rule-popover label > span,
.ruleset-pre-action-header > span {
  color: var(--text-muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ruleset-editor-board {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(11rem, 18rem) minmax(7.5rem, 1fr) minmax(11rem, 18rem);
  column-gap: clamp(1rem, 2vw, 1.5rem);
  row-gap: 0.55rem;
  align-items: start;
  justify-content: center;
  padding: 1rem 0 3rem;
  --ruleset-pen-cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http://www.w3.org/2000/svg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%3E%3Cpath%20fill%3D%27%23ffffff%27%20stroke%3D%27%23000000%27%20stroke-width%3D%271.5%27%20stroke-linejoin%3D%27round%27%20stroke-linecap%3D%27round%27%20d%3D%27M5%2020l4-1%2011-11-3-3L6%2016z%27/%3E%3C/svg%3E") 3 20, crosshair;
  cursor: var(--ruleset-pen-cursor);
}

.ruleset-editor-board--popup-open > :not(.ruleset-rule-popover) {
  filter: blur(var(--popup-background-blur));
  opacity: var(--popup-background-opacity);
}

.ruleset-editor-lines {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.ruleset-editor-line {
  fill: none;
  stroke: color-mix(in oklab, var(--text) 58%, transparent);
  stroke-width: 2;
  stroke-linecap: round;
  transition: filter 120ms ease, stroke 120ms ease, stroke-width 120ms ease;
}

.ruleset-editor-line--active {
  stroke: color-mix(in oklab, var(--text) 88%, var(--accent));
  stroke-width: 3.4;
  filter:
    drop-shadow(0 0 0.35rem color-mix(in oklab, var(--accent) 42%, transparent))
    drop-shadow(0 0 0.12rem color-mix(in oklab, var(--text) 45%, transparent));
}

.ruleset-editor-line--draft {
  stroke-dasharray: 7 7;
  stroke: var(--text);
}

.ruleset-field-column {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0.55rem;
  align-content: start;
}

.ruleset-field-column--left {
  grid-column: 1;
}

.ruleset-field-column--right {
  grid-column: 3;
}

.ruleset-field-column header {
  display: grid;
  gap: 0.25rem;
  min-height: 3rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
}

.ruleset-field-item {
  position: relative;
  display: grid;
  gap: 0.12rem;
  min-height: 2.75rem;
  width: 100%;
  padding: 0.48rem 0.75rem;
  border-radius: 999px;
  /* The pill is a div (see the exclusion-mark comment below), not a <button>, so it no longer
     picks up the global `button { border: 1px solid var(--border); }` reset — the border must be
     spelled out in full here or it disappears. */
  border: 1px solid color-mix(in oklab, var(--border) 80%, var(--text) 20%);
  background: color-mix(in oklab, var(--surface-2) 88%, var(--surface));
  text-align: center;
  cursor: var(--ruleset-pen-cursor) !important;
  user-select: none;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.ruleset-field-item *,
.ruleset-field-item:hover,
.ruleset-field-item:hover * {
  cursor: var(--ruleset-pen-cursor) !important;
}

.ruleset-field-item:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: 2px;
}

.ruleset-field-item:hover {
  background: color-mix(in oklab, var(--surface-2) 80%, var(--text) 20%);
}

.ruleset-field-item--connection-active {
  border-color: color-mix(in oklab, var(--border) 58%, var(--text) 42%);
  background: color-mix(in oklab, var(--surface-2) 68%, var(--text) 32%);
}

.ruleset-field-item--rule-active {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--text));
  background: color-mix(in oklab, var(--surface-2) 78%, var(--accent) 22%);
  box-shadow:
    0 0 0 0.16rem color-mix(in oklab, var(--accent) 18%, transparent),
    0 0.55rem 1.15rem color-mix(in oklab, var(--text) 16%, transparent);
}

.ruleset-field-label {
  overflow: hidden;
  font-size: 0.92rem;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.ruleset-field-meta {
  color: var(--text-muted);
  font-size: 0.64rem;
  line-height: 1.2;
  hyphens: none;
  overflow-wrap: normal;
  white-space: normal;
  word-break: normal;
}

.ruleset-field-path-segment {
  display: inline-block;
}

/* An exclusion acts on one source field only — it never leaves the pill, so it has no line and
   no operator box. The pill instead carries this small mark; clicking it opens the same popover
   chrome the operator boxes use. It has to be a real <button> nested inside the pill for keyboard
   + a11y, which is why the pill itself became a <div role="button"> above (a button cannot
   validly nest inside a button). */
.ruleset-field-exclude {
  position: absolute;
  top: 50%;
  width: 1.55rem;
  height: 1.55rem;
  min-height: 0;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border-color: color-mix(in oklab, var(--border) 80%, var(--text) 20%);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1;
  transform: translateY(-50%);
  opacity: 0;
  transition: opacity 120ms ease, border-color 120ms ease, background 120ms ease;
}

/* Outer edge only, away from board centre: the connection-line anchor for each side is the
   centre-facing pill edge (file1 anchors from its right edge, file2 from its left — see
   resolveFieldAnchor), so the mark sits on the opposite edge to stay clear of where a line
   is drawn from. */
.ruleset-field-column--left .ruleset-field-exclude { left: -0.775rem; }
.ruleset-field-column--right .ruleset-field-exclude { right: -0.775rem; }

.ruleset-field-item:hover .ruleset-field-exclude,
.ruleset-field-exclude:focus-visible { opacity: 1; }

/* Set: always visible, because with no line and no box it is the only evidence the
   exclusion exists. */
.ruleset-field-exclude--set {
  opacity: 1;
  border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 70%, var(--accent) 30%);
  color: var(--text);
  box-shadow: 0 0 0 0.14rem color-mix(in oklab, var(--accent) 16%, transparent);
}

.ruleset-operator-box {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.2rem;
  min-height: 2.15rem;
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  transform: translate(-50%, -50%);
  transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.ruleset-operator-box--active {
  border-color: color-mix(in oklab, var(--accent) 45%, var(--border));
  box-shadow:
    0 0 0 0.14rem color-mix(in oklab, var(--accent) 16%, transparent),
    0 0.4rem 0.9rem color-mix(in oklab, var(--text) 15%, transparent);
}

.ruleset-operator-box span {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.ruleset-rule-popover {
  position: absolute;
  z-index: 5;
  display: grid;
  gap: 0.8rem;
  padding: 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  transform: translate(-50%, -50%);
}

.ruleset-rule-popover label {
  gap: 0.32rem;
}

.ruleset-pre-action-section {
  display: grid;
  gap: 0.55rem;
}

.ruleset-pre-action-header {
  display: block;
}

.ruleset-pre-action-add-row {
  display: flex;
  justify-content: flex-start;
}

.ruleset-pre-action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.45rem;
  align-items: end;
}

.ruleset-pre-action-add {
  width: 1.9rem;
  height: 1.9rem;
  min-width: 1.9rem;
  min-height: 1.9rem;
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
}

.ruleset-pre-action-delete {
  width: 2.3rem;
  height: 2.3rem;
  min-width: 2.3rem;
  min-height: 2.3rem;
  padding: 0;
}

.ruleset-pre-action-delete svg {
  width: 1.2rem;
  height: 1.2rem;
}

.ruleset-rule-popover input {
  min-height: 2.3rem;
  padding: 0.45rem 0.62rem;
}

.ruleset-rule-popover-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

/* Same type-a-value-press-Enter chip interaction and markup as WorkflowChipTextInput /
   WorkflowSelect's multi-select chips. Vue scoped styles don't cross component boundaries, so the
   classes are inlined here rather than reused, keeping the visual identical without a shared
   dependency. */
.workflow-select-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.45rem;
}

.workflow-select-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid color-mix(in oklab, var(--text) 14%, transparent);
  border-radius: 999px;
  padding: 0.3rem 0.55rem 0.3rem 0.7rem;
  font-size: 0.85rem;
  background: var(--surface-2);
  color: var(--text);
}

.workflow-select-chip-remove {
  all: unset;
  cursor: pointer;
  opacity: 0.55;
  font-size: 0.85rem;
  line-height: 1;
}

.workflow-select-chip-remove:hover {
  opacity: 1;
}

@media (max-width: 900px) {
  .ruleset-editor-board {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding-bottom: 6rem;
  }

  .ruleset-field-column--left,
  .ruleset-field-column--right {
    grid-column: 1;
  }

  .ruleset-editor-lines,
  .ruleset-operator-box {
    display: none;
  }

  .ruleset-rule-popover {
    position: relative;
    left: auto !important;
    top: auto !important;
    width: 100% !important;
    transform: none;
  }
}
</style>
