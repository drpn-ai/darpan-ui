// DAR-BE-209, DAR-OPS-029 U09. The User Settings page's CLI section: the signed-in CLI sessions with Revoke, and the
// CLI state in the active tenant (with the request when it is not on). A failed or refused list says so and never
// reads as "No CLI signed in"; the access card is simply not shown when it cannot be read.
import { ref } from 'vue'
import { ApiCallError } from '../lib/api/client'
import { authFacade } from '../lib/api/facade'
import type { CliSession, MyCliAccess } from '../lib/api/types'

const LOAD_ERROR = 'Could not load CLI sessions.'
const REVOKE_ERROR = 'Could not revoke that CLI session.'

export function useCliSessions(signal: AbortSignal) {
  const cliSessions = ref<CliSession[]>([])
  const cliSessionsError = ref<string | null>(null)
  const cliSessionsLoadFailed = ref(false)
  const revokingCliSessionId = ref<string | null>(null)
  const myCliAccess = ref<MyCliAccess | null>(null)

  async function loadMyCliAccess(): Promise<void> {
    try {
      const response = await authFacade.getMyCliAccess(signal)
      if (signal.aborted) return
      myCliAccess.value = response.access ?? null
    } catch {
      if (!signal.aborted) myCliAccess.value = null
    }
  }

  async function loadCliSessions(): Promise<void> {
    try {
      const response = await authFacade.listCliSessions(signal)
      if (signal.aborted) return
      if (!response.ok) {
        cliSessionsLoadFailed.value = true
        cliSessionsError.value = response.errors?.[0] ?? LOAD_ERROR
        return
      }
      cliSessions.value = response.cliSessions ?? []
    } catch {
      if (signal.aborted) return
      cliSessionsLoadFailed.value = true
      cliSessionsError.value = LOAD_ERROR
    }
  }

  async function revokeCliSession(cliSessionId: string): Promise<void> {
    if (revokingCliSessionId.value) return
    revokingCliSessionId.value = cliSessionId
    cliSessionsError.value = null
    try {
      const response = await authFacade.revokeCliSession({ cliSessionId }, signal)
      if (signal.aborted) return
      if (!response.ok || (response.errors?.length ?? 0) > 0) {
        cliSessionsError.value = response.errors?.[0] ?? REVOKE_ERROR
        return
      }
      cliSessions.value = cliSessions.value.filter((session) => session.cliSessionId !== cliSessionId)
    } catch (error) {
      if (signal.aborted) return
      cliSessionsError.value = error instanceof ApiCallError ? error.message : REVOKE_ERROR
    } finally {
      revokingCliSessionId.value = null
    }
  }

  return {
    cliSessions, cliSessionsError, cliSessionsLoadFailed, revokingCliSessionId, myCliAccess,
    loadCliSessions, loadMyCliAccess, revokeCliSession,
  }
}
