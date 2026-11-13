import { onBeforeUnmount, readonly, ref } from 'vue'
import { authFacade } from '../lib/api/facade'
import { getPasskeyAssertion, passkeysSupported, PASSKEY_REFUSAL_TEXT } from '../lib/passkeys'
import { callFailure, passkeyOptionsOf, type PasskeyBeginOutcome, type TwoFactorRefusal } from '../lib/twoFactor'

/** How a fresh proof is given: a code from the app, a passkey, or (signing in only) a recovery code. */
export type ProofMode = 'code' | 'passkey' | 'recovery'

export type PasskeyProofOutcome =
  | { outcome: 'ok'; passkeyAssertion: string }
  | { outcome: 'cancelled' }
  | { outcome: 'failed'; message: string }

/** Options are replaced this long before they expire, so a click never meets dead ones. */
const REFRESH_MARGIN_MS = 30_000

/** begin#PasskeyProof: options for one signed-in action's fresh proof. It refuses as a JSON-RPC error. */
export async function beginPasskeyProof(): Promise<PasskeyBeginOutcome> {
  try {
    return passkeyOptionsOf(await authFacade.beginPasskeyProof()) ?? { outcome: 'refused', message: PASSKEY_REFUSAL_TEXT }
  } catch (err) {
    return callFailure(err)
  }
}

/**
 * The fresh proof one step asks for (DAR-BE-264/270): which way the person is answering, and for a passkey the
 * browser's prompt. Safari opens that prompt only inside a click, so prove() never fetches first: the options are
 * fetched when passkey is chosen, held until used, and replaced before they expire. Choosing another way or leaving
 * the step closes an open prompt.
 */
export function useTwoFactorProof(options: {
  /** The prompt's options: begin#PasskeySignIn at sign-in, beginPasskeyProof signed in. */
  begin: () => Promise<PasskeyBeginOutcome>
  /** Getting options was refused, or (signing in) the challenge ended. */
  onRefused: (refusal: TwoFactorRefusal) => void
}) {
  const mode = ref<ProofMode | null>(null)
  const has = ref({ code: false, passkey: false })
  /** Options are in hand: the prompt opens straight from the next click. */
  const ready = ref(false)
  const preparing = ref(false)
  let publicKeyOptions: string | null = null
  let refreshTimer: ReturnType<typeof setTimeout> | null = null
  let prompt: AbortController | null = null
  let pending: Promise<void> | null = null
  // Bumped whenever the step moves on, so options that arrive for a choice already left are dropped.
  let generation = 0

  /** The person has `kind`, and for a passkey this browser can use one. */
  function offers(kind: 'code' | 'passkey'): boolean {
    return has.value[kind]
  }

  /** Starts on the first way this person has: the app, a passkey, else `fallback` (null: none works here). */
  function start(methods: { app: boolean; passkey: boolean }, fallback: ProofMode | null = null): void {
    has.value = { code: methods.app, passkey: methods.passkey && passkeysSupported() }
    choose(has.value.code ? 'code' : has.value.passkey ? 'passkey' : fallback)
  }

  function choose(next: ProofMode | null): void {
    reset()
    mode.value = next
    if (next === 'passkey') void prepare()
  }

  /** Fetches options unless some are in hand; resolves once they are, or once the refusal went to onRefused. */
  function prepare(): Promise<void> {
    if (ready.value) return Promise.resolve()
    if (!pending) {
      const mine = generation
      preparing.value = true
      pending = options.begin().then((result) => {
        if (mine !== generation) return
        pending = null
        preparing.value = false
        if (result.outcome === 'begun') hold(result)
        else options.onRefused(result)
      })
    }
    return pending
  }

  function hold(begun: { publicKeyOptions: string; expiresInSeconds?: number }): void {
    publicKeyOptions = begun.publicKeyOptions
    ready.value = true
    if (begun.expiresInSeconds) refreshTimer = setTimeout(refresh, Math.max(0, begun.expiresInSeconds * 1000 - REFRESH_MARGIN_MS))
  }

  /** New options before these expire; these keep working meanwhile. A refused refresh drops them quietly, and the
   *  next click fetches again. */
  function refresh(): void {
    refreshTimer = null
    const mine = generation
    void options.begin().then((result) => {
      if (mine !== generation) return
      spend()
      if (result.outcome === 'begun') hold(result)
    })
  }

  /** The browser's prompt over the options in hand. Without any (a failed fetch) this fetches again instead and says
   *  nothing: the next click opens the prompt. */
  async function prove(): Promise<PasskeyProofOutcome> {
    if (!publicKeyOptions) {
      void prepare()
      return { outcome: 'cancelled' }
    }
    const controller = new AbortController()
    prompt = controller
    const result = await getPasskeyAssertion(publicKeyOptions, controller.signal)
    if (prompt === controller) prompt = null
    // Closed, timed out or failed in the browser: the backend never saw it, so the same options serve the next try.
    if (result.outcome !== 'ok') return result
    // Any assertion the backend reads uses its options up; after a refusal the step calls prepare() for the next.
    spend()
    return { outcome: 'ok', passkeyAssertion: result.json }
  }

  function spend(): void {
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = null
    publicKeyOptions = null
    ready.value = false
  }

  function reset(): void {
    generation += 1
    prompt?.abort()
    prompt = null
    pending = null
    preparing.value = false
    spend()
  }

  onBeforeUnmount(reset)

  return { mode: readonly(mode), ready: readonly(ready), preparing: readonly(preparing), offers, start, choose, prepare, prove }
}
