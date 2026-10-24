<template>
  <div class="run-conclusions" data-testid="run-conclusions-editor">
    <p v-if="loading" class="section-note" data-testid="run-conclusions-loading">Loading...</p>

    <InlineValidation
      v-for="(message, index) in errors"
      :key="`${index}-${message}`"
      tone="error"
      :message="message"
      data-testid="run-conclusions-error"
    />

    <template v-if="loaded">
      <ol v-if="rows.length" class="run-conclusions-list" data-testid="run-conclusions-list">
        <li
          v-for="row in rows"
          :key="row.node.uid"
          class="run-conclusions-node"
          :class="{ 'run-conclusions-node--child': row.depth > 1 }"
          :style="{ '--run-conclusions-depth': String(row.depth - 1) }"
          :data-depth="row.depth"
          :data-key="row.node.key"
          data-testid="run-conclusions-node"
        >
          <div class="run-conclusions-node-head">
            <div class="run-conclusions-picker">
              <AppSelect
                v-model="row.node.conclusion"
                :options="catalogOptions"
                placeholder="conclusion"
                searchable
                :disabled="saving"
                test-id="run-conclusions-conclusion"
              />
              <button
                type="button"
                class="ghost-btn"
                aria-label="New conclusion"
                :aria-expanded="newCodeFor === row.node.uid ? 'true' : 'false'"
                :disabled="saving || creating"
                data-testid="run-conclusions-new-code"
                @click="toggleNewCode(row.node)"
              >
                New
              </button>
            </div>
            <AppSelect
              v-if="row.depth === 1"
              v-model="row.node.bucket"
              :options="bucketOptions"
              :disabled="saving"
              test-id="run-conclusions-bucket"
            />
            <input
              v-model="row.node.question"
              type="text"
              name="conclusionQuestion"
              placeholder="question"
              aria-label="Question"
              maxlength="255"
              :disabled="saving"
              data-testid="run-conclusions-question"
            />
            <div class="run-conclusions-actions">
              <button
                type="button"
                class="app-table__icon-action"
                aria-label="Move up"
                :disabled="saving || row.first"
                data-testid="run-conclusions-move-up"
                @click="moveNode(row.node, -1)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="UP_ICON_PATH" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                class="app-table__icon-action"
                aria-label="Move down"
                :disabled="saving || row.last"
                data-testid="run-conclusions-move-down"
                @click="moveNode(row.node, 1)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="DOWN_ICON_PATH" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                class="app-table__icon-action"
                aria-label="Add child conclusion"
                :disabled="saving || row.depth >= MAX_DEPTH"
                data-testid="run-conclusions-add-child"
                @click="addChild(row.node)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="PLUS_ICON_PATH" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                class="app-table__icon-action app-table__icon-action--danger"
                aria-label="Remove conclusion"
                :disabled="saving"
                data-testid="run-conclusions-remove"
                @click="removeNode(row.node)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>

          <div
            v-if="newCodeFor === row.node.uid"
            class="run-conclusions-new-code"
            data-enter-submit="off"
            data-testid="run-conclusions-new-code-row"
          >
            <input
              v-model="newCodeLabel"
              type="text"
              name="newConclusionLabel"
              placeholder="new conclusion"
              aria-label="New conclusion"
              maxlength="255"
              :disabled="creating"
              data-testid="run-conclusions-new-code-label"
              @keydown.enter.prevent="void createCode(row.node)"
            />
            <button
              type="button"
              class="ghost-btn"
              :disabled="creating || !newCodeLabel.trim()"
              data-testid="run-conclusions-new-code-add"
              @click="void createCode(row.node)"
            >
              Add
            </button>
            <InlineValidation
              v-for="(message, index) in newCodeErrors"
              :key="`${index}-${message}`"
              tone="error"
              :message="message"
              data-testid="run-conclusions-new-code-error"
            />
          </div>

          <div
            v-for="condition in row.node.conditions"
            :key="condition.uid"
            class="run-conclusions-condition"
            data-testid="run-conclusions-condition"
          >
            <AppSelect
              v-if="!isEvaluate"
              v-model="condition.subject"
              :options="subjectOptions"
              :disabled="saving"
              test-id="run-conclusions-subject"
            />
            <AppSelect
              v-model="condition.presence"
              :options="presenceOptions"
              :disabled="saving"
              test-id="run-conclusions-presence"
            />
            <AppSelect
              v-if="condition.presence !== 'ANY'"
              v-model="condition.keyScope"
              :options="keyScopeOptions"
              :disabled="saving"
              test-id="run-conclusions-key-scope"
            />
            <input
              v-model="condition.field"
              type="text"
              name="conditionField"
              placeholder="field"
              aria-label="Field"
              :disabled="saving"
              data-testid="run-conclusions-field"
            />
            <AppSelect
              v-model="condition.operator"
              :options="operatorOptions"
              :disabled="saving"
              test-id="run-conclusions-operator"
            />
            <AppSelect
              v-if="condition.field.trim()"
              v-model="condition.quantifier"
              :options="quantifierOptions"
              :disabled="saving"
              test-id="run-conclusions-quantifier"
            />
            <input
              v-if="condition.operator === 'GT'"
              v-model="condition.valuesText"
              type="text"
              inputmode="decimal"
              name="conditionAmount"
              placeholder="number"
              aria-label="More than"
              :disabled="saving"
              data-testid="run-conclusions-amount"
            />
            <input
              v-else-if="takesValues(condition.operator)"
              v-model="condition.valuesText"
              type="text"
              name="conditionValues"
              placeholder="values, comma separated"
              aria-label="Values"
              :disabled="saving"
              data-testid="run-conclusions-values"
            />
            <input
              v-model="condition.checkLabel"
              class="run-conclusions-check-label"
              type="text"
              name="conditionCheckLabel"
              placeholder="what it checks"
              aria-label="What it checks"
              :disabled="saving"
              data-testid="run-conclusions-check-label"
            />
            <button
              type="button"
              class="app-table__icon-action app-table__icon-action--danger"
              aria-label="Remove condition"
              :disabled="saving || row.node.conditions.length < 2"
              data-testid="run-conclusions-remove-condition"
              @click="removeCondition(row.node, condition)"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            class="app-table__icon-action run-conclusions-add-condition"
            aria-label="Add condition"
            :disabled="saving"
            data-testid="run-conclusions-add-condition"
            @click="addCondition(row.node)"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path :d="PLUS_ICON_PATH" fill="currentColor" />
            </svg>
          </button>
        </li>
      </ol>
      <p v-else class="section-note" data-testid="run-conclusions-empty">None yet.</p>

      <div class="action-row run-conclusions-footer">
        <button
          type="button"
          class="app-icon-action"
          aria-label="Add conclusion"
          :disabled="saving"
          data-testid="run-conclusions-add-root"
          @click="addRoot"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="PLUS_ICON_PATH" fill="currentColor" />
          </svg>
        </button>
        <span class="run-conclusions-footer-spacer" />
        <AppCancelAction
          label="Revert"
          :disabled="saving || !dirty"
          test-id="run-conclusions-revert"
          @click="revert"
        />
        <AppSaveAction
          label="Save conclusions"
          :disabled="saving || !dirty"
          test-id="run-conclusions-save"
          @click="void save()"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { runConclusionFacade } from '../../lib/api/authoringFacade'
