/**
 * What the mascot says about a control, as opposed to a value.
 *
 * Deliberately separate from MASCOT_GLOSSARY. "What is this number" and "what will this
 * do" are different questions: a glossary entry describes something that already
 * happened, an action entry describes something that has not happened yet and what it
 * will cost. Mixing verbs into a noun glossary muddies both.
 *
 * THE RULE THAT MAKES AN ENTRY WORTH HAVING: never restate the label. A button already
 * says "Stop run"; the reader is resting on it because they want to know whether the work
 * so far survives. Every body here names a CONSEQUENCE — what changes, what is kept, what
 * is discarded, and what is not affected. An entry that only expands the label into a
 * sentence is worse than the silence it replaced, because it costs a hover to learn
 * nothing.
 *
 * Keys are the control's accessible name, normalised: aria-label, else title, else the
 * text it shows. That is what a screen reader announces and what the person is looking at,
 * so the registry needs no ids of its own and a renamed button fails the coverage test in
 * mascotActions.spec.ts rather than going quietly dead.
 */
export interface ActionEntry {
  /** The control's own name, as the bubble leads with it. */
  title: string
  /** One sentence on what it does to the world. Under thirty words, starts lowercase. */
  body: string
}

export const MASCOT_ACTIONS: Readonly<Record<string, ActionEntry>> = Object.freeze({
  /* ── Starting and stopping runs ─────────────────────────────────────────────── */
  'run ruleset': {
    title: 'Run ruleset',
    body: 'starts a run now, against the rule set as it stands. Editing the rules afterwards will not change what this run compared.',
  },
  'run automation now': {
    title: 'Run automation now',
    body: 'fires it immediately and leaves the schedule alone — the next scheduled run still happens on time.',
  },
  'cancel run': {
    title: 'Cancel run',
    body: 'asks to stop a run that is still going. It asks again before anything is thrown away.',
  },
  'stop run': {
    title: 'Stop run',
    body: 'confirms it. Everything the run has done so far is discarded and there is no resume — the next attempt starts over.',
  },
  'stopping run…': {
    title: 'Stopping run',
    body: 'the cancel is already in flight. The run ends wherever it got to.',
  },
  'keep running': {
    title: 'Keep running',
    body: 'backs out of the cancel. Nothing was stopped and the run carries on.',
  },
  'notify me': {
    title: 'Notify me',
    body: 'sends one message to a chat space when this run finishes, so nobody has to sit and watch it.',
  },

  /* ── Reading a result ───────────────────────────────────────────────────────── */
  'download saved result': {
    title: 'Download saved result',
    body: 'the result file exactly as the run wrote it — not a re-export of the rows currently filtered on screen.',
  },
  'clear record search': {
    title: 'Clear record search',
    body: 'empties the box and puts every record back in the table. Nothing is re-run.',
  },
  all: {
    title: 'All',
    body: 'drops the rule filter, so every difference is listed again whichever rule found it.',
  },
  'expand run steps': {
    title: 'Expand run steps',
    body: 'shows each stage of the run and how it ended. A failed step explains a count below it better than the count does.',
  },
  'collapse run steps': {
    title: 'Collapse run steps',
    body: 'folds the timeline away. It keeps updating underneath while a run is still going.',
  },
  'expand rule selector': {
    title: 'Expand rule selector',
    body: 'lists the rules that found differences, so the table can be narrowed to one of them.',
  },
  'collapse rule selector': {
    title: 'Collapse rule selector',
    body: 'folds the list away. Whichever rule filter is on stays on.',
  },
  'more...': {
    title: 'More',
    body: 'fetches the next page of older results. Nothing already on screen is replaced.',
  },
  'loading…': {
    title: 'Loading',
    body: 'the next page is on its way. It will be added below what is already here.',
  },

  /* ── Editing a saved run ────────────────────────────────────────────────────── */
  'edit run': {
    title: 'Edit Run',
    body: 'changes the sources, schemas and primary IDs. Finished runs keep the setup they ran with; this affects the next one.',
  },
  'edit rules': {
    title: 'Edit Rules',
    body: 'opens the board where fields are paired and exclusions set. It takes effect from the next run, never on a finished one.',
  },
  'run settings': {
    title: 'Run settings',
    body: 'opens the saved run behind this history. Changing it changes what future runs compare and leaves every past one alone.',
  },
  'delete run': {
    title: 'Delete run',
    body: 'removes the saved setup for good. Results it already produced stay where they are; nothing new can be run from it.',
  },
  'view auth info for source 1': {
    title: 'Source 1 connection',
    body: 'shows which connection and endpoint this side pulls from. Read-only — nothing here changes the run.',
  },
  'view auth info for source 2': {
    title: 'Source 2 connection',
    body: 'the same for the other side. Read-only — nothing here changes the run.',
  },

  /* ── The rules board ────────────────────────────────────────────────────────── */
  'add pre-action': {
    title: 'Add pre-action',
    body: 'a step applied to both values before they are compared — trimming or lowercasing, so a cosmetic difference stops being one.',
  },
  'delete pre-action': {
    title: 'Delete pre-action',
    body: 'the values go back to being compared raw, so differences this was hiding will start being reported.',
  },
  'delete rule': {
    title: 'Delete rule',
    body: 'removes this pairing. Both fields stay on their sides; they simply stop being compared to each other.',
  },
  'delete exclusion': {
    title: 'Delete exclusion',
    body: 'the source stops filtering those records out at the pull, so they arrive and can start showing up as differences.',
  },
  operator: {
    title: 'Operator',
    body: 'what this rule does to the two values it was given. Equality is the default; the others exist for the cases it gets wrong.',
  },
  sequence: {
    title: 'Sequence',
    body: 'the order rules run in. It matters only where one rule’s pre-actions change what a later one sees.',
  },
  'pre actions': {
    title: 'Pre Actions',
    body: 'the steps applied to both values before this rule compares them. They change the comparison, never the stored record.',
  },

  /* ── The run window ─────────────────────────────────────────────────────────── */
  start: {
    title: 'Start',
    body: 'the first moment this run reaches back to. A record dated just before it looks missing even when both systems hold it.',
  },
  end: {
    title: 'End',
    body: 'the last moment it reaches. Anything after it is outside the run and cannot be compared, only missed.',
  },
  'show next month': {
    title: 'Show next month',
    body: 'moves the calendar only. The window does not change until you pick a day.',
  },
  'show previous month': {
    title: 'Show previous month',
    body: 'moves the calendar only. The window does not change until you pick a day.',
  },

  /* ── Automations ────────────────────────────────────────────────────────────── */
  'delete automation': {
    title: 'Delete automation',
    body: 'stops the schedule for good. Every run it already made is kept and stays readable.',
  },
  sync: {
    title: 'Sync',
    body: 'copies the saved run’s current setup into this automation. What it compares changes from the next run onward.',
  },
  'sync now': {
    title: 'Sync now',
    body: 'copies the saved run’s current setup into this automation. What it compares changes from the next run onward.',
  },
  'syncing…': {
    title: 'Syncing',
    body: 'the copy is in flight. The automation’s next run will use the new setup.',
  },
  'keep as is': {
    title: 'Keep as is',
    body: 'leaves this automation on the setup it was built with, even though the saved run behind it has moved on.',
  },

  /* ── Schemas ────────────────────────────────────────────────────────────────── */
  'create new schema': {
    title: 'Create New Schema',
    body: 'describes the shape of a source. A run can only compare fields that appear in one of these.',
  },
  'add field row': {
    title: 'Add field row',
    body: 'one more field this source is expected to carry. Nothing is saved until you save the schema.',
  },
  'remove field row': {
    title: 'Remove field row',
    body: 'takes the field out of the shape. Runs that pair it will stop being able to compare it.',
  },
  'delete schema': {
    title: 'Delete schema',
    body: 'removes it for the whole tenant. Any run pointing at it stops being able to compare.',
  },
  'download schema json': {
    title: 'Download schema JSON',
    body: 'the schema as stored, which is what to send someone when a source and a run disagree about a field.',
  },
  'retry loading schema': {
    title: 'Retry Loading Schema',
    body: 'asks the server again. It is a read — nothing you were editing is sent or lost.',
  },
  'add a config': {
    title: 'Add a config',
    body: 'a connection for this side to pull from. A run cannot name a source it has no config for.',
  },

  /* ── Connections and settings ───────────────────────────────────────────────── */
  'run connection diagnostics': {
    title: 'Run connection diagnostics',
    body: 'makes one real call to the system and reports exactly what came back. It reads only and changes nothing.',
  },
  'close diagnostics': {
    title: 'Close diagnostics',
    body: 'dismisses the report. The connection is left exactly as the test found it.',
  },
  'delete hotwax source': {
    title: 'Delete HotWax source',
    body: 'removes the connection. Runs and automations pointing at it will fail from their next run on.',
  },
  'delete shopify config': {
    title: 'Delete Shopify config',
    body: 'removes the connection. Runs and automations pointing at it will fail from their next run on.',
  },
  'show client id': {
    title: 'Show Client ID',
    body: 'reveals it on screen so it can be checked against NetSuite. It is not re-fetched and not changed.',
  },
  'hide client id': {
    title: 'Hide Client ID',
    body: 'masks it again. Nothing about the stored credential changes either way.',
  },
  'change password': {
    title: 'Change password',
    body: 'sets a new one for this account. Other sessions stay signed in until they expire on their own.',
  },
  timezone: {
    title: 'Timezone',
    body: 'how this tenant reads dates and times. Set it before the first automated run, or the team reads timestamps in the wrong zone.',
  },
  notifications: {
    title: 'Notifications',
    body: 'where this tenant sends run alerts. A chat space added here is what Notify me can then pick from.',
  },
  'no ai provider selected': {
    title: 'AI provider',
    body: 'which model answers Ask Darpan for this tenant. Nothing else on the product depends on it.',
  },
  '+ add tenant': {
    title: 'Add tenant',
    body: 'shares this config with another tenant. They can run against it; they cannot edit or delete it.',
  },
  undo: {
    title: 'undo',
    body: 'puts a tenant back before you save. Once saved, sharing it again means adding it from scratch.',
  },

  /* ── Saving, and the toggles that change what runs next ─────────────────────── */
  save: {
    title: 'Save',
    body: 'writes this to the tenant now. Other tabs pick it up on their next load rather than immediately.',
  },
  'save rule': {
    title: 'Save rule',
    body: 'the pairing applies from the next run onward. It does not re-grade a run that has already finished.',
  },
  'save exclusion': {
    title: 'Save exclusion',
    body: 'the source stops fetching those records from the next run. Finished runs keep whatever they compared.',
  },
  'save user settings': {
    title: 'Save user settings',
    body: 'writes your own preferences — zone, notifications — and touches nothing the rest of the tenant sees.',
  },
  'saving user settings': {
    title: 'Saving user settings',
    body: 'the write is in flight. Nothing else on the page is affected while it lands.',
  },
  'automation is running': {
    title: 'Automation is running',
    body: 'the schedule is live. Pausing it stops future runs only — everything it has already produced is kept.',
  },
  'automation is paused': {
    title: 'Automation is paused',
    body: 'no run will fire. Starting it again picks up from the next scheduled time; the ones it missed are not made up.',
  },
  /* ── Icon actions that navigate, so they are links rather than buttons ──────── */
  'open run': {
    title: 'Open run',
    body: 'the run wizard for this saved run, prefilled from it. Nothing is compared until you finish it and start the run.',
  },
  'view previous runs': {
    title: 'View previous runs',
    body: 'every execution of this saved run, newest first. Each one is a record of what was true when it went.',
  },
  'edit automation': {
    title: 'Edit automation',
    body: 'changes its schedule, window and saved run. It takes effect from the next fire and leaves finished runs alone.',
  },
  'back to automations': {
    title: 'Back to Automations',
    body: 'the list of every automation on this tenant. Nothing on this page is saved or discarded on the way.',
  },
  'open full config dashboard': {
    title: 'Open full config dashboard',
    body: 'the connection behind this side, with its endpoints and credentials. Changing it affects every run that uses it.',
  },
  'edit hotwax auth': {
    title: 'Edit HotWax Auth',
    body: 'the credentials this connection uses. Every run and automation pointing at it picks the change up on its next run.',
  },
  'edit shopify config': {
    title: 'Edit Shopify Config',
    body: 'the credentials and shop this connection uses. Every run pointing at it picks the change up on its next run.',
  },
  'back to hotwax settings': {
    title: 'Back to HotWax Settings',
    body: 'the list of HotWax connections. Nothing on this page is saved on the way out.',
  },
  'back to shopify settings': {
    title: 'Back to Shopify Settings',
    body: 'the list of Shopify connections. Nothing on this page is saved on the way out.',
  },

  /* ── The shell, and controls that appear on many pages ──────────────────────── */
  cancel: {
    title: 'Cancel',
    body: 'leaves without saving. Anything typed on this form is discarded, and nothing already saved is touched.',
  },
  back: {
    title: 'Back',
    body: 'returns to the previous step. What you entered on this one is kept for when you come forward again.',
  },
  close: {
    title: 'Close',
    body: 'dismisses this without keeping anything typed in it.',
  },
  next: {
    title: 'Next',
    body: 'the next page of this list. It changes what you are looking at, never the records themselves.',
  },
  previous: {
    title: 'Previous',
    body: 'the page before this one. It changes what you are looking at, never the records themselves.',
  },
  'sign in': {
    title: 'Sign In',
    body: 'the tenant you were last using becomes active again — in every tab, because the active tenant is a server-side preference.',
  },
  'preview in darpan': {
    title: 'Preview in Darpan',
    body: 'shows what this surface will look like when it is built. Nothing here is live yet.',
  },
  'hide preview': {
    title: 'Hide Preview',
    body: 'folds the preview away. It was never live, so nothing is lost.',
  },
})

