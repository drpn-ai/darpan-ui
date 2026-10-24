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
        // Endpoint sibling that SHARES the parent's remote id and source config -- exactly how
        // SHOPIFY_RETURN_REFS is seeded (SourceSystemConnectorSeedData.xml). Listed AFTER the
        // parent on purpose: a lookup keyed on remoteId + sourceConfigId alone returns the parent,
        // which is the defect the endpoint-scoped test below pins.
        {
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          description: 'Shopify Return References',
          label: 'Shopify Return References',
          systemEnumId: 'SHOPIFY_RETURN_REFS',
          optionKey: 'SHOPIFY_MAIN',
          sourceConfigId: 'SHOPIFY_MAIN',
          sourceConfigType: 'SHOPIFY_RETURN_REFS_API',
          primaryIdOptions: [
            { fieldPath: '$.records[*].refundOrReturnId', label: 'Refund ID / Return ID' },
            { fieldPath: '$.records[*].orderId', label: 'Order ID' },
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
    expect(wrapper.text()).toContain('HotWax supports a single ID field.')

    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()
    expect(saveMapping).not.toHaveBeenCalled()

    await removeWorkflowSelectChip(wrapper, 'run-source-1-row', 1)
    await flushPromises()
    expect(wrapper.text()).not.toContain('HotWax supports a single ID field.')

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
    // DAR-UI-053: each side is named by the system it reads, never "Source 1" / "Source 2".
    expect(wrapper.text()).toContain('HotWax API Config')
    expect(wrapper.text()).toContain('HotWax Endpoint')
    expect(wrapper.text()).toContain('HotWax Primary ID')
    expect(wrapper.text()).toContain('Shopify API Config')
    expect(wrapper.text()).toContain('Shopify Endpoint')
    expect(wrapper.text()).toContain('Shopify Primary ID')
    expect(wrapper.text()).not.toMatch(/source [12]/i)
    expect(wrapper.find('[data-testid="run-schema-1"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-schema-2"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="run-api-config-1"]').text()).toContain('Krewe OMS')
    expect(wrapper.get('[data-testid="run-api-endpoint-1"]').text()).toContain('Orders API')
    expect(wrapper.get('[data-testid="run-source-1-row"]').findAll('[data-testid="workflow-select-chip"]')[0]!.text()).toContain('Order ID')
    expect(wrapper.get('[data-testid="run-api-config-2"]').text()).toContain('Krewe Shopify')
    expect(wrapper.get('[data-testid="run-api-endpoint-2"]').text()).toContain('Orders')
    expect(wrapper.get('[data-testid="run-source-2-row"]').findAll('[data-testid="workflow-select-chip"]')[0]!.text()).toContain('Order ID')

    await chooseAppSelectOption(wrapper, 'run-api-endpoint-1', 'remote:HOTWAX_RETURNS_API:KREWE_OMS:OMS')
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

  // The manager page's System card reads file{n}SystemParentLabel; nothing in this form can derive
  // it (an API source has no schema row, and a schema row has no parent concept), so the draft this
  // workflow hands back must carry the value it opened with. Dropping it silently reverted that card
  // to the ENDPOINT name after any edit -- "Shopify Order Return References" where the operator
  // expects "Shopify".
  // Live defect (2026-08-18 "Returns Prod" edit): the Primary ID dropdown for a SHOPIFY_RETURN_REFS
  // side offered Shopify's ORDER fields and no refundOrReturnId at all, so the run could not be
  // re-pointed after the extractor rename. systemMessageRemoteId is SHARED across a system family,
  // so a lookup keyed on remoteId + sourceConfigId resolved the PARENT's option row and served its
  // pills. The lookup must be scoped by the side's own systemEnumId.
  it('offers the selected endpoint\'s primary ID fields, not the parent system\'s', async () => {
    route.params.reconciliationMappingId = 'RS_RETURNS_PROD'
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.ruleSetDraftState = {
      draft: {
        savedRunId: 'RS_RETURNS_PROD',
        runName: 'Returns Prod',
        file1SystemEnumId: 'SHOPIFY_RETURN_REFS',
        file1SystemLabel: 'Shopify Order Return References',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SystemMessageRemoteId: 'SHOPIFY_REMOTE',
        file1SourceConfigId: 'SHOPIFY_MAIN',
        file1SourceConfigType: 'SHOPIFY_RETURN_REFS_API',
        file1FileTypeEnumId: '',
        file1PrimaryIdExpression: [],
        file2SystemEnumId: 'OMS',
        file2SystemLabel: 'HotWax',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
        file2SourceConfigId: 'KREWE_OMS',
        file2SourceConfigType: 'HOTWAX_OMS_REST',
        file2FileTypeEnumId: '',
        file2PrimaryIdExpression: ['$.records[*].orderId'],
      },
      resumeStepId: 'ruleset-manager',
    }
    window.history.replaceState({}, '', '/settings/runs/edit/RS_RETURNS_PROD')

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="run-api-field-1"]').trigger('click')
    const optionValues = wrapper.findAll('[data-testid="workflow-select-option"]')
      .map((option) => option.attributes('data-option-value'))

    expect(optionValues).toContain('$.records[*].refundOrReturnId')
    // The parent's own order key must not leak in from SHOPIFY_REMOTE's other row.
    expect(optionValues).not.toContain('$.records[*].id')
  })

  it('carries the system parent label through an edit', async () => {
    route.params.reconciliationMappingId = 'RS_RETURNS_PROD'
    saveRuleSetRun.mockResolvedValueOnce({
      ok: true,
      messages: ['Saved RuleSet run Returns Prod.'],
      errors: [],
      savedRun: { savedRunId: 'RS_RETURNS_PROD', runName: 'Returns Prod', runType: 'ruleset' },
    })
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.ruleSetDraftState = {
      draft: {
        savedRunId: 'RS_RETURNS_PROD',
        runName: 'Returns Prod',
        file1SystemEnumId: 'OMS',
        file1SystemLabel: 'HotWax Returns (Reconciliation API)',
        file1SystemParentLabel: 'HotWax',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
        file1SourceConfigId: 'KREWE_OMS',
        file1SourceConfigType: 'HOTWAX_OMS_REST',
        file1FileTypeEnumId: '',
        file1PrimaryIdExpression: ['$.records[*].orderId'],
        file2SystemEnumId: 'SHOPIFY',
        file2SystemLabel: 'Shopify Order Return References',
        file2SystemParentLabel: 'Shopify',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SystemMessageRemoteId: 'SHOPIFY_REMOTE',
        file2SourceConfigId: 'SHOPIFY_MAIN',
        file2SourceConfigType: 'SHOPIFY_AUTH',
        file2FileTypeEnumId: '',
        file2PrimaryIdExpression: ['$.records[*].id'],
      },
      resumeStepId: 'ruleset-manager',
    }
    window.history.replaceState({}, '', '/settings/runs/edit/RS_RETURNS_PROD')

    const wrapper = mount(RunsSettingsWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
    await flushPromises()

    expect(draftStoreState.setRuleSetDraft).toHaveBeenCalled()
    const handedBack = draftStoreState.setRuleSetDraft.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(handedBack.file1SystemParentLabel).toBe('HotWax')
    expect(handedBack.file2SystemParentLabel).toBe('Shopify')
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

  describe('DAR-UI-064 NetSuite SuiteQL sides', () => {
    const suiteQlSourceOptions = {
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
          sourceConfigId: 'NS_INVOICE_ETAIL',
          sourceConfigType: 'NETSUITE_SUITEQL',
          label: 'Invoices - Etail with a long query description that must truncate',
          systemEnumId: 'NETSUITE_SUITEQL',
          primaryIdOptions: [
            { fieldPath: '$.records[*].tranId', label: 'tranId' },
            { fieldPath: '$.records[*].entity', label: 'entity' },
          ],
        },
        {
          sourceConfigId: 'NS_WARRANTY_CLAIMS',
          sourceConfigType: 'NETSUITE_SUITEQL',
          label: 'Warranty claims',
          systemEnumId: 'NETSUITE_SUITEQL',
          primaryIdOptions: [{ fieldPath: '$.records[*].claimId', label: 'claimId' }],
        },
        {
          sourceConfigId: 'NS_CREDIT_MEMOS',
          sourceConfigType: 'NETSUITE_SUITEQL',
          label: 'Credit memos',
          systemEnumId: 'NETSUITE_SUITEQL',
          primaryIdOptions: [{ fieldPath: '$.records[*].createdFrom', label: 'createdFrom' }],
        },
      ],
      nsRestletConfigs: [],
      systemRemotes: [],
    }
    const storedFilters = [{ fieldExpression: '$.records[*].status', operator: 'in', values: ['Voided'] }]

    function suiteQlSide(side: 'file1' | 'file2', queryId: string, key: string) {
      return {
        [`${side}SystemEnumId`]: 'NETSUITE_SUITEQL',
        [`${side}SystemLabel`]: 'NetSuite',
        [`${side}SourceTypeEnumId`]: 'AUT_SRC_API',
        [`${side}SourceConfigId`]: queryId,
        [`${side}SourceConfigType`]: 'NETSUITE_SUITEQL',
        [`${side}FileTypeEnumId`]: 'DftJson',
        [`${side}PrimaryIdExpression`]: [key],
      }
    }

    beforeEach(() => {
      listAutomationSourceOptions.mockResolvedValue(suiteQlSourceOptions)
      draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    })

    it('edits a one-system SuiteQL run with no endpoint and no second side', async () => {
      route.params.reconciliationMappingId = 'RS_INVOICE_ETAIL'
      saveRuleSetRun.mockResolvedValueOnce({
        ok: true,
        messages: ['Saved.'],
        errors: [],
        savedRun: { savedRunId: 'RS_INVOICE_ETAIL', runName: 'Invoices - Etail key', runType: 'ruleset' },
      })
      draftStoreState.ruleSetDraftState = {
        draft: {
          savedRunId: 'RS_INVOICE_ETAIL',
          scopeMode: 'EVALUATE',
          runName: 'Invoices - Etail id',
          description: 'Etail invoices with no shipment.',
          ...suiteQlSide('file1', 'NS_INVOICE_ETAIL', '$.records[*].tranId'),
          file2SystemEnumId: '',
          file2FileTypeEnumId: '',
          file2PrimaryIdExpression: [],
          file1ExcludeFilters: storedFilters,
          rules: [],
        },
        resumeStepId: 'ruleset-manager',
      }
      window.history.replaceState({}, '', '/settings/runs/edit/RS_INVOICE_ETAIL')

      const wrapper = mount(RunsSettingsWorkflowPage)
      await flushPromises()

      // The stored name, not the description.
      expect((wrapper.get('input[name="mappingName"]').element as HTMLInputElement).value).toBe('Invoices - Etail id')
      expect(wrapper.text()).not.toContain('needs an API endpoint')
      expect(wrapper.find('[data-testid="run-api-endpoint-1"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="run-source-2-row"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="run-schema-2"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="run-api-field-1"]').attributes('disabled')).toBeUndefined()

      await wrapper.get('[data-testid="run-api-field-1"]').trigger('click')
      const optionValues = wrapper.findAll('[data-testid="workflow-select-option"]')
        .map((option) => option.attributes('data-option-value'))
      expect(optionValues).toEqual(['$.records[*].tranId', '$.records[*].entity'])

      await wrapper.get('input[name="mappingName"]').setValue('Invoices - Etail key')
      expect(wrapper.get('[data-testid="save-run-settings"]').attributes('disabled')).toBeUndefined()
      await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
      await flushPromises()

      const payload = saveRuleSetRun.mock.calls[0]![0] as Record<string, unknown>
      expect(payload).toEqual({
        savedRunId: 'RS_INVOICE_ETAIL',
        runName: 'Invoices - Etail key',
        description: 'Etail invoices with no shipment.',
        file1SystemEnumId: 'NETSUITE_SUITEQL',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SourceConfigId: 'NS_INVOICE_ETAIL',
        file1SourceConfigType: 'NETSUITE_SUITEQL',
        file1PrimaryIdExpression: '$.records[*].tranId',
      })
      expect(Object.keys(payload).filter((key) => key.startsWith('file2'))).toEqual([])
      // Omitted, so the stored filters and rules stay as they are.
      expect(payload).not.toHaveProperty('file1ExcludeFilters')
      expect(payload).not.toHaveProperty('rules')

      const handedBack = draftStoreState.setRuleSetDraft.mock.calls[0]![0] as Record<string, unknown>
      expect(handedBack.scopeMode).toBe('EVALUATE')
      expect(handedBack.file1ExcludeFilters).toEqual(storedFilters)
      expect(handedBack.file2SystemEnumId).toBe('')
      expect(push).toHaveBeenCalledWith({ name: 'reconciliation-ruleset-manager' })
    })

    // A seed-loaded run stores its key bare ("tranId"); the query offers $.records[*].<field>. The bare key names no root
    // to narrow by, so the picker keeps its options (it emptied and disabled itself).
    it('keeps the key picker usable when the stored key is bare', async () => {
      route.params.reconciliationMappingId = 'RS_INVOICE_ETAIL'
      draftStoreState.ruleSetDraftState = {
        draft: {
          savedRunId: 'RS_INVOICE_ETAIL',
          scopeMode: 'EVALUATE',
          runName: 'Invoices - Etail id',
          ...suiteQlSide('file1', 'NS_INVOICE_ETAIL', 'tranId'),
          file2SystemEnumId: '',
          file2FileTypeEnumId: '',
          file2PrimaryIdExpression: [],
          rules: [],
        },
        resumeStepId: 'ruleset-manager',
      }
      window.history.replaceState({}, '', '/settings/runs/edit/RS_INVOICE_ETAIL')

      const wrapper = mount(RunsSettingsWorkflowPage)
      await flushPromises()

      expect(wrapper.get('[data-testid="run-api-field-1"]').attributes('disabled')).toBeUndefined()
    })

    it('saves a two-system run with SuiteQL on both sides of the same system', async () => {
      route.params.reconciliationMappingId = 'RS_CLAIMS_VS_MEMOS'
      draftStoreState.ruleSetDraftState = {
        draft: {
          savedRunId: 'RS_CLAIMS_VS_MEMOS',
          runName: 'Claims vs memos',
          ...suiteQlSide('file1', 'NS_WARRANTY_CLAIMS', '$.records[*].claimId'),
          ...suiteQlSide('file2', 'NS_CREDIT_MEMOS', '$.records[*].createdFrom'),
        },
        resumeStepId: 'ruleset-manager',
      }
      window.history.replaceState({}, '', '/settings/runs/edit/RS_CLAIMS_VS_MEMOS')

      const wrapper = mount(RunsSettingsWorkflowPage)
      await flushPromises()

      expect(wrapper.find('[data-testid="run-api-endpoint-1"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="run-api-endpoint-2"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('same system')

      await wrapper.get('input[name="mappingName"]').setValue('Claims vs credit memos')
      await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
      await flushPromises()

      expect(saveRuleSetRun).toHaveBeenCalledWith({
        savedRunId: 'RS_CLAIMS_VS_MEMOS',
        runName: 'Claims vs credit memos',
        description: undefined,
        file1SystemEnumId: 'NETSUITE_SUITEQL',
        file1SourceTypeEnumId: 'AUT_SRC_API',
        file1SourceConfigId: 'NS_WARRANTY_CLAIMS',
        file1SourceConfigType: 'NETSUITE_SUITEQL',
        file1PrimaryIdExpression: '$.records[*].claimId',
        file2SystemEnumId: 'NETSUITE_SUITEQL',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SourceConfigId: 'NS_CREDIT_MEMOS',
        file2SourceConfigType: 'NETSUITE_SUITEQL',
        file2PrimaryIdExpression: '$.records[*].createdFrom',
      })
    })

    it('still refuses the very same SuiteQL query on both sides', async () => {
      route.params.reconciliationMappingId = 'RS_SAME_QUERY'
      draftStoreState.ruleSetDraftState = {
        draft: {
          savedRunId: 'RS_SAME_QUERY',
          runName: 'Same query',
          ...suiteQlSide('file1', 'NS_CREDIT_MEMOS', '$.records[*].createdFrom'),
          ...suiteQlSide('file2', 'NS_CREDIT_MEMOS', '$.records[*].createdFrom'),
        },
        resumeStepId: 'ruleset-manager',
      }

      const wrapper = mount(RunsSettingsWorkflowPage)
      await flushPromises()

      expect(wrapper.text()).toContain('Both sides use the same system.')
      expect(wrapper.get('[data-testid="save-run-settings"]').attributes('disabled')).toBeDefined()
    })

    it('keeps the endpoint control and its requirement on a RESTlet/remote side', async () => {
      listAutomationSourceOptions.mockResolvedValue({
        ...suiteQlSourceOptions,
        sourceConfigs: [
          ...suiteQlSourceOptions.sourceConfigs,
          { sourceConfigId: 'KREWE_OMS', sourceConfigType: 'HOTWAX_OMS_REST', label: 'Krewe OMS', systemEnumId: 'OMS' },
        ],
      })
      route.params.reconciliationMappingId = 'RS_OMS_NO_ENDPOINT'
      draftStoreState.ruleSetDraftState = {
        draft: {
          savedRunId: 'RS_OMS_NO_ENDPOINT',
          runName: 'OMS vs claims',
          file1SystemEnumId: 'OMS',
          file1SystemLabel: 'HotWax',
          file1SourceTypeEnumId: 'AUT_SRC_API',
          file1SourceConfigId: 'KREWE_OMS',
          file1SourceConfigType: 'HOTWAX_OMS_REST',
          file1FileTypeEnumId: '',
          file1PrimaryIdExpression: ['$.records[*].orderId'],
          ...suiteQlSide('file2', 'NS_WARRANTY_CLAIMS', '$.records[*].claimId'),
        },
        resumeStepId: 'ruleset-manager',
      }

      const wrapper = mount(RunsSettingsWorkflowPage)
      await flushPromises()

      expect(wrapper.find('[data-testid="run-api-endpoint-1"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="run-api-endpoint-2"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('HotWax needs an API endpoint.')
      expect(wrapper.get('[data-testid="save-run-settings"]').attributes('disabled')).toBeDefined()
    })
  })

  // DAR-UI-077. gorjana "Orders" (HotWax "Sales orders") could not move to "HotWax orders and payments": the endpoint
  // list held only the side's stored endpoint, and a pick never changed the side's system or config type.
  describe('DAR-UI-077 endpoints across the system family', () => {
    const paymentsRow = {
      // OMS_GQL is a connector with no SystemMessageRemote of its own.
      description: 'HotWax orders and payments',
      label: 'HotWax orders and payments',
      systemEnumId: 'OMS_GQL',
      optionKey: 'KREWE_OMS',
      sourceConfigId: 'KREWE_OMS',
      sourceConfigType: 'HOTWAX_OMS_GQL',
      primaryIdOptions: [{ fieldPath: '$.records[*].externalId', label: 'Shopify order ID' }],
    }
    const salesOrdersRow = {
      systemMessageRemoteId: 'HOTWAX_ORDERS_API',
      description: 'HotWax sales orders',
      label: 'HotWax sales orders',
      systemEnumId: 'OMS_RECON_ORDERS',
      optionKey: 'KREWE_OMS',
      sourceConfigId: 'KREWE_OMS',
      sourceConfigType: 'HOTWAX_OMS_REST',
      primaryIdOptions: [{ fieldPath: '$.records[*].externalId', label: 'Shopify order ID' }],
    }

    async function mountSalesOrdersRun(file2Extras: Record<string, unknown> = {}) {
      const base = await listAutomationSourceOptions()
      listAutomationSourceOptions.mockResolvedValue({
        ...base,
        systems: [
          { enumId: 'OMS', label: 'HotWax' },
          { enumId: 'OMS_RECON_ORDERS', label: 'HotWax sales orders', parentEnumId: 'OMS' },
          { enumId: 'OMS_GQL', label: 'HotWax orders and payments', parentEnumId: 'OMS' },
          { enumId: 'SHOPIFY', label: 'Shopify' },
          { enumId: 'SHOPIFY_RETURN_REFS', label: 'Shopify returns', parentEnumId: 'SHOPIFY' },
        ],
        systemRemotes: [...base.systemRemotes, salesOrdersRow, paymentsRow],
      })
      route.params.reconciliationMappingId = 'RS_ORDERS_1'
      draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
      draftStoreState.ruleSetDraftState = {
        draft: {
          savedRunId: 'RS_ORDERS_1',
          runName: 'Orders',
          file1SystemEnumId: 'SHOPIFY',
          file1SystemLabel: 'Shopify',
          file1SourceTypeEnumId: 'AUT_SRC_API',
          file1SystemMessageRemoteId: 'SHOPIFY_REMOTE',
          file1SourceConfigId: 'SHOPIFY_MAIN',
          file1SourceConfigType: 'SHOPIFY_AUTH',
          file1FileTypeEnumId: '',
          file1PrimaryIdExpression: ['$.records[*].id'],
          file2SystemEnumId: 'OMS_RECON_ORDERS',
          file2SystemLabel: 'HotWax sales orders',
          file2SourceTypeEnumId: 'AUT_SRC_API',
          file2SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
          file2SourceConfigId: 'KREWE_OMS',
          file2SourceConfigType: 'HOTWAX_OMS_REST',
          file2FileTypeEnumId: '',
          file2PrimaryIdExpression: ['$.records[*].externalId'],
          ...file2Extras,
        },
        resumeStepId: 'ruleset-manager',
      }
      const wrapper = mount(RunsSettingsWorkflowPage)
      await flushPromises()
      return wrapper
    }

    function endpointLabels(wrapper: ReturnType<typeof mount>): string[] {
      return wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.text())
    }

    it('offers every endpoint of the side\'s system for its config, and only that system', async () => {
      const wrapper = await mountSalesOrdersRun()

      await wrapper.get('[data-testid="run-api-endpoint-2"]').trigger('click')
      const labels = endpointLabels(wrapper)

      expect(labels).toEqual(expect.arrayContaining(['HotWax sales orders', 'HotWax orders and payments', 'Orders API', 'Returns API']))
      expect(labels).not.toContain('Shopify Return References')
    })

    it('moves the side to the picked endpoint: its system, config type and remote', async () => {
      const wrapper = await mountSalesOrdersRun()

      await chooseAppSelectOption(wrapper, 'run-api-endpoint-2', 'remote::KREWE_OMS:OMS_GQL')
      await flushPromises()
      await pickWorkflowSelectOption(wrapper, 'run-api-field-2', '$.records[*].externalId')
      await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
      await flushPromises()

      const payload = saveRuleSetRun.mock.calls[0]![0]
      expect(payload).toMatchObject({
        file2SystemEnumId: 'OMS_GQL',
        file2SourceTypeEnumId: 'AUT_SRC_API',
        file2SourceConfigId: 'KREWE_OMS',
        file2SourceConfigType: 'HOTWAX_OMS_GQL',
        file2PrimaryIdExpression: '$.records[*].externalId',
      })
      expect(payload).not.toHaveProperty('file2SystemMessageRemoteId')
    })

    it('reopens a remote-less endpoint side as selected', async () => {
      const wrapper = await mountSalesOrdersRun({
        file2SystemEnumId: 'OMS_GQL',
        file2SystemMessageRemoteId: undefined,
        file2SourceConfigType: 'HOTWAX_OMS_GQL',
      })

      expect(wrapper.get('[data-testid="run-api-endpoint-2"]').text()).toContain('HotWax orders and payments')
      expect(wrapper.text()).not.toContain('needs an API endpoint')
    })

    it('keeps the family label on a move to a sibling endpoint', async () => {
      const wrapper = await mountSalesOrdersRun({ file2SystemParentLabel: 'HotWax' })

      await chooseAppSelectOption(wrapper, 'run-api-endpoint-2', 'remote::KREWE_OMS:OMS_GQL')
      await flushPromises()
      await pickWorkflowSelectOption(wrapper, 'run-api-field-2', '$.records[*].externalId')
      await wrapper.get('[data-testid="save-run-settings"]').trigger('click')
      await flushPromises()

      const handedBack = draftStoreState.setRuleSetDraft.mock.calls.at(-1)?.[0] as Record<string, unknown>
      expect(handedBack.file2SystemEnumId).toBe('OMS_GQL')
      expect(handedBack.file2SystemParentLabel).toBe('HotWax')
    })
  })

  it('lets a long select label truncate inside its own grid cell', () => {
    const styleSource = readFileSync('src/style.css', 'utf8')
    expect(styleSource).toMatch(/\.workflow-form-grid--two > \.wizard-input-shell \{\s*min-width: 0;/)
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
