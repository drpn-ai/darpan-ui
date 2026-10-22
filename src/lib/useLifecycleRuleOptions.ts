import { reactive, ref } from 'vue'
import { reconciliationFacade } from './api/facade'
import { lifecycleRuleFields } from './api/queries'
import { peekAccountMeta, readAccountMeta, readCacheScopeToken, storeAccountMeta } from './api/readCache'

// DAR-UI-050. The rule dropdowns, read from the account: the text fields NetSuite shows on the start record (by their
// own names), and what a chosen field holds, most common first, "No value" for empty. Shared by the lifecycle's
// settings form. Nothing is read on the spot: once the fields are known every field's values are read in the
// background, and both are kept as account metadata (readCache meta), which no Darpan write can change.
export interface LifecycleRuleSource { nsAuthConfigId: string; recordType: string }
export interface LifecycleRuleDraft { fieldId: string; fieldLabel: string; value: string; valueLabel: string }
type Scope = 'STAGE' | 'FINDING'
type RuleValue = { value: string; label: string }

/** Value reads at once per sweep: each is one or two SuiteQL queries, and NetSuite caps an account's concurrent calls. */
export const VALUE_SWEEP_CONCURRENCY = 2

function valuesKey(source: LifecycleRuleSource, scope?: Scope) {
  return `lifecycle.ruleValues:${scope ?? ''}:${source.nsAuthConfigId}:${source.recordType}`
}

const valuesInFlight = new Map<string, Promise<RuleValue[]>>()

/** One field's values: the stored copy, or one read shared by every asker (the sweep and a pick racing it). */
function readValues(source: LifecycleRuleSource, scope: Scope | undefined, fieldId: string): Promise<RuleValue[]> {
  const key = valuesKey(source, scope)
  const held = peekAccountMeta<Record<string, RuleValue[]>>(key)?.[fieldId]
  if (held) return Promise.resolve(held)
  const flightKey = `${key}:${fieldId}`
  const running = valuesInFlight.get(flightKey)
  if (running) return running
  const token = readCacheScopeToken()
  const promise = reconciliationFacade.getLifecycleRuleOptions({ ...source, fieldId, ...(scope ? { scope } : {}) })
    .then((response) => {
      const values = response.values ?? []
      storeAccountMeta(key, { ...(peekAccountMeta<Record<string, RuleValue[]>>(key) ?? {}), [fieldId]: values }, token)
      return values
    })
    .finally(() => { valuesInFlight.delete(flightKey) })
  valuesInFlight.set(flightKey, promise)
  return promise
}

/**
 * Reads every field's values for one scope, VALUE_SWEEP_CONCURRENCY at a time, skipping what is stored. A field that
 * fails is left for its own pick, which asks again and shows the error there. Never throws.
 */
export async function warmLifecycleRuleOptions(source: LifecycleRuleSource, scope?: Scope,
  onValues?: (fieldId: string, values: RuleValue[]) => void): Promise<void> {
  let fieldIds: string[]
  try {
    fieldIds = ((await readAccountMeta(lifecycleRuleFields(source, scope))).fields ?? []).map((f) => f.fieldId)
  } catch {
    return
  }
  const queue = [...fieldIds]
  await Promise.all(Array.from({ length: VALUE_SWEEP_CONCURRENCY }, async () => {
    for (let fieldId = queue.shift(); fieldId !== undefined; fieldId = queue.shift()) {
      try {
        // Read first: an optional call skips its arguments, so `onValues?.(id, await read())` would read nothing.
        const read = await readValues(source, scope, fieldId)
        onValues?.(fieldId, read)
      } catch {
        // Left for the pick.
      }
    }
  }))
}

/** scope STAGE: for a stage exception, which also offers standard fields (Shipping Method) and never "No value". */
/** scope FINDING: for a written finding, which also offers Status, Shipping Method and numbers ("more than"). */
export function useLifecycleRuleOptions(scope?: Scope) {
  const fields = ref<{ fieldId: string; label: string; kind?: 'number' }[]>([])
  const values = reactive<Record<string, RuleValue[]>>({})
  const loadingFields = ref(false)
  const loadingValuesFor = ref<string | null>(null)
  const error = ref<string | null>(null)
  let fieldsFor = ''

  function message(caught: unknown) { return caught instanceof Error ? caught.message : String(caught) }

  async function loadFields(source: LifecycleRuleSource) {
    const key = `${source.nsAuthConfigId}/${source.recordType}`
    if (fieldsFor === key) return
    error.value = null
    // A stored copy draws at once; only a first read of the account shows "Loading...".
    if (peekAccountMeta(lifecycleRuleFields(source, scope).key) === undefined) loadingFields.value = true
    try {
      fields.value = (await readAccountMeta(lifecycleRuleFields(source, scope))).fields ?? []
      Object.assign(values, peekAccountMeta<Record<string, RuleValue[]>>(valuesKey(source, scope)) ?? {})
      fieldsFor = key
    } catch (caught) {
      error.value = message(caught)
    } finally {
      loadingFields.value = false
    }
  }

  /** Every field's values, in the background, so a pick never waits. */
  function warmValues(source: LifecycleRuleSource): Promise<void> {
    return warmLifecycleRuleOptions(source, scope, (fieldId, read) => { if (!values[fieldId]) values[fieldId] = read })
  }

  async function loadValues(source: LifecycleRuleSource, fieldId: string) {
    if (!fieldId || values[fieldId]) return
    loadingValuesFor.value = fieldId
    error.value = null
    try {
      values[fieldId] = await readValues(source, scope, fieldId)
    } catch (caught) {
      error.value = message(caught)
    } finally {
      if (loadingValuesFor.value === fieldId) loadingValuesFor.value = null
    }
  }

  function fieldLabel(fieldId: string) { return fields.value.find((f) => f.fieldId === fieldId)?.label ?? fieldId }
  function valueLabel(fieldId: string, value: string) {
    return values[fieldId]?.find((v) => v.value === value)?.label ?? (value === 'NO_VALUE' ? 'No value' : value)
  }

  return { fields, values, loadingFields, loadingValuesFor, error, loadFields, loadValues, warmValues, fieldLabel, valueLabel }
}
