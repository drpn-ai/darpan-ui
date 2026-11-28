const READ_VERBS = ['get', 'list', 'search']

/** A facade method is `facade.<Service>.<verb>#<Noun>`; only get/list/search are safe to auto-retry. */
export function isIdempotentReadMethod(method: string): boolean {
  const verb = method.split('.').pop()?.split('#')[0]?.toLowerCase() ?? ''
  return READ_VERBS.includes(verb)
}

export async function retryRead<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; baseDelayMs?: number; shouldRetry?: (err: unknown) => boolean } = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3)
  const baseDelayMs = opts.baseDelayMs ?? 200
  const shouldRetry = opts.shouldRetry ?? (() => true)
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= attempts - 1 || !shouldRetry(err)) throw err
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt))
    }
  }
}
