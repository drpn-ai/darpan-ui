import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>()
  return { ...actual, callService: vi.fn() }
})

import { callService } from '../client'
import { reconciliationFacade } from '../facade'

const call = vi.mocked(callService)

describe('flowchart facade methods', () => {
  beforeEach(() => call.mockReset().mockResolvedValue({ ok: true }))

  it('names the seven services exactly', async () => {
    await reconciliationFacade.listReconciliations()
    await reconciliationFacade.saveReconciliation({ reconciliationName: 'Chain' })
    await reconciliationFacade.getReconciliation({ reconciliationId: 'R1' })
    await reconciliationFacade.saveReconciliationQuestion({ reconciliationId: 'R1', ruleSetId: 'RS1' })
    await reconciliationFacade.deleteReconciliationQuestion({ reconciliationRunId: 'Q1' })
    await reconciliationFacade.runReconciliation({ reconciliationId: 'R1', windowStartDate: 'a', windowEndDate: 'b' })
    await reconciliationFacade.getReconciliationExecution({ reconciliationExecutionId: 'E1' })
    expect(call.mock.calls.map((c) => c[0])).toEqual([
      'facade.ReconciliationFacadeServices.list#Reconciliations',
      'facade.ReconciliationFacadeServices.save#Reconciliation',
      'facade.ReconciliationFacadeServices.get#Reconciliation',
      'facade.ReconciliationFacadeServices.save#ReconciliationQuestion',
      'facade.ReconciliationFacadeServices.delete#ReconciliationQuestion',
      'facade.ReconciliationFacadeServices.run#Reconciliation',
      'facade.ReconciliationFacadeServices.get#ReconciliationExecution',
    ])
    expect(call.mock.calls[3]?.[1]).toEqual({ reconciliationId: 'R1', ruleSetId: 'RS1' })
  })
})
