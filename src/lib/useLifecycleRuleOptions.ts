import { reactive, ref } from 'vue'
import { reconciliationFacade } from './api/facade'
import { lifecycleRuleFields } from './api/queries'
import { READ_CACHE_MAX_AGE_MS, readQueryOnce } from './api/readCache'

// DAR-UI-050. The rule dropdowns, read from the account: the text fields NetSuite shows on the start record (by their
// own names), and what a chosen field holds, most common first, "No value" for empty. Fields load once; each field's
// values load once. Shared by the create flow's leave-out cards and the lifecycle's settings.
export interface LifecycleRuleSource { nsAuthConfigId: string; recordType: string }
export interface LifecycleRuleDraft { fieldId: string; fieldLabel: string; value: string; valueLabel: string }

/** scope STAGE: for a stage exception, which also offers standard fields (Shipping Method) and never "No value". */
/** scope FINDING: for a written finding, which also offers Status, Shipping Method and numbers ("more than"). */
export function useLifecycleRuleOptions(scope?: 'STAGE' | 'FINDING') {
  const fields = ref<{ fieldId: string; label: string; kind?: 'number' }[]>([])
  const values = reactive<Record<string, { value: string; label: string }[]>>({})
  const loadingFields = ref(false)
  const loadingValuesFor = ref<string | null>(null)
  const error = ref<string | null>(null)
  let fieldsFor = ''

  function message(caught: unknown) { return caught instanceof Error ? caught.message : String(caught) }

  async function loadFields(source: LifecycleRuleSource) {
    const key = `${source.nsAuthConfigId}/${source.recordType}`
    if (fieldsFor === key) return
    loadingFields.value = true
    error.value = null
    try {
      // DAR-UI-051: account metadata, so any cached copy will do; a hover on the settings link may have read it already.
      const query = lifecycleRuleFields({ nsAuthConfigId: source.nsAuthConfigId, recordType: source.recordType }, scope)
      fields.value = (await readQueryOnce(query, READ_CACHE_MAX_AGE_MS)).fields ?? []
      fieldsFor = key
    } catch (caught) {
      error.value = message(caught)
    } finally {
      loadingFields.value = false
    }
  }

  async function loadValues(source: LifecycleRuleSource, fieldId: string) {
    if (!fieldId || values[fieldId]) return
    loadingValuesFor.value = fieldId
    error.value = null
    try {
      values[fieldId] = (await reconciliationFacade.getLifecycleRuleOptions({ ...source, fieldId, ...(scope ? { scope } : {}) })).values ?? []
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

  return { fields, values, loadingFields, loadingValuesFor, error, loadFields, loadValues, fieldLabel, valueLabel }
}
