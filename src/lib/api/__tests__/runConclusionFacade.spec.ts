import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>()
  return { ...actual, callService: vi.fn() }
})

import { callService } from '../client'
import { runConclusionFacade } from '../authoringFacade'

const call = vi.mocked(callService)
const SAVE = 'facade.RunConclusionFacadeServices.save#RunConclusions'

// DAR-UI-135: the run's Unexplained outcome rides along with the conclusions save.
describe('runConclusionFacade.save', () => {
  beforeEach(() => call.mockReset().mockResolvedValue({}))

  it('sends unexplainedOutcome only when given', async () => {
    await runConclusionFacade.save('RS_1', [], undefined, { unexplainedOutcome: 'COUNTS' })
    await runConclusionFacade.save('RS_1', [])
    expect(call.mock.calls[0]?.[0]).toBe(SAVE)
    expect(call.mock.calls[0]?.[1]).toEqual({ savedRunId: 'RS_1', conclusions: [], unexplainedOutcome: 'COUNTS' })
    expect(call.mock.calls[1]?.[1]).toEqual({ savedRunId: 'RS_1', conclusions: [] })
    expect(Object.keys(call.mock.calls[1]?.[1] as object)).not.toContain('unexplainedOutcome')
  })
})
