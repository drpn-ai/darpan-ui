import { afterEach, describe, expect, it, vi } from 'vitest'
import { cachedRead, invalidateReadCache, READ_CACHE_MAX_AGE_MS, READ_CACHE_MAX_ENTRIES } from '../readCache'

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