import type {
  ConclusionBucket,
  ConclusionOperator,
  RunConclusionCondition,
  RunConclusionNode,
  RunConclusions,
} from '../../lib/api/authoringTypes'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import AppCancelAction from '../ui/AppCancelAction.vue'
import AppSaveAction from '../ui/AppSaveAction.vue'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import InlineValidation from '../ui/InlineValidation.vue'

// DAR-UI-064 (S3). One run's conclusion tree: an ordered list where the first root whose bucket and conditions hold
// names the row, and its children (to three levels) refine it. Saving replaces the whole tree, all or nothing; the
// service's refusals are shown as it words them.

const props = withDefaults(
  defineProps<{
    savedRunId: string
    file1Label?: string
    file2Label?: string
  }>(),
  {
    file1Label: 'Source 1',
    file2Label: 'Source 2',
  },
)

const emit = defineEmits<{ saved: [conclusions: RunConclusions] }>()

interface DraftCondition {
  uid: string
  subject: 'FILE_1' | 'FILE_2'
  presence: string
  keyScope: string
  quantifier: string
  field: string
  operator: string
  valuesText: string
  checkLabel: string
}

interface DraftNode {
  uid: string
  key: string
  parentUid: string | null
  conclusion: string
  bucket: string
  question: string
  conditions: DraftCondition[]
}

