import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('vue-router', () => ({
  useRoute: () => ({ fullPath: '/reconciliation/runs/RS1' }),
  useRouter: () => ({ push }),
}))
const resolveSavedRunEditorTarget = vi.hoisted(() => vi.fn())
const buildRuleSetDraft = vi.hoisted(() => vi.fn())
const buildSavedRunEditorRoute = vi.hoisted(() => vi.fn())
vi.mock('../../lib/savedRunEditorRoute', () => ({ resolveSavedRunEditorTarget, buildRuleSetDraft, buildSavedRunEditorRoute }))

import { ApiCallError } from '../../lib/api/client'
import type { SavedRunSummary } from '../../lib/api/types'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { useSavedRunEditor } from '../useSavedRunEditor'

const RULESET = { savedRunId: 'RS1', runType: 'ruleset' } as unknown as SavedRunSummary
const MAPPING = { savedRunId: 'M1', runType: 'mapping' } as unknown as SavedRunSummary

function setup(origin = 'Run Result') {
  let editor: ReturnType<typeof useSavedRunEditor> | null = null
  mount(defineComponent({ setup() { editor = useSavedRunEditor(origin); return () => null } }))
  return editor as unknown as ReturnType<typeof useSavedRunEditor>
}

// S99-110: Run History, the Diff page and Run Result each resolved the saved run, set the draft and pushed the editor.
describe('useSavedRunEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockClear()
    resolveSavedRunEditorTarget.mockReset()
    buildRuleSetDraft.mockReset().mockReturnValue({ draft: true })
    buildSavedRunEditorRoute.mockReset().mockReturnValue({ name: 'reconciliation-ruleset-manager' })
  })

  it('opens a rule set: origin, draft, then its editor route', async () => {
    const editor = setup('Run')
    const store = useReconciliationDraftStore()
    const setRuleSetDraft = vi.spyOn(store, 'setRuleSetDraft')
    const setWorkflowOrigin = vi.spyOn(store, 'setWorkflowOrigin')

    await editor.open(RULESET)

    expect(setWorkflowOrigin).toHaveBeenCalledWith('Run', '/reconciliation/runs/RS1')
    expect(setRuleSetDraft).toHaveBeenCalledWith({ draft: true }, 'ruleset-manager')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-manager' })
  })

  it('sets no draft for a mapping run', async () => {
    const editor = setup()
    const setRuleSetDraft = vi.spyOn(useReconciliationDraftStore(), 'setRuleSetDraft')
    await editor.open(MAPPING)
    expect(setRuleSetDraft).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('hands a suggested exclusion to the rule set editor', async () => {
    const editor = setup()
    const setPendingExclusion = vi.spyOn(useReconciliationDraftStore(), 'setPendingExclusion')
    const exclusion = { fieldExpression: 'returnId', operator: 'EXCLUDE_IN', values: ['R1'] }
    await editor.open(RULESET, exclusion as never)
    expect(setPendingExclusion).toHaveBeenCalledWith(exclusion)
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-editor' })
  })

  it('openById resolves the run first, and says so when it is gone', async () => {
    const editor = setup()
    resolveSavedRunEditorTarget.mockResolvedValueOnce(null)
    await editor.openById('RS9')
    expect(editor.error.value).toBe('Run "RS9" ran away. Fittingly.')
    expect(push).not.toHaveBeenCalled()
    expect(editor.opening.value).toBe(false)

    resolveSavedRunEditorTarget.mockResolvedValueOnce(RULESET)
    await editor.openById('RS1')
    expect(editor.error.value).toBeNull()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('openById shows a refusal in its own words, and its own line for anything else', async () => {
    const editor = setup()
    resolveSavedRunEditorTarget.mockRejectedValueOnce(new ApiCallError('Your tenant cannot open this run.'))
    await editor.openById('RS1')
    expect(editor.error.value).toBe('Your tenant cannot open this run.')

    resolveSavedRunEditorTarget.mockRejectedValueOnce(new TypeError('x is undefined'))
    await editor.openById('RS1')
    expect(editor.error.value).toBe('Run settings are behind a door marked pull. We pushed.')
    expect(editor.opening.value).toBe(false)
  })

  it('openById ignores a second press while the first is still opening', async () => {
    const editor = setup()
    let release: (row: SavedRunSummary) => void = () => {}
    resolveSavedRunEditorTarget.mockReturnValueOnce(new Promise((resolve) => { release = resolve }))
    const first = editor.openById('RS1')
    await editor.openById('RS1')
    expect(resolveSavedRunEditorTarget).toHaveBeenCalledTimes(1)
    release(RULESET)
    await first
    expect(push).toHaveBeenCalledTimes(1)
  })
})
