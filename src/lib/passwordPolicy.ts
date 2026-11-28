// Mirrors the backend policy: darpan's MoquiConf <password min-length="12"/> (DAR-BE-268) over
// MoquiDefaultConf's min-digits="1" min-others="1". Kept in one place so the helper text, the live
// checks and the submit gate can never drift apart, on the sign-in page and in User Settings (S99-106).
// history-limit="5" is deliberately not listed: only the server can know a user's previous passwords,
// so it stays a server-side rejection.
export const PASSWORD_MIN_LENGTH = 12

export interface PasswordRule {
  id: 'length' | 'digit' | 'other'
  label: string
  met: boolean
}

export function passwordRulesFor(value: string): PasswordRule[] {
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH },
    { id: 'digit', label: 'At least one number', met: /\d/.test(value) },
    { id: 'other', label: 'At least one symbol (not a letter or number)', met: /[^\p{L}\p{N}]/u.test(value) },
  ]
}
