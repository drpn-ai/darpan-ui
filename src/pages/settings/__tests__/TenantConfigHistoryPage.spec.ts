import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { ConfigRestorePlan, ConfigVersion } from '../../../lib/api/configTypes'
import { setDefaultDisplayTimeZone } from '../../../lib/utils/date'

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

// Now is 02:00 on 18 Nov in Los Angeles (10:00 UTC), the display zone: 07:30 UTC is still the 17th there.
const NOW = '2026-11-18T10:00:00Z'

const v = (seq: number, over: Partial<ConfigVersion> = {}): ConfigVersion => ({
  id: `V${seq}`, seq, parentId: seq > 1 ? `V${seq - 1}` : null, hash: String(seq).repeat(64).slice(0, 64), bundleVersion: 1,
  counts: { audits: 1, statements: 2, checks: 2 }, changeSource: 'SETTINGS_SAVE', reason: 'Saved in Darpan',
  createdBy: 'U1', createdByName: 'Aditi Patel', createdDate: '2026-11-18T09:30:00Z', ...over,
})

// Newest first: 4 is current; 3 today, 2 yesterday (in LA), 1 on 12 Nov.
const HISTORY = (): ConfigVersion[] => [
  v(4, { counts: { audits: 1, statements: 2, checks: 4 }, createdDate: '2026-11-18T09:45:00Z' }),
  v(3, { counts: { audits: 1, statements: 2, checks: 4 } }),
  v(2, { counts: { audits: 1, statements: 3, checks: 2 }, changeSource: 'MANUAL', reason: 'before R2', createdDate: '2026-11-18T07:30:00Z' }),
  v(1, { counts: { audits: 1, statements: 3, checks: 2 }, createdByName: null, createdDate: '2026-11-12T20:00:00Z' }),
]

const plan = (over: Partial<ConfigRestorePlan> = {}): ConfigRestorePlan => ({
  lines: [{ kind: 'STATEMENT', ref: 'STATEMENT:S1', label: 'month-close R2', action: 'UPDATE',
    changes: [{ field: 'statementText', from: 'Edited.', to: 'Every invoice carries the Etail id.' }] }],
  blocking: [], warnings: [], switchOff: [{ statementId: 'S9', audit: 'month-close', statement: 'R9' }], unlink: [], kept: [],
  ...over,
})

async function mountPage() {
  const wrapper = mount(TenantConfigHistoryPage, {
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub }, directives: { explain: {} } },
  })
  await flushPromises()
  return wrapper
}

const rows = (wrapper: Awaited<ReturnType<typeof mountPage>>) => wrapper.findAll('[data-testid="config-version"]')
const rowNames = (wrapper: Awaited<ReturnType<typeof mountPage>>) => rows(wrapper).map((r) => r.find('.config-history-row__name').text())

