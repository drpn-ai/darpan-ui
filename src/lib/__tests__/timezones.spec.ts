import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBrowserTimeZone } from '../timezones'

describe('resolveBrowserTimeZone', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the zone the browser would format times in', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Calcutta' }),
    } as unknown as Intl.DateTimeFormat)

    expect(resolveBrowserTimeZone()).toBe('Asia/Calcutta')
  })

  it('reports no zone rather than throwing when the environment cannot resolve one', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl unavailable')
    })

    expect(resolveBrowserTimeZone()).toBe('')
  })
})
