import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isAbortError } from '../lib/api/client'
import { settingsFacade } from '../lib/api/facade'
import type { TenantSettings } from '../lib/api/types'

interface LoadState {
  loading: boolean
  error: string | null
}

function emptyLoadState(): LoadState {
  return { loading: false, error: null }
}

export const useReferenceDataStore = defineStore('referenceData', () => {
  const _tenantSettings = ref<TenantSettings | null>(null)
  const _tenantSettingsState = ref<LoadState>(emptyLoadState())

  let _hydrationPromise: Promise<void> | null = null
  let _abortController: AbortController | null = null

  const tenantSettings = computed(() => _tenantSettings.value)
  const tenantSettingsLoading = computed(() => _tenantSettingsState.value.loading)
  const tenantSettingsError = computed(() => _tenantSettingsState.value.error)

  async function _loadTenantSettings(signal: AbortSignal): Promise<void> {
    _tenantSettingsState.value = { loading: true, error: null }
    try {
      const response = await settingsFacade.getTenantSettings(signal)
      _tenantSettings.value = response.tenantSettings ?? null
      _tenantSettingsState.value = emptyLoadState()
    } catch (err) {
      if (isAbortError(err)) return
      _tenantSettingsState.value = {
        loading: false,
        error: err instanceof Error ? err.message : 'Tenant settings are stuck in traffic.',
      }
    }
  }

  function hydrate(): Promise<void> {
    if (_hydrationPromise) return _hydrationPromise

    _abortController = new AbortController()

    // _loadTenantSettings records its own failure and never rejects.
    _hydrationPromise = _loadTenantSettings(_abortController.signal)
    return _hydrationPromise
  }

  function ensureLoaded(): Promise<void> {
    return hydrate()
  }

  function setTenantSettings(value: TenantSettings | null | undefined): void {
    _tenantSettings.value = value ?? null
    _tenantSettingsState.value = emptyLoadState()
  }

  function reset(): void {
    _abortController?.abort()
    _abortController = null
    _hydrationPromise = null
    _tenantSettings.value = null
    _tenantSettingsState.value = emptyLoadState()
  }

  return {
    tenantSettings,
    tenantSettingsLoading,
    tenantSettingsError,
    hydrate,
    ensureLoaded,
    setTenantSettings,
    reset,
  }
})
