export interface ErrorContext {
  source?: string
  method?: string
  [key: string]: unknown
}

/**
 * Single error sink for the SPA. Console for now; this is the one place a future
 * observability backend plugs in (see error-state-handling-design.md §8). Never throws.
 */
export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    console.error('[darpan] captured error', { error, ...context })
  } catch {
    /* reporting must never throw */
  }
}
