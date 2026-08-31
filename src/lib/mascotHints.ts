/**
 * What the mascot offers when someone has been on a page a while without doing anything.
 *
 * Every line describes a gesture that actually exists — checked against the component,
 * not imagined. A hint for an interaction the page does not support is worse than
 * silence: it sends someone looking for a control that was never there.
 *
 * Ordered by how likely they are to be the thing you were stuck on. Only one is offered
 * per idle stretch, and the next only after you have done something, so a page never
 * lectures at a fixed interval.
 */
export const MASCOT_HINTS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  // RuleSetBoard: @dblclick opens the exclusion editor, pointerdown/up draws a pairing,
  // and Enter is the keyboard equivalent of the drag.
  'reconciliation-ruleset-editor': Object.freeze([
    'Double-click a field to set what this source should leave out when it pulls.',
    'Drag from a field on one side to a field on the other to pair them.',
    'Not every source can filter at the pull — a side that cannot will say so.',
    'Keyboard: Enter on a field, then Enter on its partner, does the same pairing.',
  ]),
  'reconciliation-ruleset-manager': Object.freeze([
    'The pencil beside Run and Rules opens each for editing.',
    'Exclusions are per source — each side can leave out different records as it pulls.',
  ]),
  'reconciliation-automation-dashboard': Object.freeze([
    'Rest on Schedule or Window — they are the two most easily confused settings here.',
    'Previous Runs is the record of what actually happened, newest first.',
  ]),
  'reconciliation-run-result': Object.freeze([
    'Rest on any count and I will tell you what it does and does not include.',
    'Differences and missing records are counted separately — a zero in one says nothing about the other.',
  ]),
  'reconciliation-run-history': Object.freeze([
    'Runs are a record of what was true when they ran. Re-run rather than editing one.',
  ]),
  hub: Object.freeze([
    'Press ⌘K, or click me, to jump anywhere by name.',
  ]),
})

/** Empty rather than a default: a page with nothing useful to say should say nothing. */
export function hintsForRoute(routeName: string | null | undefined): readonly string[] {
  if (!routeName) return []
  return MASCOT_HINTS[routeName] ?? []
}
