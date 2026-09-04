import { describe, expect, it } from 'vitest'
import { RUN_STAGE_SEQUENCE, formatRunStepDuration, reconciliationStageLabel } from '../reconciliationDisplay'

describe('reconciliationStageLabel', () => {
  it('labels lifecycle stages with operator-friendly text', () => {
    expect(reconciliationStageLabel('RESOLVE')).toBe('Preparing run')
    expect(reconciliationStageLabel('COMPARE')).toBe('Comparing records')
    expect(reconciliationStageLabel('WRITE_OUTPUT')).toBe('Writing results')
    expect(reconciliationStageLabel('VERIFY')).toBe('Verifying differences')
    expect(reconciliationStageLabel('NOTIFY')).toBe('Sending notifications')
  })

  it('labels extract stages with the run system names when provided', () => {
    // A raw enum token on either side resolves to the system name the rest of the screen uses.
    expect(reconciliationStageLabel('EXTRACT_FILE1', 'SHOPIFY', 'OMS')).toBe('Extracting Shopify')
    expect(reconciliationStageLabel('EXTRACT_FILE2', 'SHOPIFY', 'OMS')).toBe('Extracting HotWax')
    expect(reconciliationStageLabel('EXTRACT_FILE1')).toBe('Extracting source 1')
    expect(reconciliationStageLabel('EXTRACT_FILE2')).toBe('Extracting source 2')
  })

  it('names the system an extract pulled from, not the endpoint it used', () => {
    // A run stamps the endpoint enum's description into its side labels, so the timeline read
    // 'Extracting Shopify Order Return References' -- the transport, not the system, and long
    // enough to push the duration and record count off the end of the row.
    expect(reconciliationStageLabel('EXTRACT_FILE1', 'Shopify Order Return References', 'HotWax Returns (Reconciliation API)'))
      .toBe('Extracting Shopify')
    expect(reconciliationStageLabel('EXTRACT_FILE2', 'Shopify Order Return References', 'HotWax Returns (Reconciliation API)'))
      .toBe('Extracting HotWax')
  })

  it('keeps the endpoint labels when both extracts hit the same system', () => {
    // Collapsing here would print 'Extracting HotWax' on both rows and leave the two extracts
    // indistinguishable in the timeline, which is worse than a long label.
    expect(reconciliationStageLabel('EXTRACT_FILE1', 'HotWax Returns (Reconciliation API)', 'HotWax Transfer Orders'))
      .toBe('Extracting HotWax Returns (Reconciliation API)')
    expect(reconciliationStageLabel('EXTRACT_FILE2', 'HotWax Returns (Reconciliation API)', 'HotWax Transfer Orders'))
      .toBe('Extracting HotWax Transfer Orders')
  })

  it('names the systems a verify step actually checked, from its own metrics', () => {
    // Three different verification passes share the VERIFY stage code, so two rows on one run read
    // identically unless each says which system it rechecked. The backend stamps the side labels it
    // used; the system name is resolved here, same as every other label on this screen.
    expect(reconciliationStageLabel('VERIFY', 'HotWax Returns (Reconciliation API)', 'Shopify Order Return References',
      '{"verifiedSystems":["Shopify Order Return References"]}')).toBe("Verifying Shopify's diffs")
    expect(reconciliationStageLabel('VERIFY', 'HotWax Returns (Reconciliation API)', 'Shopify Order Return References',
      '{"verifiedSystems":["HotWax Returns (Reconciliation API)"]}')).toBe("Verifying HotWax's diffs")
  })

  it('joins both systems when one verify pass checked both sides', () => {
    expect(reconciliationStageLabel('VERIFY', 'HotWax', 'Shopify',
      '{"verifiedSystems":["HotWax","Shopify"]}')).toBe("Verifying HotWax and Shopify's diffs")
  })

  it('tells the three verification passes apart by their own stage codes', () => {
    // The passes used to share one VERIFY code, so a run performing two of them rendered two rows
    // reading exactly the same. The code says WHICH check ran; metricsJson says on which systems.
    expect(reconciliationStageLabel('VERIFY_MISSING', 'HotWax', 'Shopify',
      '{"verifiedSystems":["Shopify"]}')).toBe("Verifying Shopify's diffs")
    expect(reconciliationStageLabel('VERIFY_EXCHANGE', 'HotWax', 'Shopify',
      '{"verifiedSystems":["HotWax","Shopify"]}')).toBe("Verifying HotWax and Shopify's exchange pairs")
    expect(reconciliationStageLabel('VERIFY_RETURNS', 'HotWax', 'Shopify',
      '{"verifiedSystems":["HotWax","Shopify"]}')).toBe("Verifying HotWax and Shopify's returns")
  })

  it('names each verification pass even when it recorded no systems', () => {
    expect(reconciliationStageLabel('VERIFY_MISSING')).toBe('Verifying differences')
    expect(reconciliationStageLabel('VERIFY_EXCHANGE')).toBe('Verifying exchange pairs')
    expect(reconciliationStageLabel('VERIFY_RETURNS')).toBe('Verifying returns')
  })

  it('still labels the retired shared code, which older runs stored', () => {
    expect(reconciliationStageLabel('VERIFY')).toBe('Verifying differences')
    expect(reconciliationStageLabel('VERIFY', 'HotWax', 'Shopify',
      '{"verifiedSystems":["Shopify"]}')).toBe("Verifying Shopify's diffs")
  })

  it('keeps the generic verify label when the step names no systems', () => {
    expect(reconciliationStageLabel('VERIFY')).toBe('Verifying differences')
    expect(reconciliationStageLabel('VERIFY', 'HotWax', 'Shopify', '{}')).toBe('Verifying differences')
    expect(reconciliationStageLabel('VERIFY', 'HotWax', 'Shopify', '{"verifiedSystems":[]}')).toBe('Verifying differences')
    // Malformed metrics must never blank out or crash a timeline row.
    expect(reconciliationStageLabel('VERIFY', 'HotWax', 'Shopify', 'not json')).toBe('Verifying differences')
  })

  it('falls back to the raw code for unknown stages and empty for blank input', () => {
    expect(reconciliationStageLabel('FUTURE_STAGE')).toBe('FUTURE_STAGE')
    expect(reconciliationStageLabel('')).toBe('')
    expect(reconciliationStageLabel(null)).toBe('')
  })
})

describe('RUN_STAGE_SEQUENCE', () => {
  it('verifies before writing results, so the written artifact is the verified one', () => {
    expect(RUN_STAGE_SEQUENCE.indexOf('VERIFY_MISSING')).toBeLessThan(RUN_STAGE_SEQUENCE.indexOf('WRITE_OUTPUT'))
    expect(RUN_STAGE_SEQUENCE.indexOf('VERIFY_EXCHANGE')).toBeLessThan(RUN_STAGE_SEQUENCE.indexOf('WRITE_OUTPUT'))
    expect(RUN_STAGE_SEQUENCE.indexOf('VERIFY_RETURNS')).toBeLessThan(RUN_STAGE_SEQUENCE.indexOf('WRITE_OUTPUT'))
    // The retired shared code is not a stage a new run can enter, so it must not be synthesized
    // as a pending row on a live run.
    expect(RUN_STAGE_SEQUENCE).not.toContain('VERIFY')
    expect(RUN_STAGE_SEQUENCE.indexOf('WRITE_OUTPUT')).toBeLessThan(RUN_STAGE_SEQUENCE.indexOf('NOTIFY'))
    expect(RUN_STAGE_SEQUENCE.indexOf('COMPARE')).toBeLessThan(RUN_STAGE_SEQUENCE.indexOf('VERIFY_MISSING'))
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
