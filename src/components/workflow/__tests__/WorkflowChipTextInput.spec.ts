import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowChipTextInput from '../WorkflowChipTextInput.vue'

describe('WorkflowChipTextInput', () => {
  it('renders existing chips and commits a new one on Enter', async () => {
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: ['return_id'], placeholder: 'Add a column...' },
    })

    expect(wrapper.findAll('[data-testid="workflow-chip-text-chip"]')).toHaveLength(1)

    const input = wrapper.find('[data-testid="workflow-chip-text-input"]')
    await input.setValue('product_id')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['return_id', 'product_id'])
  })

  it('ignores blank input and duplicate values on Enter', async () => {
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: ['return_id'], placeholder: 'Add a column...' },
    })
    const input = wrapper.find('[data-testid="workflow-chip-text-input"]')

    await input.setValue('   ')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await input.setValue('return_id')
    await input.trigger('keydown.enter')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('removes a chip when its remove button is clicked', async () => {
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: ['return_id', 'product_id'], placeholder: 'Add a column...' },
    })

    await wrapper.findAll('[data-testid="workflow-chip-text-chip-remove"]')[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['product_id'])
  })
})
