import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const route = vi.hoisted(() => ({
  params: {
    reconciliationMappingId: 'OrderIdMap',
  },
}))
const listSchemas = vi.hoisted(() => vi.fn())
const flatten = vi.hoisted(() => vi.fn())
const getMapping = vi.hoisted(() => vi.fn())
const saveMapping = vi.hoisted(() => vi.fn())
const saveRuleSetRun = vi.hoisted(() => vi.fn())
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'editor',
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  jsonSchemaFacade: {
    list: listSchemas,
    flatten,
  },
  reconciliationFacade: {
    getMapping,
    saveMapping,
    saveRuleSetRun,
    listAutomationSourceOptions,
  },
}))

vi.mock('../../../lib/auth', () => ({
  useUiPermissions: () => permissionsShape,
}))

const permissionsShape = {
    get canEditTenantSettings() {
      return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
    },
    get canManageGlobalSettings() {
      return authState.sessionInfo.isSuperAdmin === true
    },
    get canViewTenantSettings() {
      return Boolean(authState.sessionInfo.userId)
    },
  
  get canRunActiveTenantReconciliation() {
    return ((authState.sessionInfo as Record<string, unknown>)?.canEditActiveTenantData === true ||
      (authState.sessionInfo as Record<string, unknown>)?.isSuperAdmin === true ||
      (authState.sessionInfo as Record<string, unknown>)?.canRunActiveTenantReconciliation === true)
  },
}

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsShape,
}))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null as null | { draft: unknown, resumeStepId: string | null },
  automationDraftState: null,
  setWorkflowOrigin: vi.fn(),
  clearWorkflowOrigin: vi.fn(),
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
  setAutomationDraft: vi.fn(),
  clearAutomationDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import RunsSettingsWorkflowPage from '../RunsSettingsWorkflowPage.vue'

async function chooseAppSelectOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

async function pickWorkflowSelectOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  const trigger = wrapper.get(`[data-testid="${testId}"]`)
  if (trigger.attributes('aria-expanded') !== 'true') {
    await trigger.trigger('click')
  }
  await wrapper.get(`[data-testid="workflow-select-option"][data-option-value="${value}"]`).trigger('click')
}

async function removeWorkflowSelectChip(
  wrapper: ReturnType<typeof mount>,
  rowTestId: string,
  chipIndex: number,
): Promise<void> {
  const chips = wrapper.get(`[data-testid="${rowTestId}"]`).findAll('[data-testid="workflow-select-chip"]')
  await chips[chipIndex]!.get('[data-testid="workflow-select-chip-remove"]').trigger('click')
}

