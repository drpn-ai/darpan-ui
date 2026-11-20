import { computed, inject, onBeforeUnmount, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { ApiCallError, isAbortError } from '../lib/api/client'
import { runConclusionFacade } from '../lib/api/authoringFacade'
import type {
  ConclusionBucket,
  ConclusionOperator,
  ConclusionOutcome,
  RunConclusionCondition,
  RunConclusionNode,
  RunConclusions,
} from '../lib/api/authoringTypes'
import type { AppSelectOption } from '../components/ui/AppSelect.vue'

// DAR-UI-064 (S3), DAR-UI-128. One run's conclusion tree: an ordered list where the first root whose bucket and
// conditions hold names the row, and its children (to three levels) refine it. The page lists the tree as rows; a row
// opens one node in a popup. Every popup save, delete or added child sends the whole tree, all or nothing, through
// save#RunConclusions, and the service's refusals are shown as it words them.

export interface DraftCondition {
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

export interface DraftNode {
  uid: string
  key: string
  parentUid: string | null
  conclusion: string
  bucket: string
  question: string
  /** Kept as loaded: save replaces the whole tree, so a fix the editor dropped would be erased (DAR-BE-124). */
  fix: string | null
  /** '' shows the row, HIDE hides it, EXPECTED marks it expected. */
  outcome: string
  /** Read only: a filter the brain suggests for these rows. Not sent; the service keeps it with its rule. */
  suggestsFilter: boolean
  conditions: DraftCondition[]
}

export interface ConclusionRow {
  node: DraftNode
  depth: number
  /** Its place in the order: "2" for the second root, "2.1" for that root's first child. */
  number: string
  /** Its index among its siblings. */
  position: number
  first: boolean
  last: boolean
}

export interface UseRunConclusionsDeps {
  savedRunId: Ref<string> | ComputedRef<string>
  file1Label: Ref<string> | ComputedRef<string>
  file2Label: Ref<string> | ComputedRef<string>
}

export const MAX_CONCLUSION_DEPTH = 3

const DEFAULT_BUCKETS: ConclusionBucket[] = ['MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING']
const DEFAULT_OPERATORS: ConclusionOperator[] = ['IN', 'NOT_IN', 'GT', 'LT', 'GT_ZERO', 'WITHIN_HOURS', 'BLANK', 'NOT_BLANK']
const OPERATOR_LABELS: Record<string, string> = {
  IN: 'is one of',
  NOT_IN: 'is not one of',
  GT: 'is more than',
  LT: 'is less than',
  GT_ZERO: 'is above zero',
  WITHIN_HOURS: 'is within the last hours',
  BLANK: 'is blank',
  NOT_BLANK: 'has a value',
}
const PRESENCE_LABELS: Record<string, string> = { ANY: 'any', KEPT: 'kept', EXCLUDED: 'excluded', ABSENT: 'absent' }
const KEY_SCOPE_LABELS: Record<string, string> = { FULL: 'full key', FIRST_FIELD: 'first key field' }
const QUANTIFIER_LABELS: Record<string, string> = { ALL: 'all values', ANY: 'any value' }
const OUTCOME_LABELS: Record<string, string> = { '': 'Shown', HIDE: 'Hidden', EXPECTED: 'Expected' }

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome
}

export function takesValues(operator: string): boolean {
  return operator === 'IN' || operator === 'NOT_IN'
}

export function takesOneNumber(operator: string): boolean {
  return operator === 'GT' || operator === 'LT' || operator === 'WITHIN_HOURS'
}

function vocabulary(listed: string[] | undefined, fallback: string[], labels: Record<string, string>): AppSelectOption[] {
  return (listed?.length ? listed : fallback).map((value) => ({ value, label: labels[value] ?? value }))
}

function splitValues(text: string): string[] {
  const values: string[] = []
  for (const part of text.split(',')) {
    const value = part.trim()
    if (value && !values.includes(value)) values.push(value)
  }
  return values
}

function serviceErrors(error: unknown, fallback: string): string[] {
  if (error instanceof ApiCallError) {
    const result = (error.details as { result?: { errors?: unknown } } | undefined)?.result
    const listed = Array.isArray(result?.errors) ? result.errors.map((item) => String(item)).filter(Boolean) : []
    return listed.length ? listed : [error.message]
  }
  return [fallback]
}

function cloneNodes(list: DraftNode[]): DraftNode[] {
  return list.map((node) => ({ ...node, conditions: node.conditions.map((condition) => ({ ...condition })) }))
}

/** Depth-first, siblings in list order: the order the service reads, parents always above their children. */
function rowsOf(list: DraftNode[]): ConclusionRow[] {
  const out: ConclusionRow[] = []
  const walk = (parentUid: string | null, depth: number, prefix: string): void => {
    const siblings = list.filter((node) => node.parentUid === parentUid)
    siblings.forEach((node, index) => {
      const number = `${prefix}${index + 1}`
      out.push({ node, depth, number, position: index, first: index === 0, last: index === siblings.length - 1 })
      walk(node.uid, depth + 1, `${number}.`)
    })
  }
  walk(null, 1, '')
  return out
}

/** The node and everything under it. */
function withoutSubtree(list: DraftNode[], uid: string): DraftNode[] {
  const doomed = new Set<string>([uid])
  let grew = true
  while (grew) {
    grew = false
    for (const node of list) {
      if (node.parentUid && doomed.has(node.parentUid) && !doomed.has(node.uid)) {
        doomed.add(node.uid)
        grew = true
      }
    }
  }
  return list.filter((node) => !doomed.has(node.uid))
}

export function useRunConclusions(deps: UseRunConclusionsDeps) {
  const loading = ref(false)
  const saving = ref(false)
  const loaded = ref(false)
  /** What stopped the tree loading; a refused save is said in its popup instead. */
  const errors = ref<string[]>([])
  const meta = ref<RunConclusions | null>(null)
  const nodes = ref<DraftNode[]>([])
  const snapshot = ref<RunConclusionNode[]>([])

  // One node open in its popup at a time. `before` is the tree as it stood when the popup opened, so Cancel puts it
  // back, children added from the popup included.
  const editingUid = ref<string | null>(null)
  const before = ref<DraftNode[] | null>(null)
  const popupErrors = ref<string[]>([])
  const newCodeOpen = ref(false)
  const newCodeLabel = ref('')
  const newCodeErrors = ref<string[]>([])
  const creating = ref(false)

  let uidCounter = 0
  let newKeyCounter = 0
  let controller: AbortController | null = null

  const isEvaluate = computed(() => (meta.value?.scopeMode ?? '').toUpperCase() === 'EVALUATE')
  const rows = computed(() => rowsOf(nodes.value))

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
    { value: '', label: bucketLabel('') },
    ...(meta.value?.buckets?.length ? meta.value.buckets : DEFAULT_BUCKETS)
      .filter((bucket) => !isEvaluate.value || bucket !== 'MISSING_FROM_FILE_2'
        || nodes.value.some((node) => node.bucket === bucket))
      .map((bucket) => ({ value: bucket, label: bucketLabel(bucket) })),
  ])
  const subjectOptions = computed<AppSelectOption[]>(() => [
    { value: 'FILE_1', label: deps.file1Label.value },
    { value: 'FILE_2', label: deps.file2Label.value },
  ])
  const presenceOptions = computed(() => vocabulary(meta.value?.presence, ['ANY', 'KEPT', 'EXCLUDED', 'ABSENT'], PRESENCE_LABELS))
  const keyScopeOptions = computed(() => vocabulary(meta.value?.keyScopes, ['FULL', 'FIRST_FIELD'], KEY_SCOPE_LABELS))
  const quantifierOptions = computed(() => vocabulary(meta.value?.quantifiers, ['ALL', 'ANY'], QUANTIFIER_LABELS))
  const outcomeOptions = computed<AppSelectOption[]>(() =>
    ['', 'HIDE', 'EXPECTED'].map((value) => ({ value, label: outcomeLabel(value) })))
  const operatorOptions = computed<AppSelectOption[]>(() => [
    { value: '', label: 'presence only' },
    ...vocabulary(meta.value?.operators, DEFAULT_OPERATORS, OPERATOR_LABELS),
  ])

  const editingRow = computed(() => rows.value.find((row) => row.node.uid === editingUid.value) ?? null)
  const editingNode = computed(() => editingRow.value?.node ?? null)
  /** Not in the tree as last saved: Cancel or Delete drops it without a call. */
  const editingIsNew = computed(() => {
    const node = editingNode.value
    return Boolean(node) && !snapshot.value.some((saved) => saved.key === node?.key)
  })

  /** What a root applies to, in words; blank is any finding. */
  function bucketLabel(bucket: string): string {
    if (bucket === 'MISSING_FROM_FILE_1') return `Missing from ${deps.file1Label.value}`
    if (bucket === 'MISSING_FROM_FILE_2') return `Missing from ${deps.file2Label.value}`
    if (bucket === 'RULE') return 'A rule differs'
    if (bucket === 'FINDING') return 'Every finding'
    return bucket || 'Any finding'
  }

  /** A root's "applies to" line; a child says nothing there, it applies wherever its parent holds. */
  function appliesTo(row: ConclusionRow): string {
    return row.depth === 1 ? bucketLabel(row.node.bucket) : ''
  }

  /** The open node's place among its siblings, as numbers to pick from. */
  const orderOptions = computed<AppSelectOption[]>(() => {
    const row = editingRow.value
    if (!row) return []
    const prefix = row.number.includes('.') ? row.number.slice(0, row.number.lastIndexOf('.') + 1) : ''
    return nodes.value
      .filter((node) => node.parentUid === row.node.parentUid)
      .map((_, index) => ({ value: String(index), label: `${prefix}${index + 1}` }))
  })
  const editingPosition = computed(() => String(editingRow.value?.position ?? 0))

  function conclusionLabel(node: DraftNode): string {
    if (!node.conclusion) return ''
    return catalogOptions.value.find((option) => option.value === node.conclusion)?.label || node.conclusion
  }

  /** One condition as a sentence: "OMS statusId is one of RETURN_COMPLETED, RETURN_RECEIVED". */
  function describeCondition(condition: DraftCondition): string {
    const parts: string[] = []
    if (!isEvaluate.value) parts.push(condition.subject === 'FILE_2' ? deps.file2Label.value : deps.file1Label.value)
    if (condition.presence && condition.presence !== 'ANY') {
      parts.push(PRESENCE_LABELS[condition.presence] ?? condition.presence.toLowerCase())
      if (condition.keyScope === 'FIRST_FIELD') parts.push('on its first key field')
    }
    const field = condition.field.trim()
    if (field) {
      parts.push(condition.quantifier === 'ANY' ? `any ${field}` : field)
      const operator = condition.operator
      if (operator === 'WITHIN_HOURS') parts.push(`is within the last ${condition.valuesText.trim() || '?'} hours`)
      else if (operator) {
        parts.push(OPERATOR_LABELS[operator] ?? operator)
        if (takesOneNumber(operator)) parts.push(condition.valuesText.trim() || '?')
        else if (takesValues(operator)) parts.push(splitValues(condition.valuesText).join(', ') || '?')
      }
    }
    return parts.join(' ')
  }

  /** The row's "when": every condition, all of which must hold. */
  function describeNode(row: ConclusionRow): string {
    return row.node.conditions.map(describeCondition).filter(Boolean).join(' and ')
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
      fix: node.fix ?? null,
      outcome: node.outcome ?? '',
      suggestsFilter: Boolean(node.suggestedFilterJson?.trim()),
      conditions: (node.conditions ?? []).map(toDraftCondition),
    }))
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
      values: takesOneNumber(operator) ? [condition.valuesText.trim()].filter(Boolean) : takesValues(operator) ? splitValues(condition.valuesText) : [],
      checkLabel: condition.checkLabel.trim(),
    }
  }

  function buildPayload(list: DraftNode[]): RunConclusionNode[] {
    const keyByUid = new Map(list.map((node) => [node.uid, node.key]))
    return rowsOf(list).map(({ node, depth }) => ({
      key: node.key,
      parent: node.parentUid ? (keyByUid.get(node.parentUid) ?? null) : null,
      conclusion: node.conclusion,
      bucket: depth === 1 && node.bucket ? (node.bucket as ConclusionBucket) : null,
      question: node.question.trim() || null,
      fix: node.fix,
      outcome: (node.outcome || null) as ConclusionOutcome | null,
      conditions: node.conditions.map(buildCondition),
    }))
  }

  function matchesSaved(list: DraftNode[]): boolean {
    return JSON.stringify(buildPayload(list)) === JSON.stringify(snapshot.value)
  }

  function applyLoaded(next: RunConclusions): void {
    meta.value = next
    nodes.value = toDraftNodes(next.conclusions ?? [])
    snapshot.value = buildPayload(nodes.value)
    loaded.value = true
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
      fix: null,
      outcome: '',
      suggestsFilter: false,
      conditions: [blankCondition()],
    }
  }

  function resetNewCode(): void {
    newCodeOpen.value = false
    newCodeLabel.value = ''
    newCodeErrors.value = []
  }

  function beginEditing(uid: string): void {
    editingUid.value = uid
    popupErrors.value = []
    resetNewCode()
  }

  function openNode(uid: string): void {
    if (saving.value || editingUid.value) return
    before.value = cloneNodes(nodes.value)
    beginEditing(uid)
  }

  /** The create tile: a new root, last in the list, open in the popup. */
  function openNew(): void {
    if (saving.value || editingUid.value || !meta.value) return
    before.value = cloneNodes(nodes.value)
    const node = newNode(null)
    nodes.value.push(node)
    beginEditing(node.uid)
  }

  function closeEditing(): void {
    editingUid.value = null
    before.value = null
    popupErrors.value = []
    resetNewCode()
  }

  function cancelEditing(): void {
    if (saving.value) return
    if (before.value) nodes.value = before.value
    closeEditing()
  }

  /** The popup moves to a new child of the node it holds; Save keeps both, Cancel drops both. */
  function addChild(): void {
    const row = editingRow.value
    if (!row || saving.value || row.depth >= MAX_CONCLUSION_DEPTH) return
    const child = newNode(row.node.uid)
    nodes.value.push(child)
    beginEditing(child.uid)
  }

  /**
   * Puts the open node at this place among its siblings. Its children travel with it, since they hang off its uid; the
   * save numbers the tree in the order it is sent, so the new order is what is tried first.
   */
  function setEditingPosition(value: string): void {
    const target = editingNode.value
    const position = Number(value)
    if (!target || saving.value || !Number.isInteger(position)) return
    const rest = nodes.value.filter((node) => node.uid !== target.uid)
    const siblings = rest.filter((node) => node.parentUid === target.parentUid)
    const anchor = siblings[position]
    const at = anchor ? rest.indexOf(anchor) : rest.length
    nodes.value = [...rest.slice(0, at), target, ...rest.slice(at)]
  }

  function addCondition(): void {
    editingNode.value?.conditions.push(blankCondition())
  }

  function removeCondition(condition: DraftCondition): void {
    const node = editingNode.value
    if (!node || node.conditions.length < 2) return
    node.conditions = node.conditions.filter((entry) => entry.uid !== condition.uid)
  }

  /** Sends this tree as the run's whole tree. A refusal stays in the popup, with the edits kept. */
  async function persist(list: DraftNode[]): Promise<boolean> {
    if (saving.value || !meta.value) return false
    saving.value = true
    popupErrors.value = []
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    try {
      const response = await runConclusionFacade.save(deps.savedRunId.value, buildPayload(list), signal)
      if (response.savedConclusions) applyLoaded(response.savedConclusions)
      else {
        nodes.value = list
        snapshot.value = buildPayload(list)
      }
      return true
    } catch (error) {
      if (isAbortError(error)) return false
      popupErrors.value = serviceErrors(error, 'The conclusions are still undecided. Not saved.')
      return false
    } finally {
      saving.value = false
    }
  }

  async function saveEditing(): Promise<void> {
    if (!editingNode.value || saving.value || creating.value) return
    if (matchesSaved(nodes.value)) {
      closeEditing()
      return
    }
    if (await persist(nodes.value)) closeEditing()
  }

  /** The open node and everything under it, saved at once. */
  async function deleteEditing(): Promise<void> {
    const node = editingNode.value
    if (!node || saving.value) return
    const remaining = withoutSubtree(nodes.value, node.uid)
    if (matchesSaved(remaining)) {
      nodes.value = remaining
      closeEditing()
      return
    }
    if (await persist(remaining)) closeEditing()
  }

  function toggleNewCode(): void {
    const open = !newCodeOpen.value
    resetNewCode()
    newCodeOpen.value = open
  }

  /** Makes a tenant-own conclusion code, adds it to the catalog and picks it on the open node. */
  async function createCode(): Promise<void> {
    const node = editingNode.value
    const label = newCodeLabel.value.trim()
    if (!node || !label || creating.value || !meta.value) return
    creating.value = true
    newCodeErrors.value = []
    try {
      const response = await runConclusionFacade.createCode(label)
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
      resetNewCode()
    } catch (error) {
      if (isAbortError(error)) return
      newCodeErrors.value = serviceErrors(error, 'The conclusion would not join the party. Not added.')
    } finally {
      creating.value = false
    }
  }

  async function load(): Promise<void> {
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    loaded.value = false
    errors.value = []
    if (!deps.savedRunId.value.trim()) return
    loading.value = true
    try {
      const response = await runConclusionFacade.get(deps.savedRunId.value, signal)
      if (signal.aborted) return
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

  watch(() => deps.savedRunId.value, () => {
    closeEditing()
    void load()
  }, { immediate: true })

  onBeforeUnmount(() => {
    controller?.abort()
  })

  return {
    loading,
    loaded,
    saving,
    errors,
    isEvaluate,
    rows,
    catalogOptions,
    bucketOptions,
    subjectOptions,
    presenceOptions,
    keyScopeOptions,
    quantifierOptions,
    operatorOptions,
    outcomeOptions,
    orderOptions,
    editingPosition,
    conclusionLabel,
    appliesTo,
    describeNode,
    editingRow,
    editingNode,
    editingIsNew,
    popupErrors,
    newCodeOpen,
    newCodeLabel,
    newCodeErrors,
    creating,
    openNode,
    openNew,
    cancelEditing,
    addChild,
    setEditingPosition,
    addCondition,
    removeCondition,
    saveEditing,
    deleteEditing,
    toggleNewCode,
    createCode,
    load,
  }
}

export type RunConclusionsState = ReturnType<typeof useRunConclusions>

export const RUN_CONCLUSIONS_KEY: InjectionKey<RunConclusionsState> = Symbol('runConclusions')

/** The tree the page holds; the rows and the popup both read it, so the popup can sit outside the blurred frame. */
export function injectRunConclusions(): RunConclusionsState {
  const state = inject(RUN_CONCLUSIONS_KEY, null)
  if (!state) throw new Error('Run conclusions are not provided.')
  return state
}
