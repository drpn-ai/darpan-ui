import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { push, replace, route } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  route: { params: { audit: 'month-close' }, query: { period: '2026-09' } as Record<string, string>, fullPath: '/reconciliation/audits/month-close/run?period=2026-09' },
}))
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ push, replace }) }))
vi.mock('../../../lib/api/facade', () => ({ auditFacade: { runAudit: vi.fn(), getAuditSettings: vi.fn() } }))
const session = vi.hoisted(() => ({ sessionInfo: { userId: 'U1', tenantTimeZone: 'America/Los_Angeles' as string | undefined } }))
vi.mock('../../../stores/auth', () => ({ useAuthStore: () => session }))

import { auditFacade } from '../../../lib/api/facade'
import AuditRunStartPage from '../AuditRunStartPage.vue'
import { useMascotStore } from '../../../stores/mascot'
import { setDefaultDisplayTimeZone } from '../../../lib/utils/date'

const f = vi.mocked(auditFacade)
const back = { name: 'audit-report', params: { audit: 'month-close' }, query: { period: '2026-09' } }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 17, 12))
  push.mockReset()
  replace.mockReset()
  // As the router does: a navigation is a promise.
  replace.mockResolvedValue(undefined)
  f.getAuditSettings.mockReset()
  f.getAuditSettings.mockResolvedValue({ ok: true, settings: { playableFrom: null } } as never)
  f.runAudit.mockReset()
  f.runAudit.mockResolvedValue({ ok: true, runs: [{ automationId: 'A1', savedRunId: 'S1', submitted: true, error: null }] } as never)
})
afterEach(() => vi.useRealTimers())

