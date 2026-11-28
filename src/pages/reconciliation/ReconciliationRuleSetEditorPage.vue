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
      class="workflow-form--compact workflow-form--edit-single-page workflow-form--board-stage ruleset-editor-form"
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
import { computed, nextTick, ref, toRaw } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import RuleSetBoard from '../../components/reconciliation/RuleSetBoard.vue'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type { SaveRuleSetRunResponse } from '../../lib/api/types'
import {
  buildSaveRuleSetRunPayload,
  savedRunRuleToDraftRule,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftRule,
} from '../../lib/reconciliationRuleSetDraft'
import { useMascotStore } from '../../stores/mascot'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

const router = useRouter()
const draftStore = useReconciliationDraftStore()
const mascot = useMascotStore()
const pageError = ref<string | null>(null)
const loadingFields = ref(false)

const draftState = computed(() => draftStore.ruleSetDraftState)
const draft = computed<ReconciliationRuleSetDraft | null>(() => draftState.value?.draft ?? null)

// `draft.value` is the store's own object, not a copy — RuleSetBoard mutates its rules and both
// exclude-filter arrays in place, continuously (see syncRulesToDraft / applyExclusionEdit), not
// just on an explicit Save. Snapshotting here, at page setup — before the board has mounted and
// had a chance to write anything — is what lets cancelRuleEdit genuinely discard those edits
// instead of handing the already-mutated object straight back to the store.
const originalRules = draft.value?.rules
const originalFile1ExcludeFilters = draft.value?.file1ExcludeFilters
const originalFile2ExcludeFilters = draft.value?.file2ExcludeFilters

type BoardEdits = [
  ReconciliationRuleSetDraft['rules'],
  ReconciliationRuleSetDraft['file1ExcludeFilters'],
  ReconciliationRuleSetDraft['file2ExcludeFilters'],
]

/** The rules (and exclusions) the board wrote, as raw arrays: a later edit replaces them, so identity says "unchanged". */
function boardEdits(of: ReconciliationRuleSetDraft | null | undefined): BoardEdits {
  return [toRaw(of?.rules), toRaw(of?.file1ExcludeFilters), toRaw(of?.file2ExcludeFilters)]
}

function stillHolds(savedRunId: string, edits: BoardEdits): boolean {
  const held = draftStore.ruleSetDraftState?.draft
  return held?.savedRunId === savedRunId && boardEdits(held).every((value, index) => value === edits[index])
}

/** The stored rules carry the ids save#RuleSetRun gave new ones; taken only while nobody has changed the rules since. */
function adoptSavedRules(savedRunId: string, edits: BoardEdits, response: SaveRuleSetRunResponse): void {
  const savedRules = response.savedRun?.rules
  const held = draftStore.ruleSetDraftState
  if (!Array.isArray(savedRules) || !held || !stillHolds(savedRunId, edits)) return
  draftStore.setRuleSetDraft({
    ...held.draft,
    rules: savedRules
      .map(savedRunRuleToDraftRule)
      .filter((rule): rule is ReconciliationRuleSetDraftRule => rule !== null),
  }, held.resumeStepId)
}

/**
 * DAR-UI-156: a refused save, seen on whatever page the person is on. The run details go back to the stored rules (only
 * while they still hold this edit), and the mascot keeps the edited rules, with the way back to the board.
 */
async function raiseRefusedSave(leaving: Promise<unknown>, error: unknown, edited: ReconciliationRuleSetDraft, edits: BoardEdits): Promise<void> {
  const savedRunId = edited.savedRunId ?? ''
  const [rules, file1ExcludeFilters, file2ExcludeFilters] = edits
  // The dock drops every warning on a route change: raise only once the page this left for has landed.
  await leaving.catch(() => undefined)
  await nextTick()
  const held = draftStore.ruleSetDraftState
  if (held && stillHolds(savedRunId, edits)) {
    draftStore.setRuleSetDraft({
      ...held.draft,
      rules: originalRules,
      file1ExcludeFilters: originalFile1ExcludeFilters,
      file2ExcludeFilters: originalFile2ExcludeFilters,
    }, held.resumeStepId)
  }
  const reason = error instanceof ApiCallError ? error.message : 'The rules broke a rule. Not saved.'
  mascot.raise({
    id: `ruleset-rules-save-refused-${savedRunId}`,
    title: 'Rules not saved',
    prompt: 'Open the rules again?',
    body: `${reason} Your rules are still there.`,
    actions: [{
      label: 'Open the rules',
      testId: 'mascot-warning-action-reopen-ruleset-rules',
      run: () => {
        const current = draftStore.ruleSetDraftState?.draft
        const base = current?.savedRunId === savedRunId ? current : edited
        draftStore.setRuleSetDraft({ ...base, rules, file1ExcludeFilters, file2ExcludeFilters }, 'ruleset-manager')
        return router.push({ name: 'reconciliation-ruleset-editor' }).then(() => undefined)
      },
    }],
  })
}

async function finishRuleEdit(): Promise<void> {
  if (!draft.value || loadingFields.value) return

  loadingFields.value = true
  pageError.value = null
  // The board writes rules and exclusions straight onto `draft.value` as the operator edits
  // (see RuleSetBoard's syncRulesToDraft / applyExclusionEdit), so the current draft is already
  // the up-to-date source of truth here — no separate "collect board state" step is needed.
  const edited = draft.value
  const savedRunId = edited.savedRunId?.trim() ?? ''
  // DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). A saved run's id is known,
  // so the run details open on the click, already showing these rules (they read the draft); save#RuleSetRun runs
  // behind, tied to nothing on this page.
  const payload = savedRunId ? buildSaveRuleSetRunPayload(edited) : null
  const saving = payload ? draftStore.afterRuleSetSaves(() => reconciliationFacade.saveRuleSetRun(payload)) : null
  const edits = boardEdits(edited)
  const origin = draftStore.workflowOrigin
  draftStore.setRuleSetDraft(edited, 'ruleset-manager')
  const leaving = router.push({ path: origin?.path ?? '/reconciliation/ruleset-manager' })
  void saving?.then(
    (response) => adoptSavedRules(savedRunId, edits, response),
    (error: unknown) => raiseRefusedSave(leaving, error, edited, edits),
  )
  await leaving
  loadingFields.value = false
}

async function cancelRuleEdit(): Promise<void> {
  if (!draft.value) return

  // Restore the pristine snapshot before handing the draft back — otherwise whatever the board
  // already wrote in place (a drawn rule, an added exclusion) would ship on the next unrelated
  // save (e.g. editing the run name from the Ruleset Manager), even though the operator hit
  // Cancel here.
  draft.value.rules = originalRules
  draft.value.file1ExcludeFilters = originalFile1ExcludeFilters
  draft.value.file2ExcludeFilters = originalFile2ExcludeFilters

  const origin = draftStore.workflowOrigin
  draftStore.setRuleSetDraft(draft.value, 'ruleset-manager')
  await router.push({ path: origin?.path ?? '/reconciliation/ruleset-manager' })
}
</script>

<style scoped>
.workflow-page--ruleset-editor.workflow-page--edit :deep(.workflow-shell) {
  padding-top: 0;
}

/* Board width and centered actions come from workflow-form--board-stage (WorkflowStepForm.vue),
   shared with the create wizard's rules step so the same board cannot render two different ways
   depending on which door you came through. Only the question row is local: this page opens
   straight onto the board with no question to ask. */
.ruleset-editor-form :deep(.wizard-prompt-row) {
  display: none;
}
</style>
