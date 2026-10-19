/**
 * DAR-UI-051. Stale-while-revalidate for page reads. Prod is a ~235ms round-trip from India, so a page that
 * waits for its data can never feel instant. A page that opts in renders the copy from its last visit at
 * once, then the fresh answer when it lands. Prefetches (src/router/dataPrefetch.ts) warm the same entries
 * before a page opens, so a first visit can be instant too.
 *
 * Safety comes from the client, not the callers: callService invalidates the whole cache around every write
 * (save, delete, run, tenant switch, login, logout), so nothing a user changed is ever shown in its old
 * form. The cache is per tab and in memory, except the stored kinds below (DAR-UI-057). Pollers must not use
 * it: they want the network, every time.
 */

export const READ_CACHE_MAX_AGE_MS = 15 * 60_000
export const READ_CACHE_MAX_ENTRIES = 50
/** A prefetch leaves alone a key it fetched this recently: hovering the same link twice asks once. */
export const PREFETCH_FRESH_MS = 30_000
/** readQueryOnce trusts a copy this recent outright: long enough to cover a prefetch and the click after it. */
export const READ_ONCE_FRESH_MS = 60_000

/** A read any caller can name and run: a page, a prefetch, or both racing for the same key. */
export interface ReadQuery<T> {
  /** Must name everything the answer depends on — the call and its parameters. */
  key: string
  fetch: (signal?: AbortSignal) => Promise<T>
}

interface Entry {
  value: unknown
  storedAt: number
}

// Map iteration order is insertion order, so re-inserting on use keeps the oldest-used key first.
const entries = new Map<string, Entry>()
// Bumped by every invalidation. A read stores its answer only if no write landed while it was in flight:
// a response that left the server before the write must not outlive it.
let generation = 0
// Shared fetches only: they carry no page's abort signal, so a page that joins one is never handed an
// AbortError from a page that has since closed.
const inFlight = new Map<string, { generation: number; promise: Promise<unknown> }>()

/*
 * DAR-UI-057. The in-memory cache starts empty on every reload and every new tab, so a page opened from a
 * link always waited for the network. Two stored kinds, in localStorage, keyed by the signed-in user and
 * active tenant (setReadCacheScope) and wiped on login, logout and tenant switch (clearStoredReads, from
 * the API cache-reset coordinator in main.ts):
 *   - final: an answer that can never change again, such as a finished execution. Served without asking
 *     the network, and kept through writes.
 *   - last: an opted-in read's copy from the last visit, drawn first and then replaced by the fresh answer,
 *     like the in-memory copy. Dropped by every write, as the in-memory cache is.
 * Storage that throws (private mode, quota) reads as a miss and never fails a page.
 */
const STORED_PREFIX = 'darpan.reads.v1:'
const FINAL = 'final:'
const LAST = 'last:'
export const STORED_READ_MAX_ENTRIES = 40
export const STORED_LAST_MAX_AGE_MS = 7 * 24 * 60 * 60_000

let storedScope: string | null = null

/** The signed-in user and active tenant, or null while signed out: nothing is stored or served without one. */
export function setReadCacheScope(scope: string | null): void {
  storedScope = scope
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage ?? null
  } catch {
    return null
  }
}

function storedKeys(prefix: string): string[] {
  const store = storage()
  if (!store) return []
  const keys: string[] = []
  try {
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i)
      if (key?.startsWith(prefix)) keys.push(key)
    }
  } catch {
    return []
  }
  return keys
}

function storedKey(kind: string, key: string): string | null {
  return storedScope ? `${STORED_PREFIX}${kind}${storedScope}|${key}` : null
}

function readStored(kind: string, key: string, maxAgeMs?: number): Entry | undefined {
  const name = storedKey(kind, key)
  if (!name) return undefined
  try {
    const raw = storage()?.getItem(name)
    if (!raw) return undefined
    const entry = JSON.parse(raw) as Entry
    if (maxAgeMs !== undefined && Date.now() - entry.storedAt > maxAgeMs) {
      storage()?.removeItem(name)
      return undefined
    }
    return entry
  } catch {
    return undefined
  }
}

