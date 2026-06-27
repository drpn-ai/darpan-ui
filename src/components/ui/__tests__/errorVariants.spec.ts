import { describe, it, expect, vi } from 'vitest'
import { errorVariants } from '../errorVariants'

describe('errorVariants', () => {
  it('serverError wires the retry callback into the action', () => {
    const onRetry = vi.fn()
    const v = errorVariants.serverError(onRetry)
    expect(v.icon).toBe('alert')
    expect(v.title).toBe('something went wrong')
    v.action?.onClick?.()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('notFound wires the callback into action.onClick', () => {
    const onHome = vi.fn()
    const v = errorVariants.notFound(onHome)
    v.action?.onClick?.()
    expect(onHome).toHaveBeenCalledTimes(1)
  })
  it('accessDenied wires the callback into action.onClick', () => {
    const onHome = vi.fn()
    const v = errorVariants.accessDenied(onHome)
    v.action?.onClick?.()
    expect(onHome).toHaveBeenCalledTimes(1)
  })
  it('accessDenied has a lock icon and no jargon/path in the message', () => {
    const v = errorVariants.accessDenied()
    expect(v.icon).toBe('lock')
    expect(v.message).not.toMatch(/component:\/\/|exception|null/i)
  })
})
