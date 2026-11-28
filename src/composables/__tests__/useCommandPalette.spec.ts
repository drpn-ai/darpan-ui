import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api/facade', () => ({
  settingsFacade: {
    listSftpServers: vi.fn(),
  },
}))

vi.mock('../../lib/commandDataSearch', () => ({
  buildDataCommandActions: vi.fn(() => [
    { id: 'data-x', label: 'X', group: 'Data', to: '/x', description: '', aliases: [] },
  ]),
}))

vi.mock('../../lib/commandSearch', () => ({
  listRecentCommandIds: vi.fn(() => ['a', 'b']),
  recordRecentCommand: vi.fn((id: string) => [id]),
}))

import { useCommandPalette } from '../useCommandPalette'
import { settingsFacade } from '../../lib/api/facade'
import { buildDataCommandActions } from '../../lib/commandDataSearch'

const listSftp = vi.mocked(settingsFacade.listSftpServers)
const buildDataActions = vi.mocked(buildDataCommandActions)

describe('useCommandPalette', () => {
  beforeEach(() => {
    listSftp.mockReset()
    buildDataActions.mockReset()
    buildDataActions.mockReturnValue([
      { id: 'data-x', label: 'X', group: 'Data', to: '/x', description: '', aliases: [] },
    ])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('open() sets isCommandPaletteOpen and kicks off a load', async () => {
    listSftp.mockResolvedValue({ servers: [] } as never)

    const palette = useCommandPalette({ getActiveTenantUserGroupId: () => null })
    palette.open()
    expect(palette.isCommandPaletteOpen.value).toBe(true)
    expect(palette.isLoadingCommandData.value).toBe(true)
    await vi.waitFor(() => expect(palette.isLoadingCommandData.value).toBe(false))
    expect(palette.dataCommandActions.value).toHaveLength(1)
  })

  it('ignores stale requests when a newer call has been issued', async () => {
    const palette = useCommandPalette({ getActiveTenantUserGroupId: () => null })

    let resolveOld: () => void = () => {}
    listSftp.mockImplementationOnce(
      () =>
        new Promise<never>((resolve) => {
          resolveOld = () => resolve({ servers: [] } as never)
        }),
    )
    const oldPromise = palette.loadCommandData()

    listSftp.mockResolvedValueOnce({ servers: [] } as never)
    buildDataActions.mockReturnValueOnce([
      { id: 'data-new', label: 'New', group: 'Data', to: '/new', description: '', aliases: [] },
    ])
    await palette.loadCommandData()

    expect(palette.dataCommandActions.value[0]?.id).toBe('data-new')
    resolveOld()
    await oldPromise
    expect(palette.dataCommandActions.value[0]?.id).toBe('data-new')
  })

  it('a failed SFTP read still lists the data rows it has, with no SFTP servers', async () => {
    listSftp.mockRejectedValueOnce(new Error('offline'))
    const palette = useCommandPalette({ getActiveTenantUserGroupId: () => null })

    await palette.loadCommandData()

    expect(buildDataActions).toHaveBeenCalledWith(expect.objectContaining({ sftpServers: [] }))
    expect(palette.dataCommandActions.value).toHaveLength(1)
    expect(palette.isLoadingCommandData.value).toBe(false)
  })

  it('recordExecution updates recentCommandIds via the helper', () => {
    const palette = useCommandPalette({ getActiveTenantUserGroupId: () => null })
    palette.recordExecution('navigate-hub')
    expect(palette.recentCommandIds.value).toEqual(['navigate-hub'])
  })

  it('loadRecentFromStorage seeds the ref from storage', () => {
    const palette = useCommandPalette({ getActiveTenantUserGroupId: () => null })
    palette.loadRecentFromStorage()
    expect(palette.recentCommandIds.value).toEqual(['a', 'b'])
  })

  it('close() clears the open state', () => {
    const palette = useCommandPalette({ getActiveTenantUserGroupId: () => null })
    palette.open()
    palette.close()
    expect(palette.isCommandPaletteOpen.value).toBe(false)
  })
})
