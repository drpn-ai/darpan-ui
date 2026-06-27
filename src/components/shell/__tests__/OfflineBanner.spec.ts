import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import OfflineBanner from '../OfflineBanner.vue'

describe('OfflineBanner', () => {
  beforeEach(() => {
    // Restore real navigator.onLine to true between tests
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when online (zero DOM impact)', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    const wrapper = mount(OfflineBanner)
    expect(wrapper.find('.offline-banner').exists()).toBe(false)
    expect(wrapper.html()).toBe('<!--v-if-->')
  })

  it('shows the banner when navigator.onLine is false at mount', () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })
    const wrapper = mount(OfflineBanner)
    expect(wrapper.find('.offline-banner').exists()).toBe(true)
    expect(wrapper.text()).toMatch(/offline/i)
  })

  it('shows the banner when the offline event fires', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    const wrapper = mount(OfflineBanner)
    expect(wrapper.find('.offline-banner').exists()).toBe(false)

    window.dispatchEvent(new Event('offline'))
    await nextTick()
    expect(wrapper.find('.offline-banner').exists()).toBe(true)
  })

  it('hides the banner and emits reconnect when the online event fires', async () => {
    vi.stubGlobal('navigator', { ...navigator, onLine: false })
    const wrapper = mount(OfflineBanner)
    expect(wrapper.find('.offline-banner').exists()).toBe(true)

    window.dispatchEvent(new Event('online'))
    await nextTick()
    expect(wrapper.find('.offline-banner').exists()).toBe(false)
    expect(wrapper.emitted('reconnect')).toBeTruthy()
    expect(wrapper.emitted('reconnect')!.length).toBe(1)
  })

  it('removes event listeners on unmount (no leak)', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    vi.stubGlobal('navigator', { ...navigator, onLine: true })
    const wrapper = mount(OfflineBanner)

    const onlineAdded = addSpy.mock.calls.some(([type]) => type === 'online')
    const offlineAdded = addSpy.mock.calls.some(([type]) => type === 'offline')
    expect(onlineAdded).toBe(true)
    expect(offlineAdded).toBe(true)

    wrapper.unmount()

    const onlineRemoved = removeSpy.mock.calls.some(([type]) => type === 'online')
    const offlineRemoved = removeSpy.mock.calls.some(([type]) => type === 'offline')
    expect(onlineRemoved).toBe(true)
    expect(offlineRemoved).toBe(true)
  })
})
