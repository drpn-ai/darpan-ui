import { describe, it, expect, vi } from 'vitest'
import { mount, RouterLinkStub } from '@vue/test-utils'
import EmptyState from '../EmptyState.vue'

describe('EmptyState', () => {
  it('renders title and description with no icon/action and stays the plain block', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No automations', description: 'nothing here yet' },
    })
    expect(wrapper.text()).toContain('No automations')
    expect(wrapper.text()).toContain('nothing here yet')
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.find('.empty-state__icon').exists()).toBe(false)
    expect(wrapper.classes()).not.toContain('empty-state--cta')
  })

  it('renders an icon and switches to the centered treatment when an icon is given', () => {
    const wrapper = mount(EmptyState, { props: { title: 'No runs available', icon: 'inbox' } })
    expect(wrapper.find('.empty-state__icon').exists()).toBe(true)
    expect(wrapper.classes()).toContain('empty-state--cta')
  })

  it('renders a RouterLink CTA when action.to is given', () => {
    const wrapper = mount(EmptyState, {
      props: {
        title: 'No runs available',
        action: { label: 'Create a run', to: { name: 'reconciliation-create' } },
      },
      global: { stubs: { RouterLink: RouterLinkStub } },
    })
    const link = wrapper.findComponent(RouterLinkStub)
    expect(link.exists()).toBe(true)
    expect(link.props('to')).toEqual({ name: 'reconciliation-create' })
    expect(link.text()).toContain('Create a run')
    expect(wrapper.classes()).toContain('empty-state--cta')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('renders an <a> CTA when action.href is given', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'x', action: { label: 'go', href: '/y' } },
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/y')
  })

  it('fires action.onClick when the CTA button is pressed', async () => {
    const onClick = vi.fn()
    const wrapper = mount(EmptyState, { props: { title: 'x', action: { label: 'do', onClick } } })
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
