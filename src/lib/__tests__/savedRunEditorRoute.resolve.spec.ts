import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedRunSummary } from '../api/types'

const listSavedRuns = vi.hoisted(() => vi.fn())

vi.mock('../api/facade', () => ({
  reconciliationFacade: { listSavedRuns },
}))

import { homeSavedRuns } from '../api/queries'
import { invalidateReadCache, prefetchQuery } from '../api/readCache'
import { resolveSavedRunEditorTarget } from '../savedRunEditorRoute'

function run(savedRunId: string): SavedRunSummary {
  return { savedRunId, runName: savedRunId, requiresSystemSelection: false, systemOptions: [] }
}

function page(savedRuns: SavedRunSummary[], pageIndex = 0, pageCount = 1) {
  return {
    ok: true,
    messages: [],
    errors: [],
    pagination: { pageIndex, pageSize: 100, totalCount: savedRuns.length, pageCount },
    savedRuns,
  }
}

const never = () => new Promise(() => {})

// DAR-UI-156: opening a run's settings must not wait on list#SavedRuns when the tab already holds the list.
describe('resolveSavedRunEditorTarget', () => {
  beforeEach(() => {
    invalidateReadCache()
    listSavedRuns.mockReset()
  })

  it('answers from the warm saved-run list without asking the network', async () => {
    listSavedRuns.mockResolvedValueOnce(page([run('RS_A'), run('RS_B')]))
    await prefetchQuery(homeSavedRuns)
    listSavedRuns.mockReset()
    listSavedRuns.mockImplementation(never)

    await expect(resolveSavedRunEditorTarget('RS_B')).resolves.toMatchObject({ savedRunId: 'RS_B' })
    expect(listSavedRuns).not.toHaveBeenCalled()
  })

  // The editor is seeded from this row: a copy over a minute old could miss an edit made since in another tab, which a
  // save would then overwrite, so it reads the run fresh.
  it('reads the network when the warm list is over a minute old', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-26T12:00:00Z'))
      listSavedRuns.mockResolvedValueOnce(page([run('RS_A')]))
      await prefetchQuery(homeSavedRuns)
      vi.setSystemTime(new Date('2026-11-26T12:01:01Z'))
      listSavedRuns.mockResolvedValue(page([{ ...run('RS_A'), runName: 'Edited elsewhere' }]))

      await expect(resolveSavedRunEditorTarget('RS_A')).resolves.toMatchObject({ runName: 'Edited elsewhere' })
      expect(listSavedRuns).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 100, query: '' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads the network when a write has dropped the warm list', async () => {
    listSavedRuns.mockResolvedValueOnce(page([run('RS_OLD')]))
    await prefetchQuery(homeSavedRuns)
    invalidateReadCache()
    listSavedRuns.mockResolvedValue(page([run('RS_OLD'), run('RS_NEW')]))

    await expect(resolveSavedRunEditorTarget('RS_NEW')).resolves.toMatchObject({ savedRunId: 'RS_NEW' })
    expect(listSavedRuns).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 100, query: '' })
  })

  it('never answers "not found" from a warm list that predates the run', async () => {
    listSavedRuns.mockResolvedValueOnce(page([run('RS_OLD')]))
    await prefetchQuery(homeSavedRuns)
    listSavedRuns.mockResolvedValueOnce(page([run('RS_OLD'), run('RS_MADE_IN_ANOTHER_TAB')]))

    await expect(resolveSavedRunEditorTarget('RS_MADE_IN_ANOTHER_TAB'))
      .resolves.toMatchObject({ savedRunId: 'RS_MADE_IN_ANOTHER_TAB' })
    expect(listSavedRuns).toHaveBeenLastCalledWith({ pageIndex: 0, pageSize: 100, query: '' })
  })

  it('pages past the first hundred runs, and answers null for a run that is nowhere', async () => {
    listSavedRuns
      .mockResolvedValueOnce(page([run('RS_A')], 0, 2))
      .mockResolvedValueOnce(page([run('RS_A')], 0, 2))
      .mockResolvedValueOnce(page([run('RS_FAR')], 1, 2))
    await expect(resolveSavedRunEditorTarget('RS_FAR')).resolves.toMatchObject({ savedRunId: 'RS_FAR' })
    expect(listSavedRuns).toHaveBeenLastCalledWith({ pageIndex: 1, pageSize: 100, query: '' })

    listSavedRuns.mockResolvedValue(page([run('RS_A')]))
    await expect(resolveSavedRunEditorTarget('RS_GONE')).resolves.toBeNull()
  })

  // The lookup shares Home's cache entry, so it must ask exactly what Home asks under that key.
  it('asks the same list#SavedRuns page as the homeSavedRuns entry it shares', async () => {
    listSavedRuns.mockResolvedValue(page([]))
    await homeSavedRuns.fetch()
    const homeRequest = listSavedRuns.mock.calls[0]?.[0]
    listSavedRuns.mockClear()
    await resolveSavedRunEditorTarget('RS_ANY')
    expect(listSavedRuns.mock.calls[0]).toEqual([homeRequest])
  })

  it('matches a rule set or mapping id as well as the saved run id, and answers null for a blank id', async () => {
    listSavedRuns.mockResolvedValue(page([{ ...run('SR_1'), ruleSetId: 'RULESET_1', reconciliationMappingId: 'MAP_1' }]))
    await expect(resolveSavedRunEditorTarget(' RULESET_1 ')).resolves.toMatchObject({ savedRunId: 'SR_1' })
    await expect(resolveSavedRunEditorTarget('MAP_1')).resolves.toMatchObject({ savedRunId: 'SR_1' })
    await expect(resolveSavedRunEditorTarget('  ')).resolves.toBeNull()
  })
})
