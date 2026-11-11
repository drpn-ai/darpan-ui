import { computed, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useAutomationSourceDraft } from '../useAutomationSourceDraft'
import type {
  AutomationNsRestletOption,
  AutomationSftpServerOption,
  AutomationSystemRemoteOption,
  SavedRunSystemOption,
} from '../../lib/api/types'

interface Harness {
  systemOptions: ReturnType<typeof ref<SavedRunSystemOption[]>>
  nsConfigs: ReturnType<typeof ref<AutomationNsRestletOption[]>>
  remotes: ReturnType<typeof ref<AutomationSystemRemoteOption[]>>
  sftpServers: ReturnType<typeof ref<AutomationSftpServerOption[]>>
  usesApi: ReturnType<typeof ref<boolean>>
  usesSftp: ReturnType<typeof ref<boolean>>
  inputModeEnumId: ReturnType<typeof ref<string>>
  source: ReturnType<typeof useAutomationSourceDraft>
}

function createHarness(initial: Partial<Harness> = {}): Harness {
  const systemOptions = ref<SavedRunSystemOption[]>([])
  const nsConfigs = ref<AutomationNsRestletOption[]>([])
  const remotes = ref<AutomationSystemRemoteOption[]>([])
  const sftpServers = ref<AutomationSftpServerOption[]>([])
  const usesApi = ref(false)
  const usesSftp = ref(false)
  const inputModeEnumId = ref('')

  Object.assign({ systemOptions, nsConfigs, remotes, sftpServers, usesApi, usesSftp, inputModeEnumId }, initial)

  const source = useAutomationSourceDraft({
    selectedSavedRunSystemOptions: computed(() => systemOptions.value ?? undefined),
    defaultFile1SystemEnumId: computed(() => undefined),
    defaultFile2SystemEnumId: computed(() => undefined),
    nsRestletConfigs: computed(() => nsConfigs.value ?? []),
    systemRemotes: computed(() => remotes.value ?? []),
    sftpServers: computed(() => sftpServers.value ?? []),
    usesApi: computed(() => usesApi.value === true),
    usesSftp: computed(() => usesSftp.value === true),
    setInputModeEnumId: (value: string) => {
      inputModeEnumId.value = value
    },
  })

  return { systemOptions, nsConfigs, remotes, sftpServers, usesApi, usesSftp, inputModeEnumId, source }
}

describe('useAutomationSourceDraft', () => {
  it('starts with empty drafts for both file sides', () => {
    const { source } = createHarness()
    expect(source.sourceDrafts.value.FILE_1).toEqual({})
    expect(source.sourceDrafts.value.FILE_2).toEqual({})
  })

  it('writeable computed two-way bindings update drafts immutably', () => {
    const { source } = createHarness()
    source.editFile1SftpServerId.value = 'server-1'
    source.editFile2RemotePath.value = '/tmp/remote.csv'
    expect(source.sourceDrafts.value.FILE_1.sftpServerId).toBe('server-1')
    expect(source.sourceDrafts.value.FILE_2.remotePathTemplate).toBe('/tmp/remote.csv')
  })

  it('treats a saved run with only API systems as API-only', () => {
    const { systemOptions, source } = createHarness()
    systemOptions.value = [
      { enumId: 'NS', fileSide: 'FILE_1', sourceTypeEnumId: 'AUT_SRC_API' },
      { enumId: 'OMS', fileSide: 'FILE_2', sourceTypeEnumId: 'AUT_SRC_API' },
    ]
    expect(source.savedRunUsesOnlyApiSources.value).toBe(true)
  })

  it('returns false for savedRunUsesOnlyApiSources when any side uses SFTP', () => {
    const { systemOptions, source } = createHarness()
    systemOptions.value = [
      { enumId: 'NS', fileSide: 'FILE_1', sourceTypeEnumId: 'AUT_SRC_API' },
      { enumId: 'OMS', fileSide: 'FILE_2', sourceTypeEnumId: 'AUT_SRC_SFTP' },
    ]
    expect(source.savedRunUsesOnlyApiSources.value).toBe(false)
  })

  it('skips the SFTP server step when there is exactly one server', () => {
    const { sftpServers, usesSftp, source } = createHarness()
    usesSftp.value = true
    sftpServers.value = [{ sftpServerId: 's1', label: 'Only' } as AutomationSftpServerOption]
    expect(source.shouldSkipSftpServerStep('FILE_1')).toBe(true)
  })

  it('skips the API source step when only one API option matches the side', () => {
    const { usesApi, systemOptions, nsConfigs, source } = createHarness()
    usesApi.value = true
    systemOptions.value = [{ enumId: 'NS', fileSide: 'FILE_1' }]
    nsConfigs.value = [
      { nsRestletConfigId: 'cfg-1', systemEnumId: 'NS', label: 'Only NS' } as AutomationNsRestletOption,
    ]
    expect(source.shouldSkipApiSourceStep('FILE_1')).toBe(true)
  })

  // DAR-UI-106: a side on an endpoint no client table names (a returns endpoint) finds the connections kept under its
  // system, by the parent the server sends; an exact endpoint match and another system's connections behave as before.
  it('offers a side the connections of its endpoint\'s system, by the server\'s parent', () => {
    const { usesApi, systemOptions, remotes, source } = createHarness()
    usesApi.value = true
    systemOptions.value = [{ enumId: 'OMS_RETURNS_GQL', systemParentEnumId: 'OMS', fileSide: 'FILE_1' }]
    remotes.value = [
      { systemMessageRemoteId: 'R-OMS', systemEnumId: 'OMS', label: 'HotWax prod', safeMetadataJson: '{}' },
      { systemMessageRemoteId: 'R-EP', systemEnumId: 'OMS_RETURNS_GQL', label: 'HotWax returns', safeMetadataJson: '{}' },
      { systemMessageRemoteId: 'R-SHOP', systemEnumId: 'SHOPIFY', label: 'Shopify', safeMetadataJson: '{}' },
    ] as AutomationSystemRemoteOption[]
    expect(source.apiSourceOptionsForSide('FILE_1').map((o) => o.label)).toEqual(['HotWax prod', 'HotWax returns'])
  })

  // Review focus 4: a side the server has sent no parent for (options not loaded) offers only exact matches.
  it('offers only the side\'s own endpoint connections when the server names no parent', () => {
    const { usesApi, systemOptions, remotes, source } = createHarness()
    usesApi.value = true
    systemOptions.value = [{ enumId: 'OMS_RETURNS_GQL', fileSide: 'FILE_1' }]
    remotes.value = [
      { systemMessageRemoteId: 'R-OMS', systemEnumId: 'OMS', label: 'HotWax prod', safeMetadataJson: '{}' },
      { systemMessageRemoteId: 'R-EP', systemEnumId: 'OMS_RETURNS_GQL', label: 'HotWax returns', safeMetadataJson: '{}' },
    ] as AutomationSystemRemoteOption[]
    expect(source.apiSourceOptionsForSide('FILE_1').map((o) => o.label)).toEqual(['HotWax returns'])
  })

  it('keeps legacy system ids matching their system', () => {
    const { usesApi, systemOptions, nsConfigs, source } = createHarness()
    usesApi.value = true
    systemOptions.value = [{ enumId: 'NETSUITE', fileSide: 'FILE_1' }]
    nsConfigs.value = [{ nsRestletConfigId: 'cfg-1', systemEnumId: 'DARSYSNETSUITE', label: 'Legacy NS' } as AutomationNsRestletOption]
    expect(source.apiSourceOptionsForSide('FILE_1').map((o) => o.label)).toEqual(['Legacy NS'])
  })
})
