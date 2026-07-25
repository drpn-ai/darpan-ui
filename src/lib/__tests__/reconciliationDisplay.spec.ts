import { describe, expect, it } from 'vitest'
import { formatRunStepDuration, reconciliationStageLabel } from '../reconciliationDisplay'

describe('reconciliationStageLabel', () => {
  it('labels lifecycle stages with operator-friendly text', () => {
    expect(reconciliationStageLabel('RESOLVE')).toBe('Preparing run')
    expect(reconciliationStageLabel('COMPARE')).toBe('Comparing records')
    expect(reconciliationStageLabel('WRITE_OUTPUT')).toBe('Writing results')
    expect(reconciliationStageLabel('VERIFY')).toBe('Verifying differences')
    expect(reconciliationStageLabel('NOTIFY')).toBe('Sending notifications')
  })

  it('labels extract stages with the run system labels when provided', () => {
    expect(reconciliationStageLabel('EXTRACT_FILE1', 'SHOPIFY', 'OMS')).toBe('Extracting SHOPIFY')
    expect(reconciliationStageLabel('EXTRACT_FILE2', 'SHOPIFY', 'OMS')).toBe('Extracting OMS')
    expect(reconciliationStageLabel('EXTRACT_FILE1')).toBe('Extracting source 1')
    expect(reconciliationStageLabel('EXTRACT_FILE2')).toBe('Extracting source 2')
  })

  it('falls back to the raw code for unknown stages and empty for blank input', () => {
    expect(reconciliationStageLabel('FUTURE_STAGE')).toBe('FUTURE_STAGE')
    expect(reconciliationStageLabel('')).toBe('')
    expect(reconciliationStageLabel(null)).toBe('')
  })
})

describe('formatRunStepDuration', () => {
  it('formats second, minute, and hour scale durations', () => {
    expect(formatRunStepDuration(0, 12000)).toBe('12s')
    expect(formatRunStepDuration(0, 272000)).toBe('4m 32s')
    expect(formatRunStepDuration(0, 3900000)).toBe('1h 05m')
    expect(formatRunStepDuration(0, 400)).toBe('<1s')
  })

  it('accepts ISO strings and epoch millis interchangeably', () => {
    expect(formatRunStepDuration('2026-07-25T10:00:00.000Z', '2026-07-25T10:00:45.000Z')).toBe('45s')
    expect(formatRunStepDuration(1784955159000, 1784955171000)).toBe('12s')
  })

  it('returns empty for missing or inverted timestamps', () => {
    expect(formatRunStepDuration(null, 12000)).toBe('')
    expect(formatRunStepDuration(12000, null)).toBe('')
    expect(formatRunStepDuration(20000, 10000)).toBe('')
    expect(formatRunStepDuration('not-a-date', 12000)).toBe('')
  })
})
