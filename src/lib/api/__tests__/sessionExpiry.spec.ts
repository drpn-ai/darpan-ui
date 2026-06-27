import { describe, expect, it, vi } from 'vitest'
import { handleAuthExpiry } from '../sessionExpiry'

describe('handleAuthExpiry', () => {
  it('redirects to login preserving the current path as the return target', () => {
    const push = vi.fn()
    handleAuthExpiry('/settings/sftp', { push, build: (r) => ({ name: 'login', query: { redirect: r } }) })
    expect(push).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/settings/sftp' } })
  })

  it('is a no-op when already on /login', () => {
    const push = vi.fn()
    handleAuthExpiry('/login', { push, build: (r) => ({ name: 'login', query: { redirect: r } }) })
    expect(push).not.toHaveBeenCalled()
  })

  it('is a no-op for /login sub-paths', () => {
    const push = vi.fn()
    handleAuthExpiry('/login?redirect=%2Fdashboard', { push, build: (r) => ({ name: 'login', query: { redirect: r } }) })
    expect(push).not.toHaveBeenCalled()
  })
})
