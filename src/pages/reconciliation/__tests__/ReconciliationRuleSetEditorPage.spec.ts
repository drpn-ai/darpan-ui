import { readFileSync } from 'node:fs'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  buildReconciliationRuleSetDraftState,
  type ReconciliationRuleSetDraftRule,
} from '../../../lib/reconciliationRuleSetDraft'
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

function createDraftState(rules: ReconciliationRuleSetDraftRule[] = []) {
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
    },
    'ruleset-manager',
  )
}

function createApiDraftState(rules: ReconciliationRuleSetDraftRule[] = []) {
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

  it('uses a single theme-independent pen cursor with a black outline and white fill', () => {
    const source = readFileSync('src/pages/reconciliation/ReconciliationRuleSetEditorPage.vue', 'utf8')

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
})
