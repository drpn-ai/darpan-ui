/**
 * The timing half of the mascot's hover help, kept away from the DOM so it can be
 * tested on a clock rather than in a browser.
 *
 * Summoned by stillness, released by movement: rest on a target for DWELL_MS and it
 * speaks; move off and it fades for RELEASE_MS and is gone. The release runs its full
 * duration on purpose so it stays cancellable — coming back to the target, or onto the
 * bubble itself to finish reading, must return it rather than race the user.
 */
export const DWELL_MS = 1000
export const RELEASE_MS = 500

export interface DwellHooks {
  /** The dwell clock has started; the mascot should look like it is paying attention. */
  onListen: () => void
  /** The clock finished with the pointer still on the target. */
  onSpeak: () => void
  /** The release finished uninterrupted. */
  onRelease: () => void
  dwellMs?: number
  releaseMs?: number
}

export interface DwellController {
  /** Pointer arrived: start the clock, or cancel a release already in flight. */
  enter: () => void
  /** Pointer left: release if we were speaking, otherwise just stop the clock. */
  leave: () => void
  /** Focus is deliberate, so it skips the wait entirely. */
  focus: () => void
  /** Tear every timer down — used on unmount and on Escape. */
  cancel: () => void
  readonly speaking: boolean
  readonly releasing: boolean
}

export function createDwellController(hooks: DwellHooks): DwellController {
  const dwellMs = hooks.dwellMs ?? DWELL_MS
  const releaseMs = hooks.releaseMs ?? RELEASE_MS

  let dwellTimer: ReturnType<typeof setTimeout> | null = null
  let releaseTimer: ReturnType<typeof setTimeout> | null = null
  let speaking = false

  function stopDwell(): void {
    if (dwellTimer !== null) {
      clearTimeout(dwellTimer)
      dwellTimer = null
    }
  }

  function stopRelease(): void {
    if (releaseTimer !== null) {
      clearTimeout(releaseTimer)
      releaseTimer = null
    }
  }

  function speak(): void {
    dwellTimer = null
    speaking = true
    hooks.onSpeak()
  }

  return {
    enter(): void {
      // Coming back mid-release cancels it: the answer is still on screen and the
      // user has just reached for it.
      if (releaseTimer !== null) {
        stopRelease()
        return
      }
      if (speaking) return
      stopDwell()
      hooks.onListen()
      dwellTimer = setTimeout(speak, dwellMs)
    },

    leave(): void {
      stopDwell()
      if (!speaking) {
        hooks.onRelease()
        return
      }
      stopRelease()
      releaseTimer = setTimeout(() => {
        releaseTimer = null
        speaking = false
        hooks.onRelease()
      }, releaseMs)
    },

    focus(): void {
      stopRelease()
      stopDwell()
      speak()
    },

    cancel(): void {
      stopDwell()
      stopRelease()
      speaking = false
    },

    get speaking(): boolean {
      return speaking
    },

    get releasing(): boolean {
      return releaseTimer !== null
    },
  }
}
