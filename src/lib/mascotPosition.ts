/**
 * DAR-UI-131. Where Tara stands once she has been dragged out of her corner.
 *
 * Nothing here is stored. The spot lives in the dock's memory for the life of the page, so moving
 * between screens keeps her where she was put, and any reload (a hard refresh included; a script
 * cannot tell the two apart), a new tab or a closed one finds her back in the corner.
 *
 * Kept as the centre of the face in fractions of the viewport rather than pixels, so a window
 * that is resized keeps her in the same part of the page; {@link placeMascotDock} then clamps her
 * back inside whatever viewport there is.
 */
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
  /** The clamped spot, which is what the dock keeps: she stays exactly where she was let go. */
  spot: MascotSpot
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
