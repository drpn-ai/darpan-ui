import { describe, expect, it } from 'vitest'
import {
  canonicalDarpanSystemEnumId,
  darpanSystemDisplayLabel,
  darpanSystemEndpointOptions,
  darpanSystemHasEndpointOptions,
  darpanSystemIdsMatch,
  darpanSystemNameFromLabel,
  darpanSystemNamePair,
  darpanSystemParentOptions,
  deduplicateDarpanSystemOptions,
  resolveDarpanSystemParentEnumId,
} from '../utils/darpanSystems'

describe('darpanSystems', () => {
  it('maps legacy Darpan system aliases to canonical enum IDs', () => {
    expect(canonicalDarpanSystemEnumId('DarSysShopify')).toBe('SHOPIFY')
    expect(canonicalDarpanSystemEnumId('DarSysOms')).toBe('OMS')
    expect(canonicalDarpanSystemEnumId('DarSysNetSuite')).toBe('NETSUITE')
    expect(canonicalDarpanSystemEnumId('DarSysSapi')).toBe('SAPI')
  })

  it('matches legacy and canonical system IDs', () => {
    expect(darpanSystemIdsMatch('DarSysShopify', 'SHOPIFY')).toBe(true)
    expect(darpanSystemIdsMatch('DarSysOms', 'OMS')).toBe(true)
    expect(darpanSystemIdsMatch('SHOPIFY', 'OMS')).toBe(false)
  })

  it('uses canonical display labels for old system rows', () => {
    expect(darpanSystemDisplayLabel('DarSysOms', 'OMS')).toBe('HotWax')
    expect(darpanSystemDisplayLabel('DarSysShopify', 'SHOPIFY')).toBe('Shopify')
    expect(darpanSystemDisplayLabel('DarSysNetSuite', 'NETSUITE')).toBe('NetSuite')
    expect(darpanSystemDisplayLabel('DarSysSapi', 'SAPI')).toBe('SAPI')
  })

  it('deduplicates legacy system options behind canonical values', () => {
    const options = deduplicateDarpanSystemOptions([
      { enumId: 'DarSysOms', enumCode: 'OMS', label: 'OMS', sequenceNum: 1 },
      { enumId: 'OMS', enumCode: 'HOTWAX', label: 'HotWax', sequenceNum: 1 },
      { enumId: 'DarSysShopify', enumCode: 'SHOPIFY', label: 'SHOPIFY', sequenceNum: 2 },
      { enumId: 'SHOPIFY', enumCode: 'SHOPIFY', label: 'Shopify', sequenceNum: 2 },
      { enumId: 'DarSysNetSuite', enumCode: 'NETSUITE', label: 'NETSUITE', sequenceNum: 3 },
    ])

    expect(options.map((option) => option.enumId)).toEqual(['OMS', 'SHOPIFY', 'NETSUITE'])
    expect(options.find((option) => option.enumId === 'OMS')?.label).toBe('HotWax')
    expect(options.find((option) => option.enumId === 'SHOPIFY')?.label).toBe('Shopify')
  })

  // Fixture mirrors allSystemOptions in ReconciliationCreateFlowPage.vue: the raw enumId-keyed
  // backend rows already projected to WorkflowSelectOption shape (value/label) plus parentEnumId —
  // NOT the raw DarpanSystemOptionInput (enumId-keyed) shape deduplicateDarpanSystemOptions above
  // consumes. OMS/SHOPIFY/NETSUITE/SAPI/DATABASE are top-level; three OMS endpoints and one Shopify
  // endpoint carry parentEnumId.
  const SYSTEM_AND_ENDPOINT_OPTIONS = [
    { value: 'OMS', label: 'HotWax' },
    { value: 'SHOPIFY', label: 'Shopify' },
    { value: 'NETSUITE', label: 'NetSuite' },
    { value: 'SAPI', label: 'SAPI' },
    { value: 'DATABASE', label: 'Database' },
    { value: 'OMS_TRANSFER_ORDERS', label: 'HotWax Transfer Orders', parentEnumId: 'OMS' },
    { value: 'OMS_RECON_ORDERS', label: 'HotWax Orders (Reconciliation API)', parentEnumId: 'OMS' },
    { value: 'OMS_RETURNS', label: 'HotWax Returns (Reconciliation API)', parentEnumId: 'OMS' },
    { value: 'SHOPIFY_RETURN_REFS', label: 'Shopify Order Return References', parentEnumId: 'SHOPIFY' },
  ]

  it('lists only top-level systems for the step 1 picker, endpoints excluded', () => {
    const parents = darpanSystemParentOptions(SYSTEM_AND_ENDPOINT_OPTIONS)
    expect(parents.map((option) => option.value)).toEqual(['OMS', 'SHOPIFY', 'NETSUITE', 'SAPI', 'DATABASE'])
  })

  it('reports endpoint availability per parent system', () => {
    expect(darpanSystemHasEndpointOptions('OMS', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe(true)
    expect(darpanSystemHasEndpointOptions('SHOPIFY', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe(true)
    expect(darpanSystemHasEndpointOptions('NETSUITE', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe(false)
    expect(darpanSystemHasEndpointOptions('SAPI', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe(false)
    expect(darpanSystemHasEndpointOptions('', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe(false)
  })

  it('builds step 2 endpoint options with the parent as its own default endpoint', () => {
    const omsEndpoints = darpanSystemEndpointOptions('OMS', 'HotWax', SYSTEM_AND_ENDPOINT_OPTIONS)
    expect(omsEndpoints).toEqual([
      { value: 'OMS', label: 'HotWax Orders' },
      { value: 'OMS_TRANSFER_ORDERS', label: 'HotWax Transfer Orders' },
      { value: 'OMS_RECON_ORDERS', label: 'HotWax Orders (Reconciliation API)' },
      { value: 'OMS_RETURNS', label: 'HotWax Returns (Reconciliation API)' },
    ])

    const shopifyEndpoints = darpanSystemEndpointOptions('SHOPIFY', 'Shopify', SYSTEM_AND_ENDPOINT_OPTIONS)
    expect(shopifyEndpoints).toEqual([
      { value: 'SHOPIFY', label: 'Shopify Orders' },
      { value: 'SHOPIFY_RETURN_REFS', label: 'Shopify Order Return References' },
    ])

    // A system with no children still returns a single default-endpoint option (callers use
    // darpanSystemHasEndpointOptions to decide whether to show step 2 at all).
    expect(darpanSystemEndpointOptions('NETSUITE', 'NetSuite', SYSTEM_AND_ENDPOINT_OPTIONS)).toEqual([
      { value: 'NETSUITE', label: 'NetSuite Orders' },
    ])

    expect(darpanSystemEndpointOptions('', 'HotWax', SYSTEM_AND_ENDPOINT_OPTIONS)).toEqual([])
  })

  it('resolves the owning parent for a concrete stored systemEnumId, for edit pre-selection', () => {
    expect(resolveDarpanSystemParentEnumId('OMS_RETURNS', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('OMS')
    expect(resolveDarpanSystemParentEnumId('OMS_TRANSFER_ORDERS', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('OMS')
    expect(resolveDarpanSystemParentEnumId('SHOPIFY_RETURN_REFS', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('SHOPIFY')
    // Top-level systems (and their own endpoint choice) resolve to themselves.
    expect(resolveDarpanSystemParentEnumId('OMS', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('OMS')
    expect(resolveDarpanSystemParentEnumId('SAPI', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('SAPI')
    // Unrecognized/legacy value: resolves to itself so step 2 is skipped rather than crashing.
    expect(resolveDarpanSystemParentEnumId('UNKNOWN_SYSTEM', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('UNKNOWN_SYSTEM')
    expect(resolveDarpanSystemParentEnumId('', SYSTEM_AND_ENDPOINT_OPTIONS)).toBe('')
  })
})

// Result surfaces count records per SYSTEM ("Missing from Shopify"), but the label they are handed
// is whatever was stamped into the run output at run time — the endpoint enum's description
// (SHOPIFY_RETURN_REFS -> "Shopify Order Return References"), or, on runs older than the 2026-08-13
// seed correction, the shouty raw enum code ("SHOPIFY"). Both collapse to the system name here so
// old and new runs read the same without rewriting stored output documents.
describe('system names for result count labels', () => {
  it('collapses endpoint descriptions to the owning system name', () => {
    expect(darpanSystemNameFromLabel('Shopify Order Return References')).toBe('Shopify')
    expect(darpanSystemNameFromLabel('HotWax Returns (Reconciliation API)')).toBe('HotWax')
    expect(darpanSystemNameFromLabel('HotWax Orders (Reconciliation API)')).toBe('HotWax')
    expect(darpanSystemNameFromLabel('HotWax Transfer Orders')).toBe('HotWax')
  })

  it('normalizes system labels stamped as raw enum ids or codes', () => {
    expect(darpanSystemNameFromLabel('SHOPIFY')).toBe('Shopify')
    expect(darpanSystemNameFromLabel('OMS')).toBe('HotWax')
    expect(darpanSystemNameFromLabel('HotWax')).toBe('HotWax')
  })

  it('leaves labels it cannot place untouched', () => {
    expect(darpanSystemNameFromLabel('Acme Feed Extract')).toBe('Acme Feed Extract')
    expect(darpanSystemNameFromLabel('File 1')).toBe('File 1')
    expect(darpanSystemNameFromLabel('')).toBe('')
    expect(darpanSystemNameFromLabel(undefined)).toBe('')
  })

  it('matches the system name as a whole word, not a bare prefix', () => {
    expect(darpanSystemNameFromLabel('Shopifyish Orders')).toBe('Shopifyish Orders')
  })

  it('collapses both sides of a cross-system run', () => {
    expect(darpanSystemNamePair('Shopify Order Return References', 'HotWax Returns (Reconciliation API)')).toEqual({
      file1: 'Shopify',
      file2: 'HotWax',
    })
  })

  // Two endpoints of one system would both render "Missing from HotWax", making the two counts
  // indistinguishable — so that pairing keeps the endpoint labels.
  it('keeps endpoint labels when both sides are the same system', () => {
    expect(darpanSystemNamePair('HotWax Returns (Reconciliation API)', 'HotWax Transfer Orders')).toEqual({
      file1: 'HotWax Returns (Reconciliation API)',
      file2: 'HotWax Transfer Orders',
    })
  })

  it('still collapses a known side when the other side is missing', () => {
    expect(darpanSystemNamePair('Shopify Order Return References', '')).toEqual({
      file1: 'Shopify',
      file2: '',
    })
    expect(darpanSystemNamePair('Acme Feed Extract', 'HotWax Returns (Reconciliation API)')).toEqual({
      file1: 'Acme Feed Extract',
      file2: 'HotWax',
    })
  })
})
