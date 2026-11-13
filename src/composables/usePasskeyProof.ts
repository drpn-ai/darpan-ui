import { ApiCallError } from '../lib/api/client'
import { authFacade } from '../lib/api/facade'
import { PASSKEY_REFUSAL_TEXT, getPasskeyAssertion, passkeysSupported } from '../lib/passkeys'

export type PasskeyProofOutcome =
  | { outcome: 'ok'; passkeyAssertion: string }
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; message: string }

type PreparedOptions = { options: string; expiresAt: number } | { message: string }

/** Options this close to their end are fetched again rather than handed to a prompt that would outlive them. */
const EXPIRY_MARGIN_MS = 15_000

/**
 * A fresh proof by passkey for one action (DAR-BE-270): begin#PasskeyProof, then the browser's prompt, giving the
 * assertion the action sends as passkeyAssertion. prepare() fetches the options ahead, so the prompt opens straight from
 * the click (Safari opens it only inside a user gesture). One set of options serves one action: a closed prompt keeps
 * them for the next try, anything else starts over.
 */
export function usePasskeyProof() {
  let prepared: Promise<PreparedOptions> | null = null

  async function fetchOptions(): Promise<PreparedOptions> {
    try {
      const response = await authFacade.beginPasskeyProof()
      const options = response.publicKeyOptions?.toString()
      if (response.ok === false || !options) return { message: response.errors?.[0] ?? PASSKEY_REFUSAL_TEXT }
      return { options, expiresAt: Date.now() + (response.expiresInSeconds ?? 300) * 1000 - EXPIRY_MARGIN_MS }
    } catch (err) {
      return { message: err instanceof ApiCallError ? err.message : PASSKEY_REFUSAL_TEXT }
    }
  }

  function prepare(): void {
    if (!prepared && passkeysSupported()) prepared = fetchOptions()
  }

  async function prove(): Promise<PasskeyProofOutcome> {
    if (!passkeysSupported()) return { outcome: 'failed', message: 'This browser cannot use passkeys.' }
    prepare()
    let ready = await (prepared as Promise<PreparedOptions>)
    if ('options' in ready && Date.now() >= ready.expiresAt) {
      prepared = fetchOptions()
      ready = await prepared
    }
    if (!('options' in ready)) {
      prepared = null
      return { outcome: 'failed', message: ready.message }
    }
    const result = await getPasskeyAssertion(ready.options)
    if (result.outcome === 'cancelled') return result
    prepared = null
    if (result.outcome === 'failed') return result
    return { outcome: 'ok', passkeyAssertion: result.json }
  }

  return { prepare, prove }
}
