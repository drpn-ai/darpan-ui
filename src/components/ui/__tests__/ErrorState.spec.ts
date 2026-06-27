import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ErrorState from '../ErrorState.vue'

describe('ErrorState', () => {
  it('renders title, message, role=alert, and fires the action onClick', async () => {
    const onClick = vi.fn()
    const wrapper = mount(ErrorState, {
      props: { title: 'super-admin access required', message: 'limited to super-admins', icon: 'lock', action: { label: 'go to darpan', onClick } },
    })
    expect(wrapper.attributes('role')).toBe('alert')
    expect(wrapper.text()).toContain('super-admin access required')
    expect(wrapper.text()).toContain('limited to super-admins')
    await wrapper.get('button').trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders an <a> with the correct href when action.href is given', () => {
    const wrapper = mount(ErrorState, {
      props: { title: 'go home', action: { label: 'go', href: '/x' } },
    })
    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/x')
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('omits the action button when no action is given', () => {
    const wrapper = mount(ErrorState, { props: { title: 'page not found' } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
