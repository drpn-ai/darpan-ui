import { describe, expect, it } from 'vitest'
import { MASCOT_GLOSSARY, lookupGlossary } from '../mascotGlossary'

/**
 * The bubble no longer crops — it grows to fit, because an answer that stops
 * mid-sentence is worse than a taller bubble. This budget therefore exists for
 * readability rather than for truncation: the mascot interrupts a page to say one
 * thing, and a paragraph in the corner of a dashboard does not get read.
 */
const RENDERED_LIMIT = 200

function rendered(term: string): string {
  const entry = MASCOT_GLOSSARY[term]
  if (!entry) return ''
  // The dock renders "<title> — <body>", so the title counts against the budget too.
  return `${entry.title} — ${entry.body}`
}

describe('mascot glossary', () => {
  it('keeps every entry to something a person will actually read', () => {
    const overruns = Object.keys(MASCOT_GLOSSARY)
      .map((term) => ({ term, length: rendered(term).length }))
      .filter((row) => row.length > RENDERED_LIMIT)

    expect(overruns, `too long to read in a corner bubble: ${JSON.stringify(overruns)}`).toEqual([])
  })

  it('never leaves a {detail} slot unfilled in a body that has no filler', () => {
    // Only entries the caller supplies a detail for may carry the token; anything else
    // would render the literal "{detail}" to a user.
    const allowed = new Set(['runStartedAt', 'completedDate', 'timestamp'])
    for (const [term, entry] of Object.entries(MASCOT_GLOSSARY)) {
      if (entry.body.includes('{detail}')) expect(allowed.has(term), term).toBe(true)
    }
  })

  it('starts every body lowercase, since the title leads the sentence', () => {
    for (const [term, entry] of Object.entries(MASCOT_GLOSSARY)) {
      const first = entry.body.trimStart().charAt(0)
      expect(first === first.toLowerCase(), `${term}: "${entry.body.slice(0, 24)}…"`).toBe(true)
    }
  })

  it('answers null for a term nobody has written yet', () => {
    expect(lookupGlossary('noSuchTerm')).toBeNull()
    expect(lookupGlossary(undefined)).toBeNull()
  })
})
