import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  buildReconciliationRuleSetDraftState,
  type ReconciliationRuleSetDraftRule,
} from '../../../lib/reconciliationRuleSetDraft'

const getJsonSchema = vi.hoisted(() => vi.fn())
const deleteSavedRun = vi.hoisted(() => vi.fn())
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const getShopifyAuthConfig = vi.hoisted(() => vi.fn())
const listSourceConfigEndpoints = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    activeTenantUserGroupId: 'tenant-a',
  },
}))
const permissionState = vi.hoisted(() => ({
  canRunActiveTenantReconciliation: true,
  canEditTenantSettings: true,
  canManageGlobalSettings: false,
  canViewTenantSettings: true,
}))
const route = vi.hoisted(() => ({
  fullPath: '/reconciliation/ruleset-manager',
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRouter: () => ({
    push: routerPush,
  }),
  useRoute: () => route,
}))

vi.mock('../../../lib/api/facade', () => ({
  jsonSchemaFacade: {
    get: getJsonSchema,
  },
  reconciliationFacade: {
    deleteSavedRun,
    listAutomationSourceOptions,
  },
  settingsFacade: {
    listOmsRestSourceConfigs,
    getShopifyAuthConfig,
    listSourceConfigEndpoints,
  },
}))

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionState,
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

import { ApiCallError } from '../../../lib/api/client'
import ReconciliationRuleSetManagerPage from '../ReconciliationRuleSetManagerPage.vue'

