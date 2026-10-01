import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RunFlowchartBoard from '../RunFlowchartBoard.vue'
import type { FlowchartQuestion } from '../../../lib/api/flowchartTypes'

const questions: FlowchartQuestion[] = [
  { reconciliationRunId: 'S', ruleSetId: 'POP', questionRole: 'START', runName: 'Sales orders' },
  { reconciliationRunId: 'A', ruleSetId: 'SHIP', parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Has a fulfillment?', noOutcomeLabel: 'Never shipped' },
  { reconciliationRunId: 'B', ruleSetId: 'INV', parentReconciliationRunId: 'A', parentBranch: 'YES', noOutcomeLabel: '' },
]
const ruleNames = { POP: 'Sales orders in window', SHIP: 'Has a fulfillment', INV: 'Has an invoice' }

describe('RunFlowchartBoard', () => {
  it('draws every question, every finding and the arrows between them', () => {
    const w = mount(RunFlowchartBoard, { props: { questions, ruleNames, editable: true, narrow: false } })
    expect(w.get('[data-testid="flowchart-box-A"]').text()).toContain('Has a fulfillment?')
    expect(w.get('[data-testid="flowchart-box-B"]').text()).toContain('Has an invoice')
    expect(w.get('[data-testid="flowchart-finding-A"]').text()).toContain('Never shipped')
    expect(w.get('[data-testid="flowchart-finding-B"]').text()).toContain('No')
    expect(w.find('[data-testid="flowchart-finding-S"]').exists()).toBe(false)
    expect(w.findAll('[data-testid^="flowchart-edge-"]').length).toBe(4)
  })

  it('narrow layout still draws arrows', () => {
    const w = mount(RunFlowchartBoard, { props: { questions, ruleNames, editable: false, narrow: true } })
    expect(w.get('[data-testid="flowchart-edges"]').isVisible()).toBe(true)
    expect(w.findAll('[data-testid^="flowchart-edge-"]').length).toBe(4)
  })

  it('emits select, add-next and add-why with the question id', async () => {
    const w = mount(RunFlowchartBoard, { props: { questions, ruleNames, editable: true, narrow: false } })
    await w.get('[data-testid="flowchart-box-A"]').trigger('click')
    await w.get('[data-testid="flowchart-add-next-A"]').trigger('click')
    await w.get('[data-testid="flowchart-add-why-A"]').trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['A'])
    expect(w.emitted('add-next')?.[0]).toEqual(['A'])
    expect(w.emitted('add-why')?.[0]).toEqual(['A'])
  })

  it('hides the + buttons when not editable', () => {
    const w = mount(RunFlowchartBoard, { props: { questions, ruleNames, editable: false, narrow: false } })
    expect(w.find('[data-testid^="flowchart-add-"]').exists()).toBe(false)
  })

  it('shows each question\'s run state and its counts', () => {
    const w = mount(RunFlowchartBoard, {
      props: {
        questions, ruleNames, editable: false, narrow: false,
        states: {
          S: { state: 'done', row: { reconciliationRunResultId: '1', yesCount: 18321, noCount: 0 } },
          A: { state: 'running' },
          B: { state: 'waiting' },
        },
      },
    })
    expect(w.get('[data-testid="flowchart-state-A"]').text()).toContain('running')
    expect(w.get('[data-testid="flowchart-state-S"]').text()).toContain('18,321')
  })

  it('marks the selected question', () => {
    const w = mount(RunFlowchartBoard, { props: { questions, ruleNames, editable: true, narrow: false, selectedId: 'A' } })
    expect(w.get('[data-testid="flowchart-box-A"]').classes()).toContain('flowchart-box--selected')
  })

  it('puts "+ next question" right-aligned, off the "no" arrow lane (review I2)', () => {
    const w = mount(RunFlowchartBoard, { props: { questions, ruleNames, editable: true, narrow: true } })
    expect(w.get('[data-testid="flowchart-add-next-A"]').attributes('style')).toContain('translateX(-100%)')
  })

  it('hides "+ next question" under a top-level one-source question when the run has no start (review I5)', () => {
    const loose = [
      { reconciliationRunId: 'T', ruleSetId: 'EV', scopeMode: 'EVALUATE' as const },
      { reconciliationRunId: 'U', ruleSetId: 'CMP', scopeMode: 'COMPARE' as const },
    ]
    const w = mount(RunFlowchartBoard, { props: { questions: loose, ruleNames: {}, editable: true, narrow: false } })
    expect(w.find('[data-testid="flowchart-add-next-T"]').exists()).toBe(false)
    expect(w.find('[data-testid="flowchart-add-next-U"]').exists()).toBe(true)
    expect(w.find('[data-testid="flowchart-add-why-T"]').exists()).toBe(true)
  })

  it('shows why a question failed or did not run (review I6)', () => {
    const w = mount(RunFlowchartBoard, {
      props: {
        questions, ruleNames, editable: false, narrow: false,
        states: {
          A: { state: 'failed', row: { reconciliationRunResultId: '2', errorMessage: 'This question could not run: boom' } },
          B: { state: 'not-run', row: { reconciliationRunResultId: '3', errorMessage: 'A question above this one did not finish.' } },
        },
      },
    })
    expect(w.get('[data-testid="flowchart-state-A"]').text()).toContain('could not run: boom')
    expect(w.get('[data-testid="flowchart-state-B"]').text()).toContain('did not finish')
  })
})
