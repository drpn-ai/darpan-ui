import { describe, expect, it } from 'vitest'
import type { SyncAutomationOption, SyncPairSummary } from '../api/pulseTypes'
import { buildSyncPulseView, lastPulseWords, nextPulsePeriods, pairSidesLabel, periodPulseMinutes, plainPairLabel, pulseWatchFacts, syncPulseSettingsValue } from '../syncPulseView'

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
  // GORJANA: 100102 pulses hourly; 100000 only in peak periods; 100001 and the month-close pairs only carry the allowance.
  const pairs = [
    pair({ syncPairId: '100000', automationId: '100518', automationName: 'Daily Order Reconciliation - NetSuite', waitingCount: 4, pastAllowanceCount: 12 }),
    pair({ syncPairId: '100001', automationId: '100520', automationName: 'Daily Return Reconciliation - NetSuite' }),
    pair({ syncPairId: '100053', automationId: '100107', label: 'NetSuite → Target orders', allowanceMinutes: 15 }),
    pair({ syncPairId: '100102', automationId: '100102', label: 'Shopify → HotWax orders', automationName: 'Daily Order Reconciliation', pulseEveryMinutes: 60 }),
  ]

  it('splits pulsing pairs from allowance-only pairs', () => {
    const view = buildSyncPulseView(pairs, automations, new Map([['100000', 60]]))
    expect(view.pulsing.map((r) => r.syncPairId)).toEqual(['100000', '100102'])
    expect(view.allowanceOnly.map((r) => r.syncPairId)).toEqual(['100001', '100053'])
    expect(view.pulsing[0]).toMatchObject({ label: 'HotWax → NetSuite', checkName: 'Daily Order Reconciliation - NetSuite',
      cadence: 'Every 1h in peak periods', counts: '4 waiting · 12 past' })
    expect(view.pulsing[1]).toMatchObject({ label: 'Shopify → HotWax', cadence: 'Every 1h' })
    expect(view.allowanceOnly[0]).toMatchObject({ label: 'HotWax → NetSuite returns', cadence: 'Off' })
  })

  it('puts a period-only pulser with the allowance-only pairs when no live period turns it on', () => {
    const view = buildSyncPulseView(pairs, automations, new Map())
    expect(view.pulsing.map((r) => r.syncPairId)).toEqual(['100102'])
  })

  it('says the pulsing pairs on the Tenant Settings row, "None" when nothing pulses', () => {
    expect(syncPulseSettingsValue(buildSyncPulseView(pairs, automations, new Map([['100000', 60]]))))
      .toBe('HotWax → NetSuite · every 1h in peak periods · 1 more')
    expect(syncPulseSettingsValue(buildSyncPulseView([pairs[1]!], automations, new Map()))).toBe('None')
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
    normalAllowanceMinutes: 120, normalPulseEveryMinutes: null, periodName: 'Sale Nov 24-26', lastPulseStatusEnumId: 'SPS_SKIPPED',
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
      ['allowance', '6 hours', 'Sale Nov 24-26'],
      ['waiting', '1,234', 'orders'],
      ['oldest', '21h 41m', '#GOR1'],
      ['past', '12', 'findings'],
    ])
  })

  it('says normal when no period changes the allowance, and None when nothing waits', () => {
    const facts = pulseWatchFacts({ ...detail, allowanceMinutes: 120, periodName: null }, [], [], clock)
    expect(facts.find((f) => f.key === 'allowance')).toMatchObject({ value: '2 hours', sub: 'normal' })
    expect(facts.find((f) => f.key === 'oldest')).toMatchObject({ value: 'None', sub: '' })
  })

  it('shows the period name only when the period really changes the allowance (Shopify → HotWax at 2h in a sale)', () => {
    const facts = pulseWatchFacts({ ...detail, allowanceMinutes: 120 }, [], [], clock)
    expect(facts.find((f) => f.key === 'allowance')).toMatchObject({ value: '2 hours', sub: 'normal' })
  })
})

describe('nextPulsePeriods', () => {
  const period = (id: string, name: string, from: string, state: 'on' | 'upcoming') =>
    ({ peakPeriodId: id, periodName: name, fromDate: from, thruDate: from, isActive: 'Y', state })
  const row = (pairId: string, pulse: number | null) =>
    ({ syncPairId: pairId, label: '', normalAllowanceMinutes: 120, periodAllowanceMinutes: null, normalPulseMinutes: null, periodPulseMinutes: pulse })

  it('names the first coming period that turns each pair\'s pulse on; a sale period at 0 (off) does not count', () => {
    const map = nextPulsePeriods(
      [period('S', 'Sale Nov 28-29', '2026-11-28', 'upcoming'), period('P2', 'PEAK Nov 30', '2026-11-30', 'upcoming'),
        period('NOW', 'Sale Nov 24-26', '2026-11-24', 'on'), period('P1', 'PEAK Nov 27', '2026-11-27', 'upcoming')],
      [[row('100000', 0)], [row('100000', 60), row('100102', 60)], [row('100000', 60)], [row('100102', 60)]],
    )
    expect(map.get('100000')).toBe('PEAK Nov 30')
    expect(map.get('100102')).toBe('PEAK Nov 27')
  })

  it('reads "Off today · next" on a day the pulse is off, the last pulse otherwise', () => {
    const clock = (v: string) => v.slice(11, 16)
    const off = { ...pair({ pulseEveryMinutes: null, lastPulseStamp: '2026-11-26T12:47:32Z' }), lastPulseStatusEnumId: 'SPS_SKIPPED' }
    expect(pulseWatchFacts(off, [], [], clock, 'PEAK Nov 27')[0]).toMatchObject({ value: 'Off today', sub: 'next: PEAK Nov 27' })
    expect(pulseWatchFacts(off, [], [], clock)[0]).toMatchObject({ value: 'Off today', sub: 'last pulse skipped 12:47' })
  })
})
