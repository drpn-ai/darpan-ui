/**
 * DAR-UI-119. Geometry for the bowtie the mascot wears: the active tenant's name in the knot.
 *
 * Every number is in the mascot's viewBox units (-6 -9 76 76; the face's centre line is x 32, the
 * chin ends at y 56.5). Plain arithmetic rather than text measurement, because the app's only face
 * is IBM Plex Mono: every glyph advances 0.6em, so a line's width is its length times that — exact
 * in the browser, and the same in jsdom, where nothing can be measured.
 */

/** The knot's top edge, two units above the chin, so the chin covers it and the bow reads as worn. */
const KNOT_TOP = 54.5
const CENTRE_X = 32
export const BOW_FONT_SIZE = 8.2
const GLYPH_ADVANCE = BOW_FONT_SIZE * 0.6
const LINE_HEIGHT = BOW_FONT_SIZE * 1.25
const PAD_X = 5.6
const PAD_Y = 1.5
/** Past this a name wraps. About the face's width, so a normal name stays one line under the chin. */
const MAX_LINE_CHARS = 16
export const BOW_KNOT_RADIUS = 6
/** Hand-tied: the knot sits a few degrees off level. */
const KNOT_TILT = -3

const WING_WIDTH = 13.1
const WING_HEIGHT = 15.6
/** How far each wing tucks under the knot, so the two read as one tied piece. */
const WING_TUCK = 3.1
/** The wing art is drawn in a 16 x 18 box with the knot side at x 16. */
const WING_ART_SCALE = `${(WING_WIDTH / 16).toFixed(4)} ${(WING_HEIGHT / 18).toFixed(4)}`

/** One cloth lobe, pinched toward the knot. */
export const BOW_WING_LOBE =
  'M16 6.2C12 1.6 6.5-.6 2.6 1.6C.2 3-.4 6.8.4 9C-.4 11.2.2 15 2.6 16.4C6.5 18.6 12 16.4 16 11.8Z'
/** Two folds fanning from the pinch, as tapered fills: the mark carries no strokes anywhere. */
export const BOW_WING_FOLDS = [
  'M15.2 7.8C11.5 6.2 7.5 5.1 4.2 5C7.5 5.6 11.5 6.8 15.2 8.6Z',
  'M15.2 10.2C11.5 11.8 7.5 12.9 4.2 13C7.5 12.4 11.5 11.2 15.2 9.4Z',
]

export interface Bowtie {
  lines: Array<{ text: string, y: number }>
  knot: { x: number, y: number, width: number, height: number }
  knotTransform: string
  wings: Array<{ side: 'l' | 'r', transform: string }>
}

const round = (value: number): number => Math.round(value * 100) / 100

/**
 * One line, or two balanced ones split at the space that leaves the shorter longest line. Never
 * truncated: a single word longer than a line stays whole and the knot grows to hold it.
 */
export function knotLines(name: string): string[] {
  if (name.length <= MAX_LINE_CHARS) return [name]
  let best: [string, string] | null = null
  for (let at = name.indexOf(' '); at !== -1; at = name.indexOf(' ', at + 1)) {
    const split: [string, string] = [name.slice(0, at).trim(), name.slice(at + 1).trim()]
    if (!split[0] || !split[1]) continue
    if (!best || Math.max(split[0].length, split[1].length) < Math.max(best[0].length, best[1].length)) best = split
  }
  return best ?? [name]
}

export function bowtieFor(label: string | null | undefined): Bowtie | null {
  const name = label?.replace(/\s+/g, ' ').trim() ?? ''
  if (!name) return null

  const texts = knotLines(name)
  const longest = Math.max(...texts.map((text) => text.length))
  const width = longest * GLYPH_ADVANCE + PAD_X * 2
  const height = texts.length * LINE_HEIGHT + PAD_Y * 2
  const left = CENTRE_X - width / 2
  // Anchored by its top edge: a two-line knot grows downward, so the chin covers the same sliver.
  const centreY = KNOT_TOP + height / 2

  const leftWingX = left + WING_TUCK - WING_WIDTH / 2
  const rightWingX = left + width - WING_TUCK + WING_WIDTH / 2
  const toArt = `translate(${-WING_WIDTH / 2} ${-WING_HEIGHT / 2}) scale(${WING_ART_SCALE})`

  return {
    lines: texts.map((text, index) => ({ text, y: round(KNOT_TOP + PAD_Y + LINE_HEIGHT * (index + 0.5)) })),
    knot: { x: round(left), y: KNOT_TOP, width: round(width), height: round(height) },
    knotTransform: `rotate(${KNOT_TILT} ${CENTRE_X} ${round(centreY)})`,
    wings: [
      // Uneven on purpose: the left a little bigger and tipped one way, the right smaller and tipped
      // the other, dropped a touch.
      { side: 'l', transform: `translate(${round(leftWingX)} ${round(centreY)}) rotate(-9) scale(1.12) ${toArt}` },
      {
        side: 'r',
        transform: `translate(${round(rightWingX)} ${round(centreY)}) scale(-1 1) rotate(-12) scale(0.9) translate(0 0.78) ${toArt}`,
      },
    ],
  }
}
