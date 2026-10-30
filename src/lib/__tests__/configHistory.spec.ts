import { describe, expect, it } from 'vitest'
import { countsSummary, restoreChangesNothing, restoreSections, versionMeta } from '../configHistory'
import type { ConfigRestorePlan, ConfigVersion } from '../api/configTypes'

const version = (over: Partial<ConfigVersion> = {}): ConfigVersion => ({
  id: '100001',
  seq: 3,
  parentId: '100000',
  hash: 'a'.repeat(64),
  bundleVersion: 1,
  counts: { audits: 1, statements: 2, checks: 3, runs: 0, queries: 1, conclusionCodes: 0, connections: 1 },
  changeSource: 'SETTINGS_SAVE',
  reason: 'Saved in Darpan',
  createdBy: 'U1',
  createdByName: 'Aditi Patel',
  createdDate: '2026-10-30T04:47:00Z',
  ...over,
})

const plan = (over: Partial<ConfigRestorePlan> = {}): ConfigRestorePlan => ({
  lines: [],
  blocking: [],
  warnings: [],
  switchOff: [],
  unlink: [],
  kept: [],
  ...over,
})

describe('configHistory', () => {
  it('says when, who and what wrote a version', () => {
    expect(versionMeta(version(), 'America/Los_Angeles')).toBe('Oct 29, 2026, 9:47 PM · Aditi Patel · Saved')
    expect(versionMeta(version({ changeSource: 'MANUAL', createdByName: null }), 'UTC')).toBe('Oct 30, 2026, 4:47 AM · Darpan · Kept by hand')
    expect(versionMeta(version({ changeSource: 'RESTORE' }), 'UTC')).toContain('· Restore')
  })

  it('counts what a version holds, skipping what it has none of', () => {
    expect(countsSummary(version().counts)).toBe('1 audit · 2 statements · 3 checks · 1 query · 1 connection')
    expect(countsSummary({ runs: 2, automations: 1 })).toBe('2 runs · 1 automation')
    expect(countsSummary({ lifecycles: 2 })).toBe('2 lifecycles')
    expect(countsSummary({})).toBe('Empty')
  })

  it('reads a restore plan as what goes back, what is switched off, unlinked and kept', () => {
    const sections = restoreSections(plan({
      lines: [
        { kind: 'STATEMENT', ref: 'STATEMENT:S1', label: 'month-close R2', action: 'UPDATE',
          changes: [{ field: 'statementText', from: 'Every invoice has an Etail id.', to: 'Every invoice carries the Etail id.' }] },
        { kind: 'CHECK', ref: 'CHECK:C1', label: 'Open credit memos', action: 'CREATE' },
        { kind: 'AUDIT', ref: 'AUDIT:A1', label: 'month-close', action: 'UNCHANGED' },
        { kind: 'NETSUITE_AUTH', ref: 'NETSUITE_AUTH:N1', label: 'krewe netsuite', action: 'MAPPED' },
      ],
      switchOff: [{ statementId: 'S9', audit: 'month-close', statement: 'R9' }],
      unlink: [{ statementId: 'S1', checkId: 'C2', audit: 'month-close', statement: 'R2', check: 'credit-memos-open' }],
      kept: [{ kind: 'AUTOMATION', label: 'Evening invoices' }, { kind: 'LIFECYCLE', label: 'Returns' }, { kind: 'RUN', label: 'Daily orders' }],
    }))
    expect(sections).toEqual([
      { title: 'Goes back', items: [
        'Statement month-close R2: statementText "Every invoice has an Etail id." → "Every invoice carries the Etail id."',
        'Check Open credit memos comes back',
      ] },
      { title: 'Switched off', items: ['Statement R9 in month-close'] },
      { title: 'Unlinked', items: ['credit-memos-open no longer checks R2'] },
      { title: 'Kept as they are', items: ['Automation Evening invoices', 'Lifecycle Returns', 'Run Daily orders'] },
    ])
  })

  it('shortens long values and long lists', () => {
    const long = 'x'.repeat(200)
    const many = Array.from({ length: 15 }, (_, i) => ({ statementId: `S${i}`, audit: 'mc', statement: `R${i}` }))
    const sections = restoreSections(plan({
      lines: [{ kind: 'STATEMENT', ref: 'S', label: 'mc R1', action: 'UPDATE', changes: [{ field: 'statementText', from: long, to: 'short' }] }],
      switchOff: many,
    }))
    expect(sections[0]!.items[0]).toContain(`"${'x'.repeat(59)}…"`)
    expect(sections[1]!.items).toHaveLength(13)
    expect(sections[1]!.items[12]).toBe('and 3 more')
  })

  it('knows when a restore changes nothing', () => {
    expect(restoreChangesNothing(plan({ lines: [{ kind: 'AUDIT', ref: 'A', label: 'mc', action: 'UNCHANGED' }],
      kept: [{ kind: 'RUN', label: 'Daily orders' }] }))).toBe(true)
    expect(restoreChangesNothing(plan({ switchOff: [{ statementId: 'S9', audit: 'mc', statement: 'R9' }] }))).toBe(false)
  })
})
