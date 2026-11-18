import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { forgetPasskey, hasRememberedPasskey, rememberPasskey } from '../passkeyHint'
import { installLocalStorageStub } from '../../test/localStorage'

// DAR-UI-120: which usernames signed in with a passkey on this browser, so Next can open the passkey prompt for them.
// Only hashes are stored; anything that goes wrong reads as "not remembered" and the password step follows.

const KEY = 'darpan.passkeySignInHints'
const stored = (): string[] => JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as string[]

describe('passkey sign-in hints', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('remembers a username as a SHA-256 hash only, matched without case or spaces', async () => {
    await rememberPasskey('Ada.Lovelace')

    const raw = window.localStorage.getItem(KEY) ?? ''
    expect(raw).not.toContain('ada')
    expect(stored()).toHaveLength(1)
    expect(stored()[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(await hasRememberedPasskey('  ada.lovelace ')).toBe(true)
    expect(await hasRememberedPasskey('grace')).toBe(false)
  })

  it('keeps the five most recent, newest first, without repeats', async () => {
    for (const name of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6']) await rememberPasskey(name)

    expect(stored()).toHaveLength(5)
    expect(await hasRememberedPasskey('u1')).toBe(false)
    expect(await hasRememberedPasskey('u2')).toBe(true)

    // Used again, u3 moves to the front, so the next newcomer pushes out u2, not u3.
    const before = stored()
    await rememberPasskey('u3')
    expect(stored()).toHaveLength(5)
    expect(stored()[0]).toBe(before[3])
    await rememberPasskey('u7')
    expect(await hasRememberedPasskey('u2')).toBe(false)
    expect(await hasRememberedPasskey('u3')).toBe(true)
  })

  it('forgets one username and leaves the others', async () => {
    await rememberPasskey('ada')
    await rememberPasskey('grace')
    await forgetPasskey('ADA')

    expect(await hasRememberedPasskey('ada')).toBe(false)
    expect(await hasRememberedPasskey('grace')).toBe(true)
  })

  it('an empty username is never remembered', async () => {
    await rememberPasskey('   ')
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(await hasRememberedPasskey('')).toBe(false)
  })

  it('storage that throws reads as not remembered, and remembering does not throw', async () => {
    await rememberPasskey('ada')
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked') })

    expect(await hasRememberedPasskey('ada')).toBe(false)
    await expect(rememberPasskey('grace')).resolves.toBeUndefined()
    await expect(forgetPasskey('ada')).resolves.toBeUndefined()
  })

  it('a stored value that is not a list of hashes reads as empty', async () => {
    window.localStorage.setItem(KEY, '{"ada":true}')
    expect(await hasRememberedPasskey('ada')).toBe(false)
    window.localStorage.setItem(KEY, 'not json')
    expect(await hasRememberedPasskey('ada')).toBe(false)
    await rememberPasskey('ada')
    expect(await hasRememberedPasskey('ada')).toBe(true)
  })

  it('without crypto.subtle (an insecure origin) nothing is remembered', async () => {
    await rememberPasskey('ada')
    vi.spyOn(globalThis, 'crypto', 'get').mockReturnValue({} as Crypto)

    expect(await hasRememberedPasskey('ada')).toBe(false)
    await rememberPasskey('grace')
    expect(stored()).toHaveLength(1)
  })
})
