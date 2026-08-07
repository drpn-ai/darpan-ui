<template>
  <InlineValidation v-if="loadError" tone="error" :message="loadError" />

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
      <!--
        The board is useless without the drag gesture and nothing on screen teaches it. This ghost
        draws the rule you are meant to draw, keyed to THIS rule set having no rules rather than to
        a seen-it flag on the user: someone who learnt the board months ago and opens a fresh rule
        set gets the reminder, and drawing one real rule retires it for good. An empty board has no
        lines, so at rest it occupies space that was empty anyway.
      -->
      <path
        v-if="ghostRulePath"
        class="ruleset-editor-line ruleset-editor-line--ghost"
        :d="ghostRulePath"
        data-testid="ruleset-ghost-rule"
      />
    </svg>

    <p
      v-if="ghostRulePath"
      class="ruleset-ghost-caption"
      :style="ghostCaptionStyle"
      data-testid="ruleset-ghost-caption"
    >
      {{ GHOST_RULE_CAPTION }}
    </p>

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
        @dblclick="handleFieldDoubleClick('file1', field.fieldPath)"
        @keydown.enter.prevent.stop="handleFieldEnterKey('file1', field.fieldPath)"
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
        <template v-if="supportsExclusions('file1') && hasExclusion('file1', field.fieldPath)">
          <span
            class="ruleset-field-exclude"
            :data-testid="`ruleset-field-exclude-file1-${index}`"
            aria-hidden="true"
          >⊘</span>
          <!-- The mark above is decorative and aria-hidden, so a screen-reader user tabbing
               through fields has no way to tell this one already carries an exclusion. This
               sr-only span (same pattern as CommandPalette.vue's search label) restores that
               signal by extending the pill's own accessible name, without touching the visible
               capability gate. -->
          <span class="sr-only" :data-testid="`ruleset-field-exclude-status-file1-${index}`">Has exclusion</span>
        </template>

        <!-- See the matching note on the file2 column below. -->
        <p
          v-if="exclusionUnavailable?.side === 'file1' && exclusionUnavailable.fieldPath === field.fieldPath"
          class="ruleset-exclusion-unavailable"
          role="status"
          aria-live="polite"
          data-testid="ruleset-exclusion-unavailable"
        >
          {{ exclusionUnavailable.message }}
        </p>
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
        @dblclick="handleFieldDoubleClick('file2', field.fieldPath)"
        @keydown.enter.prevent.stop="handleFieldEnterKey('file2', field.fieldPath)"
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
        <template v-if="supportsExclusions('file2') && hasExclusion('file2', field.fieldPath)">
          <span
            class="ruleset-field-exclude"
            :data-testid="`ruleset-field-exclude-file2-${index}`"
            aria-hidden="true"
          >⊘</span>
          <!-- See the matching comment on the file1 column above. -->
          <span class="sr-only" :data-testid="`ruleset-field-exclude-status-file2-${index}`">Has exclusion</span>
        </template>

        <!--
          Why exclusions are not on offer here, said at the moment the operator asks for them
          rather than as standing copy on every board that will never use them. Sits OUTSIDE its
          column (see the .ruleset-exclusion-unavailable rules) so it explains the pill beside it
          instead of covering the pills below.
        -->
        <p
          v-if="exclusionUnavailable?.side === 'file2' && exclusionUnavailable.fieldPath === field.fieldPath"
          class="ruleset-exclusion-unavailable"
          role="status"
          aria-live="polite"
          data-testid="ruleset-exclusion-unavailable"
        >
          {{ exclusionUnavailable.message }}
        </p>
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
          <button
            id="ruleset-pre-action-title"
            type="button"
            class="ruleset-term"
            data-testid="ruleset-term-pre-actions"
            :aria-describedby="termDefinitionId('pre-actions')"
            @click.prevent.stop
          >
            Pre Actions
          </button>
          <span
            :id="termDefinitionId('pre-actions')"
            class="ruleset-term-definition"
            data-testid="ruleset-term-definition-pre-actions"
          >{{ RULE_TERM_DEFINITIONS['pre-actions'] }}</span>
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
        <button
          type="button"
          class="ruleset-term"
          data-testid="ruleset-term-operator"
          :aria-describedby="termDefinitionId('operator')"
          @click.prevent.stop
        >Operator</button>
        <span
          :id="termDefinitionId('operator')"
          class="ruleset-term-definition"
          data-testid="ruleset-term-definition-operator"
        >{{ RULE_TERM_DEFINITIONS.operator }}</span>
        <AppSelect
          v-model="editingOperator"
          :options="operatorOptions"
          test-id="ruleset-rule-operator-select"
        />
      </label>
      <label>
        <button
          type="button"
          class="ruleset-term"
          data-testid="ruleset-term-sequence"
          :aria-describedby="termDefinitionId('sequence')"
          @click.prevent.stop
        >Sequence</button>
        <span
          :id="termDefinitionId('sequence')"
          class="ruleset-term-definition"
          data-testid="ruleset-term-definition-sequence"
        >{{ RULE_TERM_DEFINITIONS.sequence }}</span>
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

    <!--
      The exclusion editor is a modal, not a pill-anchored popover. It reuses the app-wide
      .popup-workflow-overlay / .popup-workflow-modal pair (settings popups, the run-result popup,
      the ruleset-manager auth popup), so it lands viewport-centred at the same size as every other
      popup in the product instead of being nudged beside its pill at a width that truncated both
      the field expression and the value placeholder.

      The overlay stays pointer-transparent (see .ruleset-exclusion-overlay in the style block): the
      board underneath must keep receiving clicks so that one click on an operator box still closes
      this editor AND opens the rule editor, which is the behaviour the mutual-exclusion spec pins.
      Dismissal still comes from handleWindowPointerDown, unchanged.
    -->
    <div v-if="editingExclusion" class="popup-workflow-overlay ruleset-exclusion-overlay">
      <section
        ref="exclusionPopoverRef"
        class="popup-workflow-modal workflow-panel ruleset-exclusion-popup"
        role="dialog"
        aria-label="Edit exclusion"
        data-testid="ruleset-exclusion-popover"
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
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComponentPublicInstance } from 'vue'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import AppSaveAction from '../ui/AppSaveAction.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, reconciliationFacade } from '../../lib/api/facade'
import type {
  AutomationNsRestletOption,
  AutomationPrimaryIdOption,
  AutomationSystemRemoteOption,
  JsonSchemaField,
} from '../../lib/api/types'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import { normalizeExcludeFilters, parseExcludeFilterValues, type SourceExcludeFilter } from '../../lib/sourceExcludeFilters'
import {
  buildReconciliationFieldPathAliases,
  fieldsReferenceSamePath,
  formatReconciliationFieldKey,
  normalizeReconciliationFieldPath,
  normalizePreActions,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftRule,
  type ReconciliationRulePreActionEntry,
} from '../../lib/reconciliationRuleSetDraft'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

