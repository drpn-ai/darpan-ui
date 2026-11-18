import { describe, expect, it } from 'vitest'
import { countsDelta, countsSummary, groupVersionsByDay, restoreChangesNothing, restoreSections, sourceLabel, versionTime } from '../configHistory'
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
  it('names what kept a version', () => {
    expect(sourceLabel(version())).toBe('Saved')
    expect(sourceLabel(version({ changeSource: 'MANUAL' }))).toBe('Kept by hand')
    expect(sourceLabel(version({ changeSource: 'RESTORE' }))).toBe('Restore')
    expect(sourceLabel(version({ changeSource: 'SOMETHING_NEW' }))).toBe('SOMETHING_NEW')
  })

  it('says what changed against the version before, counts only', () => {
    const before = version({ seq: 2, counts: { audits: 1, statements: 3, checks: 1 } })
    expect(countsDelta(version({ counts: { audits: 1, statements: 2, checks: 3 } }), before)).toBe('\u22121 statement · +2 checks')
    expect(countsDelta(version({ counts: { audits: 2, statements: 3, checks: 1, runs: 1 } }), before)).toBe('+1 audit · +1 run')
    expect(countsDelta(version({ counts: { audits: 1, statements: 3, checks: 1, conclusionCodes: 4 } }), before))
      .toBe('Settings changed, counts the same')
    expect(countsDelta(version({ seq: 1 }), null)).toBe('First version')
    // The one before is older than the list the page loaded: say nothing rather than "First version".
    expect(countsDelta(version({ seq: 9 }), undefined)).toBe('')
  })

  it('groups versions by day in the display time zone: Today, Yesterday, then dates', () => {
    const now = new Date('2026-11-18T10:00:00Z') // 02:00 on the 18th in Los Angeles
    const groups = groupVersionsByDay([
      version({ id: 'a', createdDate: '2026-11-18T09:30:00Z' }), // 01:30 on the 18th, LA
      version({ id: 'b', createdDate: '2026-11-18T07:30:00Z' }), // 23:30 on the 17th, LA: yesterday there, today in UTC
      version({ id: 'c', createdDate: Date.parse('2026-11-12T20:00:00Z') }),
      version({ id: 'd', createdDate: '2025-12-30T20:00:00Z' }),
    ], 'America/Los_Angeles', now)
    expect(groups.map((g) => [g.label, g.versions.map((v) => v.id)])).toEqual([
      ['Today', ['a']], ['Yesterday', ['b']], ['12 Nov', ['c']], ['30 Dec 2025', ['d']],
    ])
    expect(groupVersionsByDay([version({ id: 'a', createdDate: '2026-11-18T09:30:00Z' }), version({ id: 'b', createdDate: '2026-11-18T07:30:00Z' })], 'UTC', now)
      .map((g) => g.label)).toEqual(['Today'])
  })

  it('gives the time of day in the display time zone', () => {
    expect(versionTime('2026-10-30T04:47:00Z', 'America/Los_Angeles')).toBe('9:47 PM')
    expect(versionTime(null, 'UTC')).toBe('-')
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
