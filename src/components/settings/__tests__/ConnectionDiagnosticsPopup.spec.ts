import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ConnectionDiagnosticsPopup from '../ConnectionDiagnosticsPopup.vue'
import type { ConnectionCheck } from '../../../lib/api/types'

const passingChecks: ConnectionCheck[] = [
  { key: 'credential', label: 'Credential readable', status: 'PASS' },
  { key: 'reachable', label: 'Shop reachable', status: 'PASS', durationMillis: 84 },
  { key: 'apiVersion', label: 'API version supported', status: 'PASS', detail: '2026-01' },
  { key: 'ordersRead', label: 'Orders readable', status: 'PASS', durationMillis: 412 },
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
    expect(wrapper.get('[data-check-key="reachable"]').text()).toContain('84ms')
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
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

  it('closes itself two seconds after a fully successful run', async () => {
    const wrapper = mountPopup()

    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1999)
    expect(wrapper.emitted('close')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stays open indefinitely when any check failed', () => {
    const wrapper = mountPopup({ connectionOk: false, checks: failingChecks })

    vi.advanceTimersByTime(60_000)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('cancels the auto-close when the operator hovers it', async () => {
    const wrapper = mountPopup()

    await wrapper.get('.connection-diagnostics-popup').trigger('mouseenter')
    vi.advanceTimersByTime(60_000)

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('cancels the auto-close when focus moves inside it', async () => {
    const wrapper = mountPopup()

    await wrapper.get('.connection-diagnostics-popup').trigger('focusin')
    vi.advanceTimersByTime(60_000)

    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('offers no close control while it is about to auto-close, and one once held open', async () => {
    const wrapper = mountPopup()
    expect(wrapper.find('[data-testid="connection-diagnostics-close"]').exists()).toBe(false)

    await wrapper.get('.connection-diagnostics-popup').trigger('mouseenter')
    expect(wrapper.find('[data-testid="connection-diagnostics-close"]').exists()).toBe(true)
  })

  it('closes on the close button, on Escape and on a click outside', async () => {
    const byButton = mountPopup({ connectionOk: false, checks: failingChecks })
    await byButton.get('[data-testid="connection-diagnostics-close"]').trigger('click')
    expect(byButton.emitted('close')).toHaveLength(1)

    const byEscape = mountPopup({ connectionOk: false, checks: failingChecks })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(byEscape.emitted('close')).toHaveLength(1)

    const byBackdrop = mountPopup({ connectionOk: false, checks: failingChecks })
    await byBackdrop.get('[data-testid="connection-diagnostics-popup"]').trigger('click')
    expect(byBackdrop.emitted('close')).toHaveLength(1)
  })

  it('shows a running state instead of rows while the probe is in flight', () => {
    const wrapper = mountPopup({ running: true, checks: [] })

    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="connection-diagnostics-check"]')).toHaveLength(0)
    // A run still in flight must never trip the success timer.
    vi.advanceTimersByTime(60_000)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('renders a service failure as an error rather than a stuck spinner', () => {
    const wrapper = mountPopup({ connectionOk: false, checks: [], error: 'Failed to run diagnostics.' })

    expect(wrapper.text()).toContain('Failed to run diagnostics.')
    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(false)
    vi.advanceTimersByTime(60_000)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('reports connectors that do not support diagnostics', () => {
    const wrapper = mountPopup({ available: false, connectionOk: false, checks: [] })

    expect(wrapper.find('[data-testid="connection-diagnostics-unavailable"]').exists()).toBe(true)
    vi.advanceTimersByTime(60_000)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('announces results politely and is a labelled modal dialog', () => {
    const wrapper = mountPopup()
    const dialog = wrapper.get('[data-testid="connection-diagnostics-popup"]')

    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('connection-diagnostics-title')
    // The verdict must be announced before a success popup disappears.
    expect(wrapper.get('[data-testid="connection-diagnostics-body"]').attributes('aria-live')).toBe('polite')
  })
})