interface TreeRow {
  node: DraftNode
  depth: number
  first: boolean
  last: boolean
}

const MAX_DEPTH = 3
const UP_ICON_PATH =
  'M10 4.5a.75.75 0 0 1 .53.22l4.5 4.5a.75.75 0 1 1-1.06 1.06l-3.22-3.22v8.19a.75.75 0 0 1-1.5 0V7.06L6.03 10.28a.75.75 0 0 1-1.06-1.06l4.5-4.5A.75.75 0 0 1 10 4.5Z'
const DOWN_ICON_PATH =
  'M10 15.5a.75.75 0 0 1-.53-.22l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V4.75a.75.75 0 0 1 1.5 0v8.19l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-.53.22Z'
const PLUS_ICON_PATH =
  'M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z'

const DEFAULT_BUCKETS: ConclusionBucket[] = ['MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING']
const DEFAULT_OPERATORS: ConclusionOperator[] = ['IN', 'NOT_IN', 'GT', 'GT_ZERO', 'BLANK', 'NOT_BLANK']
const OPERATOR_LABELS: Record<string, string> = {
  IN: 'is one of',
  NOT_IN: 'is not one of',
  GT: 'is more than',
  GT_ZERO: 'is above zero',
  BLANK: 'is blank',
  NOT_BLANK: 'has a value',
}
const PRESENCE_LABELS: Record<string, string> = { ANY: 'any', KEPT: 'kept', EXCLUDED: 'excluded', ABSENT: 'absent' }
const KEY_SCOPE_LABELS: Record<string, string> = { FULL: 'full key', FIRST_FIELD: 'first key field' }
const QUANTIFIER_LABELS: Record<string, string> = { ALL: 'all values', ANY: 'any value' }

const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const errors = ref<string[]>([])
const meta = ref<RunConclusions | null>(null)
const nodes = ref<DraftNode[]>([])
const snapshot = ref<RunConclusionNode[]>([])
// The node a new conclusion code is being named for; one at a time.
const newCodeFor = ref<string | null>(null)
const newCodeLabel = ref('')
const newCodeErrors = ref<string[]>([])
const creating = ref(false)

let uidCounter = 0
let newKeyCounter = 0
let controller: AbortController | null = null

const isEvaluate = computed(() => (meta.value?.scopeMode ?? '').toUpperCase() === 'EVALUATE')

const catalogOptions = computed<AppSelectOption[]>(() => {
  const options = (meta.value?.catalog ?? []).map((entry) => ({ value: entry.id, label: entry.label || entry.id }))
  const known = new Set(options.map((option) => option.value))
  // A stored conclusion the catalog no longer lists still shows by its own label rather than as a blank trigger.
  for (const node of meta.value?.conclusions ?? []) {
    if (node.conclusion && !known.has(node.conclusion)) {
      options.push({ value: node.conclusion, label: node.label || node.conclusion })
      known.add(node.conclusion)
    }
  }
  return options
})

// A one-system run has no second side to be missing from; a stored node that says so still shows what it says.
const bucketOptions = computed<AppSelectOption[]>(() => [
  { value: '', label: 'any row' },
  ...(meta.value?.buckets?.length ? meta.value.buckets : DEFAULT_BUCKETS)
    .filter((bucket) => !isEvaluate.value || bucket !== 'MISSING_FROM_FILE_2'
      || nodes.value.some((node) => node.bucket === bucket))
    .map((bucket) => ({ value: bucket, label: bucketLabel(bucket) })),
])

const subjectOptions = computed<AppSelectOption[]>(() => [
  { value: 'FILE_1', label: props.file1Label },
  { value: 'FILE_2', label: props.file2Label },
])

const presenceOptions = computed<AppSelectOption[]>(() =>
  vocabulary(meta.value?.presence, ['ANY', 'KEPT', 'EXCLUDED', 'ABSENT'], PRESENCE_LABELS))
const keyScopeOptions = computed<AppSelectOption[]>(() =>
  vocabulary(meta.value?.keyScopes, ['FULL', 'FIRST_FIELD'], KEY_SCOPE_LABELS))
