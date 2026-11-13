// DAR-BE-270: passkeys and security keys (WebAuthn) as a second factor. The backend sends WebAuthn L3 options as JSON
// text (publicKeyOptions) and reads the credential back as JSON text. Browsers with the L3 JSON methods
// (PublicKeyCredential.parse*OptionsFromJSON, credential.toJSON) use them; older ones (Safari before 18.4, Firefox
// before 119) take the small base64url fallback below. A browser without WebAuthn at all (or an insecure origin, where
// PublicKeyCredential is undefined) is never offered a passkey.

/** PasskeySupport.PASSKEY_REFUSAL: every refused assertion reads the same. */
export const PASSKEY_REFUSAL_TEXT = "That passkey didn't work."

/** This browser, on this origin, has no WebAuthn. */
export const PASSKEYS_UNSUPPORTED_TEXT = 'This browser cannot use passkeys.'

/** Said to someone whose only factor is a passkey, on a browser without WebAuthn, where a fresh proof is needed. */
export const PASSKEY_BROWSER_NEEDED_TEXT = 'Open Darpan in a browser that can use your passkey.'

/** 'cancelled': the person closed the browser's prompt, it timed out, or the page aborted it. Not a refusal, so the
 *  caller says nothing. */
export type PasskeyCeremony = { outcome: 'ok'; json: string } | { outcome: 'cancelled' } | { outcome: 'failed'; message: string }

type JsonDescriptor = { id: string; type: string; transports?: string[] }
type JsonOptions = Record<string, unknown> & { challenge: string; user?: { id: string }; excludeCredentials?: JsonDescriptor[]; allowCredentials?: JsonDescriptor[] }
type CredentialStatics = {
  parseCreationOptionsFromJSON?: (json: unknown) => CredentialCreationOptions['publicKey']
  parseRequestOptionsFromJSON?: (json: unknown) => CredentialRequestOptions['publicKey']
}
type JsonCapableCredential = PublicKeyCredential & { toJSON?: () => unknown }

function credentialStatics(): CredentialStatics | null {
  if (typeof window === 'undefined') return null
  const statics = (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential
  return typeof statics === 'function' ? (statics as CredentialStatics) : null
}

/** True when this browser, on this origin, can make and use passkeys. */
export function passkeysSupported(): boolean {
  if (!credentialStatics() || typeof navigator === 'undefined') return false
  return typeof navigator.credentials?.create === 'function' && typeof navigator.credentials?.get === 'function'
}

// ─── base64url fallback for browsers without the WebAuthn L3 JSON methods ─────────────────────────────────────────

function fromBase64url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

function toBase64url(buffer: ArrayBuffer | null | undefined): string | null {
  if (!buffer) return null
  let binary = ''
  new Uint8Array(buffer).forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const withBinaryIds = (list?: JsonDescriptor[]) => list?.map((descriptor) => ({ ...descriptor, id: fromBase64url(descriptor.id) }))

function creationOptions(json: JsonOptions): CredentialCreationOptions['publicKey'] {
  const parse = credentialStatics()?.parseCreationOptionsFromJSON
  if (parse) return parse(json)
  return {
    ...json,
    challenge: fromBase64url(json.challenge),
    user: { ...json.user, id: fromBase64url(json.user?.id ?? '') },
    excludeCredentials: withBinaryIds(json.excludeCredentials),
  } as unknown as CredentialCreationOptions['publicKey']
}

function requestOptions(json: JsonOptions): CredentialRequestOptions['publicKey'] {
  const parse = credentialStatics()?.parseRequestOptionsFromJSON
  if (parse) return parse(json)
  return { ...json, challenge: fromBase64url(json.challenge), allowCredentials: withBinaryIds(json.allowCredentials) } as unknown as CredentialRequestOptions['publicKey']
}

function credentialJson(credential: JsonCapableCredential): string {
  if (typeof credential.toJSON === 'function') return JSON.stringify(credential.toJSON())
  const r = credential.response as Partial<AuthenticatorAttestationResponse & AuthenticatorAssertionResponse>
  const response = r.attestationObject
    ? { clientDataJSON: toBase64url(r.clientDataJSON), attestationObject: toBase64url(r.attestationObject), transports: r.getTransports?.() ?? [] }
    : { clientDataJSON: toBase64url(r.clientDataJSON), authenticatorData: toBase64url(r.authenticatorData), signature: toBase64url(r.signature), userHandle: toBase64url(r.userHandle) }
  return JSON.stringify({
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? null,
    clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
    response,
  })
}

// ─── ceremonies ───────────────────────────────────────────────────────────────────────────────────────────────────

function failure(err: unknown, kind: 'create' | 'get'): PasskeyCeremony {
  const name = err instanceof Error || (typeof DOMException !== 'undefined' && err instanceof DOMException) ? (err as Error).name : ''
  // NotAllowedError covers a closed prompt, a timeout and "no passkey for this site on this device"; AbortError a
  // prompt the page itself cancelled. Neither is the person doing anything wrong.
  if (name === 'NotAllowedError' || name === 'AbortError') return { outcome: 'cancelled' }
  // Creating only: excludeCredentials matched, so this authenticator already holds one of their passkeys.
  if (name === 'InvalidStateError' && kind === 'create') return { outcome: 'failed', message: 'This passkey is already added.' }
  // The relying party id does not match this address (a misconfigured instance).
  if (name === 'SecurityError') return { outcome: 'failed', message: "Passkeys don't work on this address." }
  return { outcome: 'failed', message: PASSKEY_REFUSAL_TEXT }
}

async function ceremony(kind: 'create' | 'get', run: () => Promise<Credential | null>): Promise<PasskeyCeremony> {
  if (!passkeysSupported()) return { outcome: 'failed', message: PASSKEYS_UNSUPPORTED_TEXT }
  try {
    const credential = await run()
    if (!credential) return { outcome: 'cancelled' }
    return { outcome: 'ok', json: credentialJson(credential as JsonCapableCredential) }
  } catch (err) {
    return failure(err, kind)
  }
}

function parseOptions(publicKeyOptions: string): JsonOptions | null {
  try {
    const parsed = JSON.parse(publicKeyOptions) as JsonOptions
    return parsed && typeof parsed.challenge === 'string' ? parsed : null
  } catch {
    return null
  }
}

/** navigator.credentials.create over begin#PasskeyRegistration's options; the new credential as JSON text. `signal`
 *  closes the prompt when the step that opened it goes away. */
export function createPasskey(publicKeyOptions: string, signal?: AbortSignal): Promise<PasskeyCeremony> {
  const json = parseOptions(publicKeyOptions)
  if (!json) return Promise.resolve({ outcome: 'failed', message: PASSKEY_REFUSAL_TEXT })
  return ceremony('create', () => navigator.credentials.create({ publicKey: creationOptions(json), signal }))
}

/** navigator.credentials.get over begin#PasskeySignIn's or begin#PasskeyProof's options; the assertion as JSON text. */
export function getPasskeyAssertion(publicKeyOptions: string, signal?: AbortSignal): Promise<PasskeyCeremony> {
  const json = parseOptions(publicKeyOptions)
  if (!json) return Promise.resolve({ outcome: 'failed', message: PASSKEY_REFUSAL_TEXT })
  return ceremony('get', () => navigator.credentials.get({ publicKey: requestOptions(json), signal }))
}

