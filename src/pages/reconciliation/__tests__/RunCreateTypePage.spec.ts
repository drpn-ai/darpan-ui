import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))

import RunCreateTypePage from '../RunCreateTypePage.vue'

beforeEach(() => push.mockReset())

describe('RunCreateTypePage', () => {
  it('asks one thing — which kind of run — with Sync first', async () => {
    const w = mount(RunCreateTypePage)
    await flushPromises()
    expect(w.text()).toContain('What kind of run?')
    expect(w.get('[data-testid="run-type-choice-sync"]').text()).toContain('Sync')
    expect(w.get('[data-testid="run-type-choice-lifecycle"]').text()).toContain('Lifecycle')
  })

  it('hands a Sync run to the existing create flow', async () => {
    const w = mount(RunCreateTypePage)
    await w.get('[data-testid="run-type-choice-sync"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-create' })
  })

  it('hands a Lifecycle run to the flowchart create flow', async () => {
    const w = mount(RunCreateTypePage)
    await w.get('[data-testid="run-type-choice-lifecycle"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart-create' })
  })

  it('goes home on back', async () => {
    const w = mount(RunCreateTypePage)
    await w.findComponent({ name: 'WorkflowStepForm' }).vm.$emit('back')
    expect(push).toHaveBeenCalledWith({ name: 'hub' })
  })
})
