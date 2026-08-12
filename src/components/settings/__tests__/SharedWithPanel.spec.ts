import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// DAR-BE-005 Task 12 — the "Shared with" panel. See task-12-brief.md Step 1 for the five
// required assertions; the mutation-testing pass in the task report proves #2 and #4 are load
// bearing (they gate what the user can do to another tenant's credential access).

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

async function chooseAppSelectOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

function mountPanel() {
  return mount(SharedWithPanel, {
    props: {
      configType: 'SCFG_HOTWAX_OMS' as const,
      configId: 'krewe_oms',
    },
  })
}

describe('SharedWithPanel', () => {
  beforeEach(() => {
    listConfigTenantAccess.mockReset()
    grantConfigTenantAccess.mockReset()
    revokeConfigTenantAccess.mockReset()
    permissionsState.canManageConfigSharing = true
  })

  it('renders the owning tenant and each peer returned by listConfigTenantAccess', async () => {
    listConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], sharing: baseSharing })

    const wrapper = mountPanel()
    await flushPromises()

    expect(listConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms' },
      expect.anything(),
    )
    expect(wrapper.get('[data-testid="shared-with-owner"]').text()).toContain('Krewe')
    const peerRows = wrapper.findAll('[data-testid="shared-with-peer"]')
    expect(peerRows).toHaveLength(1)
    expect(peerRows[0]?.text()).toContain('Acme')
  })

  it('renders read-only with no add or remove control when canManageConfigSharing is false, even when sharing.canManage is true', async () => {
    permissionsState.canManageConfigSharing = false
    listConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], sharing: baseSharing })

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-with-tenant-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shared-with-add"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shared-with-remove"]').exists()).toBe(false)
  })

  it('grants access to the chosen tenant and emits changed when canManageConfigSharing and sharing.canManage are both true', async () => {
    permissionsState.canManageConfigSharing = true
    listConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], sharing: baseSharing })
    grantConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], granted: true })

    const wrapper = mountPanel()
    await flushPromises()

    await chooseAppSelectOption(wrapper, 'shared-with-tenant-select', 'GLOBEX')
    await wrapper.get('[data-testid="shared-with-add"]').trigger('click')
    await flushPromises()

    expect(grantConfigTenantAccess).toHaveBeenCalledTimes(1)
    expect(grantConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms', targetTenantUserGroupId: 'GLOBEX' },
      expect.anything(),
    )
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('surfaces a backend errors array through InlineValidation and emits no changed event', async () => {
    permissionsState.canManageConfigSharing = true
    listConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], sharing: baseSharing })
    grantConfigTenantAccess.mockResolvedValue({
      ok: false,
      messages: [],
      errors: ['Both tenants must have a DARPAN_TENANT_ADMIN to share this configuration.'],
      granted: false,
    })

    const wrapper = mountPanel()
    await flushPromises()

    await chooseAppSelectOption(wrapper, 'shared-with-tenant-select', 'GLOBEX')
    await wrapper.get('[data-testid="shared-with-add"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="shared-with-error"]').text()).toContain('DARPAN_TENANT_ADMIN')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('offers only tenants from authStore.availableTenants that are not already the owner or a peer', async () => {
    permissionsState.canManageConfigSharing = true
    listConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], sharing: baseSharing })

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="shared-with-tenant-select"]').trigger('click')
    const optionValues = wrapper
      .findAll('[data-testid="app-select-option"]')
      .map((el) => el.attributes('data-option-value'))

    expect(optionValues).toEqual(['GLOBEX'])
  })

  it('asks for inline confirmation before removing a peer, and revokes + emits changed only after confirming', async () => {
    permissionsState.canManageConfigSharing = true
    listConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], sharing: baseSharing })
    revokeConfigTenantAccess.mockResolvedValue({ ok: true, messages: [], errors: [], revoked: true })

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.get('[data-testid="shared-with-remove"]').trigger('click')
    expect(revokeConfigTenantAccess).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="shared-with-confirm-remove"]')).toBeTruthy()

    await wrapper.get('[data-testid="shared-with-confirm-remove"]').trigger('click')
    await flushPromises()

    expect(revokeConfigTenantAccess).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe_oms', targetTenantUserGroupId: 'ACME' },
      expect.anything(),
    )
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('shows the empty-state copy when there are no peers', async () => {
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: { ...baseSharing, memberTenantUserGroupIds: [], memberTenantLabels: [], memberCount: 1 },
    })

    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Not shared with other tenants.')
  })
})
