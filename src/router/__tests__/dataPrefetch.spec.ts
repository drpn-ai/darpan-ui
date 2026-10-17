import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const f = vi.hoisted(() => ({
  listSavedRuns: vi.fn(async () => ({ savedRuns: [] })),
  listReconciliations: vi.fn(async () => ({ reconciliations: [] })),
  getReconciliation: vi.fn(async () => ({ reconciliation: { reconciliationId: 'R1' }, lifecycle: { nsAuthConfigId: 'net_prod', recordType: 'salesorder', recordLabel: 'Sales Orders' } })),
  listReconciliationExecutions: vi.fn(async () => ({ executions: [] })),
  getLifecycleRuleOptions: vi.fn<(options: Record<string, string>) => Promise<{ fields: never[] }>>(async () => ({ fields: [] })),
  listAutomations: vi.fn(async () => ({ automations: [] })),
}))
vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: f,
  settingsFacade: { listNsAuthConfigs: vi.fn(async () => ({ authConfigs: [] })) },
}))

import { HOVER_INTENT_MS, installDataPrefetch } from '../dataPrefetch'
import { cachedRead, readQueryOnce } from '../../lib/api/readCache'
import { lifecycleChart, lifecycleRuleFields } from '../../lib/api/queries'

const Blank = { template: '<div />' }
let router: Router
let authenticated = true
let uninstall: () => void = () => {}

function link(href: string): HTMLAnchorElement {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.textContent = href
  document.body.appendChild(anchor)
  return anchor
}

const hover = (el: Element) => el.dispatchEvent(new Event('pointerover', { bubbles: true }))

beforeEach(async () => {
  vi.useFakeTimers()
  Object.values(f).forEach((fn) => fn.mockClear())
  authenticated = true
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'hub', component: Blank },
      { path: '/reconciliation/automations', name: 'reconciliation-automations', component: Blank },
      { path: '/reconciliation/runs/:reconciliationId/settings', name: 'reconciliation-run-flowchart-settings', component: Blank },
      { path: '/reconciliation/runs/:reconciliationId/:reconciliationExecutionId?', name: 'reconciliation-run-flowchart', component: Blank },
      { path: '/about', name: 'about', component: Blank },
    ],
  })
  uninstall = installDataPrefetch(router, () => authenticated)
})

afterEach(() => {
  uninstall()
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('intent prefetch (DAR-UI-051)', () => {
  it('a pointer resting on a link warms the page it leads to', async () => {
    hover(link('/reconciliation/automations'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    expect(f.listAutomations).toHaveBeenCalledTimes(1)
  })

  it('a pointer sweeping across a link reads nothing', async () => {
    hover(link('/reconciliation/automations'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS / 2)
    hover(document.body)
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS * 2)
    expect(f.listAutomations).not.toHaveBeenCalled()
  })

  it('focus warms at once, for keyboard users', async () => {
    link('/reconciliation/automations').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(0)
    expect(f.listAutomations).toHaveBeenCalledTimes(1)
  })

  it('reads nothing for a signed-out tab', async () => {
    authenticated = false
    hover(link('/reconciliation/automations'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    expect(f.listAutomations).not.toHaveBeenCalled()
  })

  it('ignores links to other sites and pages it has no reads for', async () => {
    hover(link('https://example.com/reconciliation/automations'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    hover(link('/about'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    expect(f.listAutomations).not.toHaveBeenCalled()
  })

  it('hovering the same link twice asks once', async () => {
    const anchor = link('/reconciliation/automations')
    hover(anchor)
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    hover(document.body)
    hover(anchor)
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    expect(f.listAutomations).toHaveBeenCalledTimes(1)
  })

  it("a lifecycle's settings link warms the lifecycle, then its account's field lists", async () => {
    hover(link('/reconciliation/runs/R1/settings'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    expect(f.getReconciliation).toHaveBeenCalledWith({ reconciliationId: 'R1' })
    expect(f.getLifecycleRuleOptions.mock.calls.map(([args]) => args)).toEqual([
      { nsAuthConfigId: 'net_prod', recordType: 'salesorder' },
      { nsAuthConfigId: 'net_prod', recordType: 'salesorder', scope: 'STAGE' },
      { nsAuthConfigId: 'net_prod', recordType: 'salesorder', scope: 'FINDING' },
    ])
  })

  it('the page then opens from the warmed entries without asking again', async () => {
    hover(link('/reconciliation/runs/R1/settings'))
    await vi.advanceTimersByTimeAsync(HOVER_INTENT_MS)
    const apply = vi.fn()
    const chart = lifecycleChart('R1')
    void cachedRead(chart.key, () => new Promise(() => {}), apply)
    expect(apply).toHaveBeenCalledTimes(1)
    await readQueryOnce(lifecycleRuleFields({ nsAuthConfigId: 'net_prod', recordType: 'salesorder' }, 'STAGE'), 60_000)
    expect(f.getReconciliation).toHaveBeenCalledTimes(1)
    expect(f.getLifecycleRuleOptions).toHaveBeenCalledTimes(3)
  })
})

describe('session preload (DAR-UI-051)', () => {
  it("warms the hub's lists once signed in and idle", async () => {
    await router.push('/about')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(f.listSavedRuns).toHaveBeenCalledTimes(1)
    expect(f.listReconciliations).toHaveBeenCalledTimes(1)
  })

  it('does not ask again on every navigation', async () => {
    await router.push('/about')
    await vi.advanceTimersByTimeAsync(2_000)
    await router.push('/reconciliation/automations')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(f.listSavedRuns).toHaveBeenCalledTimes(1)
  })

  it('reads nothing before sign-in', async () => {
    authenticated = false
    await router.push('/about')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(f.listSavedRuns).not.toHaveBeenCalled()
  })
})
