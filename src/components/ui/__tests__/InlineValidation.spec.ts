import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import InlineValidation from '../InlineValidation.vue'

describe('InlineValidation', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps an error visible indefinitely', async () => {
    // Prod 2026-08-05: a run-now failure surfaced 61s after the click and used to auto-hide 10s
    // later, so the user saw nothing at all. An error must stay until something replaces it.
    vi.useFakeTimers()
    const wrapper = mount(InlineValidation, {
      props: {
        tone: 'error',
        message: 'HotWax: OMS REST request failed with status 404.',
      },
    })

    expect(wrapper.text()).toContain('HotWax: OMS REST request failed with status 404.')

    vi.advanceTimersByTime(60_000)
    await nextTick()
    expect(wrapper.find('.inline-validation').exists()).toBe(true)
    expect(wrapper.text()).toContain('HotWax: OMS REST request failed with status 404.')
  })

  it('stays visible across an error message change, arbitrarily long after mount', async () => {
    vi.useFakeTimers()
    const wrapper = mount(InlineValidation, {
      props: {
        tone: 'error',
        message: 'First error',
      },
    })

    vi.advanceTimersByTime(9_000)
    await wrapper.setProps({ message: 'Second error' })
    vi.advanceTimersByTime(60_000)
    await nextTick()

    expect(wrapper.find('.inline-validation').exists()).toBe(true)
    expect(wrapper.text()).toContain('Second error')
  })

  it('keeps non-error messages visible', async () => {
    vi.useFakeTimers()
    const wrapper = mount(InlineValidation, {
      props: {
        tone: 'info',
        message: 'Nothing to reconcile yet.',
      },
    })

    vi.advanceTimersByTime(10_000)
    await nextTick()

    expect(wrapper.text()).toContain('Nothing to reconcile yet.')
  })
})
