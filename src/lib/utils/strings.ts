/**
 * Trim an unknown value to a string. Returns `null` when the value is null,
 * undefined, not a string, or trims to the empty string.
 */
export function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Convenience wrapper for call sites that always need a string. Behaves like
 * {@link normalizeString} but returns `''` instead of `null`.
 */
export function normalizeStringOrEmpty(value: unknown): string {
  return normalizeString(value) ?? ''
}

/** `1 space`, `2 spaces`, `1,204 records`: a count with its noun in the right number. */
export function countLabel(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`
}
