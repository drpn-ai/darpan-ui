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

  it('commits pending text on blur', async () => {
    // Every test above presses Enter, which is the author's habit and not the operator's: typing a
    // value and reaching straight for the step's Next button used to discard it silently. In a
    // browser the pointerdown on that button blurs the input first, so blur is the natural flush.
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: ['return_id'], placeholder: 'Add a column...' },
    })

    const input = wrapper.find('[data-testid="workflow-chip-text-input"]')
    await input.setValue('product_id')
    await input.trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['return_id', 'product_id'])
  })

  it('flushes pending text when commitPendingValue is called directly', async () => {
    // Blur depends on focus actually moving, so the component also exposes this flush for a parent
    // to call at submit time (ReconciliationCreateFlowPage.handlePrimarySubmit).
    //
    // NOTE: this test cannot prove the `defineExpose` is present. vue-test-utils reaches
    // <script setup> internals through the dev-mode proxy, so wrapper.vm.commitPendingValue
    // resolves with or without it -- while a PRODUCTION build closes the component and would
    // leave the parent calling undefined. The real guard for the exposure + wiring is the
    // create-flow page spec ("advances the step when a primary id is typed but never Enter-ed").
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: [], placeholder: 'Add a column...' },
    })

    await wrapper.find('[data-testid="workflow-chip-text-input"]').setValue('order_id')
    wrapper.vm.commitPendingValue()

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['order_id'])
  })

  it('does not re-commit the same pending text twice', async () => {
    // blur and the parent's explicit flush can both fire for one submit; the second must be a
    // no-op rather than a duplicate chip.
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: [], placeholder: 'Add a column...' },
    })

    const input = wrapper.find('[data-testid="workflow-chip-text-input"]')
    await input.setValue('order_id')
    await input.trigger('blur')
    wrapper.vm.commitPendingValue()

    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })

  it('removes a chip when its remove button is clicked', async () => {
    const wrapper = mount(WorkflowChipTextInput, {
      props: { modelValue: ['return_id', 'product_id'], placeholder: 'Add a column...' },
    })

    await wrapper.findAll('[data-testid="workflow-chip-text-chip-remove"]')[0]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toEqual(['product_id'])
  })
})
