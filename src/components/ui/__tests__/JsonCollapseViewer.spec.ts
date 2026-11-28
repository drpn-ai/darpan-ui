import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import JsonCollapseViewer from '../JsonCollapseViewer.vue'

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function rootToggle() {
  return wrapper!.get('[data-testid="json-collapse-toggle"]')
}

describe('JsonCollapseViewer', () => {
  it('opens collapsed, with the count of what it holds', () => {
    wrapper = mount(JsonCollapseViewer, { props: { value: { orderId: 'A1', lines: [1, 2] } } })
    expect(rootToggle().attributes('aria-expanded')).toBe('false')
    expect(rootToggle().attributes('aria-label')).toBe('Expand JSON object')
    expect(wrapper.text()).toContain('2 keys')
  })

  it('expands and collapses on the same toggle', async () => {
    wrapper = mount(JsonCollapseViewer, { props: { value: { orderId: 'A1' } } })
    await rootToggle().trigger('click')
    expect(rootToggle().attributes('aria-expanded')).toBe('true')
    expect(wrapper.text()).toContain('"orderId": "A1"')
    await rootToggle().trigger('click')
    expect(rootToggle().attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).not.toContain('"orderId"')
  })

  // DAR-OPS-029 U16a. The collapsed and expanded toggles were two buttons in two v-if branches, so pressing one removed
  // the focused element and a keyboard user's focus fell to the page after every expand or collapse.
  it('keeps keyboard focus on the toggle through an expand and a collapse', async () => {
    wrapper = mount(JsonCollapseViewer, { props: { value: { orderId: 'A1' } }, attachTo: document.body })
    const toggle = rootToggle().element as HTMLButtonElement
    toggle.focus()
    await rootToggle().trigger('click')
    expect(rootToggle().element).toBe(toggle)
    expect(document.activeElement).toBe(toggle)
    await rootToggle().trigger('click')
    expect(document.activeElement).toBe(toggle)
  })

  it('shows an empty container as its token, with nothing to toggle', () => {
    wrapper = mount(JsonCollapseViewer, { props: { value: '[]' } })
    expect(wrapper.find('[data-testid="json-collapse-toggle"]').exists()).toBe(false)
    expect(wrapper.text()).toBe('[]')
  })
})
