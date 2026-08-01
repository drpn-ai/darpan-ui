import { ref } from 'vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { ConnectionCheck } from '../../lib/api/types'

/**
 * Drives the connection-diagnostics popup for one connector dashboard.
 *
 * The backend keeps `ok` meaning "the diagnostic ran" and reports the verdict separately as
 * `connectionOk`, because the SPA client throws on `ok: false`. So a rejected credential arrives
 * here as a resolved promise carrying FAIL rows — only a transport/permission failure rejects.
 */
export function useConnectionDiagnostics(systemEnumId: string) {
  const open = ref(false)
  const running = ref(false)
  const available = ref(true)
  const connectionOk = ref(false)
  const checks = ref<ConnectionCheck[]>([])
  const error = ref<string | null>(null)

  let controller: AbortController | null = null

  function close(): void {
    controller?.abort()
    controller = null
    open.value = false
    running.value = false
  }

  async function run(configId: string): Promise<void> {
    if (running.value) return

    controller?.abort()
    controller = new AbortController()

    open.value = true
    running.value = true
    error.value = null
    checks.value = []
    available.value = true
    connectionOk.value = false

    try {
      const response = await settingsFacade.testSourceConnection(
        { systemEnumId, configId },
        controller.signal,
      )
      available.value = response.available !== false
      connectionOk.value = response.connectionOk === true
      checks.value = response.checks ?? []
    } catch (failure) {
      if ((failure as { name?: string })?.name === 'AbortError') return
      error.value =
        failure instanceof ApiCallError ? failure.message : 'Failed to run diagnostics.'
    } finally {
      running.value = false
    }
  }

  function dispose(): void {
    controller?.abort()
    controller = null
  }

  return { open, running, available, connectionOk, checks, error, run, close, dispose }
}
