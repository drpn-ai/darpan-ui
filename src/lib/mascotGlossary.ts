import { lookupAction } from './mascotActions'

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
    body: 'every record the run actually looked at, after exclusions. The overlap, not either system’s total — those are always bigger.',
  },
  differenceCount: {
    // DAR-UI-103. reconcile#RuleSetCompareScope (the path every saved run, automation and audit takes)
    // sets differenceCount = missing either side + one row per rule a matched pair failed + duplicate ids.
    // The legacy mapping path has no rules, so the same sentence holds with zero rule rows there.
    title: 'Differences',
    body: 'records missing on either side, plus one for every rule a matched pair failed, plus duplicate ids. A record failing two rules counts twice — it is not a record count.',
  },
  onlyInFile1Count: {
    title: 'Only in the first source',
    body: 'records the first source turned up that the second has never heard of, inside this run’s window. Check the window before chasing them — usually that is the answer.',
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
    body: 'which fields are matched, how records are keyed, and what is excluded. Change it and re-run; a finished run records what was true then, not a draft.',
  },
  automationSchedule: {
    title: 'Schedule',
    body: 'when this automation wakes up on its own. Nothing to do with which records it then looks at — that is the window, just below.',
  },
  automationWindow: {
    title: 'Window',
    body: 'how far back each run reaches for records. A record dated just outside it reads as missing when both systems have it. The most common false alarm here.',
  },
  runStatus: {
    title: 'Status',
    body: 'where the run got to. Finished is not the same as clean — read it next to the counts.',
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
  tokenUrl: {
    title: 'Token URL',
    body: 'where Darpan trades its signed key for a short-lived sign-in token. A wrong account number here fails every call before any data is read.',
  },
  netSuiteScope: {
    title: 'Scope',
    body: 'which NetSuite doors the token opens. RESTlets reach custom scripts, REST Web Services reach SuiteQL; drop one and those calls come back refused.',
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
    // Not a filter on the comparison: these are pushed to the connector as filter parameters,
    // so filtered records are never fetched in the first place. A side that cannot filter at
    // the source has none at all, which is why the board says so when you try — see
    // RuleSetBoard's "cannot filter records at the source".
    title: 'Filters',
    body: 'rules for which records a source pulls at all — either excluding the values you list or keeping only those. What a filter leaves out never arrives, so it cannot show up as a difference.',
  },
  // The Automations page titles this list “Automation Runs”, which reads like a run
  // history and is not one — every tile under it is a saved automation. Kept as its own
  // entry rather than pointed at previousRuns for exactly that reason.
  automations: {
    title: 'Automations',
    body: 'the saved runs set to go off on their own, one tile each. Open one for its schedule, its window, and what it has actually been doing.',
  },
  // The run result page's own vocabulary. These four existed nowhere, which is why a
  // sweep of that page resolved nothing at all — see mascotTargets.page.spec.ts.
  sourceFiles: {
    title: 'Source files',
    body: 'the two extracts this run compared, exactly as they arrived. Download one to check a record the run says is missing.',
  },
  apiDateRange: {
    title: 'API date range',
    // {detail} is the exact pair of instants, filled by the page from the run's own
    // window. The label beside it is only a calendar day, resolved in the viewer's zone,
    // so the instants are the part that settles which records were really in scope.
    body: 'the window this run pulled: {detail}.',
  },
  runSteps: {
    title: 'Run steps',
    body: 'each stage this run went through and how it ended. A step that failed explains a count below it better than the count does.',
  },
  diffDetail: {
    title: 'Diff detail',
    body: 'what actually differs on this record \u2014 the fields, and what each side holds. The counts say how many; this says what.',
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
  runTypeSync: {
    title: 'Sync run',
    body: 'checks that two systems hold the same records. Healthy is zero — anything it finds is a record that never made it across, or arrived wrong.',
  },
  runTypeLifecycle: {
    title: 'Lifecycle run',
    body: 'follows records through a chain of questions and names where each one stalls. Never zero — watch which stall grows.',
  },
  runTypeAudit: {
    title: 'Audit run',
    body: 're-checks a list of what must be true with sync and lifecycle checks, and keeps each finding open until a later run clears it. A fix counts when a run sees it, not when someone says so.',
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

  /* ── Run results (DAR-UI-103) ─────────────────────────────────────────────────── */
  validationMessages: {
    title: 'Validation messages',
    body: 'where a source file broke its schema. Counts read from a file that failed here cannot be trusted — fix the file or the schema, then re-run.',
  },
  processingWarnings: {
    title: 'Processing warnings',
    body: 'what the run noticed and worked around — a guessed file type, a rule that failed on one batch. If one says differences were dropped, the result is incomplete.',
  },
  conclusionChecks: {
    title: 'How Darpan concluded',
    body: 'the facts Darpan checked before naming this cause, and each one held. If any of them looks wrong to you, so is the cause.',
  },
  conclusionDecision: {
    title: 'Needs a decision',
    body: 'a cause Darpan thinks may be expected, not a fault. Stop flagging it in the rules board, or keep flagging and it shows up again next run.',
  },
  lifecycleNotFinding: {
    title: 'Not a finding',
    body: 'records here still show, but this place was marked an expected stop, so they do not count toward Findings. Mark it a finding again if it starts meaning trouble.',
  },
  flowchartFindings: {
    // Same word as the audit's Findings, different thing — the flowchart page points here with v-explain.
    title: 'Findings',
    body: 'records this run left somewhere they should not be — each lifecycle place’s records, or a chart’s “no” answers. Not meant to reach zero; watch which one grows.',
  },

  /* ── The audit report (DAR-UI-103) ────────────────────────────────────────────── */
  auditHealth: {
    title: 'Today’s run',
    body: 'what this morning’s audit read and whether it can be trusted. Anything partial here closed nothing, so read this before believing a quiet findings list.',
  },
  auditRunningNow: {
    title: 'Running now',
    body: 'checks still working this morning. Findings arrive as each one finishes, so the counts climb until the last is done — wait before reading them.',
  },
  auditStatements: {
    title: 'Statements',
    body: 'what this tenant needs to be true, in its own words. Each is tested by checks; one with no check is not covered, which is not the same as passing.',
  },
  auditCheck: {
    title: 'Check',
    body: 'one comparison that tests a statement. Ran means every read was complete; partial found what it could and closed nothing, so open findings stay open.',
  },
  auditNotCovered: {
    title: 'Not covered',
    body: 'statements no check reads. They are not passing; nothing is looking. Add a check, or the audit stays silent about them.',
  },
  auditFindings: {
    title: 'Findings',
    body: 'one record breaking one statement each. It stays open run after run until a complete check stops reporting it — a fix counts when a run sees it.',
  },
  auditRecords: {
    title: 'Records',
    body: 'how many records this source handed over on its last read. A sharp drop from yesterday is worth checking before trusting today’s findings.',
  },
  auditRead: {
    title: 'Read',
    body: 'when the data behind this was read — for a source, the moment it was pulled; for a check, the days it covered. Nothing outside that is on this report.',
  },
  auditAffects: {
    title: 'Affects',
    body: 'the statements whose checks read this source. While it is not complete, their findings cannot close — open ones stay open.',
  },
  auditStuckOn: {
    title: 'Stuck on',
    body: 'the one thing holding this record up, read from the systems themselves. Clear it and the next run closes the finding on its own.',
  },
  auditDoThis: {
    title: 'Do this',
    body: 'the fix for this cause and who owns it. Doing it is half the job: the finding closes when a later run sees the records line up.',
  },
  auditLines: {
    title: 'Lines',
    body: 'this order’s lines; the outlined one is what holds the order up. Start there — the others are shown for context.',
  },
  auditEvidence: {
    title: 'Evidence',
    body: 'the tests run on this one record, passed out of total. The failed ones are why it is a finding; they show only when no cause explains it.',
  },
  auditHistory: {
    title: 'History',
    body: 'every time this finding was found, reopened or closed, and by whom. One that keeps coming back points at a sync, not a one-off mistake.',
  },
  auditGrace: {
    title: 'Grace',
    body: 'how long a new finding waits as pending before it counts as open, to ride out normal sync lag. Too long, and real problems hide that long too.',
  },
  auditMatchedBy: {
    title: 'Matched by',
    body: 'the shared id this check joins the two systems on. A record missing that id on one side can only ever read as missing, never as a mismatch.',
  },

  /* ── Automation dashboard, connections, config (DAR-UI-103) ───────────────────── */
  automationSetup: {
    title: 'Setup',
    body: 'everything a scheduled run of this automation uses. Changes apply from the next run; finished runs keep what was true when they ran.',
  },
  automationBasedOn: {
    title: 'Based on',
    body: 'the saved run this automation copied its sources and filters from. It runs its own copy, so a later edit to that run reaches it only when you sync.',
  },
  automationId: {
    title: 'Automation ID',
    body: 'how Darpan refers to this automation in logs, chat messages and the CLI. The name can change and this cannot, so quote it when asking for help.',
  },
  connectionDiagnostics: {
    title: 'Diagnostics',
    body: 'this connection, tried one step at a time and shown as each finishes. The first step that fails is the one to fix.',
  },
  configHistory: {
    title: 'Config history',
    body: 'every saved version of this tenant’s setup. Restoring one puts that setup back; runs that already finished keep the results they had.',
  },
})

/** Null rather than a throw: a missing phrase is a content gap, not a crash. */
/**
 * One lookup over two registries. Nouns are keyed by stable id, actions by the control's
 * own name, so the two key spaces cannot collide and the caller does not have to know
 * which kind of question it asked.
 */
export function lookupGlossary(term: string | null | undefined): GlossaryEntry | null {
  if (!term) return null
  return MASCOT_GLOSSARY[term] ?? lookupAction(term)
}
