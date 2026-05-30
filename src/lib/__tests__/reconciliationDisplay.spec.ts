import { describe, expect, it } from 'vitest'
import {
  fileNameFromPath,
  humanizeToken,
  normalizeDisplayText,
  normalizeDisplayToken,
} from '../reconciliationDisplay'

describe('normalizeDisplayText', () => {
  it('trims strings and rejects non-strings', () => {
    expect(normalizeDisplayText('  hello  ')).toBe('hello')
    expect(normalizeDisplayText('')).toBe('')
    expect(normalizeDisplayText(undefined)).toBe('')
    expect(normalizeDisplayText(123)).toBe('')
    expect(normalizeDisplayText(null)).toBe('')
  })
})

describe('normalizeDisplayToken', () => {
  it('lowercases and collapses non-alphanumerics into single underscores', () => {
    expect(normalizeDisplayToken('  Order Sync!! ')).toBe('order_sync')
    expect(normalizeDisplayToken('API-2')).toBe('api_2')
    expect(normalizeDisplayToken('___edge___')).toBe('edge')
    expect(normalizeDisplayToken(42)).toBe('')
  })
})

describe('fileNameFromPath', () => {
  it('returns the last path segment for both separators', () => {
    expect(fileNameFromPath('/runtime/datamanager/file.json')).toBe('file.json')
    expect(fileNameFromPath('C:\\temp\\out.csv')).toBe('out.csv')
    expect(fileNameFromPath('plainname')).toBe('plainname')
  })

  it('returns empty string for blank or non-string input', () => {
    expect(fileNameFromPath('')).toBe('')
    expect(fileNameFromPath(undefined)).toBe('')
  })
})

describe('humanizeToken', () => {
  it('strips automation/source prefixes and title-cases the rest', () => {
    expect(humanizeToken('AUT_IN_ORDER_SYNC')).toBe('Order Sync')
    expect(humanizeToken('AUT_WIN_DAILY')).toBe('Daily')
  })

  it('keeps known acronyms uppercase', () => {
    expect(humanizeToken('API_FETCH_ORDERS')).toBe('API Fetch Orders')
    expect(humanizeToken('SFTP_DAILY_PULL')).toBe('SFTP Daily Pull')
    expect(humanizeToken('utc_offset')).toBe('UTC Offset')
  })

  it('returns empty string for blank or non-string input', () => {
    expect(humanizeToken('')).toBe('')
    expect(humanizeToken(null)).toBe('')
  })
})
