import { describe, expect, it } from 'vitest'
import { badRecipient, cronFromTime, formatRecipients, isFailedStatus, parseRecipients, scheduleState, scheduleWords, statusWords, timeFromCron } from '../scriptDeployment'

describe('scriptDeployment', () => {
  it('maps a daily time to a Quartz cron and back', () => {
    expect(cronFromTime('09:00')).toBe('0 0 9 * * ?')
    expect(cronFromTime('7:30')).toBe('0 30 7 * * ?')
    expect(timeFromCron('0 30 7 * * ?')).toBe('07:30')
    expect(timeFromCron(cronFromTime('23:59'))).toBe('23:59')
  })

  it('refuses what is not a daily time', () => {
    expect(cronFromTime('25:00')).toBeNull()
    expect(cronFromTime('9am')).toBeNull()
    expect(timeFromCron('0 0 9 ? * MON')).toBeNull()
    expect(timeFromCron(null)).toBeNull()
  })

  it('names outcomes in words', () => {
    expect(statusWords('NOTHING_TO_SEND')).toBe('Nothing to send')
    expect(statusWords('OK')).toBe('Sent')
    expect(statusWords(null)).toBe('')
  })
})

describe('scriptDeployment (DAR-UI-124)', () => {
  it('reads a daily cron as a twelve-hour time and any other cron as itself', () => {
    expect(scheduleWords('0 0 7 * * ?')).toBe('Daily at 7:00 AM')
    expect(scheduleWords('0 30 0 * * ?')).toBe('Daily at 12:30 AM')
    expect(scheduleWords('0 5 13 * * ?')).toBe('Daily at 1:05 PM')
    expect(scheduleWords('0 0 9 ? * MON')).toBe('Cron 0 0 9 ? * MON')
  })

  it('names a failed last run before on or off', () => {
    expect(scheduleState(null)).toBe('none')
    expect(scheduleState({ isActive: true, lastRunStatus: 'OK' })).toBe('on')
    expect(scheduleState({ isActive: 'Y', lastRunStatus: 'OK' })).toBe('on')
    expect(scheduleState({ isActive: false, lastRunStatus: null })).toBe('off')
    expect(scheduleState({ isActive: true, lastRunStatus: 'DELIVERY_FAILED' })).toBe('failed')
    expect(scheduleState({ isActive: 'N', lastRunStatus: 'OWNER_LOST' })).toBe('failed')
    expect(isFailedStatus('NOTHING_TO_SEND')).toBe(false)
  })

  it('labels every status moqui-jexl reports', () => {
    const statuses = ['OK', 'NOTHING_TO_SEND', 'PREVIEW', 'HELD', 'DISABLED', 'OWNER_LOST', 'READ_ERROR', 'READ_NOT_ALLOWED',
      'READ_TOO_LARGE', 'SCRIPT_ERROR', 'RESULT_INVALID', 'DELIVERY_PARTIAL', 'DELIVERY_FAILED', 'STUCK', 'SCRIPT_MISSING',
      'NO_INPUT', 'WAITING', 'EXPIRED']
    for (const status of statuses) expect(statusWords(status)).not.toBe(status)
    expect(new Set(statuses.map(statusWords)).size).toBe(statuses.length)
  })
})

describe('scriptDeployment recipients (DAR-BE-334)', () => {
  it('reads any separator and writes one comma list without duplicates', () => {
    expect(parseRecipients(' a@x.com; b@y.com,\n c@z.com ')).toEqual(['a@x.com', 'b@y.com', 'c@z.com'])
    expect(parseRecipients(null)).toEqual([])
    expect(formatRecipients(['a@x.com', 'A@X.com', 'b@y.com'])).toBe('a@x.com, b@y.com')
  })

  it('names the first address that is not one', () => {
    expect(badRecipient(['a@x.com', 'ops'])).toBe('ops')
    expect(badRecipient(['a@x.com'])).toBeNull()
  })
})
