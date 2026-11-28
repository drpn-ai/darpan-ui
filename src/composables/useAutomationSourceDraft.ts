import { computed, ref, type ComputedRef, type Ref, type WritableComputedRef } from 'vue'
import type {
  AutomationSftpServerOption,
  AutomationSystemRemoteOption,
  SavedRunSystemOption,
} from '../lib/api/types'
import {
  AUTOMATION_INPUT_MODE_API_RANGE,
  type ReconciliationAutomationFileSide,
  type ReconciliationAutomationSourceDraft,
} from '../lib/reconciliationAutomationDraft'
import { SOURCE_TYPE_API } from '../lib/reconciliationRuleSetDraft'
import { darpanSystemIdsMatch } from '../lib/utils/darpanSystems'

export interface ApiSourceSelectOption {
  value: string
  label: string
  sourceId: string
  systemMessageRemoteId?: string
  safeMetadataJson?: string
}

const AUTOMATION_FILE_SIDES: readonly ReconciliationAutomationFileSide[] = ['FILE_1', 'FILE_2']

export interface UseAutomationSourceDraftDeps {
  selectedSavedRunSystemOptions: ComputedRef<SavedRunSystemOption[] | undefined>
  defaultFile1SystemEnumId: ComputedRef<string | undefined>
  defaultFile2SystemEnumId: ComputedRef<string | undefined>
  systemRemotes: ComputedRef<AutomationSystemRemoteOption[]>
  sftpServers: ComputedRef<AutomationSftpServerOption[]>
  usesApi: ComputedRef<boolean>
  usesSftp: ComputedRef<boolean>
  setInputModeEnumId: (value: string) => void
}

export interface UseAutomationSourceDraft {
  sourceDrafts: Ref<Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft>>
  editFile1SftpServerId: WritableComputedRef<string>
  editFile2SftpServerId: WritableComputedRef<string>
  editFile1RemotePath: WritableComputedRef<string>
  editFile2RemotePath: WritableComputedRef<string>
  savedRunUsesOnlyApiSources: ComputedRef<boolean>
  systemLabelForSide: (side: ReconciliationAutomationFileSide) => string
  apiSourceOptionsForSide: (side: ReconciliationAutomationFileSide) => ApiSourceSelectOption[]
  selectedApiSourceValue: (side: ReconciliationAutomationFileSide) => string
  updateSource: (side: ReconciliationAutomationFileSide, patch: ReconciliationAutomationSourceDraft) => void
  updateApiSource: (side: ReconciliationAutomationFileSide, value: string) => void
  resetDrafts: () => void
  shouldSkipApiSourceStep: (side: ReconciliationAutomationFileSide) => boolean
  shouldSkipSftpServerStep: (side: ReconciliationAutomationFileSide) => boolean
  inferApiSourcesFromSavedRun: () => void
  inferSingleApiSourcesFromOptions: () => void
  inferSingleSftpServerFromOptions: () => void
}

function emptyDrafts(): Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft> {
  return { FILE_1: {}, FILE_2: {} }
}

