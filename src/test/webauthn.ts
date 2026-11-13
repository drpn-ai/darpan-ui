import { vi, type Mock } from 'vitest'

// DAR-BE-270: a stand-in for the browser's WebAuthn surface (window.PublicKeyCredential and navigator.credentials),
// which jsdom does not have. With `json` (the default) it offers the WebAuthn L3 JSON methods a current browser has;
// without, it is an older browser and lib/passkeys.ts takes its base64url fallback.

export interface WebAuthnStub {
  create: Mock
  get: Mock
  parseCreationOptionsFromJSON: Mock
  parseRequestOptionsFromJSON: Mock
  restore: () => void
}

const bytes = (...values: number[]) => new Uint8Array(values).buffer

/** What credential.toJSON() gives in the stub, so a spec can name the exact text sent to the backend. */
export const CREATED_JSON = JSON.stringify({ id: 'cred-1', made: 'create' })
export const ASSERTION_JSON = JSON.stringify({ id: 'cred-1', made: 'get' })

export function notAllowed(): DOMException {
  return new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError')
}

export function installWebAuthnStub(options: { json?: boolean } = {}): WebAuthnStub {
  const json = options.json ?? true
  const credential = (made: 'create' | 'get') => ({
    id: 'cred-1',
    rawId: bytes(1, 2, 251),
    type: 'public-key',
    authenticatorAttachment: 'platform',
    getClientExtensionResults: () => ({}),
    response: made === 'create'
      ? { clientDataJSON: bytes(123, 125), attestationObject: bytes(163, 1), getTransports: () => ['internal', 'hybrid'] }
      : { clientDataJSON: bytes(123, 125), authenticatorData: bytes(73, 150), signature: bytes(48, 69), userHandle: bytes(85, 49) },
    ...(json ? { toJSON: () => JSON.parse(made === 'create' ? CREATED_JSON : ASSERTION_JSON) } : {}),
  })
  const create = vi.fn(async () => credential('create'))
  const get = vi.fn(async () => credential('get'))
  const parseCreationOptionsFromJSON = vi.fn((value: Record<string, unknown>) => ({ ...value, parsed: 'creation' }))
  const parseRequestOptionsFromJSON = vi.fn((value: Record<string, unknown>) => ({ ...value, parsed: 'request' }))

  const FakePublicKeyCredential = function PublicKeyCredential() {} as unknown as Record<string, unknown>
  if (json) Object.assign(FakePublicKeyCredential, { parseCreationOptionsFromJSON, parseRequestOptionsFromJSON })

  const previousCredentials = Object.getOwnPropertyDescriptor(navigator, 'credentials')
  Object.defineProperty(window, 'PublicKeyCredential', { value: FakePublicKeyCredential, configurable: true, writable: true })
  Object.defineProperty(navigator, 'credentials', { value: { create, get }, configurable: true })

  return {
    create,
    get,
    parseCreationOptionsFromJSON,
    parseRequestOptionsFromJSON,
    restore() {
      delete (window as unknown as Record<string, unknown>).PublicKeyCredential
      if (previousCredentials) Object.defineProperty(navigator, 'credentials', previousCredentials)
      else delete (navigator as unknown as Record<string, unknown>).credentials
    },
  }
}

/** begin#PasskeyRegistration's options, as the backend sends them (JSON text, base64url ids). */
export const CREATION_OPTIONS = JSON.stringify({
  rp: { id: 'localhost', name: 'Darpan' },
  user: { id: 'VTE', name: 'ada', displayName: 'ada' },
  challenge: 'AQID',
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  excludeCredentials: [{ id: 'BAU', type: 'public-key', transports: ['internal'] }],
  authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  attestation: 'none',
  timeout: 120000,
})

/** begin#PasskeySignIn's or begin#PasskeyProof's options. */
export const REQUEST_OPTIONS = JSON.stringify({
  challenge: 'BwgJ',
  rpId: 'localhost',
  allowCredentials: [{ id: 'BAU', type: 'public-key' }],
  userVerification: 'required',
  timeout: 120000,
})