function form(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowStepForm' }) }

async function pick(w: ReturnType<typeof mount>, preset: string) {
  await w.get(`[data-testid="audit-start-window-${preset}"]`).trigger('click')
}

async function submit(w: ReturnType<typeof mount>) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('AuditRunStartPage', () => {
  it('asks which days with the run cards, nothing picked yet', async () => {
    const w = mount(AuditRunStartPage)
    await flushPromises()
    expect(w.text()).toContain('Which days should this run look at?')
    const labels = w.findAll('.workflow-shortcut-choice-card__label').map((l) => l.text())
    expect(labels[0]).toBe('Previous Day, Aug 16, 2026')
    expect(labels[3]).toBe('Custom Dates, select start and end dates')
    expect(form(w).props('submitDisabled')).toBe(true)
  })

  // DAR-UI-063. Only days the audit can still record: on Aug 17 a monthly audit plays from Aug 1 unless July is extended,
  // so a card reaching into July is not offered and July's days cannot be picked; Month to Date (DAR-UI-112) starts Aug 1.
  // From Aug 11 the week (Aug 10) and the month to date drop out.
  it('offers only days the audit can still record', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { playableFrom: '2026-08-01' } } as never)
    const w = mount(AuditRunStartPage)
    await flushPromises()
    expect(f.getAuditSettings).toHaveBeenCalledWith({ audit: 'month-close' })
    const labels = w.findAll('.workflow-shortcut-choice-card__label').map((l) => l.text())
    expect(labels).toEqual(['Previous Day, Aug 16, 2026', 'Previous Week, Aug 10, 2026 to Aug 16, 2026',
      'Month to Date, Aug 1, 2026 to Aug 16, 2026', 'Custom Dates, select start and end dates'])
  })

  it('drops a card that starts before the first playable day', async () => {
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { playableFrom: '2026-08-11' } } as never)
    const w = mount(AuditRunStartPage)
    await flushPromises()
    const labels = w.findAll('.workflow-shortcut-choice-card__label').map((l) => l.text())
    expect(labels).toEqual(['Previous Day, Aug 16, 2026', 'Custom Dates, select start and end dates'])
  })

  it('runs every check over the card\'s days, the last day included, and returns to the audit saying it started', async () => {
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    await submit(w)
    expect(f.runAudit).toHaveBeenCalledWith({ audit: 'month-close', fromDate: '2026-08-16', thruDate: '2026-08-16' })
    expect(replace).toHaveBeenCalledWith({ ...back, state: { startedAudit: true } })
  })

  // DAR-BE-328. Inside peak hours the run still starts; the audit says until when, in place of its own "Running" line.
  it('carries the peak-hours note to the audit when play starts inside peak hours', async () => {
    // On the tenant's clock, the one its peak hours are set in, though the viewer reads Kolkata time.
    setDefaultDisplayTimeZone('Asia/Kolkata')
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { playableFrom: null, peakHoursUntil: '2026-08-18T06:00:00Z' } } as never)
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    await submit(w)
    expect(f.runAudit).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ ...back, state: { startedAudit: true, peakNotice: 'Peak hours until 23:00.' } })
    setDefaultDisplayTimeZone(undefined)
  })

  it('runs on Enter after a letter picked the card, as the page says', async () => {
    const w = mount(AuditRunStartPage, { attachTo: document.body })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }))
    await flushPromises()
    expect(f.runAudit).toHaveBeenCalledWith({ audit: 'month-close', fromDate: '2026-08-16', thruDate: '2026-08-16' })
    w.unmount()
  })

  it('a week runs its seven days through yesterday; a month runs to its last day', async () => {
    const w = mount(AuditRunStartPage, { attachTo: document.body })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    await submit(w)
    expect(f.runAudit).toHaveBeenLastCalledWith({ audit: 'month-close', fromDate: '2026-08-10', thruDate: '2026-08-16' })
    w.unmount()

    const m = mount(AuditRunStartPage)
    await flushPromises()
    await pick(m, 'month-to-date')
    await submit(m)
    expect(f.runAudit).toHaveBeenLastCalledWith({ audit: 'month-close', fromDate: '2026-08-01', thruDate: '2026-08-16' })
  })

  it('Custom Dates runs over the picked days, the last one included, and offers no day after today', async () => {
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'custom')
    expect(w.text()).toContain('Select custom dates')
    expect(w.get('[data-testid="audit-start-custom-day-2026-08-17"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-testid="audit-start-custom-day-2026-08-18"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="audit-start-custom-day-2026-08-03"]').trigger('click')
    await w.get('[data-testid="audit-start-custom-day-2026-08-05"]').trigger('click')
    await submit(w)
    expect(f.runAudit).toHaveBeenCalledWith({ audit: 'month-close', fromDate: '2026-08-03', thruDate: '2026-08-05' })
  })

  // DAR-UI-156 (Aditi: "UI changes should always be immediate.. backend can do its thing"). The audit opens on the
  // click; a refusal is raised by the mascot, where it stays until read, with the way back to choose the window again.
  it('opens the audit before run#Audit answers, and raises a refusal with the way back', async () => {
    let refuse: (reason: unknown) => void = () => {}
    f.runAudit.mockReturnValue(new Promise((_, reject) => { refuse = reject }) as never)
    f.getAuditSettings.mockResolvedValue({ ok: true, settings: { playableFrom: null, audit: { id: 'month-close', name: 'Month close', period: '2026-09' } } } as never)
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'month-to-date')
    await submit(w)
    expect(replace).toHaveBeenCalledTimes(1)

    refuse(new Error('2026-07 ended on 2026-07-31 and is not extended to 2026-08-17; extend it to run its days.'))
    await flushPromises()
    const [warning] = useMascotStore().warnings
    // Named, as a run's refusal is: the warning may be read on another audit's page.
    expect(warning).toMatchObject({ id: 'audit-start-month-close', title: 'An audit did not start', prompt: 'Month close did not start.' })
    expect(warning!.body).toContain('2026-07 ended on 2026-07-31 and is not extended')
    await warning!.actions[0]!.run()
    expect(push).toHaveBeenCalledWith('/reconciliation/audits/month-close/run?period=2026-09')
  })

  // The mascot puts its warnings away on every page change: a refusal that beats the navigation waits for it.
  it('raises a refusal that answers before the audit has opened only once it has', async () => {
    f.runAudit.mockRejectedValue(new Error('2026-07 ended on 2026-07-31 and is not extended to 2026-08-17; extend it to run its days.'))
    let land: () => void = () => {}
    replace.mockReturnValueOnce(new Promise<void>((resolve) => { land = resolve }))
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'month-to-date')
    w.get('form').trigger('submit')
    await flushPromises()
    expect(useMascotStore().warnings).toEqual([])
    land()
    await flushPromises()
    expect(useMascotStore().warnings[0]).toMatchObject({ id: 'audit-start-month-close' })
  })

  it('a double submit starts one run', async () => {
    let resolve: (v: unknown) => void = () => {}
    f.runAudit.mockReturnValue(new Promise((r) => { resolve = r }) as never)
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    await w.get('form').trigger('submit')
    await w.get('form').trigger('submit')
    resolve({ ok: true, runs: [] })
    await flushPromises()
    expect(f.runAudit).toHaveBeenCalledTimes(1)
  })

  it('Back from the calendar returns to the cards; Back from the cards returns to the audit without running', async () => {
    const w = mount(AuditRunStartPage)
    await flushPromises()
    await pick(w, 'custom')
    form(w).vm.$emit('back')
    await flushPromises()
    expect(w.text()).toContain('Which days should this run look at?')
    expect(push).not.toHaveBeenCalled()
    form(w).vm.$emit('back')
    expect(push).toHaveBeenCalledWith(back)
    expect(f.runAudit).not.toHaveBeenCalled()
  })
})
