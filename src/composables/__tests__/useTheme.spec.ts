import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { installLocalStorageStub } from '../../test/localStorage'
import { initTheme, useTheme, type UseTheme } from '../useTheme'

// Mount the composable inside a throwaway component so onMounted/onBeforeUnmount
// attach to a real instance. Calling useTheme() bare (outside setup) drops those
// hooks and emits "no active component instance" warnings.
function withSetup(): { result: UseTheme; unmount: () => void } {
  let result!: UseTheme
  const wrapper = mount(
    defineComponent({
      setup() {
        result = useTheme()
        return () => h('div')
      },
    }),
  )
  return { result, unmount: () => wrapper.unmount() }
}

function stubMatchMedia(matches: boolean) {
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener,
    removeEventListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  } as unknown as MediaQueryList))
  return { addEventListener, removeEventListener }
}

describe('useTheme', () => {
  beforeEach(() => {
    installLocalStorageStub()
    document.documentElement.removeAttribute('data-theme')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initTheme returns the stored theme when one is saved', () => {
    localStorage.setItem('darpan-ui-theme', 'light')
    expect(initTheme()).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('initTheme falls back to the system preference when nothing is saved', () => {
    stubMatchMedia(true)
    expect(initTheme()).toBe('light')
  })

  it('toggleTheme persists the new value and inverts state', () => {
    initTheme()
    const { result, unmount } = withSetup()
    const before = result.theme.value
    result.toggleTheme()
    expect(result.theme.value).not.toBe(before)
    expect(localStorage.getItem('darpan-ui-theme')).toBe(result.theme.value)
    unmount()
  })

  it('setTheme persists the chosen mode', () => {
    initTheme()
    const { result, unmount } = withSetup()
    result.setTheme('dark')
    expect(result.theme.value).toBe('dark')
    expect(localStorage.getItem('darpan-ui-theme')).toBe('dark')
    unmount()
  })

  it('registers a system-theme listener on mount and removes it on unmount', () => {
    const { addEventListener, removeEventListener } = stubMatchMedia(false)
    const { unmount } = withSetup()
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(removeEventListener).not.toHaveBeenCalled()
    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