// This board takes no props and emits nothing: it reads and writes the shared reconciliation
// draft store directly. That is what makes it droppable both into the standalone rule-set editor
// page and into the create-run wizard's final step.

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

const GHOST_RULE_CAPTION = 'Drag a field onto one on the right to compare them'

/**
 * Written from the operator's side, not the schema's. "Sequence sets sequenceNum on the rule" is
 * worthless here; "rule 1 should be the field that uniquely identifies a row" is the sentence that
 * quietly prevents the most common misconfiguration on this board.
 */
const RULE_TERM_DEFINITIONS = {
  'pre-actions': 'Change a value just for this comparison, before the two sides are matched. Nothing is written back to the source. Most common use: string to number, so "120.00" from one system matches 120 from the other.',
  operator: 'How the two values are tested. = is an exact match once any pre-actions have run; the comparison operators are for numbers and dates.',
  sequence: 'The order rules are evaluated in. Rule 1 should be the field that uniquely identifies a row — the order number, not the total — because that is what pairs the two sides up before the rest are checked.',
} as const

function termDefinitionId(term: keyof typeof RULE_TERM_DEFINITIONS): string {
  return `ruleset-term-definition-${term}`
}

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

const draftStore = useReconciliationDraftStore()
const boardRef = ref<HTMLElement | null>(null)
const rulePopoverRef = ref<HTMLElement | null>(null)
const exclusionPopoverRef = ref<HTMLElement | null>(null)
const fieldNodeRefs = new Map<string, HTMLElement>()
const loadError = ref<string | null>(null)
const loadingFields = ref(false)
const nsRestletConfigs = ref<AutomationNsRestletOption[]>([])
const systemRemotes = ref<AutomationSystemRemoteOption[]>([])
const loadedFields = ref<Record<RuleSide, RuleField[]>>({
  file1: [],
  file2: [],
})
const rules = ref<RuleConnection[]>([])
const lineLayouts = ref<Record<string, LineLayout>>({})
const measuredGhostLayout = ref<LineLayout | null>(null)
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
const exclusionUnavailable = ref<{ side: RuleSide; fieldPath: string; message: string } | null>(null)
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

