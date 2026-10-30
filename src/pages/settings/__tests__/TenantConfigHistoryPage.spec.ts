import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { ConfigRestorePlan, ConfigVersion } from '../../../lib/api/configTypes'

const snapshotTenantConfig = vi.hoisted(() => vi.fn())
const getTenantConfigVersions = vi.hoisted(() => vi.fn())
const previewTenantConfigRestore = vi.hoisted(() => vi.fn())
const restoreTenantConfigVersion = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  configFacade: { snapshotTenantConfig, getTenantConfigVersions, previewTenantConfigRestore, restoreTenantConfigVersion },
}))
vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ sessionInfo: { userId: 'U1', activeTenantUserGroupId: 'KREWE', activeTenantLabel: 'Krewe' } }),
}))
vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))

import TenantConfigHistoryPage from '../TenantConfigHistoryPage.vue'

const v = (seq: number, over: Partial<ConfigVersion> = {}): ConfigVersion => ({
  id: `V${seq}`, seq, parentId: seq > 1 ? `V${seq - 1}` : null, hash: String(seq).repeat(64).slice(0, 64), bundleVersion: 1,
  counts: { audits: 1, statements: 2, checks: 2 }, changeSource: 'SETTINGS_SAVE', reason: 'Saved in Darpan',
  createdBy: 'U1', createdByName: 'Aditi Patel', createdDate: '2026-10-30T04:47:00Z', ...over,
})

const plan = (over: Partial<ConfigRestorePlan> = {}): ConfigRestorePlan => ({
  lines: [{ kind: 'STATEMENT', ref: 'STATEMENT:S1', label: 'month-close R2', action: 'UPDATE',
    changes: [{ field: 'statementText', from: 'Edited.', to: 'Every invoice carries the Etail id.' }] }],
  blocking: [], warnings: [], switchOff: [{ statementId: 'S9', audit: 'month-close', statement: 'R9' }], unlink: [], kept: [],
  ...over,
})

async function mountPage() {
  const wrapper = mount(TenantConfigHistoryPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('TenantConfigHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    document.body.replaceChildren()
    getTenantConfigVersions.mockResolvedValue({ versions: [v(3), v(2, { changeSource: 'MANUAL', reason: 'before R2' }), v(1)] })
  })

  it('lists the versions newest first, the latest marked current', async () => {
    const wrapper = await mountPage()
    const tiles = wrapper.findAll('[data-testid="config-version"]')
    expect(tiles.map((t) => t.find('.static-page-list-tile__title').text())).toEqual(['Version 3', 'Version 2', 'Version 1'])
    expect(tiles[0]!.text()).toContain('Aditi Patel · Saved')
    expect(tiles[0]!.text()).toContain('Current')
    expect(tiles[1]!.text()).toContain('Kept by hand')
    expect(tiles[1]!.text()).toContain('before R2')
    expect(tiles[2]!.text()).toContain('Restore')
  })

  it('keeps a version now and says which', async () => {
    snapshotTenantConfig.mockResolvedValue({ created: true, version: v(4, { changeSource: 'MANUAL' }) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="config-keep-version"]').trigger('click')
    await flushPromises()
    expect(snapshotTenantConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="config-history-status"]').text()).toBe('Kept version 4.')
    expect(getTenantConfigVersions).toHaveBeenCalledTimes(2)
  })

  it('says so when nothing changed since the latest version', async () => {
    snapshotTenantConfig.mockResolvedValue({ created: false, version: v(3) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="config-keep-version"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="config-history-status"]').text()).toBe('Nothing changed since version 3.')
  })

  it('previews a restore, then applies exactly that plan', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), plan: plan(), planHash: 'h'.repeat(64) })
    restoreTenantConfigVersion.mockResolvedValue({ restored: true, before: v(4, { changeSource: 'RESTORE' }),
      after: v(5, { changeSource: 'RESTORE' }), plan: plan() })
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="config-version"]')[2]!.trigger('click')
    await flushPromises()

    expect(previewTenantConfigRestore).toHaveBeenCalledWith({ id: 'V1' })
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Restore version 1?')
    expect(dialog.textContent).toContain('Statement month-close R2: statementText "Edited." → "Every invoice carries the Etail id."')
    expect(dialog.textContent).toContain('Statement R9 in month-close')
    expect(dialog.textContent).toContain('Your config now is kept as a version first.')

    ;(document.body.querySelector('[data-testid="config-restore-apply"]') as HTMLElement).click()
    await flushPromises()
    expect(restoreTenantConfigVersion).toHaveBeenCalledWith({ id: 'V1', planHash: 'h'.repeat(64) })
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(wrapper.find('[data-testid="config-history-status"]').text())
      .toBe('Restored version 1. Your config before it is version 4.')
  })

  it('cannot restore while the plan has a blocking item', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), planHash: 'h'.repeat(64), plan: plan({
      blocking: [{ code: 'CONNECTION_NOT_FOUND', ref: 'NETSUITE_AUTH:N1', message: 'Connection NETSUITE_AUTH:N1 was deleted after this version.' }] }) })
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="config-version"]')[2]!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Connection NETSUITE_AUTH:N1 was deleted after this version.')
    expect((document.body.querySelector('[data-testid="config-restore-apply"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says when a restore would change nothing', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), planHash: 'h'.repeat(64),
      plan: plan({ lines: [{ kind: 'AUDIT', ref: 'AUDIT:A1', label: 'month-close', action: 'UNCHANGED' }], switchOff: [] }) })
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="config-version"]')[2]!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Your config already matches version 1.')
    expect((document.body.querySelector('[data-testid="config-restore-apply"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows why a restore was refused and stays open', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), plan: plan(), planHash: 'h'.repeat(64) })
    restoreTenantConfigVersion.mockRejectedValue(new ApiCallError('The config changed since the preview. Preview the restore again.'))
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="config-version"]')[2]!.trigger('click')
    await flushPromises()
    ;(document.body.querySelector('[data-testid="config-restore-apply"]') as HTMLElement).click()
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('The config changed since the preview. Preview the restore again.')
  })

  it('lets a viewer read the history but not keep or restore', async () => {
    permissions.canEditTenantSettings = false
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="config-keep-version"]').exists()).toBe(false)
    const tiles = wrapper.findAll('[data-testid="config-version"]')
    expect(tiles).toHaveLength(3)
    expect(tiles[2]!.element.tagName).not.toBe('BUTTON')
    expect(tiles[2]!.text()).not.toContain('Restore')
  })

  it('shows an empty history plainly', async () => {
    getTenantConfigVersions.mockResolvedValue({ versions: [] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No versions yet.')
  })
})
