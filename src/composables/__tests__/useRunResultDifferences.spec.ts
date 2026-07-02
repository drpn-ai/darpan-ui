import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'

vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: {
    getGeneratedOutputDifferences: vi.fn(),
  },
}))

import { useRunResultDifferences, type UseRunResultDifferences } from '../useRunResultDifferences'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'
import type { GetGeneratedOutputDifferencesResponse } from '../../lib/api/types'

const getGeneratedOutputDifferences = vi.mocked(reconciliationFacade.getGeneratedOutputDifferences)

// Matches the composable's DIFF_SEARCH_DEBOUNCE_MS; tests wait slightly longer before asserting.
const SEARCH_DEBOUNCE_WAIT = 360

function serverRow(recordId: string, bucket: string, ruleFilterKey = 'base-diff') {
  return {
    rowKey: `${bucket}-${recordId}`,
    recordId,
    bucket,
    ruleFilterKey,
    ruleId: ruleFilterKey,
    ruleLabel: ruleFilterKey === 'base-diff' ? 'Base comparison' : ruleFilterKey,
    record: { id: recordId, data: `{"order_id":"${recordId}"}` },
  }
}

function serverResponse(overrides: Record<string, unknown> = {}): GetGeneratedOutputDifferencesResponse {
  return {
    ok: true,
    messages: [],
    errors: [],
    differences: [serverRow('1001', 'file-1')],
    pageIndex: 0,
    pageCount: 1,
    totalFiltered: 1,
    totalDifferences: 1,
    bucketCounts: { 'file-1': 1, 'file-2': 0, rule: 0 },
    ruleOptions: [
      { key: 'base-diff', label: 'Rule 0', detail: 'Base comparison', count: 1, bucketKeys: ['file-1'] },
    ],
    ...overrides,
  } as GetGeneratedOutputDifferencesResponse
}

interface MountedDifferences {
  differences: UseRunResultDifferences
  loadErrors: string[]
  wrapper: VueWrapper
}

function mountDifferences(fileName = 'CSV-Order-Compare-diff.json'): MountedDifferences {
  const loadErrors: string[] = []
  let differences!: UseRunResultDifferences
  const wrapper = mount(defineComponent({
    setup() {
      differences = useRunResultDifferences({
        outputFileName: computed(() => fileName),
        onLoadError: (message) => {
          loadErrors.push(message)
        },
      })
      return () => null
    },
  }))
  return { differences, loadErrors, wrapper }
}

