// DAR-BE-264 two-factor sign-in: wording and small helpers shared by the sign-in page, User Settings and the CLI
// approval page. The backend's refusal texts are matched here and nowhere else.

/** TwoFactorSupport.CODE_REFUSAL: every wrong, reused or locked code reads the same. */
export const CODE_REFUSAL_TEXT = "That code didn't work."

/** Shown when a sign-in challenge can no longer be used (challengeEnded): expired (300 s), used, or 5 wrong codes. */
export const CHALLENGE_ENDED_TEXT = 'This sign-in has expired. Enter your password again.'

/** A signed-in setup (no challenge) left past its 15 minutes: the person starts again. */
const SETUP_EXPIRED_TEXT = 'Setup has expired. Start again.'

export function isSetupExpired(message: string | null | undefined): boolean {
  return Boolean(message?.includes(SETUP_EXPIRED_TEXT))
}

/** approve#CliLogin's refusals that a fresh code or passkey (DAR-BE-270) fixes; anything else is about the CLI request
 *  itself. */
const CODE_PROBLEM_TEXTS = [
  CODE_REFUSAL_TEXT,
  'Enter the code from your authenticator app.',
  "That passkey didn't work.",
  'Confirm with your passkey or a code from your authenticator app.',
]

export function isCodeProblem(message: string | null | undefined): boolean {
  return Boolean(message) && CODE_PROBLEM_TEXTS.some((text) => message?.includes(text))
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
