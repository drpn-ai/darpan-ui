import type { CommandAction } from './types/ux'

const RECENT_COMMANDS_STORAGE_KEY = 'darpan-ui-recent-commands'
const MAX_RECENT_COMMANDS = 5
const QUERY_STOP_WORDS = new Set([
  'a',
  'an',
  'do',
  'for',
  'go',
  'i',
  'me',
  'my',
  'open',
  'page',
  'please',
  'show',
  'take',
  'the',
  'to',
  'where',
])

function canUseStorage(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function'
  )
}

function safeParseRecentCommandIds(rawValue: string | null): string[] {
  if (!rawValue) return []

  try {
    const parsed = JSON.parse(rawValue)
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
  } catch {
    return []
  }
}

/** Lower case, words only, single spaces: how the palette and the slash commands compare text. */
export function toSearchPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function tokenize(value: string): string[] {
  if (!value) return []
  return value.split(' ').filter((token) => token.length > 0)
}

function normalizeQuery(query: string): { phrase: string; tokens: string[] } {
  const normalized = toSearchPhrase(query)
  const tokens = tokenize(normalized)
  const meaningfulTokens = tokens.filter((token) => !QUERY_STOP_WORDS.has(token))
  const finalTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens

  return {
    phrase: finalTokens.join(' '),
    tokens: finalTokens,
  }
}

function hasExactWord(text: string, token: string): boolean {
  return tokenize(text).some((word) => word === token)
}

function hasPrefixWord(text: string, token: string): boolean {
  return tokenize(text).some((word) => word.startsWith(token))
}

function tokenAppears(text: string, token: string): boolean {
  return text.includes(token) || text.replace(/\s+/g, '').includes(token)
}

function isWithinEditDistance(left: string, right: string, limit: number): boolean {
  if (left === right) return true
  if (Math.abs(left.length - right.length) > limit) return false

  let previousRow: number[] = Array.from({ length: right.length + 1 }, (_, index) => index)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow: number[] = [leftIndex]
    let rowMinimum = leftIndex

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      const nextCost = Math.min(
        (currentRow[rightIndex - 1] ?? Number.POSITIVE_INFINITY) + 1,
        (previousRow[rightIndex] ?? Number.POSITIVE_INFINITY) + 1,
        (previousRow[rightIndex - 1] ?? Number.POSITIVE_INFINITY) + substitutionCost,
      )

      currentRow.push(nextCost)
      rowMinimum = Math.min(rowMinimum, nextCost)
    }

    if (rowMinimum > limit) return false
    previousRow = currentRow
  }

  return (previousRow[right.length] ?? Number.POSITIVE_INFINITY) <= limit
}

function hasFuzzyWord(text: string, token: string): boolean {
  if (token.length < 4) return false

  const limit = token.length >= 8 ? 2 : 1
  return tokenize(text).some((word) => isWithinEditDistance(word, token, limit))
}

function recentBoost(recentIndex: number | undefined): number {
  if (recentIndex == null) return 0
  return Math.max(0, 140 - recentIndex * 20)
}

function scoreField(
  text: string,
  token: string,
  exactWordPoints: number,
  prefixPoints: number,
  containsPoints: number,
  fuzzyPoints: number,
): number {
  if (hasExactWord(text, token)) return exactWordPoints
  if (hasPrefixWord(text, token)) return prefixPoints
  if (tokenAppears(text, token)) return containsPoints
  if (hasFuzzyWord(text, token)) return fuzzyPoints
  return 0
}

function tokenMatchesText(text: string, token: string): boolean {
  return scoreField(text, token, 1, 1, 1, 1) > 0
}

type NormalizedCommandQuery = ReturnType<typeof normalizeQuery>

function scoreCommandAction(
  action: CommandAction,
  { phrase, tokens }: NormalizedCommandQuery,
  recentIndexMap: Map<string, number>,
): number {
  const label = toSearchPhrase(action.label)
  const description = toSearchPhrase(action.description)
  const aliases = action.aliases.map(toSearchPhrase).filter((alias) => alias.length > 0)

  if (!phrase) {
    if (action.requiresQuery) return -1
    return recentBoost(recentIndexMap.get(action.id))
  }

  for (const token of tokens) {
    const tokenMatch =
      tokenMatchesText(label, token) ||
      tokenMatchesText(description, token) ||
      aliases.some((alias) => tokenMatchesText(alias, token))
    if (!tokenMatch) return -1
  }

  let score = 0

  if (label === phrase) score += 1600
  if (aliases.some((alias) => alias === phrase)) score += 1500
  if (label.startsWith(phrase)) score += 1100
  if (aliases.some((alias) => alias.startsWith(phrase))) score += 1000
  if (label.includes(phrase)) score += 650
  if (aliases.some((alias) => alias.includes(phrase))) score += 600
  if (description.includes(phrase)) score += 160

  for (const token of tokens) {
    score += scoreField(label, token, 140, 110, 45, 28)
    score += Math.max(...aliases.map((alias) => scoreField(alias, token, 120, 95, 35, 24)), 0)
    score += scoreField(description, token, 35, 20, 10, 8)
  }

  score += Math.max(0, 32 - label.length)
  score += recentBoost(recentIndexMap.get(action.id))
  return score
}

export function rankCommandActions(
  actions: CommandAction[],
  query: string,
  recentCommandIds: string[] = [],
): CommandAction[] {
  const recentIndexMap = new Map(recentCommandIds.map((commandId, index) => [commandId, index]))
  const normalizedQuery = normalizeQuery(query)

  return actions
    .map((action, index) => ({
      action,
      index,
      score: scoreCommandAction(action, normalizedQuery, recentIndexMap),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.action)
}

export function listRecentCommandIds(): string[] {
  if (!canUseStorage()) return []
  return safeParseRecentCommandIds(localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY))
}

export function recordRecentCommand(commandId: string): string[] {
  const trimmedId = commandId.trim()
  if (!trimmedId) return listRecentCommandIds()

  const nextIds = [trimmedId, ...listRecentCommandIds().filter((existingId) => existingId !== trimmedId)].slice(
    0,
    MAX_RECENT_COMMANDS,
  )

  if (canUseStorage()) {
    try {
      localStorage.setItem(RECENT_COMMANDS_STORAGE_KEY, JSON.stringify(nextIds))
    } catch {
      // Quota or a private window: this visit keeps its order, the next one starts without it.
    }
  }

  return nextIds
}

/** Recent commands are the person's own: sign-in, sign-out and a tenant switch start without them. */
export function clearRecentCommands(): void {
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(RECENT_COMMANDS_STORAGE_KEY)
  } catch {
    // Storage unavailable: nothing was kept to clear.
  }
}
