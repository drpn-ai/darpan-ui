import { onBeforeUnmount, onMounted, ref } from 'vue'

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'darpan-ui-theme'
const theme = ref<ThemeMode>('dark')
let userSelected = false

function resolveStoredTheme(input: string | null | undefined): ThemeMode | null {
  if (input === 'light' || input === 'dark') return input
  return null
}

function detectSystemTheme(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// With site data blocked even reading window.localStorage throws, and initTheme runs before the app mounts. A storage
// that refuses reads as nothing saved and keeps nothing; the theme still applies (as readCache treats its storage).
function readStoredTheme(): ThemeMode | null {
  try {
    return resolveStoredTheme(window.localStorage?.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function storeTheme(mode: ThemeMode): void {
  try {
    window.localStorage?.setItem(STORAGE_KEY, mode)
  } catch {
    // The choice holds for this visit; it just is not remembered.
  }
}

function applyTheme(mode: ThemeMode, persist: boolean): void {
  theme.value = mode
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', mode)
  }
  if (persist) storeTheme(mode)
}

export function initTheme(): ThemeMode {
  const stored = typeof window !== 'undefined' ? readStoredTheme() : null
  if (stored) {
    userSelected = true
    applyTheme(stored, true)
    return stored
  }

  const initial = detectSystemTheme()
  applyTheme(initial, false)
  return initial
}

export interface UseTheme {
  theme: typeof theme
  setTheme: (mode: ThemeMode) => void
  toggleTheme: () => void
}

export function useTheme(): UseTheme {
  let mediaQuery: MediaQueryList | null = null
  const handleSystemThemeChange = (event: MediaQueryListEvent): void => {
    if (userSelected) return
    applyTheme(event.matches ? 'light' : 'dark', false)
  }

  onMounted(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    mediaQuery = window.matchMedia('(prefers-color-scheme: light)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  })

  onBeforeUnmount(() => {
    if (!mediaQuery) return
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
    mediaQuery = null
  })

  const setTheme = (mode: ThemeMode): void => {
    userSelected = true
    applyTheme(mode, true)
  }

  const toggleTheme = (): void => {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme,
    setTheme,
    toggleTheme,
  }
}
