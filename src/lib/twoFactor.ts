// DAR-BE-264 two-factor and DAR-BE-270 passkeys: how a two-factor reply is read, and the wording and small helpers the
// sign-in page, User Settings and the CLI approval page share.

import { ApiCallError } from './api/client'
import { PASSKEY_REFUSAL_TEXT } from './passkeys'

/** TwoFactorSupport.CODE_REFUSAL: every wrong, reused or locked code reads the same. */
export const CODE_REFUSAL_TEXT = "That code didn't work."

/** A sign-in challenge the backend says is spent (challengeEnded): expired, used, or five wrong answers. */
export const CHALLENGE_ENDED_TEXT = 'Sign in again.'

/** A call that threw without a message of its own. Nothing is known to have changed, so the step stays. */
export const TRY_AGAIN_TEXT = "That didn't go through. Try again."

/** Why a two-factor step was refused, where the screen does something about it. */
export type RefusalReason = 'proof' | 'setupExpired' | 'passkeysUnavailable'

export type TwoFactorRefused = { outcome: 'refused'; message: string; reason?: RefusalReason }

/** A refusal leaves the step usable ('refused') or spends it ('ended': start again). */
export type TwoFactorRefusal = TwoFactorRefused | { outcome: 'ended'; message: string }

/** WebAuthn options (JSON text) for the browser's passkey prompt; expiresInSeconds when the backend gives their life. */
export type PasskeyBeginOutcome = { outcome: 'begun'; publicKeyOptions: string; expiresInSeconds?: number } | TwoFactorRefusal

/** The envelope a refused two-factor call answers with. */
export interface TwoFactorReply {
  ok?: boolean
  errors?: readonly string[] | null
}

// The backend says why only in its wording today. This is the one place that wording is matched: when refusals carry
// a machine-readable reason, refusalReason reads it and this table goes.
const REASON_TEXTS: ReadonlyArray<readonly [RefusalReason, string]> = [
  // A fresh proof fixes these (approve#CliLogin): anything else is about the request itself.
  ['proof', CODE_REFUSAL_TEXT],
  ['proof', PASSKEY_REFUSAL_TEXT],
  ['proof', 'Enter the code from your authenticator app.'],
  ['proof', 'Confirm with your passkey or a code from your authenticator app.'],
  // A signed-in setup left past its 15 minutes.
  ['setupExpired', 'Setup has expired. Start again.'],
  // PasskeySupport.UNAVAILABLE: this instance has no relying party (the app still works).
  ['passkeysUnavailable', 'Passkeys are not available on this Darpan instance.'],
]

/** Why `reply` was refused, when the screen acts on it. */
export function refusalReason(reply: TwoFactorReply | null | undefined): RefusalReason | undefined {
  const message = reply?.errors?.[0]
  if (!message) return undefined
  return REASON_TEXTS.find(([, text]) => message.includes(text))?.[0]
}

/** A refusal the backend answered: its first error, else `fallback`. */
export function refusalOf(reply: TwoFactorReply, fallback: string): TwoFactorRefused {
  return { outcome: 'refused', message: reply.errors?.[0] || fallback, reason: refusalReason(reply) }
}

/** A call that threw (network, or a JSON-RPC error): no reply, so nothing is known to have ended. */
export function callFailure(err: unknown): TwoFactorRefused {
  return { outcome: 'refused', message: err instanceof ApiCallError ? err.message : TRY_AGAIN_TEXT }
}

/** begin#PasskeySignIn, begin#PasskeyRegistration or begin#PasskeyProof: the prompt's options, or null when refused. */
export function passkeyOptionsOf(
  reply: TwoFactorReply & { publicKeyOptions?: string | null; expiresInSeconds?: number | null },
): PasskeyBeginOutcome | null {
  const publicKeyOptions = reply.publicKeyOptions?.toString()
  if (reply.ok === false || !publicKeyOptions) return null
  return { outcome: 'begun', publicKeyOptions, expiresInSeconds: reply.expiresInSeconds ?? undefined }
}

/** The Base32 key in fours, the way an authenticator app's manual entry is easiest to type. */
export function groupSecret(secret: string | null | undefined): string {
  return (secret ?? '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()
}

export function recoveryCodesFileText(codes: readonly string[], username: string | null | undefined): string {
  const who = username ? ` for ${username}` : ''
  return [`Darpan recovery codes${who}. Each works once.`, '', ...codes, ''].join('\n')
}

/**
 * Copy text, falling back to a hidden textarea and execCommand where the async clipboard is missing or refused
 * (insecure origin, permissions policy, an older browser). False when neither worked, so the caller can say so.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea copy
  }
  if (typeof document === 'undefined') return false
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  try {
    area.select()
    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}
