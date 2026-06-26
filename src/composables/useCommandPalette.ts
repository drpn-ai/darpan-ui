import { ref, type Ref } from 'vue'
import { settingsFacade } from '../lib/api/facade'
import type { GeneratedOutput, SftpServerRecord } from '../lib/api/types'
import { buildDataCommandActions } from '../lib/commandDataSearch'
import { listRecentCommandIds, recordRecentCommand } from '../lib/commandSearch'
import type { CommandAction } from '../lib/types/ux'
import { filterRecordsForActiveTenant } from '../lib/utils/tenantRecords'
import { useRunResultsStore } from '../stores/runResults'

export interface UseCommandPaletteOptions {
  getActiveTenantUserGroupId: () => string | null
}

export interface UseCommandPalette {
  isCommandPaletteOpen: Ref<boolean>
  isLoadingCommandData: Ref<boolean>
  recentCommandIds: Ref<string[]>
  dataCommandActions: Ref<CommandAction[]>
  open: () => void
  close: () => void
  loadCommandData: () => Promise<void>
  clearCommandData: () => void
  recordExecution: (actionId: string) => void
  loadRecentFromStorage: () => void
  dispose: () => void
}

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === 'fulfilled'
}

export function useCommandPalette(options: UseCommandPaletteOptions): UseCommandPalette {
  const isCommandPaletteOpen = ref(false)
  const isLoadingCommandData = ref(false)
  const recentCommandIds = ref<string[]>([])
  const dataCommandActions = ref<CommandAction[]>([])

  let activeController: AbortController | null = null

  function readSftpServers(result: PromiseSettledResult<{ servers?: SftpServerRecord[] } | undefined>): SftpServerRecord[] {
    if (!isFulfilled(result)) return []
    return filterRecordsForActiveTenant(
      result.value?.servers ?? [],
      options.getActiveTenantUserGroupId(),
    )
  }

  function readCachedGeneratedOutputs(): GeneratedOutput[] {
    try {
      return useRunResultsStore().recentOutputs
    } catch {
      return []
    }
  }

  async function loadCommandData(): Promise<void> {
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    isLoadingCommandData.value = true

    try {
      // Generated outputs are read from the run-results cache (recent <= 2
      // days, prefetched at login + kept in sync via upsertOutput). The
      // palette only renders the top 6 anyway, which the cache fully
      // covers for typical tenants. SFTP servers still come from the
      // facade since they're not part of the prefetch graph.
      const [sftpResult] = await Promise.allSettled([
        settingsFacade.listSftpServers({ pageIndex: 0, pageSize: 200 }, controller.signal),
      ])

      if (controller.signal.aborted) return

      dataCommandActions.value = buildDataCommandActions({
        sftpServers: readSftpServers(sftpResult),
        generatedOutputs: readCachedGeneratedOutputs(),
      })
    } finally {
      if (!controller.signal.aborted) {
        isLoadingCommandData.value = false
      }
      if (activeController === controller) {
        activeController = null
      }
    }
  }

  function open(): void {
    isCommandPaletteOpen.value = true
    void loadCommandData()
  }

  function close(): void {
    isCommandPaletteOpen.value = false
  }

  function clearCommandData(): void {
    dataCommandActions.value = []
  }

  function recordExecution(actionId: string): void {
    recentCommandIds.value = recordRecentCommand(actionId)
  }

  function loadRecentFromStorage(): void {
    recentCommandIds.value = listRecentCommandIds()
  }

  function dispose(): void {
    activeController?.abort()
    activeController = null
  }

  return {
    isCommandPaletteOpen,
    isLoadingCommandData,
    recentCommandIds,
    dataCommandActions,
    open,
    close,
    loadCommandData,
    clearCommandData,
    recordExecution,
    loadRecentFromStorage,
    dispose,
  }
}
