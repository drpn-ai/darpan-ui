import { computed, ref } from 'vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import { cachedRead } from '../../lib/api/readCache'
import type { SourceConfigEndpoint } from '../../lib/api/types'
import type { SharedConfigType } from '../../lib/sharedConfig'

/**
 * Loads the endpoints a connector dashboard lists under its auth summary. The page starts the load
 * on mount, beside its own config read, so neither waits on the other.
 */
export function useSourceConfigEndpoints(options: {
  configTypeEnumId: SharedConfigType
  configId: () => string
  /** Read-cache key prefix; the config id is appended. */
  cacheKeyPrefix: string
  signal: AbortSignal
}) {
  const endpoints = ref<SourceConfigEndpoint[]>([])
  const loadState = ref<'loading' | 'ready' | 'error'>('loading')
  const error = ref<string | null>(null)
  const availableEndpoints = computed(() => endpoints.value.filter((endpoint) => endpoint.isEnabled))

  async function load(): Promise<void> {
    const configId = options.configId()
    if (!configId) return

    loadState.value = 'loading'
    error.value = null
    try {
      await cachedRead(
        `${options.cacheKeyPrefix}:${configId}`,
        () => settingsFacade.listSourceConfigEndpoints(
          { configTypeEnumId: options.configTypeEnumId, configId },
          options.signal,
        ),
        (response) => {
          endpoints.value = response.endpoints ?? []
          loadState.value = 'ready'
        },
      )
    } catch (loadError) {
      if ((loadError as { name?: string })?.name === 'AbortError') return
      error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load endpoints.'
      loadState.value = 'error'
    }
  }

  return { availableEndpoints, loadState, error, load }
}
