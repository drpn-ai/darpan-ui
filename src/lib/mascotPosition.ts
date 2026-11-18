/**
 * DAR-UI-131. Where Tara stands once she has been dragged out of her corner.
 *
 * The spot lives in sessionStorage on purpose: it belongs to this tab and dies with it, so a new
 * tab, or this one reopened later, finds her back in the corner. (A tab the browser DUPLICATES
 * copies its sessionStorage, so a duplicate starts where the original stood. That is the
 * browser's rule, not ours.)
 *
 * Stored as the centre of the face in fractions of the viewport rather than pixels, so a window
 * that is resized, or a laptop moved to a bigger screen, keeps her in the same part of the page;
 * {@link placeMascotDock} then clamps her back inside whatever viewport there is.
 */
export const MASCOT_POSITION_KEY = 'darpan.mascotPosition'

/** The face's centre, each axis as a fraction of the viewport (0 = left/top, 1 = right/bottom). */
export interface MascotSpot {
  x: number
  y: number
}

/** Kept clear of every edge, so she can never be dragged half off the page. */
export const MASCOT_EDGE_MARGIN_PX = 8

export interface MascotDockPlacement {
  /** Inline style for the dock: fixed, anchored to the side nearer the face. */
  style: Record<string, string>
  /**
   * On the left half her bubble opens to her RIGHT. Anchored left, the face stays put while the
   * bubble grows away from it, exactly as it does from the corner on the right.
   */
  flipped: boolean
  /** The clamped spot, which is what gets saved: she stays exactly where she was let go. */
  spot: MascotSpot
}

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

export function readMascotSpot(): MascotSpot | null {
  try {
    const raw = window.sessionStorage.getItem(MASCOT_POSITION_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Record<string, unknown>
    return isFraction(stored.x) && isFraction(stored.y) ? { x: stored.x, y: stored.y } : null
  } catch {
    // Blocked storage or a hand-edited value: she simply starts in the corner.
    return null
  }
}

export function saveMascotSpot(spot: MascotSpot): void {
  try {
    window.sessionStorage.setItem(MASCOT_POSITION_KEY, JSON.stringify(spot))
  } catch {
    // Storage refused: she still stands where she was dropped until the page reloads.
  }
}

function clamp(value: number, low: number, high: number): number {
  return high < low ? (low + high) / 2 : Math.min(Math.max(value, low), high)
}

export function placeMascotDock(
  spot: MascotSpot,
  size: number,
  viewportWidth: number,
  viewportHeight: number,
): MascotDockPlacement {
  const half = size / 2 + MASCOT_EDGE_MARGIN_PX
  const cx = clamp(spot.x * viewportWidth, half, viewportWidth - half)
  const cy = clamp(spot.y * viewportHeight, half, viewportHeight - half)
  const flipped = cx < viewportWidth / 2
  const bottom = `${Math.round(viewportHeight - (cy + size / 2))}px`
  const style: Record<string, string> = flipped
    ? { left: `${Math.round(cx - size / 2)}px`, bottom }
    : { right: `${Math.round(viewportWidth - (cx + size / 2))}px`, bottom }
  return {
    style,
    flipped,
    spot: { x: cx / viewportWidth, y: cy / viewportHeight },
  }
}
