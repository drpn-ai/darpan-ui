import { describe, expect, it } from 'vitest'
import { resolveExplainTarget } from '../mascotTargets'

/**
 * Markup copied from ReconciliationRuleSetManagerPage — the saved-run page a real
 * screenshot showed. Guessing selectors is what left whole pages dead twice, so this
 * asserts against the shapes the page genuinely renders rather than idealised ones.
 */
const PAGE = `
  <div class="ruleset-manager-section-header section-header-row">
    <h2 class="static-page-section-heading">Run</h2>
  </div>
  <div class="ruleset-manager-basics-grid">
    <button type="button" class="ruleset-manager-basic-card ruleset-manager-basic-card--button">
      <span class="static-page-summary-label">System</span>
      <span class="ruleset-manager-system-line"><strong>Shopify</strong></span>
    </button>
    <article class="ruleset-manager-basic-card">
      <span class="static-page-summary-label">Schema</span>
      <span>Shopify Return References</span>
    </article>
    <article class="ruleset-manager-basic-card">
      <span class="static-page-summary-label">Primary ID</span>
      <span>refundOrReturnId</span>
    </article>
  </div>
  <div class="ruleset-manager-section-header section-header-row">
    <h2 class="static-page-section-heading">Rules</h2>
  </div>
  <article class="ruleset-manager-basic-card">
    <span class="static-page-summary-label">Exclusions</span>
  </article>
`

function mountPage(): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = PAGE
  document.body.appendChild(host)
  return host
}

function termFor(host: HTMLElement, selector: string, text: string): string | undefined {
  const el = Array.from(host.querySelectorAll<HTMLElement>(selector))
    .find((node) => node.textContent?.trim() === text)
  expect(el, `no element matched ${selector} with text "${text}"`).toBeTruthy()
  return resolveExplainTarget(el as HTMLElement)?.term
}

describe('the saved run page', () => {
  it('explains every label it puts on screen', () => {
    const host = mountPage()

    expect(termFor(host, 'h2', 'Run')).toBe('reconciliationRun')
    expect(termFor(host, 'h2', 'Rules')).toBe('ruleSet')
    expect(termFor(host, 'span', 'System')).toBe('systemLabel')
    expect(termFor(host, 'span', 'Schema')).toBe('schema')
    expect(termFor(host, 'span', 'Primary ID')).toBe('primaryId')
    expect(termFor(host, 'span', 'Exclusions')).toBe('exclusions')
  })

  it('resolves a label that sits inside a button, not only in plain markup', () => {
    // The System card is a <button> — the pointer lands on the label span inside it,
    // and resolution has to work from there rather than bailing at the control.
    const host = mountPage()
    const label = host.querySelector('button .static-page-summary-label')

    expect(resolveExplainTarget(label)?.term).toBe('systemLabel')
  })

  it('says nothing about the values themselves', () => {
    // "Shopify" and "refundOrReturnId" are data, not vocabulary. Explaining a value
    // would mean inventing an answer about this tenant's own records.
    const host = mountPage()
    const value = Array.from(host.querySelectorAll('span'))
      .find((node) => node.textContent?.trim() === 'refundOrReturnId')

    expect(resolveExplainTarget(value as HTMLElement)).toBeNull()
  })
})
