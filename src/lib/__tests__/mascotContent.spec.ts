import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupAction } from '../mascotActions'
import { applyAppContent, loadMascotContent, matchWildcard, resetMascotContentForTests, type AppContentEdit } from '../mascotContent'
import { lookupGlossary } from '../mascotGlossary'
import { hintsFor } from '../mascotHints'
import { resolveExplainTarget } from '../mascotTargets'

function render(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  return host
}

const glossaryEdit = (extra: Partial<AppContentEdit>): AppContentEdit =>
  ({ kind: 'MASCOT_GLOSSARY', key: 'differenceCount', source: 'SEED', ...extra })
const adminTerm = (extra: Partial<AppContentEdit>): AppContentEdit =>
  ({ kind: 'MASCOT_GLOSSARY', key: 'admin:ledger-pulse', source: 'ADMIN', title: 'Ledger pulse', body: 'how often the ledger is read back against the books.', aliases: ['ledger pulse'], ...extra })
const hintRow = (extra: Partial<AppContentEdit>): AppContentEdit =>
  ({ kind: 'MASCOT_HINT', key: 'admin:tile-tip', source: 'ADMIN', body: 'Tiles remember where you left them.', routeName: 'reconciliation-automations', conditionKind: 'ALWAYS', sequence: 15, ...extra })

