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
      // DAR-UI-057: the read cache enumerates its stored entries, as on a real Storage.
      get length() {
        return store.size
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    },
  })
}

export function installLocalStorageStub(): void {
  // Installs fresh, isolated stubs for BOTH web storages. The auth bearer token now lives in
  // sessionStorage (audit #10 hardening), so token-storage tests need a clean sessionStorage per run.
  installMapBackedStorage('localStorage')
  installMapBackedStorage('sessionStorage')
}
