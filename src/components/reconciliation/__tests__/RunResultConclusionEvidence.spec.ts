import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RunResultConclusionEvidence from '../RunResultConclusionEvidence.vue'
import type { RunConclusion } from '../../../lib/api/types'

const backordered: RunConclusion = {
  code: 'CONC_NS_BACKORDERED',
  label: 'Backordered in NetSuite',
  systems: [
    { side: 'FILE_1', system: 'HotWax', presence: 'KEPT', state: 'Completed', facts: ['217', '01'] },
    { side: 'FILE_2', system: 'NetSuite', presence: 'EXCLUDED', state: 'Pending Fulfillment', facts: ['01', '0', '1'] },
  ],
  checks: [
    { label: 'NetSuite has the line', value: 'excluded', passed: true },
    { label: 'Nothing shipped, on backorder', value: '1', passed: true },
  ],
  question: null,
}

describe('RunResultConclusionEvidence', () => {
  it('shows each system, then the checks, then the raw record toggle', () => {
    const wrapper = mount(RunResultConclusionEvidence, { props: { conclusion: backordered, rawValue: { a: 1 } } })
    const systems = wrapper.findAll('[data-testid="conclusion-system"]')
    expect(systems.map((s) => s.text())).toEqual(['HotWaxCompleted21701', 'NetSuitePending Fulfillment0101'])
    expect(wrapper.text()).toContain('How Darpan concluded')
    expect(wrapper.findAll('[data-testid="conclusion-check"]').map((c) => c.text())).toEqual([
      '✓NetSuite has the lineexcluded',
      '✓Nothing shipped, on backorder1',
    ])
    expect(wrapper.find('[data-testid="conclusion-decision"]').exists()).toBe(false)
  })

  it('draws an absent side dashed as Not found, and an unchecked side as Not checked', () => {
    const wrapper = mount(RunResultConclusionEvidence, {
      props: {
        conclusion: {
          ...backordered,
          systems: [
            { side: 'FILE_1', system: 'HotWax', presence: 'KEPT', state: 'Completed', facts: [] },
            { side: 'FILE_2', system: 'NetSuite', presence: 'ABSENT', state: null, facts: [] },
          ],
        },
        rawValue: null,
      },
    })
    const netsuite = wrapper.findAll('[data-testid="conclusion-system"]').at(1)
    if (!netsuite) throw new Error('the NetSuite box did not render')
    expect(netsuite.classes()).toContain('conclusion-evidence__system--empty')
    expect(netsuite.text()).toContain('Not found')

    const unknown = mount(RunResultConclusionEvidence, {
      props: { conclusion: { ...backordered, systems: [{ side: 'FILE_2', system: 'NetSuite', presence: 'UNKNOWN', state: null, facts: [] }] }, rawValue: null },
    })
    expect(unknown.get('[data-testid="conclusion-system"]').text()).toContain('Not checked')
  })

  it('offers the decision and emits the suggested filter; keep flagging only dismisses', async () => {
    const suggestedFilter = { fileSide: 'FILE_1' as const, fieldExpression: 'facilityId', operator: 'EXCLUDE_IN' as const, values: ['_NA_'] }
    const wrapper = mount(RunResultConclusionEvidence, {
      props: {
        conclusion: { ...backordered, question: { text: 'Should gift-card-only orders reach NetSuite?', count: 37, suggestedFilter } },
        rawValue: null,
      },
    })
    expect(wrapper.get('[data-testid="conclusion-decision"]').text()).toContain('Should gift-card-only orders reach NetSuite? 37 in this run.')
    await wrapper.get('[data-testid="conclusion-stop-flagging"]').trigger('click')
    expect(wrapper.emitted('stopFlagging')?.[0]?.[0]).toMatchObject({ suggestedFilter })
    await wrapper.get('[data-testid="conclusion-keep-flagging"]').trigger('click')
    expect(wrapper.find('[data-testid="conclusion-decision"]').exists()).toBe(false)
  })

  it('opens the raw record on demand', async () => {
    const wrapper = mount(RunResultConclusionEvidence, { props: { conclusion: backordered, rawValue: { orderId: 'M1' } } })
    expect(wrapper.find('[data-testid="conclusion-raw"]').exists()).toBe(false)
    await wrapper.get('[data-testid="conclusion-raw-toggle"]').trigger('click')
    expect(wrapper.get('[data-testid="conclusion-raw"]').text()).toContain('1 key')
  })
})
