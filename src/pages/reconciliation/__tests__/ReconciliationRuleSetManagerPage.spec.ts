import { readFileSync } from 'node:fs'
import type { RunConclusions } from '../../../lib/api/authoringTypes'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  type ReconciliationRuleSetDraftRule,
  type ReconciliationRuleSetDraftState,
} from '../../../lib/reconciliationRuleSetDraft'

const getJsonSchema = vi.hoisted(() => vi.fn())
const deleteSavedRun = vi.hoisted(() => vi.fn())
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const getShopifyAuthConfig = vi.hoisted(() => vi.fn())
const listSourceConfigEndpoints = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
const getRunConclusions = vi.hoisted(() => vi.fn())
const saveRunConclusions = vi.hoisted(() => vi.fn())
const saveSavedRunName = vi.hoisted(() => vi.fn())
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
    saveSavedRunName,
  },
  settingsFacade: {
    listOmsRestSourceConfigs,
    getShopifyAuthConfig,
    listSourceConfigEndpoints,
  },
}))

vi.mock('../../../lib/api/authoringFacade', () => ({
  runConclusionFacade: { get: getRunConclusions, save: saveRunConclusions, createCode: vi.fn() },
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

function createDraftState(): ReconciliationRuleSetDraftState {
  return {
    draft: {
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
    resumeStepId: 'ruleset-manager',
  }
}

function createSingleSidedDraftState(): ReconciliationRuleSetDraftState {
  return {
    draft: {
      savedRunId: 'NS_ORDERS_NO_FULFILLMENT_RS',
      runName: 'Orders that never shipped',
      scopeMode: 'EVALUATE',
      file1SystemEnumId: 'NETSUITE_SUITEQL',
      file1SystemLabel: 'NetSuite',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SourceConfigId: 'NS_ORDERS_NO_FULFILLMENT',
      file1FileTypeEnumId: 'DftJson',
      file1PrimaryIdExpression: ['internalId'],
      // Exactly what buildRuleSetDraft now produces for a one-sided run: present but empty.
      file2SystemEnumId: '',
      file2SystemLabel: '',
      file2FileTypeEnumId: '',
      file2PrimaryIdExpression: [],
    },
    resumeStepId: 'ruleset-manager',
  }
}

function createSavedRunReopenDraftState(rules: ReconciliationRuleSetDraftRule[] = []): ReconciliationRuleSetDraftState {
  return {
    draft: {
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
    resumeStepId: 'ruleset-manager',
  }
}

function createApiDraftState(): ReconciliationRuleSetDraftState {
  return {
    draft: {
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
    resumeStepId: 'ruleset-manager',
  }
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
    getRunConclusions.mockReset()
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: null })
    saveRunConclusions.mockReset()
    saveSavedRunName.mockReset()
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

  function fact(wrapper: ReturnType<typeof mount>, key: string) {
    const cell = wrapper.get(`[data-testid="ruleset-manager-fact-${key}"]`)
    return {
      cell,
      label: cell.get('.static-page-summary-label').text(),
      value: cell.get('.static-fact__value').text(),
      sub: cell.find('.static-fact__sub').exists() ? cell.get('.static-fact__sub').text() : null,
    }
  }

  function factKeys(wrapper: ReturnType<typeof mount>): string[] {
    return wrapper.get('[data-testid="ruleset-manager-facts"]').findAll('.static-fact')
      .map((cell) => (cell.attributes('data-testid') ?? '').replace('ruleset-manager-fact-', ''))
  }

  function conclusionsTree(): RunConclusions {
    return {
      savedRunId: 'RS_ORDER_SYNC',
      scopeMode: 'COMPARE',
      conclusions: [
        {
          key: '10', parent: null, conclusion: 'CONC_CANCELLED', label: 'Cancelled in the OMS', bucket: 'MISSING_FROM_FILE_1',
          question: 'Was it cancelled?', outcome: null,
          conditions: [{ subject: 'FILE_2', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL', field: 'statusId', operator: 'IN', values: ['ORDER_CANCELLED'], checkLabel: 'Cancelled' }],
        },
        {
          key: '20', parent: '10', conclusion: 'CONC_STUCK', label: 'Sync stuck', bucket: null, question: null, outcome: 'HIDE',
          conditions: [{ subject: 'FILE_2', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL', field: 'orderDate', operator: 'WITHIN_HOURS', values: ['24'], checkLabel: 'Recent' }],
        },
      ],
      catalog: [{ id: 'CONC_CANCELLED', label: 'Cancelled in the OMS' }, { id: 'CONC_STUCK', label: 'Sync stuck' }],
      buckets: ['MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING'],
      operators: ['IN', 'NOT_IN', 'GT', 'GT_ZERO', 'WITHIN_HOURS', 'BLANK', 'NOT_BLANK'],
      presence: ['ANY', 'KEPT', 'EXCLUDED', 'ABSENT'],
      keyScopes: ['FULL', 'FIRST_FIELD'],
      quantifiers: ['ALL', 'ANY'],
    }
  }

  // A single-sided run (scopeMode EVALUATE) has no second source. Before the board read scopeMode it
  // rendered the two-sided layout anyway and filled the empty half with placeholders -- a "System 2"
  // card, a "Field pending" primary id, an exclusion slot and a synthesized "#0 internalId = Field
  // pending" rule. None of those describe anything that exists.
  it('heads a single-sided run with its one system, its key and its checks', async () => {
    draftStoreState.ruleSetDraftState = createSingleSidedDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(factKeys(wrapper)).toEqual(['file1', 'pairs', 'checks'])
    expect(fact(wrapper, 'file1').label).toBe('NetSuite')
    expect(fact(wrapper, 'pairs')).toMatchObject({ label: 'Primary ID', value: 'internalId' })
    expect(fact(wrapper, 'checks')).toMatchObject({ value: '0 filters · 0 rules' })
    expect(wrapper.text()).not.toContain('Pairs rows on')
    expect(wrapper.text()).not.toContain('System 2')
    expect(wrapper.text()).not.toContain('Field pending')
  })

  // The synthesized primary-key rule compares file1's key to file2's. With no second side there is
  // nothing to compare, and the findings are the rows the source returns -- so the section says that.
  it('keeps the single-sided wording when a single-sided run has no rules', async () => {
    draftStoreState.ruleSetDraftState = createSingleSidedDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-manager-rule-list"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="ruleset-manager-rule-none"]').text()).toBe('Every record this source returns is a finding.')
  })

  it('lists filters for the only side a single-sided run has', async () => {
    const draftState = createSingleSidedDraftState()
    draftState.draft.file1ExcludeFilters = [{ fieldExpression: 'status', operator: 'EXCLUDE_IN', values: ['Closed'] }]
    draftState.draft.file2ExcludeFilters = [{ fieldExpression: 'ghost', operator: 'EXCLUDE_IN', values: ['x'] }]
    draftStoreState.ruleSetDraftState = draftState

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ruleset-manager-filter-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('NetSuite')
    expect(wrapper.text()).not.toContain('ghost')
  })

  it('opens with the run name and one fact per system, how rows pair and what the run checks', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createDraftState()
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: { ...conclusionsTree(), conclusions: [] } })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const title = wrapper.get('[data-testid="ruleset-manager-run-name"]')
    expect(title.element.tagName).toBe('H1')
    expect(title.text()).toBe('JSON Order Compare')
    expect(title.attributes('contenteditable')).toBe('plaintext-only')
    expect(factKeys(wrapper)).toEqual(['file1', 'file2', 'pairs', 'checks'])
    // A file-backed system: no connection to name, so the schema is its value and the cell is plain.
    expect(fact(wrapper, 'file1')).toMatchObject({ label: 'OMS', value: 'OMS orders', sub: null })
    expect(fact(wrapper, 'file2')).toMatchObject({ label: 'SHOPIFY', value: 'Shopify orders', sub: null })
    expect(fact(wrapper, 'file1').cell.element.tagName).toBe('DIV')
    expect(fact(wrapper, 'pairs')).toMatchObject({ label: 'Pairs rows on', value: 'order_id = id' })
    expect(fact(wrapper, 'checks')).toMatchObject({ label: 'Checks', value: '0 filters · 1 rule', sub: '0 conclusions' })
    // The Run section, its six cards and its pencil are gone: the header carries those facts now.
    expect(wrapper.find('[data-testid="ruleset-manager-edit-run"]').exists()).toBe(false)
    expect(wrapper.find('.ruleset-manager-basic-card').exists()).toBe(false)
    expect(wrapper.findAll('.static-page-section-heading').map((heading) => heading.text())).toEqual(['Filters', 'Rules', 'Conclusions'])
    expect(wrapper.text()).not.toContain('Exclusions')
    expect(wrapper.text()).not.toContain('test-oms-orders.schema.json')
    expect(wrapper.text()).not.toContain('$.orders[0].order_id = ')
  })

  it('shows every composite key field in the pairing fact', async () => {
    draftStoreState.ruleSetDraftState = {
      draft: {
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
      resumeStepId: 'ruleset-manager',
    }

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(fact(wrapper, 'pairs').value).toBe('return_id + product_id = return_id + product_id')
  })

  it('opens today\'s auth popup from an API system\'s fact', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createApiDraftState()
    listSourceConfigEndpoints.mockImplementation(
      async ({ configTypeEnumId, configId }: { configTypeEnumId: string, configId: string }) => {
        if (configTypeEnumId === 'SCFG_HOTWAX_OMS' && configId === 'dev_oms') {
          return { ok: true, messages: [], errors: [], endpoints: [{ systemEnumId: 'OMS_ORDERS', endpointLabel: 'Orders API', isEnabled: true }] }
        }
        if (configTypeEnumId === 'SCFG_SHOPIFY_AUTH' && configId === 'dev_shopify') {
          return { ok: true, messages: [], errors: [], endpoints: [{ systemEnumId: 'SHOPIFY_ORDERS', endpointLabel: 'Admin GraphQL Orders', isEnabled: true }] }
        }
        return { ok: true, messages: [], errors: [], endpoints: [] }
      },
    )

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    // System title over its connection, the endpoint dim below it.
    expect(fact(wrapper, 'file1')).toMatchObject({ label: 'HotWax', value: 'dev_oms', sub: 'Orders API' })
    expect(fact(wrapper, 'file2')).toMatchObject({ label: 'SHOPIFY', value: 'dev_shopify', sub: 'Shopify Orders Endpoint' })
    const file1 = fact(wrapper, 'file1').cell
    const file2 = fact(wrapper, 'file2').cell
    expect(file1.element.tagName).toBe('BUTTON')
    expect(file1.attributes('aria-label')).toBe('View auth info for source 1')
    expect(file2.attributes('aria-label')).toBe('View auth info for source 2')

    await file1.trigger('click')
    await flushPromises()

    expect(listOmsRestSourceConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 })
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith({ configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'dev_oms' })
    expect(routerPush).not.toHaveBeenCalled()
    let dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(wrapper.get('.static-page-frame').classes()).toContain('static-page-frame--popup-open')
    // Outside the frame, so the frame's blur never reaches it.
    expect(dialog.element.closest('.static-page-frame')).toBeNull()
    expect(dialog.text()).toContain('Test OMS')
    expect(dialog.text()).toContain('Base URL')
    expect(dialog.text()).toContain('https://test-maarg.hotwax.io')
    expect(dialog.text()).toContain('Basic')
    expect(dialog.text()).not.toContain('Password')
    expect(dialog.text()).toContain('Orders API')
    const authPopupHeadings = dialog.findAll('.ruleset-manager-auth-popup-heading')
    expect(authPopupHeadings.map((heading) => heading.text())).toEqual(['Test OMS', 'Endpoints'])
    const source = readFileSync('src/pages/reconciliation/ReconciliationRuleSetManagerPage.vue', 'utf8')
    expect(source).toContain('--ruleset-manager-auth-popup-gap: 0.7rem;')
    expect(dialog.find('form').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-auth-popup-dashboard"]').attributes('data-to') ?? '{}')).toMatchObject({
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: 'dev_oms' },
    })

    await file2.trigger('click')
    await flushPromises()

    expect(getShopifyAuthConfig).toHaveBeenCalledWith({ shopifyAuthConfigId: 'dev_shopify' })
    dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.text()).toContain('Dev Shopify')
    expect(dialog.text()).toContain('Admin GraphQL Orders')
    expect(dialog.text()).toContain('/admin/api/2026-01/graphql.json')
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-auth-popup-dashboard"]').attributes('data-to') ?? '{}')).toMatchObject({
      name: 'settings-shopify-auth',
      params: { shopifyAuthConfigId: 'dev_shopify' },
    })
  })

  it('keeps an API system\'s fact plain for someone who cannot view tenant settings', async () => {
    permissionState.canViewTenantSettings = false
    draftStoreState.ruleSetDraftState = createApiDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(fact(wrapper, 'file1').cell.element.tagName).toBe('DIV')
    await fact(wrapper, 'file1').cell.trigger('click')
    expect(wrapper.find('[data-testid="ruleset-manager-auth-popup"]').exists()).toBe(false)
  })

  // Live bug (2026-08 "Returns Prod" run): the System fact names the SYSTEM (from the enum's
  // parentEnumId), and the endpoint's OWN label sits under the connection -- not the parent system's
  // default connector label. A pass-through guard on the UI side; the value comes from the backend.
  it('names the system as the fact\'s label and the endpoint under its connection', async () => {
    draftStoreState.ruleSetDraftState = {
      draft: {
        savedRunId: 'RS_RETURNS_PROD',
        runName: 'Returns Prod',
        file1SystemEnumId: 'SHOPIFY_RETURN_REFS',
        file1SystemLabel: 'Shopify Order Return References',
        file1SystemParentLabel: 'Shopify',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SystemMessageRemoteId: 'SHOPIFY_REMOTE',
        file1SystemMessageRemoteLabel: 'Shopify Return References',
        file1SourceConfigId: 'gorjana_prod',
        file1SourceConfigType: 'SHOPIFY_RETURN_REFS_API',
        file1FileTypeEnumId: 'DftJson',
        file1PrimaryIdExpression: ['refundOrReturnId'],
        file2SystemEnumId: 'OMS_RETURNS',
        file2SystemLabel: 'HotWax Returns (Reconciliation API)',
        file2SystemParentLabel: 'HotWax',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
        file2SystemMessageRemoteLabel: 'Reconciliation Returns API',
        file2SourceConfigId: 'gorjana_prod',
        file2SourceConfigType: 'HOTWAX_OMS_REST_RETURNS',
        file2FileTypeEnumId: 'DftJson',
        file2PrimaryIdExpression: ['externalId'],
        rules: [{ file1FieldPath: 'refundOrReturnId', file2FieldPath: 'externalId', operator: '=', sequenceNum: 1 }],
      },
      resumeStepId: 'ruleset-manager',
    }

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(fact(wrapper, 'file1')).toMatchObject({ label: 'Shopify', value: 'gorjana_prod', sub: 'Shopify Return References' })
    expect(fact(wrapper, 'file2')).toMatchObject({ label: 'HotWax', value: 'gorjana_prod', sub: 'Reconciliation Returns API' })
    expect(wrapper.get('[data-testid="ruleset-manager-facts"]').text()).not.toContain('Shopify Order Return References')
    expect(wrapper.get('[data-testid="ruleset-manager-facts"]').text()).not.toContain('Admin GraphQL Orders')
    // The renamed join key, not the internal `eventId` the extractor used to emit.
    expect(fact(wrapper, 'pairs').value).toBe('refundOrReturnId = externalId')
  })

  it('shows an error in the auth popup instead of a false empty endpoint list when the registry fetch fails', async () => {
    draftStoreState.ruleSetDraftState = createApiDraftState()
    listSourceConfigEndpoints.mockRejectedValue(new ApiCallError('Unable to reach the endpoint registry.', 500))

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await fact(wrapper, 'file1').cell.trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.text()).toContain('Unable to reach the endpoint registry.')
    expect(dialog.find('[data-testid="ruleset-manager-auth-popup-endpoint"]').exists()).toBe(false)
  })

  it('renders only the enabled rows from a mixed registry response in the auth popup', async () => {
    draftStoreState.ruleSetDraftState = createApiDraftState()
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

    await fact(wrapper, 'file1').cell.trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[data-testid="ruleset-manager-auth-popup"]')
    expect(dialog.findAll('[data-testid="ruleset-manager-auth-popup-endpoint"]')).toHaveLength(1)
    expect(dialog.text()).not.toContain('Returns API')
  })

  it('names each API source config by its description, per system when one id serves both sides', async () => {
    draftStoreState.ruleSetDraftState = {
      draft: { ...createApiDraftState().draft, file1SourceConfigId: 'rails_prod', file2SourceConfigId: 'rails_prod' },
      resumeStepId: 'ruleset-manager',
    }
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [
        { sourceConfigId: 'rails_prod', sourceConfigType: 'HOTWAX_OMS_REST', description: 'Rails Production OMS', systemEnumId: 'OMS' },
        { sourceConfigId: 'rails_prod', sourceConfigType: 'SHOPIFY_AUTH', description: 'Rails Production Storefront', systemEnumId: 'SHOPIFY' },
      ],
    })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(fact(wrapper, 'file1').value).toBe('Rails Production OMS')
    expect(fact(wrapper, 'file2').value).toBe('Rails Production Storefront')
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

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(fact(wrapper, 'file1').value).toBe('dev_oms')
    expect(fact(wrapper, 'file2').value).toBe('dev_shopify')
  })

  it('names the source configs from the last visit at once on a revisit, before the network answers (DAR-UI-051)', async () => {
    draftStoreState.ruleSetDraftState = createApiDraftState()
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [{ sourceConfigId: 'dev_oms', sourceConfigType: 'HOTWAX_OMS_REST', description: 'Dev OMS', systemEnumId: 'OMS' }],
    })
    mount(ReconciliationRuleSetManagerPage).unmount()
    await flushPromises()

    listAutomationSourceOptions.mockReturnValue(new Promise(() => {}))
    const revisit = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(fact(revisit, 'file1').value).toBe('Dev OMS')
  })

  it('reads schema labels for a reopened saved run', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(getJsonSchema).toHaveBeenCalledWith({ schemaName: 'orders-reconciliation-prod-2026-03-01-to-2026-03-31-2026-04-09-04-55-22' }, expect.any(AbortSignal))
    expect(getJsonSchema).toHaveBeenCalledWith({ schemaName: 'Krewe OMS Orders (1)' }, expect.any(AbortSignal))
    expect(fact(wrapper, 'file1').value).toBe('Shopify Orders')
    expect(fact(wrapper, 'file2').value).toBe('Krewe OMS Orders')
    expect(fact(wrapper, 'pairs').value).toBe('legacyResourceId = shopify_order_id')
    expect(wrapper.text()).not.toContain('orders-reconciliation-prod-2026-03-01-to-2026-03-31-2026-04-09-04-55-22')
  })

  it('lists one filter row per filter per side from the draft, above the rules', async () => {
    const draftState = createDraftState()
    draftState.draft.file1ExcludeFilters = [
      { fieldExpression: '$.orders[*].statusId', operator: 'EXCLUDE_IN', values: ['ORDER_CANCELLED', 'ORDER_REJECTED'] },
      { fieldExpression: 'orderName', operator: 'INCLUDE_PREFIX', values: ['EXC-'] },
    ]
    draftState.draft.file2ExcludeFilters = [
      { fieldExpression: 'salesChannelEnumId', operator: 'INCLUDE_IN', values: ['WEB'] },
    ]
    draftStoreState.ruleSetDraftState = draftState

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="ruleset-manager-filter-row"]')
    expect(rows).toHaveLength(3)
    const cells = (index: number) => rows[index]!.findAll(':scope > span').map((cell) => cell.text().replace(/\s+/g, ' '))
    // system | field (name, path dim) | how | values
    expect(cells(0)).toEqual(['OMS', 'statusId$.orders[*].statusId', 'Values to exclude', 'ORDER_CANCELLED, ORDER_REJECTED'])
    expect(rows[0]!.get('.ruleset-manager-field__path').text()).toBe('$.orders[*].statusId')
    expect(cells(1)).toEqual(['OMS', 'orderName', 'Starts to keep', 'EXC-'])
    expect(rows[1]!.find('.ruleset-manager-field__path').exists()).toBe(false)
    expect(cells(2)).toEqual(['SHOPIFY', 'salesChannelEnumId', 'Values to keep', 'WEB'])
    expect(fact(wrapper, 'checks').value).toBe('3 filters · 1 rule')

    // Filters are applied first, so they read first.
    const filters = wrapper.get('[data-testid="ruleset-manager-filters"]').element
    const rules = wrapper.get('[data-testid="ruleset-manager-rules"]').element
    expect(filters.compareDocumentPosition(rules) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Counts are metadata-only by product decision (2026-08-03).
    expect(wrapper.text()).not.toMatch(/excluded\s+\d/i)
  })

  it('says so in one plain row when there are no filters', async () => {
    draftStoreState.ruleSetDraftState = createDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="ruleset-manager-filter-row"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="ruleset-manager-filter-none"]').text()).toBe('No filters. Every row is compared.')
  })

  it('lists the rules as rows in sequence order: fields by name with the path dim, the operator, pre-actions and name', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState([
      { ruleId: 'R2', file1FieldPath: '$.orders[*].total', file2FieldPath: '$[*].grand_total', operator: '>=', sequenceNum: 2, ruleName: '',
        preActions: [{ fieldSide: 'file1', action: 'STRING_TO_NUMBER' }, { fieldSide: 'file2', action: 'STRING_TO_INT' }] },
      { ruleId: 'basic-diff', file1FieldPath: '$.orders[*].legacyResourceId', file2FieldPath: '$[*].shopify_order_id', operator: '=', sequenceNum: 0 },
      { ruleId: 'R1', file1FieldPath: '$.orders[*].isFulfilled', file2FieldPath: '$[*].isCompleted', operator: '=', sequenceNum: 1, ruleName: 'Fulfillment Sync' },
    ])

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-manager-rule-head"]').findAll('span').map((cell) => cell.text())).toEqual(['#', 'SHOPIFY', 'Test', 'OMS', 'Pre-actions'])
    const rows = wrapper.findAll('[data-testid="ruleset-manager-rule-row"]')
    expect(rows.map((row) => row.get('.ruleset-manager-rule-sequence').text())).toEqual(['0', '1', '2'])
    expect(rows[0]!.findAll('.ruleset-manager-field__name').map((name) => name.text())).toEqual(['legacyResourceId', 'shopify_order_id'])
    expect(rows[0]!.findAll('.ruleset-manager-field__path').map((path) => path.text())).toEqual(['$.orders[*].legacyResourceId', '$[*].shopify_order_id'])
    expect(rows[0]!.get('.ruleset-manager-operator-pill').text()).toBe('=')
    expect(rows[0]!.get('.ruleset-manager-rule-pre').text()).toBe('—')
    expect(rows[1]!.get('[data-testid="ruleset-manager-rule-name"]').text()).toBe('Fulfillment Sync')
    expect(rows[2]!.get('.ruleset-manager-operator-pill').text()).toBe('>=')
    expect(rows[2]!.get('.ruleset-manager-rule-pre').text()).toBe('SHOPIFY: String to number · OMS: String to int')
    expect(rows[2]!.find('[data-testid="ruleset-manager-rule-name"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('basic-diff')
    expect(fact(wrapper, 'checks').value).toBe('0 filters · 3 rules')
  })

  it('keeps filter rows out of the numbered rule list', async () => {
    const draftState = createDraftState()
    draftState.draft.file1ExcludeFilters = [{ fieldExpression: 'orderStatus', operator: 'EXCLUDE_IN', values: ['CANCELLED'] }]
    draftStoreState.ruleSetDraftState = draftState

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const ruleList = wrapper.get('[data-testid="ruleset-manager-rule-list"]')
    expect(ruleList.element.tagName).toBe('OL')
    const filterList = wrapper.get('[data-testid="ruleset-manager-filter-list"]')
    expect(filterList.element.tagName).toBe('UL')
    expect(ruleList.element.contains(filterList.element)).toBe(false)
    expect(filterList.findAll('.ruleset-manager-rule-sequence')).toHaveLength(0)
  })

  it('edits filters and rules with the pencil beside each heading, both into the rules editor', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState([
      { ruleId: 'R1', file1FieldPath: '$.orders[*].legacyResourceId', file2FieldPath: '$[*].order_name', operator: '=', sequenceNum: 1 },
    ])

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    for (const [testId, label] of [['ruleset-manager-edit-filters', 'Edit filters'], ['ruleset-manager-edit-rules', 'Edit rules']] as const) {
      routerPush.mockClear()
      draftStoreState.setRuleSetDraft.mockClear()
      const pencil = wrapper.get(`[data-testid="${testId}"]`)
      expect(pencil.attributes('aria-label')).toBe(label)
      expect(pencil.classes()).toEqual(expect.arrayContaining(['app-icon-action', 'ruleset-manager-section-edit']))
      expect(pencil.classes()).not.toContain('app-icon-action--large')
      expect(pencil.find('svg').exists()).toBe(true)
      expect(pencil.text()).toBe('')
      expect(pencil.element.closest('.ruleset-manager-section-header')).not.toBeNull()

      await pencil.trigger('click')
      await flushPromises()

      expect(draftStoreState.setRuleSetDraft).toHaveBeenCalledWith(expect.objectContaining({ savedRunId: 'RS_ORDER_SYNC' }), 'ruleset-manager')
      expect(routerPush).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-editor' })
    }
    expect(wrapper.text()).not.toContain('Change rules')
    expect(wrapper.text()).not.toContain('Change filters')
  })

  it('opens run setup from the pairing fact, the one way into it now the Run section is gone', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const pairs = fact(wrapper, 'pairs').cell
    expect(pairs.element.tagName).toBe('BUTTON')
    expect(pairs.attributes('aria-label')).toBe('Edit run setup')
    await pairs.trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      name: 'settings-runs-edit',
      params: { reconciliationMappingId: 'RS_ORDER_SYNC' },
    })
  })

  it('renames the run in place through the saved-run rename, and keeps the draft in step', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    saveSavedRunName.mockResolvedValue({ ok: true, messages: [], errors: [], savedRun: { savedRunId: 'RS_ORDER_SYNC', runName: 'Order Sync (prod)' } })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const title = wrapper.get('[data-testid="ruleset-manager-run-name"]')
    expect(title.attributes('aria-label')).toBe('Run name')
    ;(title.element as HTMLElement).textContent = 'Order Sync (prod)'
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(saveSavedRunName).toHaveBeenCalledWith({ savedRunId: 'RS_ORDER_SYNC', runName: 'Order Sync (prod)' })
    expect(draftStoreState.setRuleSetDraft).toHaveBeenCalledWith(
      expect.objectContaining({ savedRunId: 'RS_ORDER_SYNC', runName: 'Order Sync (prod)' }),
      'ruleset-manager',
    )
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-view-history"]').attributes('data-to') ?? '{}').query.runName).toBe('Order Sync (prod)')
  })

  it('says why a rename did not stick and puts the old name back', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    saveSavedRunName.mockRejectedValue(new ApiCallError('That name is taken.', 200))

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const title = wrapper.get('[data-testid="ruleset-manager-run-name"]')
    ;(title.element as HTMLElement).textContent = 'Taken'
    await title.trigger('input')
    await title.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-manager-error"]').text()).toContain('That name is taken.')
    expect(draftStoreState.setRuleSetDraft).not.toHaveBeenCalled()
  })

  it('shows the conclusions as flat read-only rows in the order they are tried, a child above its parent', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: conclusionsTree() })

    const wrapper = mount(ReconciliationRuleSetManagerPage, { attachTo: document.body })
    await flushPromises()

    expect(getRunConclusions).toHaveBeenCalledWith('RS_ORDER_SYNC', expect.any(AbortSignal))
    const section = wrapper.get('[data-testid="ruleset-manager-conclusions"]')
    expect(section.get('.static-page-section-heading').text()).toBe('Conclusions')
    expect(section.get('[data-testid="ruleset-manager-conclusions-note"]').text()).toBe('First match wins.')
    const rows = section.findAll('[data-testid="run-conclusions-node"]')
    // Flattened: the child ranks first, carries its parent's line, and explains its root's check.
    expect(rows.map((row) => row.attributes('data-key'))).toEqual(['20', '10'])
    expect(section.findAll('[data-testid="run-conclusions-number"]').map((number) => number.text())).toEqual(['1', '2'])
    expect(rows.map((row) => row.get('[data-testid="run-conclusions-explains"]').text())).toEqual(['explains In SHOPIFY', 'explains In SHOPIFY'])
    expect(rows[0]!.get('[data-testid="run-conclusions-when"]').text())
      .toBe('OMS statusId is one of ORDER_CANCELLED and OMS orderDate is within 24 hours')
    expect(rows[1]!.get('[data-testid="run-conclusions-when"]').text()).toBe('OMS statusId is one of ORDER_CANCELLED')
    expect(rows.map((row) => row.get('[data-testid="run-conclusions-outcome"]').text())).toEqual(['Hidden', 'Shown'])
    expect(rows[1]!.get('.run-conclusion__question').text()).toBe('Was it cancelled?')
    expect(fact(wrapper, 'checks').sub).toBe('2 conclusions')
    // Read only, even to an editor: no buttons, no create tile, no popup.
    expect(section.find('[data-testid="run-conclusions-list"] button').exists()).toBe(false)
    expect(section.find('[data-testid="run-conclusions-new"]').exists()).toBe(false)
    await rows[0]!.trigger('click')
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)
    expect(wrapper.get('.static-page-frame').classes()).not.toContain('static-page-frame--popup-open')
    expect(saveRunConclusions).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('names the first key field on a first-key-field line only when the key has two or more fields', async () => {
    const firstFieldTree = (): RunConclusions => ({
      ...conclusionsTree(),
      conclusions: [{
        key: '10', parent: null, conclusion: 'CONC_CANCELLED', bucket: null, question: null, outcome: null,
        conditions: [{ subject: 'FILE_2', presence: 'ABSENT', keyScope: 'FIRST_FIELD', quantifier: 'ALL', field: null, operator: null, values: [], checkLabel: 'Gone' }],
      }],
    })
    const twoFieldState = createSavedRunReopenDraftState()
    twoFieldState.draft.file1PrimaryIdExpression = ['$.orders[*].name', '$.orders[*].lineItems[*].id']
    draftStoreState.ruleSetDraftState = twoFieldState
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: firstFieldTree() })

    const twoField = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()
    expect(twoField.get('[data-testid="run-conclusions-when"]').text()).toBe('the OMS name record is missing')
    twoField.unmount()

    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    const oneField = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()
    expect(oneField.get('[data-testid="run-conclusions-when"]').text()).toBe('the OMS record is missing')
  })

  it('shows an editor an empty run\'s conclusions as None yet', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: { ...conclusionsTree(), conclusions: [] } })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="run-conclusions-empty"]').text()).toBe('None yet.')
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="run-conclusions-new"]').exists()).toBe(false)
  })

  it('shows the conclusions read-only to someone who cannot edit the run', async () => {
    permissionState.canEditTenantSettings = false
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: conclusionsTree() })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    const section = wrapper.get('[data-testid="ruleset-manager-conclusions"]')
    expect(section.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(2)
    expect(section.find('button').exists()).toBe(false)
    expect(section.find('[data-testid="run-conclusions-new"]').exists()).toBe(false)
  })

  it('leaves the conclusions out for a non-editor when they do not load', async () => {
    permissionState.canEditTenantSettings = false
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    getRunConclusions.mockRejectedValue(new ApiCallError('Not yours to read.', 403))

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-manager-conclusions"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Not yours to read.')
    expect(fact(wrapper, 'checks').sub).toBeNull()
  })

  it('gives someone who cannot edit a read-only page: plain name and facts, no pencils, no delete, and Run still works', async () => {
    permissionState.canRunActiveTenantReconciliation = true
    permissionState.canEditTenantSettings = false
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="ruleset-manager-run-name"]').attributes('contenteditable')).toBe('false')
    expect(fact(wrapper, 'pairs').cell.element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="ruleset-manager-edit-filters"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-edit-rules"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-delete-run"]').exists()).toBe(false)

    await wrapper.get('[data-testid="ruleset-manager-run-ruleset"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith(expect.objectContaining({ name: 'reconciliation-diff' }))
  })

  it('keeps the footer: back, run, previous runs and delete, in that order', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.findAll('.ruleset-manager-footer-row > *').map((action) => action.attributes('data-testid'))).toEqual([
      'back-run-editor',
      'ruleset-manager-run-ruleset',
      'ruleset-manager-view-history',
      'ruleset-manager-delete-run',
    ])
    const back = wrapper.get('[data-testid="back-run-editor"]')
    expect(back.attributes('data-to')).toBe('/settings/runs')
    expect(back.attributes('aria-label')).toBe('Back to Run Editor')
    expect(back.element.closest('.static-page-actions')).not.toBeNull()
    const runButton = wrapper.get('[data-testid="ruleset-manager-run-ruleset"]')
    expect(runButton.classes()).toEqual(expect.arrayContaining(['app-icon-action', 'app-icon-action--large']))
    expect(runButton.get('path').attributes('transform')).toBe('translate(0 1.5)')
    const deleteButton = wrapper.get('[data-testid="ruleset-manager-delete-run"]')
    expect(deleteButton.classes()).toContain('app-icon-action--danger')
    expect(deleteButton.get('path').attributes('transform')).toBe('translate(0 0.75)')
    expect(JSON.parse(wrapper.get('[data-testid="ruleset-manager-view-history"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-history',
      params: { savedRunId: 'RS_ORDER_SYNC' },
      query: { runName: 'Order Sync', file1SystemLabel: 'SHOPIFY', file2SystemLabel: 'OMS' },
    })
  })

  it('opens the reconciliation run workflow from the bottom play action', async () => {
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-run-ruleset"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({
      name: 'reconciliation-diff',
      query: { savedRunId: 'RS_ORDER_SYNC', runName: 'Order Sync', file1SystemLabel: 'SHOPIFY', file2SystemLabel: 'OMS' },
    })
  })

  it('does not offer residual actions from the manager edit surface', async () => {
    draftStoreState.ruleSetDraftState = createDraftState()

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Create Basic Diff Run')
    expect(wrapper.text()).not.toContain('Back to Run Editor')
    expect(wrapper.find('[data-testid="ruleset-manager-create"]').exists()).toBe(false)
  })

  it('still offers the way back when no other footer action is available', async () => {
    permissionState.canRunActiveTenantReconciliation = false
    permissionState.canEditTenantSettings = false
    draftStoreState.ruleSetDraftState = { draft: { ...createDraftState().draft, savedRunId: '', runName: 'Unsaved Draft' }, resumeStepId: 'ruleset-manager' }

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.findAll('.ruleset-manager-footer-row > *').map((action) => action.attributes('data-testid'))).toEqual(['back-run-editor'])
    expect(wrapper.find('[data-testid="ruleset-manager-conclusions"]').exists()).toBe(false)
    expect(getRunConclusions).not.toHaveBeenCalled()
  })

  it('shows an empty state, and still the way back, when there is no draft', async () => {
    draftStoreState.ruleSetDraftState = null

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    expect(wrapper.text()).toContain('No run basics defined yet')
    expect(wrapper.text()).toContain('Go to Run Setup')
    expect(wrapper.find('[data-testid="ruleset-manager-facts"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="ruleset-manager-filters"]').exists()).toBe(false)
    expect(wrapper.findAll('.ruleset-manager-footer-row > *').map((action) => action.attributes('data-testid'))).toEqual(['back-run-editor'])
  })

  it('deletes a saved run from the bottom trash action after confirmation', async () => {
    draftStoreState.workflowOrigin = { label: 'Run Editor', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = createSavedRunReopenDraftState()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    deleteSavedRun.mockResolvedValue({ ok: true, messages: [], errors: [], deleted: true, deletedSavedRunId: 'RS_ORDER_SYNC' })

    const wrapper = mount(ReconciliationRuleSetManagerPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-manager-delete-run"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('Delete run "Order Sync"?')
    expect(deleteSavedRun).toHaveBeenCalledWith({ savedRunId: 'RS_ORDER_SYNC' })
    expect(routerPush).toHaveBeenCalledWith('/settings/runs')

    confirmSpy.mockRestore()
  })
})
