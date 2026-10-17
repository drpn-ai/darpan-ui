import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedRead, invalidateReadCache, prefetchQuery, readQueryOnce, READ_CACHE_MAX_AGE_MS, READ_CACHE_MAX_ENTRIES } from '../readCache'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('cachedRead', () => {
  afterEach(() => {
    invalidateReadCache()
    vi.useRealTimers()
  })

  it('applies only the fresh value on a first read', async () => {
    const apply = vi.fn()
    await expect(cachedRead('k', () => Promise.resolve('fresh'), apply)).resolves.toBe('fresh')
    expect(apply.mock.calls).toEqual([['fresh']])
  })

  it('applies the cached value before the network answers, then the fresh one', async () => {
    await cachedRead('k', () => Promise.resolve('first'), () => {})
    const pending = deferred<string>()
    const apply = vi.fn()
    const done = cachedRead('k', () => pending.promise, apply)
    // Synchronous: the page renders the last known data without waiting a round-trip.
    expect(apply.mock.calls).toEqual([['first']])
    pending.resolve('second')
    await done
    expect(apply.mock.calls).toEqual([['first'], ['second']])
  })

  it('keeps keys apart', async () => {
    await cachedRead('a', () => Promise.resolve('A'), () => {})
    const apply = vi.fn()
    await cachedRead('b', () => Promise.resolve('B'), apply)
    expect(apply.mock.calls).toEqual([['B']])
  })

  it('shows nothing cached after a write invalidated it', async () => {
    await cachedRead('k', () => Promise.resolve('before'), () => {})
    invalidateReadCache()
    const apply = vi.fn()
    await cachedRead('k', () => Promise.resolve('after'), apply)
    expect(apply.mock.calls).toEqual([['after']])
  })

  it('does not store a read that was in flight when a write landed', async () => {
    const pending = deferred<string>()
    const inFlight = cachedRead('k', () => pending.promise, () => {})
    invalidateReadCache()
    pending.resolve('pre-write')
    await inFlight
    const apply = vi.fn()
    await cachedRead('k', () => Promise.resolve('post-write'), apply)
    expect(apply.mock.calls).toEqual([['post-write']])
  })

  it('still hands the in-flight value to the page that asked for it', async () => {
    const pending = deferred<string>()
    const apply = vi.fn()
    const inFlight = cachedRead('k', () => pending.promise, apply)
    invalidateReadCache()
    pending.resolve('pre-write')
    await expect(inFlight).resolves.toBe('pre-write')
    expect(apply.mock.calls).toEqual([['pre-write']])
  })

  it('rejects with the fetch error and keeps the cached copy for next time', async () => {
    await cachedRead('k', () => Promise.resolve('good'), () => {})
    await expect(cachedRead('k', () => Promise.reject(new Error('down')), () => {})).rejects.toThrow('down')
    const apply = vi.fn()
    const pending = deferred<string>()
    const done = cachedRead('k', () => pending.promise, apply)
    expect(apply.mock.calls).toEqual([['good']])
    pending.resolve('back')
    await done
  })

  it('does not show a copy older than the max age', async () => {
    vi.useFakeTimers()
    await cachedRead('k', () => Promise.resolve('old'), () => {})
    vi.advanceTimersByTime(READ_CACHE_MAX_AGE_MS + 1)
    const apply = vi.fn()
    await cachedRead('k', () => Promise.resolve('new'), apply)
    expect(apply.mock.calls).toEqual([['new']])
  })

  it('evicts the least recently used key past the entry cap', async () => {
    for (let i = 0; i <= READ_CACHE_MAX_ENTRIES; i++) {
      await cachedRead(`k${i}`, () => Promise.resolve(i), () => {})
    }
    const evicted = vi.fn()
    await cachedRead('k0', () => Promise.resolve(-1), evicted)
    expect(evicted.mock.calls).toEqual([[-1]])
    const kept = vi.fn()
    await cachedRead(`k${READ_CACHE_MAX_ENTRIES}`, () => Promise.resolve(-2), kept)
    expect(kept.mock.calls[0]).toEqual([READ_CACHE_MAX_ENTRIES])
  })
})

describe('shared queries (DAR-UI-051 round 3)', () => {
  afterEach(() => {
    invalidateReadCache()
    vi.useRealTimers()
  })

  it('prefetchQuery warms the cache that a page then draws from', async () => {
    await prefetchQuery({ key: 'q', fetch: () => Promise.resolve('warm') })
    const apply = vi.fn()
    const pending = deferred<string>()
    const done = cachedRead('q', () => pending.promise, apply)
    expect(apply.mock.calls).toEqual([['warm']])
    pending.resolve('fresh')
    await done
  })

  it('a page joins a prefetch still in flight instead of asking twice', async () => {
    const pending = deferred<string>()
    const fetch = vi.fn(() => pending.promise)
    void prefetchQuery({ key: 'q', fetch })
    const pageFetch = vi.fn(() => Promise.resolve('page'))
    const apply = vi.fn()
    const done = cachedRead('q', pageFetch, apply)
    pending.resolve('shared')
    await expect(done).resolves.toBe('shared')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(pageFetch).not.toHaveBeenCalled()
    expect(apply.mock.calls).toEqual([['shared']])
  })

  it('two prefetches of one key make one request', async () => {
    const fetch = vi.fn(() => Promise.resolve('x'))
    await Promise.all([prefetchQuery({ key: 'q', fetch }), prefetchQuery({ key: 'q', fetch })])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('prefetchQuery skips a key it already holds fresh', async () => {
    const fetch = vi.fn(() => Promise.resolve('x'))
    await prefetchQuery({ key: 'q', fetch })
    await prefetchQuery({ key: 'q', fetch })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('prefetchQuery swallows a failure and stores nothing', async () => {
    await expect(prefetchQuery({ key: 'q', fetch: () => Promise.reject(new Error('down')) })).resolves.toBeUndefined()
    const apply = vi.fn()
    await cachedRead('q', () => Promise.resolve('fresh'), apply)
    expect(apply.mock.calls).toEqual([['fresh']])
  })

  it('a write during a prefetch keeps its answer out of the cache', async () => {
    const pending = deferred<string>()
    const prefetched = prefetchQuery({ key: 'q', fetch: () => pending.promise })
    invalidateReadCache()
    pending.resolve('pre-write')
    await prefetched
    const apply = vi.fn()
    await cachedRead('q', () => Promise.resolve('post-write'), apply)
    expect(apply.mock.calls).toEqual([['post-write']])
  })

  it('readQueryOnce answers from a recent copy without the network', async () => {
    await prefetchQuery({ key: 'q', fetch: () => Promise.resolve('recent') })
    const fetch = vi.fn(() => Promise.resolve('network'))
    await expect(readQueryOnce({ key: 'q', fetch }, 60_000)).resolves.toBe('recent')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('readQueryOnce goes to the network when the copy is older than its limit, and stores the answer', async () => {
    vi.useFakeTimers()
    await prefetchQuery({ key: 'q', fetch: () => Promise.resolve('old') })
    vi.advanceTimersByTime(60_001)
    await expect(readQueryOnce({ key: 'q', fetch: () => Promise.resolve('new') }, 60_000)).resolves.toBe('new')
    await expect(readQueryOnce({ key: 'q', fetch: () => Promise.resolve('unused') }, 60_000)).resolves.toBe('new')
  })

  it('readQueryOnce rejects with the fetch error', async () => {
    await expect(readQueryOnce({ key: 'q', fetch: () => Promise.reject(new Error('down')) })).rejects.toThrow('down')
  })
})
