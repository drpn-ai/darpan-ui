import { describe, expect, it } from 'vitest'
import { MASCOT_EDGE_MARGIN_PX, placeMascotDock } from '../mascotPosition'

describe('mascotPosition (DAR-UI-131)', () => {
  it('anchors right on the right half, so her bubble keeps growing leftward', () => {
    const placed = placeMascotDock({ x: 0.75, y: 0.5 }, 100, 1000, 800)

    expect(placed.flipped).toBe(false)
    // Centre at 750 -> right edge at 800 -> 200 from the viewport's right; bottom edge at 450.
    expect(placed.style).toEqual({ right: '200px', bottom: '350px' })
  })

  it('anchors left on the left half and flips the bubble to her right', () => {
    const placed = placeMascotDock({ x: 0.2, y: 0.5 }, 100, 1000, 800)

    expect(placed.flipped).toBe(true)
    expect(placed.style).toEqual({ left: '150px', bottom: '350px' })
  })

  it('cannot be dragged off the page, and saves the clamped spot rather than the pointer', () => {
    const placed = placeMascotDock({ x: 1, y: 0 }, 100, 1000, 800)
    const edge = 50 + MASCOT_EDGE_MARGIN_PX

    expect(placed.style).toEqual({ right: `${MASCOT_EDGE_MARGIN_PX}px`, bottom: `${800 - edge - 50}px` })
    expect(placed.spot).toEqual({ x: (1000 - edge) / 1000, y: edge / 800 })
  })

  it('pulls her back inside a viewport that shrank under her', () => {
    // Saved near the bottom-right of a big window, shown in a phone-width one.
    const placed = placeMascotDock({ x: 0.98, y: 0.98 }, 100, 390, 700)

    expect(placed.style).toEqual({ right: `${MASCOT_EDGE_MARGIN_PX}px`, bottom: `${MASCOT_EDGE_MARGIN_PX}px` })
  })
})
