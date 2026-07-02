import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import type { GetGeneratedOutputDifferencesResponse } from '../lib/api/types'
import {
  ALL_RULE_FILTER_KEY,
  BASE_RULE_FILTER_KEY,
  DIFF_BUCKET_ORDER,
  DIFF_DETAILS_PAGE_SIZE,
  buildPageRow,
  createEmptyDiffBucketCounts,
  isJsonCollapseValue,
  normalizeDiffBucketSelection,
  normalizeServerBucketCounts,
  normalizeServerRuleOption,
  stringifyDiffJson,
  type DiffBucketKey,
  type NormalizedDiffDetailRow,
  type RuleSelectorOption,
} from '../lib/runResultDiffDetails'

const DIFF_SEARCH_DEBOUNCE_MS = 300

export interface UseRunResultDifferencesDeps {
  outputFileName: ComputedRef<string>
  onLoadError: (message: string) => void
}

export interface UseRunResultDifferences {
  diffDetailRows: Ref<NormalizedDiffDetailRow[]>
  selectedDiffBuckets: Ref<DiffBucketKey[]>
  selectedRuleFilterKey: Ref<string>
  ruleSelectorCollapsed: Ref<boolean>
  diffDetailsSearch: Ref<string>
  diffTotalCount: Ref<number>
  diffFilteredCount: Ref<number>
  diffPageIndex: Ref<number>
  diffPageCount: Ref<number>
  diffControlsReady: Ref<boolean>
  differencesLoading: Ref<boolean>
  activeDiffBuckets: ComputedRef<DiffBucketKey[]>
  diffDetailBucketCounts: ComputedRef<Record<DiffBucketKey, number>>
  ruleSelectorOptions: ComputedRef<RuleSelectorOption[]>
  selectedRuleSelectorOption: ComputedRef<RuleSelectorOption | undefined>
  ruleSelectorAllDetail: ComputedRef<string>
  showRuleSelector: ComputedRef<boolean>
  showDiffDetailsToolbar: ComputedRef<boolean>
  diffDetailsEmptyMessage: ComputedRef<string>
  pagedDiffDetailRowsAsRows: ComputedRef<Array<Record<string, unknown>>>
  applyDifferencesResponse: (response: GetGeneratedOutputDifferencesResponse, includeFacets: boolean) => void
  resetDifferencesState: () => void
  loadDifferencesPage: (pageIndex: number, includeFacets: boolean) => Promise<void>
  goToDiffDetailsPage: (pageIndex: number) => Promise<void>
  clearDiffDetailsSearch: () => void
  toggleDiffBucket: (bucket: DiffBucketKey) => void
  toggleRuleSelectorCollapsed: () => void
  selectRuleFilter: (nextRuleFilterKey: string) => void
}

