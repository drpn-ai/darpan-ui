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

  // DAR-UI-106: the server sends one remote row per (connection x endpoint), each carrying its endpoint as systemEnumId,
  // and sibling endpoints of one connection share remoteId and optionKey (so the same select value). A side takes the
  // rows of its own endpoint only; a sibling's row would store the sibling's extract.
  const ORDERS_META = '{"extractServiceName":"orders"}'
  const RETURNS_META = '{"extractServiceName":"returns"}'
  const omsRemote = (systemEnumId: string, label: string, safeMetadataJson: string) =>
    ({ systemMessageRemoteId: 'HOTWAX_ORDERS_API', optionKey: 'KREWE', sourceConfigId: 'KREWE', systemEnumId, label, safeMetadataJson }) as AutomationSystemRemoteOption

  function siblingEndpointsHarness(systemOptions: SavedRunSystemOption[] | undefined) {
    const harness = createHarness()
    harness.usesApi.value = true
    harness.systemOptions.value = systemOptions
    harness.remotes.value = [
      omsRemote('OMS', 'HotWax', '{"extractServiceName":"rest"}'),
      omsRemote('OMS_GQL', 'Orders and payments', ORDERS_META),
      omsRemote('OMS_RETURNS_GQL', 'Returns', RETURNS_META),
    ]
    return harness
  }
  const omsSides: SavedRunSystemOption[] = [
    { enumId: 'OMS_GQL', systemParentEnumId: 'OMS', fileSide: 'FILE_1', sourceTypeEnumId: 'AUT_SRC_API', systemMessageRemoteId: 'HOTWAX_ORDERS_API', sourceConfigId: 'KREWE' },
    { enumId: 'OMS_RETURNS_GQL', systemParentEnumId: 'OMS', fileSide: 'FILE_2', sourceTypeEnumId: 'AUT_SRC_API', systemMessageRemoteId: 'HOTWAX_ORDERS_API', sourceConfigId: 'KREWE' },
  ]

  it('offers a side only its own endpoint\'s rows, not a sibling\'s or the system\'s', () => {
    const { source } = siblingEndpointsHarness(omsSides)
    expect(source.apiSourceOptionsForSide('FILE_1').map((o) => o.label)).toEqual(['Orders and payments'])
    expect(source.apiSourceOptionsForSide('FILE_2').map((o) => o.label)).toEqual(['Returns'])
  })

  it('keeps the returns extract on the returns side of an orders-vs-returns run', () => {
    const { source } = siblingEndpointsHarness(omsSides)
    source.inferApiSourcesFromSavedRun()
    expect(source.sourceDrafts.value.FILE_1.safeMetadataJson).toBe(ORDERS_META)
    expect(source.sourceDrafts.value.FILE_2.safeMetadataJson).toBe(RETURNS_META)

    source.updateApiSource('FILE_2', source.selectedApiSourceValue('FILE_2'))
    expect(source.sourceDrafts.value.FILE_2.safeMetadataJson).toBe(RETURNS_META)
  })

  // Review focus 4: options not loaded yet, matching is exact and nothing throws.
  it('matches exactly while the run\'s system options have not loaded', () => {
    const { source } = siblingEndpointsHarness(undefined)
    expect(source.apiSourceOptionsForSide('FILE_1')).toEqual([])
  })

  // NetSuite configs are kept under the system itself (NETSUITE), and each has its own value, so a side on a
  // NetSuite endpoint (SuiteQL) finds them by the server's parent.
  it('offers a NetSuite endpoint side the configs kept under NetSuite', () => {
    const { usesApi, systemOptions, nsConfigs, source } = createHarness()
    usesApi.value = true
    systemOptions.value = [{ enumId: 'NETSUITE_SUITEQL', systemParentEnumId: 'NETSUITE', fileSide: 'FILE_1' }]
    nsConfigs.value = [
      { nsRestletConfigId: 'cfg-ns', systemEnumId: 'NETSUITE', label: 'NetSuite prod' },
      { nsRestletConfigId: 'cfg-other', systemEnumId: 'SHOPIFY', label: 'Not NetSuite' },
    ] as AutomationNsRestletOption[]
    expect(source.apiSourceOptionsForSide('FILE_1').map((o) => o.label)).toEqual(['NetSuite prod'])
  })

  it('keeps legacy system ids matching their system', () => {
    const { usesApi, systemOptions, nsConfigs, source } = createHarness()
    usesApi.value = true
    systemOptions.value = [{ enumId: 'NETSUITE', fileSide: 'FILE_1' }]
    nsConfigs.value = [{ nsRestletConfigId: 'cfg-1', systemEnumId: 'DARSYSNETSUITE', label: 'Legacy NS' } as AutomationNsRestletOption]
    expect(source.apiSourceOptionsForSide('FILE_1').map((o) => o.label)).toEqual(['Legacy NS'])
  })
})
