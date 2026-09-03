import { MASCOT_GLOSSARY } from './mascotGlossary'
import { describeTimeZone } from './utils/date'

/**
 * Makes the mascot work everywhere without annotating anything.
 *
 * Hand-wiring `v-explain` onto elements does not scale past the page you happen to be
 * editing — the first cut covered one column header and read, correctly, as broken.
 * Instead the dock watches the document and recognises two things on its own:
 *
 *   1. a LABEL whose text matches a glossary entry — "Differences", "Schedule", "Schema"
 *   2. a TIMESTAMP in the exact shape formatDateTime renders
 *
 * Both are conservative by construction. An unknown label is ignored, so a new heading
 * never produces a confident wrong answer, and the timestamp pattern only matches this
 * app's own formatter output rather than any string with digits in it.
 *
 * `v-explain` still exists and still wins: it is how a surface says something this
 * index cannot infer, like which of two counts a bare number is.
 */

/** Labels carry a colon, stray whitespace and case that the index should not care about. */
function normalizeLabel(text: string): string {
  // Collapse first, then strip the colon, then trim again — stripping " :" leaves a
  // trailing space that would otherwise miss every entry in the index.
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[:：]$/, '')
    .trim()
    // "Timeout (seconds)", "Private Key (optional)", "Username (leave blank to keep
    // existing)" — the parenthetical is an instruction to the person filling the form,
    // not part of the field's name.
    .replace(/\s*\([^)]*\)$/, '')
    // "Source 1 Schema" and "Source 2 Schema" are the same field on two sides of a run.
    .replace(/^source \d+\s+/i, '')
    .trim()
    .toLowerCase()
}

/**
 * Where the same concept is written differently on screen than in the glossary. Keys are
 * what the product actually displays; the docs' own wording is the value.
 */
const LABEL_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  'differences': 'differenceCount',
  'difference count': 'differenceCount',
  'compared': 'comparedCount',
  'records compared': 'comparedCount',
  'only in oms': 'onlyInFile1Count',
  'only in the first source': 'onlyInFile1Count',
  'only in the second source': 'onlyInFile2Count',
  'missing in source': 'missingInSource',
  'value mismatch': 'valueMismatch',
  'processing error': 'processingError',
  'matched': 'matched',
  'status': 'runStatus',
  'run status': 'runStatus',
  'scheduled': 'scheduledDate',
  'completed': 'completedDate',
  'schedule': 'automationSchedule',
  'window': 'automationWindow',
  'previous run': 'previousRun',
  'next run': 'nextRun',
  'rule set': 'ruleSet',
  'ruleset': 'ruleSet',
  'rules': 'ruleSet',
  'schema': 'schema',
  'connection': 'connection',
  'connections': 'connection',
  'saved run': 'savedRun',
  'generated output': 'generatedOutput',
  'source strategy': 'sourceStrategy',
  'active tenant': 'activeTenant',
  'active company': 'activeTenant',
  'company': 'activeTenant',
  'reconciliation run': 'reconciliationRun',
  'run': 'reconciliationRun',

  // The setup vocabulary, which is most of what is on screen outside a run result.
  'timezone': 'timezone',
  'time zone': 'timezone',
  'system': 'systemLabel',
  'active': 'activeFlag',
  'primary id': 'primaryId',
  'schema id': 'schema',
  'schema name': 'schema',
  'endpoint': 'endpoint',
  'api config': 'connection',
  'field': 'sourceField',
  'base url': 'baseUrl',
  'shop/api url': 'baseUrl',
  'token url': 'baseUrl',
  'auth type': 'authType',
  'api version': 'apiVersion',
  'config id': 'configId',
  'shopify config id': 'configId',
  'webhook url': 'webhookUrl',
  'timeout': 'timeoutSeconds',
  'read timeout': 'timeoutSeconds',
  'shared with': 'sharedWith',
  'permissions': 'permissions',
  'run name': 'runName',
  'start date': 'startDate',
  'start': 'startDate',
  'updated': 'updatedAt',
  'remote attributes': 'remoteAttributes',

  // Section headings, as the pages actually title them.
  'exclusions': 'exclusions',
  'exclusion': 'exclusions',
  'has exclusion': 'exclusions',
  'previous runs': 'previousRuns',
  // NOT previousRuns: the Automations page titles its list of saved automations
  // "Automation Runs", so this label sits over automation tiles, never over executions.
  'automation runs': 'automations',
  // Same trap as "Automation Runs": HomePage's Other Runs grid holds saved runs, and
  // the run history's Most Recent is one generated result — neither is an execution.
  'other runs': 'savedRuns',
  'most recent': 'previousResults',
  'previous results': 'previousResults',
  'results': 'previousResults',
  'saved schemas': 'savedSchemas',
  'schemas': 'savedSchemas',
  'saved runs': 'savedRuns',
  'saved configs': 'savedConfigs',
  'saved servers': 'savedConfigs',
  'endpoints': 'endpoints',
  'tenant context': 'tenantContext',
  'localization': 'localization',
  'preferences': 'localization',
  'pinned runs': 'pinnedRuns',
  'activity': 'activity',
  'operations': 'operations',
  'auth': 'authType',
  'rule sets': 'ruleSet',
  'automations': 'automations',
})

