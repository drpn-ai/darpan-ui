import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../../test/localStorage'

// DAR-UI-057. The stored layer has to outlive the module: a reload or a new tab starts with an empty
// in-memory cache, so every "next visit" below re-imports readCache over the same localStorage.
function storedNames(): string[] {
  const names: string[] = []
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const name = window.localStorage.key(i)
    if (name?.startsWith('darpan.reads.')) names.push(name)
  }
  return names
}

async function freshTab() {
  vi.resetModules()
  return import('../readCache')
}

describe('stored reads (DAR-UI-057)', () => {
  beforeEach(() => installLocalStorageStub())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('serves a final answer on the next visit without asking the network', async () => {
    const first = await freshTab()
    first.setReadCacheScope('alice|GORJANA')
    first.storeFinal('lifecycle.execution:e1', { results: [{ id: 'r1' }] })

    const next = await freshTab()
    next.setReadCacheScope('alice|GORJANA')
    expect(next.readFinal('lifecycle.execution:e1')).toEqual({ results: [{ id: 'r1' }] })
  })

  it('keeps a final answer through a write, which cannot change it', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    cache.storeFinal('lifecycle.execution:e1', 'done')
    cache.invalidateReadCache()
    expect(cache.readFinal('lifecycle.execution:e1')).toBe('done')
  })

  it('never serves one user or tenant another scope\'s answer', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    cache.storeFinal('lifecycle.execution:e1', 'gorjana')
    cache.setReadCacheScope('alice|KREWE')
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
    cache.setReadCacheScope('bob|GORJANA')
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
  })

  it('reads and writes nothing while signed out', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope(null)
    cache.storeFinal('lifecycle.execution:e1', 'x')
    expect(window.localStorage.length).toBe(0)
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
  })

  it('clearStoredReads removes every stored read, and nothing else', async () => {
    window.localStorage.setItem('darpan.recentCommands', '["a"]')
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    cache.storeFinal('lifecycle.execution:e1', 'x')
    await cache.cachedRead('lifecycle.chart:100051', () => Promise.resolve('chart'), () => {}, { persist: true })
    cache.clearStoredReads()
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
    expect(window.localStorage.getItem('darpan.recentCommands')).toBe('["a"]')
    expect(storedNames()).toEqual([])
  })

  it('draws a persisted read from the last visit in a new tab, then the fresh answer', async () => {
    const first = await freshTab()
    first.setReadCacheScope('alice|GORJANA')
    await first.cachedRead('lifecycle.chart:100051', () => Promise.resolve('old chart'), () => {}, { persist: true })

    const next = await freshTab()
    next.setReadCacheScope('alice|GORJANA')
    const apply = vi.fn()
    await next.cachedRead('lifecycle.chart:100051', () => Promise.resolve('new chart'), apply, { persist: true })
    expect(apply.mock.calls).toEqual([['old chart'], ['new chart']])
  })

  it('does not persist a read that did not opt in', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    await cache.cachedRead('settings.list', () => Promise.resolve('v'), () => {})
    expect(storedNames()).toEqual([])
  })

  it('drops persisted (changeable) reads on a write, so an edit is never shown in its old form', async () => {
    const first = await freshTab()
    first.setReadCacheScope('alice|GORJANA')
    await first.cachedRead('lifecycle.chart:100051', () => Promise.resolve('old chart'), () => {}, { persist: true })
    first.invalidateReadCache()

    const next = await freshTab()
    next.setReadCacheScope('alice|GORJANA')
    const apply = vi.fn()
    await next.cachedRead('lifecycle.chart:100051', () => Promise.resolve('new chart'), apply, { persist: true })
    expect(apply.mock.calls).toEqual([['new chart']])
  })

  it('ignores a persisted read older than its maximum age', async () => {
    vi.useFakeTimers()
    const first = await freshTab()
    first.setReadCacheScope('alice|GORJANA')
    await first.cachedRead('lifecycle.chart:100051', () => Promise.resolve('old chart'), () => {}, { persist: true })
    vi.advanceTimersByTime(first.STORED_LAST_MAX_AGE_MS + 1)

    const next = await freshTab()
    next.setReadCacheScope('alice|GORJANA')
    const apply = vi.fn()
    await next.cachedRead('lifecycle.chart:100051', () => Promise.resolve('new chart'), apply, { persist: true })
    expect(apply.mock.calls).toEqual([['new chart']])
  })

  it('keeps at most STORED_READ_MAX_ENTRIES, dropping the oldest', async () => {
    vi.useFakeTimers()
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    for (let i = 0; i <= cache.STORED_READ_MAX_ENTRIES; i += 1) {
      cache.storeFinal(`lifecycle.execution:e${i}`, i)
      vi.advanceTimersByTime(1)
    }
    expect(storedNames().length).toBe(cache.STORED_READ_MAX_ENTRIES)
    expect(cache.readFinal('lifecycle.execution:e0')).toBeUndefined()
    expect(cache.readFinal(`lifecycle.execution:e${cache.STORED_READ_MAX_ENTRIES}`)).toBe(cache.STORED_READ_MAX_ENTRIES)
  })

  it('survives a storage that throws (private mode, quota) as a plain cache miss', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    expect(() => cache.storeFinal('lifecycle.execution:e1', 'x')).not.toThrow()
    setItem.mockRestore()
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
  })
  // Security review of 36a26fd: a read that started under one user or tenant must never be stored under the
  // next one's scope (Alice's in-flight read landing after Bob signs in on the same browser).
  it('does not store a final answer whose read began under another scope', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    const token = cache.readCacheScopeToken()
    cache.setReadCacheScope('bob|GORJANA')
    cache.storeFinal('lifecycle.execution:e1', 'alice data', token)
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
    expect(storedNames()).toEqual([])
  })

  it('does not persist a read that landed after the scope changed, joined prefetch included', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    let release!: (v: string) => void
    const slow = new Promise<string>((res) => { release = res })
    void cache.prefetchQuery({ key: 'lifecycle.chart:100051', fetch: () => slow })
    const joined = cache.cachedRead('lifecycle.chart:100051', () => Promise.resolve('unused'), () => {}, { persist: true })
    const direct = cache.cachedRead('lifecycle.executions:100051', () => slow, () => {}, { persist: true })
    cache.invalidateReadCache()
    cache.setReadCacheScope('bob|GORJANA')
    release('alice data')
    await Promise.all([joined, direct])
    expect(storedNames()).toEqual([])
  })

  it('does not serve a final answer older than its maximum age', async () => {
    vi.useFakeTimers()
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    cache.storeFinal('lifecycle.execution:e1', 'x')
    vi.advanceTimersByTime(cache.STORED_FINAL_MAX_AGE_MS + 1)
    expect(cache.readFinal('lifecycle.execution:e1')).toBeUndefined()
  })
})

