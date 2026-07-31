import { afterEach, describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { setDefaultDisplayTimeZone } from '../../lib/utils/date'
import { useRunResultSourceDetails } from '../useRunResultSourceDetails'

afterEach(() => setDefaultDisplayTimeZone(undefined))

function buildSourceDetails() {
  return useRunResultSourceDetails({
    file1Label: computed(() => 'OMS'),
    file2Label: computed(() => 'SHOPIFY'),
  })
}

describe('useRunResultSourceDetails', () => {
  it('is empty and hidden until source details arrive', () => {
    const source = buildSourceDetails()

    expect(source.runSourceFiles.value).toEqual([])
    expect(source.isApiRunSource.value).toBe(false)
    expect(source.runSourceModeLabel.value).toBe('Source files')
    expect(source.runSourceFilesLabel.value).toBe('Source files')
    expect(source.runSourceDateRangeLabel.value).toBe('')
    expect(source.showRunSourceDetails.value).toBe(false)
  })

  it('normalizes file entries with side labels, formats, and download flags', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'FILES',
      files: [
        {
          side: 'file1',
          label: '',
          fileName: '',
          filePath: 'runs/RS/file1/orders-1.csv',
          downloadFileName: '',
          sourceFormat: '',
          canDownload: true,
        },
        {
          side: 'file2',
          label: 'SHOPIFY',
          fileName: 'orders-2.csv',
          filePath: '',
          downloadFileName: 'orders-2.csv',
          sourceFormat: 'csv',
          canDownload: true,
        },
      ],
    } as never

    const [file1, file2] = source.runSourceFiles.value
    expect(file1).toEqual({
      key: 'file1-runs/RS/file1/orders-1.csv',
      label: 'OMS',
      fileName: 'orders-1.csv',
      filePath: 'runs/RS/file1/orders-1.csv',
      sourceFormat: 'csv',
      downloadFileName: 'orders-1.csv',
      canDownload: true,
    })
    expect(file2?.label).toBe('SHOPIFY')
    // No file path means the entry renders but cannot be downloaded.
    expect(file2?.canDownload).toBe(false)
    expect(source.showRunSourceDetails.value).toBe(true)
  })

  it('drops entries without any file name or path', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'FILES',
      files: [{ side: 'file1', label: 'OMS', fileName: '', filePath: '' }],
    } as never

    expect(source.runSourceFiles.value).toEqual([])
    expect(source.showRunSourceDetails.value).toBe(false)
  })

  it('detects API runs from the mode token or a date range and formats the range', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-05-01T04:00:00Z', end: '2026-05-03T04:00:00Z' },
      files: [],
    } as never

    expect(source.isApiRunSource.value).toBe(true)
    expect(source.runSourceModeLabel.value).toBe('API date range')
    expect(source.runSourceFilesLabel.value).toBe('Files compared')
    expect(source.runSourceDateRangeLabel.value).toBe('May 1, 2026 to May 3, 2026')
    expect(source.showRunSourceDetails.value).toBe(true)
  })

  it('collapses a same-day range to a single date and passes through non-ISO values', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'FILES',
      dateRange: { start: '2026-05-01', end: '2026-05-01' },
      files: [],
    } as never
    expect(source.runSourceDateRangeLabel.value).toBe('May 1, 2026')
    // A date range alone marks the run as API-sourced even without an API mode token.
    expect(source.isApiRunSource.value).toBe(true)

    source.runSourceDetails.value = {
      mode: 'FILES',
      dateRange: { start: 'yesterday', end: '' },
      files: [],
    } as never
    expect(source.runSourceDateRangeLabel.value).toBe('yesterday')
  })

  it('resolves UTC instants to the local calendar day the window covers', () => {
    const source = buildSourceDetails()
    // The run wizard anchors API windows at local midnight and serializes with
    // toISOString(), so a single-day July 29 window arrives as instants on the
    // previous UTC date for viewers east of UTC (e.g. 2026-07-28T18:30:00Z in IST).
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: {
        start: new Date(2026, 6, 29).toISOString(),
        end: new Date(2026, 6, 30).toISOString(),
      },
      files: [],
    } as never

    expect(source.runSourceDateRangeLabel.value).toBe('Jul 29, 2026')
  })

  it('collapses an exclusive-end single-day window to one date but keeps genuine multi-day ranges', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-07-01', end: '2026-07-02T00:00:00Z' },
      files: [],
    } as never
    expect(source.runSourceDateRangeLabel.value).toBe('Jul 1, 2026')

    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-07-01', end: '2026-07-03' },
      files: [],
    } as never
    expect(source.runSourceDateRangeLabel.value).toBe('Jul 1, 2026 to Jul 3, 2026')
  })

  it('resetRunSourceDetails clears the loaded details', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = { mode: 'FILES', files: [] } as never

    source.resetRunSourceDetails()

    expect(source.runSourceDetails.value).toBeNull()
  })

  it('resolves instant windows in the preferred display timezone, not the runner timezone', () => {
    setDefaultDisplayTimeZone('UTC')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-07-28T18:30:00Z', end: '2026-07-29T18:30:00Z' },
      files: [],
    } as never

    // In UTC the start instant falls on Jul 28; the 24h window still collapses
    // via the exclusive-end rule, but to the UTC day — not the runner-local day.
    expect(source.runSourceDateRangeLabel.value).toBe('Jul 28, 2026')

    setDefaultDisplayTimeZone('Asia/Kolkata')
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-07-28T18:30:00Z', end: '2026-07-29T18:30:00Z' },
      files: [],
    } as never
    expect(source.runSourceDateRangeLabel.value).toBe('Jul 29, 2026')
  })
})
