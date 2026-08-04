import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import {
  buildReconciliationRuleSetDraftState,
  type ReconciliationRuleSetDraftRule,
} from '../../../lib/reconciliationRuleSetDraft'

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

const RULE_ONE: ReconciliationRuleSetDraftRule = {
  ruleId: 'rule-1',
  file1FieldPath: '$.orders[0].order_id',
  file2FieldPath: '$.data.orders.edges[0].node.id',
  operator: '=',
  sequenceNum: 1,
}

/**
 * sequenceNum 0 is the hidden basic-diff row the board filters out of `orderedRules`. A rule set
 * carrying only this row has no rules a person can see, so it must still count as empty.
 */
const HIDDEN_BASIC_DIFF: ReconciliationRuleSetDraftRule = {
  ruleId: 'basic-diff',
  file1FieldPath: '$.hidden',
  file2FieldPath: '$.hidden',
  operator: '=',
  sequenceNum: 0,
}

async function mountEditor() {
  window.history.replaceState({}, '', '/reconciliation/ruleset-manager/rules')
  const wrapper = mount(ReconciliationRuleSetEditorPage)
  await flushPromises()
  return wrapper
}

describe('ReconciliationRuleSetEditorPage help affordances', () => {
  beforeEach(() => {
    getJsonSchema.mockReset()
    flattenJsonSchema.mockReset()
    listAutomationSourceOptions.mockReset()
    saveRuleSetRun.mockReset()
    routerPush.mockReset()

    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }
    draftStoreState.ruleSetDraftState = createDraftState()

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
          { fieldPath: '$.data.orders.edges[0].node.displayFinancialStatus', type: 'string', required: false },
        ],
      })
    })
  })

  describe('ghost rule on arrival', () => {
    it('draws a ghost rule and its caption when the rule set has no rules', async () => {
      const wrapper = await mountEditor()

      const ghost = wrapper.find('[data-testid="ruleset-ghost-rule"]')
      expect(ghost.exists()).toBe(true)
      expect(ghost.attributes('d')).toBeTruthy()

      const caption = wrapper.find('[data-testid="ruleset-ghost-caption"]')
      expect(caption.exists()).toBe(true)
      expect(caption.text()).toBe('Drag a field onto one on the right to compare them')
    })

    it('hides the ghost rule once the rule set has a rule', async () => {
      draftStoreState.ruleSetDraftState = createDraftState([RULE_ONE])
      const wrapper = await mountEditor()

      expect(wrapper.find('[data-testid="ruleset-ghost-rule"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="ruleset-ghost-caption"]').exists()).toBe(false)
    })

    it('still draws the ghost when the only stored rule is the hidden basic-diff row', async () => {
      draftStoreState.ruleSetDraftState = createDraftState([HIDDEN_BASIC_DIFF])
      const wrapper = await mountEditor()

      expect(wrapper.find('[data-testid="ruleset-ghost-rule"]').exists()).toBe(true)
    })

    it('keys the ghost to this rule set rather than to a seen-it flag on the user', async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem')

      const first = await mountEditor()
      expect(first.find('[data-testid="ruleset-ghost-rule"]').exists()).toBe(true)
      first.unmount()

      // Someone who learnt the board months ago and opens a fresh rule set deserves the reminder.
      const second = await mountEditor()
      expect(second.find('[data-testid="ruleset-ghost-rule"]').exists()).toBe(true)

      const helpWrites = setItem.mock.calls.filter(([key]) => String(key).includes('ghost'))
      expect(helpWrites).toEqual([])
      setItem.mockRestore()
    })

    it('keeps the caption clear of the line it captions', async () => {
      const wrapper = await mountEditor()

      // A caption centred on the midpoint sat on top of the ghost and hid it. It has to sit below.
      const midY = Number(/M [\d.]+ ([\d.]+)/.exec(
        wrapper.get('[data-testid="ruleset-ghost-rule"]').attributes('d') ?? '',
      )?.[1])
      const captionTop = Number(/top:\s*([\d.]+)px/.exec(
        wrapper.get('[data-testid="ruleset-ghost-caption"]').attributes('style') ?? '',
      )?.[1])

      expect(Number.isFinite(midY)).toBe(true)
      expect(captionTop).toBeGreaterThan(midY)
    })

    it('costs zero clicks to dismiss - the ghost carries no control of its own', async () => {
      const wrapper = await mountEditor()

      const caption = wrapper.get('[data-testid="ruleset-ghost-caption"]')
      expect(caption.findAll('button')).toHaveLength(0)
      expect(wrapper.find('[data-testid="ruleset-ghost-rule"]').element.tagName.toLowerCase()).toBe('path')
    })
  })

  describe('term definitions on hover', () => {
    async function openRulePopover() {
      draftStoreState.ruleSetDraftState = createDraftState([RULE_ONE])
      const wrapper = await mountEditor()
      await wrapper.get('[data-testid="ruleset-rule-operator-rule-1"]').trigger('click')
      expect(wrapper.find('[data-testid="ruleset-rule-popover"]').exists()).toBe(true)
      return wrapper
    }

    it('defines each of the three terms in the rule popover', async () => {
      const wrapper = await openRulePopover()

      for (const key of ['pre-actions', 'operator', 'sequence']) {
        const term = wrapper.find(`[data-testid="ruleset-term-${key}"]`)
        expect(term.exists()).toBe(true)
        expect(term.attributes('type')).toBe('button')

        const definition = wrapper.find(`[data-testid="ruleset-term-definition-${key}"]`)
        expect(definition.exists()).toBe(true)
        expect(definition.text().length).toBeGreaterThan(20)
      }
    })

    it('writes the sequence definition from the operator side rather than the schema side', async () => {
      const wrapper = await openRulePopover()

      const definition = wrapper.get('[data-testid="ruleset-term-definition-sequence"]').text()
      expect(definition).toContain('uniquely identifies a row')
      expect(definition).not.toContain('sequenceNum')
    })

    it('points each term at its own definition for assistive technology', async () => {
      const wrapper = await openRulePopover()

      for (const key of ['pre-actions', 'operator', 'sequence']) {
        const describedBy = wrapper.get(`[data-testid="ruleset-term-${key}"]`).attributes('aria-describedby')
        expect(describedBy).toBeTruthy()
        expect(wrapper.get(`[data-testid="ruleset-term-definition-${key}"]`).attributes('id')).toBe(describedBy)
      }
    })

    it('caps the popover width so a wide board cannot stretch it across the screen', async () => {
      // Pill centres 1100px apart: the uncapped span is wider than the form needs and leaves no
      // room beside it for the definition shelf.
      const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: Element) {
        const element = this as HTMLElement
        const box = (left: number, top: number, width: number, height: number) => ({
          x: left, y: top, width, height, left, top, right: left + width, bottom: top + height, toJSON: () => ({}),
        } as DOMRect)

        if (element.getAttribute('data-testid') === 'ruleset-editor-board') return box(0, 0, 1400, 430)
        if (element.dataset.ruleSide === 'file1') return box(0, 100, 280, 44)
        if (element.dataset.ruleSide === 'file2') return box(1120, 100, 280, 44)
        return box(0, 0, 0, 0)
      })

      const wrapper = await openRulePopover()
      const width = Number(/width:\s*([\d.]+)px/.exec(
        wrapper.get('[data-testid="ruleset-rule-popover"]').attributes('style') ?? '',
      )?.[1])

      expect(width).toBeLessThanOrEqual(544)
      rectSpy.mockRestore()
    })

    it('adds no question-mark icons to carry the help', async () => {
      const wrapper = await openRulePopover()

      const popover = wrapper.get('[data-testid="ruleset-rule-popover"]')
      const iconish = popover.findAll('button').filter((button) => button.text().trim() === '?')
      expect(iconish).toHaveLength(0)
    })

    it('does not operate the control it sits above when the term is pressed', async () => {
      const wrapper = await openRulePopover()

      // The term is reachable by keyboard, but pressing it must not open the select it sits above.
      const term = wrapper.get('[data-testid="ruleset-term-operator"]')
      await term.trigger('click')

      expect(wrapper.findAll('[data-testid="app-select-option"]')).toHaveLength(0)
    })
  })
})
