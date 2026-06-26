function installMapBackedStorage(property: 'localStorage' | 'sessionStorage'): void {
  const store = new Map<string, string>()

  Object.defineProperty(window, property, {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value))
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
    },
  })
}

export function installLocalStorageStub(): void {
  // Installs fresh, isolated stubs for BOTH web storages. The auth bearer token now lives in
  // sessionStorage (audit #10 hardening), so token-storage tests need a clean sessionStorage per run.
  installMapBackedStorage('localStorage')
  installMapBackedStorage('sessionStorage')
}
