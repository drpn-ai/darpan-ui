/**
 * DAR-UI-051. Stale-while-revalidate for page reads. Prod is a ~235ms round-trip from India, so a page that
 * waits for its data can never feel instant. A page that opts in renders the copy from its last visit at
 * once, then the fresh answer when it lands.
 *
 * Safety comes from the client, not the callers: callService invalidates the whole cache around every write
 * (save, delete, run, tenant switch, login, logout), so nothing a user changed is ever shown in its old
 * form. The cache is per tab and in memory only. Pollers must not use it: they want the network, every time.
 */

export const READ_CACHE_MAX_AGE_MS = 15 * 60_000
export const READ_CACHE_MAX_ENTRIES = 50

interface Entry {
  value: unknown
  storedAt: number
}

// Map iteration order is insertion order, so re-inserting on use keeps the oldest-used key first.
const entries = new Map<string, Entry>()
// Bumped by every invalidation. A read stores its answer only if no write landed while it was in flight:
// a response that left the server before the write must not outlive it.
let generation = 0

export function invalidateReadCache(): void {
  generation += 1
  entries.clear()
}

function readFresh(key: string): Entry | undefined {
  const entry = entries.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.storedAt > READ_CACHE_MAX_AGE_MS) {
    entries.delete(key)
    return undefined
  }
  entries.delete(key)
  entries.set(key, entry)
  return entry
}

function store(key: string, value: unknown): void {
  entries.delete(key)
  entries.set(key, { value, storedAt: Date.now() })
  while (entries.size > READ_CACHE_MAX_ENTRIES) {
    const oldest = entries.keys().next().value
    if (oldest === undefined) break
    entries.delete(oldest)
  }
}

/**
 * Applies the cached value for `key` synchronously when there is one, then fetches and applies the fresh
 * value. Resolves with the fresh value; a fetch error rejects and leaves the cached copy for the next visit.
 * `key` must name everything the answer depends on — the call and its parameters.
 */
export async function cachedRead<T>(key: string, fetcher: () => Promise<T>, apply: (value: T) => void): Promise<T> {
  const cached = readFresh(key)
  if (cached) apply(cached.value as T)
  const startedAt = generation
  const fresh = await fetcher()
  if (generation === startedAt) store(key, fresh)
  apply(fresh)
  return fresh
}
