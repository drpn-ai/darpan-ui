import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  buildReconciliationRuleSetDraftState,
  type ReconciliationRuleSetDraftRule,
} from '../../../lib/reconciliationRuleSetDraft'
import { buildRuleSetDraft } from '../../../lib/savedRunEditorRoute'
import type { SavedRunSummary } from '../../../lib/api/types'
import type { SourceExcludeFilter } from '../../../lib/sourceExcludeFilters'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../../lib/uiEvents'

const getJsonSchema = vi.hoisted(() => vi.fn())
const flattenJsonSchema = vi.hoisted(() => vi.fn())
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const saveRuleSetRun = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  jsonSchemaFacade: {
    get: getJsonSchema,
    flatten: flattenJsonSchema,
  },
  reconciliationFacade: {
    listAutomationSourceOptions,
    saveRuleSetRun,
  },
}))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null as null | { draft: unknown, resumeStepId: string | null },
  automationDraftState: null,
  setWorkflowOrigin: vi.fn(),
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
  setAutomationDraft: vi.fn(),
  clearAutomationDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import ReconciliationRuleSetEditorPage from '../ReconciliationRuleSetEditorPage.vue'

function createDraftState(
  rules: ReconciliationRuleSetDraftRule[] = [],
  excludeFilters: { file1?: SourceExcludeFilter[], file2?: SourceExcludeFilter[] } = {},
) {
  return buildReconciliationRuleSetDraftState(
    {
      savedRunId: 'RS_JSON_ORDER_COMPARE',
      runName: 'JSON Order Compare',
      file1SystemEnumId: 'OMS',
      file1SystemLabel: 'OMS',
      file1FileTypeEnumId: 'DftJson',
      file1JsonSchemaId: 'schema-oms-orders',
      file1SchemaLabel: 'OMS orders',
      file1SchemaFileName: 'test-oms-orders.schema.json',
      file1PrimaryIdExpression: ['$.orders[0].order_id'],
      file2SystemEnumId: 'SHOPIFY',
      file2SystemLabel: 'SHOPIFY',
      file2FileTypeEnumId: 'DftJson',
      file2JsonSchemaId: 'schema-shopify-orders',
      file2SchemaLabel: 'Shopify orders',
      file2SchemaFileName: 'test-shopify-orders.schema.json',
      file2PrimaryIdExpression: ['$.data.orders.edges[0].node.id'],
      rules,
      ...(excludeFilters.file1 ? { file1ExcludeFilters: excludeFilters.file1 } : {}),
      ...(excludeFilters.file2 ? { file2ExcludeFilters: excludeFilters.file2 } : {}),
    },
    'ruleset-manager',
  )
}

// Mirrors what AutomationFacadeSupport serves: OMS carries the wider board field list AND declares
// the exclusion-filter parameter; Shopify does neither (its connector row has no filterParameterName
// and no keepFieldsBase to derive a wider list from).
const OMS_FIELD_OPTIONS = [
  { fieldPath: '$.records[*].orderId', label: 'Order ID', type: 'string' },
  { fieldPath: '$.records[*].orderName', label: 'Order name', type: 'string' },
  { fieldPath: '$.records[*].externalId', label: 'External ID', type: 'string' },
  { fieldPath: '$.records[*].grandTotal', label: 'Grand total', type: 'string' },
  { fieldPath: '$.records[*].orderDate', label: 'Order date', type: 'string' },
  { fieldPath: '$.records[*].statusId', label: 'Status', type: 'string' },
  { fieldPath: '$.records[*].salesChannelEnumId', label: 'Sales channel', type: 'string' },
]

function apiSourceOptionsResponse() {
  return {
    ok: true,
    messages: [],
    errors: [],
    sourceConfigs: [],
    nsRestletConfigs: [],
    systemRemotes: [
      {
        systemMessageRemoteId: 'HOTWAX_ORDERS_API',
        label: 'Orders API',
        systemEnumId: 'OMS',
        optionKey: 'KREWE_OMS',
        sourceConfigId: 'KREWE_OMS',
        sourceConfigType: 'HOTWAX_OMS_REST',
        primaryIdOptions: OMS_FIELD_OPTIONS.slice(0, 3),
        fieldOptions: OMS_FIELD_OPTIONS,
        supportsExcludeFilters: true,
      },
      {
        systemMessageRemoteId: 'SHOPIFY_REMOTE',
        label: 'Admin GraphQL Orders',
        systemEnumId: 'SHOPIFY',
        optionKey: 'SHOPIFY_MAIN',
        sourceConfigId: 'SHOPIFY_MAIN',
        sourceConfigType: 'SHOPIFY_AUTH',
        primaryIdOptions: [
          { fieldPath: '$.records[*].id', label: 'Order ID', type: 'ID' },
          { fieldPath: '$.records[*].name', label: 'Order name', type: 'String' },
        ],
        supportsExcludeFilters: false,
      },
      // Endpoint sibling that SHARES SHOPIFY_REMOTE and SHOPIFY_MAIN with the parent row above,
      // exactly as SHOPIFY_RETURN_REFS is seeded. Listed AFTER the parent so a lookup keyed on
      // remoteId + sourceConfigId alone resolves the WRONG row -- see the endpoint-scoped test.
      {
        systemMessageRemoteId: 'SHOPIFY_REMOTE',
        label: 'Shopify Return References',
        systemEnumId: 'SHOPIFY_RETURN_REFS',
        optionKey: 'SHOPIFY_MAIN',
        sourceConfigId: 'SHOPIFY_MAIN',
        sourceConfigType: 'SHOPIFY_RETURN_REFS_API',
        primaryIdOptions: [
          { fieldPath: '$.records[*].refundOrReturnId', label: 'Refund ID / Return ID', type: 'String' },
          { fieldPath: '$.records[*].orderId', label: 'Order ID', type: 'String' },
        ],
        supportsExcludeFilters: false,
      },
    ],
  }
}

