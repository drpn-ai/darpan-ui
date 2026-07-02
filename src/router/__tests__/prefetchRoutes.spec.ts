import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  prefetchLazyRouteComponents,
  resetRoutePrefetchForTests,
  scheduleRoutePrefetch,
} from '../prefetchRoutes'

const EAGER_COMPONENT = { template: '<div />' }

function buildRouter(loaders: Array<() => Promise<unknown>>) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: EAGER_COMPONENT },
      ...loaders.map((loader, index) => ({ path: `/lazy-${index}`, component: loader })),
    ],
  })
}

describe('route chunk prefetch', () => {
  afterEach(() => {
    resetRoutePrefetchForTests()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('loads every lazy route component, deduping shared loaders and tolerating failures', async () => {
    const shared = vi.fn(() => Promise.resolve({ template: '<div />' }))
    const failing = vi.fn(() => Promise.reject(new Error('offline')))
    const ok = vi.fn(() => Promise.resolve({ template: '<div />' }))
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: EAGER_COMPONENT },
        { path: '/a', component: shared },
        { path: '/b', component: shared },
        { path: '/c', component: failing },
        { path: '/d', component: ok },
      ],
    })

    await expect(prefetchLazyRouteComponents(router)).resolves.toBeUndefined()

    expect(shared).toHaveBeenCalledTimes(1)
    expect(failing).toHaveBeenCalledTimes(1)
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('schedules through requestIdleCallback at most once per session', async () => {
    const idleCallbacks: Array<() => void> = []
    vi.stubGlobal('requestIdleCallback', vi.fn((cb: () => void) => {
      idleCallbacks.push(cb)
      return idleCallbacks.length
    }))
    const loader = vi.fn(() => Promise.resolve({ template: '<div />' }))
    const router = buildRouter([loader])

    scheduleRoutePrefetch(router)
    scheduleRoutePrefetch(router)

    expect(idleCallbacks).toHaveLength(1)
    expect(loader).not.toHaveBeenCalled()

    idleCallbacks[0]?.()
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
  })

  it('falls back to a timer when requestIdleCallback is unavailable', async () => {
    vi.useFakeTimers()
    const loader = vi.fn(() => Promise.resolve({ template: '<div />' }))
    const router = buildRouter([loader])

    scheduleRoutePrefetch(router)
    expect(loader).not.toHaveBeenCalled()

    vi.runAllTimers()
    vi.useRealTimers()
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
  })
})
