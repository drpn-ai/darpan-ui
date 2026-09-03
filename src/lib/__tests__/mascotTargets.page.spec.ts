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

/**
 * Markup lifted from a real mount of ReconciliationRunResultPage, not composed by hand:
 * a sweep of that page resolved ZERO explainable elements, on the one page most of the
 * glossary was written for. Everything it labels uses page-local BEM classes the
 * selector list never named, so the index was looking at a page it could not see.
 */
const RUN_RESULT_PAGE = `
  <div class="run-result-hero">
    <h1 class="static-page-inline-edit-title">CSV Order Compare</h1>
    <p class="static-page-section-description">Mar 31, 2026, 8:11 AM</p>
  </div>
  <section class="run-result-source-details">
    <div class="run-result-source-details__summary">
      <span class="run-result-source-details__eyebrow">Source files</span>
    </div>
    <div class="run-result-source-details__files">
      <span class="run-result-source-details__files-label">Files compared</span>
      <div class="run-result-source-file">
        <span class="run-result-source-file__label">HotWax</span>
        <span class="run-result-source-file__name">orders-1.csv</span>
      </div>
    </div>
  </section>
  <button type="button" class="run-result-step-timeline__toggle">
    <span class="run-result-step-timeline__label micro-label">Run steps</span>
  </button>
  <div class="reconciliation-diff-details__bucket-grid">
    <button type="button" class="reconciliation-diff-bucket">
      <span class="reconciliation-diff-bucket__label">Missing from HotWax</span><strong>1</strong>
    </button>
    <button type="button" class="reconciliation-diff-bucket">
      <span class="reconciliation-diff-bucket__label">Missing from Shopify</span><strong>0</strong>
    </button>
  </div>
  <table><thead><tr><th><span>Record ID</span></th><th><span>Diff Detail</span></th></tr></thead></table>
`

describe('the run result page', () => {
  function mountRunResult(): HTMLElement {
    const host = document.createElement('div')
    host.innerHTML = RUN_RESULT_PAGE
    document.body.appendChild(host)
    return host
  }

  it('explains the labels the page actually renders', () => {
    const host = mountRunResult()

    expect(termFor(host, 'span', 'Source files')).toBe('sourceFiles')
    expect(termFor(host, 'span', 'Files compared')).toBe('sourceFiles')
    expect(termFor(host, 'span', 'Run steps')).toBe('runSteps')
    expect(termFor(host, 'th', 'Record ID')).toBe('primaryId')
    expect(termFor(host, 'th', 'Diff Detail')).toBe('diffDetail')
  })

  it('answers both missing buckets, whatever the two systems are called', () => {
    // The bucket label carries the tenant's own system names — "Missing from HotWax",
    // "Missing from Shopify" — so no fixed phrase can match it. One direction-neutral
    // answer beats two that have to know which side is which.
    const host = mountRunResult()

    expect(termFor(host, 'span', 'Missing from HotWax')).toBe('missingInSource')
    expect(termFor(host, 'span', 'Missing from Shopify')).toBe('missingInSource')
  })

  it('reaches the run time in the hero, which is a paragraph rather than a cell', () => {
    const host = mountRunResult()
    const target = resolveExplainTarget(host.querySelector('.static-page-section-description'))

    expect(target?.term).toBe('timestamp')
    expect(target?.detail).toBeTruthy()
  })

  it('still says nothing about the values beside those labels', () => {
    // Widening the selector must not turn data into vocabulary: the system name and the
    // file name sit in label-classed spans and are still this tenant's own records.
    const host = mountRunResult()
    const system = host.querySelector('.run-result-source-file__label')
    const file = host.querySelector('.run-result-source-file__name')
    const title = host.querySelector('.static-page-inline-edit-title')

    expect(resolveExplainTarget(system)).toBeNull()
    expect(resolveExplainTarget(file)).toBeNull()
    expect(resolveExplainTarget(title)).toBeNull()
  })

  it('explains the API date range on a run that pulled instead of uploading', () => {
    const host = document.createElement('div')
    host.innerHTML = '<span class="run-result-source-details__eyebrow">API date range</span>'
    document.body.appendChild(host)

    expect(resolveExplainTarget(host.querySelector('span'))?.term).toBe('apiDateRange')
  })
})
