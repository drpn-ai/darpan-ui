/**
 * What the mascot has learned from the database (DAR-BE-313), held apart from the rules that vet it.
 *
 * A leaf on purpose: `mascotGlossary`, `mascotActions`, `mascotTargets` and `mascotHints` read from here, and
 * `mascotContent` (which imports all four to vet a row against the bundle) writes to it. If the reader and the
 * vetting shared a file the four registries would import each other in a ring, and `mascotTargets` builds its
 * index at load.
 *
 * Everything here is already vetted and already normalised. The bundle always answers first; this only adds.
 */

export type ContentKind = 'MASCOT_GLOSSARY' | 'MASCOT_ACTION' | 'MASCOT_HINT'

/** An admin's edit of a bundled entry. Absent fields mean "as bundled". */
export interface WordsEdit {
  title?: string
  body?: string
  hidden?: boolean
}

export interface DataWords {
  title: string
  body: string
}

export interface DataHint {
  text: string
  sequence: number
  /** A `[data-testid="…"]` selector, built here from a vetted id; absent for an ALWAYS hint. */
  when?: string
}

export interface ContentState {
  /** `kind/key` to the edit, for SEED rows. */
  edits: Map<string, WordsEdit>
  /** ADMIN glossary entries by `admin:` key. */
  adminGlossary: Map<string, DataWords>
  /** Normalised label to a glossary key (a bundled term or an ADMIN entry). */
  labels: Map<string, string>
  labelPatterns: [pattern: string, key: string][]
  /** Normalised control name to the words it answers. */
  actions: Map<string, DataWords>
  actionPatterns: [pattern: string, words: DataWords][]
  /** Route name to ADMIN hints. */
  hints: Map<string, DataHint[]>
}

function empty(): ContentState {
  return { edits: new Map(), adminGlossary: new Map(), labels: new Map(), labelPatterns: [], actions: new Map(), actionPatterns: [], hints: new Map() }
}

let state: ContentState = empty()

export function setContentState(next: ContentState): void {
  state = next
}

export function emptyContentState(): ContentState {
  return empty()
}

export function resetContentState(): void {
  state = empty()
}

export function editFor(kind: ContentKind, key: string): WordsEdit | undefined {
  return state.edits.get(`${kind}/${key}`)
}

export function adminGlossaryEntry(key: string): DataWords | undefined {
  return state.adminGlossary.get(key)
}

/**
 * `*` means one or more characters. An anchored prefix, the middle parts found in order, an anchored suffix:
 * linear in the text for any pattern the rules allow (at most 2 stars, 60 characters). No RegExp is built from
 * data. The same algorithm as the server's `AppContentRules.matchWildcard`.
 */
export function matchWildcard(pattern: string, text: string): boolean {
  const parts = pattern.split('*')
  if (parts.length === 1) return pattern === text
  const first = parts[0]!
  const last = parts[parts.length - 1]!
  if (!text.startsWith(first)) return false
  let pos = first.length
  for (let i = 1; i < parts.length - 1; i++) {
    const idx = text.indexOf(parts[i]!, pos + 1)
    if (idx < 0) return false
    pos = idx + parts[i]!.length
  }
  return text.length - last.length >= pos + 1 && text.endsWith(last)
}

/** The glossary key a label reaches through data: an exact alias, else a wildcard. */
export function dataLabel(label: string): string | null {
  const exact = state.labels.get(label)
  if (exact) return exact
  for (const [pattern, key] of state.labelPatterns) if (matchWildcard(pattern, label)) return key
  return null
}

/** The words a control name reaches through data: an exact name, else a wildcard. */
export function dataAction(name: string): DataWords | null {
  const exact = state.actions.get(name)
  if (exact) return exact
  for (const [pattern, words] of state.actionPatterns) if (matchWildcard(pattern, name)) return words
  return null
}

export function dataHints(route: string): readonly DataHint[] {
  return state.hints.get(route) ?? []
}
