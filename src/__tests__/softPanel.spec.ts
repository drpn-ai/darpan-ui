import { readFileSync } from 'node:fs'
import { sync as glob } from 'fast-glob'
import { describe, expect, it } from 'vitest'

/**
 * S99-109: the run pages' soft panel (a bordered box a shade lighter than the page) is one class in style.css. Four
 * page-local copies had drifted, and the run history card on the Diff page mixed 82% where the others mixed 92%.
 */
const SOFT_TINT = /color-mix\(in oklab, var\(--surface-2\) (?:82|92)%, white\)/

describe('soft panel', () => {
  it('lives once in style.css', () => {
    const css = readFileSync('src/style.css', 'utf-8')
    const rule = css.match(/\.app-soft-panel \{[^}]*\}/)?.[0] ?? ''
    expect(rule, '.app-soft-panel is missing from style.css').not.toBe('')
    expect(rule).toMatch(SOFT_TINT)
    expect(rule).toContain('border: 1px solid var(--border-soft)')
    expect(rule).toContain('border-radius: var(--radius-md)')
  })

  it('is mixed by no page of its own', () => {
    const files = glob('src/**/*.vue', { ignore: ['**/__tests__/**', '**/.claude/**'] })
    expect(files.length, 'nothing was swept — the glob is wrong').toBeGreaterThan(30)
    const offenders = files.filter((file) => SOFT_TINT.test(readFileSync(file, 'utf-8')))
    expect(offenders, `a page mixes the soft-panel tint itself: ${offenders.join(', ')}`).toEqual([])
  })

  it('is worn by each run-page panel', () => {
    const PANELS: readonly (readonly [string, string, number])[] = [
      ['src/pages/reconciliation/ReconciliationRunStartingPage.vue', 'run-starting-steps', 1],
      ['src/pages/reconciliation/ReconciliationRunResultPage.vue', 'run-result-rule-selector__option', 2],
      ['src/pages/reconciliation/ReconciliationRunResultPage.vue', 'run-result-source-details', 1],
      ['src/pages/reconciliation/ReconciliationRunResultPage.vue', 'run-result-step-timeline', 1],
      ['src/pages/reconciliation/ReconciliationDiffPage.vue', 'reconciliation-run-history-card', 1],
    ]
    for (const [file, panel, count] of PANELS) {
      const template = readFileSync(file, 'utf-8').match(/<template>([\s\S]*)<\/template>/)?.[1] ?? ''
      const worn = Array.from(template.matchAll(new RegExp(`class="${panel} app-soft-panel[ "]`, 'g')))
      expect(worn.length, `${file}: ${panel} should wear app-soft-panel ${count} time(s)`).toBe(count)
    }
  })
})
