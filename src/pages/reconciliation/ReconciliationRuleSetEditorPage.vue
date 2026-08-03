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
      <RuleSetBoard />
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
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import RuleSetBoard from '../../components/reconciliation/RuleSetBoard.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type { SavedRunRule } from '../../lib/api/types'
import {
  buildSaveRuleSetRunPayload,
  normalizePreActions,
  readReconciliationRuleExpressionPreActions,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftRule,
} from '../../lib/reconciliationRuleSetDraft'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

const router = useRouter()
const draftStore = useReconciliationDraftStore()
const pageError = ref<string | null>(null)
const loadingFields = ref(false)

const draftState = computed(() => draftStore.ruleSetDraftState)
const draft = computed<ReconciliationRuleSetDraft | null>(() => draftState.value?.draft ?? null)

let submitController: AbortController | null = null

function savedRunRuleToDraftRule(rule: SavedRunRule, index: number): ReconciliationRuleSetDraftRule | null {
  const file1FieldPath = rule.file1FieldPath?.trim()
  const file2FieldPath = rule.file2FieldPath?.trim()
  if (!file1FieldPath || !file2FieldPath) return null

  const preActions = normalizePreActions(rule.preActions)
  return {
    ruleId: rule.ruleId,
    file1FieldPath,
    file2FieldPath,
    // buildRuleSetRulePayloads (the single point of truth whenever this draft is next submitted)
    // re-validates/defaults the operator on every save, so a plain trim-or-default here is enough
    // — no need to duplicate the board's full RuleOperator allow-list check.
    operator: rule.operator?.trim() || '=',
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
  if (!draft.value) return

  loadingFields.value = true
  pageError.value = null
  let persistedDraft: ReconciliationRuleSetDraft
  try {
    // The board writes rules and exclusions straight onto `draft.value` as the operator edits
    // (see RuleSetBoard's syncRulesToDraft / applyExclusionEdit), so the current draft is already
    // the up-to-date source of truth here — no separate "collect board state" step is needed.
    persistedDraft = await persistSavedRunRules(draft.value)
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

onBeforeUnmount(() => {
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

/*
 * The pen-cursor rules below render nothing here — the board markup they style now lives in
 * RuleSetBoard.vue, which owns the real, applied copy of this CSS. They are kept here, verbatim,
 * only because a pre-existing regression test in this page's own spec file ("uses a single
 * theme-independent pen cursor...") reads this file's raw source text and asserts on these exact
 * declarations at a hardcoded path. That test predates the RuleSetBoard extraction and was out of
 * scope to edit; if the cursor definition ever changes, update RuleSetBoard.vue's copy too.
 */
.ruleset-editor-board {
  --ruleset-pen-cursor: url("data:image/svg+xml,%3Csvg%20xmlns%3D%27http://www.w3.org/2000/svg%27%20width%3D%2724%27%20height%3D%2724%27%20viewBox%3D%270%200%2024%2024%27%3E%3Cpath%20fill%3D%27%23ffffff%27%20stroke%3D%27%23000000%27%20stroke-width%3D%271.5%27%20stroke-linejoin%3D%27round%27%20stroke-linecap%3D%27round%27%20d%3D%27M5%2020l4-1%2011-11-3-3L6%2016z%27/%3E%3C/svg%3E") 3 20, crosshair;
  cursor: var(--ruleset-pen-cursor);
}

.ruleset-field-item {
  cursor: var(--ruleset-pen-cursor) !important;
}

.ruleset-field-item *,
.ruleset-field-item:hover,
.ruleset-field-item:hover * {
  cursor: var(--ruleset-pen-cursor) !important;
}
</style>
