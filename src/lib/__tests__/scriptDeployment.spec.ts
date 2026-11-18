import { describe, expect, it } from 'vitest'
import { cronFromTime, isFailedStatus, newestResultFileName, scheduleState, scheduleWords, statusWords, timeFromCron } from '../scriptDeployment'

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

describe('scriptDeployment (DAR-UI-124)', () => {
  it('reads a daily cron as a twelve-hour time and any other cron as itself', () => {
    expect(scheduleWords('0 0 7 * * ?')).toBe('Daily at 7:00 AM')
    expect(scheduleWords('0 30 0 * * ?')).toBe('Daily at 12:30 AM')
    expect(scheduleWords('0 5 13 * * ?')).toBe('Daily at 1:05 PM')
    expect(scheduleWords('0 0 9 ? * MON')).toBe('Cron 0 0 9 ? * MON')
  })

  it('names a failed last run before on or off', () => {
    expect(scheduleState(null)).toBe('none')
    expect(scheduleState({ isActive: true, lastRunStatus: 'SENT' })).toBe('on')
    expect(scheduleState({ isActive: false, lastRunStatus: null })).toBe('off')
    expect(scheduleState({ isActive: true, lastRunStatus: 'NOT_DELIVERED' })).toBe('failed')
    expect(isFailedStatus('NOTHING_TO_SEND')).toBe(false)
  })

  it('picks the newest finished result of that saved run', () => {
    const outputs = [
      { fileName: 'a.json', savedRunId: 'OTHER' },
      { fileName: 'b.json', savedRunId: 'RS', resultAvailable: false },
      { fileName: 'c.json', savedRunId: 'RS' },
      { fileName: 'd.json', savedRunId: 'RS' },
    ]
    expect(newestResultFileName(outputs, 'RS')).toBe('c.json')
    expect(newestResultFileName(outputs, 'NONE')).toBeNull()
  })
})
