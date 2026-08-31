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
    body: 'the same story the other way round, inside this run’s window. The second has them; the first does not.',
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
    body: 'where the run got to. A finished run can still be a disappointing one — read it next to the counts.',
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
    body: 'is shown in {detail}. The same instant reads differently in each zone, and neither is wrong.',
  },
  previousRun: {
    title: 'Previous run',
    body: 'the last time this automation actually went. Further back than the schedule implies means something skipped.',
  },
  nextRun: {
    title: 'Next run',
    body: 'when it is due to go again, in your zone. Paused means no next run — not a late one.',
  },

  /* ── Straight from darpan-docs/reference/glossary.mdx, so the product and the docs
     cannot drift into describing the same word two ways. ───────────────────────── */
  savedRun: {
    title: 'Saved run',
    body: 'the reusable setup tying sources, schemas, primary IDs and rules together. Executions are instances of it.',
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
    body: 'in one source, not the other. Verification and suppression already dropped the ones that were never real.',
  },
  processingError: {
    title: 'Processing error',
    body: 'the run could not parse, compare or output part of the data. Counts below this are incomplete rather than clean.',
  },

  /* ── The vocabulary the app actually puts on screen ───────────────────────────
     Counted from the templates rather than imagined: most labels in this product are
     connection and setup fields, not run counts. A glossary of run terms alone left
     entire pages with nothing to ask about. ─────────────────────────────────── */
  timezone: {
    // Wording follows darpan-docs/guides/manage-tenant-settings.mdx.
    title: 'Timezone',
    body: 'this tenant’s default reading of dates and times, for workflows, schedules and windows. Everyone on it sees the same one.',
  },
  systemLabel: {
    title: 'System',
    body: 'which external system this side is. When both sides are the same system, these labels tell the instances apart.',
  },
  activeFlag: {
    title: 'Active',
    body: 'whether this runs on its own. Turning it off stops the schedule and keeps the setup — nothing is deleted.',
  },
  primaryId: {
    title: 'Primary ID',
    body: 'the field records are matched on. Pick one stable and unique, or every run disagrees with itself.',
  },
  endpoint: {
    title: 'Endpoint',
    body: 'the specific call this side fetches from. The connection says which system; this says which door.',
  },
  sourceField: {
    title: 'Field',
    body: 'one field inside the source, as the schema named it. Only fields the schema knows about can be compared.',
  },
  baseUrl: {
    title: 'Base URL',
    body: 'the root address every request is built on. A trailing path here quietly changes every endpoint below it.',
  },
  authType: {
    title: 'Auth Type',
    body: 'how Darpan proves who it is to this system. Change it and the credentials below change with it.',
  },
  apiVersion: {
    title: 'API Version',
    body: 'which version of the remote API to speak. Pinned deliberately — a system that moves on can rename fields your schema still expects.',
  },
  configId: {
    title: 'Config ID',
    body: 'the identifier of this saved setup. Useful when a run names a config rather than a system, and when someone asks which one broke.',
  },
  webhookUrl: {
    title: 'Webhook URL',
    body: 'where notifications are posted. Anyone holding this can post into that space, so treat it as a credential.',
  },
  timeoutSeconds: {
    title: 'Timeout',
    body: 'how long to wait on this system before giving up. Too short turns a slow source into a failed run; too long hides one.',
  },
  sharedWith: {
    title: 'Shared with',
    body: 'the other tenants allowed to use this configuration. Sharing grants use of the setup, not sight of the data a run produces.',
  },
  permissions: {
    title: 'Permissions',
    body: 'what this account may do inside the active tenant. Access is scoped per tenant, so the same person can differ between them.',
  },
  runName: {
    title: 'Run name',
    body: 'what you search for later. Ask Darpan finds runs by this and by output file name, so be specific.',
  },
  startDate: {
    title: 'Start date',
    body: 'the beginning of the window this run reaches back to. A record dated just before it looks missing even when both systems hold it.',
  },
  updatedAt: {
    title: 'Updated',
    body: 'when this record last changed, in your zone. Not when the data it describes changed.',
  },
  remoteAttributes: {
    title: 'Remote attributes',
    body: 'extra values passed through to the remote system on each call. Wrong ones fail quietly as an empty extract rather than an error.',
  },

  /* ── Section headings ─────────────────────────────────────────────────────────
     The first thing anybody lost on a page reads is the heading over the region, so
     it is the cheapest possible place to answer "what am I looking at". ───────── */
  exclusions: {
    // Not a filter on the comparison: exclusions are pushed to the connector as filter
    // parameters, so excluded records are never fetched in the first place. A side that
    // cannot filter at the source has no exclusions at all, which is why the board says
    // so when you try — see RuleSetBoard's "cannot filter records at the source".
    title: 'Exclusions',
    body: 'rules for what a source leaves out when a run pulls its data. Excluded records never arrive, so they cannot show up as differences.',
  },
  previousRuns: {
    title: 'Previous runs',
    body: 'every execution of this automation, newest first. Each is a record of what was true when it went — re-run rather than editing one.',
  },
  previousResults: {
    title: 'Previous results',
    body: 'the reviewable output of earlier runs. The run is the execution; the result is what it left behind.',
  },
  savedSchemas: {
    title: 'Saved schemas',
    body: 'the source shapes this tenant has defined. A run can only compare fields that appear in one of these.',
  },
  savedRuns: {
    title: 'Saved runs',
    body: 'the reusable setups — sources, schemas, primary IDs and rules — that executions are instances of.',
  },
  savedConfigs: {
    title: 'Saved configs',
    body: 'connection setups this tenant can point a run at. One config, many runs.',
  },
  endpoints: {
    title: 'Endpoints',
    body: 'the specific calls available on this connection. The connection is the system; these are the doors into it.',
  },
  tenantContext: {
    title: 'Tenant context',
    body: 'which tenant everything on this page is scoped to. It is a server-side preference, so switching it re-points your other tabs as well.',
  },
  localization: {
    title: 'Localization',
    body: 'how this tenant reads dates and times. Set it before the first automated run, or the team reads timestamps in the wrong zone.',
  },
  pinnedRuns: {
    title: 'Pinned runs',
    body: 'the runs you asked to keep at the top. Pinning changes what you see first, never what a run does.',
  },
  activity: {
    title: 'Activity',
    body: 'what happened here recently, newest first. A quiet list is not the same as a healthy one.',
  },
  operations: {
    title: 'Operations',
    body: 'the actions you can take on this record. Anything here changes something; reading is everywhere else on the page.',
  },
})

/** Null rather than a throw: a missing phrase is a content gap, not a crash. */
export function lookupGlossary(term: string | null | undefined): GlossaryEntry | null {
  if (!term) return null
  return MASCOT_GLOSSARY[term] ?? null
}
