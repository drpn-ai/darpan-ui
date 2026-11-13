import { describe, expect, it } from 'vitest'
import { routerViewKeyFor } from '../routerViewKey'

describe('routerViewKeyFor', () => {
  it('keeps the sign-in page mounted while the person signs in', () => {
    const login = { name: 'login', path: '/login', fullPath: '/login?redirect=%2Fruns', meta: {} }
    const before = routerViewKeyFor(login, null)
    const after = routerViewKeyFor(login, { activeTenantUserGroupId: 'ACME', scopeType: 'TENANT' })
    expect(after).toBe(before)
  })

  it('still remounts every other page when the company changes', () => {
    const runs = { name: 'runs', path: '/runs', fullPath: '/runs?tab=all', meta: {} }
    expect(routerViewKeyFor(runs, { activeTenantUserGroupId: 'ACME' }))
      .not.toBe(routerViewKeyFor(runs, { activeTenantUserGroupId: 'OTHER' }))
    expect(routerViewKeyFor(runs, null)).toBe('/runs?tab=all::anonymous')
  })

  it('ignores the query on pages that keep themselves across query changes', () => {
    const page = { name: 'board', path: '/board', fullPath: '/board?f=1', meta: { queryKeepsPage: true } }
    expect(routerViewKeyFor(page, { scopeType: 'GLOBAL' })).toBe('/board::GLOBAL')
  })
})