afterEach(() => {
  resetMascotContentForTests()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('mascot content as data', () => {
  it('aSeedEditReplacesWords', () => {
    const before = lookupGlossary('differenceCount')!
    applyAppContent([
      glossaryEdit({ title: 'Mismatches', body: 'rows that disagree between the two sides.' }),
      { kind: 'MASCOT_ACTION', key: 'stop run', source: 'SEED', body: 'ends the run and keeps nothing.' },
      { kind: 'MASCOT_ACTION', key: 'pattern:^download .+$', source: 'SEED', title: 'Fetch', body: 'saves the file to your computer.' },
    ])
    expect(lookupGlossary('differenceCount')).toEqual({ title: 'Mismatches', body: 'rows that disagree between the two sides.' })
    expect(lookupAction('stop run')).toMatchObject({ title: 'Stop run', body: 'ends the run and keeps nothing.' })
    expect(lookupAction('download results.csv')).toMatchObject({ title: 'Fetch', body: 'saves the file to your computer.' })
    resetMascotContentForTests()
    expect(lookupGlossary('differenceCount')).toEqual(before)
  })

  it('anEditedTitleDoesNotChangeRecognition', () => {
    applyAppContent([glossaryEdit({ title: 'Mismatches' })])
    const host = render('<dt class="micro-label">Differences</dt><dt class="micro-label">Mismatches</dt>')
    const [first, second] = Array.from(host.querySelectorAll('dt'))
    expect(resolveExplainTarget(first!)?.term).toBe('differenceCount')
    expect(resolveExplainTarget(second!)).toBeNull()
  })

  it('aNewHintOnAKnownRouteShowsUp', () => {
    applyAppContent([hintRow({ conditionKind: 'ANCHOR_PRESENT', anchorTestId: 'ledger-tile' })])
    const without = render('<div data-testid="automation-tile"></div><div data-testid="automation-create-action"></div>')
    const plain = hintsFor('reconciliation-automations', without)
    expect(plain).toHaveLength(2)
    expect(plain).not.toContain('Tiles remember where you left them.')
    const withAnchor = render('<div data-testid="automation-tile"></div><div data-testid="automation-create-action"></div><div data-testid="ledger-tile"></div>')
    const shown = hintsFor('reconciliation-automations', withAnchor)
    expect(shown).toHaveLength(3)
    expect(shown[1]).toBe('Tiles remember where you left them.')
  })

  it('anAlwaysHintShowsWithoutAnAnchor', () => {
    applyAppContent([hintRow({})])
    expect(hintsFor('reconciliation-automations', document.body)).toEqual(['Tiles remember where you left them.'])
  })

  it('aNewTermIsReachedByAliasAndWildcard', () => {
    applyAppContent([adminTerm({ aliases: ['ledger pulse'], matchPattern: 'ledger * cadence' })])
    const host = render('<dt class="micro-label">Ledger pulse:</dt><dt class="micro-label">Ledger weekly cadence</dt><dt class="micro-label">Ledger cadence</dt>')
    const [alias, wild, none] = Array.from(host.querySelectorAll('dt'))
    expect(resolveExplainTarget(alias!)?.term).toBe('admin:ledger-pulse')
    expect(resolveExplainTarget(wild!)?.term).toBe('admin:ledger-pulse')
    expect(resolveExplainTarget(none!)).toBeNull()
    expect(lookupGlossary('admin:ledger-pulse')).toEqual({ title: 'Ledger pulse', body: 'how often the ledger is read back against the books.' })
  })

  it('aNewActionIsReachedByControlName', () => {
    applyAppContent([
      { kind: 'MASCOT_ACTION', key: 'admin:park-run', source: 'ADMIN', title: 'Park run', body: 'sets the run aside until you pick it up.', aliases: ['park run'] },
      { kind: 'MASCOT_ACTION', key: 'admin:park-many', source: 'ADMIN', title: 'Park many', body: 'sets every chosen run aside.', matchPattern: 'park all *' },
    ])
    expect(lookupAction('park run')?.title).toBe('Park run')
    expect(lookupAction('park all tuesday runs')?.title).toBe('Park many')
    const host = render('<button aria-label="Park run">x</button>')
    expect(resolveExplainTarget(host.querySelector('button'))?.term).toBe('park run')
  })

  it('bundleMatchingWinsOverData', () => {
    applyAppContent([
      adminTerm({ key: 'admin:shadow', aliases: ['differences', 'brand new label'] }),
      { kind: 'MASCOT_ACTION', key: 'admin:shadow-action', source: 'ADMIN', title: 'Mine', body: 'is mine.', matchPattern: 'download *' },
      { kind: 'MASCOT_ACTION', key: 'admin:shadow-two', source: 'ADMIN', title: 'Mine too', body: 'is mine too.', aliases: ['stop run'] },
    ])
    const host = render('<dt class="micro-label">Differences</dt><dt class="micro-label">Brand new label</dt>')
    const [first, second] = Array.from(host.querySelectorAll('dt'))
    expect(resolveExplainTarget(first!)?.term).toBe('differenceCount')
    // only the shadowed alias is dropped; the row's other alias still answers
    expect(resolveExplainTarget(second!)?.term).toBe('admin:shadow')
    expect(lookupAction('download results.csv')?.title).toBe('Download')
    expect(lookupAction('stop run')?.title).toBe('Stop run')
  })

  it('aShadowedAliasDropsOnlyItself', () => {
    applyAppContent([
      glossaryEdit({ hidden: true, aliases: ['differences'] }),
      { kind: 'MASCOT_ACTION', key: 'stop run', source: 'SEED', body: 'ends the run and keeps nothing.', aliases: ['download results.csv', 'halt it'] },
      adminTerm({ key: 'admin:regex', aliases: ['missing from netsuite', 'ledger pulse'] }),
    ])
    // the hidden edit survives the alias the bundle already answers
    expect(lookupGlossary('differenceCount')).toBeNull()
    // the body edit survives, the shadowed alias does not, the free one answers
    expect(lookupAction('stop run')?.body).toBe('ends the run and keeps nothing.')
    expect(lookupAction('halt it')?.body).toBe('ends the run and keeps nothing.')
    expect(lookupAction('download results.csv')?.title).toBe('Download')
    const host = render('<dt class="micro-label">Missing from NetSuite</dt><dt class="micro-label">Ledger pulse</dt>')
    const [regex, free] = Array.from(host.querySelectorAll('dt'))
    expect(resolveExplainTarget(regex!)?.term).toBe('missingInSource')
    expect(resolveExplainTarget(free!)?.term).toBe('admin:regex')
  })

  it('ignoresARowThatBreaksTheRules', () => {
    applyAppContent([
      adminTerm({ key: 'admin:a', aliases: ['alpha ledger'], body: 'uses a {token} slot.' }),
      adminTerm({ key: 'admin:b', aliases: ['beta ledger'], body: 'has <b>markup</b> in it.' }),
      adminTerm({ key: 'admin:c', aliases: ['gamma ledger'], matchPattern: '***' }),
      adminTerm({ key: 'admin:d', aliases: ['delta ledger'], body: 'is seamless and robust.' }),
      glossaryEdit({ body: 'has {extra} slot.' }),
      hintRow({ key: 'admin:e', conditionKind: 'ANCHOR_PRESENT', anchorTestId: 'x"] , *' }),
    ])
    const host = render('<dt class="micro-label">Alpha ledger</dt><dt class="micro-label">Beta ledger</dt><dt class="micro-label">Gamma ledger</dt><dt class="micro-label">Delta ledger</dt>')
    for (const dt of Array.from(host.querySelectorAll('dt'))) expect(resolveExplainTarget(dt)).toBeNull()
    expect(lookupGlossary('differenceCount')!.title).toBe('Differences')
    expect(hintsFor('reconciliation-automations', document.body)).toEqual([])
  })

  it('aHiddenTermIsSilent', () => {
    applyAppContent([glossaryEdit({ hidden: true }), adminTerm({ hidden: true })])
    const host = render('<dt class="micro-label">Differences</dt><dt class="micro-label">Ledger pulse</dt>')
    for (const dt of Array.from(host.querySelectorAll('dt'))) expect(resolveExplainTarget(dt)).toBeNull()
    expect(lookupGlossary('differenceCount')).toBeNull()
  })

  it('aHiddenHintIsNotOffered', () => {
    applyAppContent([
      { kind: 'MASCOT_HINT', key: 'reconciliation-automations.automation-create-action', source: 'SEED', hidden: true },
    ])
    const page = render('<div data-testid="automation-tile"></div><div data-testid="automation-create-action"></div>')
    expect(hintsFor('reconciliation-automations', page)).toHaveLength(1)
  })

  it('aSeedHintEditChangesItsText', () => {
    applyAppContent([{ kind: 'MASCOT_HINT', key: 'reconciliation-automations.automation-create-action', source: 'SEED', body: 'Create Automation starts from a saved run.' }])
    const page = render('<div data-testid="automation-create-action"></div>')
    expect(hintsFor('reconciliation-automations', page)).toEqual(['Create Automation starts from a saved run.'])
  })

  it('keepsTheBundleWhenTheReadFails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const before = lookupGlossary('differenceCount')
    await expect(loadMascotContent(() => Promise.reject(new Error('401')))).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    expect(lookupGlossary('differenceCount')).toEqual(before)
    expect(lookupGlossary('admin:ledger-pulse')).toBeNull()
    await expect(loadMascotContent(() => Promise.resolve({ ok: false, errors: ['no'] }))).resolves.toBeUndefined()
    expect(lookupGlossary('differenceCount')).toEqual(before)
  })

  it('loadsOnce', async () => {
    const fetch = vi.fn(async () => ({ ok: true, entries: [adminTerm({})] }))
    await loadMascotContent(fetch)
    await loadMascotContent(fetch)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(lookupGlossary('admin:ledger-pulse')?.title).toBe('Ledger pulse')
  })

  it('wildcardMatcherIsLinear', () => {
    expect(matchWildcard('park all *', 'park all runs')).toBe(true)
    expect(matchWildcard('park all *', 'park all ')).toBe(false)
    expect(matchWildcard('a*b*c', 'aXbYc')).toBe(true)
    expect(matchWildcard('a*b*c', 'abc')).toBe(false)
    expect(matchWildcard('exactly', 'exactly')).toBe(true)
    const started = performance.now()
    expect(matchWildcard('*a*a', 'a'.repeat(200000))).toBe(true)
    expect(matchWildcard('a*a*b', 'a'.repeat(200000))).toBe(false)
    expect(performance.now() - started).toBeLessThan(500)
  })
})