const quantifierOptions = computed<AppSelectOption[]>(() =>
  vocabulary(meta.value?.quantifiers, ['ALL', 'ANY'], QUANTIFIER_LABELS))
const operatorOptions = computed<AppSelectOption[]>(() => [
  { value: '', label: 'presence only' },
  ...vocabulary(meta.value?.operators, DEFAULT_OPERATORS, OPERATOR_LABELS),
])

/** Depth-first, siblings in list order: the order the service reads, parents always above their children. */
const rows = computed<TreeRow[]>(() => {
  const out: TreeRow[] = []
  const walk = (parentUid: string | null, depth: number): void => {
    const siblings = nodes.value.filter((node) => node.parentUid === parentUid)
    siblings.forEach((node, index) => {
      out.push({ node, depth, first: index === 0, last: index === siblings.length - 1 })
      walk(node.uid, depth + 1)
    })
  }
  walk(null, 1)
  return out
})

const dirty = computed(() => JSON.stringify(buildPayload()) !== JSON.stringify(snapshot.value))

function vocabulary(listed: string[] | undefined, fallback: string[], labels: Record<string, string>): AppSelectOption[] {
  return (listed?.length ? listed : fallback).map((value) => ({ value, label: labels[value] ?? value }))
}

function bucketLabel(bucket: string): string {
  if (bucket === 'MISSING_FROM_FILE_1') return `missing from ${props.file1Label}`
  if (bucket === 'MISSING_FROM_FILE_2') return `missing from ${props.file2Label}`
  if (bucket === 'RULE') return 'rule difference'
  if (bucket === 'FINDING') return 'finding'
  return bucket
}

function takesValues(operator: string): boolean {
  return operator === 'IN' || operator === 'NOT_IN'
}

function nextUid(): string {
  uidCounter += 1
  return `c${uidCounter}`
}

function blankCondition(): DraftCondition {
  return {
    uid: nextUid(),
    subject: 'FILE_1',
    presence: 'ANY',
    keyScope: 'FULL',
    quantifier: 'ALL',
    field: '',
    operator: 'IN',
    valuesText: '',
    checkLabel: '',
  }
}

function toDraftCondition(condition: RunConclusionCondition): DraftCondition {
  return {
    uid: nextUid(),
    subject: condition.subject === 'FILE_2' ? 'FILE_2' : 'FILE_1',
    presence: condition.presence || 'ANY',
    keyScope: condition.keyScope || 'FULL',
    quantifier: condition.quantifier || 'ALL',
    field: condition.field ?? '',
    operator: condition.operator ?? '',
    valuesText: (condition.values ?? []).join(', '),
    checkLabel: condition.checkLabel ?? '',
  }
}

function toDraftNodes(source: RunConclusionNode[]): DraftNode[] {
  const uidByKey = new Map<string, string>()
  const drafts = source.map((node) => {
    const uid = nextUid()
    uidByKey.set(String(node.key), uid)
    return { node, uid }
  })
  return drafts.map(({ node, uid }) => ({
    uid,
    key: String(node.key),
    parentUid: node.parent ? (uidByKey.get(String(node.parent)) ?? null) : null,
    conclusion: node.conclusion ?? '',
    bucket: node.bucket ?? '',
    question: node.question ?? '',
    conditions: (node.conditions ?? []).map(toDraftCondition),
  }))
}

function splitValues(text: string): string[] {
  const values: string[] = []
  for (const part of text.split(',')) {
    const value = part.trim()
    if (value && !values.includes(value)) values.push(value)
  }
  return values
}

function buildCondition(condition: DraftCondition): RunConclusionCondition {
  const field = condition.field.trim()
  const operator = condition.operator as ConclusionOperator | ''
  return {
    subject: isEvaluate.value ? 'FILE_1' : condition.subject,
    presence: condition.presence,
    keyScope: condition.keyScope,
    quantifier: condition.quantifier,
    field: field || null,
    operator: operator || null,
    values: operator === 'GT' ? [condition.valuesText.trim()].filter(Boolean) : takesValues(operator) ? splitValues(condition.valuesText) : [],
    checkLabel: condition.checkLabel.trim(),
  }
}