/** The wire shape list#SavedRuns returns for a reopened OMS/Shopify run carrying two exclusions. */
function savedRunWithTwoExclusions(): SavedRunSummary {
  return {
    savedRunId: 'RS_API_ORDER_SYNC',
    runName: 'API Order Sync',
    runType: 'ruleset',
    ruleSetId: 'RS_API_ORDER_SYNC',
    requiresSystemSelection: false,
    systemOptions: [
      {
        fileSide: 'FILE_1',
        enumId: 'OMS',
        label: 'HotWax',
        sourceTypeEnumId: 'AUT_SRC_API',
        systemMessageRemoteId: 'HOTWAX_ORDERS_API',
        sourceConfigId: 'KREWE_OMS',
        sourceConfigType: 'HOTWAX_OMS_REST',
        idFieldExpressions: ['$.records[*].externalId'],
      },
      {
        fileSide: 'FILE_2',
        enumId: 'SHOPIFY',
        label: 'SHOPIFY',
        sourceTypeEnumId: 'AUT_SRC_API',
        systemMessageRemoteId: 'SHOPIFY_REMOTE',
        sourceConfigId: 'SHOPIFY_MAIN',
        sourceConfigType: 'SHOPIFY_AUTH',
        idFieldExpressions: ['$.records[*].id'],
      },
    ],
    rules: [],
    file1ExcludeFilters: [
      { fieldExpression: '$.records[*].salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
      { fieldExpression: '$.records[*].statusId', operator: 'EXCLUDE_IN', values: ['ORDER_CANCELLED'] },
    ],
  }
}

function createApiDraftState(
  rules: ReconciliationRuleSetDraftRule[] = [],
  excludeFilters: { file1?: SourceExcludeFilter[], file2?: SourceExcludeFilter[] } = {},
) {
  return buildReconciliationRuleSetDraftState(
    {
      savedRunId: 'RS_API_ORDER_SYNC',
      runName: 'API Order Sync',
      file1SystemEnumId: 'OMS',
      file1SystemLabel: 'HotWax',
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
      rules,
      ...(excludeFilters.file1 ? { file1ExcludeFilters: excludeFilters.file1 } : {}),
      ...(excludeFilters.file2 ? { file2ExcludeFilters: excludeFilters.file2 } : {}),
    },
    'ruleset-manager',
  )
}

async function chooseAppSelectOption(wrapper: ReturnType<typeof mount>, testId: string, value: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

function testRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect
}

describe('ReconciliationRuleSetEditorPage', () => {
  beforeEach(() => {
    getJsonSchema.mockReset()
    flattenJsonSchema.mockReset()
    listAutomationSourceOptions.mockReset()
    saveRuleSetRun.mockReset()
    routerPush.mockReset()
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState()

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

    getJsonSchema.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      schemaData: null,
    })
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [],
      nsRestletConfigs: [],
      systemRemotes: [],
    })
    saveRuleSetRun.mockImplementation(async (payload: { runName?: string, description?: string, rules?: Array<Record<string, unknown>> }) => ({
      ok: true,
      messages: ['Saved rules.'],
      errors: [],
      savedRun: {
        runName: payload.runName,
        description: payload.description,
        rules: (payload.rules ?? []).map((rule, index) => {
          const expression = JSON.parse(rule.expression as string) as Record<string, unknown>
          return {
            ...rule,
            ruleId: rule.ruleId ?? `RULE_${index + 1}`,
            file1FieldPath: expression.file1FieldPath as string,
            file2FieldPath: expression.file2FieldPath as string,
            operator: expression.operator as string,
            preActions: Array.isArray(expression.preActions) ? expression.preActions : undefined,
          }
        }),
      },
    }))

    flattenJsonSchema.mockImplementation(({ jsonSchemaId }: { jsonSchemaId: string }) => {
      if (jsonSchemaId === 'schema-oms-orders') {
        return Promise.resolve({
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.orders[0].order_id', type: 'string', required: true },
            { fieldPath: '$.orders[0].status', type: 'string', required: false },
            { fieldPath: '$.orders[0].total', type: 'number', required: false },
            { fieldPath: '$.orders[0].currentTotalPriceSet.shopMoney.currencyCode', type: 'string', required: false },
          ],
        })
      }

      return Promise.resolve({
        ok: true,
        messages: [],
        errors: [],
        fieldList: [
          { fieldPath: '$.data.orders.edges[0].node.id', type: 'string', required: true },
          { fieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', type: 'string', required: false },
          { fieldPath: '$.data.orders.edges[0].node.currentTotalPrice', type: 'number', required: false },
        ],
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the workflow editor with one field list for each schema and no visible basic diff rule', async () => {
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    expect(wrapper.find('.workflow-page').exists()).toBe(true)
    expect(wrapper.find('.workflow-page--edit').exists()).toBe(true)
    expect(wrapper.find('.workflow-page--ruleset-editor').exists()).toBe(true)
    expect(wrapper.find('.workflow-shell--center-stage').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ruleset-editor-context"]').exists()).toBe(false)
    expect(wrapper.find('.ruleset-editor-board').exists()).toBe(true)
    expect(wrapper.find('.ruleset-field-item').classes()).toContain('ruleset-field-item')
    expect(wrapper.text()).not.toContain('Edit rules')
    expect(wrapper.text()).not.toContain('JSON Order Compare')
    expect(wrapper.get('[data-testid="ruleset-field-list-file1"] header').text()).toBe('OMS')
    expect(wrapper.get('[data-testid="ruleset-field-list-file2"] header').text()).toBe('SHOPIFY')
    expect(wrapper.get('[data-testid="ruleset-field-list-file1"]').text()).not.toContain('OMS orders')
    expect(wrapper.get('[data-testid="ruleset-field-list-file2"]').text()).not.toContain('Shopify orders')
    expect(wrapper.findAll('[data-testid^="ruleset-field-file1-"]')).toHaveLength(4)
    expect(wrapper.findAll('[data-testid^="ruleset-field-file2-"]')).toHaveLength(3)
    const saveAction = wrapper.get('[data-testid="save-ruleset-rules"]')
    expect(saveAction.attributes('aria-label')).toBe('Save')
    expect(saveAction.classes()).toContain('app-icon-action')
    expect(saveAction.classes()).toContain('app-icon-action--primary')
    expect(saveAction.text()).toBe('')
    expect(wrapper.text()).not.toContain('Done')
    expect(wrapper.text()).toContain('order_id')
    expect(wrapper.text()).toContain('displayFinancialStatus')
    expect(wrapper.get('[data-testid="ruleset-field-file1-1"] .ruleset-field-meta').text()).toBe('$.orders[0].status')
    expect(wrapper.get('[data-testid="ruleset-field-file2-1"] .ruleset-field-meta').text()).toBe('$.data.orders.edges[0].node.displayFinancialStatus')
    const longPathMeta = wrapper.get('[data-testid="ruleset-field-file1-3"] .ruleset-field-meta')
    const longPathSegments = longPathMeta.findAll('.ruleset-field-path-segment').map((segment) => segment.text())
    expect(longPathMeta.text()).toBe('$.orders[0].currentTotalPriceSet.shopMoney.currencyCode')
    expect(longPathSegments.at(-1)).toBe('currencyCode')
    expect(wrapper.text()).not.toContain('string / optional')
    expect(wrapper.text()).not.toContain('Basic Diff')
    expect(wrapper.text()).not.toContain('#0')
    expect(wrapper.find('[data-testid^="ruleset-rule-operator-"]').exists()).toBe(false)
  })

  it('loads API endpoint fields for API-backed saved runs instead of only the primary IDs', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createApiDraftState([
          {
            ruleId: 'api-rule',
            file1FieldPath: '$.records[*].externalId',
            file2FieldPath: '$.records[*].id',
            operator: '=',
            sequenceNum: 1,
          },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [],
      nsRestletConfigs: [],
      systemRemotes: [
        {
          systemMessageRemoteId: 'HOTWAX_ORDERS_API',
          label: 'Orders API',
          systemEnumId: 'OMS',
          optionKey: 'KREWE_OMS',
          sourceConfigId: 'KREWE_OMS',
          sourceConfigType: 'HOTWAX_OMS_REST',
          primaryIdOptions: [
            { fieldPath: '$.records[*].orderId', label: 'Order ID', type: 'string' },
            { fieldPath: '$.records[*].orderName', label: 'Order name', type: 'string' },
            { fieldPath: '$.records[*].externalId', label: 'External ID', type: 'string' },
          ],
        },
        {
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          label: 'Admin GraphQL Orders',
          systemEnumId: 'SHOPIFY',
          optionKey: 'SHOPIFY_MAIN',
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_AUTH',
          primaryIdOptions: [
            { fieldPath: '$.records[*].id', label: 'Order ID', type: 'ID' },
            { fieldPath: '$.records[*].name', label: 'Order name', type: 'String' },
          ],
        },
      ],
    })

    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    expect(listAutomationSourceOptions).toHaveBeenCalledTimes(1)
    expect(flattenJsonSchema).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="ruleset-field-list-file1"] header').text()).toBe('HotWax')
    expect(wrapper.get('[data-testid="ruleset-field-list-file2"] header').text()).toBe('SHOPIFY')
    expect(wrapper.findAll('[data-testid^="ruleset-field-file1-"]')).toHaveLength(3)
    expect(wrapper.findAll('[data-testid^="ruleset-field-file2-"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="ruleset-field-file1-0"]').text()).toContain('Order ID')
    expect(wrapper.get('[data-testid="ruleset-field-file1-1"]').text()).toContain('Order name')
    expect(wrapper.get('[data-testid="ruleset-field-file1-2"]').text()).toContain('External ID')
    expect(wrapper.get('[data-testid="ruleset-field-file2-1"]').text()).toContain('Order name')
    expect(wrapper.find('[data-testid="ruleset-rule-operator-api-rule"]').exists()).toBe(true)
  })

  // Same defect the run-edit workflow had: systemMessageRemoteId is SHARED across a system family,
  // so resolving the board's field list by remoteId + sourceConfigId alone returned the PARENT's
  // option row. A SHOPIFY_RETURN_REFS side then listed Shopify's ORDER fields, and its own
  // refundOrReturnId -- the join key -- was not offerable at all.
  it('lists the endpoint\'s own board fields, not the parent system\'s', async () => {
    listAutomationSourceOptions.mockResolvedValue(apiSourceOptionsResponse())
    draftStoreState.ruleSetDraftState = buildReconciliationRuleSetDraftState(
      {
        savedRunId: 'RS_RETURNS_PROD',
        runName: 'Returns Prod',
        file1SystemEnumId: 'OMS',
        file1SystemLabel: 'HotWax',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
        file1SourceConfigId: 'KREWE_OMS',
        file1SourceConfigType: 'HOTWAX_OMS_REST',
        file1FileTypeEnumId: '',
        file1PrimaryIdExpression: ['$.records[*].externalId'],
        file2SystemEnumId: 'SHOPIFY_RETURN_REFS',
        file2SystemLabel: 'Shopify Order Return References',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SystemMessageRemoteId: 'SHOPIFY_REMOTE',
        file2SourceConfigId: 'SHOPIFY_MAIN',
        file2SourceConfigType: 'SHOPIFY_RETURN_REFS_API',
        file2FileTypeEnumId: '',
        file2PrimaryIdExpression: ['$.records[*].refundOrReturnId'],
      },
      'ruleset-manager',
    )

    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    // The board renders each field by its own name and path, not the pill label.
    const file2Fields = wrapper.get('[data-testid="ruleset-field-list-file2"]').text()
    expect(file2Fields).toContain('$.records[*].refundOrReturnId')
    // The parent's order fields, served when the lookup ignored systemEnumId.
    expect(file2Fields).not.toContain('$.records[*].name')
    expect(file2Fields).not.toContain('$.records[*].id')
  })

  it('uses a single theme-independent pen cursor with a black outline and white fill', () => {
    const source = readFileSync('src/components/reconciliation/RuleSetBoard.vue', 'utf8')

    const boardCursorIndex = source.indexOf('.ruleset-editor-board {')
    const cursorDefinitionIndex = source.indexOf('--ruleset-pen-cursor:')

    expect(boardCursorIndex).toBeGreaterThan(-1)
    expect(source.match(/--ruleset-pen-cursor:/g) ?? []).toHaveLength(1)
    expect(cursorDefinitionIndex).toBeGreaterThan(boardCursorIndex)
    expect(source).toContain('cursor: var(--ruleset-pen-cursor);')
    expect(source).toContain('cursor: var(--ruleset-pen-cursor) !important;')
    expect(source).toContain('.ruleset-field-item:hover *')
    expect(source).toContain('fill%3D%27%23ffffff%27')
    expect(source).toContain('stroke%3D%27%23000000%27')
    expect(source).toContain('stroke-width%3D%271.5%27')
    expect(source).not.toContain('fill%3D%27%23000000%27')
    expect(source).not.toContain(":global(:root[data-theme='light']) .ruleset-editor-board")
    expect(source).not.toContain(":global(:root[data-theme='dark']) .ruleset-editor-board")
    expect(source).not.toContain('cursor: inherit;')
  })

  it('keeps the ruleset editor in the centered workflow shell without the shared edit top offset', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationRuleSetEditorPage.vue', 'utf8')

    expect(source).toContain('class="workflow-page--ruleset-editor"')
    expect(source).toContain('center-stage')
    expect(source).toContain('.workflow-page--ruleset-editor.workflow-page--edit :deep(.workflow-shell) {')
    expect(source).toContain('padding-top: 0;')
  })

  it('creates a default equals rule by long-press drawing between opposite schema fields', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-field-file1-1"]').trigger('pointerdown', { pointerId: 1, button: 0 })
    await vi.advanceTimersByTimeAsync(340)
    await wrapper.get('[data-testid="ruleset-field-file2-1"]').trigger('pointerup', { pointerId: 1, button: 0 })
    await flushPromises()

    const operatorButtons = wrapper.findAll('.ruleset-operator-box')
    expect(operatorButtons).toHaveLength(1)
    expect(operatorButtons[0]?.text()).toBe('#1')
    expect(operatorButtons[0]?.attributes('aria-label')).toBe('Edit rule 1')
    expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="ruleset-rule-popover-backdrop"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ruleset-editor-board"]').classes()).toContain('ruleset-editor-board--popup-open')
    const popover = wrapper.get('[data-testid="ruleset-rule-popover"]')
    expect(popover.text()).not.toContain('Update')
    expect(popover.text()).not.toContain('Close')
    const saveRuleButton = wrapper.get('[data-testid="ruleset-rule-apply"]')
    expect(saveRuleButton.attributes('aria-label')).toBe('Save rule')
    expect(saveRuleButton.classes()).toContain('app-icon-action')
    expect(saveRuleButton.classes()).toContain('app-icon-action--primary')
    expect(saveRuleButton.text()).toBe('')
    const deleteRuleButton = wrapper.get('[data-testid="ruleset-rule-delete"]')
    expect(deleteRuleButton.attributes('aria-label')).toBe('Delete rule')
    expect(deleteRuleButton.classes()).toContain('app-icon-action')
    expect(deleteRuleButton.classes()).toContain('app-icon-action--danger')
    expect(deleteRuleButton.get('path').attributes('transform')).toBe('translate(0 0.75)')
    expect(wrapper.text()).not.toContain('#0')
  })

  it('persists the rule when pointer capture sends release back to the starting field', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    const sourceField = wrapper.get('[data-testid="ruleset-field-file1-1"]')
    const targetField = wrapper.get('[data-testid="ruleset-field-file2-1"]')
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => targetField.element),
    })

    try {
      await sourceField.trigger('pointerdown', { pointerId: 1, button: 0, clientX: 12, clientY: 24 })
      expect(sourceField.classes()).toContain('ruleset-field-item--connection-active')
      await vi.advanceTimersByTimeAsync(340)
      await wrapper.get('[data-testid="ruleset-editor-board"]').trigger('pointermove', { pointerId: 1, button: 0, clientX: 420, clientY: 24 })
      expect(targetField.classes()).toContain('ruleset-field-item--connection-active')
      await sourceField.trigger('pointerup', { pointerId: 1, button: 0, clientX: 420, clientY: 24 })
      await flushPromises()
    } finally {
      Object.defineProperty(document, 'elementFromPoint', {
        configurable: true,
        value: originalElementFromPoint,
      })
    }

    const operatorButtons = wrapper.findAll('.ruleset-operator-box')
    expect(operatorButtons).toHaveLength(1)
    expect(operatorButtons[0]?.text()).toBe('#1')
  })

  it('edits operator and resequences visible rules while keeping sequence zero hidden', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState([
          { ruleId: 'basic-diff', file1FieldPath: '$.hidden', file2FieldPath: '$.hidden', operator: '=', sequenceNum: 0 },
          { ruleId: 'rule-1', file1FieldPath: '$.orders[0].order_id', file2FieldPath: '$.data.orders.edges[0].node.id', operator: '=', sequenceNum: 1 },
          { ruleId: 'rule-2', file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '=', sequenceNum: 2 },
          { ruleId: 'rule-3', file1FieldPath: '$.orders[0].total', file2FieldPath: '$.data.orders.edges[0].node.currentTotalPrice', operator: '=', sequenceNum: 3 },
          { ruleId: 'rule-4', file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.currentTotalPrice', operator: '!=', sequenceNum: 4 },
          { ruleId: 'rule-5', file1FieldPath: '$.orders[0].total', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '<', sequenceNum: 5 },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-rule-operator-basic-diff"]').exists()).toBe(false)
    await wrapper.get('[data-testid="ruleset-rule-operator-rule-5"]').trigger('click')
    await chooseAppSelectOption(wrapper, 'ruleset-rule-operator-select', '>')
    await wrapper.get('[data-testid="ruleset-rule-sequence-input"]').setValue(3)
    await wrapper.get('[data-testid="ruleset-rule-apply"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-rule-operator-rule-5"]').text()).toBe('#3')
    expect(wrapper.get('[data-testid="ruleset-rule-sequence-rule-3"]').text()).toBe('#4')
    expect(wrapper.get('[data-testid="ruleset-rule-sequence-rule-4"]').text()).toBe('#5')
    expect(wrapper.text()).not.toContain('#0')
    await wrapper.get('[data-testid="ruleset-rule-operator-rule-5"]').trigger('click')
    expect(wrapper.get('[data-testid="ruleset-rule-operator-select"]').text()).toContain('>')
  })

  it('highlights the rule line and both connected field bubbles on operator hover and while the popover is open', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState([
          { ruleId: 'rule-1', file1FieldPath: '$.orders[0].order_id', file2FieldPath: '$.data.orders.edges[0].node.id', operator: '=', sequenceNum: 1 },
          { ruleId: 'rule-2', file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '=', sequenceNum: 2 },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    const operator = wrapper.get('[data-testid="ruleset-rule-operator-rule-2"]')
    await operator.trigger('pointerenter')

    expect(operator.classes()).toContain('ruleset-operator-box--active')
    expect(operator.attributes('style')).toContain('z-index: 4')
    expect(wrapper.findAll('.ruleset-editor-line--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ruleset-field-file1-1"]').classes()).toContain('ruleset-field-item--rule-active')
    expect(wrapper.get('[data-testid="ruleset-field-file2-1"]').classes()).toContain('ruleset-field-item--rule-active')
    expect(wrapper.get('[data-testid="ruleset-field-file1-0"]').classes()).not.toContain('ruleset-field-item--rule-active')

    await operator.trigger('pointerleave')
    expect(operator.attributes('style')).toContain('z-index: 2')
    expect(wrapper.findAll('.ruleset-editor-line--active')).toHaveLength(0)

    await operator.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(true)
    expect(operator.classes()).toContain('ruleset-operator-box--active')
    expect(operator.attributes('style')).toContain('z-index: 4')
    expect(wrapper.findAll('.ruleset-editor-line--active')).toHaveLength(1)
    expect(wrapper.get('[data-testid="ruleset-field-file1-1"]').classes()).toContain('ruleset-field-item--rule-active')
    expect(wrapper.get('[data-testid="ruleset-field-file2-1"]').classes()).toContain('ruleset-field-item--rule-active')
  })

  it('appends new rules after existing draft rules even when draft ids would otherwise restart', async () => {
    vi.useFakeTimers()
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState([
          { file1FieldPath: '$.orders[0].order_id', file2FieldPath: '$.data.orders.edges[0].node.id', operator: '=', sequenceNum: 1 },
          { file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '=', sequenceNum: 2 },
          { file1FieldPath: '$.orders[0].total', file2FieldPath: '$.data.orders.edges[0].node.currentTotalPrice', operator: '=', sequenceNum: 3 },
          { file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.currentTotalPrice', operator: '=', sequenceNum: 4 },
          { file1FieldPath: '$.orders[0].total', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '=', sequenceNum: 5 },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-field-file1-0"]').trigger('pointerdown', { pointerId: 1, button: 0 })
    await vi.advanceTimersByTimeAsync(340)
    await wrapper.get('[data-testid="ruleset-field-file2-1"]').trigger('pointerup', { pointerId: 1, button: 0 })
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-rule-sequence-input"]').element).toHaveProperty('value', '6')
    expect(wrapper.text()).toContain('#6')
    expect(wrapper.find('[data-testid="ruleset-rule-operator-draft-rule-6"]').exists()).toBe(true)
  })

  it('closes the rule popover on outside click without applying unsaved edits', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState([
          { ruleId: 'rule-1', file1FieldPath: '$.orders[0].order_id', file2FieldPath: '$.data.orders.edges[0].node.id', operator: '=', sequenceNum: 1 },
          { ruleId: 'rule-2', file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '=', sequenceNum: 2 },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-rule-operator-rule-2"]').trigger('click')
    await chooseAppSelectOption(wrapper, 'ruleset-rule-operator-select', '>')
    await wrapper.get('[data-testid="ruleset-rule-sequence-input"]').setValue(1)
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ruleset-rule-operator-rule-2"]').text()).toBe('#2')
    await wrapper.get('[data-testid="ruleset-rule-operator-rule-2"]').trigger('click')
    expect(wrapper.get('[data-testid="ruleset-rule-operator-select"]').text()).toContain('=')
    expect(wrapper.get('[data-testid="ruleset-rule-sequence-input"]').element).toHaveProperty('value', '2')
  })

  it('deletes a visible rule from the popover trash action and resequences the rest', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState([
          { ruleId: 'rule-1', file1FieldPath: '$.orders[0].order_id', file2FieldPath: '$.data.orders.edges[0].node.id', operator: '=', sequenceNum: 1 },
          { ruleId: 'rule-2', file1FieldPath: '$.orders[0].status', file2FieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', operator: '=', sequenceNum: 2 },
          { ruleId: 'rule-3', file1FieldPath: '$.orders[0].total', file2FieldPath: '$.data.orders.edges[0].node.currentTotalPrice', operator: '=', sequenceNum: 3 },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-rule-operator-rule-2"]').trigger('click')
    await wrapper.get('[data-testid="ruleset-rule-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-rule-operator-rule-2"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ruleset-rule-sequence-rule-3"]').text()).toBe('#2')
  })

  it('anchors rule lines to normalized array field aliases instead of the first row fallback', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    draftStoreState.ruleSetDraftState = createDraftState([
          {
            ruleId: 'rule-normalized',
            file1FieldPath: '$.orders[*].total',
            file2FieldPath: '$.data.orders.edges[*].node.displayFinancialStatus',
            operator: '=',
            sequenceNum: 1,
          },
        ])

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    const linePath = wrapper.get('.ruleset-editor-line').attributes('d')
    expect(linePath).toContain('M 320 194')
    expect(linePath).toContain('680 142')
    expect(linePath).not.toContain('M 320 90')
  })

  it('centers the rule popover and lets users add per-field pre-action rows', async () => {
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function getTestRect(this: Element) {
      const element = this as HTMLElement
      if (element.getAttribute('data-testid') === 'ruleset-editor-board') return testRect(0, 0, 1000, 430)
      if (element.dataset.ruleSide === 'file1' && element.dataset.fieldPath === '$.orders[0].total') return testRect(100, 174, 280, 44)
      if (element.dataset.ruleSide === 'file2' && element.dataset.fieldPath === '$.data.orders.edges[0].node.currentTotalPrice') return testRect(620, 122, 280, 44)
      return testRect(0, 0, 0, 0)
    })

    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }


    draftStoreState.ruleSetDraftState = createDraftState([
          {
            ruleId: 'rule-1',
            file1FieldPath: '$.orders[0].total',
            file2FieldPath: '$.data.orders.edges[0].node.currentTotalPrice',
            operator: '>',
            sequenceNum: 1,
          },
        ])


    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-rule-operator-rule-1"]').trigger('click')
    await flushPromises()

    const popover = wrapper.get('[data-testid="ruleset-rule-popover"]')
    expect(popover.attributes('style')).toContain('left: 500px')
    expect(popover.attributes('style')).toContain('top: 215px')
    expect(popover.attributes('style')).toContain('width: 520px')
    expect(popover.text()).toContain('Pre Actions')
    expect(popover.html().indexOf('Pre Actions')).toBeLessThan(popover.html().indexOf('Operator'))
    expect(popover.html().indexOf('Pre Actions')).toBeLessThan(popover.html().indexOf('data-testid="ruleset-rule-add-pre-action"'))
    expect(popover.html().indexOf('data-testid="ruleset-rule-add-pre-action"')).toBeLessThan(popover.html().indexOf('Operator'))
    expect(wrapper.find('[data-testid="ruleset-rule-pre-action-field-0"]').exists()).toBe(false)

    await wrapper.get('[data-testid="ruleset-rule-add-pre-action"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="ruleset-rule-pre-action-field-0"]').text()).toContain('total - OMS')
    expect(wrapper.get('[data-testid="ruleset-rule-pre-action-action-0"]').text()).toContain('String to int')
    expect(wrapper.find('[data-testid="ruleset-rule-delete-pre-action-0"]').exists()).toBe(true)

    await chooseAppSelectOption(wrapper, 'ruleset-rule-pre-action-field-0', 'file2')
    await chooseAppSelectOption(wrapper, 'ruleset-rule-pre-action-action-0', 'STRING_TO_NUMBER')
    expect(wrapper.get('[data-testid="ruleset-rule-pre-action-field-0"]').text()).toContain('currentTotalPrice - SHOPIFY')
    await wrapper.get('[data-testid="ruleset-rule-add-pre-action"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.ruleset-pre-action-row')).toHaveLength(2)
    expect(wrapper.findAll('[data-testid^="ruleset-rule-delete-pre-action-"]')).toHaveLength(2)

    await wrapper.get('[data-testid="ruleset-rule-delete-pre-action-1"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.ruleset-pre-action-row')).toHaveLength(1)
    await wrapper.get('[data-testid="ruleset-rule-add-pre-action"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.ruleset-pre-action-row')).toHaveLength(2)

    await wrapper.get('[data-testid="ruleset-rule-apply"]').trigger('click')
    await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
    await flushPromises()

    expect(saveRuleSetRun).toHaveBeenCalledWith(expect.objectContaining({
      rules: [
        expect.objectContaining({
          expression: JSON.stringify({
            type: 'FIELD_COMPARISON',
            file1FieldPath: '$.orders[*].total',
            file2FieldPath: '$.data.orders.edges[*].node.currentTotalPrice',
            operator: '>',
            preActions: [
              { fieldSide: 'file2', action: 'STRING_TO_NUMBER' },
              { fieldSide: 'file1', action: 'STRING_TO_INT' },
            ],
          }),
        }),
      ],
    }), expect.any(AbortSignal))

    rectSpy.mockRestore()
  })

  it('stores visible rules in history state and returns to the workflow origin on done', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-field-file1-2"]').trigger('pointerdown', { pointerId: 1, button: 0 })
    await vi.advanceTimersByTimeAsync(340)
    await wrapper.get('[data-testid="ruleset-field-file2-2"]').trigger('pointerup', { pointerId: 1, button: 0 })
    await flushPromises()
    await wrapper.get('[data-testid="ruleset-rule-add-pre-action"]').trigger('click')
    await wrapper.get('[data-testid="ruleset-rule-apply"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
    await flushPromises()

    expect(saveRuleSetRun).toHaveBeenCalledWith(expect.objectContaining({
      savedRunId: 'RS_JSON_ORDER_COMPARE',
      rules: [
        expect.objectContaining({
          sequenceNum: 1,
          ruleType: 'FIELD_COMPARISON',
          expression: JSON.stringify({
            type: 'FIELD_COMPARISON',
            file1FieldPath: '$.orders[*].total',
            file2FieldPath: '$.data.orders.edges[*].node.currentTotalPrice',
            operator: '=',
            preActions: [{ fieldSide: 'file1', action: 'STRING_TO_INT' }],
          }),
          ruleLogic: expect.stringContaining('RuleDiffSupport.applyPreActions'),
        }),
      ],
    }), expect.any(AbortSignal))
    expect(routerPush).toHaveBeenCalledWith({ path: '/reconciliation/ruleset-manager' })
  })

  it('routes workflow cancel requests through the same path as the X action', async () => {
    const clickWrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await clickWrapper.get('[data-testid="cancel-ruleset-rules"]').trigger('click')
    await flushPromises()

    const cancelRoute = routerPush.mock.calls.at(-1)?.[0]
    expect(cancelRoute).toEqual({ path: '/reconciliation/ruleset-manager' })

    clickWrapper.unmount()
    routerPush.mockReset()

    const escapeWrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })
    document.dispatchEvent(cancelRequest)
    await flushPromises()

    expect(cancelRequest.defaultPrevented).toBe(true)
    expect(routerPush).toHaveBeenCalledWith(cancelRoute)

    escapeWrapper.unmount()
  })

  it('shows the setup empty state when no draft exists', async () => {
    draftStoreState.ruleSetDraftState = null
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    expect(wrapper.text()).toContain('No run basics defined yet')
    expect(wrapper.text()).toContain('Go to Run Setup')
  })

  describe('field exclusions', () => {
    // FINAL-REVIEW IMPORTANT 3: exclusions only ever reach a getter whose SourceSystemConnector row
    // declares filterParameterName. These specs previously ran against a JSON-schema-file draft, which
    // has no getter at all — they exercised a control the backend could never honour. They now run on
    // an API-backed draft whose FILE_1 side is OMS (declares the parameter) and whose FILE_2 side is
    // Shopify (does not), so both the offered and the withheld case are covered by construction.
    const EXCLUDED_FIELD_PATH = '$.records[*].salesChannelEnumId'
    const EXCLUDE_MARK = '[data-testid="ruleset-field-exclude-file1-6"]'
    const EXCLUDE_PILL = '[data-testid="ruleset-field-file1-6"]'

    beforeEach(() => {
      listAutomationSourceOptions.mockResolvedValue(apiSourceOptionsResponse())
      draftStoreState.ruleSetDraftState = createApiDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
    })

    it('renders the mark as a non-interactive span nested in a non-button pill, only once an exclusion exists', async () => {
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      const pill = wrapper.get(EXCLUDE_PILL)
      expect(pill.element.tagName).toBe('DIV')
      expect(pill.attributes('role')).toBe('button')
      expect(pill.attributes('tabindex')).toBe('0')

      const mark = wrapper.get(EXCLUDE_MARK)
      expect(mark.element.tagName).toBe('SPAN')
      expect(mark.attributes('role')).toBeUndefined()
      expect(mark.attributes('tabindex')).toBeUndefined()
    })

    it('offers the connector wider field list so the field to exclude on is selectable at all', async () => {
      // FINAL-REVIEW CRITICAL 1b. primaryIdOptions is only orderId/orderName/externalId, so the
      // shipping use case (salesChannelEnumId) could not be picked. The board reads fieldOptions when
      // the connector serves one; primary-ID pickers keep reading primaryIdOptions.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      const file1Pills = wrapper.findAll('[data-testid^="ruleset-field-file1-"]')
      expect(file1Pills).toHaveLength(7)
      expect(wrapper.get(EXCLUDE_PILL).text()).toContain('Sales channel')
      expect(wrapper.get(EXCLUDE_PILL).find('.ruleset-field-meta').text()).toBe(EXCLUDED_FIELD_PATH)
    })

    it('falls back to primaryIdOptions for a connector that serves no wider field list', async () => {
      // Shopify serves no fieldOptions, so nothing about its column changes.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.findAll('[data-testid^="ruleset-field-file2-"]')).toHaveLength(2)
    })

    it('withholds the mark entirely on a source whose connector declares no filter parameter', async () => {
      // Shopify's SourceSystemConnector row has no filterParameterName, so runSavedRunDiff never
      // passes it filters. Offering the mark there would validate, persist, and exclude nothing.
      // An exclusion is seeded on BOTH sides here (Shopify's is data that should never be
      // reachable through the UI, but could exist from a stale save) to prove the capability gate
      // withholds the mark even when there is data to show, not merely when there is none.
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
        file2: [{ fieldExpression: '$.records[*].id', values: ['SOME_VALUE'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.findAll('[data-testid^="ruleset-field-file1-"]').length).toBeGreaterThan(0)
      expect(wrapper.findAll('[data-testid^="ruleset-field-exclude-file1-"]').length).toBeGreaterThan(0)
      expect(wrapper.findAll('[data-testid^="ruleset-field-file2-"]').length).toBeGreaterThan(0)
      expect(wrapper.findAll('[data-testid^="ruleset-field-exclude-file2-"]')).toHaveLength(0)
    })

    it('withholds the mark on a file-backed source, which has no getter to filter in', async () => {
      // Same capability-gate proof as above, on a source type with no connector option at all:
      // an exclusion is seeded so the withholding can only be explained by the missing getter,
      // not by an empty draft.
      draftStoreState.ruleSetDraftState = createDraftState([], {
        file1: [{ fieldExpression: '$.orders[0].status', values: ['CANCELLED'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.findAll('[data-testid^="ruleset-field-file1-"]').length).toBeGreaterThan(0)
      expect(wrapper.findAll('[data-testid^="ruleset-field-exclude-file1-"]')).toHaveLength(0)
      expect(wrapper.findAll('[data-testid^="ruleset-field-exclude-file2-"]')).toHaveLength(0)
    })

    it('shows no indicator at all on a field with no exclusion', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(false)
    })

    it('marks a field that has an exclusion', async () => {
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(true)
    })

    it('extends the pill accessible name with a screen-reader-only "Has exclusion" signal', async () => {
      // Before the double-click rework, the mark was a real <button> whose own accessible name
      // ("Edit exclusion on X" vs "Add exclusion on X") let a screen-reader user tell which
      // fields already carried an exclusion. The mark is now aria-hidden and the pill absorbed
      // its gesture, so that signal has to live on the pill itself instead.
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      const status = wrapper.get('[data-testid="ruleset-field-exclude-status-file1-6"]')
      expect(status.classes()).toContain('sr-only')
      expect(status.text()).toBe('Has exclusion')
      expect(wrapper.get(EXCLUDE_PILL).text()).toContain('Has exclusion')
    })

    it('adds no accessible-name signal on a field with no exclusion', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.find('[data-testid="ruleset-field-exclude-status-file1-6"]').exists()).toBe(false)
    })

    it('withholds the accessible-name signal on a side that does not support exclusions, even with stale data', async () => {
      // Same capability gate as the mark itself (see the withholds-the-mark spec above): the
      // signal must not leak through for Shopify (file2), which has no filterParameterName.
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
        file2: [{ fieldExpression: '$.records[*].id', values: ['SOME_VALUE'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.findAll('[data-testid^="ruleset-field-exclude-status-file2-"]')).toHaveLength(0)
    })

    it('matches a stored expression to its pill by alias, not by string identity', async () => {
      // FINAL-REVIEW MINOR 6: every other field lookup on this board is alias-aware. A stored
      // expression differing only by the `$.` root prefix still belongs to the same pill.
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: 'records[*].salesChannelEnumId', values: ['POS_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(true)
    })

    it('opens the exclusion popover from a double-click on the pill and blurs the board behind it', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')

      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="ruleset-editor-board"]').classes()).toContain('ruleset-editor-board--popup-open')
    })

    it('does nothing on a double-click for a pill whose side does not support exclusions', async () => {
      // Same capability gate as the mark itself: Shopify (file2) declares no filterParameterName,
      // so double-click there must be a no-op rather than opening a popover the backend could
      // never honour.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get('[data-testid="ruleset-field-file2-0"]').trigger('dblclick')
      await flushPromises()

      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(false)
    })

    it('a full double-click gesture on the pill creates no rule and leaves no connection-active state', async () => {
      // A browser double-click is really two independent pointerdown/pointerup pairs (each well
      // under LONG_PRESS_MS) followed by a dblclick event. This drives that exact sequence on the
      // SAME pill and proves it can never arm or complete a connection: handleFieldPointerUp
      // calls cancelPendingConnection() on every release, and neither click individually reaches
      // the 320ms long-press threshold that would set pending.drawing. The gesture DOES do
      // something on a side that supports exclusions (opens the editor) — asserted here too, so
      // the "no connection" assertions can't pass by accident because nothing happened at all.
      vi.useFakeTimers()
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      const pill = wrapper.get(EXCLUDE_PILL)
      await pill.trigger('pointerdown', { pointerId: 1, button: 0 })
      await pill.trigger('pointerup', { pointerId: 1, button: 0 })
      await pill.trigger('pointerdown', { pointerId: 1, button: 0 })
      await pill.trigger('pointerup', { pointerId: 1, button: 0 })
      await pill.trigger('dblclick')
      await flushPromises()

      expect(wrapper.findAll('.ruleset-operator-box')).toHaveLength(0)
      expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(false)
      expect(pill.classes()).not.toContain('ruleset-field-item--connection-active')
      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(true)
    })

    it('opening a rule popover closes an already-open exclusion popover, and vice versa', async () => {
      draftStoreState.ruleSetDraftState = createApiDraftState(
        [
          {
            ruleId: 'rule-1',
            file1FieldPath: '$.records[*].externalId',
            file2FieldPath: '$.records[*].id',
            operator: '=',
            sequenceNum: 1,
          },
        ],
        { file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }] },
      )
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      // Open the rule popover first — pointerdown on an operator box is not stopped, so this
      // direction already worked before this fix round.
      await wrapper.get('[data-testid="ruleset-rule-operator-rule-1"]').trigger('click')
      expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(true)

      // openExclusionEditor explicitly calls closeRuleEditor() before opening (see the matching
      // comment on the component) rather than relying solely on the window outside-click
      // listener — without that explicit guard, both popovers could end up open and rendered on
      // top of each other, since they share the same blur-exemption class.
      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      await flushPromises()

      expect(wrapper.findAll('[data-testid="ruleset-rule-popover"]')).toHaveLength(0)
      expect(wrapper.findAll('[data-testid="ruleset-exclusion-popover"]')).toHaveLength(1)

      await wrapper.get('[data-testid="ruleset-rule-operator-rule-1"]').trigger('click')
      await flushPromises()

      expect(wrapper.findAll('[data-testid="ruleset-exclusion-popover"]')).toHaveLength(0)
      expect(wrapper.findAll('[data-testid="ruleset-rule-popover"]')).toHaveLength(1)
    })

    it('adds typed values as chips and writes them to the draft on save', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      const input = wrapper.get('[data-testid="ruleset-exclusion-value-input"]')
      await input.setValue('POS_SALES_CHANNEL')
      await input.trigger('keydown', { key: 'Enter' })
      await input.setValue('DRAFT_SALES_CHANNEL')
      await input.trigger('keydown', { key: 'Enter' })
      await wrapper.get('[data-testid="ruleset-exclusion-apply"]').trigger('click')
      await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
      await flushPromises()

      expect(saveRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({
          file1ExcludeFilters: [
            {
              fieldExpression: EXCLUDED_FIELD_PATH,
              operator: 'EXCLUDE_IN',
              values: ['POS_SALES_CHANNEL', 'DRAFT_SALES_CHANNEL'],
            },
          ],
        }),
        expect.any(AbortSignal),
      )
    })

    // DAR-UI-013. supportsExclusions fails closed on any side whose connector declares no
    // filterParameterName -- Shopify here -- and used to do it by returning silently, so the
    // gesture produced nothing at all and the operator had no way to learn why.
    const UNAVAILABLE_NOTE = '[data-testid="ruleset-exclusion-unavailable"]'
    const SHOPIFY_PILL = '[data-testid="ruleset-field-file2-0"]'

    it('explains, rather than doing nothing, when a side cannot carry exclusions', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(SHOPIFY_PILL).trigger('dblclick')
      await flushPromises()

      const note = wrapper.get(UNAVAILABLE_NOTE)
      expect(note.text()).toContain('SHOPIFY')
      expect(note.text()).toContain('cannot filter records at the source')
      // It must not silently open an editor it cannot honour.
      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(false)
    })

    it('explains on the keyboard path too', async () => {
      // Enter on a focused pill is the only exclusion gesture available without a mouse, so a
      // silent return left keyboard operators with literally no feedback.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(SHOPIFY_PILL).trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(wrapper.find(UNAVAILABLE_NOTE).exists()).toBe(true)
    })

    it('announces the explanation to assistive tech', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(SHOPIFY_PILL).trigger('dblclick')
      await flushPromises()

      const note = wrapper.get(UNAVAILABLE_NOTE)
      expect(note.attributes('role')).toBe('status')
      expect(note.attributes('aria-live')).toBe('polite')
    })

    it('dismisses the explanation on the next outside click', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(SHOPIFY_PILL).trigger('dblclick')
      await flushPromises()
      expect(wrapper.find(UNAVAILABLE_NOTE).exists()).toBe(true)

      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      await flushPromises()

      expect(wrapper.find(UNAVAILABLE_NOTE).exists()).toBe(false)
    })

    it('leaves a supported side opening its editor with no explanation', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      await flushPromises()

      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(true)
      expect(wrapper.find(UNAVAILABLE_NOTE).exists()).toBe(false)
    })

    it('commits a typed value that was never Enter-ed when the operator clicks Save exclusion', async () => {
      // sm-darpan 2026-08-06 (DAR-CLIENT-003): the operator typed a value and clicked "Save
      // exclusion" without pressing Enter first. The input only committed on Enter, and
      // applyExclusionEdit never flushed pendingExclusionValue -- so editingExclusionValues was
      // empty, which is the DELETE branch. The typed value was discarded, no ⊘ mark appeared, and
      // no request was ever made. Every test above presses Enter first, which is why the suite
      // stayed green while the feature was unusable. Typing then clicking Save must persist.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      await wrapper.get('[data-testid="ruleset-exclusion-value-input"]').setValue('POS_SALES_CHANNEL')
      await wrapper.get('[data-testid="ruleset-exclusion-apply"]').trigger('click')
      await flushPromises()

      // The mark is the operator's only feedback that the exclusion registered at all.
      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(true)

      await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
      await flushPromises()

      expect(saveRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({
          file1ExcludeFilters: [
            { fieldExpression: EXCLUDED_FIELD_PATH, operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
          ],
        }),
        expect.any(AbortSignal),
      )
    })

    it('still deletes the exclusion when Delete is clicked with text left in the input', async () => {
      // The flush added above must not resurrect a rule the operator is deleting: Delete clears the
      // committed chips and reuses applyExclusionEdit, so leftover pending text would otherwise
      // come straight back as a fresh rule.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      const input = wrapper.get('[data-testid="ruleset-exclusion-value-input"]')
      await input.setValue('POS_SALES_CHANNEL')
      await input.trigger('keydown', { key: 'Enter' })
      await input.setValue('TYPED_BUT_ABANDONED')
      await wrapper.get('[data-testid="ruleset-exclusion-delete"]').trigger('click')
      await flushPromises()

      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(false)

      await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
      await flushPromises()

      expect(saveRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({ file1ExcludeFilters: [] }),
        expect.any(AbortSignal),
      )
    })

    it('preserves a run other exclusions when one of them is reopened and edited', async () => {
      // FINAL-REVIEW CRITICAL 2. The draft here is built the way a real reopened run builds it —
      // through buildRuleSetDraft, from the wire shape list#SavedRuns returns. Before the hydration
      // fix, buildRuleSetDraft dropped both exclusion keys, so applyExclusionEdit computed `others`
      // from an empty list and saving ONE edited exclusion silently deleted every other exclusion on
      // that side. Editing statusId must leave salesChannelEnumId exactly as it was.
      const savedRun = savedRunWithTwoExclusions()
      const draft = buildRuleSetDraft(savedRun)
      expect(draft).not.toBeNull()
      draftStoreState.ruleSetDraftState = buildReconciliationRuleSetDraftState(draft!, 'ruleset-manager')
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      // Both marks come back — the load direction works at all.
      expect(wrapper.find('[data-testid="ruleset-field-exclude-file1-5"]').exists()).toBe(true)
      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(true)

      // Edit the statusId exclusion only.
      await wrapper.get('[data-testid="ruleset-field-file1-5"]').trigger('dblclick')
      const input = wrapper.get('[data-testid="ruleset-exclusion-value-input"]')
      await input.setValue('ORDER_REJECTED')
      await input.trigger('keydown', { key: 'Enter' })
      await wrapper.get('[data-testid="ruleset-exclusion-apply"]').trigger('click')
      await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
      await flushPromises()

      const payload = saveRuleSetRun.mock.calls.at(-1)?.[0] as { file1ExcludeFilters?: SourceExcludeFilter[] }
      expect(payload.file1ExcludeFilters).toEqual([
        { fieldExpression: EXCLUDED_FIELD_PATH, operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
        {
          fieldExpression: '$.records[*].statusId',
          operator: 'EXCLUDE_IN',
          values: ['ORDER_CANCELLED', 'ORDER_REJECTED'],
        },
      ])
    })

    it('removes the exclusion when the last chip is deleted and saved, sending an empty array rather than leaving it unset', async () => {
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      await wrapper.get('[data-testid="ruleset-exclusion-delete"]').trigger('click')
      await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
      await flushPromises()

      expect(saveRuleSetRun).toHaveBeenCalledWith(
        expect.objectContaining({ file1ExcludeFilters: [] }),
        expect.any(AbortSignal),
      )
    })

    it('renders no number for an exclusion mark, unlike an ordered comparison rule', async () => {
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL', 'DRAFT_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      expect(wrapper.get(EXCLUDE_MARK).text()).not.toMatch(/\d/)
    })

    it('draws no connection line and creates no operator box for an exclusion', async () => {
      draftStoreState.ruleSetDraftState = createApiDraftState([], {
        file1: [{ fieldExpression: EXCLUDED_FIELD_PATH, values: ['POS_SALES_CHANNEL'] }],
      })
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      // An exclusion is not a rule, so it draws no rule line. The empty-state ghost is the one line
      // on this board, and it is here precisely BECAUSE no rule exists — excluding it from the count
      // keeps this assertion about exclusions rather than about the empty state.
      expect(wrapper.findAll('.ruleset-editor-line:not(.ruleset-editor-line--ghost)')).toHaveLength(0)
      expect(wrapper.find('[data-testid="ruleset-ghost-rule"]').exists()).toBe(true)
      expect(wrapper.findAll('.ruleset-operator-box')).toHaveLength(0)
    })

    it('opens the exclusion editor on Enter without submitting the form; Space does neither', async () => {
      // Enter is the keyboard equivalent of the double-click gesture, now that the mark that used
      // to be the only keyboard path (a nested <button>) is gone. Space stays a no-op, same as
      // before — it is not the assigned gesture on either input device.
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      const pill = wrapper.get(EXCLUDE_PILL)
      await pill.trigger('keydown', { key: ' ' })
      await flushPromises()

      expect(saveRuleSetRun).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(false)

      await pill.trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(saveRuleSetRun).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(true)
    })

    it('does nothing on Enter for a pill whose side does not support exclusions, and does not submit the form', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      const pill = wrapper.get('[data-testid="ruleset-field-file2-0"]')
      await pill.trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(saveRuleSetRun).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(false)
    })

    it('closes the exclusion popover on outside click without applying unsaved edits', async () => {
      const wrapper = mount(ReconciliationRuleSetEditorPage)
      await flushPromises()

      await wrapper.get(EXCLUDE_PILL).trigger('dblclick')
      const input = wrapper.get('[data-testid="ruleset-exclusion-value-input"]')
      await input.setValue('POS_SALES_CHANNEL')
      await input.trigger('keydown', { key: 'Enter' })
      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      await flushPromises()

      expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(false)
      expect(wrapper.find(EXCLUDE_MARK).exists()).toBe(false)

      await wrapper.get('[data-testid="save-ruleset-rules"]').trigger('click')
      await flushPromises()

      expect(saveRuleSetRun).toHaveBeenCalledWith(
        expect.not.objectContaining({ file1ExcludeFilters: expect.anything() }),
        expect.any(AbortSignal),
      )
    })
  })
})
