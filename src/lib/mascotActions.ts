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
import { dataAction, editFor } from './mascotContentState'

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
  'retrying…': {
    title: 'Retrying',
    body: 'the retry is already on its way. The page catches up when the run lands, so there is nothing more to press.',
  },
  'clear record search': {
    title: 'Clear record search',
    body: 'empties the box and puts every record back in the table. Nothing is re-run.',
  },

  /* ── Conclusions (DAR-UI-044) ───────────────────────────────────────────────── */
  'show evidence': {
    title: 'Show evidence',
    body: 'opens what each system held for this record and the checks that named it — as the run saw them, not as they stand now.',
  },
  'hide evidence': {
    title: 'Hide evidence',
    body: 'folds it away. Only one row opens at a time, so opening another would have closed this one anyway.',
  },
  'stop flagging in rules board ›': {
    title: 'Stop flagging in rules board',
    body: 'opens the rules board with the exclusion already filled in. Nothing changes until you apply it there, and only future runs skip these.',
  },
  'keep flagging': {
    title: 'Keep flagging',
    body: 'hides the question for now and records nothing. The same findings, and the same question, come back on the next run.',
  },
  'raw record ›': {
    title: 'Raw record',
    body: 'the record exactly as the run extracted it — the ground truth under the conclusion, useful when the conclusion itself looks wrong.',
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
  // DAR-UI-043. Home's family sections cap at six tiles and label the rest "3 more", so the
  // button name varies with the count and lands here as the bare word. Different act from
  // "More..." above: nothing is fetched, the group simply stops hiding its own runs.
  more: {
    title: 'More',
    body: 'shows the rest of the runs in this group. They were already loaded, just folded away.',
  },
  'loading…': {
    title: 'Loading',
    body: 'the next page is on its way. It will be added below what is already here.',
  },

  /* ── Editing a saved run ────────────────────────────────────────────────────── */
  // DAR-UI-128: the Ruleset manager's pairing fact opens run setup; each section's pencil opens the rules board.
  'edit run setup': {
    title: 'Edit run setup',
    body: 'changes the sources, schemas and primary IDs. Finished runs keep the setup they ran with; this affects the next one.',
  },
  'edit rules': {
    title: 'Edit rules',
    body: 'opens the board where fields are paired and exclusions set. It takes effect from the next run, never on a finished one.',
  },
  'edit filters': {
    title: 'Edit filters',
    body: 'opens the rules board; double-click a field there to set what its source leaves out as it pulls. From the next run on.',
  },
  'run settings': {
    title: 'Run settings',
    body: 'opens the saved run behind this history. Changing it changes what future runs compare and leaves every past one alone.',
  },
  // DAR-UI-063. An audit's own play and gear, beside its name.
  'run audit': {
    title: 'Run audit',
    body: 'asks which days, then runs every check of this audit over them. Findings land as each check finishes; nothing waits for the morning run.',
  },
  // DAR-UI-064. The audit authoring editors.
  // DAR-UI-138: the query page's Data step and its popup.
  'add data': {
    title: 'Add data',
    body: 'opens Data to add one more read. The script gets it as another input, and nothing is saved until you save.',
  },
  'read as json': {
    title: 'Read as JSON',
    body: 'shows the read as the JSON it is saved as. An edit there changes the same read the sentence above shows.',
  },
  'add a condition': {
    title: 'Add a condition',
    body: 'adds one more line under Only. Every line must hold, so each one leaves fewer rows for the script.',
  },
  'closed findings too': {
    title: 'Closed findings too',
    body: 'reads findings already closed as well as open ones. Off, the read keeps only the findings still open.',
  },
  'add statement': {
    title: 'Add statement',
    body: 'links this check to one more statement. One run often proves several: returns against credit memos covers R4, R7 and R8 at once.',
  },
  'money': {
    title: 'Money',
    body: 'say the expected and actual amounts are money, in which currency, and where each comes from. Findings then show the difference to the cent.',
  },
  'new conclusion': {
    title: 'New conclusion',
    body: 'a new top-level answer, tried after the ones above it. Pick which rows it applies to, then the conditions that prove it.',
  },
  'new conclusion code': {
    title: 'New conclusion code',
    body: 'names a new answer for your findings, e.g. \'RMA still open\'. It is yours alone: no other company sees it.',
  },
  'add conclusion code': {
    title: 'Add conclusion code',
    body: 'makes the code now and picks it here. The conclusion itself keeps it only once you save.',
  },
  'done with this line': {
    title: 'Done with this line',
    body: 'closes the edit row and reads the line as a sentence. Nothing is saved until Save conclusions.',
  },
  'delete conclusion': {
    title: 'Delete conclusion',
    body: 'takes it off the list. Once you save, rows it named fall to the conclusions below it, or to Unexplained.',
  },
  // DAR-UI-135: the conclusions edit page.
  'edit conclusions': {
    title: 'Edit conclusions',
    body: 'opens the conclusions page: add, reorder and change what each row is concluded to be. Kept with Save conclusions, and applies from the next run.',
  },
  'set up conclusions': {
    title: 'Set up conclusions',
    body: 'opens the conclusions page to name what each finding of this run is. Until then every finding shows as Unexplained. Applies from the next run.',
  },
  'add conclusion': {
    title: 'Add conclusion',
    body: 'a new one at the bottom, tried after those above it. It opens with its first line ready to fill.',
  },
  'add a line': {
    title: 'Add a line',
    body: 'one more condition for this conclusion. Every line must hold before it names a row.',
  },
  'move conclusion up': {
    title: 'Move up',
    body: 'tries this conclusion one place sooner. First match wins, so it can take rows from the one above. Kept with Save conclusions.',
  },
  'move conclusion down': {
    title: 'Move down',
    body: 'tries this conclusion one place later, so the one below gets the first chance at rows both fit. Kept with Save conclusions.',
  },
  'open conclusion unexplained': {
    title: 'Unexplained',
    body: 'what a finding no conclusion names shows as: Shown, or Expected. It always comes last and cannot be moved or deleted.',
  },
  'save conclusions': {
    title: 'Save conclusions',
    body: 'sends the whole list at once: every conclusion, its place and Unexplained. One refusal and nothing changes. Applies from the next run.',
  },
  'cancel changes': {
    title: 'Cancel changes',
    body: 'puts the list back as it was last saved. You stay here; nothing saved is touched.',
  },
  'back to the run': {
    title: 'Back to the run',
    body: 'returns to the run page. With changes waiting it asks first, and leaving drops them.',
  },
  'add child conclusion': {
    title: 'Add child conclusion',
    body: 'refines a conclusion once it holds: a cancelled return with an open RMA, and then whether that RMA is still waiting for its receipt. Three levels deep at most.',
  },
  'add condition': {
    title: 'Add condition',
    body: 'every condition of a conclusion must hold. Say what it checks in words: that line is what a finding shows as its proof.',
  },
  'add match rule': {
    title: 'Add match rule',
    body: 'narrows the query inside NetSuite, so only the records you mean ever leave it. A wrong value does not fail; it reads a different population, so preview first.',
  },
  'add column': {
    title: 'Add column',
    body: 'one field of each record: a column, one function with a name (ABS(foreigntotal) AS amount), or a macro like ACCOUNT_USED(42065).',
  },
  'preview': {
    title: 'Preview',
    body: 'runs the query against NetSuite for one day and shows the first rows and the exact SQL. Nothing is saved; it is how a typo shows before it becomes a run.',
  },
  'add check': {
    title: 'Add check',
    body: 'ties a run to this statement: which of its rows break it, who fixes them and where. The audit schedules the run on its next play.',
  },
  'audit settings': {
    title: 'Audit settings',
    body: 'the name, the daily schedule all its checks share, and each statement in its own words. A statement turned off drops out and stops raising findings.',
  },
  // DAR-UI-078. Making an audit in the app.
  'new statement': {
    title: 'New statement',
    body: 'one more thing this audit must find true, in your words. Saving codes it the next R number; it raises nothing until a check is added to it.',
  },
  'save check': {
    title: 'Save check',
    body: 'adds the check to the statements it names, then goes back to this one. The audit schedules its run on the next play.',
  },
  'create audit': {
    title: 'Create audit',
    body: 'makes the audit with no statements yet and opens its settings, where statements and their checks go. Nothing runs until a check is added.',
  },
  // DAR-UI-063. The audit settings page.
  'daily schedule': {
    title: 'Daily schedule',
    body: 'pauses or resumes every check of this audit, saved on the click. A paused check keeps its findings; it just stops looking for new ones.',
  },
  // DAR-UI-127.
  'back to the audit': {
    title: 'Back to the audit',
    body: 'its report, on the morning it was showing. Every change here was saved as it was made, so nothing is left behind.',
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
  'delete filter': {
    title: 'Delete filter',
    body: 'the source stops filtering at the pull, so every record it was holding back arrives and can start showing up as differences.',
  },
  // Keyed on the words themselves rather than on a control name, because the same two phrases
  // appear in three places: the mode dropdown's trigger, its options, and the sr-only text on a
  // pill that already carries a filter. One answer serves all three.
  'next ›': {
    title: 'Next',
    body: 'moves to the next thing standing. It does not answer this one — the warning you are on is still there when you come back round.',
  },
  'exclude these values': {
    title: 'Exclude these values',
    body: 'the source leaves out records whose value is one you listed. A record carrying no value for this field is kept.',
  },
  'excludes values': {
    title: 'Excludes values',
    body: 'the source leaves out records whose value is one you listed. A record carrying no value for this field is kept.',
  },
  'only these values': {
    title: 'Only these values',
    body: 'the source keeps records whose value is one you listed and drops the rest — including any record carrying no value for this field at all.',
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

  /* ── The run flowchart (DAR-UI-048) ─────────────────────────────────────────── */
  'run chart': {
    title: 'Run chart',
    body: 'starts every question over the window beside it, parent first. Each question is still its own rule run, with its own result.',
  },
  'add question': {
    title: 'Add question',
    body: 'puts a question at the top of the chart. It asks about every record its rule fetches, not only the ones another question passed.',
  },
  'add next question': {
    title: 'Add next question',
    body: 'opens a question that sees only the records this one answered yes for. Nothing already saved changes.',
  },
  'ask why': {
    title: 'Ask why',
    body: 'explains a finding: the new question sees only the records this one answered no for. The finding keeps its count.',
  },
  'save question': {
    title: 'Save question',
    body: 'keeps it in the chart. The next run asks it; runs that already finished are not re-asked.',
  },
  'close question editor': {
    title: 'Close',
    body: 'leaves the question as it was saved. Anything typed since is dropped.',
  },
  'back to run': {
    title: 'Back to the run',
    body: 'returns to this lifecycle’s page: its most recent result and the ones before. This result stays where it is.',
  },
  'back to home': {
    title: 'Back to Home',
    body: 'returns to every saved run, Sync and Lifecycle alike. A run in progress keeps going; its questions finish without this page.',
  },
  'import netsuite checks': {
    title: 'Import NetSuite Checks',
    body: 'turns each NetSuite check not yet in a Lifecycle run into a question under a start that lists its records. Safe to repeat.',
  },
  'add filter': {
    title: 'Add filter',
    body: 'leaves some of the starting records out of the whole lifecycle, by a field NetSuite holds on them. A left-out record is in no place at all.',
  },
  'add this filter': {
    title: 'Add',
    body: 'puts the filter on the line. Nothing is saved until Save; the next run is the first to use it.',
  },
  'add this exception': {
    title: 'Add',
    body: 'puts the exception on the gap into this stage. Nothing is saved until Save; the next run is the first to use it.',
  },
  'stop editing': {
    title: 'Stop editing',
    body: 'closes the row and leaves the line as it read. Rules already on the line stay as they are.',
  },
  'change this filter': {
    title: 'Change',
    body: 'puts the changed filter back on its line. Nothing is saved until Save; the next run is the first to use it.',
  },
  'change this exception': {
    title: 'Change',
    body: 'puts the changed exception back on its line. Nothing is saved until Save; the next run is the first to use it.',
  },
  'add finding': {
    title: 'Add finding',
    body: 'flags records that reached this stage and whose field matches, like Items Backordered more than 0. It is a finding of its own, beside where records stop.',
  },
  'add this finding': {
    title: 'Add',
    body: 'puts the finding under the stage. Nothing is saved until Save; the next run is the first to ask it.',
  },
  'show a field': {
    title: 'Show a field',
    body: 'adds a field NetSuite holds, like HC Order Id or eTail Order Id, to every record this lifecycle finds, beside its order, date, status, customer, total, shipping method and reference.',
  },
  'show this field': {
    title: 'Add',
    body: 'puts the field on the line. Records found by the next run show it; runs already made keep what they showed.',
  },
  'add exception': {
    title: 'Add exception',
    body: 'says a stage is not expected of some records: Store Pickup orders never ship, so they count as past Fulfillment rather than stuck before it.',
  },
  'add rule': {
    title: 'Add Rule',
    body: 'leaves records out by a field NetSuite holds on them, a sales channel say, picked from what the account actually has.',
  },
  'delete question': {
    title: 'Delete question',
    body: 'takes it off the chart. Its rule and its past results stay. A question with questions under it has to lose those first.',
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
  dismiss: {
    title: 'Dismiss',
    body: 'quiets the warning for this visit only. Nothing is fixed and nothing is remembered — it comes back next time the page loads.',
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

  /* ── Audits (DAR-UI-094) ────────────────────────────────────────────────────── */
  'retry from last read': {
    title: 'Retry from last read',
    body: 'runs this check again from what its last read already fetched, so no system is read twice. The rest of the audit stays as it is.',
  },
  'resolve finding': {
    title: 'Resolve finding',
    body: 'checks this one record again now, in the background. If the systems agree it closes; if not it stays open, and the pill at the top says which.',
  },
  'export finding': {
    title: 'Export finding',
    body: 'downloads this finding as JSON with its records. For an order, every line comes with it and the stuck line in full.',
  },
  'export findings': {
    title: 'Export findings',
    body: 'downloads every finding under this statement for the period as JSON, with more ids and fields than the board shows.',
  },
  'export report': {
    title: 'Export report',
    body: 'downloads this day’s whole audit as JSON: every statement, check and finding. The page shows a slice of it.',
  },

  /* ── Queries (DAR-BE-334; were DAR-BE-164/167 scripts, DAR-UI-124's pages) ─────────── */
  'preview send': {
    title: 'Preview send',
    body: 'runs the saved query and schedule now and shows what it would send. No email or chat message goes out, and unsaved edits are left out.',
  },
  'send now': {
    title: 'Send now',
    body: 'delivers this answer to its addresses and chat space once, now. Only the schedule’s owner can; the schedule is unchanged, and there is no unsend.',
  },
  'confirm delete': {
    title: 'Confirm delete',
    body: 'removes it for good. There is no undo and no copy kept.',
  },
  'new query': {
    title: 'New query',
    body: 'a fresh query on its own page, starting from a read of an audit’s findings. Nothing is kept until you press Save.',
  },
  run: {
    title: 'Run',
    body: 'runs the read and script as written, unsaved edits included, on your data now, and adds the result under Runs. Nothing is saved or sent.',
  },
  'running…': {
    title: 'Running',
    body: 'it is already going. The page shows what came back when it finishes; pressing again does nothing.',
  },
  script: {
    title: 'Script',
    body: 'shows the JEXL that turns what the read returned into a summary and files. The line a run failed on is marked.',
  },
  read: {
    title: 'Read',
    body: 'shows the query’s read as JSON: which source, which fields, and the filters and window. Its words are above the tabs.',
  },
  ask: {
    title: 'Ask',
    body: 'hands your question to the agent. It writes a query from what your audits keep, runs it, and puts it on this page for you to check and save.',
  },
  'ask for a query': {
    title: 'Ask',
    body: 'say what you want to know about your data, in your own words. A field no audit keeps cannot be read, and the agent says so.',
  },
  'open queries': {
    title: 'Queries',
    body: 'this tenant’s queries: each reads what your audits keep and can send its answer by email or chat on a schedule.',
  },
  'on schedule': {
    title: 'On schedule',
    body: 'whether the query runs by itself at its time and sends. It is kept with Save; with no schedule set up it stays off.',
  },
  'on schedule: set up a schedule first': {
    title: 'On schedule',
    body: 'there is no schedule yet to turn on. Open Schedule to set the time and where it sends, then turn it on.',
  },
  'put back my version': {
    title: 'Put back my version',
    body: 'returns the read and script to what you had before the agent’s proposal. The agent’s run stays under Runs.',
  },
  'on schedule: scheduling needs tenant admin': {
    title: 'On schedule',
    body: 'a schedule sends the tenant’s data out, so only a tenant admin can turn one on or change it. You can still run and save the query.',
  },
  'back to queries': {
    title: 'Back to Queries',
    body: 'the list of this tenant’s queries. Unsaved edits here are dropped on the way out.',
  },
  'delete query': {
    title: 'Delete query',
    body: 'asks first. A deleted query stops its schedule and leaves the Notifications grid; there is no undo.',
  },

  /* ── Peak periods (DAR-BE-328) ──────────────────────────────────────────────── */
  'open peak periods': {
    title: 'Peak periods',
    body: 'this tenant’s busy windows, each with the runs it moves and the hours runs wait for.',
  },
  'set up peak periods': {
    title: 'Set up peak periods',
    body: 'the list of busy windows, empty for now. Add one to move runs or keep them out of peak hours.',
  },
  'add peak period': {
    title: 'Add peak period',
    body: 'a new period on its own page. No run changes until it has dates and is saved.',
  },
  'back to peak periods': {
    title: 'Back to peak periods',
    body: 'the list of this tenant’s peak periods. Unsaved edits here are dropped on the way out.',
  },
  'peak period on': {
    title: 'Peak period on',
    body: 'whether this period moves and holds runs at all. Off, every run keeps its normal time. Kept with Save.',
  },
  'save peak period': {
    title: 'Save peak period',
    body: 'keeps the name, dates, peak hours and on/off for the whole tenant. Scheduled runs follow it from then on.',
  },
  'delete peak period': {
    title: 'Delete peak period',
    body: 'asks first. Its run times go with it and every run goes back to its normal time; there is no undo.',
  },
  'move another run': {
    title: 'Move another run',
    body: 'opens a new run time: one automation or audit starts at another time on one day of the peak, or every day.',
  },
  'save run time': {
    title: 'Save run time',
    body: 'keeps this move now, without the page’s Save. A time inside peak hours still waits for them to end.',
  },
  'delete run time': {
    title: 'Delete run time',
    body: 'removes this move now, without the page’s Save. The run starts at its normal time on those days.',
  },
  'clear peak hours': {
    title: 'Clear peak hours',
    body: 'empties both times. Saved like that, the period has no peak hours and no run waits for them.',
  },

  /* ── Sync pulse (DAR-BE-328) ────────────────────────────────────────────────── */
  'open sync pulse': {
    title: 'Sync pulse',
    body: 'this tenant’s sync pairs, each watching one daily check’s orders for ones that wait too long between systems.',
  },
  'set up sync pulse': {
    title: 'Set up sync pulse',
    body: 'the list of sync pairs, empty for now. Add one to watch a daily check’s orders between its runs.',
  },
  'add sync pair': {
    title: 'Add sync pair',
    body: 'a new pair on its own page. Nothing is watched until it has a run, an upstream side and is saved.',
  },
  'back to sync pulse': {
    title: 'Back to sync pulse',
    body: 'the list of this tenant’s sync pairs. Unsaved edits here are dropped on the way out.',
  },
  'sync pulse on': {
    title: 'Sync pulse on',
    body: 'whether this pair pulses at all. Off, nothing is read or posted. Kept with Save.',
  },
  'save sync pair': {
    title: 'Save sync pair',
    body: 'keeps the pulse, the allowance and on/off for this pair. The next pulse follows them.',
  },
  'delete sync pair': {
    title: 'Delete sync pair',
    body: 'asks first. Its pulses and the orders it was watching go with it; there is no undo.',
  },
  'hourly summary': {
    title: 'Hourly summary',
    body: 'whether the chat space gets a short card each hour with what is waiting. Kept with Save.',
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
  'delete netsuite auth profile': {
    title: 'Delete NetSuite auth profile',
    body: 'removes the profile, but only once nothing signs in with it. Anything still using it is named, and nothing is touched.',
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
  // DAR-UI-121: User Settings, profile first.
  'rename display name': {
    title: 'Rename',
    body: 'puts the caret in your name. Enter or clicking away saves it, Esc keeps the old one; your username and sign-in stay as they are.',
  },
  'switch tenant': {
    title: 'Switch',
    body: 'opens Ask Darpan already at /switch-tenant. A company picked there moves every open tab with it; no data in either company changes.',
  },
  'change timezone': {
    title: 'Change',
    body: 'picks the zone times show in, for you alone. Cleared, it falls back to the tenant\u2019s zone, then this browser\u2019s; stored times never move.',
  },
  'change notifications': {
    title: 'Change',
    body: 'picks the chat space your own notifications go to. The tenant\u2019s spaces and everyone else\u2019s choice stay as they are.',
  },
  'manage passkeys': {
    title: 'Manage',
    body: 'lists your passkeys to rename or remove. A name needs no proof; removing one asks for a current code or passkey first.',
  },
  // DAR-UI-120: the sign-in page's passkey links.
  'use a passkey or security key': {
    title: 'Use a passkey or security key',
    body: 'opens the browser prompt for this username: this device, your phone or a key you plug in. Your password is not sent.',
  },
  'use password instead': {
    title: 'Use password instead',
    body: 'asks for your password this time. Your passkey stays registered, but this browser leads with the password until a passkey signs you in here again.',
  },
  // DAR-UI-132: the first card on a browser that kept an account, and the offer after a password sign-in.
  // The Welcome back row, named by what it does; the account it signs in as is its description.
  'sign in with your passkey': {
    title: 'Sign in',
    body: 'opens the passkey sheet for this account. If the passkey is not on this device any more, the password step follows.',
  },
  'sign in with your password': {
    title: 'Sign in',
    body: 'asks for this account\'s password. A passkey used here later, to sign in or approve the CLI, makes this browser lead with it.',
  },
  'another account': {
    title: 'Another account',
    body: 'asks for a username instead. The account shown stays on this browser until someone else signs in here.',
  },
  'add passkey': {
    title: 'Add passkey',
    body: 'saves a passkey on this device, so next time Touch ID or your screen lock signs you in with no password or code.',
  },
  'not now': {
    title: 'Not now',
    body: 'skips this question for this sign-in only. Darpan asks again the next time you sign in.',
  },
  'forgot password?': {
    title: 'Forgot password?',
    body: 'asks who you are, then emails a one-time code to the address on your account. With no email on file there is nowhere to send it.',
  },
  'send a new code': {
    title: 'Send a new code',
    body: 'only the newest code works, so codes in older emails stop counting. Sends are capped each hour, so check spam before asking again.',
  },
  // DAR-UI-129: the recovery email's pencil and plus.
  'change recovery email': {
    title: 'Change recovery email',
    body: 'replaces the address password reset codes go to. Until the new address saves, codes keep going to the old one.',
  },
  'add recovery email': {
    title: 'Add recovery email',
    body: 'sets the address password reset codes go to. Nothing changes until it saves.',
  },
  'keep a version now': {
    title: 'Keep a version now',
    body: 'saves this tenant’s whole audit setup as it stands, so a later edit can be rolled back to exactly this point.',
  },
  // DAR-UI-122: Tenant Settings rows. Pages say Open; popups say Add, Edit or Change.
  'open notifications': {
    title: 'Notifications',
    body: 'opens every space and what posts to each: streaks, audit updates, automations, scripts. A dot moved there takes effect on the click.',
  },
  'open config history': {
    title: 'Config history',
    body: 'opens the kept versions of this tenant’s audit setup. Restoring one puts the live setup back to that point.',
  },
  'change tenant timezone': {
    title: 'Change',
    body: 'how this tenant reads dates and times. Set it before the first automated run, or the team reads timestamps in the wrong zone.',
  },
  // DAR-UI-123: the Notifications page.
  'add space': {
    title: 'Add space',
    body: 'a Slack channel or a Google Chat space, then which things move there. Nothing posts to it until something is moved.',
  },
  'reconnect slack': {
    title: 'Reconnect',
    body: 'authorises Darpan in Slack again, as when it was first connected. Every Slack space keeps its channel.',
  },
  'replace slack token': {
    title: 'Replace token',
    body: 'swaps in a rotated xoxb- token. Slack checks it before it saves; every Slack space keeps its channel.',
  },
  'disconnect slack': {
    title: 'Disconnect',
    body: 'drops the workspace now. Its spaces stay on the grid but post nothing until a workspace is connected again.',
  },
  'edit ai provider': {
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
  'save filter': {
    title: 'Save filter',
    body: 'the source changes what it fetches from the next run. Finished runs keep whatever they compared.',
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
  'edit netsuite auth': {
    title: 'Edit NetSuite Auth',
    body: 'the credentials this auth profile signs in with. Every run pointing at it picks the change up on its next run.',
  },
  'back to netsuite settings': {
    title: 'Back to NetSuite Settings',
    body: 'the NetSuite auth profiles and endpoints. Nothing on this page is saved on the way out.',
  },
  'back to hotwax settings': {
    title: 'Back to HotWax Settings',
    body: 'the list of HotWax connections. Nothing on this page is saved on the way out.',
  },
  'back to shopify settings': {
    title: 'Back to Shopify Settings',
    body: 'the list of Shopify connections. Nothing on this page is saved on the way out.',
  },
  'back to tenant settings': {
    title: 'Back to Tenant Settings',
    body: 'chat, time, audit and AI settings for this tenant. Nothing on this page is saved or discarded on the way.',
  },
  'back to run editor': {
    title: 'Back to Run Editor',
    body: 'the list of saved runs on this tenant. Nothing here is saved on the way out, and the run it was showing is not discarded either.',
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
    body: 'the tenant you last switched to opens first. After that, each tab keeps its own.',
  },
  'preview in darpan': {
    title: 'Preview in Darpan',
    body: 'shows what this surface will look like when it is built. Nothing here is live yet.',
  },
  'hide preview': {
    title: 'Hide Preview',
    body: 'folds the preview away. It was never live, so nothing is lost.',
  },

  /* ── CLI sign-in (DAR-UI-103) ───────────────────────────────────────────────── */
  'continue with this code': {
    title: 'Continue',
    body: 'looks the code up and shows which computer asked, before anything is approved. An expired or mistyped code is simply not found.',
  },
  'approve cli sign-in': {
    title: 'Approve',
    body: 'lets that terminal act as you, with your permissions in each tenant, for 7 or 30 days by your role there. Only for a code you just started.',
  },
  'deny cli sign-in': {
    title: 'Deny',
    body: 'refuses this one request; that terminal gets nothing and has to run darpan login again. CLIs you already approved keep working.',
  },

  /* ── Two-factor (DAR-BE-264) and passkeys (DAR-BE-270) ─────────────────────── */
  'use a passkey': {
    title: 'Use a passkey',
    body: 'answers with your fingerprint, face, phone or security key instead of six digits. Closing the browser prompt changes nothing; try again or go back to the code.',
  },
  'add a passkey': {
    title: 'Add a passkey',
    body: 'registers this device or a security key. A first passkey turns two-factor on and ends your other sessions and CLI sign-ins.',
  },
  'use a recovery code': {
    title: 'Use a recovery code',
    body: 'signs in with one of the codes you saved. That code stops working the moment it is used, so make new ones when few are left.',
  },
  'use the app code': {
    title: 'Use the app code',
    body: 'answers with the six digits from your authenticator app instead. Switching uses nothing up; your passkeys stay registered.',
  },
  'copy': {
    title: 'Copy',
    body: 'puts it on your clipboard. Darpan never shows it again, so paste it somewhere safe now.',
  },
  'download': {
    title: 'Download',
    body: 'saves the recovery codes as a text file. Each code signs in as you once, so keep the file like a password.',
  },
  'set up': {
    title: 'Set up',
    body: 'turns on codes from an authenticator app. Your other sessions and CLI sign-ins end once its first code is confirmed.',
  },
  'new app': {
    title: 'New app',
    body: 'moves two-factor to another phone or app. The old app\u2019s codes stop working the moment the new one is confirmed.',
  },
  'turn off': {
    title: 'Turn off',
    body: 'removes the authenticator app. With a passkey left nothing else changes; with none, two-factor goes off and your other sessions and CLI sign-ins end.',
  },
  'new codes': {
    title: 'New codes',
    body: 'makes ten fresh recovery codes. Every code from the old set stops working at once.',
  },

  /* ── Wrapper buttons the sweep could not see until DAR-UI-103 ───────────────── */
  'save refined fields': {
    title: 'Save refined fields',
    body: 'replaces this schema’s field list for the whole tenant. Source files are checked against it from the next run; finished runs are not re-checked.',
  },
  'after each run': {
    title: 'After each run',
    body: 'whether the email to everyone with access, plus the extra addresses, and the chat space’s card go out when each audit run finishes. It takes effect on save.',
  },
  'save query': {
    title: 'Save query',
    body: 'checks the read and script and keeps them, with the schedule, for the whole tenant. The schedule runs the saved version; an unsaved edit never runs on schedule.',
  },

  /* ── The audit's agent (DAR-UI-104/105) ─────────────────────────────────────── */
  agent: {
    title: 'Agent',
    body: 'opens the conversation about what is picked on the board: the finding, else the audit. Changes it drafts wait as cards until someone with edit access approves them.',
  },
  'send to agent': {
    title: 'Send to agent',
    body: 'your words go to the agent with the finding open here. Keys, emails and phones are masked first; a message alone never changes the audit.',
  },
  'approve change': {
    title: 'Approve change',
    body: 'applies exactly the plan on this card. If the audit moved since it was planned, nothing is written and the card shows the new plan instead.',
  },
  'reject change': {
    title: 'Reject change',
    body: 'closes this draft for good; it can never be applied. The audit is untouched, and the agent can still draft a different one.',
  },
  'revert change': {
    title: 'Revert change',
    body: 'drafts the undo of this applied change as a new card. Nothing goes back until someone approves that card.',
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
export const ACTION_PATTERNS: readonly (readonly [RegExp, ActionEntry])[] = Object.freeze([
  // "Revoke <host>": the CLI session list names each button by the computer it signed in from.
  // "Request access in <tenant>": the tenant is data, the request is the same everywhere.
  // The tenant is optional for the same reason as retry's count: the coverage sweep reads the template with the hole removed.
  [/^request access in( .+)?$/, {
    title: 'Request access',
    body: 'asks a Darpan admin to turn the CLI on for you in this tenant, with your reason attached. Nothing changes until one of them approves it.',
  }],
  // DAR-UI-140: Audit settings priority cells, named "<statement code> priority: <level>" and "<reason> priority: <level or Same as code>".
  [/^r\d+ priority: .+$/, {
    title: 'Statement priority',
    body: 'decides where this statement\u2019s findings sit on the board\u2019s Priority view; P0 and P1 open on their own hints. Its reasons follow unless they set their own.',
  }],
  [/^.+ priority: .+$/, {
    title: 'Reason priority',
    body: 'this reason\u2019s own level overrides the statement\u2019s for findings with this cause. Same as puts it back to following the statement.',
  }],
  [/^revoke .+$/, {
    title: 'Revoke',
    body: 'signs that computer’s CLI out now. Its next command is refused until someone runs darpan login there and approves a new code.',
  }],
  [/^download .+$/, {
    title: 'Download',
    body: 'the source file as the run received it. Useful for checking a record by hand that the run reported as missing.',
  }],
  // "Remove passkey <name>": before the general remove, which describes an unsaved form.
  [/^remove passkey( .+)?$/, {
    title: 'Remove passkey',
    body: 'ends it now; it stops signing you in. Your last way in stays while your role requires two-factor.',
  }],
  [/^remove .+$/, {
    title: 'Remove',
    body: 'takes this one off the list. Nothing changes for anybody else until the form is saved.',
  }],
  [/^move .+ (up|down)$/, {
    title: 'Move stage',
    body: 'changes the order records should reach the stages in. Saving rebuilds the checks; past runs keep the order they ran with.',
  }],
  [/^change (rule|exception) .+$/, {
    title: 'Change',
    body: 'opens this line where it stands, as the field and value it says. Nothing is saved until Save.',
  }],
  [/^.+ is a finding$/, {
    title: 'Finding',
    body: 'says whether this place\u2019s records count toward Findings. A place that is not a finding still shows its records, quietly.',
  }],
  [/^check statement .+$/, {
    title: 'Statement',
    body: 'off leaves the statement out of the audit from its next run. Its findings so far stay on record.',
  }],
  [/^open rules for .+$/, {
    title: 'Open rules',
    body: 'goes to the run this check reads. A rule changed there changes this check from its next run, and every other check on that run.',
  }],
  [/^stop showing .+$/, {
    title: 'Stop showing',
    body: 'takes this field off what each record shows. Records from runs already made keep it.',
  }],
  // "Edit chat space <name>": each Notifications column names its space (DAR-UI-123).
  [/^edit chat space( .+)?$/, {
    title: 'Edit',
    body: 'renames this space, replaces its webhook, switches it off, or deletes it once nothing uses it. Messages already sent stay.',
  }],
  // "Send test to <space>" and "Post <thing> in <space>" / "Post <thing> nowhere": the Notifications grid (DAR-UI-123).
  [/^send test to( .+)?$/, {
    title: 'Send test',
    body: 'posts one short line to this space now, to show it arrives. It carries nothing from your runs.',
  }],
  [/^post .+ (in .+|nowhere)$/, {
    title: 'Where it posts',
    body: 'moves this one thing there, from its next post. Each row posts to one place, so its old dot clears; other rows stay.',
  }],
  [/^edit rule .+$/, {
    title: 'Edit rule',
    body: 'opens this pairing’s operator, sequence and pre-actions. It applies from the next run, never to a finished one.',
  }],
  [/^notifying — .+$/, {
    title: 'Notifying',
    body: 'this run will message that chat space when it finishes. Pressing it again stops the message, not the run.',
  }],
  // The count is live ("Retry 3 not run"); the template sweep reads it with the count gone.
  [/^retry (\d+ )?not run$/, {
    title: 'Retry not run',
    body: 'goes again for each check that did not run, one after another, from what its last read already fetched. Checks that ran are left alone.',
  }],
  // DAR-UI-124, DAR-BE-334: each Queries row names its query ("Open query <name>"); the query page's facts name their value.
  [/^open query .+$/, {
    title: 'Open',
    body: 'this query’s own page: what it reads, its script, its schedule and its runs.',
  }],
  [/^schedule: .+$/, {
    title: 'Schedule',
    body: 'sets the time it runs each day, in the tenant’s zone, and where it sends. Only a tenant admin can change it. Kept with Save.',
  }],
  [/^sends to: .+$/, {
    title: 'Sends to',
    body: 'picks the email addresses and chat space its answer goes to, with the time it runs. Kept with Save.',
  }],
  // DAR-BE-328: each Peak periods row names its period ("Open peak period <name>").
  [/^open peak period .+$/, {
    title: 'Open',
    body: 'this period’s own page: its dates, peak hours, the runs it moves and the runs that wait.',
  }],
  // DAR-BE-328: each Sync pulse row names its pair ("Open sync pair <label>"); the pair page's facts name their value.
  [/^open sync pair .+$/, {
    title: 'Open',
    body: 'this pair’s own page: its pulse, its allowance, today’s charts and the orders past the allowance.',
  }],
  [/^every: .+$/, {
    title: 'Every',
    body: 'sets how often the pulse reads both systems: every 1 to 6 hours, or off. Kept with Save.',
  }],
  [/^allowance: .+$/, {
    title: 'Allowance',
    body: 'sets how long an order may wait before it counts as late, 15 minutes to 48 hours. Kept with Save.',
  }],
  [/^run: .+$/, {
    title: 'Run',
    body: 'picks the daily check this pair watches. Its two systems become the pair’s two sides.',
  }],
  [/^upstream side: .+$/, {
    title: 'Upstream side',
    body: 'picks the system orders reach first. The pulse reads it for orders the other side does not have yet.',
  }],
  [/^chat space: .+$/, {
    title: 'Chat space',
    body: 'picks where late orders and the hourly summary are posted, or none.',
  }],
  [/^hourly summary: .+$/, {
    title: 'Hourly summary',
    body: 'turns a short card each hour in the chat space on or off. Kept with Save.',
  }],
  [/^export .+ extract$/, {
    title: 'Export extract',
    body: 'downloads exactly what that system’s read returned for this check that morning: the raw records, before any comparison.',
  }],
  [/^(expand|collapse) .+ (object|array)$/, {
    title: 'Expand',
    body: 'opens this branch of the record. It is the value the run actually compared, not a re-formatting of it.',
  }],
  // DAR-UI-127: Audit settings names each statement row "Open statement <code>" and its facts "<fact>: <value>".
  [/^open statement .+$/, {
    title: 'Statement',
    body: 'opens its words and the checks that test it. A change saves from there and counts from the next run.',
  }],
  [/^audit schedule: .+$/, {
    title: 'Schedule',
    body: 'sets when every check of this audit starts each day, and in which zone. The switch by the name pauses them all.',
  }],
  [/^after each run: .+$/, {
    title: 'After each run',
    body: 'turns the email after each run on or off and adds addresses beyond the members. Only tenant admins can change it.',
  }],
  [/^audit posts to: .+$/, {
    title: 'Posts to',
    body: 'picks the chat space that gets a summary card after each run, or None. The same choice as this audit’s row in Notifications.',
  }],
  // DAR-UI-128: each Ruleset manager conclusion row is named "Open conclusion <name>".
  // DAR-UI-135: each condition reads as a sentence and is named "Change this line: <sentence>".
  [/^change this line: .+$/, {
    title: 'Change this line',
    body: 'turns this one condition into a row: what is checked, the test, the values. Nothing is saved until Save conclusions.',
  }],
  [/^open conclusion .+$/, {
    title: 'Conclusion',
    body: 'opens it in place: its name, what it explains, its lines, its question, how it shows and your fix. Nothing is saved until Save conclusions.',
  }],
  // DAR-UI-135: each part of an open conclusion reads plain and is named "Change <part>: <what it says>".
  [/^change name: .+$/, {
    title: 'Name',
    body: 'picks this conclusion’s name from your list, or the plus makes a new one. Several runs can share a name, so it is picked, not retyped.',
  }],
  [/^change what it explains: .+$/, {
    title: 'Explains',
    body: 'the failed check this conclusion is tried on. It never names a row that failed some other check.',
  }],
  [/^change the question: .+$/, {
    title: 'Asks',
    body: 'the one question this conclusion answers, shown with each finding it names. Nothing is saved until Save conclusions.',
  }],
  [/^change how it shows: .+$/, {
    title: 'Shows as',
    body: 'what a row it names becomes: Shown stays a finding, Expected counts as expected, Hidden is left out of counts. Applies from the next run.',
  }],
  [/^change the fix: .+$/, {
    title: 'Fix',
    body: 'your own words on how to put it right; Darpan never writes them. Every finding this conclusion names carries them.',
  }],
  // DAR-UI-125: each earlier row on Config history is named "Restore version <n>".
  [/^restore version .+$/, {
    title: 'Restore',
    body: 'shows what putting this version back would change, before anything does. Your config now is kept as a version first.',
  }],
] as const)

/** The registries only: no data, no edits. What the bundle itself answers, which is what a data entry may never shadow. */
export function lookupBundledAction(name: string | null | undefined): ActionEntry | null {
  if (!name) return null
  const direct = MASCOT_ACTIONS[name]
  if (direct) return direct
  for (const [pattern, entry] of ACTION_PATTERNS) if (pattern.test(name)) return entry
  return null
}

/** An admin's edit of a bundled entry replaces its words; hiding it makes the control unknown (silent, not stumped). */
function edited(key: string, entry: ActionEntry): ActionEntry | null {
  const edit = editFor('MASCOT_ACTION', key)
  if (!edit) return entry
  if (edit.hidden) return null
  return { title: edit.title ?? entry.title, body: edit.body ?? entry.body }
}

/**
 * Bundled direct name, then the bundled patterns, then data names, then data wildcards (DAR-BE-313), so data can
 * only answer a control the bundle does not. Edits and hiding apply to the bundled entry that answered.
 */
export function lookupAction(name: string | null | undefined): ActionEntry | null {
  if (!name) return null
  const direct = MASCOT_ACTIONS[name]
  if (direct) return edited(name, direct)
  for (const [pattern, entry] of ACTION_PATTERNS) if (pattern.test(name)) return edited(`pattern:${pattern.source}`, entry)
  return dataAction(name)
}

/** True when an admin hid the bundled control entry that answers this name: a hidden control is silent, not "stumped". */
export function isHiddenAction(name: string | null | undefined): boolean {
  if (!name) return false
  if (MASCOT_ACTIONS[name]) return editFor('MASCOT_ACTION', name)?.hidden === true
  for (const [pattern] of ACTION_PATTERNS) if (pattern.test(name)) return editFor('MASCOT_ACTION', `pattern:${pattern.source}`)?.hidden === true
  return false
}
