import type { Router } from 'vue-router'

// Perf 2026-07-02: every route component is a lazy chunk, so the first visit to each page pays a
// network fetch mid-navigation. Once the user is authenticated, warm all route chunks during idle
// time so in-app navigations resolve their component from the module cache instead of the network.

type RouteComponentLoader = () => Promise<unknown>

type IdleScheduler = (callback: () => void, opts?: { timeout?: number }) => number

const IDLE_TIMEOUT_MS = 5_000
const TIMER_FALLBACK_DELAY_MS = 1_500

let scheduled = false

export function resetRoutePrefetchForTests(): void {
  scheduled = false
}

function collectLazyRouteLoaders(router: Router): RouteComponentLoader[] {
  const loaders = new Set<RouteComponentLoader>()
  for (const record of router.getRoutes()) {
    for (const component of Object.values(record.components ?? {})) {
      if (typeof component === 'function') loaders.add(component as RouteComponentLoader)
    }
  }
  return [...loaders]
}

export async function prefetchLazyRouteComponents(router: Router): Promise<void> {
  // Sequential on purpose: this is a background warm-up, not a race. One chunk at a time keeps
  // the network free for whatever the user is actively doing.
  for (const load of collectLazyRouteLoaders(router)) {
    try {
      await load()
    } catch {
      // Offline, or a deploy replaced the chunk this build references. The real navigation
      // import stays the source of truth and will surface its own error handling.
    }
  }
}

export function scheduleRoutePrefetch(router: Router): void {
  if (scheduled) return
  scheduled = true
  const run = () => {
    void prefetchLazyRouteComponents(router)
  }
  const requestIdle = (globalThis as { requestIdleCallback?: IdleScheduler }).requestIdleCallback
  if (typeof requestIdle === 'function') {
    requestIdle(run, { timeout: IDLE_TIMEOUT_MS })
  } else {
    setTimeout(run, TIMER_FALLBACK_DELAY_MS)
  }
}
