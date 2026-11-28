import { describe, expect, it } from 'vitest'
import type { SyncAutomationOption, SyncPairSummary } from '../api/pulseTypes'
import { buildSyncPulseView, calendarDayWords, distinctCheckWords, labelWithCheckWords, lastPulseWords, latestReadSample, nextPulsePeriods, pairSidesLabel, periodPulseMinutes, plainPairLabel, pulseAsOfWords, pulseWatchFacts, pulsingPeriods, syncPulseSettingsValue } from '../syncPulseView'

const pair = (over: Partial<SyncPairSummary>): SyncPairSummary => ({
  syncPairId: 'SP1', label: 'HotWax → NetSuite orders', automationId: 'A1', automationName: 'Daily check', allowanceMinutes: 120,
  pulseEveryMinutes: null, isActive: 'Y', lastPulseStamp: null, waitingCount: 0, pastAllowanceCount: 0, ...over,
})

// GORJANA's checks as prod's pair form returns them (2026-11-26).
const automations: SyncAutomationOption[] = [
  { automationId: '100102', label: 'Daily Order Reconciliation', upstreamOptions: [
    { upstreamSide: 'FILE_1', label: 'Shopify' }, { upstreamSide: 'FILE_2', label: 'HotWax orders' }] },
  { automationId: '100518', label: 'Daily Order Reconciliation - NetSuite', upstreamOptions: [
    { upstreamSide: 'FILE_1', label: 'HotWax orders' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
  { automationId: '100520', label: 'Daily Return Reconciliation - NetSuite', upstreamOptions: [
    { upstreamSide: 'FILE_1', label: 'HotWax returns' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
  { automationId: '100110', label: 'Month close: Warranty claims - credit memos', upstreamOptions: [
    { upstreamSide: 'FILE_1', label: 'NetSuite SuiteQL' }, { upstreamSide: 'FILE_2', label: 'NetSuite SuiteQL' }] },
  { automationId: '100107', label: 'Month close: Credit memos', upstreamOptions: [{ upstreamSide: 'FILE_1', label: 'NetSuite SuiteQL' }] },
  { automationId: 'B2', label: 'Reversed', upstreamOptions: [
    { upstreamSide: 'FILE_1', label: 'NetSuite SuiteQL' }, { upstreamSide: 'FILE_2', label: 'Shopify' }] },
]

describe('pairSidesLabel', () => {
  // System names only (Aditi 2026-11-26 19:15 IST): no SuiteQL / GraphQL, no "orders", a record word only when not orders.
  it('names both systems and nothing else for orders', () => {
    expect(pairSidesLabel(pair({ automationId: '100518', label: 'HotWax → NetSuite orders' }), automations)).toBe('HotWax → NetSuite')
    expect(pairSidesLabel(pair({ automationId: '100102', label: 'Shopify → HotWax orders' }), automations)).toBe('Shopify → HotWax')
  })

  it('adds the record word when it is not orders', () => {
    expect(pairSidesLabel(pair({ automationId: '100520', label: 'HotWax → NetSuite orders' }), automations)).toBe('HotWax → NetSuite returns')
  })

  it('names a one-sided check by its one system instead of "Target"', () => {
    expect(pairSidesLabel(pair({ automationId: '100107', label: 'NetSuite → Target orders' }), automations)).toBe('NetSuite only')
  })

  it('keeps a check that really compares NetSuite with NetSuite', () => {
    expect(pairSidesLabel(pair({ automationId: '100110', label: 'NetSuite → NetSuite orders' }), automations)).toBe('NetSuite → NetSuite')
  })

  it('keeps the upstream the backend names first, whichever file side it is', () => {
    expect(pairSidesLabel(pair({ automationId: 'B2', label: 'Shopify → NetSuite orders' }), automations)).toBe('Shopify → NetSuite')
  })

  it('never shows an endpoint or protocol name', () => {
    for (const a of automations) {
      const label = pairSidesLabel(pair({ automationId: a.automationId, label: 'HotWax → NetSuite orders' }), automations)
      expect(label).not.toMatch(/SuiteQL|GraphQL|GQL|REST|orders/)
    }
  })

  it('falls back to the check name when the backend could not name the systems', () => {
    expect(pairSidesLabel(pair({ automationId: 'gone', automationName: 'Old check', label: 'Source → Target orders' }), automations)).toBe('Old check')
  })
})

describe('plainPairLabel', () => {
  it('drops "orders" and "Target" from a backend label', () => {
    expect(plainPairLabel('HotWax → NetSuite orders')).toBe('HotWax → NetSuite')
    expect(plainPairLabel('NetSuite → Target orders')).toBe('NetSuite only')
    expect(plainPairLabel('Shopify → HotWax orders')).toBe('Shopify → HotWax')
  })
})

describe('periodPulseMinutes', () => {
  it('keeps only pairs a period turns the pulse on for, at the most frequent cadence', () => {
    const map = periodPulseMinutes([
      [{ syncPairId: '100000', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 240, normalPulseMinutes: null, periodPulseMinutes: 120 },
        { syncPairId: '100051', label: '', normalAllowanceMinutes: 15, periodAllowanceMinutes: 1440, normalPulseMinutes: null, periodPulseMinutes: null }],
      [{ syncPairId: '100000', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 360, normalPulseMinutes: null, periodPulseMinutes: 60 }],
    ])
    expect([...map.entries()]).toEqual([['100000', 60]])
  })
})

describe('buildSyncPulseView', () => {
  // GORJANA: 100102 pulses hourly; 100000 only in the periods that turn it on; 100001 and the month-close pairs only carry the allowance.
  const pairs = [
    pair({ syncPairId: '100000', automationId: '100518', automationName: 'Daily Order Reconciliation - NetSuite', waitingCount: 4, pastAllowanceCount: 12 }),
    pair({ syncPairId: '100001', automationId: '100520', automationName: 'Daily Return Reconciliation - NetSuite' }),
    pair({ syncPairId: '100053', automationId: '100107', label: 'NetSuite → Target orders', allowanceMinutes: 15 }),
    pair({ syncPairId: '100102', automationId: '100102', label: 'Shopify → HotWax orders', automationName: 'Daily Order Reconciliation', pulseEveryMinutes: 60 }),
  ]

  const next = new Map([['100000', { periodName: 'Black Friday', fromDate: '2026-11-27', allowanceMinutes: 360 }]])

  it('splits pulsing pairs from allowance-only pairs', () => {
    const view = buildSyncPulseView(pairs, automations, new Map([['100000', 60]]), new Map())
    expect(view.pulsing.map((r) => r.syncPairId)).toEqual(['100000', '100102'])
    expect(view.allowanceOnly.map((r) => r.syncPairId)).toEqual(['100001', '100053'])
    expect(view.pulsing[0]).toMatchObject({ label: 'HotWax → NetSuite', checkName: 'Daily Order Reconciliation - NetSuite',
      cadence: 'Every 1h today', counts: '4 waiting · 12 past' })
    expect(view.pulsing[1]).toMatchObject({ label: 'Shopify → HotWax', cadence: 'Every 1h' })
    expect(view.allowanceOnly[0]).toMatchObject({ label: 'HotWax → NetSuite returns', cadence: 'Off' })
  })

  // Pulses run only on the days a period turns them on (Aditi 2026-11-26): a pulse no period runs today says when it
  // next does, in the Pulses page's words, and never "in peak periods", which reads as every period (Sale included).
  it('words a pulse only a coming period turns on as off today, with its next day', () => {
    const view = buildSyncPulseView(pairs, automations, new Map(), next)
    expect(view.pulsing[0]).toMatchObject({ syncPairId: '100000', cadence: 'Off today · next: 27 Nov' })
    for (const row of [...view.pulsing, ...view.allowanceOnly]) expect(row.cadence).not.toMatch(/peak period|PEAK|Sale/)
  })

  it('puts a period-only pulser with the allowance-only pairs when no live period turns it on', () => {
    const view = buildSyncPulseView(pairs, automations, new Map(), new Map())
    expect(view.pulsing.map((r) => r.syncPairId)).toEqual(['100102'])
  })

  it('names the store when pulsing pairs share a label (RAILS: one Shopify → HotWax pulse per store)', () => {
    const stores = ['Canada', 'EU', 'Outlet', 'UK', 'USA'].map((store, i) => pair({ syncPairId: `10015${4 + i}`, automationId: `S${i}`,
      label: 'Shopify → HotWax orders', automationName: `Daily Order Reconciliation ${store}`, pulseEveryMinutes: 60 }))
    const netsuite = pair({ syncPairId: '100160', automationName: 'Daily Order Reconciliation - NetSuite', pulseEveryMinutes: 60 })
    const view = buildSyncPulseView([netsuite, ...stores], [], new Map(), new Map())
    expect(view.pulsing.map((r) => r.label)).toEqual(['HotWax → NetSuite', 'Shopify Canada → HotWax', 'Shopify EU → HotWax',
      'Shopify Outlet → HotWax', 'Shopify UK → HotWax', 'Shopify USA → HotWax'])
  })

  it('leaves look-alike allowance-only pairs as they are, and a lone pulse with its plain label', () => {
    const view = buildSyncPulseView(pairs, automations, new Map([['100000', 60]]), new Map())
    expect(view.pulsing.map((r) => r.label)).toEqual(['HotWax → NetSuite', 'Shopify → HotWax'])
  })

  // DAR-UI-159: a count, not the first pair and "N more"; the cadence only when every pulsing pair shares it.
  it('counts the pulsing pairs on the Tenant Settings row, "None" when nothing pulses', () => {
    expect(syncPulseSettingsValue(buildSyncPulseView(pairs, automations, new Map([['100000', 60]]), new Map()))).toBe('2 pairs')
    expect(syncPulseSettingsValue(buildSyncPulseView(pairs, automations, new Map(), new Map()))).toBe('1 pair · every 1h')
    expect(syncPulseSettingsValue(buildSyncPulseView([pairs[1]!], automations, new Map(), new Map()))).toBe('None')
    // Only its first letter drops to lower case: the month keeps its capital.
    expect(syncPulseSettingsValue(buildSyncPulseView([pairs[0]!], automations, new Map(), next))).toBe('1 pair · off today · next: 27 Nov')
  })

  it('gives the shared cadence when every pulsing pair has the same one (RAILS: six hourly pulses)', () => {
    const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((k, i) => pair({ syncPairId: `20000${i}`, automationId: k, pulseEveryMinutes: 60 }))
    expect(syncPulseSettingsValue(buildSyncPulseView(six, [], new Map(), new Map()))).toBe('6 pairs · every 1h')
  })
})

describe('lastPulseWords', () => {
  const clock = (v: string) => v.slice(11, 16)
  it('says when the last pulse ran and how it ended', () => {
    expect(lastPulseWords(null, null, clock)).toBe('no pulse yet')
    expect(lastPulseWords('2026-11-26T12:47:32Z', 'SPS_OK', clock)).toBe('last 12:47')
    expect(lastPulseWords('2026-11-26T12:47:32Z', 'SPS_SKIPPED', clock)).toBe('last pulse skipped 12:47')
    expect(lastPulseWords('2026-11-26T12:47:32Z', 'SPS_FAILED', clock)).toBe('last pulse failed 12:47')
  })
})

describe('pulseWatchFacts', () => {
  const clock = (v: string) => v.slice(11, 16)
  // GORJANA 100000 on 2026-11-26: a sale period sets 6h and the hourly pulse; normal is 2h, pulse off.
  const detail = {
    ...pair({ syncPairId: '100000', allowanceMinutes: 360, pulseEveryMinutes: 60, waitingCount: 1234, pastAllowanceCount: 12,
      lastPulseStamp: '2026-11-26T12:02:32Z' }),
    normalAllowanceMinutes: 120, normalPulseEveryMinutes: null, periodName: 'Early sale', lastPulseStatusEnumId: 'SPS_SKIPPED',
  }
  const samples = [
    { sampleStamp: '2026-11-26T10:03:13Z', waitingCount: 3, oldestWaitingMinutes: 1241, pastAllowanceCount: 24, statusEnumId: 'SPS_OK' },
    { sampleStamp: '2026-11-26T11:03:13Z', waitingCount: 4, oldestWaitingMinutes: 1301, pastAllowanceCount: 12, statusEnumId: 'SPS_OK' },
    { sampleStamp: '2026-11-26T12:02:32Z', waitingCount: 0, oldestWaitingMinutes: null, pastAllowanceCount: 12, statusEnumId: 'SPS_SKIPPED' },
  ]
  const past = [{ recordKey: 'K', orderName: '#GOR1', otherSystemId: null, sourceCreatedStamp: null, waitingMinutes: 1400,
    reportedInRunId: null, reportedInSavedRunId: null }]

  it('shows today\'s effective cadence and allowance, the last pulse and what the last read pulse found', () => {
    const facts = pulseWatchFacts(detail, samples, past, clock)
    expect(facts.map((f) => [f.key, f.value, f.sub])).toEqual([
      ['every', 'Hour', 'last pulse skipped 12:02'],
      ['allowance', '6 hours', ''],
      ['waiting', '1,234', 'orders'],
      ['oldest', '21h 41m', '#GOR1'],
      ['past', '12', 'findings'],
    ])
  })

  it('shows None when nothing waits', () => {
    const facts = pulseWatchFacts({ ...detail, allowanceMinutes: 120, periodName: null }, [], [], clock)
    expect(facts.find((f) => f.key === 'oldest')).toMatchObject({ value: 'None', sub: '' })
  })

  // Aditi 2026-11-26 19:22 IST: "just the pulse window", no period names anywhere on the card.
  it('shows the pulse window: today\'s allowance when it pulses today, the next pulsing period\'s when it is off', () => {
    const off = { ...detail, pulseEveryMinutes: null, allowanceMinutes: 360, periodName: 'Early sale' }
    const next = { periodName: 'Black Friday', fromDate: '2026-11-27', allowanceMinutes: 360 }
    const facts = pulseWatchFacts(off, [], [], clock, next)
    expect(facts.find((f) => f.key === 'allowance')).toMatchObject({ value: '6 hours', sub: '' })
    expect(facts.find((f) => f.key === 'every')).toMatchObject({ value: 'Off today', sub: 'next: 27 Nov' })
    const shopify = pulseWatchFacts({ ...off, allowanceMinutes: 120 }, [], [], clock, { ...next, allowanceMinutes: 120 })
    expect(shopify.find((f) => f.key === 'allowance')).toMatchObject({ value: '2 hours', sub: '' })
    for (const f of [...facts, ...shopify]) expect(`${f.value} ${f.sub}`).not.toMatch(/Sale|PEAK/)
  })
})

describe('nextPulsePeriods', () => {
  const period = (id: string, name: string, from: string, state: 'on' | 'upcoming') =>
    ({ peakPeriodId: id, periodName: name, fromDate: from, thruDate: from, isActive: 'Y', state })
  const row = (pairId: string, pulse: number | null) =>
    ({ syncPairId: pairId, label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: null, normalPulseMinutes: null, periodPulseMinutes: pulse })

  it('names the first coming period that turns each pair\'s pulse on; a sale period at 0 (off) does not count', () => {
    const map = nextPulsePeriods(
      [period('S', 'Weekend sale', '2026-11-28', 'upcoming'), period('P2', 'Cyber Monday', '2026-11-30', 'upcoming'),
        period('NOW', 'Early sale', '2026-11-24', 'on'), period('P1', 'Black Friday', '2026-11-27', 'upcoming')],
      [[row('100000', 0)], [row('100000', 60), row('100102', 60)], [row('100000', 60)], [row('100102', 60)]],
    )
    expect(map.get('100000')).toMatchObject({ periodName: 'Cyber Monday', fromDate: '2026-11-30', allowanceMinutes: 120 })
    expect(map.get('100102')).toMatchObject({ periodName: 'Black Friday', fromDate: '2026-11-27' })
  })

  it('reads "Off today · next" on a day the pulse is off, the last pulse otherwise', () => {
    const clock = (v: string) => v.slice(11, 16)
    const off = { ...pair({ pulseEveryMinutes: null, lastPulseStamp: '2026-11-26T12:47:32Z' }), lastPulseStatusEnumId: 'SPS_SKIPPED' }
    expect(pulseWatchFacts(off, [], [], clock, { periodName: 'Black Friday', fromDate: '2026-11-27', allowanceMinutes: 120 })[0])
      .toMatchObject({ value: 'Off today', sub: 'next: 27 Nov' })
    expect(pulseWatchFacts(off, [], [], clock)[0]).toMatchObject({ value: 'Off today', sub: 'last pulse skipped 12:47' })
  })
})

describe('pulsingPeriods', () => {
  const period = (id: string) => ({ peakPeriodId: id, periodName: id, fromDate: '2026-11-24', thruDate: '2026-11-26', isActive: 'Y', state: 'on' as const })
  const row = (pulse: number | null) => ({ syncPairId: 'P', label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: 360, normalPulseMinutes: null, periodPulseMinutes: pulse })
  it('keeps only periods that turn a pulse on (a sale at 0 or no override is not one)', () => {
    expect([...pulsingPeriods([period('SALE'), period('PEAK'), period('NONE')], [[row(0)], [row(0), row(60)], [row(null)]])]).toEqual(['PEAK'])
  })
})

describe('pulseAsOfWords', () => {
  const clock = (v: string) => v.slice(11, 16)
  const read = (stamp: string, status = 'SPS_OK') => ({ sampleStamp: stamp, waitingCount: 1, oldestWaitingMinutes: 5, pastAllowanceCount: 0, statusEnumId: status })
  it('says when the figures were read: the last read pulse today, not a skipped one', () => {
    expect(pulseAsOfWords({ pulseEveryMinutes: 60 }, [read('2026-11-26T11:03:13Z'), read('2026-11-26T12:02:32Z', 'SPS_SKIPPED')], clock)).toBe('as of 11:03')
    expect(pulseAsOfWords({ pulseEveryMinutes: 60 }, [], clock)).toBe('No pulse read today yet')
  })
  it('marks them last known when the pulse is off today', () => {
    expect(pulseAsOfWords({ pulseEveryMinutes: null }, [read('2026-11-26T11:03:13Z')], clock)).toBe('Last known · as of 11:03')
    expect(pulseAsOfWords({ pulseEveryMinutes: null }, [], clock)).toBe('Last known figures')
  })
})

describe('distinctCheckWords', () => {
  it('cuts the words every look-alike starts and ends with', () => {
    expect(distinctCheckWords('Daily Order Reconciliation Canada', ['Daily Order Reconciliation EU', 'Daily Order Reconciliation USA'])).toBe('Canada')
    expect(distinctCheckWords('Orders EU - daily', ['Orders UK - daily'])).toBe('EU')
    expect(distinctCheckWords('Month close: Returns', ['Month close: Completed', 'Month close: Approved'])).toBe('Returns')
  })

  it('keeps a whole name with nothing shared, and says nothing with no look-alike', () => {
    expect(distinctCheckWords('Canada orders', ['USA'])).toBe('Canada orders')
    expect(distinctCheckWords('Daily', [])).toBe('')
    expect(distinctCheckWords('Daily', ['Daily'])).toBe('')
  })

  it('puts the words beside the upstream system', () => {
    expect(labelWithCheckWords('Shopify → HotWax', 'Canada')).toBe('Shopify Canada → HotWax')
    expect(labelWithCheckWords('NetSuite only', 'Warranty')).toBe('NetSuite only · Warranty')
    expect(labelWithCheckWords('Shopify → HotWax', '')).toBe('Shopify → HotWax')
  })
})

describe('calendarDayWords', () => {
  it('reads a date or the date of a longer stamp as the same day in every zone, and nothing for anything else', () => {
    expect(calendarDayWords('2026-12-01')).toBe('1 Dec')
    expect(calendarDayWords('2026-12-01T23:30:00-08:00')).toBe('1 Dec')
    expect(calendarDayWords('')).toBe('')
    expect(calendarDayWords('not a date')).toBe('')
  })
})

describe('latestReadSample', () => {
  const sample = (stamp: string, status: string) => ({ sampleStamp: stamp, waitingCount: 1, oldestWaitingMinutes: 5, pastAllowanceCount: 0, statusEnumId: status })
  it('is the newest pulse that read the systems, whatever order they come in; none when every pulse was skipped or failed', () => {
    const late = sample('2026-11-26T12:00:00Z', 'SPS_OK')
    expect(latestReadSample([late, sample('2026-11-26T10:00:00Z', 'SPS_OK'), sample('2026-11-26T13:00:00Z', 'SPS_FAILED')])).toBe(late)
    expect(latestReadSample([sample('2026-11-26T13:00:00Z', 'SPS_SKIPPED')])).toBeNull()
  })
})
