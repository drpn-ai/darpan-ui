import { describe, expect, it } from 'vitest'
import type { QueryCatalog } from '../queryRead'
import {
  conditionsOf,
  describeInput,
  editLimits,
  freshName,
  parseRead,
  serializeRead,
  valueFrom,
  whereFrom,
  windowFieldFor,
} from '../queryRead'

const catalog: QueryCatalog = {
  audits: [{ auditId: '100510', auditCode: 'MC', auditName: 'Month-close audit', fields: ['statement', 'state', 'recordKey'] }],
  savedRuns: [{ savedRunId: 'RS_1', runName: 'Shopify vs HotWax', fields: ['bucket', 'key'], note: 'plus each record' }],
  datasets: [{ datasetId: 'DS_ORDERS', system: 'HotWax', idField: 'orderId', windowField: 'orderDate', recordCount: 10,
    fields: ['orderId', 'status'], wholeRecords: false }],
}

const findings = {
  name: 'findings', source: 'auditFindings', auditId: '100510', fields: ['recordKey', 'headline'],
  where: { and: [{ field: 'statement', op: 'equals', value: 'R5' }, { field: 'state', op: 'equals', value: 'open' }] },
  window: { field: 'firstFoundDate', lastDays: 30 },
}

function words(parts: { text: string }[]): string {
  return parts.map((part) => part.text).join('')
}

describe('queryRead', () => {
  it('an empty read is script only', () => {
    expect(parseRead('')).toEqual({ ok: true, read: { doc: {}, inputs: [] } })
    expect(parseRead('  ')).toEqual({ ok: true, read: { doc: {}, inputs: [] } })
  })

  it('says why a read cannot be parsed', () => {
    const bad = parseRead('{"inputs": [')
    expect(bad.ok).toBe(false)
    expect(!bad.ok && bad.error).toMatch(/^The read is not valid JSON/)
    expect(parseRead('{"nope": 1}')).toEqual({ ok: false, error: 'The read needs an inputs list.' })
    expect(parseRead('{"inputs": [1]}')).toEqual({ ok: false, error: 'Each input in the read must be a map.' })
  })

  it('writes back keys it does not know, in place, as pretty JSON', () => {
    const json = '{"version":2,"inputs":[{"name":"orders","source":"dataset","datasetId":"DS_ORDERS","fields":["orderId"],"custom":{"x":1}}],"tail":true}'
    const parsed = parseRead(json)
    if (!parsed.ok) throw new Error(parsed.error)
    const out = serializeRead(parsed.read, parsed.read.inputs)
    expect(JSON.parse(out)).toEqual(JSON.parse(json))
    expect(Object.keys(JSON.parse(out))).toEqual(['version', 'inputs', 'tail'])
    expect(out).toContain('\n  "inputs": [')
    expect(serializeRead(parsed.read, [])).toBe('')
  })

  it('tells an input by name from the catalog', () => {
    const parts = describeInput(findings, catalog)
    expect(words(parts)).toBe('Open findings of Month-close audit, where statement is R5 and state is open, first found in the last 30 days. Keeps recordKey headline')
    expect(parts.filter((part) => part.role === 'field').map((part) => part.text)).toEqual(['recordKey', 'headline'])
    expect(parts.map((part) => part.role)).toEqual(['kind', 'text', 'source', 'text', 'where', 'text', 'window', 'text', 'field', 'text', 'field'])
  })

  it('falls back to ids without the catalog', () => {
    expect(words(describeInput(findings, null))).toContain('Open findings of 100510,')
    expect(words(describeInput({ name: 'd', source: 'runResult', savedRunId: 'RS_1', fields: ['key'] }, null)))
      .toBe('The latest result of RS_1. Keeps key')
    expect(words(describeInput({ name: 'd', source: 'dataset', datasetId: 'DS_X', fields: ['a'], window: { field: 'shipDate', lastDays: 1 } }, catalog)))
      .toBe('Records of DS_X, shipDate in the last 1 day. Keeps a')
  })

  it("names a dataset by its system, and its window by the dataset's window field", () => {
    const input = { name: 'orders', source: 'dataset', datasetId: 'DS_ORDERS', fields: ['orderId'], window: { field: 'x', lastDays: 7 },
      where: { field: 'status', op: 'in', value: ['A', 'B'] } }
    expect(words(describeInput(input, catalog))).toBe('Records of HotWax DS_ORDERS, where status is one of A, B, orderDate in the last 7 days. Keeps orderId')
    expect(words(describeInput({ ...findings, includeClosed: true, where: undefined, window: undefined }, catalog)))
      .toBe('All findings of Month-close audit. Keeps recordKey headline')
  })

  it('flags what the popup cannot change', () => {
    expect(editLimits(findings)).toEqual([])
    expect(editLimits({ ...findings, where: { or: [{ field: 'a', op: 'equals', value: 1 }] } })).toEqual(['or conditions'])
    expect(editLimits({ ...findings, where: { and: [{ and: [{ field: 'a', op: 'equals', value: 1 }] }] } })).toEqual(['nested conditions'])
    expect(editLimits({ name: 'x', source: 'entity', entityName: 'moqui.basic.Enumeration', groupBy: ['a'],
      measures: [{ fn: 'count', as: 'n' }], orderBy: ['-n'] })).toEqual(['it reads entity', 'groups', 'measures', 'an order'])
    const grouped = describeInput({ name: 'x', source: 'dataset', datasetId: 'DS_ORDERS', groupBy: ['status'],
      measures: [{ fn: 'count', as: 'n' }], orderBy: ['-n'], where: { or: [{ field: 'a', op: 'is-null' }, { field: 'b', op: 'between', value: [1, 5] }] } }, catalog)
    expect(words(grouped)).toBe('Records of HotWax DS_ORDERS, where (a is empty or b is between 1 and 5), by status, count as n, ordered by n descending')
  })

  it('reads a where as a flat list of conditions and writes one back', () => {
    expect(conditionsOf({})).toEqual([])
    expect(conditionsOf({ where: { field: 'a', op: 'equals', value: 1 } })).toEqual([{ field: 'a', op: 'equals', value: 1 }])
    expect(conditionsOf(findings)).toHaveLength(2)
    expect(conditionsOf({ where: { or: [] } })).toBeNull()
    expect(whereFrom([])).toBeUndefined()
    expect(whereFrom([{ field: 'a', op: 'equals', value: 1 }])).toEqual({ field: 'a', op: 'equals', value: 1 })
    expect(whereFrom([{ field: 'a', op: 'equals', value: 1 }, { field: 'b', op: 'is-null' }]))
      .toEqual({ and: [{ field: 'a', op: 'equals', value: 1 }, { field: 'b', op: 'is-null' }] })
    expect(valueFrom(' A, B ,', 'in')).toEqual(['A', 'B'])
    expect(valueFrom(' R5 ', 'equals')).toBe('R5')
    expect(valueFrom('x', 'is-null')).toBeUndefined()
  })

  it('knows where a window applies and finds a free name', () => {
    expect(windowFieldFor('auditFindings', '', null)).toBe('firstFoundDate')
    expect(windowFieldFor('dataset', 'DS_ORDERS', catalog)).toBe('orderDate')
    expect(windowFieldFor('dataset', 'DS_ORDERS', null)).toBeNull()
    expect(windowFieldFor('runResult', 'RS_1', catalog)).toBeNull()
    expect(freshName('findings', [])).toBe('findings')
    expect(freshName('findings', ['findings', 'findings2'])).toBe('findings3')
  })
})