function writeStored(kind: string, key: string, value: unknown): void {
  const name = storedKey(kind, key)
  const store = storage()
  if (!name || !store) return
  try {
    store.setItem(name, JSON.stringify({ value, storedAt: Date.now() } satisfies Entry))
  } catch {
    return
  }
  // Oldest first, across both kinds: the newest STORED_READ_MAX_ENTRIES survive.
  const aged = storedKeys(STORED_PREFIX).map((k) => {
    try {
      return { k, at: (JSON.parse(store.getItem(k) ?? '') as Entry).storedAt }
    } catch {
      return { k, at: 0 }
    }
  }).sort((a, b) => a.at - b.at)
  try {
    for (const { k } of aged.slice(0, Math.max(0, aged.length - STORED_READ_MAX_ENTRIES))) store.removeItem(k)
  } catch {
    // A failed prune leaves extra entries, never a wrong one.
  }
}

/** Every stored read, of every scope. Called on login, logout and tenant switch. */
export function clearStoredReads(kind?: typeof FINAL | typeof LAST): void {
  const store = storage()
  if (!store) return
  try {
    for (const key of storedKeys(STORED_PREFIX + (kind ?? ''))) store.removeItem(key)
  } catch {
    // Nothing to do: storage that cannot be cleared cannot be read back either.
  }
}

/** A final answer stored by an earlier visit, or undefined. */
export function readFinal<T>(key: string): T | undefined {
  return readStored(FINAL, key)?.value as T | undefined
}

/** Stores an answer that can never change again. Only call it once that is certain. */
export function storeFinal(key: string, value: unknown): void {
  writeStored(FINAL, key, value)
}

export function invalidateReadCache(): void {
  generation += 1
  entries.clear()
  inFlight.clear()
  clearStoredReads(LAST)
}

function readFresh(key: string, maxAgeMs = READ_CACHE_MAX_AGE_MS): Entry | undefined {
  const entry = entries.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.storedAt > maxAgeMs) {
    if (maxAgeMs >= READ_CACHE_MAX_AGE_MS) entries.delete(key)
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

function joinable<T>(key: string): Promise<T> | undefined {
  const running = inFlight.get(key)
  return running && running.generation === generation ? (running.promise as Promise<T>) : undefined
}

/** One network read per key at a time, stored when it lands. Joins one already in flight. */
function fetchShared<T>(query: ReadQuery<T>): Promise<T> {
  const running = joinable<T>(query.key)
  if (running) return running
  const startedAt = generation
  const promise: Promise<T> = query.fetch().then((value) => {
    if (generation === startedAt) store(query.key, value)
    return value
  }).finally(() => {
    if (inFlight.get(query.key)?.promise === promise) inFlight.delete(query.key)
  })
  inFlight.set(query.key, { generation: startedAt, promise })
  return promise
}

/**
 * Applies the cached value for `key` synchronously when there is one, then fetches and applies the fresh
 * value. Resolves with the fresh value; a fetch error rejects and leaves the cached copy for the next visit.
 * A prefetch of the same key still in flight is joined rather than asked again.
 * `key` must name everything the answer depends on — the call and its parameters.
 * `persist` (DAR-UI-057) also keeps the copy in localStorage, so a reload or a new tab can draw it.
 */
export async function cachedRead<T>(
  key: string, fetcher: () => Promise<T>, apply: (value: T) => void, options: { persist?: boolean } = {},
): Promise<T> {
  const cached = readFresh(key) ?? (options.persist ? readStored(LAST, key, STORED_LAST_MAX_AGE_MS) : undefined)
  if (cached) apply(cached.value as T)
  const joined = joinable<T>(key)
  if (joined) {
    const shared = await joined
    if (options.persist) writeStored(LAST, key, shared)
    apply(shared)
    return shared
  }
  const startedAt = generation
  const fresh = await fetcher()
  if (generation === startedAt) {
    store(key, fresh)
    if (options.persist) writeStored(LAST, key, fresh)
  }
  apply(fresh)
  return fresh
}

/** Warms the cache for a page about to open. Skips a key fetched within `freshMs`; never throws. */
export function prefetchQuery<T>(query: ReadQuery<T>, freshMs = PREFETCH_FRESH_MS): Promise<void> {
  if (readFresh(query.key, freshMs)) return Promise.resolve()
  return fetchShared(query).then(() => undefined, () => undefined)
}

/**
 * One answer, never two: for a read that seeds an edit draft, where a second answer landing after the user
 * started typing would undo their edits. A copy younger than `maxAgeMs` is used as is (any write since would
 * have dropped it); otherwise the network, joining a prefetch in flight. Rejects with the fetch error.
 */
export function readQueryOnce<T>(query: ReadQuery<T>, maxAgeMs = READ_ONCE_FRESH_MS): Promise<T> {
  const cached = readFresh(query.key, maxAgeMs)
  if (cached) return Promise.resolve(cached.value as T)
  return fetchShared(query)
}