describe('RunsSettingsWorkflowPage', () => {
  beforeEach(() => {
    push.mockClear()
    route.params.reconciliationMappingId = 'OrderIdMap'
    listSchemas.mockReset()
    flatten.mockReset()
    getMapping.mockReset()
    saveMapping.mockReset()
    saveRuleSetRun.mockReset()
    listAutomationSourceOptions.mockReset()
    authState.sessionInfo = {
      userId: 'editor',
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }
    draftStoreState.workflowOrigin = { label: 'Runs', path: '/settings/runs' }
    draftStoreState.ruleSetDraftState = null
    draftStoreState.automationDraftState = null
    draftStoreState.setWorkflowOrigin.mockClear()
    draftStoreState.setRuleSetDraft.mockClear()
    draftStoreState.setAutomationDraft.mockClear()
    window.history.replaceState({}, '', '/settings/runs/edit/OrderIdMap')

    listSchemas.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      schemas: [
        {
          jsonSchemaId: '100408',
          schemaName: 'Returns Feed',
          description: 'Return events exported from OMS.',
          systemEnumId: 'DarSysOms',
          systemLabel: 'OMS',
        },
        {
          jsonSchemaId: '100409',
          schemaName: 'Shopify Orders',
          description: 'Orders exported from Shopify.',
          systemEnumId: 'DarSysShopify',
          systemLabel: 'SHOPIFY',
        },
        {
          jsonSchemaId: '100411',
          schemaName: 'NetSuite Returns',
          description: 'Return events from NetSuite.',
          systemEnumId: 'DarSysNetsuite',
          systemLabel: 'NETSUITE',
        },
      ],
    })

    flatten.mockImplementation(({ jsonSchemaId }: { jsonSchemaId: string }) => {
      if (jsonSchemaId === '100408') {
        return Promise.resolve({
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.return_id', type: 'string', required: true },
            { fieldPath: '$.return_ref', type: 'string', required: false },
          ],
        })
      }

      if (jsonSchemaId === '100411') {
        return Promise.resolve({
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.return.externalId', type: 'string', required: true },
          ],
        })
      }

      return Promise.resolve({
        ok: true,
        messages: [],
        errors: [],
        fieldList: [
          { fieldPath: '$.id', type: 'string', required: true },
          { fieldPath: '$.legacyResourceId', type: 'string', required: false },
        ],
      })
    })

    getMapping.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      mapping: {
        reconciliationMappingId: 'OrderIdMap',
        mappingName: 'Order ID',
        members: [
          {
            mappingMemberId: 'OrderIdMap-1',
            systemEnumId: 'DarSysOms',
            systemLabel: 'OMS',
            jsonSchemaId: '100408',
            schemaName: 'Returns Feed',
            fieldPath: '$.return_id',
          },
          {
            mappingMemberId: 'OrderIdMap-2',
            systemEnumId: 'DarSysShopify',
            systemLabel: 'SHOPIFY',
            jsonSchemaId: '100409',
            schemaName: 'Shopify Orders',
            fieldPath: '$.id',
          },
        ],
      },
    })

    saveMapping.mockResolvedValue({
      ok: true,
      messages: ['Saved run Order Returns.'],
      errors: [],
      savedMapping: {
        reconciliationMappingId: 'OrderIdMap',
        mappingName: 'Order Returns',
        file1SystemEnumId: 'DarSysOms',
        file2SystemEnumId: 'DarSysNetsuite',
        file1SchemaName: 'Returns Feed',
        file2SchemaName: 'NetSuite Returns',
        file1FieldPath: '$.return_ref',
        file2FieldPath: '$.return.externalId',
      },
    })

    saveRuleSetRun.mockResolvedValue({
      ok: true,
      messages: ['Saved RuleSet run Order Sync Revised.'],
      errors: [],
      savedRun: {
        savedRunId: 'RS_ORDER_SYNC',
        runName: 'Order Sync Revised',
        description: 'Compares orders across systems.',
        runType: 'ruleset',
        ruleSetId: 'RS_ORDER_SYNC',
        compareScopeId: 'RS_ORDER_SYNC_SCOPE',
        requiresSystemSelection: false,
        defaultFile1SystemEnumId: 'DarSysOms',
        defaultFile2SystemEnumId: 'DarSysShopify',
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
      fileTypes: [],
      systems: [],
      savedRuns: [],
      sftpServers: [],
      sourceConfigs: [
        {
          sourceConfigId: 'KREWE_OMS',
          sourceConfigType: 'HOTWAX_OMS_REST',
          label: 'Krewe OMS',
          systemEnumId: 'OMS',
        },
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
          systemMessageRemoteId: 'HOTWAX_RETURNS_API',
          description: 'Returns API',
          label: 'Returns API',
          systemEnumId: 'OMS',
          optionKey: 'KREWE_OMS',
          sourceConfigId: 'KREWE_OMS',
          sourceConfigType: 'HOTWAX_OMS_REST',
          primaryIdOptions: [
            { fieldPath: '$.records[*].returnId', label: 'Return ID' },
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

  it('loads an editable two-source run form and saves back to the runs settings page', async () => {
    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    expect(wrapper.find('.workflow-page').exists()).toBe(true)
    expect(wrapper.find('.wizard-question-shell').classes()).toContain('workflow-form--compact')
    expect(wrapper.find('.wizard-question-shell').classes()).toContain('workflow-form--edit-single-page')
    expect(wrapper.find('input[name="mappingName"]').element).toHaveProperty('value', 'Order ID')
    expect(wrapper.text()).not.toContain('Source 1 system:')
    expect(wrapper.text()).not.toContain('Source 2 system:')
    expect(getMapping).toHaveBeenCalledWith({ reconciliationMappingId: 'OrderIdMap' }, expect.any(AbortSignal))
    expect(flatten).toHaveBeenCalledWith({ jsonSchemaId: '100408' }, expect.any(AbortSignal))
    expect(flatten).toHaveBeenCalledWith({ jsonSchemaId: '100409' }, expect.any(AbortSignal))

    await wrapper.find('input[name="mappingName"]').setValue('Order Returns')
    await removeWorkflowSelectChip(wrapper, 'run-source-1-row', 0)
    await pickWorkflowSelectOption(wrapper, 'run-field-1', '$.return_ref')
    await chooseAppSelectOption(wrapper, 'run-schema-2', '100411')
    await flushPromises()
    await pickWorkflowSelectOption(wrapper, 'run-field-2', '$.return.externalId')
    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()

    expect(saveMapping).toHaveBeenCalledWith({
      reconciliationMappingId: 'OrderIdMap',
      mappingName: 'Order Returns',
      schema1Id: '100408',
      schema2Id: '100411',
      schema1FieldPath: '$.return_ref',
      schema2FieldPath: '$.return.externalId',
    })
    expect(push).toHaveBeenCalledWith('/settings/runs')
  })

  it('blocks saving a legacy mapping run with more than one primary ID field per source', async () => {
    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    await pickWorkflowSelectOption(wrapper, 'run-field-1', '$.return_ref')
    await flushPromises()

    expect(wrapper.get('[data-testid="run-source-1-row"]').findAll('[data-testid="workflow-select-chip"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Source 1 supports a single ID field.')

    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()
    expect(saveMapping).not.toHaveBeenCalled()

    await removeWorkflowSelectChip(wrapper, 'run-source-1-row', 1)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Source 1 supports a single ID field.')

    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()
    expect(saveMapping).toHaveBeenCalledWith({
      reconciliationMappingId: 'OrderIdMap',
      mappingName: 'Order ID',
      schema1Id: '100408',
      schema2Id: '100409',
      schema1FieldPath: '$.return_id',
      schema2FieldPath: '$.id',
    })
  })

  it('preselects stored source fields when the saved mapping uses legacy field expressions', async () => {
    getMapping.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      mapping: {
        reconciliationMappingId: 'OrderIdMap',
        mappingName: 'Order ID',
        members: [
          {
            mappingMemberId: 'OrderIdMap-1',
            systemEnumId: 'DarSysOms',
            systemLabel: 'OMS',
            jsonSchemaId: '100408',
            schemaName: 'Returns Feed',
            fieldPath: 'return_id',
          },
          {
            mappingMemberId: 'OrderIdMap-2',
            systemEnumId: 'DarSysShopify',
            systemLabel: 'SHOPIFY',
            jsonSchemaId: '100409',
            schemaName: 'Shopify Orders',
            fieldPath: 'id',
          },
        ],
      },
    })

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    const source1Chips = wrapper.get('[data-testid="run-source-1-row"]').findAll('[data-testid="workflow-select-chip"]')
    const source2Chips = wrapper.get('[data-testid="run-source-2-row"]').findAll('[data-testid="workflow-select-chip"]')
    expect(source1Chips).toHaveLength(1)
    expect(source1Chips[0]!.text()).toContain('$.return_id')
    expect(source2Chips).toHaveLength(1)
    expect(source2Chips[0]!.text()).toContain('$.id')
  })

  it('loads a ruleset run draft and saves non-rule settings back to the run details page', async () => {
    route.params.reconciliationMappingId = 'RS_ORDER_SYNC'
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.ruleSetDraftState = {
      draft: {
        savedRunId: 'RS_ORDER_SYNC',
        runName: 'Order Sync',
        description: 'Compares orders across systems.',
        file1SystemEnumId: 'DarSysOms',
        file1SystemLabel: 'OMS',
        file1FileTypeEnumId: 'DftJson',
        file1JsonSchemaId: '100408',
        file1SchemaFileName: 'Returns Feed',
        file1PrimaryIdExpression: ['$.return_id'],
        file2SystemEnumId: 'DarSysShopify',
        file2SystemLabel: 'SHOPIFY',
        file2FileTypeEnumId: 'DftJson',
        file2JsonSchemaId: '100409',
        file2SchemaFileName: 'Shopify Orders',
        file2PrimaryIdExpression: ['$.id'],
      },
      resumeStepId: 'ruleset-manager',
    }
    window.history.replaceState({}, '', '/settings/runs/edit/RS_ORDER_SYNC')

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    expect(getMapping).not.toHaveBeenCalled()
    expect(wrapper.find('input[name="mappingName"]').element).toHaveProperty('value', 'Order Sync')
    expect(wrapper.text()).not.toContain('Rules')

    await wrapper.find('input[name="mappingName"]').setValue('Order Sync Revised')
    await removeWorkflowSelectChip(wrapper, 'run-source-1-row', 0)
    await pickWorkflowSelectOption(wrapper, 'run-field-1', '$.return_ref')
    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()

    expect(saveRuleSetRun).toHaveBeenCalledWith({
      savedRunId: 'RS_ORDER_SYNC',
      runName: 'Order Sync Revised',
      description: 'Compares orders across systems.',
      file1SystemEnumId: 'DarSysOms',
      file1FileTypeEnumId: 'DftJson',
      file1SchemaFileName: 'Returns Feed',
      file1PrimaryIdExpression: '$.return_ref',
      file2SystemEnumId: 'DarSysShopify',
      file2FileTypeEnumId: 'DftJson',
      file2SchemaFileName: 'Shopify Orders',
      file2PrimaryIdExpression: '$.id',
    })
    expect(saveMapping).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-manager' })
  })

  it('edits API run configuration with API config, endpoint, and primary ID controls', async () => {
    route.params.reconciliationMappingId = 'RS_API_ORDER_SYNC'
    saveRuleSetRun.mockResolvedValueOnce({
      ok: true,
      messages: ['Saved RuleSet run API Order Sync.'],
      errors: [],
      savedRun: {
        savedRunId: 'RS_API_ORDER_SYNC',
        runName: 'API Order Sync',
        description: 'API order comparison.',
        runType: 'ruleset',
      },
    })
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.ruleSetDraftState = {
      draft: {
        savedRunId: 'RS_API_ORDER_SYNC',
        runName: 'API Order Sync',
        description: 'API order comparison.',
        file1SystemEnumId: 'OMS',
        file1SystemLabel: 'HotWax',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
        file1SourceConfigId: 'KREWE_OMS',
        file1SourceConfigType: 'HOTWAX_OMS_REST',
        file1FileTypeEnumId: '',
        file1PrimaryIdExpression: ['$.records[*].orderId'],
        file2SystemEnumId: 'SHOPIFY',
        file2SystemLabel: 'SHOPIFY',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SystemMessageRemoteId: 'SHOPIFY_REMOTE',
        file2SourceConfigId: 'SHOPIFY_MAIN',
        file2SourceConfigType: 'SHOPIFY_AUTH',
        file2FileTypeEnumId: '',
        file2PrimaryIdExpression: ['$.records[*].id'],
      },
      resumeStepId: 'ruleset-manager',
    }
    window.history.replaceState({}, '', '/settings/runs/edit/RS_API_ORDER_SYNC')

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    expect(getMapping).not.toHaveBeenCalled()
    expect(listAutomationSourceOptions).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Source 1 API Config')
    expect(wrapper.text()).toContain('Source 1 Endpoint')
    expect(wrapper.text()).toContain('Source 1 Primary ID')
    expect(wrapper.text()).toContain('Source 2 API Config')
    expect(wrapper.text()).toContain('Source 2 Endpoint')
    expect(wrapper.text()).toContain('Source 2 Primary ID')
    expect(wrapper.find('[data-testid="run-schema-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-schema-2"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="run-api-config-1"]').text()).toContain('Krewe OMS')
    expect(wrapper.get('[data-testid="run-api-endpoint-1"]').text()).toContain('Orders API')
    expect(wrapper.get('[data-testid="run-source-1-row"]').findAll('[data-testid="workflow-select-chip"]')[0]!.text()).toContain('Order ID')
    expect(wrapper.get('[data-testid="run-api-config-2"]').text()).toContain('Krewe Shopify')
    expect(wrapper.get('[data-testid="run-api-endpoint-2"]').text()).toContain('Orders')
    expect(wrapper.get('[data-testid="run-source-2-row"]').findAll('[data-testid="workflow-select-chip"]')[0]!.text()).toContain('Order ID')

    await chooseAppSelectOption(wrapper, 'run-api-endpoint-1', 'remote:HOTWAX_RETURNS_API:KREWE_OMS')
    await flushPromises()
    await pickWorkflowSelectOption(wrapper, 'run-api-field-1', '$.records[*].returnId')
    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()

    expect(saveRuleSetRun).toHaveBeenCalledWith({
      savedRunId: 'RS_API_ORDER_SYNC',
      runName: 'API Order Sync',
      description: 'API order comparison.',
      file1SystemEnumId: 'OMS',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'HOTWAX_RETURNS_API',
      file1SourceConfigId: 'KREWE_OMS',
      file1SourceConfigType: 'HOTWAX_OMS_REST',
      file1PrimaryIdExpression: '$.records[*].returnId',
      file2SystemEnumId: 'SHOPIFY',
      file2SourceTypeEnumId: 'AUT_SRC_API',
      file2SystemMessageRemoteId: 'SHOPIFY_REMOTE',
      file2SourceConfigId: 'SHOPIFY_MAIN',
      file2SourceConfigType: 'SHOPIFY_AUTH',
      file2PrimaryIdExpression: '$.records[*].id',
    })
    expect(saveMapping).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-manager' })
  })

  it('uses the schema label for the selected schema text instead of internal identifiers', async () => {
    listSchemas.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      schemas: [
        {
          jsonSchemaId: '100408',
          schemaName: 'gorjana_oms_order',
          description: 'Gorjana OMS Order',
          systemEnumId: 'DarSysOms',
          systemLabel: 'OMS',
        },
        {
          jsonSchemaId: '100409',
          schemaName: 'gorjana_shopify_order',
          description: 'Gorjana Shopify Orders',
          systemEnumId: 'DarSysShopify',
          systemLabel: 'SHOPIFY',
        },
      ],
    })
    getMapping.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      mapping: {
        reconciliationMappingId: 'OrderIdMap',
        mappingName: 'Order ID',
        members: [
          {
            mappingMemberId: 'OrderIdMap-1',
            systemEnumId: 'DarSysOms',
            systemLabel: 'OMS',
            jsonSchemaId: '100408',
            schemaName: 'gorjana_oms_order',
            fieldPath: '$.return_id',
          },
          {
            mappingMemberId: 'OrderIdMap-2',
            systemEnumId: 'DarSysShopify',
            systemLabel: 'SHOPIFY',
            jsonSchemaId: '100409',
            schemaName: 'gorjana_shopify_order',
            fieldPath: '$.id',
          },
        ],
      },
    })

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="run-schema-1"]').text()).toContain('Gorjana OMS Order - OMS')
    expect(wrapper.get('[data-testid="run-schema-2"]').text()).toContain('Gorjana Shopify Orders - SHOPIFY')
    expect(wrapper.get('[data-testid="run-schema-1"]').text()).not.toContain('gorjana_oms_order')
    expect(wrapper.get('[data-testid="run-schema-2"]').text()).not.toContain('gorjana_shopify_order')
    expect(wrapper.text()).not.toContain('100408')
    expect(wrapper.text()).not.toContain('100409')
  })

  it('edits a composite primary key as removable chips and round-trips the plural payload field', async () => {
    route.params.reconciliationMappingId = 'RS_COMPOSITE_SYNC'
    flatten.mockImplementation(({ jsonSchemaId }: { jsonSchemaId: string }) => {
      if (jsonSchemaId === '100408') {
        return Promise.resolve({
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.return_id', type: 'string', required: true },
            { fieldPath: '$.product_id', type: 'string', required: true },
            { fieldPath: '$.return_ref', type: 'string', required: false },
          ],
        })
      }
      return Promise.resolve({
        ok: true,
        messages: [],
        errors: [],
        fieldList: [{ fieldPath: '$.id', type: 'string', required: true }],
      })
    })
    saveRuleSetRun.mockResolvedValueOnce({
      ok: true,
      messages: ['Saved RuleSet run Composite Sync.'],
      errors: [],
      savedRun: {
        savedRunId: 'RS_COMPOSITE_SYNC',
        runName: 'Composite Sync',
        description: 'Composite key run.',
        runType: 'ruleset',
      },
    })
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.ruleSetDraftState = {
      draft: {
        savedRunId: 'RS_COMPOSITE_SYNC',
        runName: 'Composite Sync',
        description: 'Composite key run.',
        file1SystemEnumId: 'DarSysOms',
        file1SystemLabel: 'OMS',
        file1FileTypeEnumId: 'DftJson',
        file1JsonSchemaId: '100408',
        file1SchemaFileName: 'Returns Feed',
        file1PrimaryIdExpression: ['return_id', 'product_id'],
        file2SystemEnumId: 'DarSysShopify',
        file2SystemLabel: 'SHOPIFY',
        file2FileTypeEnumId: 'DftJson',
        file2JsonSchemaId: '100409',
        file2SchemaFileName: 'Shopify Orders',
        file2PrimaryIdExpression: ['$.id'],
      },
      resumeStepId: 'ruleset-manager',
    }
    window.history.replaceState({}, '', '/settings/runs/edit/RS_COMPOSITE_SYNC')

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    const source1Chips = () => wrapper.get('[data-testid="run-source-1-row"]').findAll('[data-testid="workflow-select-chip"]')

    expect(source1Chips()).toHaveLength(2)
    expect(source1Chips()[0]!.text()).toContain('$.return_id')
    expect(source1Chips()[1]!.text()).toContain('$.product_id')

    await pickWorkflowSelectOption(wrapper, 'run-field-1', '$.return_ref')
    expect(source1Chips()).toHaveLength(3)
    expect(source1Chips()[2]!.text()).toContain('$.return_ref')

    await removeWorkflowSelectChip(wrapper, 'run-source-1-row', 2)
    expect(source1Chips()).toHaveLength(2)
    expect(source1Chips()[0]!.text()).toContain('$.return_id')
    expect(source1Chips()[1]!.text()).toContain('$.product_id')

    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()

    expect(saveRuleSetRun).toHaveBeenCalledTimes(1)
    const savedPayload = saveRuleSetRun.mock.calls[0]![0] as Record<string, unknown>
    expect(savedPayload.file1PrimaryIdExpressions).toEqual(['$.return_id', '$.product_id'])
    expect(savedPayload.file1PrimaryIdExpression).toBeUndefined()
    expect(savedPayload.file2PrimaryIdExpression).toBe('$.id')
    expect(savedPayload.file2PrimaryIdExpressions).toBeUndefined()
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-manager' })
  })

  it('uses the shared app select controls and no page-local scoped styles', () => {
    const source = readFileSync('src/pages/settings/RunsSettingsWorkflowPage.vue', 'utf8')

    expect(source).toContain('<WorkflowStepForm')
    expect(source).toContain("<AppSelect")
    expect(source).toContain("'workflow-form--compact'")
    expect(source).toContain("'workflow-form--edit-single-page'")
    expect(source).not.toContain('<select')
    expect(source).not.toContain('<style scoped>')
  })
})
