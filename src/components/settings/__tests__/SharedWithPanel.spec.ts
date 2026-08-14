import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// DAR-BE-005 — the "Shared with" field group. Grant fires on select and revoke fires on the remove
// control; both commit immediately and silently, so the load-bearing assertions here are the ones
// that gate what a user can do to another tenant's credential access (the non-admin case) and the
// ones that prove a failed mutation is never swallowed.

const listConfigTenantAccess = vi.hoisted(() => vi.fn())
const grantConfigTenantAccess = vi.hoisted(() => vi.fn())
const revokeConfigTenantAccess = vi.hoisted(() => vi.fn())

const authState = vi.hoisted(() => ({
  sessionInfo: {
    activeTenantUserGroupId: 'KREWE',
    availableTenants: [
      { userGroupId: 'KREWE', label: 'Krewe' },
      { userGroupId: 'ACME', label: 'Acme' },
      { userGroupId: 'GLOBEX', label: 'Globex' },
    ],
  },
}))

const permissionsState = vi.hoisted(() => ({ canManageConfigSharing: true }))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listConfigTenantAccess,
    grantConfigTenantAccess,
    revokeConfigTenantAccess,
  },
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsState,
}))

import SharedWithPanel from '../SharedWithPanel.vue'

const baseSharing = {
  configTypeEnumId: 'SCFG_HOTWAX_OMS',
  configId: 'krewe_oms',
  ownerTenantUserGroupId: 'KREWE',
  ownerTenantLabel: 'Krewe',
  memberTenantUserGroupIds: ['ACME'],
  memberTenantLabels: [{ tenantUserGroupId: 'ACME', label: 'Acme' }],
  memberCount: 2,
  canManage: true,
}

const unshared = {
  ...baseSharing,
  memberTenantUserGroupIds: [],
  memberTenantLabels: [],
  memberCount: 1,
}

function ok(sharing: unknown) {
  return { ok: true, messages: [], errors: [], sharing }
}

