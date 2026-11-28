import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { errorMessage } from '../lib/api/client'
import type { RunConclusionSuggestedFilter, SavedRunSummary } from '../lib/api/types'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../lib/savedRunEditorRoute'
import { useReconciliationDraftStore } from '../stores/reconciliationDraft'

/**
 * S99-110: open a saved run's editor from a run page. Run History, the Diff page and Run Result each set the workflow
 * origin, built the rule set draft and pushed the editor route by hand. `open` takes a run already in hand (the Diff
 * page's selection); `openById` looks it up first, with a busy flag and the page's error line.
 */
export function useSavedRunEditor(originLabel: string) {
  const route = useRoute()
  const router = useRouter()
  const draftStore = useReconciliationDraftStore()
  const opening = ref(false)
  const error = ref<string | null>(null)

  async function openResolved(savedRun: SavedRunSummary, pendingExclusion: RunConclusionSuggestedFilter | null): Promise<void> {
    const draft = savedRun.runType === 'ruleset' ? buildRuleSetDraft(savedRun) : null
    if (draft) draftStore.setRuleSetDraft(draft, 'ruleset-manager')
    // A suggested exclusion is applied in the rule set editor itself, so it opens there rather than at the run's page.
    if (draft && pendingExclusion) {
      draftStore.setPendingExclusion(pendingExclusion)
      await router.push({ name: 'reconciliation-ruleset-editor' })
      return
    }
    await router.push(buildSavedRunEditorRoute(savedRun))
  }

  async function open(savedRun: SavedRunSummary, pendingExclusion: RunConclusionSuggestedFilter | null = null): Promise<void> {
    draftStore.setWorkflowOrigin(originLabel, route.fullPath)
    await openResolved(savedRun, pendingExclusion)
  }

  async function openById(targetId: string, pendingExclusion: RunConclusionSuggestedFilter | null = null): Promise<void> {
    if (!targetId || opening.value) return
    opening.value = true
    error.value = null
    try {
      draftStore.setWorkflowOrigin(originLabel, route.fullPath)
      const savedRun = await resolveSavedRunEditorTarget(targetId)
      if (!savedRun) {
        error.value = `Run "${targetId}" ran away. Fittingly.`
        return
      }
      await openResolved(savedRun, pendingExclusion)
    } catch (caught) {
      error.value = errorMessage(caught, 'Run settings are behind a door marked pull. We pushed.')
    } finally {
      opening.value = false
    }
  }

  return { opening, error, open, openById }
}
