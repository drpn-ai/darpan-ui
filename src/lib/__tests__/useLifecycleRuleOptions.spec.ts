import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/facade', () => ({ reconciliationFacade: { getLifecycleRuleOptions: vi.fn() } }))

import { reconciliationFacade } from '../api/facade'
import { clearStoredReads, setReadCacheScope } from '../api/readCache'
import { useLifecycleRuleOptions } from '../useLifecycleRuleOptions'

const f = vi.mocked(reconciliationFacade)
const source = { nsAuthConfigId: 'shared_ns', recordType: 'SalesOrd' }

afterEach(() => {
  clearStoredReads()
  setReadCacheScope(null)
})

describe('useLifecycleRuleOptions (DAR-UI-050)', () => {
  // A read started for one tenant must never answer a pick made after a switch, even on a shared account.
  it('does not hand a read in flight for one tenant to the next', async () => {
    let release!: (v: unknown) => void
    f.getLifecycleRuleOptions.mockReset()
    f.getLifecycleRuleOptions.mockImplementationOnce((() => new Promise((res) => { release = res })) as never)
    f.getLifecycleRuleOptions.mockResolvedValueOnce({ values: [{ value: 'KREWE', label: 'KREWE' }] } as never)
    setReadCacheScope('alice|GORJANA')
    const before = useLifecycleRuleOptions()
    const pending = before.loadValues(source, 'custbody_channel')
    setReadCacheScope('alice|KREWE')
    const after = useLifecycleRuleOptions()
    await after.loadValues(source, 'custbody_channel')
    release({ values: [{ value: 'GORJANA', label: 'GORJANA' }] })
    await pending
    expect(after.values.custbody_channel).toEqual([{ value: 'KREWE', label: 'KREWE' }])
    expect(f.getLifecycleRuleOptions).toHaveBeenCalledTimes(2)
  })
})
