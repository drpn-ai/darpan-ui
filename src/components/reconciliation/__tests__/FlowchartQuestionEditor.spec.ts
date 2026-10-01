import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FlowchartQuestionEditor from '../FlowchartQuestionEditor.vue'

const rules = [
  { savedRunId: 'SHIP', runName: 'Has a fulfillment', scopeMode: 'EVALUATE', requiresSystemSelection: false, systemOptions: [] },
  { savedRunId: 'OLD', runName: 'Archived rule', isArchived: 'Y', requiresSystemSelection: false, systemOptions: [] },
] as never[]

describe('FlowchartQuestionEditor', () => {
  it('offers only rules that are not archived', () => {
    const w = mount(FlowchartQuestionEditor, { props: { rules, draft: { ruleSetId: '', runName: '', noOutcomeLabel: '' }, heading: 'First question', canDelete: false } })
    const options = (w.findComponent({ name: 'AppSelect' }).props('options') as { value: string }[]).map((o) => o.value)
    expect(options).toEqual(['SHIP'])
  })

  it('cannot save without a rule', async () => {
    const w = mount(FlowchartQuestionEditor, { props: { rules, draft: { ruleSetId: '', runName: '', noOutcomeLabel: '' }, heading: 'h', canDelete: false } })
    expect(w.get('[data-testid="flowchart-editor-save"]').attributes('disabled')).toBeDefined()
  })

  it('emits the edited draft on save', async () => {
    const w = mount(FlowchartQuestionEditor, { props: { rules, draft: { ruleSetId: 'SHIP', runName: '', noOutcomeLabel: '' }, heading: 'h', canDelete: true } })
    await w.get('[data-testid="flowchart-editor-wording"]').setValue('Has a fulfillment?')
    await w.get('[data-testid="flowchart-editor-no"]').setValue('Never shipped')
    await w.get('[data-testid="flowchart-editor-save"]').trigger('click')
    expect(w.emitted('save')?.[0]).toEqual([{ ruleSetId: 'SHIP', runName: 'Has a fulfillment?', noOutcomeLabel: 'Never shipped' }])
  })

  it('a refused save keeps the draft and shows the reason', async () => {
    const w = mount(FlowchartQuestionEditor, { props: { rules, draft: { ruleSetId: 'SHIP', runName: 'x', noOutcomeLabel: 'y' }, heading: 'h', canDelete: false } })
    await w.get('[data-testid="flowchart-editor-wording"]').setValue('Typed text')
    await w.setProps({ error: 'Question A builds its key differently.' })
    expect(w.text()).toContain('builds its key differently')
    expect((w.get('[data-testid="flowchart-editor-wording"]').element as HTMLInputElement).value).toBe('Typed text')
  })

  it('shows delete only when the question can be deleted', () => {
    const shown = mount(FlowchartQuestionEditor, { props: { rules, draft: { ruleSetId: 'SHIP', runName: '', noOutcomeLabel: '' }, heading: 'h', canDelete: true } })
    const hidden = mount(FlowchartQuestionEditor, { props: { rules, draft: { ruleSetId: 'SHIP', runName: '', noOutcomeLabel: '' }, heading: 'h', canDelete: false } })
    expect(shown.find('[data-testid="flowchart-editor-delete"]').exists()).toBe(true)
    expect(hidden.find('[data-testid="flowchart-editor-delete"]').exists()).toBe(false)
  })

  it('a start has no "no" and only offers one-source rules (review I5)', () => {
    const mixed = [
      { savedRunId: 'POP', runName: 'Population', scopeMode: 'EVALUATE', requiresSystemSelection: false, systemOptions: [] },
      { savedRunId: 'CMP', runName: 'Compare', scopeMode: 'COMPARE', requiresSystemSelection: false, systemOptions: [] },
    ] as never[]
    const w = mount(FlowchartQuestionEditor, { props: { rules: mixed, draft: { ruleSetId: 'POP', runName: '', noOutcomeLabel: '' }, heading: 'Start', canDelete: false, isStart: true } })
    expect(w.find('[data-testid="flowchart-editor-no"]').exists()).toBe(false)
    const options = (w.findComponent({ name: 'AppSelect' }).props('options') as { value: string }[]).map((o) => o.value)
    expect(options).toEqual(['POP'])
  })
})
