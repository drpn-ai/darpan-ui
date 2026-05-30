import { ApiCallError } from './client'

/**
 * True when an error represents a cancelled/aborted request (e.g. an
 * `AbortController.abort()` during navigation). Handles both real
 * `DOMException` aborts and the structural `{ name: 'AbortError' }` shape
 * thrown by some fetch polyfills/test mocks.
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) return error.name === 'AbortError'
  return typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError'
}

/**
 * Resolve a user-safe message for a failed API call. Only `ApiCallError`
 * messages are surfaced (they are the sanitized, customer-facing copy the
 * client produces); any other error falls back to the caller's message so we
 * never leak internal/transport error text to the UI. See DAR-73.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiCallError ? error.message : fallback
}

/**
 * Like {@link getApiErrorMessage} but also surfaces generic `Error.message`.
 * Used by internal store load paths where the thrown `Error` is already a
 * controlled, display-safe message rather than raw transport text.
 */
export function describeError(error: unknown, fallback: string): string {
  if (error instanceof ApiCallError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}
