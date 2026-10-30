import { describe, expect, it } from 'vitest'
import { cronFromTime, statusWords, timeFromCron } from '../scriptDeployment'

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
    expect(statusWords('SENT')).toBe('Sent')
    expect(statusWords(null)).toBe('')
  })
})
