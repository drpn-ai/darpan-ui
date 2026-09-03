import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * The help cursor is gone from the product, on purpose.
 *
 * It was introduced as "the only standing signal that a thing is askable" — a quiet mark
 * on anything the mascot could explain. Now that every value, heading and control answers,
 * that signal is on most of the page at once, and a question-mark pointer following the
 * reader around reads as the interface being unsure rather than as help being available.
 * The mascot's own bubble is the affordance; the cursor was a second one.
 */
describe('cursor conventions', () => {
  it('uses no question-mark cursor anywhere', () => {
    const files = glob(['src/**/*.css', 'src/**/*.vue'], { ignore: ['**/__tests__/**', '**/.claude/**'] })
    expect(files.length, 'nothing was swept — the glob is wrong').toBeGreaterThan(30)

    const offenders = files.filter((file) => /cursor:\s*help/.test(readFileSync(file, 'utf-8')))

    expect(offenders, `cursor: help is still set in: ${offenders.join(', ')}`).toEqual([])
  })
})
