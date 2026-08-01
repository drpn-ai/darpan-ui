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

  it('renders one row per check with a glyph, label and status', () => {
    const wrapper = mountPopup()
    const rows = wrapper.findAll('[data-testid="connection-diagnostics-check"]')
    const credential = wrapper.get('[data-check-key="credential"]')

    expect(rows).toHaveLength(4)
    expect(credential.text()).toContain('Credential readable')
    expect(credential.text()).toContain('✓')
    // Status is carried by a text label too, never by colour alone.
    expect(credential.text()).toContain('Passed')
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
  })

  it('keeps the badge on the main line, with the detail below it', () => {
    // Regression: the detail used to span the row grid to its last column, which pushed the badge
    // onto a new implicit row starting at column 1 — it rendered outside the card's padding and
    // overlapped its border. Only rows carrying a detail were affected, so the shape to pin is
    // that the detail is NOT a sibling of the badge.
    const wrapper = mountPopup()
    const withDetail = wrapper.get('[data-check-key="reachable"]')
    const mainLine = withDetail.get('.connection-diagnostics-main')

    expect(mainLine.find('.status-badge').exists()).toBe(true)
    expect(mainLine.find('.connection-diagnostics-detail').exists()).toBe(false)

    const detail = withDetail.get('.connection-diagnostics-detail')
    expect(detail.element.parentElement).toBe(withDetail.element)
  })

  it('does not render per-check timings', () => {
    // Timings stay in the API and the server log for troubleshooting, but an operator asking
    // "does this connection work" is not asking how many milliseconds it took.
    const wrapper = mountPopup()

    expect(wrapper.text()).not.toContain('ms')
    expect(wrapper.find('.connection-diagnostics-duration').exists()).toBe(false)
  })

  it('marks failed and skipped rows distinctly', () => {
    const wrapper = mountPopup({ connectionOk: false, checks: failingChecks })
    const rows = wrapper.findAll('[data-testid="connection-diagnostics-check"]')

    const failed = rows.find((row) => row.attributes('data-check-key') === 'auth')
    const skipped = rows.find((row) => row.attributes('data-check-key') === 'ordersRead')

    expect(failed?.text()).toContain('✗')
    expect(failed?.text()).toContain('Failed')
    expect(failed?.text()).toContain('401 — token not accepted')
    // Skipped must not read as failed: nothing was attempted.
    expect(skipped?.text()).toContain('Skipped')
    expect(skipped?.text()).not.toContain('✗')
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is not usable.')
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

  it('shows completed rows alongside a pending row while the walk is still going', () => {
    // Stages stream in, so rows already decided must stay on screen while the next one runs.
    const wrapper = mountPopup({ running: true, checks: passingChecks.slice(0, 2) })

    expect(wrapper.findAll('[data-testid="connection-diagnostics-check"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(true)
    // No verdict until the walk finishes — an interim "not usable" would be a lie.
    expect(wrapper.find('[data-testid="connection-diagnostics-verdict"]').exists()).toBe(false)
  })

  it('drops the pending row and states the verdict once the walk finishes', () => {
    const wrapper = mountPopup()

    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
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
