import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TenantSwitchBanner from '../TenantSwitchBanner.vue'
import { useAuthStore } from '../../../stores/auth'

describe('TenantSwitchBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nothing when no deep link switched the tenant', () => {
    const wrapper = mount(TenantSwitchBanner)

    expect(wrapper.find('.tenant-switch-banner').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })

  it('names the tenant it switched into', async () => {
    const store = useAuthStore()
    store.noteDeepLinkTenantSwitch('Gorjana')

    const wrapper = mount(TenantSwitchBanner)
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.tenant-switch-banner').exists()).toBe(true)
    expect(wrapper.text()).toContain('Gorjana')
  })

  it('warns that the change reaches other tabs', async () => {
    const store = useAuthStore()
    store.noteDeepLinkTenantSwitch('Gorjana')

    const wrapper = mount(TenantSwitchBanner)
    await wrapper.vm.$nextTick()

    // The cross-tab effect is the whole reason this banner exists.
    expect(wrapper.text().toLowerCase()).toContain('other tabs')
  })
})
