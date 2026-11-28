import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>()
  return { ...actual, callService: vi.fn() }
})

import { callService } from '../client'
import { settingsFacade } from '../facade'

const call = vi.mocked(callService)

// C4 (darpan-hotwax 216da11): the HotWax save's refusal carries a reason the edit page acts on, so it comes back as
// the result instead of being thrown.
describe('settingsFacade.saveOmsRestSourceConfig', () => {
  beforeEach(() => call.mockReset().mockResolvedValue({}))

  it('returns a refusal as its result', async () => {
    const payload = { baseUrl: 'https://oms.example.com', timeZone: 'UTC', authType: 'NONE', connectTimeoutSeconds: 30, readTimeoutSeconds: 60 }
    await settingsFacade.saveOmsRestSourceConfig(payload)
    expect(call).toHaveBeenCalledWith('facade.HotWaxOmsFacadeServices.save#HotWaxOmsRestSourceConfig', payload, undefined, { refusalIsResult: true })
  })
})