function createDraftState() {
  return buildReconciliationRuleSetDraftState(
    {
      savedRunId: 'RS_JSON_ORDER_COMPARE',
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

function createSavedRunReopenDraftState(rules: ReconciliationRuleSetDraftRule[] = []) {
  return buildReconciliationRuleSetDraftState(
    {
      savedRunId: 'RS_ORDER_SYNC',
      runName: 'Order Sync',
      file1SystemEnumId: 'SHOPIFY',
      file1SystemLabel: 'SHOPIFY',
      file1FileTypeEnumId: 'DftJson',
      file1SchemaFileName: 'orders-reconciliation-prod-2026-03-01-to-2026-03-31-2026-04-09-04-55-22',
      file1PrimaryIdExpression: ['$.orders[*].legacyResourceId'],
      file2SystemEnumId: 'OMS',
      file2SystemLabel: 'OMS',
      file2FileTypeEnumId: 'DftJson',
      file2SchemaFileName: 'Krewe OMS Orders (1)',
      file2PrimaryIdExpression: ['$[*].shopify_order_id'],
      rules,
    },
    'ruleset-manager',
  )
}

function createApiDraftState() {
  return buildReconciliationRuleSetDraftState(
    {
      savedRunId: 'RS_API_ORDER_SYNC',
      runName: 'API Order Sync',
      file1SystemEnumId: 'OMS',
      file1SystemLabel: 'HotWax',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
      file1SystemMessageRemoteLabel: 'Orders API',
      file1SourceConfigId: 'dev_oms',
      file1SourceConfigType: 'HOTWAX_OMS_REST',
      file1FileTypeEnumId: 'DftJson',
      file1JsonSchemaId: 'schema-oms-orders',
      file1SchemaLabel: 'HotWax orders',
      file1PrimaryIdExpression: ['$.externalId'],
      file2SystemEnumId: 'SHOPIFY',
      file2SystemLabel: 'SHOPIFY',
      file2SourceTypeEnumId: 'AUT_SRC_API',
      file2SystemMessageRemoteId: 'SHOPIFY_ORDERS_API',
      file2SystemMessageRemoteLabel: 'Shopify Orders Endpoint',
      file2SourceConfigId: 'dev_shopify',
      file2SourceConfigType: 'SHOPIFY_AUTH',
      file2FileTypeEnumId: 'DftJson',
      file2JsonSchemaId: 'schema-shopify-orders',
      file2SchemaLabel: 'Shopify orders',
      file2PrimaryIdExpression: ['$.id'],
      rules: [
        {
          file1FieldPath: '$.externalId',
          file2FieldPath: '$.id',
          operator: '=',
          sequenceNum: 1,
        },
      ],
    },
    'ruleset-manager',
  )
}

describe('ReconciliationRuleSetManagerPage', () => {
  beforeEach(() => {
    getJsonSchema.mockReset()
    deleteSavedRun.mockReset()
    listAutomationSourceOptions.mockReset()
    listAutomationSourceOptions.mockResolvedValue({ ok: true, messages: [], errors: [], sourceConfigs: [] })
    listOmsRestSourceConfigs.mockReset()
    getShopifyAuthConfig.mockReset()
    listSourceConfigEndpoints.mockReset()
    // Safety-net default: only the auth-info popup test below opens a popup and needs real
    // endpoint rows; every other test that happens to mount the page never calls this.
    listSourceConfigEndpoints.mockResolvedValue({ ok: true, messages: [], errors: [], endpoints: [] })
    routerPush.mockReset()
    permissionState.canRunActiveTenantReconciliation = true
    permissionState.canEditTenantSettings = true
    permissionState.canManageGlobalSettings = false
    permissionState.canViewTenantSettings = true
    authState.sessionInfo.activeTenantUserGroupId = 'tenant-a'
    draftStoreState.workflowOrigin = null
    draftStoreState.ruleSetDraftState = null
    draftStoreState.automationDraftState = null
    draftStoreState.setWorkflowOrigin.mockClear()
    draftStoreState.setRuleSetDraft.mockClear()
    draftStoreState.setAutomationDraft.mockClear()
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    getJsonSchema.mockImplementation(async ({ jsonSchemaId, schemaName }: { jsonSchemaId?: string, schemaName?: string }) => {
      if (jsonSchemaId === 'schema-oms-orders') {
        return {
          ok: true,
          messages: [],
          errors: [],
          schemaData: {
            jsonSchemaId,
            schemaName: 'test-oms-orders.schema.json',
            description: 'OMS orders',
            systemEnumId: 'OMS',
            systemLabel: 'OMS',
            schemaText: '{}',
          },
        }
      }

      if (schemaName === 'orders-reconciliation-prod-2026-03-01-to-2026-03-31-2026-04-09-04-55-22') {
        return {
          ok: true,
          messages: [],
          errors: [],
          schemaData: {
            jsonSchemaId: 'schema-shopify-orders',
            schemaName,
            description: 'Shopify Orders',
            systemEnumId: 'SHOPIFY',
            systemLabel: 'SHOPIFY',
            schemaText: '{}',
          },
        }
      }

      if (schemaName === 'Krewe OMS Orders (1)') {
        return {
          ok: true,
          messages: [],
          errors: [],
          schemaData: {
            jsonSchemaId: 'schema-krewe-oms-orders',
            schemaName,
            description: 'Krewe OMS Orders',
            systemEnumId: 'OMS',
            systemLabel: 'OMS',
            schemaText: '{}',
          },
        }
      }

      return {
        ok: true,
        messages: [],
        errors: [],
        schemaData: {
          jsonSchemaId,
          schemaName: 'test-shopify-orders.schema.json',
          description: 'Shopify orders',
          systemEnumId: 'SHOPIFY',
          systemLabel: 'SHOPIFY',
          schemaText: '{}',
        },
      }
    })

    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: {
        pageIndex: 0,
        pageSize: 200,
        totalCount: 1,
        pageCount: 1,
      },
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'dev_oms',
          description: 'Test OMS',
          companyUserGroupId: 'tenant-a',
          baseUrl: 'https://test-maarg.hotwax.io',
          ordersPath: '/rest/s1/oms/orders',
          timeZone: 'America/New_York',
          authType: 'basic',
          hasUsername: true,
          hasPassword: true,
          hasApiToken: false,
          customHeaderNames: ['X-API-Key'],
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 120,
          isActive: 'Y',
          canReadOrders: true,
        },
      ],
    })
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'tenant-a',
        shopApiUrl: 'https://test.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/New_York',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

  })

  it('renders the draft-backed run summary and static equation', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).toContain('JSON Order Compare')
    expect(wrapper.get('.ruleset-manager-hero h1').text()).toBe('JSON Order Compare')
    expect(wrapper.text()).not.toContain('RuleSet Manager')
    expect(wrapper.text()).toContain('Rules')
    expect(wrapper.text()).not.toContain('Rule Builder')
    expect(wrapper.text()).toContain('Run')
    const sectionHeaders = wrapper.findAll('.ruleset-manager-section-header')
    expect(sectionHeaders).toHaveLength(2)
    expect(sectionHeaders[0]?.find('.static-page-section-heading').text()).toBe('Run')
    expect(sectionHeaders[0]?.find('[data-testid="ruleset-manager-edit-run"]').exists()).toBe(true)
    expect(sectionHeaders[0]?.find('[data-testid="ruleset-manager-edit-run"] svg').exists()).toBe(true)
    expect(sectionHeaders[0]?.find('[data-testid="ruleset-manager-edit-run"]').classes()).not.toContain('app-icon-action--large')
    expect(sectionHeaders[0]?.find('[data-testid="ruleset-manager-edit-run"]').classes()).toContain('ruleset-manager-section-edit')
    expect(sectionHeaders[0]?.findAll('[data-testid="ruleset-manager-edit-run"] .ruleset-manager-edit-icon-path')).toHaveLength(1)
    expect(sectionHeaders[0]?.find('[data-testid="ruleset-manager-edit-run"] .ruleset-manager-edit-icon-path').attributes('fill')).toBeUndefined()
    expect(sectionHeaders[1]?.find('.static-page-section-heading').text()).toBe('Rules')
    expect(sectionHeaders[1]?.find('[data-testid="ruleset-manager-edit-rules"]').exists()).toBe(true)
    expect(sectionHeaders[1]?.find('[data-testid="ruleset-manager-edit-rules"] svg').exists()).toBe(true)
    expect(sectionHeaders[1]?.find('[data-testid="ruleset-manager-edit-rules"]').classes()).not.toContain('app-icon-action--large')
    expect(sectionHeaders[1]?.find('[data-testid="ruleset-manager-edit-rules"]').classes()).toContain('ruleset-manager-section-edit')
    expect(sectionHeaders[1]?.findAll('[data-testid="ruleset-manager-edit-rules"] .ruleset-manager-edit-icon-path')).toHaveLength(1)
    expect(sectionHeaders[1]?.find('[data-testid="ruleset-manager-edit-rules"] .ruleset-manager-edit-icon-path').attributes('fill')).toBeUndefined()
    expect(wrapper.get('[data-testid="ruleset-manager-edit-run"]').attributes('aria-label')).toBe('Edit Run')
    expect(wrapper.get('[data-testid="ruleset-manager-edit-rules"]').attributes('aria-label')).toBe('Edit Rules')
    expect(wrapper.text()).toContain('OMS')
    expect(wrapper.text()).toContain('SHOPIFY')
    expect(wrapper.text()).toContain('OMS orders')
    expect(wrapper.text()).toContain('Shopify orders')
    expect(wrapper.text()).not.toContain('OMS orders - OMS - Primary ID')
    expect(wrapper.text()).not.toContain('Shopify orders - SHOPIFY - Primary ID')
    const schemaRows = wrapper.findAll('.ruleset-manager-schema-row')
    expect(schemaRows).toHaveLength(2)
    expect(schemaRows[0]?.text()).toContain('System')
    expect(schemaRows[0]?.text()).toContain('Schema')
    expect(schemaRows[0]?.text()).toContain('Primary ID')
    expect(schemaRows[0]?.text()).toContain('OMS')
    expect(schemaRows[0]?.text()).toContain('OMS orders')
    expect(schemaRows[0]?.text()).toContain('order_id')
    expect(schemaRows[0]?.text()).not.toContain('$.orders[0].order_id')
    expect(schemaRows[0]?.text()).not.toContain('SHOPIFY')
    expect(schemaRows[0]?.text()).not.toContain('Shopify orders')
    expect(schemaRows[1]?.text()).toContain('System')
    expect(schemaRows[1]?.text()).toContain('Schema')
    expect(schemaRows[1]?.text()).toContain('Primary ID')
    expect(schemaRows[1]?.text()).toContain('SHOPIFY')
    expect(schemaRows[1]?.text()).toContain('Shopify orders')
    expect(schemaRows[1]?.text()).toContain('id')
    expect(schemaRows[1]?.text()).not.toContain('$.data.orders.edges[0].node.id')
    expect(schemaRows[1]?.text()).not.toContain('OMS orders')
    const basicCards = wrapper.findAll('.ruleset-manager-basic-card')
    expect(basicCards).toHaveLength(6)
    expect(wrapper.find('[data-testid="ruleset-manager-system-config-file1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-system-config-file2"]').exists()).toBe(false)
    expect(basicCards[0]?.text()).toContain('System')
    expect(basicCards[0]?.text()).toContain('OMS')
    expect(basicCards[1]?.text()).toContain('Schema')
    expect(basicCards[1]?.text()).not.toContain('Schema 1')
    expect(basicCards[1]?.text()).not.toContain('File 1')
    expect(basicCards[1]?.text()).toContain('OMS orders')
    expect(basicCards[2]?.text()).toContain('Primary ID')
    expect(basicCards[2]?.text()).not.toContain('Schema 2')
    expect(basicCards[2]?.text()).not.toContain('File 2')
    expect(basicCards[2]?.text()).toContain('order_id')
    expect(basicCards[2]?.text()).not.toContain('$.orders[0].order_id')
    expect(basicCards[3]?.text()).toContain('System')
    expect(basicCards[3]?.text()).toContain('SHOPIFY')
    expect(basicCards[4]?.text()).toContain('Schema')
    expect(basicCards[4]?.text()).toContain('Shopify orders')
    expect(basicCards[5]?.text()).toContain('Primary ID')
    expect(basicCards[5]?.text()).toContain('id')
    expect(basicCards[5]?.text()).not.toContain('$.data.orders.edges[0].node.id')
    expect(wrapper.findAll('.ruleset-manager-schema-row').every((row) => !row.text().includes('Exclusions'))).toBe(true)
    expect(wrapper.get('[data-testid="ruleset-exclusions-file1"]').text()).toContain('—')
    expect(wrapper.get('[data-testid="ruleset-exclusions-file2"]').text()).toContain('—')
    expect(wrapper.text()).not.toContain('Run Basics')
    expect(wrapper.find('.ruleset-manager-basics-grid').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('test-oms-orders.schema.json')
    expect(wrapper.text()).not.toContain('test-shopify-orders.schema.json')
    expect(wrapper.find('.ruleset-manager-field-grid').exists()).toBe(false)
    expect(wrapper.find('.ruleset-manager-source').exists()).toBe(false)
    expect(wrapper.find('.ruleset-manager-comparison-side').exists()).toBe(false)
    expect(wrapper.find('.ruleset-manager-operator').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-operator-equals"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).toContain('order_id = id')
    expect(wrapper.get('[data-testid="ruleset-manager-rule-list"]').text()).toContain('#0')
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).not.toContain('$.orders[0].order_id')
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).not.toContain('$.data.orders.edges[0].node.id')
    expect(wrapper.find('[data-testid="ruleset-manager-normalizer-note"]').exists()).toBe(false)
    const runButton = wrapper.get('[data-testid="ruleset-manager-run-ruleset"]')
    expect(runButton.attributes('aria-label')).toBe('Run ruleset')
    expect(runButton.classes()).toContain('app-icon-action')
    expect(runButton.classes()).toContain('app-icon-action--large')
    expect(runButton.classes()).not.toContain('app-icon-action--danger')
    expect(runButton.element.closest('.ruleset-manager-footer-row')).not.toBeNull()
    expect(runButton.element.closest('.static-page-actions')).not.toBeNull()
    expect(runButton.element.closest('.static-page-board')).toBeNull()
    expect(runButton.get('path').attributes('fill')).toBe('currentColor')
    expect(runButton.get('path').attributes('transform')).toBe('translate(0 1.5)')
    const deleteButton = wrapper.get('[data-testid="ruleset-manager-delete-run"]')
    expect(deleteButton.attributes('aria-label')).toBe('Delete run')
    expect(deleteButton.classes()).toContain('app-icon-action')
    expect(deleteButton.classes()).toContain('app-icon-action--large')
    expect(deleteButton.classes()).toContain('app-icon-action--danger')
    expect(deleteButton.element.closest('.ruleset-manager-footer-row')).not.toBeNull()
    expect(deleteButton.element.closest('.static-page-actions')).not.toBeNull()
    expect(deleteButton.element.closest('.static-page-board')).toBeNull()
    expect(deleteButton.get('path').attributes('transform')).toBe('translate(0 0.75)')
    expect(wrapper.findAll('.ruleset-manager-footer-row button').map((button) => button.attributes('data-testid'))).toEqual([
      'ruleset-manager-run-ruleset',
      'ruleset-manager-delete-run',
    ])
  })

  it('shows every composite key field in the Primary ID summary', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = buildReconciliationRuleSetDraftState(
      {
        savedRunId: 'RS_COMPOSITE_SUMMARY',
        runName: 'Composite Summary',
        file1SystemEnumId: 'SHOPIFY',
        file1SystemLabel: 'SHOPIFY',
        file1FileTypeEnumId: 'DftJson',
        file1SchemaFileName: 'shopify-returns',
        file1PrimaryIdExpression: ['$.returns[*].return_id', '$.returns[*].product_id'],
        file2SystemEnumId: 'OMS',
        file2SystemLabel: 'OMS',
        file2FileTypeEnumId: 'DftJson',
        file2SchemaFileName: 'oms-returns',
        file2PrimaryIdExpression: ['$.returns[*].return_id', '$.returns[*].product_id'],
      },
      'ruleset-manager',
    )
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const schemaRows = wrapper.findAll('.ruleset-manager-schema-row')
    expect(schemaRows).toHaveLength(2)
    expect(schemaRows[0]?.text()).toContain('return_id + product_id')
    expect(schemaRows[1]?.text()).toContain('return_id + product_id')
  })

  // Originally this asserted the system name was NOT shown, on the reasoning that the config id
