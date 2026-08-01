import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConnectionDiagnosticsPopup from '../ConnectionDiagnosticsPopup.vue'
import type { ConnectionCheck } from '../../../lib/api/types'

/*
 * Mirrors what the live Shopify probe actually returns, including rows that carry a detail AND a
 * duration together. An earlier fixture had those on separate rows, so it never exercised the
 * combination that broke the row layout in the browser.
 */
const passingChecks: ConnectionCheck[] = [
  { key: 'credential', label: 'Credential readable', status: 'PASS' },
  { key: 'reachable', label: 'Shop reachable', status: 'PASS', detail: 'gorjana.myshopify.com', durationMillis: 84 },
  { key: 'apiVersion', label: 'API version supported', status: 'PASS', detail: '2024-10' },
  { key: 'ordersRead', label: 'Orders readable', status: 'PASS', detail: '1 order returned', durationMillis: 412 },
]

const failingChecks: ConnectionCheck[] = [
  { key: 'credential', label: 'Credential readable', status: 'PASS' },
  { key: 'reachable', label: 'Shop reachable', status: 'PASS', durationMillis: 91 },
  { key: 'auth', label: 'Credentials accepted', status: 'FAIL', detail: '401 — token not accepted' },
  { key: 'ordersRead', label: 'Orders readable', status: 'SKIP', detail: 'Not attempted.' },
]

function mountPopup(props: Partial<Record<string, unknown>> = {}) {
  return mount(ConnectionDiagnosticsPopup, {
    props: {
      running: false,
      available: true,
      connectionOk: true,
      checks: passingChecks,
      error: null,
      ...props,
    },
  })
}

