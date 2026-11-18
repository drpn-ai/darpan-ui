/**
 * Generates the seed rows for the mascot's content-as-data tables (DAR-BE-313) from the TS
 * registries, so the bundle and the database start identical and a release can refresh the defaults
 * without ever touching an admin's edit. Run through `mascotSeed.spec.ts` with MASCOT_SEED_OUT set.
 * NEVER imported by app code (it reads source files through node fs).
 *
 * The XML sets only `default*`, `matchLabels`, the hint binding and `whereShown`. The edit columns
 * (title, body, aliases, hidden) are never written, so reloading the seed cannot undo an edit.
 */
import { createHash } from 'node:crypto'
import { MASCOT_ACTIONS, ACTION_PATTERNS } from './mascotActions'
import { MASCOT_GLOSSARY } from './mascotGlossary'
import { MASCOT_HINTS } from './mascotHints'
import { LABEL_ALIASES, LABEL_PATTERNS, normalizeLabel } from './mascotTargets'
import { routeAnchors } from './mascotRouteAnchors'

export type AppContentKind = 'MASCOT_GLOSSARY' | 'MASCOT_ACTION' | 'MASCOT_HINT'

export interface SeedRow {
  contentKind: AppContentKind
  contentKey: string
  defaultTitle: string | null
  defaultBody: string
  matchLabels: string[]
  routeName?: string
  anchorTestId?: string
  defaultSequence?: number
  whereShown: string
}

export function hintKey(route: string, hint: { id: string }): string {
  return `${route}.${hint.id}`
}

export function actionPatternKey(re: RegExp): string {
  return `pattern:${re.source}`
}

const ANCHOR_SELECTOR = /^\[data-testid="([^"]+)"\]$/

function glossaryRows(): SeedRow[] {
  const patternTerms = new Map<string, string[]>()
  for (const [re, term] of LABEL_PATTERNS) patternTerms.set(term, [...(patternTerms.get(term) ?? []), re.source])
  return Object.entries(MASCOT_GLOSSARY).map(([term, entry]) => {
    const labels = new Set<string>()
    const title = normalizeLabel(entry.title)
    // The shared index lets an explicit alias beat a coincidental title match.
    if (!entry.byDirectiveOnly && (LABEL_ALIASES[title] ?? term) === term) labels.add(title)
    for (const [label, target] of Object.entries(LABEL_ALIASES)) if (target === term) labels.add(label)
    const matchLabels = [...labels].sort()
    const patterns = (patternTerms.get(term) ?? []).map((source) => `/${source}/`)
    const where = [
      matchLabels.length ? `answers labels: ${matchLabels.join(', ')}` : 'answered only where a page marks it with v-explain',
      ...(patterns.length ? [`and labels matching ${patterns.join(', ')} (in code)`] : []),
    ].join(' ')
    return {
      contentKind: 'MASCOT_GLOSSARY' as const, contentKey: term, defaultTitle: entry.title, defaultBody: entry.body, matchLabels, whereShown: where,
    }
  })
}

function actionRows(): SeedRow[] {
  const named = Object.entries(MASCOT_ACTIONS).map(([name, entry]) => ({
    contentKind: 'MASCOT_ACTION' as const, contentKey: name, defaultTitle: entry.title, defaultBody: entry.body,
    matchLabels: [name], whereShown: `answers controls named ${name}`,
  }))
  const patterned = ACTION_PATTERNS.map(([re, entry]) => ({
    contentKind: 'MASCOT_ACTION' as const, contentKey: actionPatternKey(re), defaultTitle: entry.title, defaultBody: entry.body,
    matchLabels: [] as string[], whereShown: `answers controls whose name matches /${re.source}/ (in code)`,
  }))
  return [...named, ...patterned]
}

function hintRows(): SeedRow[] {
  const paths = routeAnchors()
  return Object.entries(MASCOT_HINTS).flatMap(([route, hints]) =>
    hints.map((hint, index) => {
      const anchor = hint.when?.match(ANCHOR_SELECTOR)?.[1]
      const when = anchor ? `when ${anchor} is on the page` : 'always'
      return {
        contentKind: 'MASCOT_HINT' as const, contentKey: hintKey(route, hint), defaultTitle: null, defaultBody: hint.text, matchLabels: [] as string[],
        routeName: route, ...(anchor ? { anchorTestId: anchor } : {}), defaultSequence: (index + 1) * 10,
        whereShown: `${paths[route]?.path ?? route} · ${when} · position ${index + 1} of ${hints.length}`,
      }
    }),
  )
}

export function mascotSeedRows(): SeedRow[] {
  return [...glossaryRows(), ...actionRows(), ...hintRows()]
    .sort((a, b) => a.contentKind.localeCompare(b.contentKind) || a.contentKey.localeCompare(b.contentKey))
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r?\n/g, '&#10;')
}

function attrs(pairs: [string, string | number | undefined][]): string {
  return pairs.filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}="${esc(String(v))}"`).join(' ')
}

/**
 * A stable hash of everything this file generates. Every SEED row is stamped with it and one AppContentSeed row
 * carries the current one, so a SEED row a later release no longer generates (an old mark) is retired: the backend
 * stops serving it and stops letting it shadow a new alias, and the admin list can delete it.
 */
export function mascotSeedMark(): string {
  const routes = Object.entries(routeAnchors()).sort(([a], [b]) => a.localeCompare(b))
  return createHash('sha256').update(JSON.stringify([mascotSeedRows(), routes])).digest('hex').slice(0, 16)
}

export function mascotSeedXml(): string {
  const routes = Object.entries(routeAnchors()).sort(([a], [b]) => a.localeCompare(b))
  const seedMark = mascotSeedMark()
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- No copyright or license for configuration file, details here are not considered a creative work. -->',
    '<entity-facade-xml type="darpan-seed">',
    '    <!-- DAR-BE-313 — GENERATED by darpan-ui/src/lib/mascotSeed.ts (MASCOT_SEED_OUT=… npx vitest run src/lib/__tests__/mascotSeed.spec.ts); do not edit by hand.',
    '         Sets only the default* columns, matchLabels, the hint binding, whereShown and seedMark, so a release never overwrites an admin edit (title, body, aliases, hidden). -->',
  ]
  lines.push(`    <darpan.content.AppContentSeed ${attrs([['seedId', 'CURRENT'], ['seedMark', seedMark]])}/>`)
  for (const row of mascotSeedRows()) {
    lines.push(`    <darpan.content.AppContentEntry ${attrs([
      ['contentKind', row.contentKind], ['contentKey', row.contentKey], ['source', 'SEED'], ['seedMark', seedMark],
      ['defaultTitle', row.defaultTitle ?? undefined], ['defaultBody', row.defaultBody], ['matchLabels', row.matchLabels.join('|')],
      ['routeName', row.routeName], ['conditionKind', row.routeName ? (row.anchorTestId ? 'ANCHOR_PRESENT' : 'ALWAYS') : undefined],
      ['anchorTestId', row.anchorTestId], ['defaultSequence', row.defaultSequence], ['whereShown', row.whereShown],
    ])}/>`)
  }
  for (const [name, { path }] of routes) lines.push(`    <darpan.content.AppRoute ${attrs([['routeName', name], ['routePath', path]])}/>`)
  for (const [name, { anchors }] of routes) {
    for (const anchor of anchors) lines.push(`    <darpan.content.AppRouteAnchor ${attrs([['routeName', name], ['anchorTestId', anchor]])}/>`)
  }
  lines.push('</entity-facade-xml>', '')
  return lines.join('\n')
}