async function mountPanel() {
  const wrapper = mount(SharedWithPanel, {
    props: { configType: 'SCFG_HOTWAX_OMS' as const, configId: 'krewe_oms' },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

/** Click the add chip (which opens the select) then pick an option. */
async function addTenant(wrapper: Awaited<ReturnType<typeof mountPanel>>, value: string) {
  await wrapper.get('[data-testid="shared-with-add-chip"]').trigger('click')
  await flushPromises()
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
  await flushPromises()
}

describe('SharedWithPanel', () => {
  beforeEach(() => {
    listConfigTenantAccess.mockReset()
    grantConfigTenantAccess.mockReset()
    revokeConfigTenantAccess.mockReset()
    permissionsState.canManageConfigSharing = true
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the owning tenant and each peer as chips', async () => {
    listConfigTenantAccess.mockResolvedValue(ok(baseSharing))

    const wrapper = await mountPanel()

    expect(listConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms' },
      expect.anything(),
    )
    expect(wrapper.get('[data-testid="shared-with-owner"]').text()).toContain('Krewe')
    const peers = wrapper.findAll('[data-testid="shared-with-peer"]')
    expect(peers).toHaveLength(1)
    expect(peers[0]?.text()).toContain('Acme')
  })

  it('renders read-only chips with no remove or add control when canManageConfigSharing is false, even when sharing.canManage is true', async () => {
    permissionsState.canManageConfigSharing = false
    listConfigTenantAccess.mockResolvedValue(ok(baseSharing))

    const wrapper = await mountPanel()

    expect(wrapper.findAll('[data-testid="shared-with-peer"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="shared-with-remove"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shared-with-add-chip"]').exists()).toBe(false)
  })

  it('grants on select, with no separate Share button', async () => {
    listConfigTenantAccess.mockResolvedValue(ok(baseSharing))
    grantConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], granted: true })

    const wrapper = await mountPanel()
    expect(wrapper.find('[data-testid="shared-with-add"]').exists()).toBe(false)

    await addTenant(wrapper, 'GLOBEX')

    expect(grantConfigTenantAccess).toHaveBeenCalledTimes(1)
    expect(grantConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms', targetTenantUserGroupId: 'GLOBEX' },
      expect.anything(),
    )
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('offers only tenants that are not already the owner or a peer', async () => {
    listConfigTenantAccess.mockResolvedValue(ok(baseSharing))

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-add-chip"]').trigger('click')
    await flushPromises()

    const values = wrapper
      .findAll('[data-testid="app-select-option"]')
      .map((el) => el.attributes('data-option-value'))

    expect(values).toEqual(['GLOBEX'])
  })

  it('omits the add control when no tenants remain available', async () => {
    listConfigTenantAccess.mockResolvedValue(ok({
      ...baseSharing,
      memberTenantUserGroupIds: ['ACME', 'GLOBEX'],
      memberTenantLabels: [
        { tenantUserGroupId: 'ACME', label: 'Acme' },
        { tenantUserGroupId: 'GLOBEX', label: 'Globex' },
      ],
      memberCount: 3,
    }))

    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="shared-with-add-chip"]').exists()).toBe(false)
  })

  it('surfaces a backend errors array through InlineValidation and emits no changed event', async () => {
    listConfigTenantAccess.mockResolvedValue(ok(baseSharing))
    grantConfigTenantAccess.mockResolvedValue({
      ok: false,
      messages: [],
      errors: ['Both tenants must have a DARPAN_TENANT_ADMIN to share this configuration.'],
      granted: false,
    })

    const wrapper = await mountPanel()
    await addTenant(wrapper, 'GLOBEX')

    expect(wrapper.get('[data-testid="shared-with-error"]').text()).toContain('DARPAN_TENANT_ADMIN')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('revokes immediately on the remove control, with no confirm step', async () => {
    listConfigTenantAccess.mockResolvedValueOnce(ok(baseSharing)).mockResolvedValue(ok(unshared))
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-with-confirm-remove"]').exists()).toBe(false)
    expect(revokeConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms', targetTenantUserGroupId: 'ACME' },
      expect.anything(),
    )
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('leaves an undo slot in place after a successful revoke', async () => {
    listConfigTenantAccess.mockResolvedValueOnce(ok(baseSharing)).mockResolvedValue(ok(unshared))
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()

    const slot = wrapper.get('[data-testid="shared-with-undo-slot"]')
    expect(slot.text()).toContain('Acme')
    expect(wrapper.findAll('[data-testid="shared-with-peer"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="shared-with-live"]').text()).toContain('Acme removed')
  })

  it('re-grants when undo is clicked', async () => {
    listConfigTenantAccess.mockResolvedValueOnce(ok(baseSharing)).mockResolvedValue(ok(unshared))
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })
    grantConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], granted: true })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="shared-with-undo"]').trigger('click')
    await flushPromises()

    expect(grantConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms', targetTenantUserGroupId: 'ACME' },
      expect.anything(),
    )
    expect(wrapper.find('[data-testid="shared-with-undo-slot"]').exists()).toBe(false)
  })

  it('clears the undo slot after the 8 second window', async () => {
    vi.useFakeTimers()
    listConfigTenantAccess.mockResolvedValueOnce(ok(baseSharing)).mockResolvedValue(ok(unshared))
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="shared-with-undo-slot"]').exists()).toBe(true)

    vi.advanceTimersByTime(8000)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-with-undo-slot"]').exists()).toBe(false)
  })

  it('pauses the undo countdown while the undo control has focus', async () => {
    vi.useFakeTimers()
    listConfigTenantAccess.mockResolvedValueOnce(ok(baseSharing)).mockResolvedValue(ok(unshared))
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="shared-with-undo"]').trigger('focus')
    vi.advanceTimersByTime(20000)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-with-undo-slot"]').exists()).toBe(true)
  })

  it('keeps the chip and surfaces the error when revoke fails', async () => {
    listConfigTenantAccess.mockResolvedValue(ok(baseSharing))
    revokeConfigTenantAccess.mockResolvedValue({
      ok: false,
      messages: [],
      errors: ['You must be a tenant admin of both tenants.'],
      revoked: false,
    })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-with-undo-slot"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="shared-with-peer"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="shared-with-error"]').text()).toContain('tenant admin')
  })

  it('keeps the undo slot and surfaces the error when the re-grant fails', async () => {
    listConfigTenantAccess.mockResolvedValueOnce(ok(baseSharing)).mockResolvedValue(ok(unshared))
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })
    grantConfigTenantAccess.mockResolvedValue({
      ok: false,
      messages: [],
      errors: ['Configuration is already shared with that tenant.'],
      granted: false,
    })

    const wrapper = await mountPanel()
    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="shared-with-undo"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-with-undo-slot"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="shared-with-error"]').text()).toContain('already shared')
  })
})
