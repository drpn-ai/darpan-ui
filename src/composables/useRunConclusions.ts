import { computed, inject, onBeforeUnmount, ref, watch, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { isAbortError, serviceErrors } from '../lib/api/client'
import { runConclusionFacade } from '../lib/api/authoringFacade'
import type {
  ConclusionBucket,
  ConclusionOutcome,
  RunConclusionCondition,
  RunConclusionLookup,
  RunConclusionNode,
  RunConclusions,
} from '../lib/api/authoringTypes'
import type { AppSelectOption } from '../components/ui/AppSelect.vue'
import {
  conditionChanged,
  conditionIncomplete,
  describeCondition,
  explainsLabel,
  flattenConclusionTree,
  withCheckLabel,
  type ConclusionTreeProblem,
  type FlatConclusion,
  type LineContext,
} from '../lib/conclusionLines'

// DAR-UI-064 (S3), DAR-UI-128, DAR-UI-135. One run's conclusions as a flat ranked list: the first whose check and
// lines hold names the row. A stored tree is flattened on load (each child above its parent, carrying its ancestors'
// lines and its root's check), so the list reads the same before and after the first save. The page holds a draft and
// saves it once, all or nothing, through save#RunConclusions; the service's refusals are shown as it words them.

export interface DraftLine {
  uid: string
  condition: RunConclusionCondition
  /** The line as loaded or last saved; an untouched line keeps its checkLabel. Null for a new line. */
  loaded: RunConclusionCondition | null
}

export interface ConclusionDraft {
  uid: string
  /** The stored key; blank for a new conclusion until it is saved. */
  key: string
  conclusion: string
  bucket: string
  question: string
  /** Kept as loaded: save replaces every conclusion, so a fix the page dropped would be erased (DAR-BE-124). */
  fix: string | null
  /** '' shows the row, HIDE hides it, EXPECTED marks it expected. */
  outcome: '' | 'HIDE' | 'EXPECTED'
  /** Read only: a filter the brain suggests for these rows. Not sent; the service keeps it with its rule. */
  suggestsFilter: boolean
  /** A stored node the tree cannot place (see flattenConclusionTree): shown, and save waits until it is deleted. */
  problem?: ConclusionTreeProblem | null
  lines: DraftLine[]
}

export interface UseRunConclusionsDeps {
  savedRunId: Ref<string> | ComputedRef<string>
  file1Label: Ref<string> | ComputedRef<string>
  file2Label: Ref<string> | ComputedRef<string>
  /** The run's first compare key field when its key has two or more fields, else null. */
  firstKeyField: Ref<string | null> | ComputedRef<string | null>
  /** First path segments known to be lists (the schemas'); the run's `many` lookups are added here. */
  listPaths: Ref<ReadonlySet<string>> | ComputedRef<ReadonlySet<string>>
  /** First path segments known not to be lists (the schemas'); the run's other lookups are added here. */
  nonListPaths?: Ref<ReadonlySet<string>> | ComputedRef<ReadonlySet<string>>
}

interface Snapshot {
  list: ConclusionDraft[]
  unexplained: '' | 'EXPECTED'
}

const DEFAULT_BUCKETS: ConclusionBucket[] = [
  'MISSING_FROM_FILE_1',
  'MISSING_FROM_FILE_2',
  'RULE',
  'DUPLICATE_IN_FILE_1',
  'DUPLICATE_IN_FILE_2',
  'DUPLICATE_IN_FILE_1_PAIRED',
  'DUPLICATE_IN_FILE_2_PAIRED',
  'FINDING',
]
const OUTCOME_LABELS: Record<string, string> = { '': 'Shown', HIDE: 'Hidden', EXPECTED: 'Expected' }
const PROBLEM_WORDS: Record<ConclusionTreeProblem, string> = {
  ORPHAN: 'hangs off a conclusion that is not here',
  CYCLE: 'is its own ancestor',
  DUPLICATE_KEY: 'repeats another conclusion\'s key',
}

export function outcomeLabel(outcome: string): string {
  return OUTCOME_LABELS[outcome] ?? outcome
}

function cloneCondition(condition: RunConclusionCondition): RunConclusionCondition {
  return { ...condition, values: [...(condition.values ?? [])] }
}

function cloneList(list: ConclusionDraft[]): ConclusionDraft[] {
  return list.map((node) => ({
    ...node,
    lines: node.lines.map((line) => ({
      uid: line.uid,
      condition: cloneCondition(line.condition),
      loaded: line.loaded ? cloneCondition(line.loaded) : null,
    })),
  }))
}

/** A stored or picked outcome as the draft holds it; anything else shows the row. */
export function toOutcome(value: string | null | undefined): ConclusionDraft['outcome'] {
  return value === 'HIDE' || value === 'EXPECTED' ? value : ''
}

/** Same order, fields and line meanings; a line's checkLabel is derived and the filter suggestion read only. */
function sameList(left: ConclusionDraft[], right: ConclusionDraft[]): boolean {
  return left.length === right.length && left.every((node, index) => {
    const other = right[index]!
    return node.key === other.key
      && node.conclusion === other.conclusion
      && node.bucket === other.bucket
      && node.question.trim() === other.question.trim()
      && node.fix === other.fix
      && node.outcome === other.outcome
      && node.lines.length === other.lines.length
      && node.lines.every((line, lineIndex) => !conditionChanged(other.lines[lineIndex]!.condition, line.condition))
  })
}

const NO_VALUE_OPERATORS = new Set(['', 'BLANK', 'NOT_BLANK', 'GT_ZERO'])
const ONE_VALUE_OPERATORS = new Set(['GT', 'LT', 'WITHIN_HOURS'])

/** A new or changed line as the service should store it: trimmed field, comma-split unique values, as many as its test takes. */
function normalizedCondition(condition: RunConclusionCondition): RunConclusionCondition {
  const operator = condition.operator ?? ''
  const values: string[] = []
  for (const part of (condition.values ?? []).flatMap((value) => value.split(','))) {
    const value = part.trim()
    if (value && !values.includes(value)) values.push(value)
  }
  return {
    ...condition,
    field: (condition.field ?? '').trim() || null,
    values: NO_VALUE_OPERATORS.has(operator) ? [] : ONE_VALUE_OPERATORS.has(operator) ? values.slice(0, 1) : values,
  }
}

export function useRunConclusions(deps: UseRunConclusionsDeps) {
  const loading = ref(false)
  const saving = ref(false)
  const loaded = ref(false)
  /** What stopped the conclusions loading, or the service's words for a refused save. */
  const errors = ref<string[]>([])
  const meta = ref<RunConclusions | null>(null)
  const list = ref<ConclusionDraft[]>([])
  const unexplained = ref<'' | 'EXPECTED'>('')
  const lookups = ref<RunConclusionLookup[]>([])
  const snapshot = ref<Snapshot>({ list: [], unexplained: '' })
  const newCodeErrors = ref<string[]>([])
  const creating = ref(false)

  let uidCounter = 0
  let controller: AbortController | null = null

  const isEvaluate = computed(() => (meta.value?.scopeMode ?? '').toUpperCase() === 'EVALUATE')

  // The run's lookups are known here, so both pages word a lookup path the same way.
  const lineContext = computed<LineContext>(() => {
    const listPaths = new Set(deps.listPaths.value)
    const nonListPaths = new Set(deps.nonListPaths?.value ?? [])
    for (const lookup of lookups.value) {
      if (lookup.many) listPaths.add(lookup.name)
      else nonListPaths.add(lookup.name)
    }
    return {
      file1: deps.file1Label.value,
      file2: deps.file2Label.value,
      evaluate: isEvaluate.value,
      firstKeyField: deps.firstKeyField.value,
      listPaths,
      nonListPaths,
    }
  })

  const dirty = computed(() => loaded.value
    && (unexplained.value !== snapshot.value.unexplained || !sameList(list.value, snapshot.value.list)))

  /** One line per stored conclusion the tree cannot place, naming it by its rank. */
  const treeProblems = computed(() => list.value.flatMap((node, index) => (node.problem
    ? [`Conclusion ${index + 1}, ${conclusionLabel(node) || 'unnamed'}, ${PROBLEM_WORDS[node.problem]}. Delete it to save.`]
    : [])))

  /**
   * A conclusion with no name or no line, or a line missing its field or values, cannot be saved (the service needs a
   * line); nor can a list holding a conclusion the tree cannot place, since saving it as a root would change what it matches.
   */
  const incomplete = computed(() => list.value.some((node) => node.problem
    || !node.conclusion
    || !node.lines.length
    || node.lines.some((line) => conditionIncomplete(line.condition))))

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

  // A one-system run has no second side to be missing from, and FINDING never fires on a compare run; a stored
  // conclusion that says either still shows what it says.
  // A one-system run has no second side and no duplicate-key rows (every row is a finding); a compare run has no findings.
  const offersBucket = (bucket: string): boolean => {
    const never = isEvaluate.value ? bucket === 'MISSING_FROM_FILE_2' || bucket.startsWith('DUPLICATE_IN_FILE_') : bucket === 'FINDING'
    if (!never) return true
    return list.value.some((node) => node.bucket === bucket)
  }
  const bucketOptions = computed<AppSelectOption[]>(() => [
    { value: '', label: explainsLabel('', lineContext.value) },
    ...(meta.value?.buckets?.length ? meta.value.buckets : DEFAULT_BUCKETS)
      .filter(offersBucket)
      .map((bucket) => ({ value: bucket, label: explainsLabel(bucket, lineContext.value) })),
  ])

  function conclusionLabel(node: ConclusionDraft): string {
    if (!node.conclusion) return ''
    return catalogOptions.value.find((option) => option.value === node.conclusion)?.label || node.conclusion
  }

  /** The row's "when": every line, all of which must hold. No line reads nothing; it cannot be saved. */
  function describeLines(node: ConclusionDraft): string {
    return node.lines.map((line) => describeCondition(line.condition, lineContext.value)).join(' and ')
  }

  function nextUid(prefix: string): string {
    uidCounter += 1
    return `${prefix}${uidCounter}`
  }

  function blankCondition(): RunConclusionCondition {
    return {
      subject: 'FILE_1',
      presence: 'ANY',
      keyScope: 'FULL',
      quantifier: 'ALL',
      field: null,
      operator: 'IN',
      values: [],
      checkLabel: '',
    }
  }

  function toDraft(node: FlatConclusion): ConclusionDraft {
    return {
      uid: nextUid('c'),
      key: String(node.key),
      conclusion: node.conclusion ?? '',
      bucket: node.bucket ?? '',
      question: node.question ?? '',
      fix: node.fix ?? null,
      outcome: toOutcome(node.outcome),
      suggestsFilter: Boolean(node.suggestedFilterJson?.trim()),
      problem: node.problem ?? null,
      lines: (node.conditions ?? []).map((condition) => ({
        uid: nextUid('l'),
        condition: cloneCondition(condition),
        loaded: cloneCondition(condition),
      })),
    }
  }

  function applyLoaded(next: RunConclusions): void {
    meta.value = next
    // Keys and parents compared as strings, as the service may read them back as numbers.
    const nodes = (next.conclusions ?? []).map((node) => ({
      ...node,
      key: String(node.key),
      parent: node.parent ? String(node.parent) : null,
    }))
    list.value = flattenConclusionTree(nodes).map(toDraft)
    unexplained.value = next.unexplainedOutcome === 'EXPECTED' ? 'EXPECTED' : ''
    lookups.value = next.lookups ?? []
    snapshot.value = { list: cloneList(list.value), unexplained: unexplained.value }
    loaded.value = true
  }

  function find(uid: string): ConclusionDraft | undefined {
    return list.value.find((node) => node.uid === uid)
  }

  /** A blank conclusion at the end of the list; returns its uid, or '' while a save is under way. */
  function addConclusion(): string {
    if (saving.value) return ''
    const node: ConclusionDraft = {
      uid: nextUid('c'),
      key: '',
      conclusion: '',
      bucket: '',
      question: '',
      fix: null,
      outcome: '',
      suggestsFilter: false,
      problem: null,
      lines: [{ uid: nextUid('l'), condition: blankCondition(), loaded: null }],
    }
    list.value.push(node)
    return node.uid
  }

  function removeConclusion(uid: string): void {
    if (saving.value) return
    list.value = list.value.filter((node) => node.uid !== uid)
  }

  /** Swaps the conclusion with its neighbour above (-1) or below (1); at either end it stays put. */
  function move(uid: string, direction: -1 | 1): void {
    if (saving.value) return
    const from = list.value.findIndex((node) => node.uid === uid)
    const to = from + direction
    if (from < 0 || to < 0 || to >= list.value.length) return
    const next = [...list.value]
    const moving = next[from]!
    next[from] = next[to]!
    next[to] = moving
    list.value = next
  }

  function updateConclusion(uid: string, patch: Partial<Omit<ConclusionDraft, 'uid' | 'lines' | 'suggestsFilter' | 'problem'>>): void {
    if (saving.value) return
    const node = find(uid)
    if (node) Object.assign(node, patch)
  }

  /** A blank line at the end of the conclusion; returns its uid, or '' when there is no such conclusion or a save is under way. */
  function addLine(uid: string): string {
    if (saving.value) return ''
    const node = find(uid)
    if (!node) return ''
    const line: DraftLine = { uid: nextUid('l'), condition: blankCondition(), loaded: null }
    node.lines.push(line)
    return line.uid
  }

  function updateLine(uid: string, lineUid: string, condition: RunConclusionCondition): void {
    if (saving.value) return
    const line = find(uid)?.lines.find((entry) => entry.uid === lineUid)
    if (line) line.condition = cloneCondition(condition)
  }

  function removeLine(uid: string, lineUid: string): void {
    if (saving.value) return
    const node = find(uid)
    if (node) node.lines = node.lines.filter((line) => line.uid !== lineUid)
  }

  /** The list as roots in rank order; a new conclusion's key is its place, kept unique among the loaded keys. */
  function buildPayload(drafts: ConclusionDraft[]): RunConclusionNode[] {
    const taken = new Set(drafts.map((node) => node.key).filter(Boolean))
    const ctx = lineContext.value
    return drafts.map((node, index) => {
      let key = node.key
      if (!key) {
        key = `n${index}`
        for (let suffix = 1; taken.has(key); suffix += 1) key = `n${index}-${suffix}`
        taken.add(key)
      }
      return {
        key,
        parent: null,
        conclusion: node.conclusion,
        bucket: (node.bucket || null) as ConclusionBucket | null,
        question: node.question.trim() || null,
        fix: node.fix,
        outcome: (node.outcome || null) as ConclusionOutcome | null,
        // An untouched line goes back exactly as loaded; a new or changed one is normalised before it is labelled.
        conditions: node.lines.map((line) => line.loaded && !conditionChanged(line.loaded, line.condition)
          ? withCheckLabel(line.condition, line.loaded, ctx)
          : withCheckLabel(normalizedCondition(line.condition), line.loaded, ctx)),
      }
    })
  }

  /** Sends the whole list once. A refusal keeps the draft and shows the service's words. */
  async function save(): Promise<boolean> {
    if (saving.value || !loaded.value || !meta.value || incomplete.value) return false
    saving.value = true
    errors.value = []
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    // What is sent, held apart from the live list: an edit made during the await cannot shift what is adopted.
    const sent = list.value.map((node) => ({ node, lines: [...node.lines] }))
    const payload = buildPayload(list.value)
    const nextUnexplained = unexplained.value
    const options = nextUnexplained !== snapshot.value.unexplained
      ? { unexplainedOutcome: nextUnexplained === 'EXPECTED' ? 'EXPECTED' as const : 'COUNTS' as const }
      : undefined
    try {
      const response = options
        ? await runConclusionFacade.save(deps.savedRunId.value, payload, signal, options)
        : await runConclusionFacade.save(deps.savedRunId.value, payload, signal)
      if (response.savedConclusions) {
        applyLoaded(response.savedConclusions)
      } else {
        // Adopt what was sent: keys assigned, each line's label as saved.
        payload.forEach((sentNode, index) => {
          const { node, lines } = sent[index]!
          node.key = sentNode.key
          sentNode.conditions.forEach((condition, lineIndex) => {
            const line = lines[lineIndex]!
            line.condition = cloneCondition(condition)
            line.loaded = cloneCondition(condition)
          })
        })
        meta.value = { ...meta.value, conclusions: payload, unexplainedOutcome: nextUnexplained === 'EXPECTED' ? 'EXPECTED' : null }
        snapshot.value = {
          list: cloneList(sent.map(({ node, lines }) => ({ ...node, lines }))),
          unexplained: nextUnexplained,
        }
      }
      return true
    } catch (error) {
      if (isAbortError(error)) return false
      errors.value = serviceErrors(error, 'The conclusions are still undecided. Not saved.')
      return false
    } finally {
      saving.value = false
    }
  }

  /** Puts back the list as last loaded or saved. */
  function cancel(): void {
    if (saving.value) return
    list.value = cloneList(snapshot.value.list)
    unexplained.value = snapshot.value.unexplained
    errors.value = []
  }

  /** Makes a tenant-own conclusion code and adds it to the catalog; returns its id, or null when refused. */
  async function createCode(label: string): Promise<string | null> {
    const trimmed = label.trim()
    if (!trimmed || creating.value || !meta.value) return null
    creating.value = true
    newCodeErrors.value = []
    try {
      const response = await runConclusionFacade.createCode(trimmed)
      const code = response.conclusionCode
      if (!code?.id) {
        newCodeErrors.value = ['The conclusion would not join the party. Not added.']
        return null
      }
      const catalog = meta.value.catalog ?? []
      if (!catalog.some((entry) => entry.id === code.id)) {
        meta.value.catalog = [...catalog, { id: code.id, label: code.label || code.id, own: true }]
      }
      return code.id
    } catch (error) {
      if (!isAbortError(error)) newCodeErrors.value = serviceErrors(error, 'The conclusion would not join the party. Not added.')
      return null
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
    list,
    unexplained,
    lookups,
    dirty,
    incomplete,
    treeProblems,
    lineContext,
    catalogOptions,
    bucketOptions,
    conclusionLabel,
    describeLines,
    addConclusion,
    removeConclusion,
    move,
    updateConclusion,
    addLine,
    updateLine,
    removeLine,
    save,
    cancel,
    load,
    createCode,
    creating,
    newCodeErrors,
  }
}

export type RunConclusionsState = ReturnType<typeof useRunConclusions>

export const RUN_CONCLUSIONS_KEY: InjectionKey<RunConclusionsState> = Symbol('runConclusions')

/** The conclusions the page holds, read by its rows. */
export function injectRunConclusions(): RunConclusionsState {
  const state = inject(RUN_CONCLUSIONS_KEY, null)
  if (!state) throw new Error('Run conclusions are not provided.')
  return state
}
