import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useReconciliationDraftStore } from '../reconciliationDraft'

// DAR-UI-156. A run's full saves now run behind the screen (rules editor, run settings, read options); each sends the
// whole run, so two out at once could send rules with no id twice. They go one at a time, and a refusal stops nothing.
describe('afterRuleSetSaves', () => {
  it('runs each save after the one before it has answered, refused or not', async () => {
    const store = useReconciliationDraftStore()
    const order: string[] = []
    let answerFirst: () => void = () => {}
    const first = store.afterRuleSetSaves(() => new Promise<void>((_, reject) => { order.push('first'); answerFirst = () => reject(new Error('refused')) }))
    const second = store.afterRuleSetSaves(async () => { order.push('second') })
    await flushPromises()
    expect(order).toEqual(['first'])
    answerFirst()
    await expect(first).rejects.toThrow('refused')
    await second
    expect(order).toEqual(['first', 'second'])
  })
})