/** Every glossary title is its own label, so a new entry is reachable the moment it exists. */
function buildIndex(): Record<string, string> {
  const index: Record<string, string> = {}
  for (const [term, entry] of Object.entries(MASCOT_GLOSSARY)) {
    index[normalizeLabel(entry.title)] = term
  }
  // Aliases are applied second so an explicit mapping beats a coincidental title match.
  return { ...index, ...LABEL_ALIASES }
}

const LABEL_INDEX = buildIndex()

/**
 * Elements that carry a name rather than a value.
 *
 * These are the classes the product actually uses — counted from the templates rather
 * than guessed. The first cut listed `.summary-label`, which exists nowhere, and missed
 * `.static-page-summary-label` and `.workflow-context-label`, which between them carry
 * most of the labels in the app. That is why whole pages had nothing to hover.
 */
const LABEL_SELECTOR = [
  'th',
  'dt',
  'legend',
  // Section and page headings. "Exclusions", "Previous Runs", "Saved Schemas" name a
  // whole region, so they are the first thing someone lost on a page reads — and the
  // cheapest place to answer "what am I looking at".
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  '.static-page-section-heading',
  '.micro-label',
  '.static-page-summary-label',
  '.workflow-context-label',
  '.workflow-choice-label',
  '.ruleset-field-label',
  '.connection-diagnostics-label',
  '.option-label',
  '[data-explain-label]',
].join(', ')

/**
 * Elements that could carry one of our rendered timestamps. `span` is in the list only
 * because the pattern below is strict enough to carry it: a span whose ENTIRE text is
 * this app's date format is a timestamp, not a coincidence.
 */
const VALUE_SELECTOR = 'td, dd, time, span'

/**
 * Exactly what `formatDateTime` produces — "May 2, 2026, 1:00 PM" — and nothing else.
 * Matching our own output rather than dates in general is what keeps this from firing
 * on an order id that happens to contain numbers.
 */
const TIMESTAMP_PATTERN = /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}\s?(AM|PM)$/

export interface ExplainTarget {
  el: HTMLElement
  term: string
  detail: string | null
}

function ownText(el: Element): string {
  return (el.textContent ?? '').trim()
}

export function resolveExplainTarget(start: Element | null): ExplainTarget | null {
  if (!start) return null

  const label = start.closest<HTMLElement>(LABEL_SELECTOR)
  if (label) {
    // A header cell wraps its text in a span; either way the label's own text is the name.
    const term = LABEL_INDEX[normalizeLabel(ownText(label))]
    if (term) return { el: label, term, detail: null }
  }

  const value = start.closest<HTMLElement>(VALUE_SELECTOR)
  if (value) {
    const text = ownText(value)
    if (TIMESTAMP_PATTERN.test(text)) {
      // Parse the rendered text back so the zone is resolved at THAT instant — August
      // and January answer differently, and a "now" fallback would quietly be wrong.
      const parsed = new Date(text)
      const at = Number.isNaN(parsed.getTime()) ? undefined : parsed
      return { el: value, term: 'timestamp', detail: describeTimeZone(at) }
    }
  }

  return null
}

export const __testing = { normalizeLabel, LABEL_INDEX, TIMESTAMP_PATTERN }
