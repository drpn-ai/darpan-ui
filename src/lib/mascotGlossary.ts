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
    body: 'every record the run actually looked at, after exclusions. The overlap — not how many either system is hoarding.',
  },
  differenceCount: {
    title: 'Differences',
    body: 'records both systems have that don’t line up on a compared field. Counted per field, so yes — one record can show up twice. Sorry.',
  },
  onlyInFile1Count: {
    title: 'Only in the first source',
    body: 'records the first source turned up that the second has never heard of, inside this run’s window. Awkward.',
  },
  onlyInFile2Count: {
    title: 'Only in the second source',
    body: 'the same story the other way round — the second has them, the first has never heard of them, inside this run’s window.',
  },
  runStartedAt: {
    // {detail} is filled by describeTimeZone() from the actual value, because the useful
    // answer is which zone THIS time is in — not a lecture about timezones. It replaces
    // the code that used to be appended to every timestamp in the product.
    title: 'Run started',
    body: 'shown in {detail}, not the server’s clock. Ask me on any other timestamp and I will tell you the same thing.',
  },
  ruleSet: {
    title: 'Rule set',
    body: 'which fields are matched, how records are keyed, and what is excluded. Change it and re-run; never edit a finished run. I will know.',
  },
  automationSchedule: {
    title: 'Schedule',
    body: 'when this automation wakes up on its own. Nothing to do with which records it then looks at — that is the window, just below.',
  },
  automationWindow: {
    title: 'Window',
    body: 'how far back each run reaches for records. A record dated just outside it looks missing even when both systems are holding it happily.',
  },
  runStatus: {
    title: 'Status',
    body: 'where the run got to. A finished run can still be a disappointing run, so read it next to the counts rather than instead of them.',
  },
  scheduledDate: {
    title: 'Scheduled',
    body: 'when the run was meant to start. If it sat here a while before starting, something upstream was busy.',
  },
  completedDate: {
    title: 'Completed',
    body: 'when the run stopped, shown in {detail}. Blank means it has not stopped — which is not the same as it having failed.',
  },
  timestamp: {
    title: 'This time',
    body: 'is shown in {detail}. Everyone reads the same instant in their own zone, so mine and yours will not match — and neither is wrong.',
  },
  previousRun: {
    title: 'Previous run',
    body: 'the last time this automation actually went. If it is further back than the schedule implies, something skipped rather than failed quietly.',
  },
  nextRun: {
    title: 'Next run',
    body: 'when it is due to go again, in your zone. A paused automation has no next run, which is different from having a late one.',
  },

  /* ── Straight from darpan-docs/reference/glossary.mdx, so the product and the docs
     cannot drift into describing the same word two ways. ───────────────────────── */
  savedRun: {
    title: 'Saved run',
    body: 'the reusable setup tying sources, schemas, primary IDs and rules together. Executions come and go; this is the thing they are all instances of.',
  },
  reconciliationRun: {
    title: 'Reconciliation run',
    body: 'one execution of a reconciliation. Finished ones are a record of what was true then — re-run rather than editing.',
  },
  schema: {
    title: 'Schema',
    body: 'the saved definition of a source’s shape. Nothing downstream can compare a field that does not appear here.',
  },
  connection: {
    title: 'Connection',
    body: 'a saved external system or provider setup. Credentials live here, not in the run.',
  },
  generatedOutput: {
    title: 'Generated output',
    body: 'the files or records a workflow or run produced. This is what you download; the counts above are what it contains.',
  },
  sourceStrategy: {
    title: 'Source strategy',
    body: 'how inputs get selected or loaded for a run — uploaded, fetched, or pulled from a connection.',
  },
  activeTenant: {
    title: 'Active tenant',
    body: 'the tenant every read and write is scoped to. Switching it re-points your other tabs too, so check it before you blame the data.',
  },
  matched: {
    title: 'Matched',
    body: 'corresponding records found on both sides with no relevant difference. The boring, desirable outcome.',
  },
  valueMismatch: {
    title: 'Value mismatch',
    body: 'a matched record whose fields differ. Both systems have it; they disagree about it.',
  },
  missingInSource: {
    title: 'Missing in source',
    body: 'a record in one source and not the other. Before you chase it: verification passes and structural suppression have already dropped the ones that were never real.',
  },
  processingError: {
    title: 'Processing error',
    body: 'the run could not parse, compare or output part of the data. Counts below this are incomplete rather than clean.',
  },
})

/** Null rather than a throw: a missing phrase is a content gap, not a crash. */
export function lookupGlossary(term: string | null | undefined): GlossaryEntry | null {
  if (!term) return null
  return MASCOT_GLOSSARY[term] ?? null
}
