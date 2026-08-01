import { ref } from 'vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { ConnectionCheck } from '../../lib/api/types'

/**
 * Drives the connection-diagnostics popup for one connector dashboard.
 *
 * Walks the probe one stage at a time so each check appears the moment the server actually finished
 * it, with its real timing — the server names the next stage, so this knows nothing about any
 * connector's sequence. Shopify reports three stages, OMS two.
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

  /** Guards against a stale walk continuing after a close or a restart. */
  let runToken = 0

  function close(): void {
    runToken += 1
    controller?.abort()
    controller = null
    open.value = false
    running.value = false
  }

  async function run(configId: string): Promise<void> {
    if (running.value) return

    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    const token = ++runToken

    open.value = true
    running.value = true
    error.value = null
    checks.value = []
    available.value = true
    connectionOk.value = false

    try {
      let stage: string | undefined
      let first = true

      // The server drives the sequence: each response says which stage to ask for next, and a
      // blank nextStage ends the walk — either the probe finished or a failure made the rest
      // meaningless, which is the server's call to make, not ours.
      do {
        const response = await settingsFacade.testSourceConnection(
          first ? { systemEnumId, configId, staged: true } : { systemEnumId, configId, stage },
          signal,
        )
        if (token !== runToken) return

        if (response.available === false) {
          available.value = false
          return
        }

        checks.value = [...checks.value, ...(response.checks ?? [])]
        stage = response.nextStage ?? undefined
        first = false
      } while (stage)

      connectionOk.value = checks.value.every((check) => check.status !== 'FAIL')
    } catch (failure) {
      if ((failure as { name?: string })?.name === 'AbortError') return
      if (token !== runToken) return
      error.value =
        failure instanceof ApiCallError ? failure.message : 'Failed to run diagnostics.'
    } finally {
      if (token === runToken) running.value = false
    }
  }

  function dispose(): void {
    runToken += 1
    controller?.abort()
    controller = null
  }

  return { open, running, available, connectionOk, checks, error, run, close, dispose }
}
