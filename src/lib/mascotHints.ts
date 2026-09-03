/**
 * What the mascot offers when someone has been on a page a while without doing anything.
 *
 * Every line describes a gesture that actually exists — and now that is enforced rather
 * than promised. A hint carries the control it talks about (`when`, a data-testid
 * selector) and is offered only while that control is on the page. A route cannot know
 * whether a conditional control rendered: the live run's step timeline appears only once
 * a status call succeeds, Cancel only while the run is still going, Notify me narrower
 * still. Keying hints to the route alone meant either staying silent on those pages or
 * promising controls that are not there, and a hint for an interaction the page does not
 * support is worse than silence — it sends someone looking for something that was never
 * rendered.
 *
 * Reading the DOM rather than having pages push their state here is deliberate: pages
 * would have to be annotated one at a time and would drift the first time somebody edited
 * one, which is the same hand-wiring `mascotTargets.ts` exists to escape. No control, no
 * hint, structurally.
 *
 * Ordered by how likely they are to be the thing you were stuck on — a failed step before
 * a download. Only one is offered per idle stretch, and the next only after you have done
 * something, so a page never lectures at a fixed interval.
 */
export interface Hint {
  /** The line, as spoken. */
  text: string
  /**
   * A CSS selector for the control this line names. Offered only while it is on the page.
   * Omit only for a line that names nothing — an observation about the page as a whole.
   */
  when?: string
}

/** Reads as `[data-testid="x"]`; kept as a helper so a typo is a compile error, not silence. */
function control(testId: string): string {
  return `[data-testid="${testId}"]`
}

export const MASCOT_HINTS: Readonly<Record<string, readonly Hint[]>> = Object.freeze({
  // RuleSetBoard: @dblclick opens the exclusion editor, pointerdown/up draws a pairing,
  // and Enter is the keyboard equivalent of the drag.
  'reconciliation-ruleset-editor': Object.freeze([
    { text: 'Double-click a field to set what this source should leave out when it pulls.', when: control('ruleset-field-list-file1') },
    { text: 'Drag from a field on one side to a field on the other to pair them.', when: control('ruleset-editor-board') },
    { text: 'Not every source can filter at the pull — a side that cannot will say so.' },
    { text: 'Enter on a field, then Enter on its partner, pairs them without the drag.', when: control('ruleset-editor-board') },
  ]),
  'reconciliation-ruleset-manager': Object.freeze([
    { text: 'Edit Run or Rules with the pencil beside each — finished runs keep whatever they already compared.', when: control('ruleset-manager-edit-rules') },
    { text: 'Exclusions are per source — each side can leave out different records as it pulls.', when: control('ruleset-manager-exclusions') },
    { text: 'Run this rule set from here; its history is one step further on.', when: control('ruleset-manager-run-ruleset') },
  ]),
  'reconciliation-automations': Object.freeze([
    { text: 'Open one to see its schedule, its window, and what it has actually been doing.', when: control('automation-tile') },
    { text: 'Create Automation builds a new one on top of a saved run.', when: control('automation-create-action') },
  ]),
  'reconciliation-automation-dashboard': Object.freeze([
    { text: 'Rest on Schedule or Window — they are the two most easily confused settings here.', when: control('automation-setup-summary') },
    // Gated on a row rather than the section: with no executions the section is an empty
    // state, and calling that "the record of what happened" explains nothing.
    { text: 'Previous Runs is the record of what actually happened, newest first.', when: control('automation-execution-row') },
    { text: 'Run now fires it immediately and leaves the schedule alone.', when: control('automation-run-now-action') },
  ]),
  // Two routes, one component. The saved result is the forensic view; the live run is the
  // same page while it is still moving, and almost everything it offers is conditional.
  'reconciliation-run-result': Object.freeze([
    { text: 'A step failed — counts below it are partial rather than clean.', when: control('run-result-live-failed') },
    // The empty message also shows when a filter matches nothing, so it must not be read
    // as "the run found nothing".
    { text: 'Nothing here yet — a bucket or the search may be filtering it out, not the run.', when: control('diff-details-empty') },
    { text: 'Click a bucket to narrow the table to just those records.', when: control('diff-bucket-file-1') },
    { text: 'Rest on any count and I will tell you what it does and does not include.' },
    { text: 'Differences and missing records are counted separately — a zero in one says nothing about the other.' },
    { text: 'The source files are the run’s own — download one to check a record it calls missing.', when: control('run-result-source-download') },
    { text: 'Download gives you the result exactly as the run wrote it.', when: control('run-result-download') },
  ]),
  'reconciliation-run-live': Object.freeze([
    { text: 'A step failed — counts below it are partial rather than clean.', when: control('run-result-live-failed') },
    { text: 'Notify me pings a chat space when this finishes, so you do not have to wait here.', when: control('run-result-notify-me') },
    { text: 'Cancel run stops it. Whatever it has done so far is discarded.', when: control('run-result-cancel') },
    { text: 'Run steps fills in as each stage finishes — it is the live part of this page.', when: control('run-result-step-timeline') },
  ]),
  'reconciliation-run-history': Object.freeze([
    { text: 'A run still going shows its progress here rather than a result.', when: control('run-history-running-tile') },
    { text: 'A failed run kept its error — open it rather than re-running blind.', when: control('run-history-failed-tile') },
    { text: 'Runs are a record of what was true when they ran. Re-run rather than editing one.' },
    { text: 'A burst of failures can bury the run you want — there is more here than the first page.', when: control('run-history-more') },
  ]),
  // Schema surfaces. Written from what the components actually render — the editor's
  // controls are all gated on canEditTarget, which is why a read-only view looks broken
  // rather than restricted, and that is the line worth spending.
  'schemas-library': Object.freeze([
    { text: 'A schema is the shape a run expects its source data to have — open one to see the fields it pins.', when: control('schema-library-tile') },
    { text: 'Create builds a new schema. Nothing already saved is touched.', when: control('schema-library-create') },
  ]),
  'schemas-editor': Object.freeze([
    { text: 'Each row is a path into the source document — the placeholder shows the shape it wants.', when: control('schema-editor-add-row') },
    { text: 'Without permission to edit tenant settings this is a read-only view, not a broken one.' },
  ]),
  hub: Object.freeze([
    { text: 'Press ⌘K, or click me, to jump anywhere by name.' },
  ]),
})

/**
 * The hints a page can honestly offer right now.
 *
 * `root` is the document in the app and a fragment in tests. Evaluated at the moment the
 * offer is due rather than on arrival, so a page that finishes loading after you stopped
 * touching it still gets the right line.
 *
 * Empty rather than a default: a page with nothing useful to say should say nothing.
 */
export function hintsFor(routeName: string | null | undefined, root: ParentNode): readonly string[] {
  if (!routeName) return []
  const hints = MASCOT_HINTS[routeName]
  if (!hints) return []
  return hints.filter((hint) => !hint.when || root.querySelector(hint.when) !== null).map((hint) => hint.text)
}
