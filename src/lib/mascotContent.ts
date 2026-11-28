/**
 * The mascot's words, read from the database (DAR-BE-313), vetted a second time here, and laid behind the bundle.
 *
 * The server refuses a bad entry at save (`AppContentRules`), and it re-checks every row it serves. This file does
 * it a third time, with no trust in the wire: a row that breaks a rule is dropped whole, never repaired and never
 * rendered. Words are plain text (the dock renders them as text, never as markup), and no RegExp is ever built from
 * data: a data entry matches by exact normalised alias or by one `*` wildcard (`matchWildcard`).
 *
 * The bundle always answers first (`lookupBundledLabel`, `lookupBundledAction`). Data adds what the bundle does not
 * know, and edits the words (never the recognition) of what it does. If the read fails or returns nothing, nothing
 * here changes and the bundle answers exactly as before.
 */
import { ACTION_PATTERNS, MASCOT_ACTIONS, actionPatternKey, lookupBundledAction } from './mascotActions'
import {
  emptyContentState,
  matchWildcard,
  resetContentState,
  setContentState,
  type ContentKind,
  type ContentState,
} from './mascotContentState'
import { MASCOT_GLOSSARY } from './mascotGlossary'
import { MASCOT_HINTS } from './mascotHints'
import { lookupBundledLabel, normalizeLabel } from './mascotTargets'

export { matchWildcard }
export type AppContentKind = ContentKind

export interface AppContentEdit {
  kind: AppContentKind
  key: string
  source: 'SEED' | 'ADMIN'
  title?: string
  body?: string
  aliases?: string[]
  matchPattern?: string
  hidden?: boolean
  routeName?: string
  conditionKind?: 'ALWAYS' | 'ANCHOR_PRESENT'
  anchorTestId?: string
  sequence?: number
}

/** A hint's seed key: `<route>.<id>`, so an edit follows the id, never the position. */
export function hintKey(route: string, hint: { id: string }): string {
  return `${route}.${hint.id}`
}

const MAX_TITLE = 60
const MAX_ENTRY = 200
const MAX_HINT = 160
const MAX_ALIASES = 10
const MAX_ALIAS = 60
const MAX_PATTERN = 60
const MAX_STARS = 2
const MIN_LITERAL = 4
const MAX_SEQUENCE = 9999
const ADMIN_KEY = /^admin:[a-z0-9]+(-[a-z0-9]+)*$/
const ANCHOR_ID = /^[a-z0-9-]{1,80}$/
const ROUTE_NAME = /^[a-z0-9-]{1,80}$/
const TOKEN = /\{[A-Za-z0-9_]+\}/g

/**
 * Mood performed at the reader, and VOICE_GUIDE.md's hard-fail buzzwords. One list for an admin's words (here) and the
 * bundle's (mascotVoice.spec.ts); the server's `AppContentRules` holds the same two lists.
 */
export const PERFORMED_FLAVOUR: readonly RegExp[] = [
  /\bsorry\b/i, /\bawkward\b/i, /\bdisappointing\b/i, /\bhappily\b/i, /\bhoarding\b/i,
  /\balas\b/i, /\boops\b/i, /\bunfortunately\b/i, /\bI will know\b/, /\bI’ll know\b/,
]
export const BUZZWORDS: readonly RegExp[] = [
  /\bleverage[sd]?\b/i, /\brobust\b/i, /\bseamless(ly)?\b/i, /\bbest-in-class\b/i,
  /\bmission-critical\b/i, /\beffortless(ly)?\b/i, /\bcutting-edge\b/i,
]

function tokens(text: string | undefined): string {
  return [...(text ?? '').matchAll(TOKEN)].map((m) => m[0]).join('|')
}

/** Words on one line, no markup characters, no edge space. */
function lineOk(text: string): boolean {
  return !/[<>\r\n]/.test(text) && text === text.trim()
}

/**
 * The words rules. title/body are the effective words. A SEED edit must keep the default's {token} slots; an
 * ADMIN entry may use none, because no caller fills them.
 */
