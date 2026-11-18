import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StaticEditableTitle from '../StaticEditableTitle.vue'

describe('StaticEditableTitle', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders an editable static heading without adding input chrome', async () => {
    const wrapper = mount(StaticEditableTitle, {
      props: {
        modelValue: 'Orders schema',
        ariaLabel: 'Schema name',
        testId: 'editable-title',
      },
    })

    const title = wrapper.get('[data-testid="editable-title"]')
    expect(title.element.tagName).toBe('H1')
    expect(title.text()).toBe('Orders schema')
    expect(title.attributes('contenteditable')).toBe('plaintext-only')
    expect(title.attributes('aria-label')).toBe('Schema name')
    expect(wrapper.find('input').exists()).toBe(false)

    title.element.textContent = 'Orders schema revised'
    await title.trigger('input')
    await title.trigger('blur')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Orders schema revised'])
    expect(wrapper.emitted('commit')?.[0]).toEqual(['Orders schema revised'])
  })

  it('can render as read-only when the page cannot edit the title', () => {
    const wrapper = mount(StaticEditableTitle, {
      props: {
        modelValue: 'Selected Run',
        editable: false,
        testId: 'readonly-title',
      },
    })

    const title = wrapper.get('[data-testid="readonly-title"]')
    expect(title.attributes('contenteditable')).toBe('false')
    expect(title.attributes('aria-label')).toBeUndefined()
  })

  it('commits once when Enter blurs the editable heading', async () => {
    const wrapper = mount(StaticEditableTitle, {
      attachTo: document.body,
      props: {
        modelValue: 'Orders schema',
        testId: 'editable-title',
      },
    })

    const title = wrapper.get('[data-testid="editable-title"]')
    const titleElement = title.element as HTMLElement
    titleElement.focus()
    titleElement.textContent = 'Orders schema revised'

    await title.trigger('keydown.enter')

    expect(wrapper.emitted('commit')).toEqual([['Orders schema revised']])
    expect(document.activeElement).not.toBe(titleElement)
    wrapper.unmount()
  })

  it('does not overwrite active content while the parent model updates', async () => {
    const wrapper = mount(StaticEditableTitle, {
      attachTo: document.body,
      props: {
        modelValue: 'Shopify',
        testId: 'editable-title',
      },
    })

    const title = wrapper.get('[data-testid="editable-title"]')
    const titleElement = title.element as HTMLElement
    titleElement.focus()
    expect(document.activeElement).toBe(titleElement)

    titleElement.textContent = 'Shopify orders'
    await title.trigger('input')
    await wrapper.setProps({ modelValue: 'Shopify order' })

    expect(titleElement.textContent).toBe('Shopify orders')

    await title.trigger('blur')
    wrapper.unmount()
  })
  // DAR-UI-121: Esc leaves an edit without committing, and stops there so the shell does not act on it.
  it('puts the text back on Esc, commits nothing and keeps the key from the shell', async () => {
    const wrapper = mount(StaticEditableTitle, {
      attachTo: document.body,
      props: { modelValue: 'Orders schema', testId: 'editable-title' },
    })

    const title = wrapper.get('[data-testid="editable-title"]')
    const titleElement = title.element as HTMLElement
    titleElement.focus()
    titleElement.textContent = 'Orders schema revised'
    await title.trigger('input')

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    titleElement.dispatchEvent(escape)
    await wrapper.vm.$nextTick()

    expect(escape.defaultPrevented).toBe(true)
    expect(titleElement.textContent).toBe('Orders schema')
    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Orders schema'])
    expect(document.activeElement).not.toBe(titleElement)
    wrapper.unmount()
  })

  // An in-place edit is a caret in the text, nothing more: Rename must not select the name.
  it('focus() puts the caret at the end of the title, selecting nothing', () => {
    const wrapper = mount(StaticEditableTitle, {
      attachTo: document.body,
      props: { modelValue: 'Aditi', tag: 'span', testId: 'editable-title' },
    })

    ;(wrapper.vm as unknown as { focus: () => void }).focus()

    const titleElement = wrapper.get('[data-testid="editable-title"]').element
    expect(document.activeElement).toBe(titleElement)
    const selection = window.getSelection()!
    expect(selection.isCollapsed).toBe(true)
    expect(selection.toString()).toBe('')
    expect(selection.focusNode && titleElement.contains(selection.focusNode)).toBe(true)
    expect(selection.focusOffset).toBe(selection.focusNode?.nodeType === Node.TEXT_NODE ? 'Aditi'.length : selection.focusNode!.childNodes.length)
    wrapper.unmount()
  })
})
