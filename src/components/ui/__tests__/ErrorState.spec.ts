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

  it('omits the action button when no action is given', () => {
    const wrapper = mount(ErrorState, { props: { title: 'page not found' } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})
