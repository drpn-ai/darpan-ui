import { afterEach, describe, expect, it } from 'vitest'
import { requestWorkflowHint, WORKFLOW_HINT_REQUEST_EVENT, type WorkflowHintRequestDetail } from '../uiEvents'

// DAR-OPS-029 S99-117. One way to ask the shell (App.vue) for a transient hint, instead of dispatching the event by hand.
describe('requestWorkflowHint', () => {
  let seen: WorkflowHintRequestDetail[] = []
  const listener = (event: Event) => { seen.push((event as CustomEvent<WorkflowHintRequestDetail>).detail) }
  afterEach(() => {
    document.removeEventListener(WORKFLOW_HINT_REQUEST_EVENT, listener)
    seen = []
  })

  it('dispatches the hint request on document with the detail as given', () => {
    document.addEventListener(WORKFLOW_HINT_REQUEST_EVENT, listener)
    requestWorkflowHint({ message: 'Peak hours until 4 pm.', durationMs: 5000 })
    requestWorkflowHint({ message: 'Passwords do not match.', tone: 'warning', durationMs: 5000 })
    expect(seen).toEqual([
      { message: 'Peak hours until 4 pm.', durationMs: 5000 },
      { message: 'Passwords do not match.', tone: 'warning', durationMs: 5000 },
    ])
  })
})
