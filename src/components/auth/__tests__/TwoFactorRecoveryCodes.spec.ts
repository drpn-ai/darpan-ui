import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TwoFactorRecoveryCodes from '../TwoFactorRecoveryCodes.vue'

// DAR-BE-264: the codes are shown once, so Copy has to work where the async clipboard does not.

const CODES = ['aaaa-bbbb-cccc-dddd', 'eeee-ffff-gggg-hhhh']

function stubClipboard(writeText: ((text: string) => Promise<void>) | undefined): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

function stubExecCommand(result: boolean) {
  const execCommand = vi.fn(() => result)
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
  return execCommand
}

describe('TwoFactorRecoveryCodes', () => {
  afterEach(() => {
    stubClipboard(undefined)
  })

  it('copies every code, one per line, with the async clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    const wrapper = mount(TwoFactorRecoveryCodes, { props: { codes: CODES } })

    await wrapper.get('[data-testid="two-factor-codes-copy"]').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('aaaa-bbbb-cccc-dddd\neeee-ffff-gggg-hhhh')
    expect(wrapper.get('[data-testid="two-factor-codes-copy-note"]').text()).toBe('Copied.')
  })

  it('"Copied." goes after a moment, so a second copy says it again', async () => {
    vi.useFakeTimers()
    stubClipboard(vi.fn().mockResolvedValue(undefined))
    const wrapper = mount(TwoFactorRecoveryCodes, { props: { codes: CODES } })

    await wrapper.get('[data-testid="two-factor-codes-copy"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="two-factor-codes-copy-note"]').text()).toBe('Copied.')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-testid="two-factor-codes-copy-note"]').text()).toBe('')
    vi.useRealTimers()
  })

  it('falls back to a textarea copy when the clipboard refuses', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError')))
    const execCommand = stubExecCommand(true)
    const wrapper = mount(TwoFactorRecoveryCodes, { props: { codes: CODES } })

    await wrapper.get('[data-testid="two-factor-codes-copy"]').trigger('click')
    await flushPromises()

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(wrapper.get('[data-testid="two-factor-codes-copy-note"]').text()).toBe('Copied.')
  })

  it('when no copy works, selects the codes and says how to copy them', async () => {
    stubClipboard(undefined)
    stubExecCommand(false)
    const wrapper = mount(TwoFactorRecoveryCodes, { props: { codes: CODES }, attachTo: document.body })

    await wrapper.get('[data-testid="two-factor-codes-copy"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="two-factor-codes-copy-note"]').text()).toBe('Selected. Press Ctrl+C or ⌘C.')
    expect(window.getSelection()?.toString()).toContain('aaaa-bbbb-cccc-dddd')
    wrapper.unmount()
  })
})
