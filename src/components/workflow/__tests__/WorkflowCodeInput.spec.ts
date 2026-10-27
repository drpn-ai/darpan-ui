import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import WorkflowCodeInput from '../WorkflowCodeInput.vue'

function mountCode(initial = '') {
  const value = ref(initial)
  const completed: string[] = []
  const wrapper = mount(WorkflowCodeInput, {
    attachTo: document.body,
    props: {
      modelValue: value.value,
      testId: 'code',
      'onUpdate:modelValue': async (next: string) => {
        value.value = next
        await wrapper.setProps({ modelValue: next })
      },
      onComplete: (code: string) => completed.push(code),
    },
  })
  const box = (index: number) => wrapper.get<HTMLInputElement>(`[data-testid="code-${index}"]`)
  return { wrapper, value, completed, box }
}

describe('WorkflowCodeInput', () => {
  it('renders six one-digit boxes, autofill only on the first', () => {
    const { wrapper, box } = mountCode()

    expect(wrapper.findAll('input')).toHaveLength(6)
    expect(box(0).attributes('autocomplete')).toBe('one-time-code')
    expect(box(1).attributes('autocomplete')).toBe('off')
    expect(box(5).attributes('aria-label')).toBe('Code, digit 6 of 6')
    wrapper.unmount()
  })

  it('moves to the next box as each digit is typed and completes on the sixth', async () => {
    const { wrapper, value, completed, box } = mountCode()

    for (const [index, digit] of ['1', '2', '3', '4', '5', '6'].entries()) {
      await box(index).setValue(digit)
      await nextTick()
    }

    expect(value.value).toBe('123456')
    expect(completed).toEqual(['123456'])
    expect(box(3).element.value).toBe('4')
    wrapper.unmount()
  })

  it('spreads a pasted or autofilled code across the boxes, keeping digits only', async () => {
    const { wrapper, value, completed, box } = mountCode()

    await box(0).setValue('12 34-56')

    expect(value.value).toBe('123456')
    expect(completed).toEqual(['123456'])
    wrapper.unmount()
  })

  it('ignores letters', async () => {
    const { wrapper, value, completed, box } = mountCode('12')

    await box(2).setValue('a')

    expect(value.value).toBe('12')
    expect(box(2).element.value).toBe('')
    expect(completed).toEqual([])
    wrapper.unmount()
  })

  it('backspace on an empty box clears the one before it', async () => {
    const { wrapper, value, box } = mountCode('123')

    await box(3).trigger('keydown', { key: 'Backspace' })

    expect(value.value).toBe('12')
    wrapper.unmount()
  })

  it('sends focus to the first empty box when a later one is clicked', async () => {
    const { wrapper, box } = mountCode('12')

    await box(5).trigger('focus')
    await nextTick()

    expect(document.activeElement).toBe(box(2).element)
    wrapper.unmount()
  })
})
