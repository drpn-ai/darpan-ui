import { describe, expect, it } from 'vitest'
import { filterRecordsForActiveTenant } from '../tenantRecords'

interface Row {
  id: string
  companyUserGroupId?: string | null
}

const rows: Row[] = [
  { id: 'a', companyUserGroupId: 'TENANT_1' },
  { id: 'b', companyUserGroupId: 'TENANT_2' },
  { id: 'c', companyUserGroupId: '  TENANT_1  ' },
  { id: 'd', companyUserGroupId: null },
  { id: 'e' },
]

describe('filterRecordsForActiveTenant', () => {
  it('returns every record when no active tenant is set', () => {
    expect(filterRecordsForActiveTenant(rows, null)).toEqual(rows)
    expect(filterRecordsForActiveTenant(rows, undefined)).toEqual(rows)
    expect(filterRecordsForActiveTenant(rows, '   ')).toEqual(rows)
  })

  it('keeps only records owned by the active tenant (tenant isolation boundary)', () => {
    const result = filterRecordsForActiveTenant(rows, 'TENANT_1')
    expect(result.map((row) => row.id)).toEqual(['a', 'c'])
  })

  it('normalizes whitespace on both the active tenant id and the record id', () => {
    const result = filterRecordsForActiveTenant(rows, '  TENANT_1  ')
    expect(result.map((row) => row.id)).toEqual(['a', 'c'])
  })

  it('drops records with a missing or null owner when a tenant is active', () => {
    const result = filterRecordsForActiveTenant(rows, 'TENANT_2')
    expect(result.map((row) => row.id)).toEqual(['b'])
  })

  it('returns an empty array when no record matches the active tenant', () => {
    expect(filterRecordsForActiveTenant(rows, 'TENANT_404')).toEqual([])
  })
})