const loadAbortController = new AbortController()

async function ensureApiSourceOptionsLoaded(): Promise<void> {
  if (!sourceUsesApi('file1') && !sourceUsesApi('file2')) return
  if (nsRestletConfigs.value.length || systemRemotes.value.length) return

  const response = await reconciliationFacade.listAutomationSourceOptions(loadAbortController.signal)
  nsRestletConfigs.value = response.nsRestletConfigs ?? []
  systemRemotes.value = response.systemRemotes ?? []
}

/**
 * Whether this side can actually carry an exclusion. The backend only dispatches exclusion rules to a
 * connector whose SourceSystemConnector row declares `filterParameterName`; anything else validates,
 * persists and then excludes nothing. CSV/SFTP sides have no connector option at all (and no getter),
 * so they fall out here too. Design principle: fail closed and loudly rather than offering a control
 * that cannot work.
 */
function supportsExclusions(side: RuleSide): boolean {
  if (!sourceUsesApi(side)) return false
  return selectedApiSourceOption(side)?.supportsExcludeFilters === true
}

function loadApiSourceFields(side: RuleSide): void {
  // The board offers the connector's WIDER field list when it declares one, because a field worth
  // excluding on (salesChannelEnumId) is not necessarily a field worth keying on. Falling back to
  // primaryIdOptions keeps every connector that declares no wider list exactly as it was.
  const option = selectedApiSourceOption(side)
  const apiFields = option?.fieldOptions ?? option?.primaryIdOptions ?? []
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

  const response = await jsonSchemaFacade.get({ schemaName: normalizedSchemaName }, loadAbortController.signal)
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

  const response = await jsonSchemaFacade.flatten({ jsonSchemaId: schemaId.trim() }, loadAbortController.signal)
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
  loadError.value = null
  hydrateRules()
  try {
    await ensureApiSourceOptionsLoaded()
    await Promise.all([
      loadSourceFields('file1'),
      loadSourceFields('file2'),
    ])
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    loadError.value = error instanceof ApiCallError ? error.message : 'Unable to load source fields.'
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
    layouts[rule.id] = joinAnchors(
      resolveFieldAnchor('file1', rule.file1FieldPath),
      resolveFieldAnchor('file2', rule.file2FieldPath),
    )
    return layouts
  }, {})

  const ghostStart = file1Fields.value[0]
  const ghostEnd = file2Fields.value[0]
  measuredGhostLayout.value = ghostStart && ghostEnd
    ? joinAnchors(resolveFieldAnchor('file1', ghostStart.fieldPath), resolveFieldAnchor('file2', ghostEnd.fieldPath))
    : null
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

