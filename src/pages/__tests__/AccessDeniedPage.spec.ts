import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AccessDeniedPage from '../AccessDeniedPage.vue'

describe('AccessDeniedPage', () => {
  it('shows the access-denied state without leaking internal detail', () => {
    const wrapper = mount(AccessDeniedPage, { global: { stubs: { RouterLink: true } } })
    expect(wrapper.find('.error-state').exists()).toBe(true)
    expect(wrapper.text()).toContain('super-admin access required')
    expect(wrapper.text()).not.toMatch(/component:\/\/|403|exception/i)
  })
})
