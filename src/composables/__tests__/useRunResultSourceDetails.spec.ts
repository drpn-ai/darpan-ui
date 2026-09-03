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
    // Labels come out as system NAMES, so a raw enum token from either the backend or the side
    // label resolves to the name the rest of the screen uses.
    expect(file1).toEqual({
      key: 'file1-runs/RS/file1/orders-1.csv',
      label: 'HotWax',
      fileName: 'orders-1.csv',
      filePath: 'runs/RS/file1/orders-1.csv',
      sourceFormat: 'csv',
      downloadFileName: 'orders-1.csv',
      canDownload: true,
    })
    expect(file2?.label).toBe('Shopify')
    // No file path means the entry renders but cannot be downloaded.
    expect(file2?.canDownload).toBe(false)
    expect(source.showRunSourceDetails.value).toBe(true)
  })

  it('shows the resolved system label rather than the raw enum token the backend sends', () => {
    // The run-result screen showed "SHOPIFY orders-b.csv" beside a tile reading "Missing from
    // Shopify". The badge must agree with the rest of the screen.
    const source = useRunResultSourceDetails({
      file1Label: computed(() => 'HotWax'),
      file2Label: computed(() => 'Shopify'),
    })
    source.runSourceDetails.value = {
      mode: 'FILES',
      files: [
        { side: 'file1', label: '', fileName: 'orders-a.csv', filePath: 'runs/RS/a.csv', canDownload: true },
        { side: 'file2', label: 'SHOPIFY', fileName: 'orders-b.csv', filePath: 'runs/RS/b.csv', canDownload: true },
      ],
    } as never

    const [file1, file2] = source.runSourceFiles.value
    expect(file1?.label).toBe('HotWax')
    expect(file2?.label).toBe('Shopify')
  })

  it('names the system rather than the endpoint the run extracted', () => {
    // The backend stamps the endpoint enum's description into the run output, so the compared-files
    // chips read "Shopify Order Return References" / "HotWax Returns (Reconciliation API)" -- the
    // transport, not the system, and long enough to truncate the file name beside it.
    const source = useRunResultSourceDetails({
      file1Label: computed(() => 'Shopify Order Return References'),
      file2Label: computed(() => 'HotWax Returns (Reconciliation API)'),
    })
    source.runSourceDetails.value = {
      mode: 'API',
      files: [
        { side: 'file1', label: 'Shopify Order Return References', fileName: 'RS_RETURNS_PROD_file1.json', filePath: 'runs/RS/a.json', canDownload: true },
        { side: 'file2', label: 'HotWax Returns (Reconciliation API)', fileName: 'RS_RETURNS_PROD_file2.json', filePath: 'runs/RS/b.json', canDownload: true },
      ],
    }

    expect(source.runSourceFiles.value.map((file) => file.label)).toEqual(['Shopify', 'HotWax'])
  })

  it('keeps the endpoint labels when both sides are endpoints of the same system', () => {
    // Collapsing here would print "HotWax" on both chips and leave the two files
    // indistinguishable, which is worse than the endpoint name being long.
    const source = useRunResultSourceDetails({
      file1Label: computed(() => 'HotWax Returns (Reconciliation API)'),
      file2Label: computed(() => 'HotWax Transfer Orders'),
    })
    source.runSourceDetails.value = {
      mode: 'API',
      files: [
        { side: 'file1', label: 'HotWax Returns (Reconciliation API)', fileName: 'a.json', filePath: 'runs/RS/a.json', canDownload: true },
        { side: 'file2', label: 'HotWax Transfer Orders', fileName: 'b.json', filePath: 'runs/RS/b.json', canDownload: true },
      ],
    }

    expect(source.runSourceFiles.value.map((file) => file.label))
      .toEqual(['HotWax Returns (Reconciliation API)', 'HotWax Transfer Orders'])
  })

  it('keeps a real backend label instead of overriding it with the side label', () => {
    const source = useRunResultSourceDetails({
      file1Label: computed(() => 'HotWax'),
      file2Label: computed(() => 'Shopify'),
    })
    source.runSourceDetails.value = {
      mode: 'FILES',
      files: [
        { side: 'file1', label: 'Orders API', fileName: 'orders-a.csv', filePath: 'runs/RS/a.csv', canDownload: true },
      ],
    } as never

    expect(source.runSourceFiles.value[0]?.label).toBe('Orders API')
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

  it('names the exact instants the window used, and the zone it is showing them in', () => {
    // The label is a calendar day derived in the VIEWER's zone, so two people read
    // different days for one run. The instants are the only thing that settles it.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-05-01T04:00:00Z', end: '2026-05-03T04:00:00Z' },
      files: [],
    } as never

    expect(source.runSourceDateRangeDetail.value).toBe('May 1, 2026, 9:30 AM to May 3, 2026, 9:30 AM IST')
  })

  it('shows the window in the zone it was anchored in, not the viewer\'s', () => {
    // The instants are the same for everybody; the zone is what says which day they cover.
    // Viewer pinned to Kolkata to prove the window's own zone wins rather than leaking through.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: {
        start: '2026-09-02T00:00:00Z',
        end: '2026-09-03T00:00:00Z',
        timeZone: 'America/Los_Angeles',
      },
      files: [],
    } as never

    expect(source.runSourceDateRangeDetail.value).toBe('Sep 1, 2026, 5:00 PM to Sep 2, 2026, 5:00 PM PDT')
  })

  it('names the calendar day in that zone too, so two viewers cannot disagree', () => {
    // Read in Kolkata the same instants land on Sep 2; the window was anchored in Los Angeles,
    // where it covers Sep 1. That disagreement is the whole reason the zone is now carried.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: {
        start: '2026-09-02T00:00:00Z',
        end: '2026-09-03T00:00:00Z',
        timeZone: 'America/Los_Angeles',
      },
      files: [],
    } as never

    expect(source.runSourceDateRangeLabel.value).toBe('Sep 1, 2026')
  })

  it('reads a zone-less database timestamp, which is what the run row actually sends', () => {
    // windowStartDate is a date-time column and the backend serialises it with
    // Timestamp.toString(), so it arrives as "2026-09-01 00:00:00.0" — space separated,
    // no T, no zone. Requiring an ISO T made every real API run report no time at all.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-09-01 00:00:00.0', end: '2026-09-02 00:00:00.0' },
      files: [],
    } as never

    // Shown exactly as recorded and NOT converted: the stamp carries no zone, so moving
    // it into the viewer's would invent an offset the record does not have.
    expect(source.runSourceDateRangeDetail.value).toBe('Sep 1, 2026, 12:00 AM to Sep 2, 2026, 12:00 AM')
  })

  it('keeps seconds when a window boundary has them', () => {
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-09-01 06:15:30', end: '2026-09-02 18:45:00' },
      files: [],
    } as never

    expect(source.runSourceDateRangeDetail.value).toBe('Sep 1, 2026, 6:15:30 AM to Sep 2, 2026, 6:45 PM')
  })

  it('says the time of day was never recorded rather than inventing midnight', () => {
    // A bare YYYY-MM-DD carries no instant. Rendering it as midnight would manufacture
    // precision the contract does not have — the very thing that makes viewers disagree.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-05-01', end: '2026-05-01' },
      files: [],
    } as never

    expect(source.runSourceDateRangeDetail.value).toBe('May 1, 2026, with no time of day recorded')
  })

  it('answers with one end when only one was given', () => {
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-05-01T04:00:00Z', end: '' },
      files: [],
    } as never

    expect(source.runSourceDateRangeDetail.value).toBe('from May 1, 2026, 9:30 AM IST, with no end recorded')
  })

  it('never answers empty, so the bubble cannot render an unfilled slot', () => {
    // The body carries a {detail} token; an empty detail would print the store's
    // timestamp fallback, which is the wrong sentence for a window.
    const source = buildSourceDetails()
    source.runSourceDetails.value = { mode: 'API', dateRange: {}, files: [] } as never

    expect(source.runSourceDateRangeDetail.value).toBe('no window was recorded for this run')
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

  it('names the UTC calendar day a UTC-anchored window covers, whatever zone the viewer reads it in', () => {
    // Real prod run (RS_RETURNS, 2026-09-02). An automation anchors its window in its own
    // windowTimeZone, which defaults to UTC, so the window arrives as exact UTC midnights --
    // the artifact it produced is literally named oms-returns-1788220800000-1788307200000.
    // Resolving that instant in a display zone behind UTC moved the label to the previous day.
    setDefaultDisplayTimeZone('America/Los_Angeles')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-09-01T00:00:00Z', end: '2026-09-02T00:00:00Z' },
      files: [],
    } as never

    expect(source.runSourceDateRangeLabel.value).toBe('Sep 1, 2026')
  })

  it('keeps a multi-day UTC-anchored window on its own UTC days', () => {
    setDefaultDisplayTimeZone('America/Los_Angeles')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-09-01T00:00:00Z', end: '2026-09-04T00:00:00Z' },
      files: [],
    } as never

    expect(source.runSourceDateRangeLabel.value).toBe('Sep 1, 2026 to Sep 4, 2026')
  })

  it('still resolves a window anchored off UTC midnight in the viewer display zone', () => {
    // The wizard path is unchanged: a window anchored at the tenant's own midnight is not on a
    // UTC midnight boundary, so it keeps resolving through the display zone as before.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    const source = buildSourceDetails()
    source.runSourceDetails.value = {
      mode: 'API',
      dateRange: { start: '2026-07-28T18:30:00Z', end: '2026-07-29T18:30:00Z' },
      files: [],
    } as never

    expect(source.runSourceDateRangeLabel.value).toBe('Jul 29, 2026')
  })
})
