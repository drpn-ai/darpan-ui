import { mount, RouterLinkStub } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StaticPageTile from '../StaticPageTile.vue'

// DAR-OPS-029 S99-124. One pinnable tile (a link, a title, draggable when it can be pinned) for the home page's runs and
// the queries page, which wrote the same RouterLink four times.
describe('StaticPageTile', () => {
  function tile(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
    return mount(StaticPageTile, { props: { to: '/runs/R1', title: 'Daily orders', draggable: false, ...props }, attrs, global: { stubs: { RouterLink: RouterLinkStub } } })
  }

  it('links to its route with its title, draggable only when it can be pinned', () => {
    const pinnable = tile({ draggable: true })
    expect(pinnable.getComponent(RouterLinkStub).props('to')).toBe('/runs/R1')
    expect(pinnable.text()).toBe('Daily orders')
    expect(pinnable.classes()).toContain('static-page-tile')
    expect(pinnable.attributes('draggable')).toBe('true')
    expect(tile({ draggable: false }).attributes('draggable')).toBe('false')
  })

  it('hands the drag start up and lets the page put its own data attribute on the link', async () => {
    const wrapper = tile({ draggable: true }, { 'data-flow-id': 'R1' })
    expect(wrapper.attributes('data-flow-id')).toBe('R1')
    await wrapper.trigger('dragstart')
    expect(wrapper.emitted('dragstart')).toHaveLength(1)
  })
})
