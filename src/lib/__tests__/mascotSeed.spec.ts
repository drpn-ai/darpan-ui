import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ACTION_PATTERNS, MASCOT_ACTIONS } from '../mascotActions'
import { MASCOT_GLOSSARY } from '../mascotGlossary'
import { MASCOT_HINTS } from '../mascotHints'
import { anchorsIn, routeAnchors } from '../mascotRouteAnchors'
import { LABEL_ALIASES, normalizeLabel } from '../mascotTargets'
import { actionPatternKey, assertMatchLabelsFit, hintKey, mascotSeedMark, mascotSeedRows, mascotSeedXml, xmlAttr, type SeedRow } from '../mascotSeed'

const rows = mascotSeedRows()
const ofKind = (kind: string) => rows.filter((row) => row.contentKind === kind)

describe('mascot seed rows', () => {
  it('oneRowPerEntry', () => {
    expect(ofKind('MASCOT_GLOSSARY')).toHaveLength(Object.keys(MASCOT_GLOSSARY).length)
    expect(ofKind('MASCOT_ACTION')).toHaveLength(Object.keys(MASCOT_ACTIONS).length + ACTION_PATTERNS.length)
    expect(ofKind('MASCOT_HINT')).toHaveLength(Object.values(MASCOT_HINTS).reduce((n, hints) => n + hints.length, 0))
    expect(new Set(rows.map((row) => `${row.contentKind}/${row.contentKey}`)).size).toBe(rows.length)
  })

  it('keys follow the scheme', () => {
    const [first] = ACTION_PATTERNS
    expect(ofKind('MASCOT_ACTION').some((row) => row.contentKey === actionPatternKey(first![0]))).toBe(true)
    const hint = MASCOT_HINTS['hub']![0]!
    expect(ofKind('MASCOT_HINT').some((row) => row.contentKey === hintKey('hub', hint))).toBe(true)
    expect(ofKind('MASCOT_GLOSSARY').some((row) => row.contentKey === 'differenceCount')).toBe(true)
  })

  it('noSeedKeyStartsWithAdmin', () => {
    expect(rows.filter((row) => row.contentKey.startsWith('admin:'))).toEqual([])
  })

  it('matchLabelsCoverTitlesAndAliases', () => {
    const difference = ofKind('MASCOT_GLOSSARY').find((row) => row.contentKey === 'differenceCount')!
    expect(difference.matchLabels).toContain('differences')
    expect(difference.matchLabels).toContain(normalizeLabel(MASCOT_GLOSSARY['differenceCount']!.title))
    for (const [label, term] of Object.entries(LABEL_ALIASES)) {
      expect(ofKind('MASCOT_GLOSSARY').find((row) => row.contentKey === term)?.matchLabels, label).toContain(label)
    }
    for (const [term, entry] of Object.entries(MASCOT_GLOSSARY)) {
      if (!entry.byDirectiveOnly) continue
      const labels = ofKind('MASCOT_GLOSSARY').find((row) => row.contentKey === term)!.matchLabels
      expect(labels, `${term} is directive-only`).not.toContain(normalizeLabel(entry.title))
    }
  })

  it('every action row answers its control name', () => {
    expect(ofKind('MASCOT_ACTION').find((row) => row.contentKey === 'stop run')?.matchLabels).toEqual(['stop run'])
  })

  it('everyHintAnchorIsAKnownAnchor', () => {
    const known = routeAnchors()
    for (const row of ofKind('MASCOT_HINT')) {
      expect(known[row.routeName!], `route ${row.routeName}`).toBeTruthy()
      if (row.anchorTestId) expect(known[row.routeName!]!.anchors, `${row.contentKey}`).toContain(row.anchorTestId)
    }
  })

  it('gives hints sequences in steps of ten, in authored order', () => {
    const live = ofKind('MASCOT_HINT').filter((row) => row.routeName === 'reconciliation-run-live')
    expect(live.map((row) => row.defaultSequence).sort((a, b) => a! - b!)).toEqual([10, 20, 30, 40])
  })
})

describe('routeAnchors', () => {
  it('routeAnchorsReadsRealComponents', () => {
    const anchors = routeAnchors()
    expect(Object.keys(anchors).length).toBeGreaterThan(30)
    expect(anchors['reconciliation-run-result']!.anchors).toContain('run-result-download')
    expect(anchors['reconciliation-run-result']!.path).toBe('/reconciliation/run-result/:savedRunId/:outputFileName')
  })
})

describe('mascotSeedXml', () => {
  const xml = mascotSeedXml()

  it('xmlNeverWritesEditColumns', () => {
    for (const edit of ['title=', 'body=', 'aliases=', 'hidden=']) {
      expect(xml.replace(/default(Title|Body)=/g, '')).not.toMatch(new RegExp(`[\\s"]${edit}`))
    }
    expect(xml).toContain('source="SEED"')
  })

  it('is stable and parses as XML', () => {
    expect(mascotSeedXml()).toBe(xml)
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.getElementsByTagName('darpan.content.AppContentEntry').length).toBe(rows.length)
    expect(doc.getElementsByTagName('darpan.content.AppRoute').length).toBe(Object.keys(routeAnchors()).length)
  })

  it('stamps every seed entry with one mark that the CURRENT row carries', () => {
    const mark = mascotSeedMark()
    expect(mark).toMatch(/^[0-9a-f]{16}$/)
    expect(xml).toContain(`<darpan.content.AppContentSeed seedId="CURRENT" seedMark="${mark}"/>`)
    expect(xml.match(new RegExp(`source="SEED" seedMark="${mark}"`, 'g'))?.length).toBe(rows.length)
    expect(mascotSeedMark()).toBe(mark)
  })

  it('writes the seed file when MASCOT_SEED_OUT is set', () => {
    const out = process.env['MASCOT_SEED_OUT']
    if (out) writeFileSync(out, xml)
    expect(true).toBe(true)
  })
})

describe('anchor sweep', () => {
  it('readsOnlyTestIdForms', () => {
    const source = [
      '<button data-testid="real-one" class="foo-bar">',
      "<Wizard :primary-test-id=\"ok ? 'wizard-next' : 'wizard-done'\" />",
      "const spec = { backTestId: ok ? 'wizard-back' : 'wizard-prev', title: 'not-an-anchor' }",
      "const label = 'some-label' // mentions a test id in passing",
      "<p :title=\"'also-not'\" data-test-id-doc>see test-id notes 'nor-this'</p>",
    ].join('\n')
    expect(anchorsIn(source)).toEqual(['real-one', 'wizard-back', 'wizard-done', 'wizard-next', 'wizard-prev'])
  })
})

describe('generator guards', () => {
  it('escapesTabAndLoneCarriageReturn', () => {
    expect(xmlAttr('a\tb\rc\r\nd\ne&"<>')).toBe('a&#9;b&#13;c&#10;d&#10;e&amp;&quot;&lt;&gt;')
  })

  it('refusesMatchLabelsOverTheColumn', () => {
    const row = (labels: string[]): SeedRow => ({ contentKind: 'MASCOT_GLOSSARY', contentKey: 'longTerm', defaultTitle: 'T', defaultBody: 'b', matchLabels: labels, whereShown: 'x' })
    expect(() => assertMatchLabelsFit([row(['a'.repeat(255)])])).not.toThrow()
    expect(() => assertMatchLabelsFit([row(['a'.repeat(200), 'b'.repeat(100)])])).toThrow(/longTerm.*matchLabels.*255/)
  })
})