/**
 * Controls whose name the product builds out of live data — a file name, a chip value, a
 * rule number. No fixed key can match, and the varying half is always the tenant's own
 * record rather than vocabulary, so the answer deliberately ignores it.
 *
 * Kept short on purpose: a pattern that fires on something it did not mean is the
 * confident wrong answer the exact registry exists to avoid.
 */
const ACTION_PATTERNS: readonly (readonly [RegExp, ActionEntry])[] = Object.freeze([
  [/^download .+$/, {
    title: 'Download',
    body: 'the source file as the run received it. Useful for checking a record by hand that the run reported as missing.',
  }],
  [/^remove .+$/, {
    title: 'Remove',
    body: 'takes this one off the list. Nothing changes for anybody else until the form is saved.',
  }],
  [/^edit rule .+$/, {
    title: 'Edit rule',
    body: 'opens this pairing’s operator, sequence and pre-actions. It applies from the next run, never to a finished one.',
  }],
  [/^notifying — .+$/, {
    title: 'Notifying',
    body: 'this run will message that chat space when it finishes. Pressing it again stops the message, not the run.',
  }],
  [/^(expand|collapse) .+ (object|array)$/, {
    title: 'Expand',
    body: 'opens this branch of the record. It is the value the run actually compared, not a re-formatting of it.',
  }],
] as const)

export function lookupAction(name: string | null | undefined): ActionEntry | null {
  if (!name) return null
  const direct = MASCOT_ACTIONS[name]
  if (direct) return direct
  for (const [pattern, entry] of ACTION_PATTERNS) if (pattern.test(name)) return entry
  return null
}
