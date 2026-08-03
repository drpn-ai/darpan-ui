// Fix-round-1 regression coverage for "Cancel no longer discards rule edits" (see
// .superpowers/sdd/2026-08-03-getter-exclusion-filters/task-11-report.md).
//
// This is a separate file rather than an addition to ReconciliationRuleSetEditorPage.spec.ts
// because that spec file's only permitted change in this round was the RuleSetBoard.vue
// readFileSync path (see review notes) — everything else in it, including its test count and
// existing assertions, had to stay untouched. RuleSetBoard.vue mutates the shared draft store's
// `rules` (via its continuous sync watcher) and both exclude-filter arrays in place, so a
// meaningful regression test here has to mount the real page + real board together, the same way
// the frozen spec does, rather than unit-test either component in isolation.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { buildReconciliationRuleSetDraftState, type ReconciliationRuleSetDraftRule } from '../../../lib/reconciliationRuleSetDraft'
import type { SourceExcludeFilter } from '../../../lib/sourceExcludeFilters'

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

describe('ReconciliationRuleSetEditorPage cancel behavior', () => {
  beforeEach(() => {
    getJsonSchema.mockReset()
    flattenJsonSchema.mockReset()
    listAutomationSourceOptions.mockReset()
    saveRuleSetRun.mockReset()
    routerPush.mockReset()
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.setRuleSetDraft = vi.fn()

    draftStoreState.ruleSetDraftState = createDraftState()

    window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')

    getJsonSchema.mockResolvedValue({ ok: true, messages: [], errors: [], schemaData: null })
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sourceConfigs: [],
      nsRestletConfigs: [],
      systemRemotes: [],
    })
    flattenJsonSchema.mockImplementation(({ jsonSchemaId }: { jsonSchemaId: string }) => {
      if (jsonSchemaId === 'schema-oms-orders') {
        return Promise.resolve({
          ok: true,
          messages: [],
          errors: [],
          fieldList: [
            { fieldPath: '$.orders[0].order_id', type: 'string', required: true },
            { fieldPath: '$.orders[0].status', type: 'string', required: false },
          ],
        })
      }
      return Promise.resolve({
        ok: true,
        messages: [],
        errors: [],
        fieldList: [
          { fieldPath: '$.data.orders.edges[0].node.id', type: 'string', required: true },
          { fieldPath: '$.data.orders.edges[0].node.status', type: 'string', required: false },
        ],
      })
    })
  })

  it('discards a rule drawn on the board when Cancel is clicked instead of Save', async () => {
    vi.useFakeTimers()
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-field-file1-1"]').trigger('pointerdown', { pointerId: 1, button: 0 })
    await vi.advanceTimersByTimeAsync(340)
    await wrapper.get('[data-testid="ruleset-field-file2-1"]').trigger('pointerup', { pointerId: 1, button: 0 })
    await flushPromises()

    // The rule exists on the board before Cancel is clicked.
    expect(wrapper.findAll('.ruleset-operator-box')).toHaveLength(1)

    await wrapper.get('[data-testid="cancel-ruleset-rules"]').trigger('click')
    await flushPromises()

    expect(routerPush).toHaveBeenCalledWith({ path: '/reconciliation/ruleset-manager' })
    expect(saveRuleSetRun).not.toHaveBeenCalled()
    const [persistedDraft] = draftStoreState.setRuleSetDraft.mock.calls.at(-1) as [{ rules?: unknown[] }, string]
    expect(persistedDraft.rules).toEqual([])
    vi.useRealTimers()
  })

  it('discards an exclusion added on the board when Cancel is clicked instead of Save', async () => {
    const wrapper = mount(ReconciliationRuleSetEditorPage)
    await flushPromises()

    await wrapper.get('[data-testid="ruleset-field-exclude-file2-1"]').trigger('click')
    const input = wrapper.get('[data-testid="ruleset-exclusion-value-input"]')
    await input.setValue('POS_SALES_CHANNEL')
    await input.trigger('keydown', { key: 'Enter' })
    await wrapper.get('[data-testid="ruleset-exclusion-apply"]').trigger('click')

    expect(wrapper.get('[data-testid="ruleset-field-exclude-file2-1"]').classes()).toContain('ruleset-field-exclude--set')

    await wrapper.get('[data-testid="cancel-ruleset-rules"]').trigger('click')
    await flushPromises()

    const [persistedDraft] = draftStoreState.setRuleSetDraft.mock.calls.at(-1) as [{ file2ExcludeFilters?: unknown[] }, string]
    expect(persistedDraft.file2ExcludeFilters ?? []).toEqual([])
  })
})
