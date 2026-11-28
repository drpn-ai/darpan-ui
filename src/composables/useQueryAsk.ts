// DAR-BE-334, DAR-OPS-029 U09. A query page's ask box: the question goes to the queries agent, whose proposal has
// already run on the tenant's data. The proposal fills the draft and saves nothing; the person can put theirs back.
import { ref, type Ref } from 'vue'
import { serviceErrors } from '../lib/api/client'
import { scriptFacade } from '../lib/api/facade'
import type { QueryRun } from '../lib/api/scriptTypes'

/** The part of a query draft the agent reads and may replace. */
export interface AskableDraft {
  queryName: string
  description: string
  readSpecJson: string
  scriptBody: string
}

export interface QueryAskOptions {
  draft: Ref<AskableDraft | null>
  /** True while anything else on the page is busy; the ask waits for it. */
  isBusy: () => boolean
  /** The agent's run, shown with this visit's runs. */
  onRun: (label: string, run: QueryRun) => void
  /** The page's run error: cleared as the question goes, set when it fails. */
  setError: (message: string) => void
}

export function useQueryAsk(options: QueryAskOptions) {
  const askText = ref('')
  const askReply = ref('')
  const askOptions = ref<string[]>([])
  const asking = ref(false)
  /** The read and script the agent's last proposal replaced, so the person can put them back. */
  const previousDraft = ref<{ readSpecJson: string; scriptBody: string } | null>(null)
  let conversationId: string | undefined

  async function ask(): Promise<void> {
    const current = options.draft.value
    const text = askText.value.trim()
    if (!current || options.isBusy() || !text) return
    asking.value = true
    askReply.value = ''
    askOptions.value = []
    options.setError('')
    try {
      const draftNow = { readSpecJson: current.readSpecJson, scriptBody: current.scriptBody }
      const out = await scriptFacade.sendAgentQueryTurn({ ...(conversationId ? { conversationId } : {}), text, ...draftNow })
      conversationId = out.conversationId ?? conversationId
      askReply.value = out.question?.text || out.reply || ''
      askOptions.value = out.question?.options ?? []
      const proposed = out.queryProposal
      if (proposed) {
        previousDraft.value = draftNow
        current.readSpecJson = proposed.proposal.readSpecJson ?? ''
        current.scriptBody = proposed.proposal.scriptBody
        if (!current.queryName.trim() && proposed.proposal.queryName) current.queryName = proposed.proposal.queryName
        if (!current.description && proposed.proposal.description) current.description = proposed.proposal.description
        options.onRun("Agent's run", proposed.preview)
        askText.value = ''
      }
    } catch (error) {
      const sentences = serviceErrors(error, 'Could not ask the agent.')
      // A conversation from another tenant or an earlier visit is not found: start a new one next time.
      if (sentences.some((sentence) => sentence.includes('was not found'))) conversationId = undefined
      options.setError(sentences.join(' '))
    } finally {
      asking.value = false
    }
  }

  /** A choice the agent offered: sent as the person's answer. */
  function answer(option: string): void {
    askText.value = option
    void ask()
  }

  function putBackDraft(): void {
    const current = options.draft.value
    const before = previousDraft.value
    if (!current || !before) return
    current.readSpecJson = before.readSpecJson
    current.scriptBody = before.scriptBody
    previousDraft.value = null
  }

  return { askText, askReply, askOptions, asking, previousDraft, ask, answer, putBackDraft }
}
