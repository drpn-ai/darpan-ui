import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDwellController, DWELL_MS, RELEASE_MS } from '../useMascotDwell'

function makeHooks() {
  return { onListen: vi.fn(), onSpeak: vi.fn(), onRelease: vi.fn() }
}

describe('createDwellController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('says nothing until the dwell has actually elapsed', () => {
    const hooks = makeHooks()
    const controller = createDwellController(hooks)

    controller.enter()
    expect(hooks.onListen).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(DWELL_MS - 1)
    expect(hooks.onSpeak).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(hooks.onSpeak).toHaveBeenCalledTimes(1)
    expect(controller.speaking).toBe(true)
  })

  it('can be outrun: leaving before the dwell completes never speaks', () => {
    const hooks = makeHooks()
    const controller = createDwellController(hooks)

    controller.enter()
    vi.advanceTimersByTime(DWELL_MS - 50)
    controller.leave()
    vi.advanceTimersByTime(DWELL_MS * 2)

    expect(hooks.onSpeak).not.toHaveBeenCalled()
    expect(controller.speaking).toBe(false)
  })

  it('holds the answer for the full release window after the pointer leaves', () => {
    const hooks = makeHooks()
    const controller = createDwellController(hooks)

    controller.enter()
    vi.advanceTimersByTime(DWELL_MS)
    controller.leave()

    vi.advanceTimersByTime(RELEASE_MS - 1)
    expect(hooks.onRelease).not.toHaveBeenCalled()
    expect(controller.releasing).toBe(true)

    vi.advanceTimersByTime(1)
    expect(hooks.onRelease).toHaveBeenCalledTimes(1)
    expect(controller.speaking).toBe(false)
  })

  it('cancels the release when the pointer comes back, without re-speaking', () => {
    const hooks = makeHooks()
    const controller = createDwellController(hooks)

    controller.enter()
    vi.advanceTimersByTime(DWELL_MS)
    controller.leave()
    vi.advanceTimersByTime(RELEASE_MS - 100)

    controller.enter()
    vi.advanceTimersByTime(RELEASE_MS * 2)

    // Coming back must keep the answer that is already on screen: releasing stops,
    // and the user does not have to wait out a second dwell to finish reading.
    expect(hooks.onRelease).not.toHaveBeenCalled()
    expect(hooks.onSpeak).toHaveBeenCalledTimes(1)
    expect(controller.speaking).toBe(true)
  })

  it('opens immediately on focus, because a Tab is already deliberate', () => {
    const hooks = makeHooks()
    const controller = createDwellController(hooks)

    controller.focus()

    expect(hooks.onSpeak).toHaveBeenCalledTimes(1)
    expect(hooks.onListen).not.toHaveBeenCalled()
  })

  it('drops every pending timer on cancel', () => {
    const hooks = makeHooks()
    const controller = createDwellController(hooks)

    controller.enter()
    controller.cancel()
    vi.advanceTimersByTime(DWELL_MS * 3)

    expect(hooks.onSpeak).not.toHaveBeenCalled()
    expect(controller.speaking).toBe(false)
  })

  it('honours a caller-supplied clock', () => {
    const hooks = makeHooks()
    const controller = createDwellController({ ...hooks, dwellMs: 250, releaseMs: 100 })

    controller.enter()
    vi.advanceTimersByTime(250)
    expect(hooks.onSpeak).toHaveBeenCalledTimes(1)

    controller.leave()
    vi.advanceTimersByTime(100)
    expect(hooks.onRelease).toHaveBeenCalledTimes(1)
  })
})
