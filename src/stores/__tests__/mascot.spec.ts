import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMascotStore, type MascotWarning } from '../mascot'

function warning(id: string, overrides: Partial<MascotWarning> = {}): MascotWarning {
  return { id, title: `Title ${id}`, body: `Body ${id}`, actions: [], ...overrides }
}

describe('mascot store — warnings', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts with no warnings and a closed popup', () => {
    const mascot = useMascotStore()

    expect(mascot.warnings).toEqual([])
    expect(mascot.hasWarnings).toBe(false)
    expect(mascot.popupOpen).toBe(false)
  })

  it('holds several warnings at once, because one page can raise two', () => {
    const mascot = useMascotStore()

    mascot.raise(warning('automation-drift'))
    mascot.raise(warning('automation-chat-space-inactive'))

    expect(mascot.warnings.map((w) => w.id)).toEqual([
      'automation-drift',
      'automation-chat-space-inactive',
    ])
    expect(mascot.hasWarnings).toBe(true)
  })

  // A page re-raises on every load. Without replace-by-id a reload would stack duplicates.
  it('replaces by id rather than stacking a duplicate', () => {
    const mascot = useMascotStore()

    mascot.raise(warning('automation-drift', { body: 'first' }))
    mascot.raise(warning('automation-drift', { body: 'second' }))

    expect(mascot.warnings).toHaveLength(1)
    expect(mascot.warnings[0]?.body).toBe('second')
  })

  it('drops one warning by id and leaves the rest standing', () => {
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.raise(warning('b'))

    mascot.drop('a')

    expect(mascot.warnings.map((w) => w.id)).toEqual(['b'])
  })

  it('dismiss clears every warning and closes the popup', () => {
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.raise(warning('b'))
    mascot.openWarnings()

    mascot.dismiss()

    expect(mascot.warnings).toEqual([])
    expect(mascot.popupOpen).toBe(false)
    expect(mascot.hasWarnings).toBe(false)
  })

  // clear() runs on Escape and on pointer-leave of the bubble. Neither is an acknowledgement,
  // so neither may silently discard a warning the operator has not seen.
  it('clear() releases the bubble but never discards a warning', () => {
    const mascot = useMascotStore()
    mascot.raise(warning('automation-drift'))
    mascot.explain('differenceCount')

    mascot.clear()

    expect(mascot.mode).toBe('idle')
    expect(mascot.warnings.map((w) => w.id)).toEqual(['automation-drift'])
  })

  it('carries actions through untouched so a page can hand over its own handler', async () => {
    const mascot = useMascotStore()
    const run = vi.fn()

    mascot.raise(warning('automation-drift', {
      actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run }],
    }))
    await mascot.warnings[0]?.actions[0]?.run()

    expect(run).toHaveBeenCalledTimes(1)
  })
})