// (dev_oms / dev_shopify) identifies an API source more precisely. That holds only while the two
// sides use differently-named configs: a Shopify/HotWax run whose configs are both named
// `gorjana_prod` rendered the same value on both rows and never named either system. Both are now
// shown — the system name, with its config id beneath it.
  it('labels API-backed sources by system name and config in the run summary', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createApiDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')
    // Registry-driven endpoint rows for the auth-info popup -- keyed by config type + config id
    // like the real service, since the popup opens both OMS and Shopify sides in one test.
    listSourceConfigEndpoints.mockImplementation(
      async ({ configTypeEnumId, configId }: { configTypeEnumId: string, configId: string }) => {
        if (configTypeEnumId === 'SCFG_HOTWAX_OMS' && configId === 'dev_oms') {
          return {
            ok: true,
            messages: [],
            errors: [],
            endpoints: [{ systemEnumId: 'OMS_ORDERS', endpointLabel: 'Orders API', isEnabled: true }],
          }
        }
        if (configTypeEnumId === 'SCFG_SHOPIFY_AUTH' && configId === 'dev_shopify') {
          return {
            ok: true,
            messages: [],
            errors: [],
            endpoints: [{ systemEnumId: 'SHOPIFY_ORDERS', endpointLabel: 'Admin GraphQL Orders', isEnabled: true }],
          }
        }
        return { ok: true, messages: [], errors: [], endpoints: [] }
      },
    )

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).toContain('API Order Sync')
    const schemaRows = wrapper.findAll('.ruleset-manager-schema-row')
    expect(schemaRows).toHaveLength(2)
    expect(schemaRows[0]?.text()).toContain('dev_oms')
    expect(schemaRows[0]?.text()).toContain('HotWax')
    expect(schemaRows[1]?.text()).toContain('Shopify')
    expect(schemaRows[0]?.text()).toContain('Schema')
    expect(schemaRows[0]?.text()).toContain('Orders API')
    expect(schemaRows[0]?.text()).not.toContain('CSV source')
    expect(schemaRows[0]?.text()).not.toContain('HotWax orders')
    expect(schemaRows[1]?.text()).toContain('dev_shopify')
    expect(schemaRows[1]?.text()).toContain('Schema')
    expect(schemaRows[1]?.text()).toContain('Shopify Orders Endpoint')
    expect(schemaRows[1]?.text()).not.toContain('CSV source')
    expect(schemaRows[1]?.text()).not.toContain('Shopify orders')

    const file1SystemConfig = wrapper.get('[data-testid="ruleset-manager-system-config-file1"]')
    const file2SystemConfig = wrapper.get('[data-testid="ruleset-manager-system-config-file2"]')
    expect(file1SystemConfig.element.tagName).toBe('BUTTON')
    expect(file1SystemConfig.classes()).toContain('ruleset-manager-basic-card')
    expect(file1SystemConfig.classes()).toContain('ruleset-manager-basic-card--button')
    expect(file1SystemConfig.attributes('aria-label')).toBe('View auth info for source 1')
    expect(file2SystemConfig.element.tagName).toBe('BUTTON')
    expect(file2SystemConfig.classes()).toContain('ruleset-manager-basic-card')
    expect(file2SystemConfig.classes()).toContain('ruleset-manager-basic-card--button')
    expect(file2SystemConfig.attributes('aria-label')).toBe('View auth info for source 2')

    await file1SystemConfig.trigger('click')
    await flushPromises()

    expect(listOmsRestSourceConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 })
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith({ configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'dev_oms' })
    expect(routerPush).not.toHaveBeenCalled()
    let dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(wrapper.get('.static-page-frame').classes()).toContain('static-page-frame--popup-open')
    expect(dialog.text()).toContain('Test OMS')
    expect(dialog.text()).toContain('Config ID')
    expect(dialog.text()).toContain('dev_oms')
    expect(dialog.text()).toContain('Base URL')
    expect(dialog.text()).toContain('https://test-maarg.hotwax.io')
    expect(dialog.text()).toContain('Auth Type')
    expect(dialog.text()).toContain('Basic')
    expect(dialog.text()).not.toContain('Username')
    expect(dialog.text()).not.toContain('Password')
    expect(dialog.text()).not.toContain('API Token')
    expect(dialog.text()).not.toContain('Custom Headers')
    expect(dialog.text()).not.toContain('Active')
    expect(dialog.text()).not.toContain('Timeouts')
    expect(dialog.text()).not.toContain('Not configured')
    expect(dialog.text()).not.toContain('None')
    expect(dialog.text()).not.toContain('30s')
    expect(dialog.text()).not.toContain('120s')
    // Label comes from the registry row, not the deleted swagger doc; the registry carries no
    // method/path, so no such fabricated meta text should appear either.
    expect(dialog.text()).toContain('Orders API')
    const authPopupHeadings = dialog.findAll('.ruleset-manager-auth-popup-heading')
    const source = readFileSync('src/pages/reconciliation/ReconciliationRuleSetManagerPage.vue', 'utf8')
    expect(authPopupHeadings).toHaveLength(2)
    expect(authPopupHeadings[0]?.text()).toBe('Test OMS')
    expect(authPopupHeadings[1]?.text()).toBe('Endpoints')
    expect(source).toContain('--ruleset-manager-auth-popup-gap: 0.7rem;')
    expect(source).toContain('gap: var(--ruleset-manager-auth-popup-gap);')
    expect(dialog.find('form').exists()).toBe(false)
    expect(dialog.find('input').exists()).toBe(false)
    expect(dialog.find('[data-testid="oms-auth-edit-action"]').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-auth-popup-dashboard"]').attributes('data-to') ?? '{}')).toMatchObject({
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: 'dev_oms' },
    })

    await file2SystemConfig.trigger('click')
    await flushPromises()

    expect(getShopifyAuthConfig).toHaveBeenCalledWith({ shopifyAuthConfigId: 'dev_shopify' })
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith({ configTypeEnumId: 'SCFG_SHOPIFY_AUTH', configId: 'dev_shopify' })
    expect(routerPush).not.toHaveBeenCalled()
    dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.text()).toContain('Dev Shopify')
    expect(dialog.text()).toContain('Config ID')
    expect(dialog.text()).toContain('dev_shopify')
    expect(dialog.text()).toContain('Shop/API URL')
    expect(dialog.text()).toContain('https://test.myshopify.com')
    expect(dialog.text()).not.toContain('Access Token')
    expect(dialog.text()).not.toContain('Active')
    // Label from the registry row; the api-version meta interpolation is the one piece of
    // per-endpoint detail this popup still derives locally (Shopify endpoints share one GraphQL
    // URL, so the version is genuinely the same for all of them -- unlike OMS's per-endpoint paths).
    expect(dialog.text()).toContain('Admin GraphQL Orders')
    expect(dialog.text()).toContain('/admin/api/2026-01/graphql.json')
    expect(dialog.find('form').exists()).toBe(false)
    expect(dialog.find('input').exists()).toBe(false)
    expect(dialog.find('[data-testid="shopify-auth-edit-action"]').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-auth-popup-dashboard"]').attributes('data-to') ?? '{}')).toMatchObject({
      name: 'settings-shopify-auth',
      params: { shopifyAuthConfigId: 'dev_shopify' },
    })
  })

  it('shows an error in the auth popup instead of a false empty endpoint list when the registry fetch fails', async () => {
    // The popup's loading flag already covers the combined config+endpoint fetch (they run in
    // parallel); a registry failure must surface as the popup's existing error state, not as a
    // popup that loads fine but silently shows zero endpoints.
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createApiDraftState()
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')
    listSourceConfigEndpoints.mockRejectedValue(new ApiCallError('Unable to reach the endpoint registry.', 500))

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-system-config-file1"]').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.text()).toContain('Unable to reach the endpoint registry.')
    expect(dialog.find('[data-testid="ruleset-manager-auth-popup-endpoint"]').exists()).toBe(false)
    expect(dialog.text()).not.toContain('Orders API')
  })

  it('renders only the enabled rows from a mixed registry response in the auth popup', async () => {
    // buildEnabledAuthInfoEndpoints filters on isEnabled before mapping to tiles. Every other test
    // in this file only ever supplies an all-enabled list (or the empty-array default), so a
    // filter regression there -- e.g. rendering every row regardless of isEnabled -- would pass
    // unnoticed. This is the one case with both an enabled and a disabled row in the same response.
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createApiDraftState()
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [
        { systemEnumId: 'OMS_ORDERS', endpointLabel: 'Orders API', isEnabled: true },
        { systemEnumId: 'OMS_RETURNS', endpointLabel: 'Returns API', isEnabled: false },
      ],
    })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-system-config-file1"]').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    const endpointTiles = dialog.findAll('[data-testid="ruleset-manager-auth-popup-endpoint"]')
    expect(endpointTiles).toHaveLength(1)
    expect(dialog.text()).toContain('Orders API')
    expect(dialog.text()).not.toContain('Returns API')
  })

  it('names each API source config by its description, per system when one id serves both sides', async () => {
    // The id an operator reuses per environment: one `rails_prod` on the HotWax side, another on
    // the Shopify side. Printing the id names the environment and neither config; matching on id
    // alone would print whichever description happened to come first for both rows.
    draftStoreState.ruleSetDraftState = buildReconciliationRuleSetDraftState(
      {
        ...createApiDraftState().draft,
        file1SourceConfigId: 'rails_prod',
        file2SourceConfigId: 'rails_prod',
      },
      'ruleset-manager',
    )
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [
        {
          sourceConfigId: 'rails_prod',
          sourceConfigType: 'HOTWAX_OMS_REST',
          description: 'Rails Production OMS',
          systemEnumId: 'OMS',
        },
        {
          sourceConfigId: 'rails_prod',
          sourceConfigType: 'SHOPIFY_AUTH',
          description: 'Rails Production Storefront',
          systemEnumId: 'SHOPIFY',
        },
      ],
    })
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-manager-system-config-name-file1"]').text()).toBe('Rails Production OMS')
    expect(wrapper.get('[data-testid="ruleset-manager-system-config-name-file2"]').text()).toBe('Rails Production Storefront')
    expect(wrapper.text()).not.toContain('rails_prod')
  })

  it('falls back to the config id when the option list carries no description', async () => {
    draftStoreState.ruleSetDraftState = createApiDraftState()
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [{ sourceConfigId: 'dev_oms', sourceConfigType: 'HOTWAX_OMS_REST', systemEnumId: 'OMS' }],
    })
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-manager-system-config-name-file1"]').text()).toBe('dev_oms')
    // Absent from the list entirely — the same fallback has to hold, or the card loses the only
    // thing it could say about the source.
    expect(wrapper.get('[data-testid="ruleset-manager-system-config-name-file2"]').text()).toBe('dev_shopify')
  })

  it('renders a saved run summary and equation without editable rule controls', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(getJsonSchema).toHaveBeenCalledWith({ schemaName: 'orders-reconciliation-prod-2026-03-01-to-2026-03-31-2026-04-09-04-55-22' }, expect.any(AbortSignal))
    expect(getJsonSchema).toHaveBeenCalledWith({ schemaName: 'Krewe OMS Orders (1)' }, expect.any(AbortSignal))
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).toContain('legacyResourceId = shopify_order_id')
    expect(wrapper.get('[data-testid="ruleset-manager-rule-list"]').text()).toContain('#0')
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).not.toContain('$.orders[*].legacyResourceId')
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).not.toContain('$[*].shopify_order_id')
    expect(wrapper.find('.ruleset-manager-basics-grid').exists()).toBe(true)
    expect(wrapper.findAll('.ruleset-manager-schema-row')).toHaveLength(2)
    expect(wrapper.findAll('.ruleset-manager-basic-card')).toHaveLength(6)
    expect(wrapper.find('.ruleset-manager-comparison-side').exists()).toBe(false)
    expect(wrapper.find('.ruleset-manager-operator').exists()).toBe(false)
    expect(wrapper.text()).toContain('Shopify Orders')
    expect(wrapper.text()).toContain('Krewe OMS Orders')
    expect(wrapper.text()).not.toContain('Shopify Orders - SHOPIFY - Primary ID')
    expect(wrapper.text()).not.toContain('Krewe OMS Orders - OMS - Primary ID')
    expect(wrapper.text()).not.toContain('orders-reconciliation-prod-2026-03-01-to-2026-03-31-2026-04-09-04-55-22')
  })

  it('allows tenant users to run a saved ruleset without edit or delete actions', async () => {
    permissionState.canRunActiveTenantReconciliation = true
    permissionState.canEditTenantSettings = false
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-manager-edit-run"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-edit-rules"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-delete-run"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-run-ruleset"]').exists()).toBe(true)

    await wrapper.get('[data-testid="ruleset-manager-run-ruleset"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith(expect.objectContaining({ name: 'reconciliation-diff' }))
  })

  it('renders persisted rules from the rules editor draft and keeps the basic diff visible', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState([
          {
            ruleId: 'basic-diff',
            file1FieldPath: '$.orders[*].legacyResourceId',
            file2FieldPath: '$[*].shopify_order_id',
            operator: '=',
            sequenceNum: 0,
          },
          {
            ruleId: 'RS_ORDER_SYNC_RULE_1',
            file1FieldPath: '$.orders[*].legacyResourceId',
            file2FieldPath: '$[*].order_name',
            operator: '=',
            sequenceNum: 1,
          },
        ])
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-manager-rule-list"]').text()).toContain('#0')
    expect(wrapper.get('[data-testid="ruleset-manager-rule-list"]').text()).toContain('legacyResourceId = shopify_order_id')
    expect(wrapper.get('[data-testid="ruleset-manager-rule-list"]').text()).toContain('#1')
    expect(wrapper.get('[data-testid="ruleset-manager-rule-list"]').text()).toContain('legacyResourceId = order_name')
    expect(wrapper.get('[data-testid="ruleset-manager-preview"]').text()).not.toContain('basic-diff')
  })

  it('opens the run edit workflow from the Run section without sending rule state', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-edit-run"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      name: 'settings-runs-edit',
      params: { reconciliationMappingId: 'RS_ORDER_SYNC' },
    })
  })

  it('opens the rules edit workflow from the Rules section', async () => {
    const rules = [
      {
        ruleId: 'RS_ORDER_SYNC_RULE_1',
        file1FieldPath: '$.orders[*].legacyResourceId',
        file2FieldPath: '$[*].order_name',
        operator: '=',
        sequenceNum: 1,
      },
    ]
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState(rules)
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-edit-rules"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      name: 'reconciliation-ruleset-editor',
    })
  })

  it('opens the reconciliation run workflow from the bottom play action', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-run-ruleset"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      name: 'reconciliation-diff',
      query: {
        savedRunId: 'RS_ORDER_SYNC',
        runName: 'Order Sync',
        file1SystemLabel: 'SHOPIFY',
        file2SystemLabel: 'OMS',
      },
    })
  })

  it('opens the previous runs page from the bottom list action', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const footerActions = wrapper.findAll('.ruleset-manager-footer-row > *')
    expect(footerActions.map((action) => action.attributes('data-testid'))).toEqual([
      'ruleset-manager-run-ruleset',
      'ruleset-manager-view-history',
      'ruleset-manager-delete-run',
    ])
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-view-history"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-history',
      params: {
        savedRunId: 'RS_ORDER_SYNC',
      },
      query: {
        runName: 'Order Sync',
        file1SystemLabel: 'SHOPIFY',
        file2SystemLabel: 'OMS',
      },
    })
  })

  it('does not offer residual actions from the manager edit surface', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Create Basic Diff Run')
    expect(wrapper.text()).not.toContain('Back to Run Editor')
    expect(wrapper.find('.ruleset-manager-actions').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-back"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-create"]').exists()).toBe(false)
  })

  it('deletes a saved run from the bottom trash action after confirmation', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
      draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
      window.history.replaceState({}, '', '/reconciliation/ruleset-manager')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteSavedRun.mockResolvedValue({
      ok: true,
      messages: ['Deleted saved run RS_ORDER_SYNC.'],
      errors: [],
      deleted: true,
      deletedSavedRunId: 'RS_ORDER_SYNC',
    })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-delete-run"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('Delete run "Order Sync"?')
    expect(deleteSavedRun).toHaveBeenCalledWith({ savedRunId: 'RS_ORDER_SYNC' })
    expect(routerPush).toHaveBeenCalledWith('/settings/runs')

    confirmSpy.mockRestore()
  })

  it('shows an empty state when there is no draft in history state', async () => {
    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).toContain('No run basics defined yet')
    expect(wrapper.text()).toContain('Go to Run Setup')
    expect(wrapper.find('[data-testid="ruleset-manager-create"]').exists()).toBe(false)
  })

  it('summarizes configured exclusions for each side', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    const draftState = createDraftState()
    draftState.draft.file2ExcludeFilters = [
      { fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL', 'DRAFT_SALES_CHANNEL'] },
    ]
    draftStoreState.ruleSetDraftState = draftState
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const card = wrapper.get('[data-testid="ruleset-exclusions-file2"]')
    expect(card.text()).toContain('salesChannelEnumId')
    expect(card.text()).toContain('POS_SALES_CHANNEL')
  })

  it('shows a dash when a side has no exclusions', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createDraftState()
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-exclusions-file2"]').text()).toContain('—')
  })

  it('never renders an excluded record count', async () => {
    // Counts are metadata-only by product decision (2026-08-03).
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    const draftState = createDraftState()
    draftState.draft.file2ExcludeFilters = [
      { fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
    ]
    draftStoreState.ruleSetDraftState = draftState
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).not.toMatch(/excluded\s+\d/i)
  })

  it('keeps exclusion entries out of the numbered comparison-rule list', async () => {
    // Every other assertion in this file is a substring check against the exclusion text, which
    // would pass identically whether the exclusion <li> sat inside or outside the numbered <ol>.
    // This walks the DOM ancestry directly so the design-spec no-numbering property actually has
    // a guard: it must fail if someone moves the exclusion entries into the rule list.
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    const draftState = createDraftState()
    draftState.draft.file1ExcludeFilters = [
      { fieldExpression: 'orderStatus', operator: 'EXCLUDE_IN', values: ['CANCELLED'] },
    ]
    draftState.draft.file2ExcludeFilters = [
      { fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
    ]
    draftStoreState.ruleSetDraftState = draftState
    window.history.replaceState({}, '', '/reconciliation/ruleset-manager')

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const ruleList = wrapper.get('[data-testid="ruleset-manager-rule-list"]')
    expect(ruleList.element.tagName).toBe('OL')

    const exclusionsList = wrapper.get('[data-testid="ruleset-manager-exclusion-list"]')
    expect(exclusionsList.element.tagName).toBe('UL')
    expect(ruleList.element.contains(exclusionsList.element)).toBe(false)

    const exclusionsFile1 = wrapper.get('[data-testid="ruleset-exclusions-file1"]')
    const exclusionsFile2 = wrapper.get('[data-testid="ruleset-exclusions-file2"]')
    expect(ruleList.element.contains(exclusionsFile1.element)).toBe(false)
    expect(ruleList.element.contains(exclusionsFile2.element)).toBe(false)

    // No sequence marker anywhere inside the exclusions list either -- exclusions stay
    // deliberately unordered/unnumbered, unlike the numbered comparison rules.
    expect(exclusionsList.findAll('.ruleset-manager-rule-sequence')).toHaveLength(0)
    expect(exclusionsList.text()).not.toMatch(/#\d/)
  })
})
