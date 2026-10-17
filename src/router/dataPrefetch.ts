import type { Router } from 'vue-router'
import * as q from '../lib/api/queries'
import { prefetchQuery, readQueryOnce } from '../lib/api/readCache'

/**
 * DAR-UI-051. Warms the read cache before a page opens, so a first visit draws as fast as a revisit.
 *
 * Two triggers, matched to how likely the data is to be wanted:
 * - Session: the hub's lists, once the user is signed in and the browser is idle. Every session passes
 *   through Home, and these are two cheap reads.
 * - Intent: a link the pointer rests on, or that gets focus or a touch, warms the page it leads to. That is
 *   the next page with near certainty, and the 200–400ms between intent and click is about one round-trip.
 * Nothing heavier is guessed at: reads against a customer's NetSuite (field metadata) wait for intent.
 */

type ResolvedRoute = ReturnType<Router['resolve']>
type RoutePrefetch = (route: ResolvedRoute) => void

const param = (route: ResolvedRoute, name: string): string => {
  const value = route.params[name]
  return typeof value === 'string' ? value.trim() : ''
}

function warmLifecycle(id: string): void {
  if (!id) return
  void prefetchQuery(q.lifecycleChart(id))
  void prefetchQuery(q.lifecycleRules)
  void prefetchQuery(q.lifecycleExecutions(id))
}

/** Keyed by route name: what each page reads first. A route missing here is simply not prefetched. */
export const ROUTE_DATA: Record<string, RoutePrefetch> = {
  hub: () => {
    void prefetchQuery(q.homeSavedRuns)
    void prefetchQuery(q.homeReconciliations)
  },
  'reconciliation-run-flowchart': (route) => {
    warmLifecycle(param(route, 'reconciliationId'))
    const executionId = param(route, 'reconciliationExecutionId')
    if (executionId) void prefetchQuery(q.lifecycleExecution(executionId))
  },
  'reconciliation-run-flowchart-settings': (route) => {
    const id = param(route, 'reconciliationId')
    if (!id) return
    // The field pickers need the lifecycle's account and record type, so they follow the lifecycle.
    void readQueryOnce(q.lifecycleChart(id)).then(({ got }) => {
      if (!got.lifecycle) return
      const source = { nsAuthConfigId: got.lifecycle.nsAuthConfigId, recordType: got.lifecycle.recordType }
      for (const scope of [undefined, 'STAGE', 'FINDING'] as const) void prefetchQuery(q.lifecycleRuleFields(source, scope))
    }, () => {})
  },
  'reconciliation-run-flowchart-start': (route) => {
    const id = param(route, 'reconciliationId')
    if (id) void prefetchQuery(q.lifecycleChart(id))
  },
  'reconciliation-automations': () => { void prefetchQuery(q.automations) },
  'reconciliation-automation-dashboard': (route) => {
    const id = param(route, 'automationId')
    if (id) void prefetchQuery(q.automationDashboard(id))
  },
  'reconciliation-run-history': (route) => {
    const id = param(route, 'savedRunId')
    if (id) void prefetchQuery(q.runHistoryPage(id))
  },
  'reconciliation-run-result': (route) => {
    const fileName = param(route, 'outputFileName')
    if (fileName) void prefetchQuery(q.runResultFirstPage(fileName))
  },
  'settings-oms': () => { void prefetchQuery(q.settingsLists.oms) },
  'settings-runs': () => { void prefetchQuery(q.settingsLists.runs) },
  'settings-sftp': () => { void prefetchQuery(q.settingsLists.sftp) },
  'settings-shopify': () => { void prefetchQuery(q.settingsLists.shopify) },
}

/** How long a pointer must rest on a link before it counts as intent: sweeping across a tile grid does not. */
export const HOVER_INTENT_MS = 80
const SESSION_PRELOAD_FRESH_MS = 5 * 60_000
const IDLE_TIMEOUT_MS = 2_000

export function prefetchRoute(router: Router, to: string): void {
  let route: ResolvedRoute
  try {
    route = router.resolve(to)
  } catch {
    return
  }
  const prefetch = typeof route.name === 'string' ? ROUTE_DATA[route.name] : undefined
  prefetch?.(route)
}

function sameOriginPath(anchor: HTMLAnchorElement): string | null {
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  try {
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

function anchorOf(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest('a[href]') : null
}

function whenIdle(run: () => void): void {
  const requestIdle = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number })
    .requestIdleCallback
  if (typeof requestIdle === 'function') requestIdle(run, { timeout: IDLE_TIMEOUT_MS })
  else setTimeout(run, 0)
}

/** Wires both triggers. `isAuthenticated` gates everything: nothing is read for a signed-out tab. */
export function installDataPrefetch(router: Router, isAuthenticated: () => boolean): () => void {
  const prefetchAnchor = (anchor: HTMLAnchorElement | null) => {
    if (!anchor || !isAuthenticated()) return
    const path = sameOriginPath(anchor)
    if (path) prefetchRoute(router, path)
  }

  let hoverTimer: ReturnType<typeof setTimeout> | null = null
  let hovered: HTMLAnchorElement | null = null
  const onPointerOver = (event: Event) => {
    const anchor = anchorOf(event.target)
    if (anchor === hovered) return
    if (hoverTimer) clearTimeout(hoverTimer)
    hovered = anchor
    if (!anchor) return
    hoverTimer = setTimeout(() => {
      hoverTimer = null
      prefetchAnchor(anchor)
    }, HOVER_INTENT_MS)
  }
  const onImmediate = (event: Event) => prefetchAnchor(anchorOf(event.target))

  document.addEventListener('pointerover', onPointerOver, { passive: true })
  document.addEventListener('focusin', onImmediate)
  document.addEventListener('touchstart', onImmediate, { passive: true })

  const stopSessionPreload = router.afterEach(() => {
    if (!isAuthenticated()) return
    whenIdle(() => {
      if (!isAuthenticated()) return
      void prefetchQuery(q.homeSavedRuns, SESSION_PRELOAD_FRESH_MS)
      void prefetchQuery(q.homeReconciliations, SESSION_PRELOAD_FRESH_MS)
    })
  })

  return () => {
    if (hoverTimer) clearTimeout(hoverTimer)
    document.removeEventListener('pointerover', onPointerOver)
    document.removeEventListener('focusin', onImmediate)
    document.removeEventListener('touchstart', onImmediate)
    stopSessionPreload()
  }
}
