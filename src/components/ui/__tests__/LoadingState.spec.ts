import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingState from '../LoadingState.vue'
import { LOADING_LINE_MS, loadingLines } from '../loadingLines'

describe('LoadingState (DAR-UI-083)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('every line keeps the noun', () => {
    for (const line of loadingLines('audit')) expect(line).toContain('audit')
  })

  it('announces a plain "Loading <noun>" and hides the joke from screen readers', () => {
    const wrapper = mount(LoadingState, { props: { noun: 'audit' } })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.get('.sr-only').text()).toBe('Loading audit')
    expect(wrapper.get('.loading-state__line').attributes('aria-hidden')).toBe('true')
  })

  it('moves to the next line while the load runs, and stops when it unmounts', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const lines = loadingLines('run')
    const wrapper = mount(LoadingState, { props: { noun: 'run' } })
    expect(wrapper.get('.loading-state__line').text()).toBe(lines[0])

    await vi.advanceTimersByTimeAsync(LOADING_LINE_MS)
    expect(wrapper.get('.loading-state__line').text()).toBe(lines[1])

    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
