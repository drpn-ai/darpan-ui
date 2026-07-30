import { describe, expect, it } from 'vitest'
import type { SavedRunSummary } from '../api/types'
import {
  RECONCILIATION_AUTOMATION_PENDING_STATE_KEY,
  buildReconciliationAutomationDraftState,
  buildSaveAutomationPayload,
  clearPendingReconciliationAutomationDraftState,
  readPendingReconciliationAutomationDraftState,
  readReconciliationAutomationDraftState,
  savePendingReconciliationAutomationDraftState,
  type ReconciliationAutomationDraft,
} from '../reconciliationAutomationDraft'

const savedRun: SavedRunSummary = {
  savedRunId: 'RS_JSON_ORDER_COMPARE',
  runName: 'JSON Order Compare',
  runType: 'ruleset',
  ruleSetId: 'RS_JSON_ORDER_COMPARE',
  compareScopeId: 'CS_RS_JSON_ORDER_COMPARE',
  requiresSystemSelection: false,
  defaultFile1SystemEnumId: 'OMS',
  defaultFile2SystemEnumId: 'SHOPIFY',
  systemOptions: [
    {
      fileSide: 'FILE_1',
      enumId: 'OMS',
      label: 'OMS',
      fileTypeEnumId: 'DftJson',
      schemaFileName: 'test-oms-orders.schema.json',
      idFieldExpression: '$.orders[0].order_id',
    },
    {
      fileSide: 'FILE_2',
      enumId: 'SHOPIFY',
      label: 'Shopify',
      fileTypeEnumId: 'DftJson',
      schemaFileName: 'test-shopify-orders.schema.json',
      idFieldExpression: '$.data.orders.edges[0].node.id',
    },
  ],
}

function createDraft(overrides: Partial<ReconciliationAutomationDraft> = {}): ReconciliationAutomationDraft {
  return {
    intent: 'new-run',
    automationName: 'JSON Order Compare Automation',
    savedRunId: 'RS_JSON_ORDER_COMPARE',
    savedRunType: 'ruleset',
    inputModeEnumId: 'AUT_IN_SFTP_FILES',
    scheduleExpr: 'PT1H',
    windowTimeZone: 'UTC',
    returnLabel: 'Dashboard',
    returnPath: '/',
    sources: {
      FILE_1: {
        sourceTypeEnumId: 'AUT_SRC_SFTP',
        sftpServerId: 'SFTP_OMS',
        remotePathTemplate: '/remote/oms/orders',
        fileNamePattern: 'oms-*.json',
      },
      FILE_2: {
        sourceTypeEnumId: 'AUT_SRC_SFTP',
        sftpServerId: 'SFTP_SHOPIFY',
        remotePathTemplate: '/remote/shopify/orders',
        fileNamePattern: 'shopify-*.json',
      },
    },
    ...overrides,
  }
}

