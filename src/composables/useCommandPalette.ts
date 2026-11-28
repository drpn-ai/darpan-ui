import { ref, type Ref } from 'vue'
import { settingsFacade } from '../lib/api/facade'
import type { GeneratedOutput } from '../lib/api/types'
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
}

export function useCommandPalette(options: UseCommandPaletteOptions): UseCommandPalette {
  const isCommandPaletteOpen = ref(false)
  const isLoadingCommandData = ref(false)
  const recentCommandIds = ref<string[]>([])
  const dataCommandActions = ref<CommandAction[]>([])

  let activeController: AbortController | null = null

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
      // A failed read leaves the palette its pages and recent results, without SFTP rows.
      const servers = await settingsFacade.listSftpServers({ pageIndex: 0, pageSize: 200 }, controller.signal)
        .then((response) => response?.servers ?? [], () => [])

      if (controller.signal.aborted) return

      dataCommandActions.value = buildDataCommandActions({
        sftpServers: filterRecordsForActiveTenant(servers, options.getActiveTenantUserGroupId()),
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
  }
}
