import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  name: 'settings-sftp-create',
  fullPath: '/settings/sftp/create',
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listSftpServers = vi.hoisted(() => vi.fn())
const saveSftpServer = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'john.doe',
    activeTenantUserGroupId: 'KREWE',
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listSftpServers,
    saveSftpServer,
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
    return ((authState.sessionInfo as Record<string, unknown>)?.canEditActiveTenantData === true ||
      (authState.sessionInfo as Record<string, unknown>)?.isSuperAdmin === true ||
      (authState.sessionInfo as Record<string, unknown>)?.canRunActiveTenantReconciliation === true)
  },
}

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
  }),
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

import SftpServerWorkflowPage from '../SftpServerWorkflowPage.vue'

describe('SftpServerWorkflowPage', () => {
  beforeEach(() => {
    route.params = {}
    route.name = 'settings-sftp-create'
    route.fullPath = '/settings/sftp/create'
    push.mockReset()
    listSftpServers.mockReset()
    saveSftpServer.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      activeTenantUserGroupId: 'KREWE',
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }
  })

  it('saves a new SFTP server and returns to the standalone dashboard', async () => {
    saveSftpServer.mockResolvedValue({
      ok: true,
      messages: ['Saved SFTP server.'],
      errors: [],
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="host"]').setValue('sftp.example.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="port"]').setValue('22')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="username"]').setValue('etl-user')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Primary SFTP')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="sftpServerId"]').setValue('sftp-primary')
    await wrapper.get('[data-testid="save-sftp-server"]').trigger('click')
    await flushPromises()

    expect(saveSftpServer).toHaveBeenCalledWith({
      sftpServerId: 'sftp-primary',
      description: 'Primary SFTP',
      host: 'sftp.example.com',
      port: 22,
      username: 'etl-user',
      password: '',
      privateKey: '',
      remoteAttributes: 'Y',
    })
    expect(push).toHaveBeenCalledWith('/settings/sftp')
  })

  it('asks SFTP create questions one at a time and keeps the server name / ID for the final step', async () => {
    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('What host should this SFTP server use?')
    expect(wrapper.find('input[name="host"]').exists()).toBe(true)
    expect(wrapper.find('input[name="username"]').exists()).toBe(false)
    expect(wrapper.find('input[name="sftpServerId"]').exists()).toBe(false)

    await wrapper.get('input[name="host"]').setValue('sftp.example.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).toContain('What port should this SFTP server use?')
    expect(wrapper.find('input[name="port"]').exists()).toBe(true)
    expect(wrapper.find('input[name="host"]').exists()).toBe(false)

    await wrapper.get('input[name="port"]').setValue('22')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="username"]').setValue('etl-user')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).toContain('What label should Darpan show for this server?')
    expect(wrapper.find('input[name="description"]').exists()).toBe(true)

    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.text()).toContain('What should the server name / ID be?')
    expect(wrapper.find('input[name="sftpServerId"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-sftp-server"]').exists()).toBe(true)
  })

  it('loads an existing SFTP server into the workflow for edit', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    expect(listSftpServers).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect((wrapper.get('input[name="sftpServerId"]').element as HTMLInputElement).value).toBe('sftp-primary')
    expect((wrapper.get('input[name="description"]').element as HTMLInputElement).value).toBe('Primary SFTP')
    expect((wrapper.get('input[name="host"]').element as HTMLInputElement).value).toBe('sftp.example.com')
    expect((wrapper.get('input[name="username"]').element as HTMLInputElement).value).toBe('etl-user')
    expect(wrapper.get('[data-testid="sftp-remote-attributes"]').text()).toContain('No')
    expect(wrapper.get('[data-testid="sftp-remote-attributes"]').element.closest('.wizard-answer-control')).toBeNull()
  })

  it('shows an X cancel action on edit and returns to the SFTP dashboard without saving', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    const cancelButton = wrapper.get('[data-testid="cancel-sftp-server"]')

    expect(cancelButton.attributes('aria-label')).toBe('Cancel')
    expect(cancelButton.classes()).toContain('app-icon-action')
    expect(cancelButton.classes()).toContain('app-icon-action--large')

    await cancelButton.trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/sftp')
    expect(saveSftpServer).not.toHaveBeenCalled()
  })

  it('omits edit-state helper copy above the workflow question', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Editing saved server:')
  })

  it('shows the Enter helper on the stepped SFTP create workflow', async () => {
    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).toContain('press Enter')
  })

  it('keeps the Enter helper hidden on SFTP edit workflows', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    expect(wrapper.text()).not.toContain('press Enter')
  })

  it('uses the shared icon-only save action for the workflow primary submit', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    const saveButton = wrapper.get('[data-testid="save-sftp-server"]')
    expect(saveButton.attributes('aria-label')).toBe('Save')
    expect(saveButton.classes()).toContain('app-icon-action')
    expect(saveButton.classes()).toContain('app-icon-action--primary')
    expect(saveButton.classes()).toContain('app-icon-action--large')
  })

  it('gives the host field its own row and groups the smaller fields together', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="sftp-host-row"]').text()).toContain('Host')
    expect(wrapper.get('[data-testid="sftp-host-row"]').text()).not.toContain('Port')
    expect(wrapper.get('[data-testid="sftp-compact-row"]').text()).toContain('Username')
    expect(wrapper.get('[data-testid="sftp-compact-row"]').text()).toContain('Port')
    expect(wrapper.get('[data-testid="sftp-compact-row"]').text()).toContain('Remote Attributes')
  })

  it('keeps the private key field collapsed to a single visible row by default', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    const privateKeyField = wrapper.get('textarea[name="privateKey"]')
    const source = readFileSync('src/style.css', 'utf8')
    const pageSource = readFileSync('src/pages/settings/SftpServerWorkflowPage.vue', 'utf8')

    expect(privateKeyField.attributes('rows')).toBe('1')
    expect(privateKeyField.classes()).toContain('workflow-form-textarea')
    expect(privateKeyField.classes()).toContain('workflow-form-textarea--single-row')
    expect(pageSource).toContain('workflow-form-textarea--single-row')
    expect(source).toContain('.workflow-form-textarea--single-row {')
    expect(source).toContain('min-height: 2.2rem;')
  })

  it('uses the same compact value typography for SFTP inputs and the Remote Attributes select', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const workflowSource = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const pageSource = readFileSync('src/pages/settings/SftpServerWorkflowPage.vue', 'utf8')

    expect(pageSource).toContain("'workflow-form--compact'")
    expect(source).toContain('.workflow-form--compact {')
    expect(source).toContain('--workflow-form-answer-size: clamp(1.18rem, 1.4vw, 1.45rem);')
    expect(workflowSource).toContain('font-size: var(--workflow-form-answer-size);')
    expect(workflowSource).toContain('font-size: var(--workflow-form-select-size);')
  })

  it('shrinks single-page edit workflows with a smaller edit-only typography contract', async () => {
    route.params = { sftpServerId: 'sftp-primary' }
    route.name = 'settings-sftp-edit'
    route.fullPath = '/settings/sftp/edit/sftp-primary'
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
          remoteAttributes: 'N',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(SftpServerWorkflowPage)
    await flushPromises()

    const workflowForm = wrapper.get('form')
    const source = readFileSync('src/style.css', 'utf8')
    const workflowSource = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')

    expect(workflowForm.classes()).toContain('workflow-form--compact')
    expect(workflowForm.classes()).toContain('workflow-form--edit-single-page')
    expect(source).toContain('.workflow-form--edit-single-page {')
    expect(source).toContain('--workflow-form-question-size: 1.85rem;')
    expect(source).toContain('--workflow-form-question-mobile-size: 1.5rem;')
    expect(source).toContain('--workflow-form-answer-size: clamp(0.89rem, 1.05vw, 1.09rem);')
    expect(source).toContain('--workflow-form-context-label-size: 0.76rem;')
    expect(workflowSource).toContain('--workflow-form-question-size: var(--workflow-question-size);')
    expect(workflowSource).toContain('--workflow-form-question-mobile-size: clamp(1.35rem, 6vw, 1.75rem);')
    expect(workflowSource).toContain('--workflow-form-question-size: 1.85rem;')
    expect(workflowSource).toContain('--workflow-form-question-mobile-size: 1.5rem;')
    expect(workflowSource).toContain('--workflow-form-context-label-size: 0.78rem;')
    expect(workflowSource).toContain('--workflow-form-context-label-size: 0.76rem;')
    expect(workflowSource).toContain('font-size: var(--workflow-form-question-size);')
    expect(workflowSource).toContain('font-size: var(--workflow-form-context-label-size);')
    expect(workflowSource).toContain('font-size: var(--workflow-form-question-mobile-size);')
  })

  it('keeps the compact-row select underline aligned with the neighboring input underline', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const workflowSource = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')

    expect(source).toContain('.workflow-form--compact {')
    expect(source).toContain('--workflow-form-select-padding-top: 0.15rem;')
    expect(source).toContain('--workflow-form-select-padding-bottom: 0.55rem;')
    expect(source).toContain('--workflow-form-select-line-height: 1.2;')
    expect(workflowSource).toContain('padding-top: var(--workflow-form-select-padding-top);')
    expect(workflowSource).toContain('padding-bottom: var(--workflow-form-select-padding-bottom);')
    expect(workflowSource).toContain('line-height: var(--workflow-form-select-line-height);')
  })
})