describe('ConnectionDiagnosticsPopup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders one rail step per check with a glyph and a text status', () => {
    const wrapper = mountPopup()
    const rows = wrapper.findAll('[data-testid="connection-diagnostics-check"]')
    const credential = wrapper.get('[data-check-key="credential"]')

    expect(rows).toHaveLength(4)
    expect(credential.text()).toContain('Credential readable')
    expect(credential.text()).toContain('✓')
    // The glyph is aria-hidden and the palette is monochrome, so the status must also be words.
    expect(credential.get('.sr-only').text()).toBe('Passed')
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
  })

  it('gives every detail its own line so nothing truncates', () => {
    // The reason this layout beat the one-line variant: a detail IS the actionable part, and
    // "The token is missing the read_orders s..." is useless.
    const wrapper = mountPopup({ connectionOk: false, checks: failingChecks })
    const failed = wrapper.get('[data-check-key="auth"]')
    const detail = failed.get('.connection-diagnostics-detail')

    expect(detail.text()).toBe('401 — token not accepted')
    expect(getComputedStyle(detail.element).textOverflow).not.toBe('ellipsis')
  })

  it('draws one rail for the whole list rather than per step', () => {
    // Per-step lines fragment as rows stream in; a single list-level rail cannot.
    const wrapper = mountPopup()
    expect(wrapper.findAll('.connection-diagnostics-rail')).toHaveLength(1)
    expect(wrapper.findAll('.connection-diagnostics-node')).toHaveLength(4)
  })

  it('does not render per-check timings', () => {
    // Timings stay in the API and the server log for troubleshooting, but an operator asking
    // "does this connection work" is not asking how many milliseconds it took.
    const wrapper = mountPopup()

    expect(wrapper.text()).not.toContain('ms')
    expect(wrapper.find('.connection-diagnostics-duration').exists()).toBe(false)
  })

  it('renders no status badges — the design system is monochrome', () => {
    // --success and --danger are both greys, so a badge added chrome without adding signal.
    expect(mountPopup().find('.status-badge').exists()).toBe(false)
  })

  it('marks failed and skipped steps distinctly', () => {
    const wrapper = mountPopup({ connectionOk: false, checks: failingChecks })
    const failed = wrapper.get('[data-check-key="auth"]')
    const skipped = wrapper.get('[data-check-key="ordersRead"]')

    expect(failed.text()).toContain('✗')
    expect(failed.get('.sr-only').text()).toBe('Failed')
    expect(failed.text()).toContain('401 — token not accepted')
    // Skipped must not read as failed: nothing was attempted.
    expect(skipped.get('.sr-only').text()).toBe('Skipped')
    expect(skipped.text()).not.toContain('✗')
  })

  it('never dismisses itself, on any outcome', () => {
    // The popup waits for the operator on every result. A pass is still something to read —
    // timings, the shop domain, whether orders came back — so nothing is on a timer.
    const passing = mountPopup()
    const failing = mountPopup({ connectionOk: false, checks: failingChecks })
    const unavailable = mountPopup({ available: false, connectionOk: false, checks: [] })

    vi.advanceTimersByTime(600_000)

    expect(passing.emitted('close')).toBeUndefined()
    expect(failing.emitted('close')).toBeUndefined()
    expect(unavailable.emitted('close')).toBeUndefined()
  })

  it('always offers a close control', () => {
    expect(mountPopup().find('[data-testid="connection-diagnostics-close"]').exists()).toBe(true)
    expect(
      mountPopup({ connectionOk: false, checks: failingChecks })
        .find('[data-testid="connection-diagnostics-close"]')
        .exists(),
    ).toBe(true)
    expect(
      mountPopup({ running: true, checks: [] })
        .find('[data-testid="connection-diagnostics-close"]')
        .exists(),
    ).toBe(true)
  })

  it('closes on the close button, on Escape and on a click outside', async () => {
    const byButton = mountPopup()
    await byButton.get('[data-testid="connection-diagnostics-close"]').trigger('click')
    expect(byButton.emitted('close')).toHaveLength(1)

    const byEscape = mountPopup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(byEscape.emitted('close')).toHaveLength(1)

    const byBackdrop = mountPopup()
    await byBackdrop.get('[data-testid="connection-diagnostics-popup"]').trigger('click')
    expect(byBackdrop.emitted('close')).toHaveLength(1)
  })

  it('shows decided steps alongside a pending one while the walk is still going', () => {
    const wrapper = mountPopup({ running: true, checks: passingChecks.slice(0, 2) })

    expect(wrapper.findAll('[data-testid="connection-diagnostics-check"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(true)
    // Never claims a verdict mid-walk — an interim "not usable" would be a lie about checks
    // that have not run.
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Running diagnostics...')
  })

  it('counts progress without inventing a total it cannot know', () => {
    // Stages arrive one at a time and the server never says how many are coming, so "2 of 4"
    // would mean hardcoding a per-connector stage count in the UI.
    const started = mountPopup({ running: true, checks: [] })
    expect(started.get('[data-testid="connection-diagnostics-summary"]').text()).toBe('Starting...')

    const midway = mountPopup({ running: true, checks: passingChecks.slice(0, 2) })
    const summary = midway.get('[data-testid="connection-diagnostics-summary"]').text()
    expect(summary).toBe('2 checks complete')
    expect(summary).not.toContain(' of ')
  })

  it('names the failed check in the summary, and tallies the rest', () => {
    const wrapper = mountPopup({ connectionOk: false, checks: failingChecks })

    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is not usable.')
    // 2 PASS, 1 FAIL, 1 SKIP — the failure is named because it is the only actionable part.
    expect(wrapper.get('[data-testid="connection-diagnostics-summary"]').text())
      .toBe('Credentials accepted failed · 2 passed, 1 skipped')
  })

  it('summarises a clean run by count alone', () => {
    const wrapper = mountPopup()

    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
    expect(wrapper.get('[data-testid="connection-diagnostics-summary"]').text()).toBe('4 checks passed')
  })

  it('renders a service failure as an error rather than a stuck spinner', () => {
    const wrapper = mountPopup({ connectionOk: false, checks: [], error: 'Failed to run diagnostics.' })

    expect(wrapper.text()).toContain('Failed to run diagnostics.')
    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(false)
  })

  it('reports connectors that do not support diagnostics', () => {
    const wrapper = mountPopup({ available: false, connectionOk: false, checks: [] })

    expect(wrapper.find('[data-testid="connection-diagnostics-unavailable"]').exists()).toBe(true)
  })

  it('announces results politely and is a labelled modal dialog', () => {
    const wrapper = mountPopup()
    const dialog = wrapper.get('[data-testid="connection-diagnostics-popup"]')

    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('connection-diagnostics-title')
    // The verdict is announced rather than only rendered.
    expect(wrapper.get('[data-testid="connection-diagnostics-body"]').attributes('aria-live')).toBe('polite')
  })
})
