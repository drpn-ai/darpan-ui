import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// DAR-BE-270: a fresh proof by passkey. What could bite: Safari opens the prompt only inside a click, so a click that
// first waits on a fetch never gets its prompt; options that expire while the step sits open; a prompt left open
// after the person chose another way or left the step.

vi.mock('../../lib/api/facade', () => ({ authFacade: {} }))

import { useTwoFactorProof } from '../useTwoFactorProof'
import type { PasskeyBeginOutcome } from '../../lib/twoFactor'
import { installWebAuthnStub, REQUEST_OPTIONS, type WebAuthnStub } from '../../test/webauthn'

const begun = (challenge: string): PasskeyBeginOutcome => ({
  outcome: 'begun', publicKeyOptions: JSON.stringify({ ...JSON.parse(REQUEST_OPTIONS), challenge }), expiresInSeconds: 300,
})

function mountProof(begin: () => Promise<PasskeyBeginOutcome>, onRefused = vi.fn()) {
  let proof!: ReturnType<typeof useTwoFactorProof>
  const wrapper = mount(defineComponent({
    setup() {
      proof = useTwoFactorProof({ begin, onRefused })
      return () => h('div')
    },
  }))
  return { wrapper, proof: () => proof }
}

const challengeSent = (stub: WebAuthnStub, call: number) => stub.get.mock.calls[call]?.[0].publicKey.challenge

describe('useTwoFactorProof', () => {
  let stub: WebAuthnStub

  beforeEach(() => {
    stub = installWebAuthnStub()
  })

  afterEach(() => {
    stub.restore()
    vi.useRealTimers()
  })

  it('opens the prompt over options already in hand: the click never waits on a fetch', async () => {
    const begin = vi.fn().mockResolvedValue(begun('AQID'))
    const { proof } = mountProof(begin)
    proof().start({ app: false, passkey: true })
    await flushPromises()
    expect(proof().ready.value).toBe(true)

    expect(await proof().prove()).toMatchObject({ outcome: 'ok' })
    expect(begin).toHaveBeenCalledTimes(1)
  })

  it('replaces the options before they expire, so a step left open still opens a live prompt', async () => {
    vi.useFakeTimers()
    const begin = vi.fn().mockResolvedValueOnce(begun('AQID')).mockResolvedValueOnce(begun('BAUG'))
    const { proof } = mountProof(begin)
    proof().start({ app: false, passkey: true })
    await flushPromises()

    await vi.advanceTimersByTimeAsync(270_000)
    expect(begin).toHaveBeenCalledTimes(2)
    expect(proof().ready.value).toBe(true)

    await proof().prove()
    expect(challengeSent(stub, 0)).toBe('BAUG')
  })

  it('a closed prompt keeps the options; an assertion sent uses them up', async () => {
    const begin = vi.fn().mockResolvedValue(begun('AQID'))
    const { proof } = mountProof(begin)
    proof().start({ app: false, passkey: true })
    await flushPromises()

    stub.get.mockRejectedValueOnce(new DOMException('closed', 'NotAllowedError'))
    expect(await proof().prove()).toEqual({ outcome: 'cancelled' })
    expect(proof().ready.value).toBe(true)

    expect((await proof().prove()).outcome).toBe('ok')
    expect(proof().ready.value).toBe(false)
  })

  it('choosing the app code, or leaving the step, closes an open prompt', async () => {
    const { proof, wrapper } = mountProof(vi.fn().mockResolvedValue(begun('AQID')))
    proof().start({ app: true, passkey: true })
    proof().choose('passkey')
    await flushPromises()
    let signal: AbortSignal | undefined
    stub.get.mockImplementation((options: { signal: AbortSignal }) => {
      signal = options.signal
      return new Promise(() => {})
    })

    void proof().prove()
    proof().choose('code')
    expect(signal?.aborted).toBe(true)

    proof().choose('passkey')
    await flushPromises()
    void proof().prove()
    wrapper.unmount()
    expect(signal?.aborted).toBe(true)
  })

  it('starts on the app, else a passkey this browser can use, else the fallback', () => {
    const { proof } = mountProof(vi.fn().mockResolvedValue(begun('AQID')))
    proof().start({ app: true, passkey: true })
    expect(proof().mode.value).toBe('code')
    stub.restore()
    proof().start({ app: false, passkey: true }, 'recovery')
    expect(proof().mode.value).toBe('recovery')
    proof().start({ app: false, passkey: true })
    expect(proof().mode.value).toBeNull()
  })
})