// DAR-UI-050. What a customer's NetSuite says about itself (a record type's fields, the values each holds) cannot be
// changed by a Darpan write, so a form's pickers are drawn from it without asking again.
describe('account metadata (DAR-UI-050)', () => {
  beforeEach(() => installLocalStorageStub())
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('asks once, then serves the answer through writes and on the next visit', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    const fetch = vi.fn(async () => ({ fields: ['f1'] }))
    const query = { key: 'lifecycle.ruleFields::ns:SalesOrd', fetch }
    const [a, b] = await Promise.all([cache.readAccountMeta(query), cache.readAccountMeta(query)])
    expect(a).toEqual({ fields: ['f1'] })
    expect(b).toEqual({ fields: ['f1'] })
    cache.invalidateReadCache()
    expect(await cache.readAccountMeta(query)).toEqual({ fields: ['f1'] })
    expect(fetch).toHaveBeenCalledTimes(1)

    const next = await freshTab()
    next.setReadCacheScope('alice|GORJANA')
    expect(next.peekAccountMeta(query.key)).toEqual({ fields: ['f1'] })
  })

  it('never serves another user or tenant, and ages out', async () => {
    vi.useFakeTimers()
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    cache.storeAccountMeta('lifecycle.ruleValues::ns:SalesOrd', { f1: [] })
    cache.setReadCacheScope('alice|KREWE')
    expect(cache.peekAccountMeta('lifecycle.ruleValues::ns:SalesOrd')).toBeUndefined()
    cache.setReadCacheScope('alice|GORJANA')
    expect(cache.peekAccountMeta('lifecycle.ruleValues::ns:SalesOrd')).toEqual({ f1: [] })
    vi.advanceTimersByTime(cache.STORED_META_MAX_AGE_MS + 1)
    expect(cache.peekAccountMeta('lifecycle.ruleValues::ns:SalesOrd')).toBeUndefined()
  })

  it('goes with login, logout and tenant switch', async () => {
    const cache = await freshTab()
    cache.setReadCacheScope('alice|GORJANA')
    cache.storeAccountMeta('lifecycle.ruleValues::ns:SalesOrd', { f1: [] })
    cache.clearStoredReads()
    expect(cache.peekAccountMeta('lifecycle.ruleValues::ns:SalesOrd')).toBeUndefined()
    expect(storedNames()).toEqual([])
  })
})
