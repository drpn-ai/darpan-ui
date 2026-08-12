import { describe, expect, it } from 'vitest'
import { filterRecordsForActiveTenant } from '../tenantRecords'

describe('filterRecordsForActiveTenant', () => {
  it('keeps only records owned by the active tenant when isShared is absent', () => {
    const records = [
      { companyUserGroupId: 'KREWE' },
      { companyUserGroupId: 'GORJANA' },
    ]

    expect(filterRecordsForActiveTenant(records, 'KREWE')).toEqual([{ companyUserGroupId: 'KREWE' }])
  })

  it('returns records unfiltered when no active tenant is given', () => {
    const records = [{ companyUserGroupId: 'KREWE' }, { companyUserGroupId: 'GORJANA' }]

    expect(filterRecordsForActiveTenant(records, null)).toEqual(records)
  })

  // DAR-BE-005: list#OmsRestSourceConfigs / list#ShopifyAuthConfigs / list#NsAuthConfigs /
  // list#NsRestletConfigs already scope their response to owned rows plus ConfigTenantAccess
  // grants, and mark the shared-in rows isShared: true. Without this case, this same
  // tenant-ownership filter silently drops those rows again on every settings list AND on every
  // workflow page's "find the record being edited" lookup — a peer tenant could never see or open
  // a config shared to them.
  it('keeps a row shared in from another tenant', () => {
    const records = [
      { companyUserGroupId: 'GORJANA', isShared: true },
      { companyUserGroupId: 'GORJANA', isShared: false },
    ]

    expect(filterRecordsForActiveTenant(records, 'KREWE')).toEqual([
      { companyUserGroupId: 'GORJANA', isShared: true },
    ])
  })
})
