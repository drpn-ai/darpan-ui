import { describe, expect, it } from 'vitest'
import type { SyncAutomationOption, SyncPairSummary } from '../api/pulseTypes'
import { buildSyncPulseView, pairSidesLabel, periodPulseMinutes, syncPulseSettingsValue } from '../syncPulseView'

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
  it('names returns as returns, not orders', () => {
    expect(pairSidesLabel(pair({ automationId: '100520', label: 'HotWax → NetSuite orders' }), automations))
      .toBe('HotWax returns → NetSuite SuiteQL')
  })

  it('names a one-sided check by its one side instead of "Target"', () => {
    expect(pairSidesLabel(pair({ automationId: '100107', label: 'NetSuite → Target orders' }), automations)).toBe('NetSuite SuiteQL only')
  })

  it('keeps a check that really compares NetSuite with NetSuite', () => {
    expect(pairSidesLabel(pair({ automationId: '100110', label: 'NetSuite → NetSuite orders' }), automations))
      .toBe('NetSuite SuiteQL → NetSuite SuiteQL')
  })

  it('takes the upstream from the system the backend label names first, even on FILE_2', () => {
    expect(pairSidesLabel(pair({ automationId: 'B2', label: 'Shopify → NetSuite orders' }), automations)).toBe('Shopify → NetSuite SuiteQL')
    expect(pairSidesLabel(pair({ automationId: '100102', label: 'Shopify → HotWax orders' }), automations)).toBe('Shopify → HotWax orders')
  })

  it('falls back to the check name when the check is not among the options', () => {
    expect(pairSidesLabel(pair({ automationId: 'gone', automationName: 'Old check' }), automations)).toBe('Old check')
    expect(pairSidesLabel(pair({ automationId: 'gone', automationName: '' }), [])).toBe('HotWax → NetSuite orders')
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
    expect(view.pulsing[0]).toMatchObject({ label: 'HotWax orders → NetSuite SuiteQL', checkName: 'Daily Order Reconciliation - NetSuite',
      cadence: 'Every 1h in peak periods', counts: '4 waiting · 12 past' })
    expect(view.pulsing[1]).toMatchObject({ label: 'Shopify → HotWax orders', cadence: 'Every 1h' })
    expect(view.allowanceOnly[0]).toMatchObject({ label: 'HotWax returns → NetSuite SuiteQL', cadence: 'Off' })
  })

  it('puts a period-only pulser with the allowance-only pairs when no live period turns it on', () => {
    const view = buildSyncPulseView(pairs, automations, new Map())
    expect(view.pulsing.map((r) => r.syncPairId)).toEqual(['100102'])
  })

  it('says the pulsing pairs on the Tenant Settings row, "None" when nothing pulses', () => {
    expect(syncPulseSettingsValue(buildSyncPulseView(pairs, automations, new Map([['100000', 60]]))))
      .toBe('HotWax orders → NetSuite SuiteQL · every 1h in peak periods · 1 more')
    expect(syncPulseSettingsValue(buildSyncPulseView([pairs[1]!], automations, new Map()))).toBe('None')
  })
})
