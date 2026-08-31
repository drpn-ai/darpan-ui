/**
 * Offers a hint when someone has been on a page for a while without doing anything.
 *
 * "Doing anything" means acting, not existing: clicking, typing, editing. Moving the
 * pointer while reading is not activity — counting it would mean the hint only ever
 * appears to someone who has walked away from the screen, which is precisely the person
 * who does not need it.
 *
 * Two rules keep this from nagging. One hint per idle stretch, and the next only after
 * the person has acted. Someone who sits still reading gets a single offer, not a lecture
 * every five seconds; someone who tries something and stalls again gets the next idea.
 */
export const IDLE_HINT_MS = 5000
/**
 * How long an unprompted hint stays up. It is an offer, not a message: nobody asked for
 * it, so it should not need dismissing. Long enough to read one line, short enough that
 * looking away is all it takes to be rid of it.
 */
export const HINT_VISIBLE_MS = 3000

export interface IdleHintOptions {
  /** Hints for the page, in the order they should be offered. */
  getHints: () => readonly string[]
  /** False while the mascot is already saying something — never talk over an answer. */
  canOffer: () => boolean
  onOffer: (hint: string) => void
  /** Called when the offer has been up long enough and should retire itself. */
  onExpire?: () => void
  idleMs?: number
  visibleMs?: number
}

export interface IdleHintController {
  /** Begin (or restart for a new page) — resets which hints have been used. */
  enter: () => void
  /** The person did something. Cancels the pending offer and arms the next one. */
  noteActivity: () => void
  /** Tear down every timer. */
  stop: () => void
  readonly offeredCount: number
}

export function createIdleHintController(options: IdleHintOptions): IdleHintController {
  const idleMs = options.idleMs ?? IDLE_HINT_MS
  const visibleMs = options.visibleMs ?? HINT_VISIBLE_MS
  let timer: ReturnType<typeof setTimeout> | null = null
  let visibleTimer: ReturnType<typeof setTimeout> | null = null
  let offered = 0

  function clearVisible(): void {
    if (visibleTimer !== null) {
      clearTimeout(visibleTimer)
      visibleTimer = null
    }
  }

  function clear(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function arm(): void {
    clear()
    // Nothing left to say on this page: stop arming rather than waking up to find out.
    if (offered >= options.getHints().length) return
    timer = setTimeout(() => {
      timer = null
      const hints = options.getHints()
      const next = hints[offered]
      if (next === undefined) return
      // Losing the turn is not losing the hint — it stays next in line for the following
      // idle stretch rather than being consumed while the mascot was busy.
      if (!options.canOffer()) return
      offered += 1
      options.onOffer(next)
      // It retires on its own. Nobody asked for it, so it should not need dismissing.
      clearVisible()
      visibleTimer = setTimeout(() => {
        visibleTimer = null
        options.onExpire?.()
      }, visibleMs)
    }, idleMs)
  }

  return {
    enter(): void {
      offered = 0
      clearVisible()
      arm()
    },
    noteActivity(): void {
      clearVisible()
      arm()
    },
    stop(): void {
      clear()
      clearVisible()
    },
    get offeredCount(): number {
      return offered
    },
  }
}
