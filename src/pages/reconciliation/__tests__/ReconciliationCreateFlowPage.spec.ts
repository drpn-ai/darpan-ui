import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  buildReconciliationAutomationDraftState,
  clearPendingReconciliationAutomationDraftState,
  savePendingReconciliationAutomationDraftState,
} from '../../../lib/reconciliationAutomationDraft'
import { buildReconciliationRuleSetDraftState, type ReconciliationRuleSetDraft } from '../../../lib/reconciliationRuleSetDraft'

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const route = vi.hoisted(() => ({
  query: {} as Record<string, string>,
}))
const listEnumOptions = vi.hoisted(() => vi.fn())
const listJsonSchemas = vi.hoisted(() => vi.fn())
const flattenJsonSchema = vi.hoisted(() => vi.fn())
const createRuleSetRun = vi.hoisted(() => vi.fn())
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const RULESET_MANAGER_HELPER_COPY =
  'Open the Ruleset Manager to pair fields and start with the sketched operator set: =, >, and <. Normalizers stay separate for now.'
const SYSTEM_OPTIONS = [
  { enumId: 'OMS', label: 'OMS' },
  { enumId: 'SHOPIFY', label: 'SHOPIFY' },
  { enumId: 'NETSUITE', label: 'NetSuite' },
]
const FILE_TYPE_OPTIONS = [
  { enumId: 'DftCsv', label: 'CSV' },
  { enumId: 'DftJson', label: 'JSON' },
]

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listEnumOptions,
  },
  jsonSchemaFacade: {
    list: listJsonSchemas,
    flatten: flattenJsonSchema,
  },
  reconciliationFacade: {
    createRuleSetRun,
    listAutomationSourceOptions,
  },
}))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null as null | { draft: unknown, resumeStepId: string | null },
  automationDraftState: null as null | { draft: unknown, resumeStepId: string | null, savedRun: unknown | null },
  setWorkflowOrigin: vi.fn(),
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
  setAutomationDraft: vi.fn(),
  clearAutomationDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import ReconciliationCreateFlowPage from '../ReconciliationCreateFlowPage.vue'