function joinAnchors(start: Point, end: Point): LineLayout {
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

/** Zero VISIBLE rules — the hidden basic-diff row never reaches orderedRules, so it cannot suppress this. */
const showGhostRule = computed(() => orderedRules.value.length === 0
  && file1Fields.value.length > 0
  && file2Fields.value.length > 0)

const ghostRuleLayout = computed<LineLayout | null>(() => {
  if (!showGhostRule.value) return null

  const first1 = file1Fields.value[0]
  const first2 = file2Fields.value[0]
  if (!first1 || !first2) return null

  // Same fallback ladder the real rules use: measured rects when the board has been laid out,
  // computed row positions before that, so the ghost is never missing on first paint.
  return measuredGhostLayout.value
    ?? joinAnchors(fallbackFieldAnchor('file1', first1.fieldPath), fallbackFieldAnchor('file2', first2.fieldPath))
})

const ghostRulePath = computed(() => (ghostRuleLayout.value ? curvePath(ghostRuleLayout.value) : ''))

/** Clear of the line rather than centred on it — a caption that covers the ghost defeats the ghost. */
const GHOST_CAPTION_DROP = 22

const ghostCaptionStyle = computed((): Record<string, string> => {
  const layout = ghostRuleLayout.value
  if (!layout) return {}
  return { left: `${layout.midX}px`, top: `${layout.midY + GHOST_CAPTION_DROP}px` }
})

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

/**
 * The popover spans the rule it edits, left pill centre to right pill centre. On a wide board with
 * few fields that span runs past 1000px for a form of three short rows — it reads as a dialog that
 * swallowed the board, and it leaves no room beside it for a term definition. Capping it keeps the
 * spanning intent on the boards where the span is reasonable and stops it running away elsewhere.
 */
/** 34rem — the width .popup-workflow-modal gives the exclusion editor, so the two cards match. */
const MAX_RULE_POPOVER_WIDTH = 544

function operatorPopoverWidth(rule: RuleConnection): number {
  const span = pillCenterSpanForRule(rule)
  const spanWidth = span ? span.rightCenter - span.leftCenter : boardSize.value.width / 2
  return Math.min(MAX_RULE_POPOVER_WIDTH, Math.max(1, spanWidth))
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

// Alias-aware, like every other field lookup on this board (fieldRefKeys, fallbackFieldAnchor,
// withPrimaryField). A strict === would orphan a stored exclusion the moment the pill's path and the
// stored expression differ only by a `$.` prefix or an index-vs-`[*]` segment — which withPrimaryField
// can introduce on its own.
function excludeFilterFor(side: RuleSide, fieldPath: string): SourceExcludeFilter | undefined {
  return excludeFiltersFor(side).find((filter) => sameField(filter.fieldExpression, fieldPath))
}

function hasExclusion(side: RuleSide, fieldPath: string): boolean {
  const filter = excludeFilterFor(side, fieldPath)
  return !!filter && filter.values.length > 0
}

function closeExclusionEditor(): void {
  editingExclusion.value = null
  editingExclusionValues.value = []
  pendingExclusionValue.value = ''
}

/**
 * supportsExclusions fails closed for two unrelated reasons, and the operator cannot tell them
 * apart from the outside — so say which one it is. Both used to be a bare `return`: the gesture
 * did nothing, drew nothing, and logged nothing, which is indistinguishable from a broken board
 * (DAR-UI-013). The gate itself is unchanged; this only explains it.
 */
function explainExclusionsUnavailable(side: RuleSide, fieldPath: string): void {
  closeRuleEditor()
  closeExclusionEditor()
  exclusionUnavailable.value = {
    side,
    fieldPath,
    message: sourceUsesApi(side)
      // The connector declares no filterParameterName, so the getter has no parameter to push a
      // filter into. Name the system: "this side" alone leaves the operator guessing which.
      ? `${sideTitle(side)} cannot filter records at the source, so exclusions do not apply to this side.`
      // CSV/SFTP: there is no connector at all, and Darpan reads whatever the file contains.
      : 'Exclusions apply only to API sources. This side reads a file.',
  }
}

function closeExclusionUnavailable(): void {
  exclusionUnavailable.value = null
}

function sideTitle(side: RuleSide): string {
  return side === 'file1' ? file1Title.value : file2Title.value
}

function openExclusionEditor(side: RuleSide, fieldPath: string): void {
  closeExclusionUnavailable()
  // The two popovers share the `.ruleset-rule-popover` blur-exemption class, so if both were
  // open at once they would render fully sharp, overlapping each other. The ⊘ mark itself has no
  // handlers at all now — it's a plain, non-interactive <span> (see the exclude-mark comment in
  // the style block) — so it plays no part in this. What actually keeps the popovers mutually
  // exclusive is this explicit closeRuleEditor() call: it runs on every entry path, including the
  // Enter-key gesture, which fires no pointerdown for the window outside-click listener
  // (handleWindowPointerDown) to react to.
  closeRuleEditor()
  editingExclusion.value = { side, fieldPath }
  editingExclusionValues.value = [...(excludeFilterFor(side, fieldPath)?.values ?? [])]
  pendingExclusionValue.value = ''
}

/**
 * Mouse gesture for the exclusion editor: double-click on the pill itself (the ⊘ mark is now a
 * plain, non-interactive indicator — see the exclude-mark comment in the style block). A double
 * click is really two independent pointerdown/pointerup pairs, each of which is well inside
 * LONG_PRESS_MS and each of which already runs cancelPendingConnection() on pointerup — so by the
 * time this fires there is no pending connection left to disturb. cancelPendingConnection() here
 * is defense in depth, not load-bearing.
 */
function handleFieldDoubleClick(side: RuleSide, fieldPath: string): void {
  if (!supportsExclusions(side)) {
    cancelPendingConnection()
    explainExclusionsUnavailable(side, fieldPath)
    return
  }

  cancelPendingConnection()
  openExclusionEditor(side, fieldPath)
}

/**
 * Keyboard equivalent of the double-click gesture above: the ⊘ mark used to be a nested <button>
 * and was the only way to reach the exclusion editor from a keyboard. With it gone, Enter on the
 * focused pill takes over that job on any side that supports exclusions. The .stop modifier on
 * the template's @keydown.enter binding always fires regardless of what this function does, so
 * Enter never falls through to WorkflowStepForm's submit-on-Enter handling either way.
 */
function handleFieldEnterKey(side: RuleSide, fieldPath: string): void {
  if (!supportsExclusions(side)) {
    explainExclusionsUnavailable(side, fieldPath)
    return
  }

  openExclusionEditor(side, fieldPath)
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

  // Flush whatever is still sitting in the value input. The input only commits on Enter, so an
  // operator who types a value and goes straight for "Save exclusion" -- the obvious gesture --
  // used to land here with editingExclusionValues empty, which is the delete branch below: the
  // typed value was dropped, no mark appeared, and nothing was ever sent. That is what made
  // exclusions look inert on sm-darpan (DAR-CLIENT-003).
  commitPendingExclusionValue()

  const others = excludeFiltersFor(editing.side).filter((filter) => !sameField(filter.fieldExpression, editing.fieldPath))
  const next = editingExclusionValues.value.length
    ? [...others, { fieldExpression: editing.fieldPath, operator: 'EXCLUDE_IN', values: [...editingExclusionValues.value] }]
    : others
  // Always assign the side, never leave it undefined: undefined means "no opinion" to the backend
  // and would leave stale rows in place after the operator cleared them here.
  if (editing.side === 'file1') draft.value.file1ExcludeFilters = normalizeExcludeFilters(next)
  else draft.value.file2ExcludeFilters = normalizeExcludeFilters(next)
  closeExclusionEditor()
}

function deleteEditingExclusion(): void {
  // Clear the pending text too, not just the committed chips: applyExclusionEdit now flushes the
  // input, so leftover half-typed text would otherwise come straight back as a fresh rule and
  // Delete would not delete.
  pendingExclusionValue.value = ''
  editingExclusionValues.value = []
  applyExclusionEdit()
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

  // Mutually exclusive with the exclusion popover — see the matching comment in
  // openExclusionEditor for why this can't rely on the outside-click listener alone.
  closeExclusionEditor()
  closeExclusionUnavailable()
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
  // The unavailable note is transient: any next pointerdown retires it, including one on the very
  // pill that raised it, so re-trying the gesture cannot leave two notes or a stuck one.
  closeExclusionUnavailable()

  if (!editingRuleId.value && !editingExclusion.value) return

  const target = event.target
  if (!(target instanceof Node)) return

  if (editingRuleId.value && !rulePopoverRef.value?.contains(target)) {
    closeRuleEditor()
  }

  if (editingExclusion.value && !exclusionPopoverRef.value?.contains(target)) {
    closeExclusionEditor()
  }
}

/**
 * Mirrors the board's local rule state onto the shared draft continuously, the same way
 * exclusion edits already write straight through (see applyExclusionEdit above) — not just on an
 * explicit Save click. The board has no props or emits, so this is the only way anything hosting
 * it (the standalone editor page's own Save handler, or the create-run wizard's final step) can
 * observe rules the operator draws here.
 */
function syncRulesToDraft(): void {
  if (!draft.value) return

  draft.value.rules = orderedRules.value.map((rule): ReconciliationRuleSetDraftRule => ({
    ...(rule.ruleId ? { ruleId: rule.ruleId } : {}),
    file1FieldPath: rule.file1FieldPath,
    file2FieldPath: rule.file2FieldPath,
    operator: rule.operator,
    sequenceNum: rule.sequenceNum,
    ...(rule.preActions.length ? { preActions: rule.preActions } : {}),
  }))
}

watch([orderedRules, file1Fields, file2Fields], () => {
  void nextTick(updateLineLayout)
})

watch(rules, syncRulesToDraft, { deep: true })

onMounted(() => {
  void loadEditorData()
  window.addEventListener('resize', updateLineLayout)
  window.addEventListener('pointerdown', handleWindowPointerDown)
})

onBeforeUnmount(() => {
  clearLongPressTimer()
  window.removeEventListener('resize', updateLineLayout)
  window.removeEventListener('pointerdown', handleWindowPointerDown)
  loadAbortController.abort()
})
</script>

<style scoped>
/* Field labels ("Operator", "Sequence", "Exclude on") take the small-caps label treatment. */
/* The :not() keeps the uppercase label treatment off the term definitions, which are sentences and
   live in the same slot. Without it this rule wins on specificity — (0,1,2) against (0,1,0) — and
   shouts a paragraph of help in capitals. */
/* The design system's table-head role: 0.76rem / 0.08em / --text-muted (--type-table-head-size,
   --type-table-head-tracking). These are form labels rather than eyebrows, and the tracking and
   colour already matched it — only the size was off, at 0.72rem, on no token at all. Both editors
   share this rule so they cannot drift apart again. */
.ruleset-rule-popover label > span:not(.ruleset-term-definition),
.ruleset-exclusion-popup label > span,
.ruleset-pre-action-header > span:not(.ruleset-term-definition) {
  color: var(--text-muted);
  font-size: var(--type-table-head-size);
  text-transform: uppercase;
  letter-spacing: var(--type-table-head-tracking);
}

/* The term IS the affordance — a 1px dotted underline, no question-mark badges. This board already
   carries every other hierarchy on 1px borders, so a row of icons would cost more surface than the
   copy problem it solves. */
/* Underline the WORD, not the button box. A border-bottom here inherits the global button rule's
   2.55rem min-height and corner radius, so it needed a line-height override to sit near the text —
   and that override made the term's line box 13.8px where every other label in the product is
   17.9px. text-decoration needs none of that: the label metrics stay identical to the exclusion
   popup's, and the term stops perturbing the popover's vertical rhythm. */
.ruleset-term {
  justify-self: start;
  min-height: 0;
  border: 0;
  background: none;
  padding: 0;
  cursor: help;
  font-size: var(--type-table-head-size);
  letter-spacing: var(--type-table-head-tracking);
  text-transform: uppercase;
  color: var(--text-muted);
  text-decoration: underline dotted var(--text-muted);
  text-underline-offset: 3px;
  transition: color 120ms ease, text-decoration-color 120ms ease;
}

.ruleset-term:hover,
.ruleset-term:focus-visible {
  color: var(--text);
  text-decoration-color: var(--text);
}

/* Beside the card, level with the term — never over it. A definition that drops down covers the
   exact control you opened it to fill in, which is the one thing help on this popover must not do.
   Below the card is the fallback when there is no room for a side shelf. */
.ruleset-term-definition {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 6;
  width: 100%;
  box-sizing: border-box;
  padding: var(--space-1-5) var(--space-1-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-muted);
  /* Tracks the term it defines. Left at 0.72rem it would render smaller than its own label, which
     inverts the usual relationship between a micro label and the copy beneath it. */
  font-size: var(--type-table-head-size);
  line-height: 1.5;
  letter-spacing: 0;
  text-transform: none;
  text-align: left;
  opacity: 0;
  visibility: hidden;
  transition: opacity 140ms ease, visibility 140ms ease;
}

/* 1200px, not 1100: the shelf needs (board/2 - popover/2) clear on the right, and below this the
   popover's own capped width leaves too little for a 15rem panel to land without being cut off. */
@media (min-width: 1200px) {
  .ruleset-rule-popover label,
  .ruleset-pre-action-header {
    position: relative;
  }

  /* 100% is the row's right edge, which sits inside the card's --space-4 (1.6rem) padding — hence
     2.1rem, to clear the card border and still leave a 0.5rem gap. Tracks the card padding: if
     that changes, this must change with it. */
  .ruleset-term-definition {
    top: 0;
    left: calc(100% + 2.1rem);
    width: 15rem;
  }
}

.ruleset-term:hover + .ruleset-term-definition,
.ruleset-term:focus-visible + .ruleset-term-definition {
  opacity: 1;
  visibility: visible;
}

/* The column header is a system NAME, not a label — "Shopify", "HotWax", "NetSuite". Uppercasing
   it rendered SHOPIFY/HOTWAX here while every other surface showed the proper-cased name, so the
   same system read two different ways depending on where you looked. Same size and colour as the
   labels above, without the case transform. */
.ruleset-field-column header span {
  color: var(--text-muted);
  font-size: var(--type-table-head-size);
  letter-spacing: var(--type-table-head-tracking);
}

.ruleset-editor-board {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(11rem, 18rem) minmax(7.5rem, 1fr) minmax(11rem, 18rem);
  column-gap: clamp(1rem, 2vw, 1.5rem);
  row-gap: var(--space-1-5);
  align-items: start;
  justify-content: center;
  /* Contains a large layout value with no step near it; the scale jumps 2.3rem -> 3.2rem here. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding: 1rem 0 3rem;
  --ruleset-pen-cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http://www.w3.org/2000/svg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%3E%3Cpath%20fill%3D%27%23ffffff%27%20stroke%3D%27%23000000%27%20stroke-width%3D%271.5%27%20stroke-linejoin%3D%27round%27%20stroke-linecap%3D%27round%27%20d%3D%27M5%2020l4-1%2011-11-3-3L6%2016z%27/%3E%3C/svg%3E") 3 20, crosshair;
  cursor: var(--ruleset-pen-cursor);
}

.ruleset-editor-board--popup-open > :not(.ruleset-rule-popover):not(.ruleset-exclusion-overlay) {
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

/* Fainter than a draft line: this one is not being drawn by anybody, it is showing what to draw. */
.ruleset-editor-line--ghost {
  stroke-dasharray: 7 7;
  stroke: color-mix(in oklab, var(--text) 34%, transparent);
  animation: ruleset-ghost-crawl 1.5s linear infinite;
}

@keyframes ruleset-ghost-crawl {
  to { stroke-dashoffset: -28; }
}

/* Bare text under the line, not a bordered box centred on it. A box with a background sat exactly
   where the ghost runs, so it hid the line it was captioning; a box with a border and a radius on a
   board of rounded pills read as a third field rather than as a hint. */
.ruleset-ghost-caption {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, 0);
  margin: 0;
  padding: 0;
  color: var(--text-muted);
  font-size: var(--type-eyebrow-size);
  line-height: 1.4;
  text-align: center;
  max-width: min(15rem, 90%);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .ruleset-editor-line--ghost {
    animation: none;
  }
}

.ruleset-field-column {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--space-1-5);
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
  gap: var(--space-0);
  min-height: 3rem;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid transparent;
}

.ruleset-field-item {
  position: relative;
  display: grid;
  /* Contains a value below --space-00 (0.2rem). Under 2.5px these are optical nudges rather than spacing, and the scale deliberately stops above them. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  gap: 0.12rem;
  min-height: 2.75rem;
  width: 100%;
  padding: var(--space-1-5) var(--space-2);
  border-radius: var(--radius-pill);
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
  font-size: var(--type-heading-size);
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}

.ruleset-field-meta {
  color: var(--text-muted);
  /* A micro size deliberately below the scale. The nearest role is 0.7rem and folding up is a visible 9% jump on the board, not the sub-pixel shift the other folds were. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
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
   no operator box. Double-click on the pill (or Enter when it is focused) opens the same popover
   chrome the operator boxes use, on a side whose connector supports exclusion filters. The mark
   itself is a plain, non-interactive <span> — there is no nested control to worry about, which is
   why the pill can stay a <div role="button"> above without any HTML-nesting concern — and it is
   rendered only once a field actually has an exclusion, since with no line and no box it is the
   only evidence one exists. */
.ruleset-field-exclude {
  position: absolute;
  top: 50%;
  width: 1.55rem;
  height: 1.55rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  border: 1px solid color-mix(in oklab, var(--accent) 45%, var(--border));
  background: color-mix(in oklab, var(--surface-2) 70%, var(--accent) 30%);
  color: var(--text);
  font-size: var(--type-summary-label-size);
  line-height: 1;
  transform: translateY(-50%);
  box-shadow: 0 0 0 0.14rem color-mix(in oklab, var(--accent) 16%, transparent);
}

/* Outer edge only, away from board centre: the connection-line anchor for each side is the
   centre-facing pill edge (file1 anchors from its right edge, file2 from its left — see
   resolveFieldAnchor), so the mark sits on the opposite edge to stay clear of where a line
   is drawn from. */
.ruleset-field-column--left .ruleset-field-exclude { left: -0.775rem; }
.ruleset-field-column--right .ruleset-field-exclude { right: -0.775rem; }

/* Borrows .ruleset-term-definition's surface, border and muted eyebrow type rather than inventing
   a second explanatory voice on the same board. Positioned beside the pill, never over it: the
   left column's note opens leftward and the right column's rightward, so it never lands on the
   pills below or on the rule lines between the columns. */
.ruleset-exclusion-unavailable {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
  margin: 0;
  width: max-content;
  max-width: 13rem;
  box-sizing: border-box;
  padding: var(--space-1-5);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: var(--type-eyebrow-size);
  font-weight: 400;
  line-height: 1.4;
  text-align: left;
  white-space: normal;
  pointer-events: none;
}

/* Beside the pill but INWARD, into the gutter the rule lines run through — not outward past the
   column. Outward was measured off-viewport (left: -200px) on a 760px board: the margin outside a
   column shrinks with the viewport, so an outward note is only safe on a very wide screen and
   silently vanishes everywhere else, which is the exact silent no-op this whole affordance exists
   to remove. The gutter is a fraction of the board, so it holds its width wherever the board does. */
.ruleset-field-column--left .ruleset-exclusion-unavailable { left: calc(100% + var(--space-1-5)); }
.ruleset-field-column--right .ruleset-exclusion-unavailable { right: calc(100% + var(--space-1-5)); }

.ruleset-operator-box {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.2rem;
  min-height: 2.15rem;
  padding: var(--space-1) var(--space-1-5);
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
  font-size: var(--type-table-head-size);
  font-variant-numeric: tabular-nums;
}

/* Frame matches .ruleset-exclusion-popup exactly: the two editors on this board are siblings and
   were drifting — 0.9rem/0.8rem/--radius-sm here against --space-4/--space-3/--radius-md there.
   The old padding and gap were on no scale at all; tokens/spacing.css is deliberately non-linear
   and off-scale values quietly snap the rhythm back to a pixel grid it is designed to avoid. */
.ruleset-rule-popover {
  position: absolute;
  z-index: 5;
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  transform: translate(-50%, -50%);
}

.ruleset-rule-popover label {
  gap: var(--space-0);
}

.ruleset-pre-action-section {
  display: grid;
  gap: var(--space-1-5);
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
  gap: var(--space-1);
  align-items: end;
}

.ruleset-pre-action-add {
  width: 1.9rem;
  height: 1.9rem;
  min-width: 1.9rem;
  min-height: 1.9rem;
  padding: 0;
  /* Sizes an icon glyph, not text. Type roles do not describe it. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
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

/* 2.6rem is the workflow-surface control height (--workflow-action-min-height) and what the
   exclusion editor's input already used. The old 2.3rem made this input shorter than the select
   sitting directly above it — two control heights inside one card — and shorter again than the
   identical-looking input in the sibling popup. The select trigger is a button, so it needs the
   same treatment to land on the same height. */
.ruleset-rule-popover input,
.ruleset-rule-popover :deep(.app-select-trigger) {
  min-height: 2.6rem;
  padding: var(--space-1-5) var(--space-2);
}

/* The exclusion editor keeps the board's own label/chip/action treatment, but its frame, width and
   centring come from the shared popup pair in style.css — nothing here re-declares position,
   background or border. The overlay is pointer-transparent so the blurred board behind it still
   takes clicks (see the template comment); only the panel itself claims pointer events. */
.ruleset-exclusion-overlay {
  pointer-events: none;
}

.ruleset-exclusion-popup.popup-workflow-modal {
  pointer-events: auto;
  padding: var(--space-4);
  max-height: calc(100vh - (var(--space-4) * 2));
  overflow-y: auto;
}

.ruleset-exclusion-popup label {
  gap: var(--space-0);
}

.ruleset-exclusion-popup input {
  min-height: 2.6rem;
  padding: var(--space-1-5) var(--space-2);
}

.ruleset-rule-popover-actions {
  display: flex;
  gap: var(--space-1-5);
  align-items: center;
}

/* Chip role lives in style.css - shared with the other component that renders chips. */

@media (max-width: 900px) {
  .ruleset-editor-board {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-3);
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

  /* The columns stack here, so there is no gutter to open into and nothing beside the pill at all.
     Fall back to below it — the placement .ruleset-term-definition already uses on this board, and
     what the help-layer rule prescribes once beside stops fitting. */
  .ruleset-field-column--left .ruleset-exclusion-unavailable,
  .ruleset-field-column--right .ruleset-exclusion-unavailable {
    top: calc(100% + var(--space-00));
    right: auto;
    left: 0;
    transform: none;
    width: 100%;
    max-width: 100%;
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
