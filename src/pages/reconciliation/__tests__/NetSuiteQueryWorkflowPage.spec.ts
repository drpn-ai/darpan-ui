import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
  name: 'reconciliation-netsuite-query-create',
  fullPath: '/reconciliation/queries/new',
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const getOptions = vi.hoisted(() => vi.fn())
const saveQuery = vi.hoisted(() => vi.fn())
const previewQuery = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}))

vi.mock('../../../lib/api/authoringFacade', () => ({
  netSuiteQueryFacade: { getOptions, save: saveQuery, preview: previewQuery },
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => ({ canEditTenantSettings: true }),
}))

import NetSuiteQueryWorkflowPage from '../NetSuiteQueryWorkflowPage.vue'

const OPTIONS = {
  templates: ['RECORDS', 'RECORDS_MATCHING'],
  dateColumns: ['trandate', 'lastmodifieddate', 'createddate'],
  recordTypes: ['SalesOrd', 'CustInvc', 'RtnAuth'],
  matchFields: ['status', 'custbody_hc_order_id'],
  matchOps: ['IN', 'GT', 'NOT_EMPTY', 'STARTS_WITH'],
  customFieldPattern: 'custbody_...',
  accounts: [{ nsAuthConfigId: 'gorjana_prod', description: 'gorjana production' }],
}

function stepId(wrapper: VueWrapper): string {
  return wrapper.get('form').attributes('data-step-id') ?? ''
}

async function next(wrapper: VueWrapper): Promise<void> {
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')
}

