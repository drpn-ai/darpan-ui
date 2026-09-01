import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DarpanMascot from '../DarpanMascot.vue'

/** Every number in a path's `d`, read back as the point list it draws. */
function pointsOf(d: string): Array<[number, number]> {
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
  const points: Array<[number, number]> = []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]
    const y = nums[i + 1]
    if (x === undefined || y === undefined) break
    points.push([x, y])
  }
  return points
}

/** A canonical form that is equal for two shapes mirrored about the face's centre line. */
function mirrorKey(d: string): string {
  return pointsOf(d)
    .map(([x, y]) => `${(64 - x).toFixed(2)},${y.toFixed(2)}`)
    .sort()
    .join(' ')
}

function selfKey(d: string): string {
  return pointsOf(d)
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .sort()
    .join(' ')
}

function lashes(detail: 1 | 2 | 3) {
  return mount(DarpanMascot, { props: { detail } }).findAll('.mascot-lash')
}

describe('DarpanMascot lashes', () => {
  it('fans three lashes out of each eye at full detail', () => {
    expect(lashes(3)).toHaveLength(6)
  })

  it('drops the lashes at the smallest detail, where they would only smudge', () => {
    expect(lashes(1)).toHaveLength(0)
    // They survive the middle step, alongside the nose and the ear insets.
    expect(lashes(2)).toHaveLength(6)
  })

  it('mirrors the two sets about the centre line, so the face cannot go crooked', () => {
    const ds = lashes(3).map((lash) => lash.attributes('d') ?? '')
    const left = ds.filter((d) => pointsOf(d).every(([x]) => x < 32))
    const right = ds.filter((d) => pointsOf(d).every(([x]) => x > 32))

    expect(left).toHaveLength(3)
    expect(right).toHaveLength(3)
    expect(left.map(mirrorKey).sort()).toEqual(right.map(selfKey).sort())
  })

  it('roots each lash in the eye patch and pushes its tip past the rim', () => {
    // Ground-coloured lashes only read where they cross onto the dark head, so a lash
    // that stopped inside the patch would be invisible. Measured against the eye
    // ellipse itself rather than a bounding box: the upright lash clears the rim
    // vertically and never leaves the eye's own x-range.
    const inEyeUnits = ([x, y]: [number, number]) =>
      Math.hypot((x - 23.5) / 3.3, (y - 36) / 3.7)

    const left = lashes(3)
      .map((lash) => pointsOf(lash.attributes('d') ?? ''))
      .filter((points) => points.every(([x]) => x < 32))

    expect(left).toHaveLength(3)
    for (const points of left) {
      const radii = points.map(inEyeUnits)
      expect(Math.max(...radii)).toBeGreaterThan(1.4)
      expect(Math.min(...radii)).toBeLessThan(1)
    }
  })
})
