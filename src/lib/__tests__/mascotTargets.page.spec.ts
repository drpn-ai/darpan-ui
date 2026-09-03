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

/**
 * Markup copied from ReconciliationAutomationsPage — hero, section heading, and one
 * tile per saved automation. Nothing on this page is an execution, which is the whole
 * point of the block below: a screenshot showed the mascot describing a run history
 * over a list of automations.
 */
const AUTOMATIONS_PAGE = `
  <h1>Automations</h1>
  <section class="static-page-section">
    <header class="static-page-section-head">
      <h2 class="static-page-section-heading">Automation Runs</h2>
    </header>
    <div class="static-page-section-body">
      <div class="static-page-tile-grid static-page-record-grid">
        <a class="static-page-tile static-page-record-tile">
          <span class="static-page-tile-title">Daily Order Reconciliation</span>
        </a>
      </div>
    </div>
  </section>
`

describe('the automations list page', () => {
  function mountAutomations(): HTMLElement {
    const host = document.createElement('div')
    host.innerHTML = AUTOMATIONS_PAGE
    document.body.appendChild(host)
    return host
  }

  it('describes the automations it lists, not some other page’s run history', () => {
    // Both headings sit over a grid of automation tiles. "Previous runs" belongs to the
    // dashboard's own Previous Runs table and is false here in every particular.
    const host = mountAutomations()

    expect(termFor(host, 'h1', 'Automations')).toBe('automations')
    expect(termFor(host, 'h2', 'Automation Runs')).toBe('automations')
  })

  it('says nothing about an automation’s name', () => {
    // A tile title is this tenant's own data, not vocabulary.
    const host = mountAutomations()
    const title = host.querySelector('.static-page-tile-title')

    expect(resolveExplainTarget(title)).toBeNull()
  })
})

/**
 * Three pages title a section "<something> Runs" over things that are not executions.
 * The alias table was written from the wording rather than from what each heading sits
 * over, so all three answered with the automation dashboard's run history.
 */
describe('headings that say "runs" over something that is not an execution', () => {
  function headingTerm(html: string): string | undefined {
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.appendChild(host)
    return resolveExplainTarget(host.querySelector('h2'))?.term
  }

  it('reads Other Runs on the home page as the saved runs it lists', () => {
    // HomePage's Other Runs grid is otherFlowCards -> savedRunCards: setups you open,
    // each of which executions are instances of. Nothing there has ever run.
    expect(headingTerm('<h2 class="static-page-section-heading">Other Runs</h2>')).toBe('savedRuns')
  })

  it('reads Most Recent on the run history as a result, not a run', () => {
    // featuredOutput is completedGeneratedOutputs[0] — the same list the sibling
    // "Previous Results" section renders the rest of, and it links to a result route.
    expect(headingTerm('<h2 class="static-page-section-heading">Most Recent</h2>')).toBe('previousResults')
  })

  it('still reads Previous Runs on the automation dashboard as the run history', () => {
    expect(headingTerm('<h2 class="static-page-section-heading">Previous Runs</h2>')).toBe('previousRuns')
  })
})
