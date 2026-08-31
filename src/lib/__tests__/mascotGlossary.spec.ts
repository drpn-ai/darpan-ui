import { describe, expect, it } from 'vitest'
import { MASCOT_GLOSSARY, lookupGlossary } from '../mascotGlossary'

/**
 * The bubble clamps at three lines of roughly 52 characters. An entry that overruns is
 * not truncated gracefully — it ends mid-sentence with an ellipsis, which is worse than
 * saying less. The cap is the design, so it is enforced here rather than left to whoever
 * writes the next entry.
 */
const RENDERED_LIMIT = 150

function rendered(term: string): string {
  const entry = MASCOT_GLOSSARY[term]
  if (!entry) return ''
  // The dock renders "<title> — <body>", so the title counts against the budget too.
  return `${entry.title} — ${entry.body}`
}

describe('mascot glossary', () => {
  it('fits every entry in the three lines the bubble allows', () => {
    const overruns = Object.keys(MASCOT_GLOSSARY)
      .map((term) => ({ term, length: rendered(term).length }))
      .filter((row) => row.length > RENDERED_LIMIT)

    expect(overruns, `these would be cut off mid-sentence: ${JSON.stringify(overruns)}`).toEqual([])
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