describe('useRunResultDifferences', () => {
  beforeEach(() => {
    getGeneratedOutputDifferences.mockReset()
  })

  it('applyDifferencesResponse maps page rows and stores facets when requested', () => {
    const { differences } = mountDifferences()

    differences.applyDifferencesResponse(serverResponse(), true)

    expect(differences.diffDetailRows.value).toEqual([
      expect.objectContaining({
        rowKey: 'file-1-1001',
        recordId: '1001',
        bucket: 'file-1',
        detailValue: { order_id: '1001' },
      }),
    ])
    expect(differences.diffTotalCount.value).toBe(1)
    expect(differences.diffFilteredCount.value).toBe(1)
    expect(differences.diffDetailBucketCounts.value).toEqual({ 'file-1': 1, 'file-2': 0, rule: 0 })
    expect(differences.ruleSelectorOptions.value).toHaveLength(1)
    expect(differences.ruleSelectorAllDetail.value).toBe('1 difference')
  })

  it('applyDifferencesResponse leaves facets untouched on follow-up pages', () => {
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(serverResponse(), true)

    differences.applyDifferencesResponse(
      serverResponse({ differences: [serverRow('1002', 'file-2')], bucketCounts: undefined, ruleOptions: undefined }),
      false,
    )

    expect(differences.diffDetailRows.value[0]?.recordId).toBe('1002')
    expect(differences.diffDetailBucketCounts.value).toEqual({ 'file-1': 1, 'file-2': 0, rule: 0 })
    expect(differences.ruleSelectorOptions.value).toHaveLength(1)
  })

  it('loadDifferencesPage fetches the requested page with the active filters', async () => {
    getGeneratedOutputDifferences.mockResolvedValue(serverResponse({ pageIndex: 1, pageCount: 2 }))
    const { differences } = mountDifferences()

    await differences.loadDifferencesPage(1, false)

    expect(getGeneratedOutputDifferences).toHaveBeenCalledWith(
      {
        fileName: 'CSV-Order-Compare-diff.json',
        pageIndex: 1,
        pageSize: expect.any(Number),
        buckets: 'file-1,file-2,rule',
        ruleFilterKey: 'all',
        search: '',
        includeFacets: false,
      },
      expect.any(AbortSignal),
    )
    expect(differences.diffPageIndex.value).toBe(1)
    expect(differences.differencesLoading.value).toBe(false)
  })

  it('shows an empty page without fetching when no bucket is active', async () => {
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(serverResponse(), true)
    differences.selectedDiffBuckets.value = []

    await differences.loadDifferencesPage(0, false)

    expect(getGeneratedOutputDifferences).not.toHaveBeenCalled()
    expect(differences.diffDetailRows.value).toEqual([])
    expect(differences.diffFilteredCount.value).toBe(0)
    expect(differences.diffPageCount.value).toBe(1)
  })

  it('reports load failures through onLoadError', async () => {
    getGeneratedOutputDifferences.mockRejectedValue(new ApiCallError('Differences unavailable', 503))
    const { differences, loadErrors } = mountDifferences()

    await differences.loadDifferencesPage(0, false)

    expect(loadErrors).toEqual(['Differences unavailable'])
    expect(differences.differencesLoading.value).toBe(false)
  })

  it('goToDiffDetailsPage clamps the target page and skips no-op moves', async () => {
    getGeneratedOutputDifferences.mockResolvedValue(serverResponse({ pageIndex: 1, pageCount: 2 }))
    const { differences } = mountDifferences()
    differences.diffPageCount.value = 2

    await differences.goToDiffDetailsPage(0)
    expect(getGeneratedOutputDifferences).not.toHaveBeenCalled()

    await differences.goToDiffDetailsPage(9)
    expect(getGeneratedOutputDifferences).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 1 }),
      expect.any(AbortSignal),
    )
  })

  it('refetches page 0 when buckets or the rule filter change after controls are ready', async () => {
    getGeneratedOutputDifferences.mockResolvedValue(serverResponse())
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(serverResponse(), true)
    differences.diffControlsReady.value = true

    differences.toggleDiffBucket('rule')
    await nextTick()
    await flushPromises()

    expect(differences.activeDiffBuckets.value).toEqual(['file-1', 'file-2'])
    expect(getGeneratedOutputDifferences).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 0, buckets: 'file-1,file-2' }),
      expect.any(AbortSignal),
    )
  })

  it('does not fetch on selection changes before the initial load marks controls ready', async () => {
    const { differences } = mountDifferences()

    differences.toggleDiffBucket('rule')
    await nextTick()
    await flushPromises()

    expect(getGeneratedOutputDifferences).not.toHaveBeenCalled()
  })

  it('selectRuleFilter aligns the active buckets with the chosen rule', () => {
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(
      serverResponse({
        ruleOptions: [
          { key: 'order_id_match', label: 'Rule 1', detail: 'OMS order id', count: 2, bucketKeys: ['rule'] },
        ],
      }),
      true,
    )

    differences.selectRuleFilter('order_id_match')
    expect(differences.selectedRuleFilterKey.value).toBe('order_id_match')
    expect(differences.activeDiffBuckets.value).toEqual(['rule'])
    expect(differences.selectedRuleSelectorOption.value?.key).toBe('order_id_match')

    differences.selectRuleFilter('all')
    expect(differences.activeDiffBuckets.value).toEqual(['file-1', 'file-2', 'rule'])
  })

  it('falls back to the all filter when the selected rule disappears from the facets', async () => {
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(
      serverResponse({
        ruleOptions: [
          { key: 'order_id_match', label: 'Rule 1', detail: 'OMS order id', count: 2, bucketKeys: ['rule'] },
        ],
      }),
      true,
    )
    differences.selectRuleFilter('order_id_match')

    differences.applyDifferencesResponse(serverResponse(), true)
    await nextTick()

    expect(differences.selectedRuleFilterKey.value).toBe('all')
  })

  it('debounces record-id search into a single page-0 refetch', async () => {
    getGeneratedOutputDifferences.mockResolvedValue(serverResponse())
    const { differences } = mountDifferences()
    differences.diffControlsReady.value = true

    differences.diffDetailsSearch.value = '20'
    await nextTick()
    differences.diffDetailsSearch.value = '2002'
    await nextTick()
    expect(getGeneratedOutputDifferences).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_WAIT))
    await flushPromises()

    expect(getGeneratedOutputDifferences).toHaveBeenCalledTimes(1)
    expect(getGeneratedOutputDifferences).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 0, search: '2002' }),
      expect.any(AbortSignal),
    )

    differences.clearDiffDetailsSearch()
    expect(differences.diffDetailsSearch.value).toBe('')
  })

  it('describes each empty state distinctly', () => {
    const { differences } = mountDifferences()

    expect(differences.diffDetailsEmptyMessage.value).toBe('No diff detail records are available.')

    differences.diffTotalCount.value = 3
    differences.selectedDiffBuckets.value = []
    expect(differences.diffDetailsEmptyMessage.value).toBe('Select a diff bucket to view matching records.')

    differences.selectedDiffBuckets.value = ['rule']
    expect(differences.diffDetailsEmptyMessage.value).toBe('No records are available in the selected diff bucket.')

    differences.applyDifferencesResponse(
      serverResponse({ totalDifferences: 3, totalFiltered: 0, bucketCounts: { 'file-1': 1, 'file-2': 1, rule: 1 } }),
      true,
    )
    differences.selectedRuleFilterKey.value = 'order_id_match'
    expect(differences.diffDetailsEmptyMessage.value).toBe('No records are available for the selected rule.')

    differences.diffDetailsSearch.value = 'missing-id'
    expect(differences.diffDetailsEmptyMessage.value).toBe('No records match the current diff detail filters.')
  })

  it('pagedDiffDetailRowsAsRows stringifies only non-object detail values', () => {
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(
      serverResponse({
        differences: [
          serverRow('1001', 'file-1'),
          { ...serverRow('1002', 'file-2'), record: { id: '1002', data: 'plain text detail' } },
        ],
      }),
      true,
    )

    const [objectRow, textRow] = differences.pagedDiffDetailRowsAsRows.value
    expect(objectRow?.detailText).toBe('')
    expect(objectRow?.detailValue).toEqual({ order_id: '1001' })
    expect(textRow?.detailText).toBe('plain text detail')
  })

  it('resetDifferencesState restores the initial filters, facets, and paging', () => {
    const { differences } = mountDifferences()
    differences.applyDifferencesResponse(serverResponse({ pageIndex: 1, pageCount: 3 }), true)
    differences.selectedRuleFilterKey.value = 'order_id_match'
    differences.ruleSelectorCollapsed.value = true
    differences.diffDetailsSearch.value = '2002'
    differences.diffControlsReady.value = true

    differences.resetDifferencesState()

    expect(differences.diffDetailRows.value).toEqual([])
    expect(differences.activeDiffBuckets.value).toEqual(['file-1', 'file-2', 'rule'])
    expect(differences.selectedRuleFilterKey.value).toBe('all')
    expect(differences.ruleSelectorCollapsed.value).toBe(false)
    expect(differences.diffDetailsSearch.value).toBe('')
    expect(differences.diffTotalCount.value).toBe(0)
    expect(differences.diffFilteredCount.value).toBe(0)
    expect(differences.diffDetailBucketCounts.value).toEqual({ 'file-1': 0, 'file-2': 0, rule: 0 })
    expect(differences.ruleSelectorOptions.value).toEqual([])
    expect(differences.diffPageIndex.value).toBe(0)
    expect(differences.diffPageCount.value).toBe(1)
    expect(differences.diffControlsReady.value).toBe(false)
    expect(differences.differencesLoading.value).toBe(false)
  })

  it('aborts an in-flight page request on unmount', async () => {
    let capturedSignal: AbortSignal | undefined
    getGeneratedOutputDifferences.mockImplementation((_payload, signal) => {
      capturedSignal = signal
      return new Promise(() => {})
    })
    const { differences, wrapper } = mountDifferences()
    void differences.loadDifferencesPage(0, false)

    wrapper.unmount()

    expect(capturedSignal?.aborted).toBe(true)
  })
})
