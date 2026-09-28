import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMascotStore, type MascotWarning } from '../mascot'

function warning(id: string, overrides: Partial<MascotWarning> = {}): MascotWarning {
  return { id, title: `Title ${id}`, prompt: `Prompt ${id}`, body: `Body ${id}`, actions: [], ...overrides }
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

  it('pages through warnings one at a time', () => {
    // The popup shows one warning at a time (M4), so the store owns which one.
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.raise(warning('b'))
    mascot.openWarnings()

    expect(mascot.warningIndex).toBe(0)
    expect(mascot.currentWarning?.id).toBe('a')

    mascot.nextWarning()
    expect(mascot.currentWarning?.id).toBe('b')

    // Wraps rather than dead-ends: two warnings and a Next button that stops working reads broken.
    mascot.nextWarning()
    expect(mascot.currentWarning?.id).toBe('a')
  })

  it('dismisses only the warning being looked at, and shows the next one', () => {
    // The whole reason paging is worth having: acknowledging the chat-space notice must not
    // silence a drift warning nobody addressed.
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.raise(warning('b'))
    mascot.openWarnings()

    mascot.dismissCurrent()

    expect(mascot.warnings.map((w) => w.id)).toEqual(['b'])
    expect(mascot.currentWarning?.id).toBe('b')
    expect(mascot.popupOpen).toBe(true)
  })

  it('closes once the last warning is dismissed', () => {
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.openWarnings()

    mascot.dismissCurrent()

    expect(mascot.hasWarnings).toBe(false)
    expect(mascot.popupOpen).toBe(false)
  })

  it('keeps the index inside the list when the last one is dismissed', () => {
    // Standing on the final warning and dismissing it must not leave the index past the end.
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.raise(warning('b'))
    mascot.openWarnings()
    mascot.nextWarning()

    mascot.dismissCurrent()

    expect(mascot.warnings.map((w) => w.id)).toEqual(['a'])
    expect(mascot.currentWarning?.id).toBe('a')
  })

  it('reopens on the first warning rather than where it was left', () => {
    const mascot = useMascotStore()
    mascot.raise(warning('a'))
    mascot.raise(warning('b'))
    mascot.openWarnings()
    mascot.nextWarning()
    mascot.closeWarnings()

    mascot.openWarnings()

    expect(mascot.currentWarning?.id).toBe('a')
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
