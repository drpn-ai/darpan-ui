import { describe, expect, it } from 'vitest'
import { ageLabel, checkStatusBadge, instantLabel, findingStateBadge, periodOptions, recordIds, recordRows, systemLabel } from '../auditReport'

// DAR-UI-058. The audit view's words for the report JSON's codes, and rows for its keyed objects.
describe('auditReport', () => {
  it('names each code in words, toned by grey only', () => {
    expect(findingStateBadge('open')).toEqual({ label: 'Open', tone: 'danger' })
    expect(findingStateBadge('fixed')).toEqual({ label: 'Fixed', tone: 'success' })
    expect(checkStatusBadge('notRun')).toEqual({ label: 'Not run', tone: 'neutral' })
    // An unknown code shows as it came.
    expect(findingStateBadge('excused')).toEqual({ label: 'excused', tone: 'neutral' })
  })

  it('says HotWax for the OMS, as every page does', () => {
    expect(systemLabel('OMS')).toBe('HotWax')
    expect(systemLabel('NetSuite')).toBe('NetSuite')
  })

  it('flattens records by system and type, in the document order', () => {
    const records = { NetSuite: { rma: [{ id: 'RMA1', internalId: '51', status: 'Pending Refund' }], creditMemo: [{ id: 'CM1', internalId: null, status: null }] },
      OMS: { return: [{ id: 'M1', internalId: null, status: 'Completed' }] } }
    expect(recordRows(records).map((r) => [r.system, r.recordType, r.id, r.internalId, r.status])).toEqual([
      ['NetSuite', 'rma', 'RMA1', '51', 'Pending Refund'], ['NetSuite', 'creditMemo', 'CM1', '', ''], ['HotWax', 'return', 'M1', '', 'Completed'],
    ])
    expect(recordIds(records)).toBe('RMA1, CM1, M1')
    expect(recordRows(null)).toEqual([])
  })

  it('offers a monthly audit its period and the two before, across a year end', () => {
    expect(periodOptions('2026-10')).toEqual(['2026-10', '2026-09', '2026-08'])
    expect(periodOptions('2027-01')).toEqual(['2027-01', '2026-12', '2026-11'])
    expect(periodOptions('2026-Q4')).toEqual(['2026-Q4'])
    expect(periodOptions(null)).toEqual([])
  })

  it('writes an instant as day, minute and the tenant offset, inside any text', () => {
    expect(instantLabel('2026-10-21T23:44:35-07:00')).toBe('2026-10-21 23:44 -07:00')
    expect(instantLabel('scheduled check, 2026-10-21T23:44-07:00')).toBe('scheduled check, 2026-10-21 23:44 -07:00')
    expect(instantLabel('check')).toBe('check')
    expect(instantLabel(null)).toBe('')
  })

  it('counts age in days', () => {
    expect(ageLabel(1)).toBe('1 day')
    expect(ageLabel(0)).toBe('0 days')
  })
})