describe('reconciliationAutomationDraft', () => {
  it('round-trips the automation draft and handoff saved run through history state', () => {
    const state = buildReconciliationAutomationDraftState(createDraft(), 'schedule', savedRun)

    expect(readReconciliationAutomationDraftState(state)).toEqual({
      draft: createDraft(),
      resumeStepId: 'schedule',
      savedRun,
    })
  })

  it('persists pending automation handoff state through session storage', () => {
    savePendingReconciliationAutomationDraftState(createDraft(), 'input-mode', savedRun)

    expect(window.sessionStorage.getItem(RECONCILIATION_AUTOMATION_PENDING_STATE_KEY)).toContain('JSON Order Compare Automation')
    expect(readPendingReconciliationAutomationDraftState()).toEqual({
      draft: createDraft(),
      resumeStepId: 'input-mode',
      savedRun,
    })

    clearPendingReconciliationAutomationDraftState()

    expect(readPendingReconciliationAutomationDraftState()).toBeNull()
  })

  it('preserves saved-run API source metadata in automation handoff state', () => {
    const apiSavedRun: SavedRunSummary = {
      ...savedRun,
      systemOptions: [
        {
          ...savedRun.systemOptions[0]!,
          sourceTypeEnumId: 'AUT_SRC_API',
          sourceTypeLabel: 'API',
          systemMessageRemoteId: 'OMS_REMOTE',
          systemMessageRemoteLabel: 'OMS orders',
          sourceConfigId: 'OMS_REST_SOURCE',
          sourceConfigType: 'SYSTEM_MESSAGE_REMOTE_OPTION',
        },
        {
          ...savedRun.systemOptions[1]!,
          sourceTypeEnumId: 'AUT_SRC_API',
          sourceTypeLabel: 'API',
          systemMessageRemoteId: 'SHOPIFY_REMOTE',
          systemMessageRemoteLabel: 'Shopify orders',
          sourceConfigId: 'SHOPIFY_ORDERS',
          sourceConfigType: 'SYSTEM_MESSAGE_REMOTE_OPTION',
        },
      ],
    }

    const state = buildReconciliationAutomationDraftState(createDraft(), 'input-mode', apiSavedRun)

    expect(readReconciliationAutomationDraftState(state)?.savedRun?.systemOptions).toEqual(apiSavedRun.systemOptions)
  })

  it('builds a save payload that references the newly created saved run and derives source contract fields from it', () => {
    expect(buildSaveAutomationPayload(createDraft(), savedRun)).toEqual({
      automationName: 'JSON Order Compare Automation',
      savedRunId: 'RS_JSON_ORDER_COMPARE',
      savedRunType: 'ruleset',
      inputModeEnumId: 'AUT_IN_SFTP_FILES',
      scheduleExpr: 'PT1H',
      windowTimeZone: 'UTC',
      isActive: true,
      maxWindowDays: 28,
      splitWindowDays: 28,
      sources: [
        {
          fileSide: 'FILE_1',
          sourceTypeEnumId: 'AUT_SRC_SFTP',
          systemEnumId: 'OMS',
          fileTypeEnumId: 'DftJson',
          schemaFileName: 'test-oms-orders.schema.json',
          primaryIdExpression: '$.orders[0].order_id',
          sftpServerId: 'SFTP_OMS',
          remotePathTemplate: '/remote/oms/orders',
          fileNamePattern: 'oms-*.json',
        },
        {
          fileSide: 'FILE_2',
          sourceTypeEnumId: 'AUT_SRC_SFTP',
          systemEnumId: 'SHOPIFY',
          fileTypeEnumId: 'DftJson',
          schemaFileName: 'test-shopify-orders.schema.json',
          primaryIdExpression: '$.data.orders.edges[0].node.id',
          sftpServerId: 'SFTP_SHOPIFY',
          remotePathTemplate: '/remote/shopify/orders',
          fileNamePattern: 'shopify-*.json',
        },
      ],
    })
  })

  it('builds API source payloads with relative window fields for existing-run automations', () => {
    expect(buildSaveAutomationPayload(createDraft({
      intent: 'existing-run',
      inputModeEnumId: 'AUT_IN_API_RANGE',
      relativeWindowTypeEnumId: 'AUT_WIN_LAST_DAYS',
      relativeWindowCount: 2,
      maxWindowDays: 14,
      splitWindowDays: 7,
      sources: {
        FILE_1: {
          sourceTypeEnumId: 'AUT_SRC_API',
          systemMessageRemoteId: 'OMS_ORDER_EXPORT',
          apiResponsePathExpression: '$.orders',
          dateFromParameterName: 'fromDate',
          dateToParameterName: 'toDate',
        },
        FILE_2: {
          sourceTypeEnumId: 'AUT_SRC_API',
          nsRestletConfigId: 'SHOPIFY_ORDER_RESTLET',
          apiRequestTemplateJson: '{"status":"open"}',
          apiResponsePathExpression: '$.data.orders',
        },
      },
    }), savedRun)).toEqual({
      automationName: 'JSON Order Compare Automation',
      savedRunId: 'RS_JSON_ORDER_COMPARE',
      savedRunType: 'ruleset',
      inputModeEnumId: 'AUT_IN_API_RANGE',
      scheduleExpr: 'PT1H',
      windowTimeZone: 'UTC',
      relativeWindowTypeEnumId: 'AUT_WIN_LAST_DAYS',
      relativeWindowCount: 2,
      maxWindowDays: 14,
      splitWindowDays: 7,
      isActive: true,
      sources: [
        {
          fileSide: 'FILE_1',
          sourceTypeEnumId: 'AUT_SRC_API',
          systemEnumId: 'OMS',
          fileTypeEnumId: 'DftJson',
          schemaFileName: 'test-oms-orders.schema.json',
          primaryIdExpression: '$.orders[0].order_id',
          systemMessageRemoteId: 'OMS_ORDER_EXPORT',
          apiResponsePathExpression: '$.orders',
          dateFromParameterName: 'fromDate',
          dateToParameterName: 'toDate',
        },
        {
          fileSide: 'FILE_2',
          sourceTypeEnumId: 'AUT_SRC_API',
          systemEnumId: 'SHOPIFY',
          fileTypeEnumId: 'DftJson',
          schemaFileName: 'test-shopify-orders.schema.json',
          primaryIdExpression: '$.data.orders.edges[0].node.id',
          nsRestletConfigId: 'SHOPIFY_ORDER_RESTLET',
          apiRequestTemplateJson: '{"status":"open"}',
          apiResponsePathExpression: '$.data.orders',
        },
      ],
    })
  })

  it('round-trips chat-space draft fields through history state', () => {
    const state = buildReconciliationAutomationDraftState(
      createDraft({ chatSpaceChoice: 'existing', chatSpaceId: 'CS1', newChatSpaceName: 'Ops', newChatSpaceUrl: 'https://chat.googleapis.com/v1/spaces/AAA' }),
      'chat-space-select',
      savedRun,
    )

    expect(readReconciliationAutomationDraftState(state)).toEqual({
      draft: createDraft({ chatSpaceChoice: 'existing', chatSpaceId: 'CS1', newChatSpaceName: 'Ops', newChatSpaceUrl: 'https://chat.googleapis.com/v1/spaces/AAA' }),
      resumeStepId: 'chat-space-select',
      savedRun,
    })
  })

  it('sends the selected chat space id on the save payload', () => {
    expect(buildSaveAutomationPayload(createDraft({ chatSpaceChoice: 'existing', chatSpaceId: 'CS1' }), savedRun)).toMatchObject({
      chatSpaceId: 'CS1',
    })
    expect(buildSaveAutomationPayload(createDraft({ chatSpaceChoice: 'new', chatSpaceId: 'CS9' }), savedRun)).toMatchObject({
      chatSpaceId: 'CS9',
    })
  })

  it('sends an explicit empty chatSpaceId to clear the link when the choice is none', () => {
    const payload = buildSaveAutomationPayload(createDraft({ chatSpaceChoice: 'none', chatSpaceId: 'CS1' }), savedRun)

    expect(payload.chatSpaceId).toBe('')
    expect(payload).toHaveProperty('chatSpaceId')
  })

  it('omits chatSpaceId entirely when no chat-space choice has been made', () => {
    const payload = buildSaveAutomationPayload(createDraft(), savedRun)

    expect(payload).not.toHaveProperty('chatSpaceId')
  })

  it('omits counts for previous windows and sends persisted dates for custom ranges', () => {
    const previousWeekPayload = buildSaveAutomationPayload(createDraft({
      inputModeEnumId: 'AUT_IN_API_RANGE',
      relativeWindowTypeEnumId: 'AUT_WIN_PREV_WEEK',
      relativeWindowCount: 9,
      sources: {
        FILE_1: { sourceTypeEnumId: 'AUT_SRC_API', systemMessageRemoteId: 'OMS_ORDER_EXPORT' },
        FILE_2: { sourceTypeEnumId: 'AUT_SRC_API', systemMessageRemoteId: 'SHOPIFY_ORDER_EXPORT' },
      },
    }), savedRun)

    expect(previousWeekPayload).toMatchObject({
      inputModeEnumId: 'AUT_IN_API_RANGE',
      relativeWindowTypeEnumId: 'AUT_WIN_PREV_WEEK',
    })
    expect(previousWeekPayload).not.toHaveProperty('relativeWindowCount')

    const customRangePayload = buildSaveAutomationPayload(createDraft({
      inputModeEnumId: 'AUT_IN_API_RANGE',
      relativeWindowTypeEnumId: 'AUT_WIN_CUSTOM',
      relativeWindowCount: 4,
      customWindowStartDate: '2026-04-01T00:00:00.000Z',
      customWindowEndDate: '2026-05-01T00:00:00.000Z',
      sources: {
        FILE_1: { sourceTypeEnumId: 'AUT_SRC_API', systemMessageRemoteId: 'OMS_ORDER_EXPORT' },
        FILE_2: { sourceTypeEnumId: 'AUT_SRC_API', systemMessageRemoteId: 'SHOPIFY_ORDER_EXPORT' },
      },
    }), savedRun)

    expect(customRangePayload).toMatchObject({
      inputModeEnumId: 'AUT_IN_API_RANGE',
      relativeWindowTypeEnumId: 'AUT_WIN_CUSTOM',
      customWindowStartDate: '2026-04-01T00:00:00.000Z',
      customWindowEndDate: '2026-05-01T00:00:00.000Z',
    })
    expect(customRangePayload).not.toHaveProperty('relativeWindowCount')
  })
})
