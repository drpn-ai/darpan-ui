import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createIdleHintController, HINT_VISIBLE_MS, IDLE_HINT_MS } from '../useIdleHints'

function setup(hints: string[], canOffer = () => true) {
  const onOffer = vi.fn()
  const onExpire = vi.fn()
  const controller = createIdleHintController({ getHints: () => hints, canOffer, onOffer, onExpire })
  return { controller, onOffer, onExpire }
}

describe('createIdleHintController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('says nothing until the page has actually sat still', () => {
    const { controller, onOffer } = setup(['first', 'second'])
    controller.enter()

    vi.advanceTimersByTime(IDLE_HINT_MS - 1)
    expect(onOffer).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onOffer).toHaveBeenCalledWith('first')
  })

  it('offers once and then waits — it does not lecture every five seconds', () => {
    const { controller, onOffer } = setup(['first', 'second', 'third'])
    controller.enter()

    vi.advanceTimersByTime(IDLE_HINT_MS * 6)

    // Someone reading quietly gets one offer, not one per interval.
    expect(onOffer).toHaveBeenCalledTimes(1)
  })

  it('offers the next one only after the person has done something', () => {
    const { controller, onOffer } = setup(['first', 'second'])
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)

    controller.noteActivity()
    vi.advanceTimersByTime(IDLE_HINT_MS)

    expect(onOffer).toHaveBeenNthCalledWith(2, 'second')
  })

  it('restarts the clock on every action, so an active page stays quiet', () => {
    const { controller, onOffer } = setup(['first'])
    controller.enter()

    for (let i = 0; i < 5; i += 1) {
      vi.advanceTimersByTime(IDLE_HINT_MS - 500)
      controller.noteActivity()
    }

    expect(onOffer).not.toHaveBeenCalled()
  })

  it('stops arming once the page has run out of things to say', () => {
    const { controller, onOffer } = setup(['only one'])
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)

    controller.noteActivity()
    vi.advanceTimersByTime(IDLE_HINT_MS * 4)

    expect(onOffer).toHaveBeenCalledTimes(1)
  })

  it('keeps a hint in the queue when it could not be offered', () => {
    // The mascot was mid-answer when the moment came. The hint has not been used up.
    let busy = true
    const { controller, onOffer } = setup(['first', 'second'], () => !busy)
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)
    expect(onOffer).not.toHaveBeenCalled()

    busy = false
    controller.noteActivity()
    vi.advanceTimersByTime(IDLE_HINT_MS)

    expect(onOffer).toHaveBeenCalledWith('first')
  })

  it('says nothing at all on a page with no hints written for it', () => {
    const { controller, onOffer } = setup([])
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS * 3)

    expect(onOffer).not.toHaveBeenCalled()
  })

  it('retires the offer on its own after it has been up long enough', () => {
    // Nobody asked for it, so it must not need dismissing.
    const { controller, onOffer, onExpire } = setup(['first'])
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)
    expect(onOffer).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(HINT_VISIBLE_MS - 1)
    expect(onExpire).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('does not retire an offer the person already dismissed by acting', () => {
    const { controller, onExpire } = setup(['first', 'second'])
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)

    // Acting clears the bubble itself; expiring afterwards would clear whatever the
    // action put on screen instead.
    controller.noteActivity()
    vi.advanceTimersByTime(HINT_VISIBLE_MS * 2)

    expect(onExpire).not.toHaveBeenCalled()
  })

  it('drops the pending offer on stop', () => {
    const { controller, onOffer } = setup(['first'])
    controller.enter()
    controller.stop()
    vi.advanceTimersByTime(IDLE_HINT_MS * 2)

    expect(onOffer).not.toHaveBeenCalled()
  })

  it('starts a new page from the top of its list', () => {
    const { controller, onOffer } = setup(['first', 'second'])
    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)
    expect(onOffer).toHaveBeenCalledWith('first')

    controller.enter()
    vi.advanceTimersByTime(IDLE_HINT_MS)

    expect(onOffer).toHaveBeenNthCalledWith(2, 'first')
  })
})
