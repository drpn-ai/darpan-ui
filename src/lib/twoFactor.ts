// DAR-BE-264 two-factor and DAR-BE-270 passkeys: how a two-factor reply is read, and the wording and small helpers the
// sign-in page, User Settings and the CLI approval page share.

import { ApiCallError } from './api/client'

/** TwoFactorSupport.CODE_REFUSAL: every wrong, reused or locked code reads the same. */
export const CODE_REFUSAL_TEXT = "That code didn't work."

/** A sign-in challenge the backend says is spent (challengeEnded): expired, used, or five wrong answers. */
export const CHALLENGE_ENDED_TEXT = 'Sign in again.'

/** A call that threw without a message of its own. Nothing is known to have changed, so the step stays. */
export const TRY_AGAIN_TEXT = "That didn't go through. Try again."

/** A refusal leaves the step usable ('refused') or spends it ('ended': start again). */
export type TwoFactorRefusal = { outcome: 'refused'; message: string } | { outcome: 'ended'; message: string }

/** WebAuthn options (JSON text) for the browser's passkey prompt; expiresInSeconds when the backend gives their life. */
export type PasskeyBeginOutcome = { outcome: 'begun'; publicKeyOptions: string; expiresInSeconds?: number } | TwoFactorRefusal

/**
 * The envelope a refused sign-in or setup step answers with (verify#SignInCode, begin/confirm#TwoFactorSetup,
 * begin#PasskeySignIn, begin/finish#PasskeyRegistration). `reason` is the backend's code for why (CODE, PASSKEY,
 * PROOF_NEEDED, PASSWORD, CHALLENGE_ENDED, SETUP_EXPIRED, PASSKEYS_UNAVAILABLE, PASSKEY_LIMIT, PASSKEY_EXISTS,
 * ACCOUNT_CANNOT_SIGN_IN, SIGN_IN_FIRST, REFUSED): the screen switches on it, never on the message.
 */
export interface TwoFactorReply {
  ok?: boolean
  errors?: readonly string[] | null
  reason?: string | null
}

/** A refusal the backend answered: its first error, else `fallback`. */
export function refusalOf(reply: TwoFactorReply, fallback: string): TwoFactorRefusal {
  return { outcome: 'refused', message: reply.errors?.[0] || fallback }
}

/** A call that threw (network, or a JSON-RPC error): no reply, so nothing is known to have ended. */
export function callFailure(err: unknown): TwoFactorRefusal {
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
