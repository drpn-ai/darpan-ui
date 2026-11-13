import { afterEach, describe, expect, it } from 'vitest'
import { createPasskey, getPasskeyAssertion, passkeysSupported, PASSKEY_REFUSAL_TEXT, PASSKEYS_UNSUPPORTED_TEXT } from '../passkeys'
import { ASSERTION_JSON, CREATED_JSON, CREATION_OPTIONS, REQUEST_OPTIONS, installWebAuthnStub, notAllowed, type WebAuthnStub } from '../../test/webauthn'

// DAR-BE-270: the browser side of a passkey ceremony. What could bite: an older browser without the L3 JSON methods
// (the fallback must send the same shape), a closed prompt read as a failure, and a page offering passkeys where the
// browser has none.

const bytesOf = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer))

describe('passkeys', () => {
  let stub: WebAuthnStub | null = null
  afterEach(() => {
    stub?.restore()
    stub = null
  })

  it('is not offered without WebAuthn (an older browser, or an insecure origin)', async () => {
    expect(passkeysSupported()).toBe(false)
    expect(await getPasskeyAssertion(REQUEST_OPTIONS)).toEqual({ outcome: 'failed', message: PASSKEYS_UNSUPPORTED_TEXT })
  })

  it('uses the browser\'s own JSON methods when it has them', async () => {
    stub = installWebAuthnStub()
    expect(passkeysSupported()).toBe(true)

    expect(await createPasskey(CREATION_OPTIONS)).toEqual({ outcome: 'ok', json: CREATED_JSON })
    expect(stub.parseCreationOptionsFromJSON).toHaveBeenCalledWith(JSON.parse(CREATION_OPTIONS))
    expect(stub.create.mock.calls[0]?.[0]).toMatchObject({ publicKey: { parsed: 'creation' } })

    expect(await getPasskeyAssertion(REQUEST_OPTIONS)).toEqual({ outcome: 'ok', json: ASSERTION_JSON })
    expect(stub.get.mock.calls[0]?.[0]).toMatchObject({ publicKey: { parsed: 'request' } })
  })

  it('without them, decodes the options and encodes the credential as base64url itself', async () => {
    stub = installWebAuthnStub({ json: false })

    const created = await createPasskey(CREATION_OPTIONS)
    const publicKey = stub.create.mock.calls[0]?.[0].publicKey
    expect(bytesOf(publicKey.challenge)).toEqual([1, 2, 3])
    expect(bytesOf(publicKey.user.id)).toEqual([85, 49])
    expect(bytesOf(publicKey.excludeCredentials[0].id)).toEqual([4, 5])
    expect(publicKey.authenticatorSelection).toEqual({ residentKey: 'preferred', userVerification: 'required' })
    expect(created.outcome).toBe('ok')
    expect(JSON.parse((created as { json: string }).json)).toEqual({
      id: 'cred-1',
      rawId: 'AQL7',
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: { clientDataJSON: 'e30', attestationObject: 'owE', transports: ['internal', 'hybrid'] },
    })

    const asserted = await getPasskeyAssertion(REQUEST_OPTIONS)
    expect(bytesOf(stub.get.mock.calls[0]?.[0].publicKey.allowCredentials[0].id)).toEqual([4, 5])
    expect(JSON.parse((asserted as { json: string }).json).response).toEqual({
      clientDataJSON: 'e30', authenticatorData: 'SZY', signature: 'MEU', userHandle: 'VTE',
    })
  })

  it('a closed or timed-out prompt is a cancel, not a failure', async () => {
    stub = installWebAuthnStub()
    stub.get.mockRejectedValueOnce(notAllowed())
    expect(await getPasskeyAssertion(REQUEST_OPTIONS)).toEqual({ outcome: 'cancelled' })
    stub.get.mockResolvedValueOnce(null)
    expect(await getPasskeyAssertion(REQUEST_OPTIONS)).toEqual({ outcome: 'cancelled' })
  })

  it('names an authenticator that already holds one of their passkeys; anything else is the one refusal', async () => {
    stub = installWebAuthnStub()
    stub.create.mockRejectedValueOnce(new DOMException('excluded', 'InvalidStateError'))
    expect(await createPasskey(CREATION_OPTIONS)).toEqual({ outcome: 'failed', message: 'This passkey is already added.' })
    stub.create.mockRejectedValueOnce(new TypeError('boom'))
    expect(await createPasskey(CREATION_OPTIONS)).toEqual({ outcome: 'failed', message: PASSKEY_REFUSAL_TEXT })
    expect(await createPasskey('not json')).toEqual({ outcome: 'failed', message: PASSKEY_REFUSAL_TEXT })
    // Signing in, the same error is no "already added": it is the one refusal.
    stub.get.mockRejectedValueOnce(new DOMException('bad state', 'InvalidStateError'))
    expect(await getPasskeyAssertion(REQUEST_OPTIONS)).toEqual({ outcome: 'failed', message: PASSKEY_REFUSAL_TEXT })
  })

  it('hands the page\'s signal to the browser, so leaving the step closes the prompt', async () => {
    stub = installWebAuthnStub()
    const controller = new AbortController()
    await createPasskey(CREATION_OPTIONS, controller.signal)
    await getPasskeyAssertion(REQUEST_OPTIONS, controller.signal)
    expect(stub.create.mock.calls[0]?.[0].signal).toBe(controller.signal)
    expect(stub.get.mock.calls[0]?.[0].signal).toBe(controller.signal)
  })
})