export function useAutomationSourceDraft(deps: UseAutomationSourceDraftDeps): UseAutomationSourceDraft {
  const sourceDrafts = ref<Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft>>(emptyDrafts())

  function systemOptionForSide(side: ReconciliationAutomationFileSide): SavedRunSystemOption | null {
    const systemOptions = deps.selectedSavedRunSystemOptions.value
    if (!systemOptions) return null
    const sideOption = systemOptions.find((option) => option.fileSide === side)
    if (sideOption) return sideOption
    const fallbackEnumId = side === 'FILE_1' ? deps.defaultFile1SystemEnumId.value : deps.defaultFile2SystemEnumId.value
    return systemOptions.find((option) => option.enumId === fallbackEnumId) ?? null
  }

  function systemEnumIdForSide(side: ReconciliationAutomationFileSide): string {
    const sideOption = systemOptionForSide(side)
    if (sideOption?.enumId) return sideOption.enumId
    return side === 'FILE_1'
      ? deps.defaultFile1SystemEnumId.value ?? ''
      : deps.defaultFile2SystemEnumId.value ?? ''
  }

  function systemLabelForSide(side: ReconciliationAutomationFileSide): string {
    const sideOption = systemOptionForSide(side)
    return sideOption?.label || sideOption?.description || sideOption?.enumCode || sideOption?.enumId || systemEnumIdForSide(side) || 'source'
  }

  // DAR-UI-106: remote rows are one per (connection x endpoint) and siblings share a select value, so a side takes only
  // its own endpoint's rows; a sibling's row would store the sibling's extract.
  function systemRemoteMatchesSide(remoteSystemEnumId: string | undefined, side: ReconciliationAutomationFileSide): boolean {
    return darpanSystemIdsMatch(remoteSystemEnumId, systemEnumIdForSide(side))
  }

  function apiSourceOptionsForSide(side: ReconciliationAutomationFileSide): ApiSourceSelectOption[] {
    return deps.systemRemotes.value
      .filter((remote) => systemRemoteMatchesSide(remote.systemEnumId, side))
      .filter((remote) => Boolean(remote.safeMetadataJson))
      .map((remote) => ({
        value: remote.optionKey
          ? `remote:${remote.systemMessageRemoteId}:${remote.optionKey}`
          : `remote:${remote.systemMessageRemoteId}`,
        sourceId: remote.systemMessageRemoteId,
        systemMessageRemoteId: remote.systemMessageRemoteId,
        safeMetadataJson: remote.safeMetadataJson,
        label: remote.label || remote.description || remote.systemMessageRemoteId,
      }))
  }

  function apiSourceOptionForSavedRunSide(side: ReconciliationAutomationFileSide): ApiSourceSelectOption | null {
    const sideOption = systemOptionForSide(side)
    if (!sideOption) return null

    const apiOptions = apiSourceOptionsForSide(side)
    if (sideOption.systemMessageRemoteId) {
      const matchingRemoteOptions = apiOptions.filter((option) => option.systemMessageRemoteId === sideOption.systemMessageRemoteId)
      if (sideOption.sourceConfigId) {
        return (
          matchingRemoteOptions.find(
            (option) => option.value === `remote:${sideOption.systemMessageRemoteId}:${sideOption.sourceConfigId}`,
          ) ??
          matchingRemoteOptions[0] ??
          null
        )
      }
      return matchingRemoteOptions[0] ?? null
    }

    return null
  }

  function singleApiSourceOptionForSide(side: ReconciliationAutomationFileSide): ApiSourceSelectOption | null {
    const options = apiSourceOptionsForSide(side)
    return options.length === 1 ? options[0] ?? null : null
  }

  function selectedApiSourceValue(side: ReconciliationAutomationFileSide): string {
    const source = sourceDrafts.value[side]
    const option = apiSourceOptionsForSide(side).find(
      (candidate) =>
        Boolean(source.systemMessageRemoteId) &&
        candidate.systemMessageRemoteId === source.systemMessageRemoteId &&
        (!source.safeMetadataJson || candidate.safeMetadataJson === source.safeMetadataJson),
    )
    return option?.value ?? ''
  }

  function updateSource(side: ReconciliationAutomationFileSide, patch: ReconciliationAutomationSourceDraft): void {
    sourceDrafts.value = {
      ...sourceDrafts.value,
      [side]: {
        ...sourceDrafts.value[side],
        ...patch,
      },
    }
  }

  function updateApiSource(side: ReconciliationAutomationFileSide, value: string): void {
    const selectedOption = apiSourceOptionsForSide(side).find((option) => option.value === value)
    if (!selectedOption) return
    updateSource(side, {
      systemMessageRemoteId: selectedOption.systemMessageRemoteId,
      safeMetadataJson: selectedOption.safeMetadataJson,
    })
  }

  function resetDrafts(): void {
    sourceDrafts.value = emptyDrafts()
  }

  function hasKnownApiSourceForSide(side: ReconciliationAutomationFileSide): boolean {
    const sideOption = systemOptionForSide(side)
    const draft = sourceDrafts.value[side]
    return Boolean(draft.systemMessageRemoteId || sideOption?.systemMessageRemoteId)
  }

  function shouldSkipApiSourceStep(side: ReconciliationAutomationFileSide): boolean {
    if (!deps.usesApi.value) return false
    return hasKnownApiSourceForSide(side) || Boolean(singleApiSourceOptionForSide(side))
  }

  function shouldSkipSftpServerStep(side: ReconciliationAutomationFileSide): boolean {
    if (!deps.usesSftp.value) return false
    return Boolean(sourceDrafts.value[side].sftpServerId || deps.sftpServers.value.length === 1)
  }

  const savedRunUsesOnlyApiSources = computed<boolean>(() => {
    const systemOptions = deps.selectedSavedRunSystemOptions.value
    if (!systemOptions || systemOptions.length === 0) return false
    return AUTOMATION_FILE_SIDES.every(
      (side) => systemOptionForSide(side)?.sourceTypeEnumId?.trim() === SOURCE_TYPE_API,
    )
  })

  function inferApiSourcesFromSavedRun(): void {
    if (!savedRunUsesOnlyApiSources.value) return

    deps.setInputModeEnumId(AUTOMATION_INPUT_MODE_API_RANGE)
    const nextDrafts: Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft> = {
      FILE_1: { ...sourceDrafts.value.FILE_1 },
      FILE_2: { ...sourceDrafts.value.FILE_2 },
    }

    AUTOMATION_FILE_SIDES.forEach((side) => {
      const sideOption = systemOptionForSide(side)
      if (!sideOption) return

      const apiOption = apiSourceOptionForSavedRunSide(side)
      const inferredDraft: ReconciliationAutomationSourceDraft = {
        sourceTypeEnumId: SOURCE_TYPE_API,
        systemMessageRemoteId: apiOption?.systemMessageRemoteId ?? sideOption.systemMessageRemoteId,
        safeMetadataJson: apiOption?.safeMetadataJson,
        optionKey: sideOption.sourceConfigId,
        omsRestSourceConfigId: sideOption.enumId === 'OMS' ? sideOption.sourceConfigId : undefined,
      }
      nextDrafts[side] = {
        ...inferredDraft,
        ...nextDrafts[side],
        sourceTypeEnumId: SOURCE_TYPE_API,
      }
    })

    sourceDrafts.value = nextDrafts
  }

  function inferSingleApiSourcesFromOptions(): void {
    if (!deps.usesApi.value) return
    AUTOMATION_FILE_SIDES.forEach((side) => {
      if (hasKnownApiSourceForSide(side)) return
      const singleOption = singleApiSourceOptionForSide(side)
      if (!singleOption) return
      updateApiSource(side, singleOption.value)
    })
  }

  function inferSingleSftpServerFromOptions(): void {
    if (!deps.usesSftp.value || deps.sftpServers.value.length !== 1) return
    const onlyServer = deps.sftpServers.value[0]
    if (!onlyServer) return
    AUTOMATION_FILE_SIDES.forEach((side) => {
      if (sourceDrafts.value[side].sftpServerId) return
      updateSource(side, { sftpServerId: onlyServer.sftpServerId })
    })
  }

  const editFile1SftpServerId = computed<string>({
    get: () => sourceDrafts.value.FILE_1.sftpServerId ?? '',
    set: (value) => updateSource('FILE_1', { sftpServerId: value }),
  })

  const editFile2SftpServerId = computed<string>({
    get: () => sourceDrafts.value.FILE_2.sftpServerId ?? '',
    set: (value) => updateSource('FILE_2', { sftpServerId: value }),
  })

  const editFile1RemotePath = computed<string>({
    get: () => sourceDrafts.value.FILE_1.remotePathTemplate ?? '',
    set: (value) => updateSource('FILE_1', { remotePathTemplate: value }),
  })

  const editFile2RemotePath = computed<string>({
    get: () => sourceDrafts.value.FILE_2.remotePathTemplate ?? '',
    set: (value) => updateSource('FILE_2', { remotePathTemplate: value }),
  })

  return {
    sourceDrafts,
    editFile1SftpServerId,
    editFile2SftpServerId,
    editFile1RemotePath,
    editFile2RemotePath,
    savedRunUsesOnlyApiSources,
    systemLabelForSide,
    apiSourceOptionsForSide,
    selectedApiSourceValue,
    updateSource,
    updateApiSource,
    resetDrafts,
    shouldSkipApiSourceStep,
    shouldSkipSftpServerStep,
    inferApiSourcesFromSavedRun,
    inferSingleApiSourcesFromOptions,
    inferSingleSftpServerFromOptions,
  }
}