function buildPayload(): RunConclusionNode[] {
  const keyByUid = new Map(nodes.value.map((node) => [node.uid, node.key]))
  return rows.value.map(({ node, depth }) => ({
    key: node.key,
    parent: node.parentUid ? (keyByUid.get(node.parentUid) ?? null) : null,
    conclusion: node.conclusion,
    bucket: depth === 1 && node.bucket ? (node.bucket as ConclusionBucket) : null,
    question: node.question.trim() || null,
    conditions: node.conditions.map(buildCondition),
  }))
}

function applyLoaded(next: RunConclusions): void {
  meta.value = next
  nodes.value = toDraftNodes(next.conclusions ?? [])
  snapshot.value = buildPayload()
  loaded.value = true
}

function serviceErrors(error: unknown, fallback: string): string[] {
  if (error instanceof ApiCallError) {
    const result = (error.details as { result?: { errors?: unknown } } | undefined)?.result
    const listed = Array.isArray(result?.errors) ? result.errors.map((item) => String(item)).filter(Boolean) : []
    return listed.length ? listed : [error.message]
  }
  return [fallback]
}

function newKey(): string {
  const taken = new Set(nodes.value.map((node) => node.key))
  let key = ''
  do {
    newKeyCounter += 1
    key = `new-${newKeyCounter}`
  } while (taken.has(key))
  return key
}

function newNode(parentUid: string | null): DraftNode {
  return {
    uid: nextUid(),
    key: newKey(),
    parentUid,
    conclusion: '',
    bucket: '',
    question: '',
    conditions: [blankCondition()],
  }
}

function addRoot(): void {
  nodes.value.push(newNode(null))
}

function depthOf(node: DraftNode): number {
  return rows.value.find((row) => row.node.uid === node.uid)?.depth ?? 1
}

function addChild(parent: DraftNode): void {
  if (depthOf(parent) >= MAX_DEPTH) return
  nodes.value.push(newNode(parent.uid))
}

function removeNode(target: DraftNode): void {
  const doomed = new Set<string>([target.uid])
  let grew = true
  while (grew) {
    grew = false
    for (const node of nodes.value) {
      if (node.parentUid && doomed.has(node.parentUid) && !doomed.has(node.uid)) {
        doomed.add(node.uid)
        grew = true
      }
    }
  }
  nodes.value = nodes.value.filter((node) => !doomed.has(node.uid))
}

/** Swaps a node with its neighbouring sibling; its children travel with it, since they hang off its uid. */
function moveNode(target: DraftNode, direction: -1 | 1): void {
  const siblings = nodes.value.filter((node) => node.parentUid === target.parentUid)
  const position = siblings.findIndex((node) => node.uid === target.uid)
  const neighbour = siblings[position + direction]
  if (!neighbour) return
  const list = [...nodes.value]
  const from = list.findIndex((node) => node.uid === target.uid)
  const to = list.findIndex((node) => node.uid === neighbour.uid)
  list[from] = neighbour
  list[to] = target
  nodes.value = list
}

function addCondition(node: DraftNode): void {
  node.conditions.push(blankCondition())
}

function removeCondition(node: DraftNode, condition: DraftCondition): void {
  if (node.conditions.length < 2) return
  node.conditions = node.conditions.filter((entry) => entry.uid !== condition.uid)
}

function toggleNewCode(node: DraftNode): void {
  newCodeFor.value = newCodeFor.value === node.uid ? null : node.uid
  newCodeLabel.value = ''
  newCodeErrors.value = []
}

/** Makes a tenant-own conclusion code, adds it to the catalog and picks it on the node it was named for. */
async function createCode(node: DraftNode): Promise<void> {
  const label = newCodeLabel.value.trim()
  if (!label || creating.value || !meta.value) return
  creating.value = true
  newCodeErrors.value = []
  try {
    const response = await runConclusionFacade.createCode(label)
    if (response.errors?.length) {
      newCodeErrors.value = response.errors.map(String)
      return
    }
    const code = response.conclusionCode
    if (!code?.id) {
      newCodeErrors.value = ['The conclusion would not join the party. Not added.']
      return
    }
    const catalog = meta.value.catalog ?? []
    if (!catalog.some((entry) => entry.id === code.id)) {
      meta.value.catalog = [...catalog, { id: code.id, label: code.label || code.id, own: true }]
    }
    node.conclusion = code.id
    newCodeFor.value = null
    newCodeLabel.value = ''
  } catch (error) {
    if (isAbortError(error)) return
    newCodeErrors.value = serviceErrors(error, 'The conclusion would not join the party. Not added.')
  } finally {
    creating.value = false
  }
}