export function useRunResultDifferences(deps: UseRunResultDifferencesDeps): UseRunResultDifferences {
  // diffDetailRows holds ONLY the current server-returned page; whole-document totals + facets come
  // from the paginated service so the browser never loads/parses the entire diff file (audit #21).
  const diffDetailRows = ref<NormalizedDiffDetailRow[]>([])
  const selectedDiffBuckets = ref<DiffBucketKey[]>([...DIFF_BUCKET_ORDER])
  const selectedRuleFilterKey = ref(ALL_RULE_FILTER_KEY)
  const ruleSelectorCollapsed = ref(false)
  const diffDetailsSearch = ref('')
  const diffTotalCount = ref(0)
  const diffFilteredCount = ref(0)
  const serverBucketCounts = ref<Record<DiffBucketKey, number>>(createEmptyDiffBucketCounts())
  const serverRuleOptions = ref<RuleSelectorOption[]>([])
  const diffPageIndex = ref(0)
  const diffPageCount = ref(1)
  const diffControlsReady = ref(false)
  const differencesLoading = ref(false)

  let differencesController: AbortController | null = null
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const activeDiffBuckets = computed<DiffBucketKey[]>(() =>
    DIFF_BUCKET_ORDER.filter((bucket) => selectedDiffBuckets.value.includes(bucket)),
  )
  const diffDetailBucketCounts = computed<Record<DiffBucketKey, number>>(() => serverBucketCounts.value)
  const ruleSelectorOptions = computed<RuleSelectorOption[]>(() => serverRuleOptions.value)
  const selectedRuleSelectorOption = computed(() =>
    ruleSelectorOptions.value.find((option) => option.key === selectedRuleFilterKey.value),
  )
  const showRuleSelector = computed(() =>
    ruleSelectorOptions.value.length > 1 || ruleSelectorOptions.value.some((option) => option.key !== BASE_RULE_FILTER_KEY),
  )
  const ruleSelectorAllDetail = computed(() =>
    `${diffTotalCount.value} ${diffTotalCount.value === 1 ? 'difference' : 'differences'}`,
  )
  // Active-bucket total comes from whole-document facets (the server's bucketCounts), not the loaded page.
  const activeBucketDiffCount = computed(() =>
    activeDiffBuckets.value.reduce((total, bucket) => total + (serverBucketCounts.value[bucket] ?? 0), 0),
  )
  const showDiffDetailsToolbar = computed(
    () => diffFilteredCount.value > 0 || diffDetailsSearch.value.trim().length > 0,
  )
  const diffDetailsEmptyMessage = computed(() => {
    if (diffDetailsSearch.value.trim().length > 0) {
      return 'No records match the current diff detail filters.'
    }
    if (activeDiffBuckets.value.length === 0 && diffTotalCount.value > 0) {
      return 'Select a diff bucket to view matching records.'
    }
    if (activeBucketDiffCount.value === 0 && diffTotalCount.value > 0) {
      return 'No records are available in the selected diff bucket.'
    }
    if (diffFilteredCount.value === 0 && selectedRuleFilterKey.value !== ALL_RULE_FILTER_KEY) {
      return 'No records are available for the selected rule.'
    }
    return 'No diff detail records are available.'
  })
  // diffDetailRows already holds the current server page; map it straight to table rows.
  const pagedDiffDetailRowsAsRows = computed(() =>
    diffDetailRows.value.map((row) => ({
      ...row,
      detailText: isJsonCollapseValue(row.detailValue) ? '' : stringifyDiffJson(row.detailValue),
    })) as Array<Record<string, unknown>>,
  )

  function applyDifferencesResponse(response: GetGeneratedOutputDifferencesResponse, includeFacets: boolean): void {
    diffDetailRows.value = (response.differences ?? []).map(buildPageRow)
    diffPageIndex.value = response.pageIndex ?? 0
    diffPageCount.value = response.pageCount ?? 1
    diffFilteredCount.value = response.totalFiltered ?? 0
    diffTotalCount.value = response.totalDifferences ?? 0
    if (includeFacets) {
      serverBucketCounts.value = normalizeServerBucketCounts(response.bucketCounts)
      serverRuleOptions.value = (response.ruleOptions ?? []).map(normalizeServerRuleOption)
    }
  }

  function resetDifferencesState(): void {
    diffDetailRows.value = []
    selectedDiffBuckets.value = [...DIFF_BUCKET_ORDER]
    selectedRuleFilterKey.value = ALL_RULE_FILTER_KEY
    ruleSelectorCollapsed.value = false
    diffDetailsSearch.value = ''
    diffTotalCount.value = 0
    diffFilteredCount.value = 0
    serverBucketCounts.value = createEmptyDiffBucketCounts()
    serverRuleOptions.value = []
    diffPageIndex.value = 0
    diffPageCount.value = 1
    diffControlsReady.value = false
    differencesLoading.value = false
  }

  function currentDifferencesQuery(pageIndex: number, includeFacets: boolean) {
    return {
      fileName: deps.outputFileName.value,
      pageIndex,
      pageSize: DIFF_DETAILS_PAGE_SIZE,
      buckets: activeDiffBuckets.value.join(','),
      ruleFilterKey: selectedRuleFilterKey.value,
      search: diffDetailsSearch.value.trim(),
      includeFacets,
    }
  }

  // Fetch a single diff page for the active filters. Facets (whole-document bucket counts + rule
  // options) are constant for a file, so they are requested only on the initial load.
  async function loadDifferencesPage(pageIndex: number, includeFacets: boolean): Promise<void> {
    const requestedFileName = deps.outputFileName.value
    if (!requestedFileName) return

    differencesController?.abort()

    // No active bucket selected: show an empty page (matches the "select a diff bucket" prompt) rather
    // than fetching — an empty buckets filter would otherwise be treated as "all" by the server.
    if (activeDiffBuckets.value.length === 0) {
      diffDetailRows.value = []
      diffFilteredCount.value = 0
      diffPageIndex.value = 0
      diffPageCount.value = 1
      differencesLoading.value = false
      return
    }

    differencesController = new AbortController()
    const signal = differencesController.signal

    differencesLoading.value = true
    try {
      const response = await reconciliationFacade.getGeneratedOutputDifferences(
        currentDifferencesQuery(pageIndex, includeFacets),
        signal,
      )
      if (deps.outputFileName.value !== requestedFileName) return
      applyDifferencesResponse(response, includeFacets)
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return
      if (deps.outputFileName.value !== requestedFileName) return
      deps.onLoadError(error instanceof ApiCallError ? error.message : 'Unable to load differences.')
    } finally {
      if (deps.outputFileName.value === requestedFileName) differencesLoading.value = false
    }
  }

  async function goToDiffDetailsPage(pageIndex: number): Promise<void> {
    const target = Math.min(Math.max(pageIndex, 0), Math.max(diffPageCount.value - 1, 0))
    if (target === diffPageIndex.value || differencesLoading.value) return
    await loadDifferencesPage(target, false)
  }

  function clearDiffDetailsSearch(): void {
    diffDetailsSearch.value = ''
  }

  function toggleDiffBucket(bucket: DiffBucketKey): void {
    const isActive = activeDiffBuckets.value.includes(bucket)
    selectedDiffBuckets.value = isActive
      ? normalizeDiffBucketSelection(activeDiffBuckets.value.filter((activeBucket) => activeBucket !== bucket))
      : normalizeDiffBucketSelection([...activeDiffBuckets.value, bucket])
  }

  function toggleRuleSelectorCollapsed(): void {
    ruleSelectorCollapsed.value = !ruleSelectorCollapsed.value
  }

  function selectRuleFilter(nextRuleFilterKey: string): void {
    selectedRuleFilterKey.value = nextRuleFilterKey

    if (nextRuleFilterKey === ALL_RULE_FILTER_KEY) {
      selectedDiffBuckets.value = [...DIFF_BUCKET_ORDER]
    } else {
      const selectedOption = ruleSelectorOptions.value.find((option) => option.key === nextRuleFilterKey)
      if (selectedOption) {
        selectedDiffBuckets.value = normalizeDiffBucketSelection(selectedOption.bucketKeys)
      }
    }
  }

  // Bucket / rule selection re-fetches page 0 from the server (facets are already loaded and constant).
  watch([selectedDiffBuckets, selectedRuleFilterKey], () => {
    if (!diffControlsReady.value) return
    void loadDifferencesPage(0, false)
  }, { deep: true })

  // Record-id search re-fetches page 0, debounced so typing does not issue a request per keystroke.
  watch(diffDetailsSearch, () => {
    if (!diffControlsReady.value) return
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
    searchDebounceTimer = setTimeout(() => {
      searchDebounceTimer = null
      void loadDifferencesPage(0, false)
    }, DIFF_SEARCH_DEBOUNCE_MS)
  })

  watch(ruleSelectorOptions, (options) => {
    if (selectedRuleFilterKey.value === ALL_RULE_FILTER_KEY) return
    if (options.some((option) => option.key === selectedRuleFilterKey.value)) return

    selectedRuleFilterKey.value = ALL_RULE_FILTER_KEY
  })

  onBeforeUnmount(() => {
    differencesController?.abort()
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  })

  return {
    diffDetailRows,
    selectedDiffBuckets,
    selectedRuleFilterKey,
    ruleSelectorCollapsed,
    diffDetailsSearch,
    diffTotalCount,
    diffFilteredCount,
    diffPageIndex,
    diffPageCount,
    diffControlsReady,
    differencesLoading,
    activeDiffBuckets,
    diffDetailBucketCounts,
    ruleSelectorOptions,
    selectedRuleSelectorOption,
    ruleSelectorAllDetail,
    showRuleSelector,
    showDiffDetailsToolbar,
    diffDetailsEmptyMessage,
    pagedDiffDetailRowsAsRows,
    applyDifferencesResponse,
    resetDifferencesState,
    loadDifferencesPage,
    goToDiffDetailsPage,
    clearDiffDetailsSearch,
    toggleDiffBucket,
    toggleRuleSelectorCollapsed,
    selectRuleFilter,
  }
}
