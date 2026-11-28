import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { ApiCallError } from '../../lib/api/client'

const subscribeRunNotification = vi.hoisted(() => vi.fn())
const unsubscribeRunNotification = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const saveUserNotificationDefault = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: { subscribeRunNotification, unsubscribeRunNotification },
  settingsFacade: { listTenantChatSpaces, saveUserNotificationDefault },
}))

import type { GetReconciliationRunStatusResponse } from '../../lib/api/types'
import { useRunNotifyMe } from '../useRunNotifyMe'

const needsDefault = () => new ApiCallError('Set a default chat space first.', 200, {
  result: { ok: false, errors: [], needsDefaultChatSpace: true },
})

function setup(statusFields: Partial<GetReconciliationRunStatusResponse> = {}) {
  const status = ref({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', ...statusFields } as GetReconciliationRunStatusResponse)
  const refreshRunStatus = vi.fn(async () => {})
  const notify = useRunNotifyMe({ runId: computed(() => 'RR_1'), runStatus: computed(() => status.value), refreshRunStatus })
  return { notify, refreshRunStatus }
}

describe('useRunNotifyMe', () => {
  beforeEach(() => {
    for (const mock of [subscribeRunNotification, unsubscribeRunNotification, listTenantChatSpaces, saveUserNotificationDefault]) mock.mockReset()
  })

  it('is not offered on a run that has finished: it has notified already, or never will', () => {
    expect(setup({ statusEnumId: 'AUT_STAT_SUCCESS' }).notify.showNotifyMe.value).toBe(false)
    expect(setup({ statusEnumId: 'AUT_STAT_FAILED' }).notify.showNotifyMe.value).toBe(false)
    expect(setup().notify.showNotifyMe.value).toBe(true)
  })

  it('a subscribed viewer unsubscribes, and the button re-reads the run', async () => {
    unsubscribeRunNotification.mockResolvedValue({ ok: true })
    const { notify, refreshRunStatus } = setup({ mySubscription: true, mySubscriptionSpaceName: 'Ops Room' })
    expect(notify.notifyButtonLabel.value).toBe('Notifying — Ops Room')

    await notify.toggleNotifyMe()

    expect(unsubscribeRunNotification).toHaveBeenCalledWith({ reconciliationRunResultId: 'RR_1' })
    expect(subscribeRunNotification).not.toHaveBeenCalled()
    expect(refreshRunStatus).toHaveBeenCalledWith('RR_1')
  })

  it('when the chat spaces cannot be read, the picker closes and says why', async () => {
    subscribeRunNotification.mockRejectedValue(needsDefault())
    listTenantChatSpaces.mockRejectedValue(new ApiCallError('Chat spaces are unavailable.'))
    const { notify, refreshRunStatus } = setup()

    await notify.toggleNotifyMe()

    expect(notify.notifyPickerOpen.value).toBe(false)
    expect(notify.notifyError.value).toBe('Chat spaces are unavailable.')
    expect(refreshRunStatus).not.toHaveBeenCalled()
  })

  it('offers only active chat spaces, lettered in order', async () => {
    subscribeRunNotification.mockRejectedValue(needsDefault())
    listTenantChatSpaces.mockResolvedValue({ chatSpaces: [
      { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: 'Y' },
      { chatSpaceId: 'CS2', spaceName: 'Old', isActive: 'N' },
      { chatSpaceId: 'CS3', spaceName: 'Finance' },
    ] })
    const { notify } = setup()

    await notify.toggleNotifyMe()

    expect(notify.notifyPickerOptions.value.map((option) => [option.value, option.shortcutKey])).toEqual([['CS1', 'A'], ['CS3', 'B']])
  })
})