function revert(): void {
  errors.value = []
  nodes.value = toDraftNodes(snapshot.value)
}

async function load(): Promise<void> {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  loaded.value = false
  errors.value = []
  if (!props.savedRunId.trim()) return
  loading.value = true
  try {
    const response = await runConclusionFacade.get(props.savedRunId, signal)
    if (signal.aborted) return
    if (response.errors?.length) {
      errors.value = response.errors.map(String)
      return
    }
    if (!response.conclusions) {
      errors.value = ['The conclusions jumped to conclusions and ran off.']
      return
    }
    applyLoaded(response.conclusions)
  } catch (error) {
    if (isAbortError(error) || signal.aborted) return
    errors.value = serviceErrors(error, 'The conclusions jumped to conclusions and ran off.')
  } finally {
    if (!signal.aborted) loading.value = false
  }
}

async function save(): Promise<void> {
  if (saving.value || !meta.value) return
  saving.value = true
  errors.value = []
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  try {
    const response = await runConclusionFacade.save(props.savedRunId, buildPayload(), signal)
    if (response.errors?.length) {
      errors.value = response.errors.map(String)
      return
    }
    const saved = response.savedConclusions
    if (saved) {
      applyLoaded(saved)
      emit('saved', saved)
    } else {
      snapshot.value = buildPayload()
      emit('saved', { ...meta.value, conclusions: snapshot.value })
    }
  } catch (error) {
    if (isAbortError(error)) return
    errors.value = serviceErrors(error, 'The conclusions are still undecided. Not saved.')
  } finally {
    saving.value = false
  }
}

watch(() => props.savedRunId, () => void load(), { immediate: true })

onBeforeUnmount(() => {
  controller?.abort()
})
</script>

<style scoped>
.run-conclusions {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.run-conclusions-list {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* One node per row group; a child sits indented under its parent with a guide line, never a nested card. */
.run-conclusions-node {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  margin-left: calc(var(--space-4) * var(--run-conclusions-depth, 0));
  padding-block: var(--space-2);
  border-bottom: 1px solid var(--border-soft);
}

.run-conclusions-node--child {
  padding-left: var(--space-2);
  border-left: 1px solid var(--border);
}

.run-conclusions-node-head {
  display: grid;
  grid-template-columns: minmax(10rem, 1.3fr) minmax(8rem, 0.8fr) minmax(8rem, 1.4fr) auto;
  gap: var(--space-1-5);
  align-items: center;
}

/* A child has no bucket: its question takes the bucket's column too. */
.run-conclusions-node--child .run-conclusions-node-head {
  grid-template-columns: minmax(10rem, 1.3fr) minmax(8rem, 2.2fr) auto;
}

.run-conclusions-picker {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  min-width: 0;
}

.run-conclusions-picker > .app-select {
  flex: 1 1 auto;
  min-width: 0;
}

.run-conclusions-new-code {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
}

.run-conclusions-new-code > input {
  width: auto;
  min-width: 12rem;
  flex: 0 1 20rem;
}

.run-conclusions-new-code > .inline-validation {
  flex: 1 1 100%;
}

.run-conclusions-actions {
  display: flex;
  gap: var(--space-0);
  align-items: center;
}

.run-conclusions-condition {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  padding-left: var(--space-3);
}

.run-conclusions-condition > .app-select,
.run-conclusions-condition > input {
  width: auto;
  min-width: 7rem;
  flex: 1 1 7rem;
}

.run-conclusions-condition > .run-conclusions-check-label {
  min-width: 12rem;
  flex: 2 1 12rem;
}

.run-conclusions-add-condition {
  justify-self: start;
  margin-left: var(--space-3);
}

.run-conclusions-footer-spacer {
  flex: 1 1 auto;
}

@media (max-width: 768px) {
  .run-conclusions-node-head,
  .run-conclusions-node--child .run-conclusions-node-head {
    grid-template-columns: minmax(0, 1fr);
  }

  .run-conclusions-node {
    margin-left: calc(var(--space-2) * var(--run-conclusions-depth, 0));
  }

  .run-conclusions-condition {
    padding-left: 0;
  }

  .run-conclusions-add-condition {
    margin-left: 0;
  }
}
</style>
