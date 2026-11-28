import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const getTenantSettings = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api/facade', () => ({ settingsFacade: { getTenantSettings } }))

import { useReferenceDataStore } from '../referenceData'
import { ApiCallError } from '../../lib/api/client'

describe('reference data store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getTenantSettings.mockReset()
  })

  it('reads tenant settings once however many pages ask', async () => {
    getTenantSettings.mockResolvedValue({ tenantSettings: { companyUserGroupId: 'RAILS', timeZone: 'Europe/London' } })
    const store = useReferenceDataStore()

    await Promise.all([store.hydrate(), store.hydrate(), store.hydrate()])

    expect(getTenantSettings).toHaveBeenCalledTimes(1)
    expect(store.tenantSettings?.timeZone).toBe('Europe/London')
    expect(store.tenantSettingsLoading).toBe(false)
    expect(store.tenantSettingsError).toBeNull()
  })

  it('a failed read resolves, says why, and holds no settings', async () => {
    getTenantSettings.mockRejectedValueOnce(new ApiCallError('Darpan stepped out for chai.', 503))
    const store = useReferenceDataStore()

    await expect(store.hydrate()).resolves.toBeUndefined()

    expect(store.tenantSettings).toBeNull()
    expect(store.tenantSettingsError).toBe('Darpan stepped out for chai.')
    expect(store.tenantSettingsLoading).toBe(false)
  })

  it('a thrown non-error still reads as a failure, never as loaded', async () => {
    getTenantSettings.mockRejectedValueOnce('boom')
    const store = useReferenceDataStore()

    await store.hydrate()

    expect(store.tenantSettingsError).toBe('Tenant settings are stuck in traffic.')
  })

  // A tenant switch resets the store: the read still in flight is the last tenant's and must not land.
  it('reset aborts the read in flight and the next hydrate reads again', async () => {
    let signalSeen: AbortSignal | undefined
    getTenantSettings.mockImplementationOnce((signal: AbortSignal) => {
      signalSeen = signal
      return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    })
    getTenantSettings.mockResolvedValueOnce({ tenantSettings: { companyUserGroupId: 'KREWE' } })
    const store = useReferenceDataStore()

    const first = store.hydrate()
    store.reset()
    await first

    expect(signalSeen?.aborted).toBe(true)
    expect(store.tenantSettings).toBeNull()
    expect(store.tenantSettingsError).toBeNull()
    await store.hydrate()
    expect(store.tenantSettings?.companyUserGroupId).toBe('KREWE')
  })

  it('a save hands its settings straight to the store', () => {
    const store = useReferenceDataStore()
    store.setTenantSettings({ companyUserGroupId: 'RAILS', timeZone: 'UTC', streaksChatSpaceId: 'CS1' })

    expect(store.tenantSettings?.streaksChatSpaceId).toBe('CS1')
    expect(store.tenantSettingsLoading).toBe(false)
  })
})