function wordsOk(kind: AppContentKind, source: 'SEED' | 'ADMIN', title: string | undefined, body: string | undefined,
  defaultTitle: string | undefined, defaultBody: string | undefined): boolean {
  const hint = kind === 'MASCOT_HINT'
  if (hint) {
    if (title) return false
  } else if (!title || !lineOk(title) || title.length > MAX_TITLE) return false
  if (!body || !lineOk(body)) return false
  if (hint) {
    if (body.length > MAX_HINT) return false
  } else {
    if (/^\p{Lu}/u.test(body)) return false
    if ((title ?? '').length + 3 + body.length > MAX_ENTRY) return false
  }
  const spoken = `${title ?? ''}\n${body}`
  if (PERFORMED_FLAVOUR.some((re) => re.test(spoken)) || BUZZWORDS.some((re) => re.test(spoken))) return false
  if (source === 'SEED') {
    if (tokens(body) !== tokens(defaultBody)) return false
    if (!hint && tokens(title) !== tokens(defaultTitle)) return false
  } else if (tokens(body) || tokens(title)) return false
  return true
}

/** Plain aliases: normalised already, at most 60 characters, no markup, none repeated. */
function aliasesOk(aliases: readonly string[]): boolean {
  if (aliases.length > MAX_ALIASES) return false
  const seen = new Set<string>()
  for (const alias of aliases) {
    if (typeof alias !== 'string' || !alias || /[<>|\r\n]/.test(alias) || alias.length > MAX_ALIAS) return false
    if (normalizeLabel(alias) !== alias || seen.has(alias)) return false
    seen.add(alias)
  }
  return true
}

function patternOk(pattern: string): boolean {
  if (!pattern || pattern.length > MAX_PATTERN || /[<>\r\n]/.test(pattern)) return false
  if (pattern !== pattern.trim() || pattern !== pattern.toLowerCase() || normalizeLabel(pattern) !== pattern) return false
  const stars = pattern.split('*').length - 1
  return stars >= 1 && stars <= MAX_STARS && !pattern.includes('**') && pattern.replace(/\*/g, '').length >= MIN_LITERAL
}

/** What the bundle already answers, so a data label can never take it over. */
function bundleAnswers(label: string): boolean {
  return lookupBundledLabel(label) !== null || lookupBundledAction(label) !== null
}

/**
 * The aliases a data row may keep. One alias the bundle already answers (or one that breaks the alias rules) is dropped
 * on its own: it never costs the row its words, its hidden flag or its other aliases.
 */
function usableAliases(aliases: readonly string[] | undefined): string[] {
  if (!aliases?.length) return []
  const kept = aliasesOk(aliases) ? aliases : aliases.filter((alias, index) => aliasesOk([alias]) && aliases.indexOf(alias) === index)
  return kept.filter((alias) => !bundleAnswers(alias)).slice(0, MAX_ALIASES)
}

/** The bundled entry a SEED row's key names, or null for a key no bundle has (a stale or foreign row). */
function bundledEntry(kind: AppContentKind, key: string): { title?: string; body: string } | null {
  if (kind === 'MASCOT_GLOSSARY') return MASCOT_GLOSSARY[key] ?? null
  if (kind === 'MASCOT_ACTION') {
    const direct = MASCOT_ACTIONS[key]
    if (direct) return direct
    return ACTION_PATTERNS.find(([re]) => actionPatternKey(re) === key)?.[1] ?? null
  }
  for (const [route, hints] of Object.entries(MASCOT_HINTS)) {
    const hint = hints.find((candidate) => hintKey(route, candidate) === key)
    if (hint) return { body: hint.text }
  }
  return null
}

function applySeed(entry: AppContentEdit, next: ContentState): void {
  const bundled = bundledEntry(entry.kind, entry.key)
  if (!bundled) return
  if (entry.matchPattern) return
  const hint = entry.kind === 'MASCOT_HINT'
  const title = entry.title || bundled.title
  const body = entry.body || bundled.body
  const edited = Boolean(entry.title || entry.body)
  if (edited && !wordsOk(entry.kind, 'SEED', title, body, bundled.title, bundled.body)) return
  const aliases = hint ? [] : usableAliases(entry.aliases)
  if (!edited && !entry.hidden && !aliases.length) return
  next.edits.set(`${entry.kind}/${entry.key}`, {
    ...(entry.title ? { title: entry.title } : {}), ...(entry.body ? { body: entry.body } : {}), ...(entry.hidden ? { hidden: true } : {}),
  })
  if (entry.hidden) return
  for (const alias of aliases) {
    if (entry.kind === 'MASCOT_GLOSSARY') next.labels.set(alias, entry.key)
    else next.actions.set(alias, { title: title ?? '', body })
  }
}

