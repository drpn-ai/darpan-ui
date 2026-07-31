import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { SavedRunSummary } from '../lib/api/types'
import type {
  ReconciliationAutomationDraft,
  ReconciliationAutomationDraftState,
  ReconciliationAutomationStepId,
} from '../lib/reconciliationAutomationDraft'
import type {
  ReconciliationRuleSetDraft,
  ReconciliationRuleSetDraftState,
  ReconciliationRuleSetDraftStepId,
} from '../lib/reconciliationRuleSetDraft'

export interface WorkflowOrigin {
  label: string
  path: string
}

const SESSION_KEY = 'darpan.reconciliationDraftStore'

function readStoredDraftState<T extends { draft: object }>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  if (!record.draft || typeof record.draft !== 'object') return null
  return value as T
}

function loadFromSession(): {
  automationDraftState: ReconciliationAutomationDraftState | null
  ruleSetDraftState: ReconciliationRuleSetDraftState | null
} | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Record<string, unknown>
    return {
      automationDraftState: readStoredDraftState<ReconciliationAutomationDraftState>(stored.automationDraftState),
      ruleSetDraftState: readStoredDraftState<ReconciliationRuleSetDraftState>(stored.ruleSetDraftState),
    }
  } catch {
    return null
  }
}

export const useReconciliationDraftStore = defineStore('reconciliationDraft', () => {
  const persisted = loadFromSession()

  const _automationDraftState = ref<ReconciliationAutomationDraftState | null>(persisted?.automationDraftState ?? null)
  const _ruleSetDraftState = ref<ReconciliationRuleSetDraftState | null>(persisted?.ruleSetDraftState ?? null)
  const _workflowOrigin = ref<WorkflowOrigin | null>(null)

  const automationDraftState = computed(() => _automationDraftState.value)
  const ruleSetDraftState = computed(() => _ruleSetDraftState.value)
  const workflowOrigin = computed(() => _workflowOrigin.value)

  function _persist(): void {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        automationDraftState: _automationDraftState.value ?? null,
        ruleSetDraftState: _ruleSetDraftState.value ?? null,
      }))
    } catch {
      // ignore storage errors
    }
  }

  function setAutomationDraft(
    draft: ReconciliationAutomationDraft,
    resumeStepId: ReconciliationAutomationStepId | null = null,
    savedRun: SavedRunSummary | null = null,
  ): void {
    _automationDraftState.value = { draft, resumeStepId, savedRun }
    _persist()
  }

  function clearAutomationDraft(): void {
    _automationDraftState.value = null
    _persist()
  }

  function setRuleSetDraft(
    draft: ReconciliationRuleSetDraft,
    resumeStepId: ReconciliationRuleSetDraftStepId | null = null,
  ): void {
    _ruleSetDraftState.value = { draft, resumeStepId }
    _persist()
  }

  function clearRuleSetDraft(): void {
    _ruleSetDraftState.value = null
    _persist()
  }

  function setWorkflowOrigin(label: string, path: string): void {
    _workflowOrigin.value = { label, path }
  }

  // resetAll() clears every in-memory draft and the persisted sessionStorage payload. Called on
  // logout / tenant switch via main.ts setApiCacheReset; without this, a draft created in tenant A
  // (with its savedRun summary) is re-hydrated into tenant B's context. Cross-tenant data leak.
  function resetAll(): void {
    _automationDraftState.value = null
    _ruleSetDraftState.value = null
    _workflowOrigin.value = null
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem(SESSION_KEY) } catch { /* storage unavailable */ }
    }
  }

  return {
    automationDraftState,
    ruleSetDraftState,
    workflowOrigin,
    setAutomationDraft,
    clearAutomationDraft,
    setRuleSetDraft,
    clearRuleSetDraft,
    setWorkflowOrigin,
    resetAll,
  }
})
