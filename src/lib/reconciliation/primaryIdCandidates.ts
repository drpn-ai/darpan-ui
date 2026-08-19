// Name-based ranking of likely primary-key columns, applied to CSV sides only.
//
// This guesses from names and nothing else: it never reads data, so it cannot know whether a
// column is actually unique. It reorders the dropdown; it does not choose for the user.

// A boundary before "id" is required. Without it "paid" and "valid" rank as keys.
const ID_SUFFIX = /(?:[a-z0-9]Id|[_\-\s]id)$/
const EXACT_ID = /^id$/i
const IDENTIFIER_WORD = /^(?:key|uuid|guid|sku|code|email|reference)$/i
const IDENTIFIER_SUFFIX =
  /(?:[a-z0-9](?:No|Number|Ref|Code|Sku|Email|Uuid|Guid)|[_\-\s](?:no|number|ref|reference|code|sku|email|uuid|guid))$/

function candidateRank(fieldPath: string): number {
  const trimmed = fieldPath.trim()
  if (EXACT_ID.test(trimmed)) return 0
  // Tested against the raw string for camelCase (orderId) and the lowercased one for
  // separator forms in any case (customer_id, ORDER_ID).
  if (ID_SUFFIX.test(trimmed) || ID_SUFFIX.test(trimmed.toLowerCase())) return 1
  if (IDENTIFIER_WORD.test(trimmed) || IDENTIFIER_SUFFIX.test(trimmed)) return 2
  return 3
}

/** Same columns, reordered so likely keys come first. Stable within a tier. */
export function rankPrimaryIdCandidates(fieldPaths: string[]): string[] {
  return fieldPaths
    .map((fieldPath, index) => ({ fieldPath, index, rank: candidateRank(fieldPath) }))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((entry) => entry.fieldPath)
}
