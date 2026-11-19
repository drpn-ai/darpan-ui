import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keepAccount, keptAccount, passkeyKeptFor } from '../passkeyHint'
import { installLocalStorageStub } from '../../test/localStorage'

// DAR-UI-132: the device note. One account per browser, plain username, and how this browser last proved it. Anything
// that goes wrong reads as "no note", which is a new device: username, then password.

const KEY = 'darpan.signInAccount'

describe('device note', () => {
  beforeEach(() => {
    installLocalStorageStub()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps one account, replaced by the next sign-in, and matches the username without case or spaces', () => {
    keepAccount(' Ada.Lovelace ', 'passkey')
    expect(keptAccount()).toEqual({ username: 'Ada.Lovelace', method: 'passkey' })
    expect(passkeyKeptFor('ada.lovelace  ')).toBe(true)
    expect(passkeyKeptFor('grace')).toBe(false)

    keepAccount('grace', 'password')
    expect(keptAccount()).toEqual({ username: 'grace', method: 'password' })
    expect(passkeyKeptFor('ada.lovelace')).toBe(false)
    expect(passkeyKeptFor('grace')).toBe(false)
  })

  it('an empty username is never kept and never matches', () => {
    keepAccount('ada', 'passkey')
    keepAccount('   ', 'password')
    expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
    expect(passkeyKeptFor('')).toBe(false)
  })

  it('storage that throws reads as no note, and keeping does not throw', () => {
    keepAccount('ada', 'passkey')
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('blocked') })

    expect(keptAccount()).toBeNull()
    expect(passkeyKeptFor('ada')).toBe(false)
    expect(() => keepAccount('grace', 'password')).not.toThrow()
  })

  it.each([
    ['not json'],
    ['["0f3a"]'],
    ['{"username":"ada"}'],
    ['{"username":"ada","method":"sms"}'],
    ['{"username":"  ","method":"passkey"}'],
  ])('a stored value that is not a kept account (%s) reads as no note', (raw) => {
    window.localStorage.setItem(KEY, raw)
    expect(keptAccount()).toBeNull()
    expect(passkeyKeptFor('ada')).toBe(false)
  })
})
