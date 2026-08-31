/**
 * What the mascot is allowed to explain.
 *
 * Every entry has to land in three lines of the dock bubble. That ceiling is the
 * point rather than a limitation: there is only room to say what a number IS, not
 * how it is computed, which is the thing operators actually get wrong. If a phrase
 * will not fit, the phrase is wrong.
 *
 * Keys are stable ids, not labels — a column can be renamed without silently
 * detaching its explanation.
 */
export interface GlossaryEntry {
  /** Shown as the bubble's lead, in the reader's own vocabulary. */
  title: string
  /** One sentence. Under thirty words. */
  body: string
}

export const MASCOT_GLOSSARY: Readonly<Record<string, GlossaryEntry>> = Object.freeze({
  comparedCount: {
    title: 'Compared',
    body: 'every record the run looked at, after exclusions — the size of the overlap, not how many records either system holds.',
  },
  differenceCount: {
    title: 'Differences',
    body: 'records both systems have that disagree on a compared field. Counted per field, so one record can appear twice.',
  },
  onlyInFile1Count: {
    title: 'Only in the first source',
    body: 'records the first source returned that the second never held, inside this run’s window.',
  },
  onlyInFile2Count: {
    title: 'Only in the second source',
    body: 'records the second source returned that the first never held, inside this run’s window.',
  },
  runStartedAt: {
    title: 'Run started',
    body: 'shown in your preferred timezone, not the server’s — which is why the zone code is always printed beside it.',
  },
  ruleSet: {
    title: 'Rule set',
    body: 'which fields are matched, how records are keyed, and what is excluded. Change it and re-run; never edit a finished run.',
  },
})

/** Null rather than a throw: a missing phrase is a content gap, not a crash. */
export function lookupGlossary(term: string | null | undefined): GlossaryEntry | null {
  if (!term) return null
  return MASCOT_GLOSSARY[term] ?? null
}
