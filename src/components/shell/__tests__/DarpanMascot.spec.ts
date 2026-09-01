import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
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

type PathCommand = { op: string; args: number[] }

/** Path commands with their arguments — needed because arc radii and flags are not coordinates. */
function commands(d: string): PathCommand[] {
  return [...d.matchAll(/([MLAZ])([^MLAZ]*)/g)].map((match) => ({
    op: match[1] ?? '',
    args: (match[2]?.match(/-?\d*\.?\d+/g) ?? []).map(Number),
  }))
}

/** M, L and A all end in x,y. */
function endpoint(command: PathCommand): [number, number] {
  return [command.args.at(-2) ?? NaN, command.args.at(-1) ?? NaN]
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

describe('DarpanMascot blinking', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  // Asserted on the shut curves themselves rather than a state class: what matters is that
  // the face changed, not that a flag flipped.
  const isBlinking = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findAll('.mascot-eye-shut').length > 0

  it('holds the face still for at least three seconds', async () => {
    // Swept rather than sampled at the far end: a single check at 2999ms cannot see a blink
    // that already opened again, so it stays green even against a zero-length gap. Proven by
    // mutation — setting the minimum gap to 0 fails this.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(DarpanMascot)

    for (let elapsed = 50; elapsed <= 2950; elapsed += 50) {
      vi.advanceTimersByTime(50)
      await nextTick()
      expect(isBlinking(wrapper), `blinked ${elapsed}ms in`).toBe(false)
    }
    vi.advanceTimersByTime(49)
    await nextTick()
    expect(isBlinking(wrapper), 'blinked 2999ms in').toBe(false)
  })

  it('shuts and reopens the eyes, rather than leaving them shut', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(DarpanMascot)

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(isBlinking(wrapper)).toBe(true)

    // The hold is pinned to the millisecond rather than checked loosely, because how long the
    // eyes stay shut is the whole character of the blink — too short and it reads as a glitch.
    vi.advanceTimersByTime(179)
    await nextTick()
    expect(isBlinking(wrapper), 'reopened before the hold was up').toBe(true)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(isBlinking(wrapper)).toBe(false)
  })

  it('never leaves a gap longer than six seconds, on the longest draw', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1)
    const wrapper = mount(DarpanMascot)

    vi.advanceTimersByTime(5999)
    await nextTick()
    expect(isBlinking(wrapper)).toBe(false)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(isBlinking(wrapper)).toBe(true)
  })

  it('keeps blinking, so the second one is not left to a single timer', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(DarpanMascot)

    vi.advanceTimersByTime(3200)
    await nextTick()
    vi.advanceTimersByTime(3000)
    await nextTick()

    expect(isBlinking(wrapper)).toBe(true)
  })

  it('does not blink at all for a viewer who asked for less motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      addEventListener() {},
      removeEventListener() {},
    }))
    const wrapper = mount(DarpanMascot)

    vi.advanceTimersByTime(60_000)
    await nextTick()

    expect(isBlinking(wrapper)).toBe(false)
  })

  it('swaps the open eyes for closed curves, and touches nothing else on the face', async () => {
    // The complaint this encodes: a blink squashed the nose too, because the first version
    // scaled a group the nose had been swept into. A blink is now a swap of two shapes, so
    // there is no transform that could reach anything else.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(DarpanMascot, { props: { detail: 3 } })

    const restOfFace = () => ({
      nose: wrapper.findAll('.mascot-nose').length,
      mouth: wrapper.findAll('.mascot-mouth').length,
      stripes: wrapper.findAll('.mascot-stripe').length,
      lashes: wrapper.findAll('.mascot-lash').length,
      ears: wrapper.findAll('.mascot-ear-out').length,
      head: wrapper.findAll('.mascot-head').length,
    })
    const before = restOfFace()

    vi.advanceTimersByTime(3000)
    await nextTick()

    expect(wrapper.findAll('.mascot-eye-shut')).toHaveLength(2)
    expect(wrapper.findAll('.mascot-eye')).toHaveLength(0)
    expect(wrapper.findAll('.mascot-glint')).toHaveLength(0)
    expect(restOfFace()).toEqual(before)
  })

  it("draws the shut eye as a U riding the eye's own rim", async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(DarpanMascot, { props: { detail: 3 } })
    vi.advanceTimersByTime(3000)
    await nextTick()

    const ds = wrapper.findAll('.mascot-eye-shut').map((path) => path.attributes('d') ?? '')
    expect(ds).toHaveLength(2)

    const [move, outer, , inner] = commands(ds[0] ?? '')
    // Starts at the eye's left rim and ends at its right rim, on the same radii as the eye —
    // that is what makes it read as the same eye closed rather than a separate mark.
    expect(endpoint(move!)).toEqual([23.5 - 3.3, 36])
    expect(outer!.args.slice(0, 2)).toEqual([3.3, 3.7])
    expect(endpoint(outer!)).toEqual([23.5 + 3.3, 36])
    // Sweep flags are the whole difference between a U and an arch: outer sweeps one way
    // through the bottom, the inner edge comes back the other. Flip either and it is a frown
    // turned upside down.
    expect(outer!.args[4]).toBe(0)
    expect(inner!.args[4]).toBe(1)

    // The right eye is the left one translated by the gap between the centres, so the pair
    // cannot drift; a mirror would have needed both sweep flags inverted.
    const shifted = commands(ds[0] ?? '').map((c) => ({
      op: c.op,
      args: c.args.map((n, i) => (i === c.args.length - 2 ? +(n + 17).toFixed(2) : n)),
    }))
    expect(commands(ds[1] ?? '')).toEqual(shifted)
  })

  it('brings the lashes down with the lid instead of leaving them floating', async () => {
    // They were sampled off the OPEN eye's upper rim (105-167 degrees), and the U occupies
    // only the lower half — so at rest they hung in the air above a shut eye with a visible
    // gap. A shut eye gets its own fan, rooted in the U band.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const wrapper = mount(DarpanMascot, { props: { detail: 3 } })
    vi.advanceTimersByTime(3000)
    await nextTick()

    // Inside the U's band: within the outer rim it is drawn on, outside the inner one, and
    // on the lower half where the closed lid actually is.
    const inBand = ([x, y]: [number, number]) => {
      const cx = x < 32 ? 23.5 : 40.5
      const outer = Math.hypot((x - cx) / 3.3, (y - 36) / 3.7)
      const inner = Math.hypot((x - cx) / 2.2, (y - 36) / 2.55)
      return outer < 1 && inner > 1 && y >= 36
    }

    const shutLashes = wrapper.findAll('.mascot-lash')
    expect(shutLashes).toHaveLength(6)
    for (const lash of shutLashes) {
      const points = pointsOf(lash.attributes('d') ?? '')
      expect(points.some(inBand), `lash ${lash.attributes('d')} is not touching the lid`).toBe(
        true,
      )
    }
  })

  it('leaves no timer running once the dock is gone', () => {
    const wrapper = mount(DarpanMascot)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    wrapper.unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