describe('TenantConfigHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    setDefaultDisplayTimeZone('America/Los_Angeles')
    permissions.canEditTenantSettings = true
    document.body.replaceChildren()
    getTenantConfigVersions.mockResolvedValue({ versions: HISTORY() })
  })

  afterEach(() => {
    vi.useRealTimers()
    setDefaultDisplayTimeZone(undefined)
  })

  it('states the newest version as a read-only strip, never as a row', async () => {
    const wrapper = await mountPage()
    const strip = wrapper.find('[data-testid="config-current"]')
    const facts = strip.findAll('.config-history-fact').map((f) => {
      const lines = f.findAll('dd > span').map((line) => line.text())
      return [f.find('dt').text(), lines.length ? lines.join(' / ') : f.find('dd').text()]
    })
    expect(facts).toEqual([
      ['Current', 'Version 4'],
      ['Kept', 'Nov 18, 2026, 1:45 AM / Saved'],
      ['By', 'Aditi Patel'],
      ['Holds', '1 audit · 2 statements · 4 checks'],
    ])
    expect(strip.find('button').exists()).toBe(false)
    expect(rowNames(wrapper)).toEqual(['Version 3', 'Version 2', 'Version 1'])
  })

  it('has no intro sentence, no Now section and no Current or Restore status words', async () => {
    const wrapper = await mountPage()
    expect(wrapper.text()).not.toContain('A version is kept a minute')
    expect(wrapper.text()).not.toContain('Latest is version')
    expect(wrapper.findAll('h2').map((h) => h.text())).not.toContain('Now')
    for (const row of rows(wrapper)) {
      expect(row.text()).not.toContain('Restore')
      expect(row.text()).not.toContain('Current')
    }
  })

  it('groups earlier versions under Today, Yesterday and a date in the tenant zone', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-testid="config-day"]').map((h) => h.text())).toEqual(['Today', 'Yesterday', '12 Nov'])
    const [today, yesterday, older] = rows(wrapper)
    expect(today!.text()).toContain('1:30 AM')
    expect(today!.text()).toContain('Aditi Patel · Saved')
    expect(yesterday!.text()).toContain('11:30 PM')
    expect(yesterday!.text()).toContain('Aditi Patel · Kept by hand')
    expect(older!.text()).toContain('Darpan · Saved')
  })

  it('says what changed against the version before, and the reason when it is not the automatic one', async () => {
    const wrapper = await mountPage()
    const deltas = rows(wrapper).map((r) => r.find('[data-testid="config-version-delta"]').text())
    expect(deltas).toEqual(['\u22121 statement · +2 checks', 'Settings changed, counts the same', 'First version'])
    expect(rows(wrapper)[1]!.text()).toContain('before R2')
    expect(rows(wrapper)[0]!.text()).not.toContain('Saved in Darpan')
  })

  it('pages the earlier versions ten at a time, re-forming the days per page', async () => {
    const many = Array.from({ length: 23 }, (_, i) => v(23 - i, {
      counts: { audits: 1, statements: 2, checks: 23 - i },
      createdDate: new Date(Date.parse(NOW) - i * 6 * 3600_000).toISOString(),
    }))
    getTenantConfigVersions.mockResolvedValue({ versions: many })
    const wrapper = await mountPage()
    expect(rowNames(wrapper)).toEqual(Array.from({ length: 10 }, (_, i) => `Version ${22 - i}`))
    // The last row on a page still compares with the version before it, which sits on the next page.
    expect(rows(wrapper)[9]!.find('[data-testid="config-version-delta"]').text()).toBe('+1 check')
    expect(wrapper.text()).toContain('Page 1 of 3')

    await wrapper.find('[data-testid="config-page-next"]').trigger('click')
    expect(rowNames(wrapper)[0]).toBe('Version 12')
    expect(wrapper.findAll('[data-testid="config-day"]')[0]!.text()).toBe('15 Nov')
    await wrapper.find('[data-testid="config-page-next"]').trigger('click')
    expect(rowNames(wrapper)).toEqual(['Version 2', 'Version 1'])
    expect(wrapper.text()).toContain('Page 3 of 3')
  })

  it('goes back to Tenant Settings from the footer', async () => {
    const wrapper = await mountPage()
    const back = wrapper.findComponent(RouterLinkStub)
    expect(back.props('to')).toEqual({ name: 'settings-tenant' })
    expect(back.attributes('aria-label')).toBe('Back to Tenant Settings')
  })

  it('says Keeping… while a version is being kept', async () => {
    let resolve!: (value: unknown) => void
    snapshotTenantConfig.mockReturnValue(new Promise((r) => { resolve = r }))
    const wrapper = await mountPage()
    const keep = wrapper.find('[data-testid="config-keep-version"]')
    expect(keep.text()).toBe('Keep a version now')
    await keep.trigger('click')
    expect(keep.text()).toBe('Keeping…')
    expect((keep.element as HTMLButtonElement).disabled).toBe(true)
    resolve({ created: true, version: v(5, { changeSource: 'MANUAL' }) })
    await flushPromises()
    expect(keep.text()).toBe('Keep a version now')
  })

  it('keeps a version now and says which', async () => {
    snapshotTenantConfig.mockResolvedValue({ created: true, version: v(5, { changeSource: 'MANUAL' }) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="config-keep-version"]').trigger('click')
    await flushPromises()
    expect(snapshotTenantConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="config-history-status"]').text()).toBe('Kept version 5.')
    expect(getTenantConfigVersions).toHaveBeenCalledTimes(2)
  })

  it('says so when nothing changed since the latest version', async () => {
    snapshotTenantConfig.mockResolvedValue({ created: false, version: v(4) })
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="config-keep-version"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="config-history-status"]').text()).toBe('Nothing changed since version 4.')
  })

  it('previews a restore, then applies exactly that plan', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), plan: plan(), planHash: 'h'.repeat(64) })
    restoreTenantConfigVersion.mockResolvedValue({ restored: true, before: v(5, { changeSource: 'RESTORE' }),
      after: v(6, { changeSource: 'RESTORE' }), plan: plan() })
    const wrapper = await mountPage()
    await rows(wrapper)[2]!.trigger('click')
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
      .toBe('Restored version 1. Your config before it is version 5.')
  })

  it('cannot restore while the plan has a blocking item', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), planHash: 'h'.repeat(64), plan: plan({
      blocking: [{ code: 'CONNECTION_NOT_FOUND', ref: 'NETSUITE_AUTH:N1', message: 'Connection NETSUITE_AUTH:N1 was deleted after this version.' }] }) })
    const wrapper = await mountPage()
    await rows(wrapper)[2]!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Connection NETSUITE_AUTH:N1 was deleted after this version.')
    expect((document.body.querySelector('[data-testid="config-restore-apply"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says when a restore would change nothing', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), planHash: 'h'.repeat(64),
      plan: plan({ lines: [{ kind: 'AUDIT', ref: 'AUDIT:A1', label: 'month-close', action: 'UNCHANGED' }], switchOff: [] }) })
    const wrapper = await mountPage()
    await rows(wrapper)[2]!.trigger('click')
    await flushPromises()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.textContent).toContain('Your config already matches version 1.')
    expect((document.body.querySelector('[data-testid="config-restore-apply"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows why a restore was refused and stays open', async () => {
    previewTenantConfigRestore.mockResolvedValue({ version: v(1), plan: plan(), planHash: 'h'.repeat(64) })
    restoreTenantConfigVersion.mockRejectedValue(new ApiCallError('The config changed since the preview. Preview the restore again.'))
    const wrapper = await mountPage()
    await rows(wrapper)[2]!.trigger('click')
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
    expect(rows(wrapper)).toHaveLength(3)
    for (const row of rows(wrapper)) expect(row.element.tagName).toBe('DIV')
    await rows(wrapper)[2]!.trigger('click')
    expect(previewTenantConfigRestore).not.toHaveBeenCalled()
  })

  it('shows an empty history plainly', async () => {
    getTenantConfigVersions.mockResolvedValue({ versions: [] })
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('No versions yet.')
    expect(wrapper.find('[data-testid="config-current"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="config-keep-version"]').exists()).toBe(true)
  })
})
