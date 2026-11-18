// DAR-UI-120: the usernames that signed in with a passkey on this browser, so the sign-in page can go from Next
// straight to the passkey prompt for them. The server is never asked (begin#PasskeyFirstSignIn answers a decoy for an
// unknown username, DAR-BE-301), so this browser's memory is the only hint. Stored as SHA-256 hashes, never the names,
// and anything that fails (blocked storage, no crypto.subtle on an insecure origin) reads as "not remembered".

const STORAGE_KEY = 'darpan.passkeySignInHints'
const HINT_LIMIT = 5

async function hintFor(username: string): Promise<string | null> {
  const name = username.trim().toLowerCase()
  if (!name) return null
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(`darpan-passkey:${name}`))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function readHints(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((hint): hint is string => typeof hint === 'string') : []
  } catch {
    return []
  }
}

function writeHints(hints: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hints.slice(0, HINT_LIMIT)))
  } catch {
    // Not remembered: the password step still follows Next.
  }
}

export async function hasRememberedPasskey(username: string): Promise<boolean> {
  const hint = await hintFor(username)
  return hint !== null && readHints().includes(hint)
}

/** Most recent first, so the five kept are the five last used. */
export async function rememberPasskey(username: string): Promise<void> {
  const hint = await hintFor(username)
  if (hint) writeHints([hint, ...readHints().filter((kept) => kept !== hint)])
}

export async function forgetPasskey(username: string): Promise<void> {
  const hint = await hintFor(username)
  if (hint) writeHints(readHints().filter((kept) => kept !== hint))
}
