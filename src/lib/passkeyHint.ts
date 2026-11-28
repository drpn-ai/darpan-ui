// DAR-UI-132: the device note. The server never says whether an account has a passkey (begin#PasskeyFirstSignIn takes
// no username and names no credentials, D16), and a website cannot see which passkeys a device holds, so this
// browser keeps one account: its username in plain text and how it last proved that person here. The sign-in page opens
// on "Welcome back." for it, and goes to the passkey only when the note says a passkey proved them on this browser.
// Anything that fails (blocked storage, a value from elsewhere) reads as no note: a new device.

const STORAGE_KEY = 'darpan.signInAccount'

export type SignInMethod = 'passkey' | 'password'

export interface KeptAccount {
  username: string
  method: SignInMethod
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function keptAccount(): KeptAccount | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return null
    const { username, method } = parsed as Record<string, unknown>
    if (typeof username !== 'string' || !username.trim()) return null
    if (method !== 'passkey' && method !== 'password') return null
    return { username, method }
  } catch {
    return null
  }
}

/** Replaces the note: this browser's account is now `username`, last proved by `method`. */
export function keepAccount(username: string, method: SignInMethod): void {
  const name = username.trim()
  if (!name) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: name, method }))
  } catch {
    // Not kept: the next visit is a new device.
  }
}

/** The note says a passkey last proved `username` on this browser. */
export function passkeyKeptFor(username: string): boolean {
  const kept = keptAccount()
  return kept !== null && kept.method === 'passkey' && Boolean(username.trim()) && sameName(kept.username, username)
}