function applyAdmin(entry: AppContentEdit, next: ContentState): void {
  if (!ADMIN_KEY.test(entry.key) || entry.key.length > 80 || entry.hidden) return
  if (!wordsOk(entry.kind, 'ADMIN', entry.title, entry.body, undefined, undefined)) return
  const body = entry.body as string
  if (entry.kind === 'MASCOT_HINT') {
    if (entry.aliases?.length || entry.matchPattern) return
    const route = entry.routeName
    const sequence = entry.sequence
    if (!route || !ROUTE_NAME.test(route) || typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 0 || sequence > MAX_SEQUENCE) return
    let when: string | undefined
    if (entry.conditionKind === 'ANCHOR_PRESENT') {
      if (!entry.anchorTestId || !ANCHOR_ID.test(entry.anchorTestId)) return
      // Built here from the vetted id; the server's string is never used as a selector.
      when = `[data-testid="${entry.anchorTestId}"]`
    } else if (entry.conditionKind !== 'ALWAYS' || entry.anchorTestId) return
    next.hints.set(route, [...(next.hints.get(route) ?? []), { text: body, sequence, ...(when ? { when } : {}) }])
    return
  }
  const aliases = usableAliases(entry.aliases)
  const pattern = entry.matchPattern ?? ''
  if (pattern && !patternOk(pattern)) return
  if (!aliases.length && !pattern) return
  const words = { title: entry.title as string, body }
  if (entry.kind === 'MASCOT_GLOSSARY') {
    next.adminGlossary.set(entry.key, words)
    for (const alias of aliases) if (!next.labels.has(alias)) next.labels.set(alias, entry.key)
    if (pattern) next.labelPatterns.push([pattern, entry.key])
  } else {
    for (const alias of aliases) if (!next.actions.has(alias)) next.actions.set(alias, words)
    if (pattern) next.actionPatterns.push([pattern, words])
  }
}

/**
 * Vets every entry and swaps them in as the data the registries add behind the bundle. A row that fails the client
 * re-check is dropped whole; one bad row never costs the others.
 */
export function applyAppContent(entries: AppContentEdit[]): void {
  const next = emptyContentState()
  for (const entry of entries) {
    try {
      if (!entry || typeof entry.key !== 'string' || !entry.key) continue
      if (entry.kind !== 'MASCOT_GLOSSARY' && entry.kind !== 'MASCOT_ACTION' && entry.kind !== 'MASCOT_HINT') continue
      if (entry.source === 'SEED') applySeed(entry, next)
      else if (entry.source === 'ADMIN') applyAdmin(entry, next)
    } catch {
      // A malformed row is dropped like any other broken one.
    }
  }
  setContentState(next)
}

let loaded = false

interface ContentRead {
  ok?: boolean
  errors?: string[]
  entries?: unknown[]
}

/**
 * Reads the entries once per tab. Any failure (a 401, a network error, an `ok: false`) leaves the bundle as it is;
 * it warns and never throws, and never retries until the tab reloads.
 */
export async function loadMascotContent(fetch: () => Promise<ContentRead>): Promise<void> {
  if (loaded) return
  loaded = true
  try {
    const result = await fetch()
    if (!result || result.ok === false) {
      console.warn('Mascot content was not served; using the built-in words.', result?.errors ?? [])
      return
    }
    applyAppContent((result.entries ?? []) as AppContentEdit[])
  } catch (error) {
    console.warn('Mascot content could not be read; using the built-in words.', error)
  }
}

export function resetMascotContentForTests(): void {
  loaded = false
  resetContentState()
}
