import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiCallError, isAbortError } from '../lib/api/client'
import { settingsFacade } from '../lib/api/facade'
import type {
  LlmSettings,
  TenantSettings,
} from '../lib/api/types'
import { usePermissionsStore } from './permissions'

export type LlmProvider = 'OPENAI' | 'GEMINI'

const LLM_PROVIDERS: readonly LlmProvider[] = ['OPENAI', 'GEMINI']

interface LoadState {
  loading: boolean
  error: string | null
  loadedAt: number | null
}

function emptyLoadState(): LoadState {
  return { loading: false, error: null, loadedAt: null }
}

function describeError(err: unknown, fallback: string): string {
  if (isAbortError(err)) return fallback
  if (err instanceof ApiCallError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

export const useReferenceDataStore = defineStore('referenceData', () => {
  const _tenantSettings = ref<TenantSettings | null>(null)
  const _tenantSettingsState = ref<LoadState>(emptyLoadState())

  const _llmProviders = ref<Map<LlmProvider, LlmSettings | null>>(new Map())
  const _llmProvidersState = ref<LoadState>(emptyLoadState())

  let _hydrationPromise: Promise<void> | null = null
  let _abortController: AbortController | null = null

  const tenantSettings = computed(() => _tenantSettings.value)
  const tenantSettingsLoading = computed(() => _tenantSettingsState.value.loading)
  const tenantSettingsError = computed(() => _tenantSettingsState.value.error)

  const llmProvidersLoading = computed(() => _llmProvidersState.value.loading)
  const llmProvidersError = computed(() => _llmProvidersState.value.error)

  function getLlmProvider(provider: LlmProvider): LlmSettings | null {
    return _llmProviders.value.get(provider) ?? null
  }

  async function _loadTenantSettings(signal: AbortSignal): Promise<void> {
    _tenantSettingsState.value = { loading: true, error: null, loadedAt: _tenantSettingsState.value.loadedAt }
    try {
      const response = await settingsFacade.getTenantSettings(signal)
      _tenantSettings.value = response.tenantSettings ?? null
      _tenantSettingsState.value = { loading: false, error: null, loadedAt: Date.now() }
    } catch (err) {
      if (isAbortError(err)) return
      _tenantSettingsState.value = {
        loading: false,
        error: describeError(err, 'Unable to load tenant settings.'),
        loadedAt: null,
      }
    }
  }

  async function _loadLlmProviders(signal: AbortSignal): Promise<void> {
    _llmProvidersState.value = { loading: true, error: null, loadedAt: _llmProvidersState.value.loadedAt }
    try {
      const responses = await Promise.all(
        LLM_PROVIDERS.map((provider) => settingsFacade.getLlmSettings({ llmProvider: provider }, signal)),
      )
      const next = new Map<LlmProvider, LlmSettings | null>()
      LLM_PROVIDERS.forEach((provider, index) => {
        next.set(provider, responses[index]?.llmSettings ?? null)
      })
      _llmProviders.value = next
      _llmProvidersState.value = { loading: false, error: null, loadedAt: Date.now() }
    } catch (err) {
      if (isAbortError(err)) return
      _llmProviders.value = new Map()
      _llmProvidersState.value = {
        loading: false,
        error: describeError(err, 'Unable to load AI provider settings.'),
        loadedAt: null,
      }
    }
  }

  function hydrate(): Promise<void> {
    if (_hydrationPromise) return _hydrationPromise

    _abortController = new AbortController()
    const signal = _abortController.signal

    const tasks: Array<Promise<unknown>> = [
      _loadTenantSettings(signal),
    ]

    // AI provider settings are only visible to global admins. Skip the fan-out
    // for everyone else so we don't generate noisy 403s during login.
    const permissions = usePermissionsStore()
    if (permissions.canManageGlobalSettings) {
      tasks.push(_loadLlmProviders(signal))
    } else {
      _llmProviders.value = new Map()
      _llmProvidersState.value = { loading: false, error: null, loadedAt: Date.now() }
    }

    _hydrationPromise = Promise.allSettled(tasks).then(() => undefined)
    return _hydrationPromise
  }

  function ensureLoaded(): Promise<void> {
    return hydrate()
  }

  function setTenantSettings(value: TenantSettings | null | undefined): void {
    _tenantSettings.value = value ?? null
    _tenantSettingsState.value = { loading: false, error: null, loadedAt: Date.now() }
  }

  function setLlmProvider(provider: LlmProvider, value: LlmSettings | null | undefined): void {
    const next = new Map(_llmProviders.value)
    next.set(provider, value ?? null)
    _llmProviders.value = next
    _llmProvidersState.value = { loading: false, error: null, loadedAt: Date.now() }
  }

  async function refreshLlmProviders(): Promise<void> {
    const permissions = usePermissionsStore()
    if (!permissions.canManageGlobalSettings) return
    const controller = new AbortController()
    await _loadLlmProviders(controller.signal)
  }

  function reset(): void {
    _abortController?.abort()
    _abortController = null
    _hydrationPromise = null
    _tenantSettings.value = null
    _tenantSettingsState.value = emptyLoadState()
    _llmProviders.value = new Map()
    _llmProvidersState.value = emptyLoadState()
  }

  return {
    tenantSettings,
    tenantSettingsLoading,
    tenantSettingsError,
    llmProvidersLoading,
    llmProvidersError,
    getLlmProvider,
    hydrate,
    ensureLoaded,
    setTenantSettings,
    setLlmProvider,
    refreshLlmProviders,
    reset,
  }
})