function createDeferredPromise<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function chooseWorkflowOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="workflow-select-option"][data-option-value="${value}"]`).trigger('click')
}

async function chooseWorkflowChoice(
  wrapper: ReturnType<typeof mount>,
  testId: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
}

// API on both sides so a seeded draft resolves straight to the rules board without needing any
// schema/flatten mocking beyond what beforeEach already wires up for listAutomationSourceOptions.
const apiToApiDraft: ReconciliationRuleSetDraft = {
  runName: 'API Order Sync',
  file1SystemEnumId: 'OMS',
  file1SystemLabel: 'OMS',
  file1SourceTypeEnumId: 'AUT_SRC_API',
  file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
  file1SourceConfigId: 'KREWE_OMS',
  file1SourceConfigType: 'HOTWAX_OMS_REST',
  file1FileTypeEnumId: '',
  file1PrimaryIdExpression: ['$.records[*].externalId'],
  file2SystemEnumId: 'SHOPIFY',
  file2SystemLabel: 'SHOPIFY',
  file2SourceTypeEnumId: 'AUT_SRC_API',
  file2SystemMessageRemoteId: 'SHOPIFY_REMOTE',
  file2SourceConfigId: 'SHOPIFY_MAIN',
  file2SourceConfigType: 'SHOPIFY_AUTH',
  file2FileTypeEnumId: '',
  file2PrimaryIdExpression: ['$.records[*].id'],
}

// Seeding ruleSetDraftState before mount makes restoreDraftFromHistoryState hydrate every wizard
// answer and land currentStepIndex directly on the last step (steps.value.length - 1) — the same
// resume path RunsSettingsWorkflowPage and the Ruleset Manager already rely on. Since 'ruleset-rules'
// is now always that last entry, this is the fastest way to reach the board in a test.
async function mountCreateFlow(options: { draft?: ReconciliationRuleSetDraft } = {}): Promise<ReturnType<typeof mount>> {
  if (options.draft) {
    draftStoreState.ruleSetDraftState = buildReconciliationRuleSetDraftState(options.draft, 'ruleset-manager')
  }
  const wrapper = mount(ReconciliationCreateFlowPage)
  await flushPromises()
  return wrapper
}

// A seeded draft already lands on the board (see mountCreateFlow above); this just guards that
// and gives step-by-step callers a single place to land on the final step from wherever they are.
async function advanceToLastStep(wrapper: ReturnType<typeof mount>): Promise<void> {
  await flushPromises()
  while (!wrapper.find('[data-testid="ruleset-editor-board"]').exists()) {
    const nextButton = wrapper.find('[data-testid="wizard-next"]')
    if (!nextButton.exists() || nextButton.attributes('disabled') !== undefined) break
    await nextButton.trigger('click')
    await flushPromises()
  }
}

async function advanceToFinalPrimaryIdStep(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('input[name="runName"]').setValue('JSON Order Compare')
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
  await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftJson')

  await chooseWorkflowOption(wrapper, 'file1-schema-select', 'schema-oms-orders')
  await flushPromises()
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowOption(wrapper, 'file1-field-select', '$.orders[0].order_id')
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowOption(wrapper, 'file2-system-select', 'SHOPIFY')
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
  await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftJson')

  await chooseWorkflowOption(wrapper, 'file2-schema-select', 'schema-shopify-orders')
  await flushPromises()
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')
}

async function advanceToFile1PrimaryIdStep(
  wrapper: ReturnType<typeof mount>,
  fileTypeEnumId: 'DftJson' | 'DftCsv',
): Promise<void> {
  await wrapper.get('input[name="runName"]').setValue('Composite key run')
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
  await wrapper.get('[data-testid="wizard-next"]').trigger('click')

  await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
  await chooseWorkflowChoice(wrapper, `file1-filetype-choice-${fileTypeEnumId}`)

  if (fileTypeEnumId === 'DftJson') {
    await chooseWorkflowOption(wrapper, 'file1-schema-select', 'schema-return-items')
    await flushPromises()
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
  }
}

function createDraftState() {
  return buildReconciliationRuleSetDraftState(
    {
      runName: 'JSON Order Compare',
      file1SystemEnumId: 'OMS',
      file1SystemLabel: 'OMS',
      file1FileTypeEnumId: 'DftJson',
      file1JsonSchemaId: 'schema-oms-orders',
      file1SchemaFileName: 'test-oms-orders.schema.json',
      file1PrimaryIdExpression: ['$.orders[0].order_id'],
      file2SystemEnumId: 'SHOPIFY',
      file2SystemLabel: 'SHOPIFY',
      file2FileTypeEnumId: 'DftJson',
      file2JsonSchemaId: 'schema-shopify-orders',
      file2SchemaFileName: 'test-shopify-orders.schema.json',
      file2PrimaryIdExpression: ['$.data.orders.edges[0].node.id'],
    },
    'ruleset-manager',
  )
}

describe('ReconciliationCreateFlowPage', () => {
  beforeEach(() => {
    push.mockClear()
    listEnumOptions.mockReset()
    listJsonSchemas.mockReset()
    flattenJsonSchema.mockReset()
    createRuleSetRun.mockReset()
    listAutomationSourceOptions.mockReset()
    route.query = {}
    draftStoreState.workflowOrigin = null
    draftStoreState.ruleSetDraftState = null
    draftStoreState.automationDraftState = null
    draftStoreState.setWorkflowOrigin.mockClear()
    draftStoreState.setRuleSetDraft.mockClear()
    draftStoreState.setAutomationDraft.mockClear()
    draftStoreState.clearRuleSetDraft.mockClear()
    draftStoreState.clearAutomationDraft.mockClear()
    window.history.replaceState({}, '', '/')
    window.sessionStorage.clear()

    listEnumOptions.mockImplementation(async (enumTypeId: string) => {
      if (enumTypeId === 'DarpanSystemSource') {
        return {
          ok: true,
          messages: [],
          errors: [],
          options: [
            { enumId: 'OMS', label: 'OMS' },
            { enumId: 'SHOPIFY', label: 'SHOPIFY' },
            { enumId: 'NETSUITE', label: 'NetSuite' },
          ],
        }
      }

      return {
        ok: true,
        messages: [],
        errors: [],
        options: [
          { enumId: 'DftCsv', label: 'CSV' },
          { enumId: 'DftJson', label: 'JSON' },
        ],
      }
    })

    listJsonSchemas.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 200,
        totalCount: 2,
        pageCount: 1,
      },
      schemas: [
        {
          jsonSchemaId: 'schema-oms-orders',
          schemaName: 'test-oms-orders.schema.json',
          description: 'OMS orders',
          systemEnumId: 'OMS',
          systemLabel: 'OMS',
        },
        {
          jsonSchemaId: 'schema-shopify-orders',
          schemaName: 'test-shopify-orders.schema.json',
          description: 'Shopify orders',
          systemEnumId: 'SHOPIFY',
          systemLabel: 'SHOPIFY',
        },
        {
          jsonSchemaId: 'schema-return-items',
          schemaName: 'test-return-items.schema.json',
          description: 'Return items',
          systemEnumId: 'SHOPIFY',
          systemLabel: 'SHOPIFY',
        },
      ],
    })

    flattenJsonSchema.mockImplementation(async ({ jsonSchemaId }: { jsonSchemaId: string }) => {
      if (jsonSchemaId === 'schema-return-items') {
        return {
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.returns[0].return_id', type: 'string', required: true },
            { fieldPath: '$.returns[0].product_id', type: 'string', required: true },
          ],
        }
      }

      if (jsonSchemaId === 'schema-oms-orders') {
        return {
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.orders[0].order_id', type: 'string', required: true },
            { fieldPath: '$.orders[0].status', type: 'string', required: false },
          ],
        }
      }

      return {
        ok: true,
        messages: [],
        errors: [],
        fieldList: [
          { fieldPath: '$.data.orders.edges[0].node.id', type: 'string', required: true },
          { fieldPath: '$.data.orders.edges[0].node.status', type: 'string', required: false },
        ],
      }
    })

    createRuleSetRun.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      savedRun: {
        savedRunId: 'RS_JSON_ORDER_COMPARE',
        runName: 'JSON Order Compare',
        runType: 'ruleset',
        ruleSetId: 'RS_JSON_ORDER_COMPARE',
        compareScopeId: 'CS_RS_JSON_ORDER_COMPARE',
        requiresSystemSelection: false,
        defaultFile1SystemEnumId: 'OMS',
        defaultFile2SystemEnumId: 'SHOPIFY',
        systemOptions: [],
      },
    })

    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      inputModes: [],
      sourceTypes: [],
      relativeWindows: [],
      fileTypes: FILE_TYPE_OPTIONS,
      systems: SYSTEM_OPTIONS,
      savedRuns: [],
      sftpServers: [],
      sourceConfigs: [
        {
          sourceConfigId: 'KREWE_OMS',
          sourceConfigType: 'HOTWAX_OMS_REST',
          label: 'Krewe HotWax Orders',
          systemEnumId: 'OMS',
        },
        {
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
          label: 'Krewe Shopify',
          systemEnumId: 'SHOPIFY',
        },
        {
          sourceConfigId: 'NS_AUTH',
          sourceConfigType: 'NETSUITE_AUTH',
          label: 'NetSuite Auth',
          systemEnumId: 'NETSUITE',
        },
      ],
      nsRestletConfigs: [
        {
          nsRestletConfigId: 'NS_ORDERS',
          description: 'NetSuite orders RESTlet',
          label: 'NetSuite orders RESTlet',
          systemEnumId: 'NETSUITE',
          sourceConfigId: 'NS_AUTH',
          sourceConfigType: 'NETSUITE_AUTH',
        },
      ],
      systemRemotes: [
        {
          systemMessageRemoteId: 'HOTWAX_ORDERS_API',
          description: 'Orders API',
          label: 'Orders API',
          systemEnumId: 'OMS',
          optionKey: 'KREWE_OMS',
          sourceConfigId: 'KREWE_OMS',
          sourceConfigType: 'HOTWAX_OMS_REST',
          primaryIdOptions: [
            { fieldPath: '$.records[*].orderId', label: 'Order ID' },
            { fieldPath: '$.records[*].orderName', label: 'Order name' },
          ],
        },
        {
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          description: 'Shopify',
          label: 'Orders',
          systemEnumId: 'SHOPIFY',
          optionKey: 'SHOPIFY_MAIN',
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
          primaryIdOptions: [
            { fieldPath: '$.records[*].id', label: 'Order ID' },
          ],
        },
      ],
    })
  })

  it('asks for one value per step and creates directly after the basics are defined', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('What should this run be called?')
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('record root')

    await advanceToFinalPrimaryIdStep(wrapper)

    expect(flattenJsonSchema).toHaveBeenCalledWith({ jsonSchemaId: 'schema-oms-orders' }, expect.any(AbortSignal))
    expect(flattenJsonSchema).toHaveBeenCalledWith({ jsonSchemaId: 'schema-shopify-orders' }, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Which field identifies each record in Shopify orders')
    expect(wrapper.text()).not.toContain('Create JSON Order Compare now, or open the Ruleset Manager first?')
    expect(wrapper.text()).not.toContain(RULESET_MANAGER_HELPER_COPY)
    expect(wrapper.text()).not.toContain('Open the Ruleset Manager')
    expect(wrapper.find('[data-testid="ruleset-manager-handoff"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="open-ruleset-manager"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('sketched operator set')
    expect(wrapper.text()).not.toContain('Normalizers stay separate for now.')
    expect(wrapper.findAll('textarea')).toHaveLength(0)
    await chooseWorkflowOption(wrapper, 'file2-field-select', '$.data.orders.edges[0].node.id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.get('[data-testid="create-run-submit"]').text()).toBe('Save run')
  })

  it('creates a basic diff run from the final primary ID step', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await advanceToFinalPrimaryIdStep(wrapper)
    await chooseWorkflowOption(wrapper, 'file2-field-select', '$.data.orders.edges[0].node.id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.find('[data-testid="ruleset-editor-board"]').exists()).toBe(true)
    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(listEnumOptions).not.toHaveBeenCalled()
    expect(listJsonSchemas).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 200,
      query: '',
    }, expect.any(AbortSignal))
    expect(createRuleSetRun).toHaveBeenCalledWith({
      runName: 'JSON Order Compare',
      description: undefined,
      file1SystemEnumId: 'OMS',
      file1FileTypeEnumId: 'DftJson',
      file1SchemaFileName: 'test-oms-orders.schema.json',
      file1PrimaryIdExpression: '$.orders[0].order_id',
      file2SystemEnumId: 'SHOPIFY',
      file2FileTypeEnumId: 'DftJson',
      file2SchemaFileName: 'test-shopify-orders.schema.json',
      file2PrimaryIdExpression: '$.data.orders.edges[0].node.id',
    }, expect.any(AbortSignal))
    expect(push).toHaveBeenCalledWith({ name: 'hub' })
  })

  it('loads create-run setup choices from the reconciliation source-options contract', async () => {
    listEnumOptions.mockRejectedValue(new Error('Settings are restricted to Darpan admin users.'))

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    expect(listAutomationSourceOptions).toHaveBeenCalledTimes(1)
    expect(listEnumOptions).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('What should this run be called?')
    expect(wrapper.text()).not.toContain('Settings are restricted to Darpan admin users.')
    expect(wrapper.text()).not.toContain('Unable to load reconciliation setup options.')
  })

  it('creates a run with an API source on one side and a file upload source on the other', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Mixed Source Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await wrapper.get('input[name="description"]').setValue('HotWax API against Shopify upload')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
    await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'KREWE_OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    // KREWE_OMS resolves to exactly one API endpoint (HOTWAX_ORDERS_API), so the file1-api card is
    // skipped and that endpoint is auto-selected -- landing directly on the primary-id question.
    expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Which field identifies each record from Orders API?')
    await chooseWorkflowOption(wrapper, 'file1-field-select', '$.records[*].orderId')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file2-system-select', 'SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftCsv')

    await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
    await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(listAutomationSourceOptions).toHaveBeenCalled()
    expect(flattenJsonSchema).not.toHaveBeenCalled()
    expect(createRuleSetRun).toHaveBeenCalledWith({
      runName: 'Mixed Source Compare',
      description: 'HotWax API against Shopify upload',
      file1SystemEnumId: 'OMS',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
      file1SourceConfigId: 'KREWE_OMS',
      file1SourceConfigType: 'HOTWAX_OMS_REST',
      file1PrimaryIdExpression: '$.records[*].orderId',
      file2SystemEnumId: 'SHOPIFY',
      file2FileTypeEnumId: 'DftCsv',
      file2SchemaFileName: undefined,
      file2PrimaryIdExpression: 'order_id',
    }, expect.any(AbortSignal))
  })

  it('treats a transfer-order source as an OMS-configured source', async () => {
    listAutomationSourceOptions.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      inputModes: [],
      sourceTypes: [],
      relativeWindows: [],
      fileTypes: FILE_TYPE_OPTIONS,
      systems: [...SYSTEM_OPTIONS, { enumId: 'OMS_TRANSFER_ORDERS', label: 'OMS_TRANSFER_ORDERS' }],
      savedRuns: [],
      sftpServers: [],
      sourceConfigs: [
        {
          // Registry-driven as of Task 6: the backend always stamps sourceConfigType from the
          // connector's expectedSourceConfigType, one row per enabled endpoint. The UI no longer
          // guesses this from systemEnumId (Task 8 deleted that fallback).
          sourceConfigId: 'KREWE_TRANSFER_ORDERS',
          label: 'Krewe Transfer Orders',
          systemEnumId: 'OMS_TRANSFER_ORDERS',
          sourceConfigType: 'HOTWAX_OMS_REST_TRANSFER',
        },
      ],
      nsRestletConfigs: [],
      systemRemotes: [
        {
          systemMessageRemoteId: 'HOTWAX_TRANSFER_ORDERS_API',
          description: 'Transfer Orders API',
          label: 'Transfer Orders API',
          systemEnumId: 'OMS_TRANSFER_ORDERS',
          optionKey: 'KREWE_TRANSFER_ORDERS',
          sourceConfigId: 'KREWE_TRANSFER_ORDERS',
          primaryIdOptions: [
            { fieldPath: '$.records[*].transferOrderId', label: 'Transfer Order ID' },
          ],
        },
      ],
    })

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Transfer Order Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS_TRANSFER_ORDERS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
    expect(wrapper.find('[data-testid="file1-api-config-select"]').exists()).toBe(true)
    await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'KREWE_TRANSFER_ORDERS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    // KREWE_TRANSFER_ORDERS resolves to exactly one API endpoint, so the file1-api card is skipped
    // and that endpoint is auto-selected.
    expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
    await chooseWorkflowOption(wrapper, 'file1-field-select', '$.records[*].transferOrderId')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file2-system-select', 'SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftCsv')

    await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
    await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(createRuleSetRun).toHaveBeenCalledWith({
      runName: 'Transfer Order Compare',
      description: undefined,
      file1SystemEnumId: 'OMS_TRANSFER_ORDERS',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'HOTWAX_TRANSFER_ORDERS_API',
      file1SourceConfigId: 'KREWE_TRANSFER_ORDERS',
      file1SourceConfigType: 'HOTWAX_OMS_REST_TRANSFER',
      file1PrimaryIdExpression: '$.records[*].transferOrderId',
      file2SystemEnumId: 'SHOPIFY',
      file2FileTypeEnumId: 'DftCsv',
      file2SchemaFileName: undefined,
      file2PrimaryIdExpression: 'order_id',
    }, expect.any(AbortSignal))
  })

  it('auto-selects the API endpoint scoped to the selected system when only one option matches', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Shopify API Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
    expect(wrapper.text()).toContain('Which Shopify config should this source use?')
    await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'SHOPIFY_MAIN')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    // SHOPIFY_MAIN matches exactly one systemRemote (SHOPIFY_REMOTE, scoped to SHOPIFY) -- the
    // file1-api card is skipped, and the primary-id options come from that remote alone, not from
    // OMS's HOTWAX_ORDERS_API or NetSuite's restlet config.
    expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
    expect(wrapper.find('input[name="file1PrimaryIdExpression"]').exists()).toBe(false)
    await wrapper.get('[data-testid="file1-field-select"]').trigger('click')
    expect(wrapper.text()).toContain('Order ID')
    expect(wrapper.find('[data-testid="workflow-select-option"][data-option-value="$.records[*].id"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="workflow-select-option"][data-option-value="$.records[*].orderId"]').exists()).toBe(false)
  })

  it('keeps source config type scoped when Shopify and OMS use the same config id', async () => {
    listAutomationSourceOptions.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      inputModes: [],
      sourceTypes: [],
      relativeWindows: [],
      fileTypes: FILE_TYPE_OPTIONS,
      systems: SYSTEM_OPTIONS,
      savedRuns: [],
      sftpServers: [],
      sourceConfigs: [
        {
          sourceConfigId: 'gorjana_prod',
          sourceConfigType: 'HOTWAX_OMS_REST',
          label: 'Gorjana HotWax',
          systemEnumId: 'OMS',
        },
        {
          sourceConfigId: 'gorjana_prod',
          sourceConfigType: 'SHOPIFY_AUTH',
          label: 'Gorjana Shopify',
          systemEnumId: 'SHOPIFY',
        },
      ],
      nsRestletConfigs: [],
      systemRemotes: [
        {
          systemMessageRemoteId: 'HOTWAX_ORDERS_API',
          description: 'HotWax orders',
          label: 'HotWax orders',
          systemEnumId: 'OMS',
          optionKey: 'gorjana_prod',
          sourceConfigId: 'gorjana_prod',
          sourceConfigType: 'HOTWAX_OMS_REST',
          primaryIdOptions: [
            { fieldPath: '$.records[*].externalId', label: 'External ID' },
          ],
        },
        {
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          description: 'Shopify orders',
          label: 'Shopify orders',
          systemEnumId: 'SHOPIFY',
          optionKey: 'gorjana_prod',
          sourceConfigId: 'gorjana_prod',
          sourceConfigType: 'SHOPIFY_AUTH',
          primaryIdOptions: [
            { fieldPath: '$.records[*].id', label: 'Order ID' },
          ],
        },
      ],
    })

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Production Orders')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
    await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'gorjana_prod')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    // gorjana_prod resolves to exactly one API endpoint per system (SHOPIFY_REMOTE here), so the
    // file1-api card is skipped and that endpoint is auto-selected.
    expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
    await chooseWorkflowOption(wrapper, 'file1-field-select', '$.records[*].id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file2-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file2-source-choice-api')
    await chooseWorkflowOption(wrapper, 'file2-api-config-select', 'gorjana_prod')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    // Likewise for file2 (HOTWAX_ORDERS_API is the sole match for gorjana_prod under OMS).
    expect(wrapper.find('[data-testid="file2-api-select"]').exists()).toBe(false)
    await chooseWorkflowOption(wrapper, 'file2-field-select', '$.records[*].externalId')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(createRuleSetRun).toHaveBeenCalledWith({
      runName: 'Production Orders',
      description: undefined,
      file1SystemEnumId: 'SHOPIFY',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'SHOPIFY_REMOTE',
      file1SourceConfigId: 'gorjana_prod',
      file1SourceConfigType: 'SHOPIFY_AUTH',
      file1PrimaryIdExpression: '$.records[*].id',
      file2SystemEnumId: 'OMS',
      file2SourceTypeEnumId: 'AUT_SRC_API',
      file2SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
      file2SourceConfigId: 'gorjana_prod',
      file2SourceConfigType: 'HOTWAX_OMS_REST',
      file2PrimaryIdExpression: '$.records[*].externalId',
    }, expect.any(AbortSignal))
  })

  it('uses canonical Shopify system options when UAT returns legacy system rows', async () => {
    listAutomationSourceOptions.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      inputModes: [],
      sourceTypes: [],
      relativeWindows: [],
      fileTypes: FILE_TYPE_OPTIONS,
      systems: [
        { enumId: 'DarSysOms', enumCode: 'OMS', label: 'OMS' },
        { enumId: 'DarSysShopify', enumCode: 'SHOPIFY', label: 'SHOPIFY' },
      ],
      savedRuns: [],
      sftpServers: [],
      sourceConfigs: [
        {
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
          label: 'Krewe Shopify',
          systemEnumId: 'SHOPIFY',
        },
      ],
      nsRestletConfigs: [],
      systemRemotes: [
        {
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          description: 'Shopify',
          label: 'Orders',
          systemEnumId: 'SHOPIFY',
          optionKey: 'SHOPIFY_MAIN',
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
          primaryIdOptions: [
            { fieldPath: '$.records[*].id', label: 'Order ID' },
          ],
        },
      ],
    })

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Shopify API Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await wrapper.get('[data-testid="file1-system-select"]').trigger('click')
    expect(wrapper.find('[data-testid="workflow-select-option"][data-option-value="DarSysOms"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="workflow-select-option"][data-option-value="DarSysShopify"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="workflow-select-option"][data-option-value="OMS"]').text()).toBe('HotWax')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="SHOPIFY"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')

    expect(wrapper.text()).toContain('Which Shopify config should this source use?')
    expect(wrapper.text()).not.toContain('No API configs are available for Shopify.')
    await wrapper.get('[data-testid="file1-api-config-select"]').trigger('click')
    expect(wrapper.text()).toContain('Krewe Shopify')
  })

  it('does not fall back to free text when an API endpoint is missing primary ID metadata', async () => {
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      inputModes: [],
      sourceTypes: [],
      relativeWindows: [],
      fileTypes: FILE_TYPE_OPTIONS,
      systems: SYSTEM_OPTIONS,
      savedRuns: [],
      sftpServers: [],
      sourceConfigs: [
        {
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
          label: 'Krewe Shopify',
          systemEnumId: 'SHOPIFY',
        },
      ],
      nsRestletConfigs: [],
      systemRemotes: [
        {
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          description: 'Shopify',
          label: 'Orders',
          systemEnumId: 'SHOPIFY',
          optionKey: 'SHOPIFY_MAIN',
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
        },
      ],
    })

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Shopify API Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
    await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'SHOPIFY_MAIN')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    // SHOPIFY_MAIN resolves to exactly one API endpoint, so the file1-api card is skipped and that
    // endpoint (which has no primaryIdOptions) is auto-selected.
    expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
    expect(wrapper.find('input[name="file1PrimaryIdExpression"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="file1-field-select"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No ID fields are available for Orders.')
    expect(wrapper.get('[data-testid="wizard-next"]').attributes('disabled')).toBeDefined()
  })

  describe('redundant file{n}-api step skip', () => {
    // Post option-rows-are-one-per-(config x endpoint), OMS/Shopify configs resolve to exactly one
    // API endpoint, making "which API endpoint" redundant with "which config" -- see the file{n}Api
    // SourceStepNeeded computeds. NetSuite keeps several restlet configs per auth config, so the
    // card must stay meaningful (and visible) there.

    it('skips the file1-api card for a single-option Shopify config and still saves the auto-selected remote', async () => {
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('Shopify Returns Compare')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
      // SHOPIFY_MAIN resolves to exactly one systemRemote (SHOPIFY_REMOTE) in the default fixture.
      await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'SHOPIFY_MAIN')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Which field identifies each record from Orders?')
      await chooseWorkflowOption(wrapper, 'file1-field-select', '$.records[*].id')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file2-system-select', 'OMS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
      await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftCsv')

      await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
      await flushPromises()

      expect(createRuleSetRun).toHaveBeenCalledWith({
        runName: 'Shopify Returns Compare',
        description: undefined,
        file1SystemEnumId: 'SHOPIFY',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SystemMessageRemoteId: 'SHOPIFY_REMOTE',
        file1SourceConfigId: 'SHOPIFY_MAIN',
        file1SourceConfigType: 'SHOPIFY_AUTH',
        file1PrimaryIdExpression: '$.records[*].id',
        file2SystemEnumId: 'OMS',
        file2FileTypeEnumId: 'DftCsv',
        file2SchemaFileName: undefined,
        file2PrimaryIdExpression: 'order_id',
      }, expect.any(AbortSignal))
    })

    it('keeps the file1-api card when a NetSuite auth config resolves to two restlet configs', async () => {
      listAutomationSourceOptions.mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        inputModes: [],
        sourceTypes: [],
        relativeWindows: [],
        fileTypes: FILE_TYPE_OPTIONS,
        systems: SYSTEM_OPTIONS,
        savedRuns: [],
        sftpServers: [],
        sourceConfigs: [
          { sourceConfigId: 'NS_AUTH', sourceConfigType: 'NETSUITE_AUTH', label: 'NetSuite Auth', systemEnumId: 'NETSUITE' },
        ],
        nsRestletConfigs: [
          {
            nsRestletConfigId: 'NS_ORDERS',
            description: 'NetSuite orders RESTlet',
            label: 'Orders RESTlet',
            systemEnumId: 'NETSUITE',
            sourceConfigId: 'NS_AUTH',
            sourceConfigType: 'NETSUITE_AUTH',
            primaryIdOptions: [{ fieldPath: '$.records[*].orderId', label: 'Order ID' }],
          },
          {
            nsRestletConfigId: 'NS_RETURNS',
            description: 'NetSuite returns RESTlet',
            label: 'Returns RESTlet',
            systemEnumId: 'NETSUITE',
            sourceConfigId: 'NS_AUTH',
            sourceConfigType: 'NETSUITE_AUTH',
            primaryIdOptions: [{ fieldPath: '$.records[*].returnId', label: 'Return ID' }],
          },
        ],
        systemRemotes: [],
      })

      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('NetSuite API Compare')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'NETSUITE')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
      await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'NS_AUTH')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      // Two restlet configs share NS_AUTH -- this is a real choice, unlike the single-option
      // OMS/Shopify case, so the card must still render.
      expect(wrapper.text()).toContain('Which API endpoint should NetSuite use?')
      await wrapper.get('[data-testid="file1-api-select"]').trigger('click')
      expect(wrapper.find('[data-testid="workflow-select-option"][data-option-value="ns:NS_ORDERS"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="workflow-select-option"][data-option-value="ns:NS_RETURNS"]').exists()).toBe(true)

      await wrapper.get('[data-testid="workflow-select-option"][data-option-value="ns:NS_RETURNS"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      expect(wrapper.text()).toContain('Which field identifies each record from Returns RESTlet?')
    })

    it('going Back and switching to a config with a different option count updates the step list', async () => {
      listAutomationSourceOptions.mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        inputModes: [],
        sourceTypes: [],
        relativeWindows: [],
        fileTypes: FILE_TYPE_OPTIONS,
        systems: SYSTEM_OPTIONS,
        savedRuns: [],
        sftpServers: [],
        sourceConfigs: [
          { sourceConfigId: 'NS_AUTH', sourceConfigType: 'NETSUITE_AUTH', label: 'NetSuite Prod Auth', systemEnumId: 'NETSUITE' },
          { sourceConfigId: 'NS_AUTH_ALT', sourceConfigType: 'NETSUITE_AUTH', label: 'NetSuite Alt Auth', systemEnumId: 'NETSUITE' },
        ],
        nsRestletConfigs: [
          {
            nsRestletConfigId: 'NS_ORDERS',
            description: 'NetSuite orders RESTlet',
            label: 'Orders RESTlet',
            systemEnumId: 'NETSUITE',
            sourceConfigId: 'NS_AUTH',
            sourceConfigType: 'NETSUITE_AUTH',
            primaryIdOptions: [{ fieldPath: '$.records[*].orderId', label: 'Order ID' }],
          },
          {
            nsRestletConfigId: 'NS_RETURNS',
            description: 'NetSuite returns RESTlet',
            label: 'Returns RESTlet',
            systemEnumId: 'NETSUITE',
            sourceConfigId: 'NS_AUTH',
            sourceConfigType: 'NETSUITE_AUTH',
            primaryIdOptions: [{ fieldPath: '$.records[*].returnId', label: 'Return ID' }],
          },
          {
            nsRestletConfigId: 'NS_ALT_ORDERS',
            description: 'NetSuite alt orders RESTlet',
            label: 'Alt Orders RESTlet',
            systemEnumId: 'NETSUITE',
            sourceConfigId: 'NS_AUTH_ALT',
            sourceConfigType: 'NETSUITE_AUTH',
            primaryIdOptions: [{ fieldPath: '$.records[*].altOrderId', label: 'Alt Order ID' }],
          },
        ],
        systemRemotes: [],
      })

      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('NetSuite Config Switch')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'NETSUITE')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')
      await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'NS_AUTH')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      // NS_AUTH has two restlet configs -- the card is a real choice and must render.
      expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(true)
      await chooseWorkflowOption(wrapper, 'file1-api-select', 'ns:NS_ORDERS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      expect(wrapper.text()).toContain('Which field identifies each record from Orders RESTlet?')

      await wrapper.get('.wizard-back').trigger('click')
      await wrapper.get('.wizard-back').trigger('click')
      expect(wrapper.get('[data-testid="file1-api-config-select"]').text()).toContain('NetSuite Prod Auth')

      // Switching to NS_AUTH_ALT, which resolves to exactly one restlet config, must drop the
      // file1-api card from the step list and auto-select that sole option.
      await chooseWorkflowOption(wrapper, 'file1-api-config-select', 'NS_AUTH_ALT')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      expect(wrapper.find('[data-testid="file1-api-select"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('Which field identifies each record from Alt Orders RESTlet?')
    })
  })

  it('renders file type selection with keyed choice cards and advances on keyboard shortcut', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage, { attachTo: document.body })
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('JSON Order Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).toContain('How should HotWax provide data?')
    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')

    expect(wrapper.find('[data-testid="file1-filetype-select"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
    expect(wrapper.text()).not.toContain('press Enter')
    expect(wrapper.find('[data-testid="wizard-next"]').exists()).toBe(false)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    await flushPromises()

    expect(wrapper.text()).toContain('Which saved schema describes the HotWax JSON?')

    wrapper.unmount()
  })

  it('restores schema trigger focus after schema fields load so Enter advances', async () => {
    const omsSchemaFields = createDeferredPromise<{
      ok: boolean
      messages: string[]
      errors: string[]
      fieldList: { fieldPath: string, type: string, required: boolean }[]
    }>()

    flattenJsonSchema.mockImplementation(async ({ jsonSchemaId }: { jsonSchemaId: string }) => {
      if (jsonSchemaId === 'schema-oms-orders') {
        return omsSchemaFields.promise
      }

      return {
        ok: true,
        messages: [],
        errors: [],
        fieldList: [
          { fieldPath: '$.data.orders.edges[0].node.id', type: 'string', required: true },
          { fieldPath: '$.data.orders.edges[0].node.status', type: 'string', required: false },
        ],
      }
    })

    const wrapper = mount(ReconciliationCreateFlowPage, { attachTo: document.body })
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('JSON Order Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftJson')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-schema-select', 'schema-oms-orders')
    await flushPromises()

    omsSchemaFields.resolve({
      ok: true,
      messages: [],
      errors: [],
      fieldList: [
        { fieldPath: '$.orders[0].order_id', type: 'string', required: true },
        { fieldPath: '$.orders[0].status', type: 'string', required: false },
      ],
    })
    await flushPromises()

    expect((document.activeElement as HTMLElement | null)?.dataset.testid).toBe('file1-schema-select')

    await wrapper.get('[data-testid="file1-schema-select"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Which field identifies each record in OMS orders')

    wrapper.unmount()
  })

  it('places the create schema alternate path between the schema selector and action buttons', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('JSON Order Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftJson')
    await flushPromises()

    const schemaSelect = wrapper.get('[data-testid="file1-schema-select"]')
    const createSchemaChoice = wrapper.get('.reconciliation-create-schema-choice')
    const divider = wrapper.get('[data-testid="create-schema-divider"]')
    const createSchemaAction = wrapper.get('[data-testid="create-schema-from-reconciliation"]')
    const actionRow = wrapper.get('.wizard-actions')

    expect(createSchemaChoice.text()).toBe('Or Create New Schema')
    expect(divider.text()).toBe('Or')
    expect(createSchemaAction.text()).toBe('Create New Schema')
    expect(actionRow.text()).toContain('OK')
    expect(actionRow.text()).not.toContain('Create New Schema')
    expect(actionRow.element.contains(createSchemaAction.element)).toBe(false)
    expect(schemaSelect.element.compareDocumentPosition(divider.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(createSchemaAction.element.compareDocumentPosition(actionRow.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('softens all-caps system labels in schema-selection headers while preserving acronyms', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('JSON Order Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftJson')
    await flushPromises()

    expect(wrapper.text()).toContain('Which saved schema describes the Shopify JSON?')
    expect(wrapper.text()).not.toContain('Which saved schema describes the SHOPIFY JSON?')

    await wrapper.get('[data-testid="file1-schema-select"]').trigger('click')

    const shopifySchemaOption = wrapper.get('[data-testid="workflow-select-option"][data-option-value="schema-shopify-orders"]')
    expect(shopifySchemaOption.text()).toBe('Shopify orders - Shopify')

    await shopifySchemaOption.trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'file1-field-select', '$.data.orders.edges[0].node.id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file2-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftJson')
    await flushPromises()

    expect(wrapper.text()).toContain('Which saved schema describes the HotWax JSON?')
  })

  it('offers a text action to create a schema when no saved JSON schema exists for the selected system', async () => {
    listJsonSchemas.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 200,
        totalCount: 1,
        pageCount: 1,
      },
      schemas: [
        {
          jsonSchemaId: 'schema-shopify-orders',
          schemaName: 'test-shopify-orders.schema.json',
          description: 'Shopify orders',
          systemEnumId: 'SHOPIFY',
          systemLabel: 'SHOPIFY',
        },
      ],
    })

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('JSON Order Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftJson')
    await flushPromises()

    expect(wrapper.text()).toContain('No saved JSON schemas are available for HotWax.')
    expect(wrapper.get('[data-testid="create-schema-from-reconciliation"]').text()).toBe('Create New Schema')

    await wrapper.get('[data-testid="create-schema-from-reconciliation"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      path: '/schemas/create'
    })
  })

  it('blocks source 2 when it uses the same system as source 1', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Order Status Compare')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftCsv')

    await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
    await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    await chooseWorkflowOption(wrapper, 'file2-system-select', 'OMS')
    await flushPromises()

    expect(wrapper.text()).toContain('Source 2 must use a different system than source 1.')
    expect(wrapper.get('[data-testid="wizard-next"]').attributes('disabled')).toBeDefined()
  })

  it('restores the draft from history state and returns to the workflow origin after creating the run', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createDraftState()
    window.history.replaceState({}, '', '/reconciliation/create')

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    // A fully-answered seeded draft resumes directly onto the wizard's final step (the rules
    // board) rather than re-asking the last question.
    expect(wrapper.find('[data-testid="ruleset-editor-board"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Create JSON Order Compare now, or open the Ruleset Manager first?')
    expect(wrapper.text()).not.toContain(RULESET_MANAGER_HELPER_COPY)
    expect(wrapper.text()).not.toContain('Open the Ruleset Manager')
    expect(wrapper.find('[data-testid="ruleset-manager-handoff"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="open-ruleset-manager"]').exists()).toBe(false)

    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/settings/runs')
  })

  it('consumes a seeded draft on mount so it cannot resume on a later visit', async () => {
    draftStoreState.ruleSetDraftState = createDraftState()
    window.history.replaceState({}, '', '/reconciliation/create')

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-editor-board"]').exists()).toBe(true)
    expect(draftStoreState.clearRuleSetDraft).toHaveBeenCalledTimes(1)
    // The board needing something to read/write means the wizard immediately re-seeds a fresh
    // draft (so ruleSetDraftState is non-null again right after mount) — asserting clear was
    // "called" alone doesn't prove the original seed was actually consumed rather than merely
    // overwritten in place. Proving the clear fired *before* that re-seed is what shows the
    // original is genuinely gone, not just shadowed.
    expect(draftStoreState.setRuleSetDraft).toHaveBeenCalled()
    const clearOrder = draftStoreState.clearRuleSetDraft.mock.invocationCallOrder[0]!
    const lastReseedOrder = draftStoreState.setRuleSetDraft.mock.invocationCallOrder.at(-1)!
    expect(clearOrder).toBeLessThan(lastReseedOrder)
  })

  it('discards all draft state when the user exits mid-creation', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Half-finished run')
    draftStoreState.clearRuleSetDraft.mockClear()
    draftStoreState.clearAutomationDraft.mockClear()

    wrapper.unmount()

    expect(draftStoreState.clearRuleSetDraft).toHaveBeenCalled()
    expect(draftStoreState.clearAutomationDraft).toHaveBeenCalled()
  })

  it('keeps the automation handoff draft alive across the schema-create detour', async () => {
    route.query = { automationFlow: 'new-run' }
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
      { intent: 'new-run' },
      'input-mode',
      null,
    )

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await wrapper.get('input[name="runName"]').setValue('Automation run')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
    await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftJson')

    await wrapper.get('[data-testid="create-schema-from-reconciliation"]').trigger('click')
    await flushPromises()
    expect(push).toHaveBeenCalledWith({ path: '/schemas/create' })

    wrapper.unmount()

    expect(draftStoreState.clearAutomationDraft).not.toHaveBeenCalled()
  })

  it('hands a newly created saved run back to automation setup when launched from automation workflow', async () => {
    draftStoreState.workflowOrigin = { label: 'Automation Setup', path: '/reconciliation/automation/create' }
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
      { intent: 'new-run' },
      null,
      null,
    )
    window.history.replaceState({}, '', '/reconciliation/create?automationFlow=new-run')
    route.query = { automationFlow: 'new-run' }

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await advanceToFinalPrimaryIdStep(wrapper)
    await chooseWorkflowOption(wrapper, 'file2-field-select', '$.data.orders.edges[0].node.id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ path: '/reconciliation/automation/create' })
    expect(draftStoreState.setAutomationDraft).toHaveBeenCalled()
    // The board step seeded a ruleset draft into the store so RuleSetBoard had something to
    // read/write (seedRuleSetBoardDraft). continuingFlowElsewhere protects the *automation*
    // handoff draft from onUnmounted's cleanup here, but the ruleset draft is unrelated and must
    // still be cleared — left in place, a later /reconciliation/create visit would resume
    // straight onto the board with this just-created run's answers and a live "Save run".
    expect(draftStoreState.clearRuleSetDraft).toHaveBeenCalled()
  })

  it('continues automation setup from the pending option-B handoff when history state is lost', async () => {
    route.query = { automationFlow: 'new-run' }
    draftStoreState.automationDraftState = buildReconciliationAutomationDraftState(
      { intent: 'new-run' },
      'input-mode',
      null,
    )
    savePendingReconciliationAutomationDraftState({ intent: 'new-run' }, 'input-mode', null)
    window.history.replaceState({}, '', '/reconciliation/create?automationFlow=new-run')

    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()

    await advanceToFinalPrimaryIdStep(wrapper)
    await chooseWorkflowOption(wrapper, 'file2-field-select', '$.data.orders.edges[0].node.id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ path: '/reconciliation/automation/create' })
    expect(draftStoreState.setAutomationDraft).toHaveBeenCalled()
    clearPendingReconciliationAutomationDraftState()
  })

  it('lets the user pick two fields for a composite primary key on a JSON source and submits both', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()
    await advanceToFile1PrimaryIdStep(wrapper, 'DftJson')

    // First pick opens the menu via chooseWorkflowOption's trigger click. Task 6's multi-select
    // path does not auto-close the menu after a pick (so multiple picks are possible), so the
    // second pick clicks the option directly — re-using chooseWorkflowOption here would re-toggle
    // the trigger and close the still-open menu instead of picking the second field.
    await chooseWorkflowOption(wrapper, 'file1-field-select', '$.returns[0].return_id')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="$.returns[0].product_id"]').trigger('click')

    const chipTexts = wrapper.findAll('[data-testid="workflow-select-chip"]').map((chip) => chip.text())
    expect(chipTexts.some((text) => text.includes('$.returns[0].return_id'))).toBe(true)
    expect(chipTexts.some((text) => text.includes('$.returns[0].product_id'))).toBe(true)
  })

  it('CSV primary-id step renders a chip-text-input and accepts multiple typed column names', async () => {
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()
    await advanceToFile1PrimaryIdStep(wrapper, 'DftCsv')

    const input = wrapper.get('[data-testid="workflow-chip-text-input"]')
    await input.setValue('return_id')
    await input.trigger('keydown.enter')
    await input.setValue('product_id')
    await input.trigger('keydown.enter')

    expect(wrapper.findAll('[data-testid="workflow-chip-text-chip"]')).toHaveLength(2)
  })

  it('advances the step when a primary id is typed but never Enter-ed', async () => {
    // The chip input only commits on Enter, so a typed-but-uncommitted column left the draft empty,
    // canProceed false, and "Next" doing nothing at all -- no chip, no error, no movement. Same
    // trap that made rule-set exclusions look inert on sm-darpan (DAR-CLIENT-003).
    //
    // jsdom does not blur the input when the button is clicked, so this exercises the parent's
    // explicit flush in handlePrimarySubmit rather than the component's @blur -- which is exactly
    // the wiring that a production build (where <script setup> is closed without defineExpose)
    // would otherwise break.
    const wrapper = mount(ReconciliationCreateFlowPage)
    await flushPromises()
    await advanceToFile1PrimaryIdStep(wrapper, 'DftCsv')

    await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('return_id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="workflow-chip-text-input"]').exists()).toBe(false)
  })

  describe('rules board as the final step', () => {
    it('ends the wizard on the rules board', async () => {
      const wrapper = await mountCreateFlow({ draft: apiToApiDraft })

      await advanceToLastStep(wrapper)

      expect(wrapper.find('[data-testid="ruleset-editor-board"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('How should Darpan compare these two systems?')
      expect(wrapper.get('[data-testid="create-run-submit"]').text()).toBe('Save run')
    })

    it('gives the board the same stage the rules editor page does', async () => {
      // Same board, same width and action alignment, whichever door you came through: the modifier
      // lives in WorkflowStepForm and both this step and ReconciliationRuleSetEditorPage wear it.
      // Without it this step renders the board in the 720px question column while the editor page
      // renders it at 920px — one board, two looks.
      const plainStep = await mountCreateFlow()
      expect(plainStep.find('[data-testid="ruleset-editor-board"]').exists()).toBe(false)
      expect(plainStep.get('.wizard-question-shell').classes()).not.toContain('workflow-form--board-stage')

      const wrapper = await mountCreateFlow({ draft: apiToApiDraft })
      await advanceToLastStep(wrapper)

      expect(wrapper.find('[data-testid="ruleset-editor-board"]').exists()).toBe(true)
      expect(wrapper.get('.wizard-question-shell').classes()).toContain('workflow-form--board-stage')
    })

    it('saves a run with rules and exclusions drawn on the final step', async () => {
      const wrapper = await mountCreateFlow({
        draft: {
          ...apiToApiDraft,
          rules: [{ file1FieldPath: 'name', file2FieldPath: 'externalId', operator: '=', sequenceNum: 1 }],
          file2ExcludeFilters: [{ fieldExpression: 'salesChannelEnumId', values: ['POS_SALES_CHANNEL'] }],
        },
      })

      await advanceToLastStep(wrapper)
      await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
      await flushPromises()

      // buildRuleSetRulePayloads folds file1FieldPath/file2FieldPath into a JSON `expression`
      // string rather than flat payload keys — assert against that real shape rather than a flat
      // file1FieldPath key.
      expect(createRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ expression: expect.stringContaining('"file1FieldPath":"name"') }),
          ]),
          file2ExcludeFilters: [
            { fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
          ],
        }),
        expect.anything(),
      )
    })

    it('still saves when the board is left empty', async () => {
      // A run with no comparison rules is legitimate; the final step must not become a gate.
      const wrapper = await mountCreateFlow({ draft: apiToApiDraft })

      await advanceToLastStep(wrapper)
      await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
      await flushPromises()

      expect(createRuleSetRun).toHaveBeenCalled()
      expect((createRuleSetRun.mock.calls[0]?.[0] as { rules?: unknown })?.rules).toBeUndefined()
    })

    it('can go back from the board to the previous question', async () => {
      const wrapper = await mountCreateFlow({ draft: apiToApiDraft })

      await advanceToLastStep(wrapper)
      // WorkflowStepForm's back button has no data-testid of its own — existing specs (e.g.
      // ReconciliationAutomationWorkflowPage.spec.ts) already select it by class.
      await wrapper.get('.wizard-back').trigger('click')

      expect(wrapper.find('[data-testid="ruleset-editor-board"]').exists()).toBe(false)
    })
  })

  describe('two-step source picker (system, then endpoint)', () => {
    // Mirrors the real DarpanSystemSource shape: OMS_RETURNS is an endpoint grouped under OMS via
    // parentEnumId. SHOPIFY/NETSUITE carry no parentEnumId and have nothing grouped under them, so
    // they must keep today's single-step behaviour.
    const SYSTEM_OPTIONS_WITH_OMS_ENDPOINT = [
      ...SYSTEM_OPTIONS,
      { enumId: 'OMS_RETURNS', label: 'HotWax Returns (Reconciliation API)', parentEnumId: 'OMS' },
    ]

    function mockSystemsWithOmsEndpoint(): void {
      listAutomationSourceOptions.mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        inputModes: [],
        sourceTypes: [],
        relativeWindows: [],
        fileTypes: FILE_TYPE_OPTIONS,
        systems: SYSTEM_OPTIONS_WITH_OMS_ENDPOINT,
        savedRuns: [],
        sftpServers: [],
        sourceConfigs: [],
        nsRestletConfigs: [],
        systemRemotes: [],
      })
    }

    it('lists only top-level systems at step 1 — endpoints are not promoted to top-level', async () => {
      mockSystemsWithOmsEndpoint()
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('Endpoint Picker Test')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await wrapper.get('[data-testid="file1-system-select"]').trigger('click')
      const optionValues = wrapper
        .findAll('[data-testid="workflow-select-option"]')
        .map((option) => option.attributes('data-option-value'))
      expect(optionValues).toEqual(['OMS', 'SHOPIFY', 'NETSUITE'])
      expect(optionValues).not.toContain('OMS_RETURNS')
    })

    it('asks for the endpoint after a system with endpoints is chosen, offering the system itself as the default plus its endpoints', async () => {
      mockSystemsWithOmsEndpoint()
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('Endpoint Picker Test')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      expect(wrapper.text()).toContain('Which HotWax endpoint provides the first source?')
      await wrapper.get('[data-testid="file1-endpoint-select"]').trigger('click')
      const optionValues = wrapper
        .findAll('[data-testid="workflow-select-option"]')
        .map((option) => option.attributes('data-option-value'))
      expect(optionValues).toEqual(['OMS', 'OMS_RETURNS'])
    })

    it('skips the endpoint step entirely for a system with no endpoints', async () => {
      mockSystemsWithOmsEndpoint()
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('No Endpoint Test')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'SHOPIFY')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      expect(wrapper.text()).toContain('How should Shopify provide data?')
      expect(wrapper.find('[data-testid="file1-endpoint-select"]').exists()).toBe(false)
    })

    it('submits the concrete endpoint enumId when a child endpoint is chosen', async () => {
      mockSystemsWithOmsEndpoint()
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('Returns Compare')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-endpoint-select', 'OMS_RETURNS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
      await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftCsv')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('return_id')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file2-system-select', 'SHOPIFY')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
      await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftCsv')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
      await flushPromises()

      expect(createRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({ file1SystemEnumId: 'OMS_RETURNS' }),
        expect.any(AbortSignal),
      )
    })

    it('submits the parent systemEnumId when its own default endpoint is chosen', async () => {
      mockSystemsWithOmsEndpoint()
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('Default Endpoint Compare')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-endpoint-select', 'OMS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file1-source-choice-file')
      await chooseWorkflowChoice(wrapper, 'file1-filetype-choice-DftCsv')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file2-system-select', 'SHOPIFY')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file2-source-choice-file')
      await chooseWorkflowChoice(wrapper, 'file2-filetype-choice-DftCsv')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').setValue('order_id')
      await wrapper.get('[data-testid="workflow-chip-text-input"]').trigger('keydown.enter')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="create-run-submit"]').trigger('click')
      await flushPromises()

      expect(createRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({ file1SystemEnumId: 'OMS' }),
        expect.any(AbortSignal),
      )
    })

    it('pre-selects the resumed parent and endpoint when walking back through a draft with a stored child systemEnumId', async () => {
      mockSystemsWithOmsEndpoint()
      const draft: ReconciliationRuleSetDraft = {
        runName: 'Returns Resume Test',
        file1SystemEnumId: 'OMS_RETURNS',
        file1SystemLabel: 'HotWax Returns (Reconciliation API)',
        file1FileTypeEnumId: 'DftJson',
        file1JsonSchemaId: 'schema-oms-orders',
        file1PrimaryIdExpression: ['$.orders[0].order_id'],
        file2SystemEnumId: 'SHOPIFY',
        file2SystemLabel: 'SHOPIFY',
        file2FileTypeEnumId: 'DftJson',
        file2JsonSchemaId: 'schema-shopify-orders',
        file2PrimaryIdExpression: ['$.data.orders.edges[0].node.id'],
      }
      const wrapper = await mountCreateFlow({ draft })

      // A seeded draft always resumes on the last step (ruleset-rules) — see mountCreateFlow's own
      // comment. Walk back through it to reach file1-endpoint and prove the resumed OMS_RETURNS
      // value both inserted that step (steps.value) and pre-selected it correctly.
      let guard = 0
      while (!wrapper.find('[data-testid="file1-endpoint-select"]').exists() && guard < 20) {
        await wrapper.get('.wizard-back').trigger('click')
        await flushPromises()
        guard += 1
      }
      expect(wrapper.get('[data-testid="file1-endpoint-select"]').text()).toContain('HotWax Returns (Reconciliation API)')

      await wrapper.get('.wizard-back').trigger('click')
      await flushPromises()
      // deduplicateDarpanSystemOptions relabels the OMS row to its canonical display label
      // ("HotWax") before it ever reaches allSystemOptions — same as every other system-select
      // assertion in this file that goes through currentQuestion/resolveSystemLabel.
      expect(wrapper.get('[data-testid="file1-system-select"]').text()).toBe('HotWax')
    })

    // Regression guard for Task 6 (Plan 2 registry-driven options): each enabled endpoint gets its
    // own sourceConfigs row, scoped to its own concrete systemEnumId. Before that change, the config
    // picker only ever offered rows keyed to the parent OMS system, so picking the OMS_RETURNS
    // endpoint left the config step empty. Task 8 deletes the UI-side expectedSourceConfigType
    // fallback that used to paper over a missing sourceConfigType on a row — this test proves the
    // backend now always supplies one for a config scoped to the child endpoint too.
    it('offers a connection after picking the returns endpoint', async () => {
      listAutomationSourceOptions.mockResolvedValueOnce({
        ok: true,
        messages: [],
        errors: [],
        inputModes: [],
        sourceTypes: [],
        relativeWindows: [],
        fileTypes: FILE_TYPE_OPTIONS,
        systems: SYSTEM_OPTIONS_WITH_OMS_ENDPOINT,
        savedRuns: [],
        sftpServers: [],
        sourceConfigs: [
          { sourceConfigId: 'gorjana_prod', systemEnumId: 'OMS', sourceConfigType: 'HOTWAX_OMS_REST', label: 'Gorjana Prod' },
          { sourceConfigId: 'gorjana_prod', systemEnumId: 'OMS_RETURNS', sourceConfigType: 'HOTWAX_OMS_REST_RETURNS', label: 'Gorjana Prod' },
        ],
        nsRestletConfigs: [],
        systemRemotes: [],
      })
      const wrapper = mount(ReconciliationCreateFlowPage)
      await flushPromises()

      await wrapper.get('input[name="runName"]').setValue('Returns Config Test')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-system-select', 'OMS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowOption(wrapper, 'file1-endpoint-select', 'OMS_RETURNS')
      await wrapper.get('[data-testid="wizard-next"]').trigger('click')

      await chooseWorkflowChoice(wrapper, 'file1-source-choice-api')

      await wrapper.get('[data-testid="file1-api-config-select"]').trigger('click')
      const optionValues = wrapper
        .findAll('[data-testid="workflow-select-option"]')
        .map((option) => option.attributes('data-option-value'))
      expect(optionValues).toContain('gorjana_prod')
    })
  })
})