async function pick(wrapper: VueWrapper, testId: string, value: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="workflow-select-option"][data-option-value="${value}"]`).trigger('click')
}

/** Walks the create flow to the review step, recording each step's id on the way. */
async function walkToReview(wrapper: VueWrapper, template: 'RECORDS' | 'RECORDS_MATCHING'): Promise<string[]> {
  const seen: string[] = []
  seen.push(stepId(wrapper))
  await pick(wrapper, 'netsuite-query-account', 'gorjana_prod')
  await next(wrapper)

  seen.push(stepId(wrapper))
  await wrapper.get('input[name="nsSuiteQlSourceQueryId"]').setValue('NS_WARRANTY_CLAIM')
  await next(wrapper)

  seen.push(stepId(wrapper))
  await wrapper.get('input[name="description"]').setValue('Warranty claims')
  await next(wrapper)

  seen.push(stepId(wrapper))
  await pick(wrapper, 'netsuite-query-record-type', 'RtnAuth')
  await next(wrapper)

  seen.push(stepId(wrapper))
  await next(wrapper)

  seen.push(stepId(wrapper))
  await pick(wrapper, 'netsuite-query-template', template)
  await next(wrapper)

  if (template === 'RECORDS_MATCHING') {
    seen.push(stepId(wrapper))
    await wrapper.get('input[name="matchFieldId"]').setValue('custbody_hc_warranty_number')
    await wrapper.get('[data-testid="netsuite-query-add-match-rule"]').trigger('click')
    const fieldInputs = wrapper.findAll('input[name="matchFieldId"]')
    await fieldInputs[1]!.setValue('status')
    const opTriggers = wrapper.findAll('[data-testid="netsuite-query-match-op"]')
    await opTriggers[1]!.trigger('click')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="IN"]').trigger('click')
    await wrapper.findAll('input[name="matchValues"]')[1]!.setValue('RtnAuth:B, RtnAuth:D')
    await next(wrapper)
  }

  seen.push(stepId(wrapper))
  await wrapper.get('input[name="recordFieldName"]').setValue('returnId')
  await wrapper.get('input[name="sourceColumn"]').setValue('custbody_hc_return_id')
  // A blank row in the middle is dropped, and the rows after it renumber.
  await wrapper.get('[data-testid="netsuite-query-add-field"]').trigger('click')
  await wrapper.get('[data-testid="netsuite-query-add-field"]').trigger('click')
  const names = wrapper.findAll('input[name="recordFieldName"]')
  const columns = wrapper.findAll('input[name="sourceColumn"]')
  await names[2]!.setValue('claimAmount')
  await columns[2]!.setValue('ABS(foreigntotal) AS claim_amount')
  await next(wrapper)

  seen.push(stepId(wrapper))
  await pick(wrapper, 'netsuite-query-join-key', 'returnId')
  await next(wrapper)

  seen.push(stepId(wrapper))
  return seen
}

describe('NetSuiteQueryWorkflowPage', () => {
  beforeEach(() => {
    route.params = {}
    route.query = {}
    route.name = 'reconciliation-netsuite-query-create'
    route.fullPath = '/reconciliation/queries/new'
    push.mockClear()
    getOptions.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [], options: OPTIONS })
    saveQuery.mockReset().mockImplementation(async (query) => ({
      ok: true, messages: [], errors: [], savedQuery: { ...query },
    }))
    previewQuery.mockReset()
  })

  it('asks for match rules only when the query reads matching records', async () => {
    const matching = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    expect(await walkToReview(matching, 'RECORDS_MATCHING')).toEqual([
      'nsAuthConfigId', 'nsSuiteQlSourceQueryId', 'description', 'recordType', 'dateColumn', 'queryTemplate',
      'matchRules', 'fields', 'joinKeyFieldName', 'review',
    ])
    matching.unmount()

    const every = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    expect(await walkToReview(every, 'RECORDS')).toEqual([
      'nsAuthConfigId', 'nsSuiteQlSourceQueryId', 'description', 'recordType', 'dateColumn', 'queryTemplate',
      'fields', 'joinKeyFieldName', 'review',
    ])
  })

  it('holds a step until it is answered', async () => {
    const wrapper = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="wizard-next"]').attributes('disabled')).toBeDefined()
    await pick(wrapper, 'netsuite-query-account', 'gorjana_prod')
    expect(wrapper.get('[data-testid="wizard-next"]').attributes('disabled')).toBeUndefined()
  })

  it('accepts a record type that is not in the list', async () => {
    const wrapper = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    await pick(wrapper, 'netsuite-query-account', 'gorjana_prod')
    await next(wrapper)
    await wrapper.get('input[name="nsSuiteQlSourceQueryId"]').setValue('NS_JOURNAL')
    await next(wrapper)
    await next(wrapper)

    await wrapper.get('input[name="recordTypeOther"]').setValue('Journal')
    await next(wrapper)

    expect(stepId(wrapper)).toBe('dateColumn')
  })

  it('saves match rules as a list and the columns renumbered, then returns to the side picker', async () => {
    route.query = { returnTo: '/reconciliation/create?step=sources', side: 'FILE_2' }
    route.fullPath = '/reconciliation/queries/new?returnTo=%2Freconciliation%2Fcreate%3Fstep%3Dsources&side=FILE_2'
    const wrapper = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    await walkToReview(wrapper, 'RECORDS_MATCHING')

    await wrapper.get('[data-testid="save-netsuite-query"]').trigger('click')
    await flushPromises()

    expect(saveQuery).toHaveBeenCalledTimes(1)
    expect(saveQuery.mock.calls[0]![0]).toEqual({
      nsSuiteQlSourceQueryId: 'NS_WARRANTY_CLAIM',
      nsAuthConfigId: 'gorjana_prod',
      description: 'Warranty claims',
      recordType: 'RtnAuth',
      fromTable: 'transaction',
      dateColumn: 'trandate',
      queryTemplate: 'RECORDS_MATCHING',
      matchRules: [
        { fieldId: 'custbody_hc_warranty_number', op: 'NOT_EMPTY', values: [] },
        { fieldId: 'status', op: 'IN', values: ['RtnAuth:B', 'RtnAuth:D'] },
      ],
      joinKeyFieldName: 'returnId',
      originFieldName: '',
      isActive: 'Y',
      fields: [
        { recordFieldName: 'returnId', sourceColumn: 'custbody_hc_return_id', sequenceNum: 1 },
        { recordFieldName: 'claimAmount', sourceColumn: 'ABS(foreigntotal) AS claim_amount', sequenceNum: 2 },
      ],
    })
    expect(push).toHaveBeenCalledWith('/reconciliation/create?step=sources&newQuery=NS_WARRANTY_CLAIM&side=FILE_2')
  })

  it('refuses a returnTo that leaves the app and stays on the saved query', async () => {
    route.query = { returnTo: '//evil.example/steal', side: 'FILE_1' }
    route.fullPath = '/reconciliation/queries/new?returnTo=%2F%2Fevil.example%2Fsteal&side=FILE_1'
    const wrapper = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    await walkToReview(wrapper, 'RECORDS')

    await wrapper.get('[data-testid="save-netsuite-query"]').trigger('click')
    await flushPromises()

    expect(saveQuery.mock.calls[0]![0].matchRules).toEqual([])
    expect(push).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Saved.')
  })

  it('shows every validation message the save answers with, as written', async () => {
    saveQuery.mockRejectedValue(new ApiCallError('joinKeyFieldName returnKey is not a mapped field', 200, {
      method: 'facade.NetSuiteQueryFacadeServices.save#NsSuiteQlSourceQuery',
      result: {
        ok: false,
        errors: ['joinKeyFieldName returnKey is not a mapped field', 'matchRules field status needs a value'],
      },
    }))
    const wrapper = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    await walkToReview(wrapper, 'RECORDS')

    await wrapper.get('[data-testid="save-netsuite-query"]').trigger('click')
    await flushPromises()

    const errors = wrapper.get('[data-testid="netsuite-query-errors"]').text()
    expect(errors).toContain('joinKeyFieldName returnKey is not a mapped field')
    expect(errors).toContain('matchRules field status needs a value')
    expect(push).not.toHaveBeenCalled()
  })

  it('previews the SuiteQL and the first records before saving', async () => {
    previewQuery.mockResolvedValue({
      ok: true,
      errors: [],
      preview: {
        day: '2026-10-21',
        sql: "SELECT custbody_hc_return_id, ABS(foreigntotal) AS claim_amount FROM transaction WHERE type = 'RtnAuth'",
        records: [
          { returnId: 'R-100', claimAmount: '42.00' },
          { returnId: 'R-101', claimAmount: '18.50' },
        ],
        more: false,
      },
    })
    const wrapper = mount(NetSuiteQueryWorkflowPage)
    await flushPromises()
    await walkToReview(wrapper, 'RECORDS')

    await wrapper.get('input[name="previewDay"]').setValue('2026-10-21')
    await wrapper.get('[data-testid="netsuite-query-preview"]').trigger('click')
    await flushPromises()

    expect(previewQuery.mock.calls[0]![0]).toMatchObject({
      nsAuthConfigId: 'gorjana_prod',
      recordType: 'RtnAuth',
      day: '2026-10-21',
      fields: [
        { recordFieldName: 'returnId', sourceColumn: 'custbody_hc_return_id', sequenceNum: 1 },
        { recordFieldName: 'claimAmount', sourceColumn: 'ABS(foreigntotal) AS claim_amount', sequenceNum: 2 },
      ],
    })
    expect(wrapper.get('[data-testid="netsuite-query-preview-sql"]').text()).toContain('ABS(foreigntotal) AS claim_amount')
    const rows = wrapper.findAll('[data-testid="netsuite-query-preview-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('R-100')
    expect(rows[1]!.text()).toContain('18.50')
    expect(saveQuery).not.toHaveBeenCalled()
  })
})
