import { describe, expect, it } from 'vitest'
import { MASCOT_GLOSSARY } from '../mascotGlossary'
import { MASCOT_ACTIONS } from '../mascotActions'

/**
 * The mascot's voice, guarded across BOTH registries at once.
 *
 * She is the only voiced surface in the app: the page is terse — labels, buttons and
 * empty states say the fewest words that survive removal — and she carries the framing
 * that the page therefore does not have to. Flattening her would leave the product with
 * no voice anywhere, so this file never asserts that a body is plain. It asserts the one
 * thing VOICE_GUIDE.md guardrail 3 makes falsifiable: warmth has to be EARNED with
 * specifics rather than performed. A line that could be appended to any entry at all —
 * "Sorry.", "Awkward.", "I will know." — is filler wearing personality's clothes, and it
 * costs a hover to learn nothing.
 *
 * HONEST LIMIT, stated rather than papered over: a fixed corpus list catches the return
 * of filler somebody has already seen, not filler nobody has invented yet. That is the
 * same bargain RunNotificationVoiceTests.copyCorpusNeverUsesTheBannedAgreeWording makes
 * in the backend, and it is the failure mode this very repo keeps hitting — an enumerated
 * list only ever grows for whatever was last edited. Judgement still writes the line;
 * this only stops a fixed one from silently coming back.
 */

/** Mood performed at the reader. Every one of these could end any entry in either file. */
const PERFORMED_FLAVOUR: readonly RegExp[] = [
  /\bsorry\b/i,
  /\bawkward\b/i,
  /\bdisappointing\b/i,
  /\bhappily\b/i,
  /\bhoarding\b/i,
  /\balas\b/i,
  /\boops\b/i,
  /\bunfortunately\b/i,
  /\bI will know\b/,
  /\bI’ll know\b/,
]

/** VOICE_GUIDE.md's hard-fail list. Enforced nowhere else in darpan-ui. */
const BUZZWORDS: readonly RegExp[] = [
  /\bleverage[sd]?\b/i,
  /\brobust\b/i,
  /\bseamless(ly)?\b/i,
  /\bbest-in-class\b/i,
  /\bmission-critical\b/i,
  /\beffortless(ly)?\b/i,
  /\bcutting-edge\b/i,
]

interface Line {
  readonly where: string
  readonly body: string
}

function everyBody(): readonly Line[] {
  return [
    ...Object.entries(MASCOT_GLOSSARY).map(([key, e]) => ({ where: `glossary.${key}`, body: e.body })),
    ...Object.entries(MASCOT_ACTIONS).map(([key, e]) => ({ where: `actions['${key}']`, body: e.body })),
  ]
}

describe('the mascot speaks in her own voice', () => {
  it('is actually reading both registries, not passing on an empty sweep', () => {
    // Without this the two tests below pass just as happily against zero entries — the
    // exact way a guard goes quietly dead. 140 is comfortably under today's 146 so that
    // ordinary authoring does not trip it, and far above the zero that would matter.
    expect(everyBody().length, 'the registries did not load').toBeGreaterThan(140)
  })

  it('never performs a mood it has not earned', () => {
    const offenders = everyBody()
      .filter(({ body }) => PERFORMED_FLAVOUR.some((pattern) => pattern.test(body)))
      .map(({ where, body }) => `${where}: "${body.slice(-56)}"`)

    expect(offenders, 'performed rather than earned — name this value’s real failure mode instead').toEqual([])
  })

  it('never reaches for a buzzword', () => {
    const offenders = everyBody()
      .filter(({ body }) => BUZZWORDS.some((pattern) => pattern.test(body)))
      .map(({ where, body }) => `${where}: "${body.slice(0, 56)}"`)

    expect(offenders, 'VOICE_GUIDE.md hard-fail wording').toEqual([])
  })
})
