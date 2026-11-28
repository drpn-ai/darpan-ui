import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LifecycleOutline from '../LifecycleOutline.vue'

// The outline draws the line the lifecycle's settings define, read only, in the order the settings give the stages:
// that order is the dependency order (each record made from the one before it), so the outline must never re-sort it.
const props = {
  recordLabel: 'Sales orders',
  account: 'Gorjana',
  rules: [{ fieldId: 'channel', fieldLabel: 'Sales channel', value: 'POS', valueLabel: 'Point of sale' }],
  stages: [
    { recordType: 'FULFILLMENT', label: 'Fulfillment' },
    { recordType: 'INVOICE', label: 'Invoice' },
    { recordType: 'DEPOSIT', label: 'Deposit' },
  ],
  exceptions: [{ stageRecordType: 'FULFILLMENT', stageLabel: 'Fulfillment', fieldId: 'ship', fieldLabel: 'Shipping method', value: 'Store Pickup' }],
  lateAfterDays: 2,
  places: [
    { stageLabel: 'Invoice', label: 'Shipped, never billed', finding: true },
    { stageLabel: 'Fulfillment', label: 'Never shipped', finding: true },
    { stageLabel: 'Fulfillment', label: 'Store Pickup, done', finding: false, kind: 'excusedDone' as const },
    { stageLabel: 'Deposit', label: 'Billed, no deposit', finding: true, kind: 'check' as const },
  ],
  complete: 'Shipped, billed and deposited',
}

describe('LifecycleOutline', () => {
  it('draws the start, then the stages in the order given, then the complete place', () => {
    const w = mount(LifecycleOutline, { props })
    const nodes = w.findAll('.lifecycle-outline-name').map((n) => n.text())
    expect(nodes).toEqual(['Sales orders', 'Fulfillment', 'Invoice', 'Deposit', 'Shipped, billed and deposited'])
    expect(w.get('[data-testid="lifecycle-outline-rule"]').text()).toBe('except Sales channel is Point of sale')
    expect(w.get('[data-testid="lifecycle-outline-late"]').text()).toBe('judged after 2 days')
  })

  it('puts each place and exception once, under its own stage, saying whether it is a finding', () => {
    const w = mount(LifecycleOutline, { props })
    const group = (label: string) => w.findAll('.lifecycle-outline-group')
      .find((g) => g.find('.lifecycle-outline-name').text() === label)!
    expect(group('Fulfillment').get('[data-testid="lifecycle-outline-exception"]').text())
      .toBe('not expected for Shipping method is Store Pickup')
    expect(group('Fulfillment').findAll('.lifecycle-outline-place').map((p) => p.text())).toEqual([
      'stops at Never shippedFinding',
      'goes on to Store Pickup, donenot a finding',
    ])
    expect(group('Invoice').findAll('.lifecycle-outline-place').map((p) => p.text())).toEqual(['stops at Shipped, never billedFinding'])
    expect(group('Deposit').findAll('.lifecycle-outline-place').map((p) => p.text())).toEqual(['flags Billed, no depositFinding'])
    expect(w.findAll('.lifecycle-outline-place')).toHaveLength(props.places.length)
  })

  it('words the late window for the same day and for one day', () => {
    expect(mount(LifecycleOutline, { props: { ...props, lateAfterDays: 0 } }).get('[data-testid="lifecycle-outline-late"]').text())
      .toBe('judged after the same day')
    expect(mount(LifecycleOutline, { props: { ...props, lateAfterDays: 1 } }).get('[data-testid="lifecycle-outline-late"]').text())
      .toBe('judged after 1 day')
  })
})
