import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  fullPath: '/settings/sftp',
}))

const listSftpServers = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'john.doe',
    isSuperAdmin: false,
    canEditActiveTenantData: true,
    activeTenantUserGroupId: 'KREWE',
    availableTenants: [] as Array<{ userGroupId: string; label?: string }>,
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRoute: () => route,
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listSftpServers,
  },
}))

const permissionsShape = {
  get canEditTenantSettings() {
    return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
  },
  get canManageGlobalSettings() {
    return authState.sessionInfo.isSuperAdmin === true
  },
  get canViewTenantSettings() {
    return Boolean(authState.sessionInfo.userId)
  },
  get canRunActiveTenantReconciliation() {
    return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
  },
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ ...authState, sessionInfo: authState.sessionInfo }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsShape,
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => ({
    workflowOrigin: null,
    ruleSetDraftState: null,
    automationDraftState: null,
    setWorkflowOrigin: vi.fn(),
    setRuleSetDraft: vi.fn(),
    clearRuleSetDraft: vi.fn(),
    setAutomationDraft: vi.fn(),
    clearAutomationDraft: vi.fn(),
  }),
}))

import SftpServersPage from '../SftpServersPage.vue'

describe('SftpServersPage', () => {
  beforeEach(() => {
    route.fullPath = '/settings/sftp'
    listSftpServers.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
      availableTenants: [],
    }
  })

  it('renders saved SFTP records as dashboard tiles and links the primary action to the workflow', async () => {
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      servers: [
        {
          sftpServerId: 'sftp-primary',
          description: 'Primary SFTP',
          companyUserGroupId: 'KREWE',
          host: 'sftp.example.com',
          port: 22,
          username: 'etl-user',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServersPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.find('.row-between').exists()).toBe(false)
    expect(wrapper.find('.static-page-pager').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="sftp-server-tile"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="saved-sftp-servers"]').classes()).toContain('static-page-record-grid')
    expect(wrapper.get('[data-testid="saved-sftp-servers"]').classes()).toContain('static-page-record-grid--fixed')
    expect(wrapper.get('[data-testid="sftp-server-tile"]').classes()).toContain('static-page-record-tile')
    expect(wrapper.find('[data-testid="saved-sftp-servers"] [data-testid="sftp-create-action"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="sftp-create-action"]').classes()).toContain('static-page-action-tile')
    expect(wrapper.get('[data-testid="sftp-create-action"]').classes()).toContain('static-page-create-action')
    expect(wrapper.get('[data-testid="sftp-server-tile"]').classes()).toContain('static-page-tile')
    expect(wrapper.get('[data-testid="sftp-server-tile"]').text()).toBe('Primary SFTP')
    expect(wrapper.get('[data-testid="sftp-server-tile"]').text()).not.toContain('sftp.example.com')
    expect(wrapper.get('[data-testid="sftp-server-tile"]').text()).not.toContain('etl-user')
    expect(JSON.parse(wrapper.get('[data-testid="sftp-server-tile"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'settings-sftp-edit',
      params: { sftpServerId: 'sftp-primary' },
    })
    expect(JSON.parse(wrapper.get('[data-testid="sftp-create-action"]').attributes('data-to') ?? '{}')).toEqual({
      path: '/settings/sftp/create',
    })
  })

  it('filters out saved tiles from other tenants without rendering tenant labels', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: true,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
      availableTenants: [
        { userGroupId: 'KREWE', label: 'Krewe' },
        { userGroupId: 'GORJANA', label: 'Gorjana' },
      ],
    }
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      servers: [
        {
          sftpServerId: 'sftp-krewe',
          description: 'Primary SFTP',
          companyUserGroupId: 'KREWE',
          host: 'sftp.example.com',
          port: 22,
          username: 'etl-user',
          hasPassword: true,
          hasPrivateKey: false,
        },
        {
          sftpServerId: 'sftp-gorjana',
          description: 'Gorjana SFTP',
          companyUserGroupId: 'GORJANA',
          host: 'gorjana.example.com',
          port: 22,
          username: 'gorjana-user',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 2, pageCount: 1 },
    })

    const wrapper = mount(SftpServersPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="sftp-server-tile"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="sftp-server-tile"]').text()).toBe('Primary SFTP')
    expect(wrapper.text()).not.toContain('Gorjana SFTP')
    expect(wrapper.text()).not.toContain('Krewe')
  })

  it('shows an empty-state create action when no SFTP servers exist', async () => {
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      servers: [],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 0, pageCount: 1 },
    })

    const wrapper = mount(SftpServersPage)
    await flushPromises()

    expect(wrapper.text()).toContain('No SFTP servers')
    expect(wrapper.find('[data-testid="sftp-create-action"]').exists()).toBe(false)
    expect(JSON.parse(wrapper.get('[data-testid="sftp-empty-create-action"]').attributes('data-to') ?? '{}')).toEqual({
      path: '/settings/sftp/create',
    })
  })

  it('renders saved records without create affordances for a view-only active tenant', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
      availableTenants: [],
    }
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      servers: [
        {
          sftpServerId: 'sftp-primary',
          description: 'Primary SFTP',
          companyUserGroupId: 'KREWE',
          host: 'sftp.example.com',
          port: 22,
          username: 'etl-user',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServersPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="sftp-server-tile"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="sftp-create-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="sftp-empty-create-action"]').exists()).toBe(false)
  })

  it('omits descriptive helper copy from the dashboard chrome', async () => {
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      servers: [],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 0, pageCount: 1 },
    })

    const wrapper = mount(SftpServersPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Review saved transfer remotes and launch the dedicated workflow for new or updated server setup.')
    expect(wrapper.text()).not.toContain('Open an existing SFTP server to revise its connection details or start a new setup workflow.')
    expect(wrapper.text()).not.toContain('Saved records stay on the static dashboard until you need to reopen one for edit.')
  })

  it('keeps the SFTP saved-server grid on a fixed three-column tile layout with responsive step-downs', () => {
    const pageSource = readFileSync('src/pages/settings/SftpServersPage.vue', 'utf8')
    const recordListSource = readFileSync('src/pages/settings/SettingsRecordListSection.vue', 'utf8')
    const sharedStyleSource = readFileSync('src/style.css', 'utf8')

    expect(pageSource).toContain('<StaticPageFrame>')
    expect(pageSource).not.toContain('static-page-frame--records')
    expect(pageSource).toContain('<SettingsRecordListSection')
    expect(recordListSource).toContain('<AppListPager')
    expect(pageSource).toContain('pager-aria-label="SFTP server pages"')
    expect(pageSource).toContain('@update:page-index="goToPage"')
    expect(recordListSource).toContain('static-page-record-grid static-page-record-grid--fixed')
    expect(pageSource).toContain('title="Saved Servers"')
    expect(pageSource).not.toContain('settings-record-section')
    expect(recordListSource).toContain('class="static-page-tile static-page-record-tile"')
    expect(recordListSource).toContain('class="static-page-action-tile static-page-create-action"')
    expect(pageSource).not.toContain('<style scoped>')
    expect(sharedStyleSource).toContain('--static-board-min-height: 0;')
    expect(sharedStyleSource).toContain('.static-page-record-tile {')
    expect(sharedStyleSource).toContain('width: 100%;')
    expect(sharedStyleSource).toContain('min-height: var(--static-tile-min-height);')
    expect(sharedStyleSource).toContain('.static-page-create-action {')
    expect(sharedStyleSource).toContain('height: var(--static-tile-min-height);')
    expect(sharedStyleSource).toContain('.static-page-record-grid--fixed {')
    expect(sharedStyleSource).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
    expect(sharedStyleSource).toContain('width: calc((100% - (var(--static-tile-gap) * 2)) / 3);')
    expect(sharedStyleSource).toContain('@media (max-width: 1020px)')
    expect(sharedStyleSource).toContain('@media (max-width: 768px)')
  })
})
