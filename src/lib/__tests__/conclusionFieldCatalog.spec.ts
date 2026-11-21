import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, flatten } = vi.hoisted(() => ({ get: vi.fn(), flatten: vi.fn() }))
vi.mock('../api/facade', () => ({ jsonSchemaFacade: { get, flatten } }))

import { loadConclusionFields, lookupFields } from '../conclusionFieldCatalog'
import type { ReconciliationRuleSetDraft } from '../reconciliationRuleSetDraft'

const labels = { file1: 'Shopify', file2: 'OMS' }
const signal = new AbortController().signal
const draftOf = (extra: Record<string, unknown>) => extra as unknown as ReconciliationRuleSetDraft

describe('loadConclusionFields', () => {
  beforeEach(() => {
    get.mockReset()
    flatten.mockReset()
  })

  it('marks array paths as lists', async () => {
    flatten.mockResolvedValue({
      fieldList: [
        { fieldPath: 'status', type: 'string', required: false },
        { fieldPath: 'customer', type: 'object', required: false },
        { fieldPath: 'customer.email', type: 'string', required: false },
        { fieldPath: 'lines', type: 'array', required: false },
        { fieldPath: 'lines[].status', type: 'string', required: false },
      ],
    })
    const result = await loadConclusionFields(draftOf({ file1JsonSchemaId: 'S1' }), signal, labels)
    expect(flatten).toHaveBeenCalledWith({ jsonSchemaId: 'S1' }, signal)
    expect(result.listPaths).toEqual(new Set(['lines']))
    expect(result.fields).toEqual([
      { value: 'FILE_1:status', label: 'Shopify › status', subject: 'FILE_1', field: 'status', list: false },
      { value: 'FILE_1:customer.email', label: 'Shopify › customer.email', subject: 'FILE_1', field: 'customer.email', list: false },
      { value: 'FILE_1:lines.status', label: 'Shopify › lines.status', subject: 'FILE_1', field: 'lines.status', list: true },
    ])
  })

  it('resolves a schema by name and skips API-source sides', async () => {
    get.mockResolvedValue({ schemaData: { jsonSchemaId: 'S2' } })
    flatten.mockResolvedValue({ fieldList: [{ fieldPath: 'id', type: 'string', required: true }] })
    const result = await loadConclusionFields(draftOf({
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file2SchemaFileName: 'oms.json',
    }), signal, labels)
    expect(get).toHaveBeenCalledWith({ schemaName: 'oms.json' }, signal)
    expect(result.fields.map((f) => f.value)).toEqual(['FILE_2:id'])
  })

  it('a failed flatten yields no fields', async () => {
    flatten.mockRejectedValue(new Error('boom'))
    const result = await loadConclusionFields(draftOf({ file1JsonSchemaId: 'S1' }), signal, labels)
    expect(result.fields).toEqual([])
    expect(result.listPaths.size).toBe(0)
  })
})

describe('lookupFields', () => {
  it('lookups become fields and many lookups are lists', () => {
    const result = lookupFields([
      { name: 'orderInNetsuite', subject: 'FILE_1' },
      { name: 'returns', subject: 'FILE_2', many: true },
    ], labels)
    expect(result.fields).toEqual([
      { value: 'FILE_1:orderInNetsuite', label: 'Shopify › orderInNetsuite', subject: 'FILE_1', field: 'orderInNetsuite', list: false },
      { value: 'FILE_2:returns', label: 'OMS › returns', subject: 'FILE_2', field: 'returns', list: true },
    ])
    expect(result.listPaths).toEqual(new Set(['returns']))
  })
})
