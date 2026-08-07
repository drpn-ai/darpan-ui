import { existsSync, readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { installLocalStorageStub } from '../test/localStorage'
import { DISMISS_INLINE_MENUS_EVENT, WORKFLOW_CANCEL_REQUEST_EVENT, WORKFLOW_HINT_REQUEST_EVENT } from '../lib/uiEvents'

const ensureAuthenticated = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const logoutSession = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const saveActiveTenant = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const listSftpServers = vi.hoisted(() => vi.fn())
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const resolve = vi.hoisted(() =>
  vi.fn((target: unknown) => {
    const path = typeof target === 'string'
      ? target
      : target && typeof target === 'object' && 'path' in target && typeof target.path === 'string'
        ? target.path
        : ''
    const workflowPrefixes = [
      '/reconciliation/create',
      '/reconciliation/diff',
      '/reconciliation/ruleset-manager/rules',
      '/settings/runs/edit/',
      '/settings/sftp/create',
      '/settings/sftp/edit/',
      '/settings/netsuite/auth/create',
      '/settings/netsuite/auth/edit/',
      '/settings/netsuite/endpoints/create',
      '/settings/netsuite/endpoints/edit/',
      '/settings/shopify/create',
      '/settings/shopify/edit/',
      '/settings/hotwax/create',
      '/settings/hotwax/edit/',
      '/schemas/create',
    ]

    return {
      meta: {
        surfaceMode: workflowPrefixes.some((prefix) => path.startsWith(prefix)) ? 'workflow' : 'static',
      },
    }
  }),
)
const toggleTheme = vi.hoisted(() => vi.fn())
type AuthSessionInfo = {
  userId: string
  username?: string
  activeTenantUserGroupId?: string
  activeTenantLabel?: string
  availableTenants?: Array<{ userGroupId: string; label?: string }>
  canRunActiveTenantReconciliation?: boolean
  canEditActiveTenantData?: boolean
  canManageDarpanCore?: boolean
  isSuperAdmin?: boolean
}
const authState = vi.hoisted(() => ({
  checked: true,
  error: null as string | null,
  status: 'authenticated' as 'authenticated' | 'unauthenticated' | 'verification-failed',
  sessionInfo: {
    userId: '100000',
    username: 'test.customer',
    canRunActiveTenantReconciliation: true,
    canEditActiveTenantData: true,
    canManageDarpanCore: true,
    isSuperAdmin: true,
  } as AuthSessionInfo | null,
  get authenticated() {
    return this.status === 'authenticated'
  },
  get userId() {
    return this.sessionInfo?.userId ?? null
  },
  get username() {
    return this.sessionInfo?.username ?? this.sessionInfo?.userId ?? null
  },
}))
const authRequiredHandlerRef = vi.hoisted(() => ({ current: null as ((detail: unknown) => void) | null }))
const setAuthRequiredHandler = vi.hoisted(() =>
  vi.fn((handler: ((detail: unknown) => void) | null) => {
    authRequiredHandlerRef.current = handler
  }),
)
const route = vi.hoisted(() => ({
  name: 'hub',
  path: '/',
  fullPath: '/',
  query: {} as Record<string, unknown>,
  meta: {} as Record<string, unknown>,
}))
const mountedWrappers: Array<{ unmount: () => void }> = []

vi.mock('vue-router', () => ({
  RouterLink: {
    template: '<a><slot /></a>',
  },
  RouterView: {
    template: '<div />',
  },
  useRoute: () => route,
  useRouter: () => ({
    push,
    replace,
    resolve,
  }),
}))

vi.mock('../components/shell/CommandPalette.vue', () => ({
  default: {
    emits: ['execute'],
    props: {
      open: Boolean,
      actions: {
        type: Array,
        default: () => [],
      },
      recentCommandIds: {
        type: Array,
        default: () => [],
      },
      dataSearchLoading: Boolean,
    },
    template: `
      <div data-testid="command-palette-stub">
        <span v-if="dataSearchLoading">Searching records...</span>
        <button
          v-for="action in actions"
          :key="action.id"
          type="button"
          :data-testid="'command-action-' + action.id"
          @click="$emit('execute', action)"
        >
          {{ action.label }}
        </button>
      </div>
    `,
  },
}))

const buildAuthRedirectMock = vi.hoisted(() => vi.fn((redirect: unknown) =>
  redirect === '/' || redirect === '/login' || redirect === '/login?redirect=/login'
    ? { name: 'login' }
    : {
        name: 'login',
        query: { redirect },
      },
))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null,
  automationDraftState: null,
  setWorkflowOrigin: vi.fn(function (this: { workflowOrigin: { label: string, path: string } | null }, label: string, path: string) {
    this.workflowOrigin = { label, path }
  }),
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
  setAutomationDraft: vi.fn(),
  clearAutomationDraft: vi.fn(),
}))

vi.mock('../stores/auth', () => ({
  buildAuthRedirect: buildAuthRedirectMock,
  useAuthStore: () => ({
    ...authState,
    ensureAuthenticated,
    logoutSession,
    saveActiveTenant,
  }),
}))

vi.mock('../stores/permissions', () => ({
  usePermissionsStore: () => ({
    get canRunActiveTenantReconciliation() {
      return authState.sessionInfo?.canRunActiveTenantReconciliation === true ||
        authState.sessionInfo?.canEditActiveTenantData === true ||
        authState.sessionInfo?.isSuperAdmin === true
    },
    get canEditTenantSettings() {
      return authState.sessionInfo?.canEditActiveTenantData === true || authState.sessionInfo?.isSuperAdmin === true
    },
    get canManageGlobalSettings() {
      return authState.sessionInfo?.canManageDarpanCore === true
    },
    get canViewTenantSettings() {
      return Boolean(authState.sessionInfo?.userId)
    },
  }),
}))

vi.mock('../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

vi.mock('../lib/api/client', () => ({
  setAuthRequiredHandler,
}))

vi.mock('../lib/api/facade', () => ({
  settingsFacade: {
    listSftpServers,
  },
  reconciliationFacade: {
    listGeneratedOutputs,
  },
}))

vi.mock('../composables/useTheme', () => ({
  useTheme: () => ({
    theme: { value: 'light' },
    toggleTheme,
    setTheme: vi.fn(),
  }),
  initTheme: vi.fn(),
}))

import App from '../App.vue'

function mountApp() {
  const wrapper = mount(App, { attachTo: document.body })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('App shell logout', () => {
  beforeEach(() => {
    installLocalStorageStub()
    ensureAuthenticated.mockClear()
    logoutSession.mockClear()
    saveActiveTenant.mockClear()
    listSftpServers.mockReset()
    listGeneratedOutputs.mockReset()
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 0, pageCount: 1 },
      servers: [],
    })
    listGeneratedOutputs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 80, totalCount: 0, pageCount: 1 },
      generatedOutputs: [],
    })
    replace.mockClear()
    push.mockClear()
    resolve.mockClear()
    toggleTheme.mockClear()
    route.name = 'hub'
    route.path = '/'
    route.fullPath = '/'
    route.query = {}
    route.meta = {}
    document.body.classList.remove('surface-mode-static', 'surface-mode-workflow')
    window.history.replaceState({}, '', '/')
    authState.checked = true
    authState.error = null
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'test.customer',
      canEditActiveTenantData: true,
      isSuperAdmin: true,
    }
    localStorage.removeItem('darpan-ui-display-name:100000')
    draftStoreState.workflowOrigin = null
    draftStoreState.ruleSetDraftState = null
    draftStoreState.automationDraftState = null
    draftStoreState.setWorkflowOrigin.mockClear()
    draftStoreState.setRuleSetDraft.mockClear()
    draftStoreState.setAutomationDraft.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
    mountedWrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('shows a visible logout action that calls the facade logout flow', async () => {
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.user-fab').trigger('click')
    await flushPromises()

    const logoutButton = wrapper.get('.user-menu-actions .app-icon-action[aria-label="Sign out"]')

    await logoutButton.trigger('click')
    await flushPromises()

    expect(logoutSession).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith({ name: 'login' })
  })

  it('keeps home and command controls in the floating action cluster', async () => {
    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('.utility-header').exists()).toBe(false)
    expect(wrapper.find('.floating-actions').exists()).toBe(true)
    expect(wrapper.find('.command-bubble').text()).toContain('Ask Darpan')
    expect(wrapper.find('.home-fab').exists()).toBe(true)
    expect(wrapper.find('.app-shell').classes()).toContain('app-shell--static')
    expect(document.body.classList.contains('surface-mode-static')).toBe(true)
  })

  it('dismisses open inline menus before opening Ask Darpan', async () => {
    const wrapper = mountApp()
    await flushPromises()

    const handleDismiss = vi.fn()
    document.addEventListener(DISMISS_INLINE_MENUS_EVENT, handleDismiss)

    await wrapper.get('.command-bubble').trigger('click')

    document.removeEventListener(DISMISS_INLINE_MENUS_EVENT, handleDismiss)
    expect(handleDismiss).toHaveBeenCalledTimes(1)
  })

  it('loads data-backed command actions for SFTP edit targets and run results', async () => {
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      servers: [
        {
          sftpServerId: 'warehouse',
          description: 'Warehouse Dropship',
          host: 'sftp.example.com',
          port: 22,
          username: 'orders',
          remoteAttributes: 'Y',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
    })
    // The command palette now reads run results from the runResultsStore
    // cache (populated at login by the global hydrate fan-out) instead of
    // making an on-demand DB call. Seed it directly here to exercise the
    // palette's render path.
    const { useRunResultsStore } = await import('../stores/runResults')
    useRunResultsStore().upsertOutput({
      fileName: 'Order-Match-diff-20260424.json',
      sourceFormat: 'json',
      availableFormats: ['json'],
      savedRunId: 'RS_ORDER_MATCH',
      savedRunName: 'Order Match',
      file1Label: 'OMS',
      file2Label: 'Shopify',
      totalDifferences: 12,
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.command-bubble').trigger('click')
    await flushPromises()

    expect(listSftpServers).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect(listGeneratedOutputs).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Edit SFTP: Warehouse Dropship')
    expect(wrapper.text()).toContain('Open Result: Order Match')
  })

  it('preserves workflow origin state for data-backed workflow command routes', async () => {
    route.name = 'settings-sftp'
    route.path = '/settings/sftp'
    route.fullPath = '/settings/sftp'
    route.meta = { surfaceMode: 'static', staticPageLabel: 'SFTP Servers' }
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      servers: [
        {
          sftpServerId: 'warehouse',
          description: 'Warehouse Dropship',
          host: 'sftp.example.com',
          port: 22,
          username: 'orders',
          remoteAttributes: 'Y',
          hasPassword: true,
          hasPrivateKey: false,
        },
      ],
    })

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.command-bubble').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="command-action-data-sftp-server-warehouse"]').trigger('click')
    await flushPromises()

    expect(draftStoreState.setWorkflowOrigin).toHaveBeenCalledWith('SFTP Servers', '/settings/sftp')
    expect(push).toHaveBeenCalledWith('/settings/sftp/edit/warehouse')
  })

  it('keeps Ask Darpan schema navigation limited to valid schema entry points', () => {
    const source = readFileSync('src/App.vue', 'utf8')

    expect(source).toContain("id: 'navigate-schema-library'")
    expect(source).toContain("label: 'Open Schema Library'")
    expect(source).toContain("id: 'navigate-schema-infer'")
    expect(source).toContain("label: 'Create Schema'")
    expect(source).not.toContain("id: 'navigate-schema-editor'")
    expect(source).not.toContain("label: 'Open Schema Editor'")
    expect(source).not.toContain("to: '/schemas/editor'")
  })

  it('adds tenant integration settings to Ask Darpan navigation', async () => {
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.command-bubble').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="command-action-navigate-tenant-settings"]').text()).toBe('Open Tenant Settings')
    expect(wrapper.find('[data-testid="command-action-navigate-notifications"]').text()).toBe('Configure Notifications')
    expect(wrapper.find('[data-testid="command-action-navigate-shopify"]').text()).toBe('Open Shopify Settings')
    expect(wrapper.find('[data-testid="command-action-navigate-oms"]').text()).toBe('Open HotWax Settings')
  })

  it('uses a reduced gap between the floating quick actions and Ask Darpan bubble', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('--floating-actions-gap: calc(var(--space-4) / 2);')
  })

  it('keeps dashboard tile copy centered through the shared static-page tile contract', () => {
    const sharedStyleSource = readFileSync('src/style.css', 'utf8')
    const homeSource = readFileSync('src/pages/HomePage.vue', 'utf8')
    const runHistorySource = readFileSync('src/pages/reconciliation/ReconciliationRunHistoryPage.vue', 'utf8')

    expect(sharedStyleSource).toContain('.static-page-tile,')
    expect(sharedStyleSource).toContain('align-items: center;')
    expect(sharedStyleSource).toContain('justify-content: center;')
    expect(sharedStyleSource).toContain('text-align: center;')
    expect(sharedStyleSource).toContain('max-width: 100%;')
    expect(homeSource).not.toContain('.static-page-tile {')
    expect(homeSource).not.toContain('.static-page-tile-title {')
    expect(runHistorySource).toContain('.run-history-tile {')
    expect(runHistorySource).toContain('align-items: flex-start;')
    expect(runHistorySource).toContain('text-align: left;')
  })

  it('anchors static-page board content to the top so single-section dashboards do not stretch internal spacing', () => {
    const sharedStyleSource = readFileSync('src/style.css', 'utf8')

    expect(sharedStyleSource).toContain('.static-page-frame {')
    expect(sharedStyleSource).toContain('justify-items: center;')
    expect(sharedStyleSource).toContain('align-items: start;')
    expect(sharedStyleSource).toContain('.static-page-board {')
    expect(sharedStyleSource).toContain('align-content: start;')
    expect(sharedStyleSource).toContain('min-height: var(--static-board-min-height);')
  })

  it('does not apply an accent focus highlight to editable form controls in the shared design system', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const textFieldFocusSelector =
      "input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):not([type='button']):not([type='submit']):not([type='reset']):not([type='color']):focus"

    expect(source).toContain(textFieldFocusSelector)
    expect(source).toContain('select:focus,')
    expect(source).toContain("textarea:focus-visible")
    expect(source).toContain('select option:checked')
    expect(source).toContain('outline: none;')
    expect(source).toContain('box-shadow: none;')
    expect(source).toContain('border-color: var(--border);')
    expect(source).not.toContain('input:focus-visible,')
    expect(source).not.toContain('select:focus-visible,\nbutton:focus-visible,')
  })

  it('keeps shared checkbox and radio controls on grayscale accent tokens', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain("input[type='checkbox']")
    expect(source).toContain("input[type='radio']")
    expect(source).toContain('accent-color: var(--text-soft);')
  })

  it('uses a shared chevron-style select arrow inset away from the right border', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('select:not([multiple]):not([size])')
    expect(source).toContain('appearance: none;')
    expect(source).toContain('background-image:')
    expect(source).toContain('transparent 43%')
    expect(source).toContain('calc(100% - 1.03rem)')
    expect(source).toContain('padding-right: 2.2rem;')
    expect(source).toContain('.app-table td select')
    expect(source).toContain('padding-right: 2rem;')
  })

  it('routes current editable dropdown surfaces through app-controlled select components instead of native select menus', () => {
    const sharedSelectSource = readFileSync('src/components/ui/AppSelect.vue', 'utf8')
    const runsWorkflowSource = readFileSync('src/pages/settings/RunsSettingsWorkflowPage.vue', 'utf8')
    const sftpWorkflowSource = readFileSync('src/pages/settings/SftpServerWorkflowPage.vue', 'utf8')
    const tenantSettingsSource = readFileSync('src/pages/settings/TenantSettingsPage.vue', 'utf8')
    const authSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')
    const endpointsSource = readFileSync('src/pages/settings/NetSuiteEndpointWorkflowPage.vue', 'utf8')
    const shopifySource = readFileSync('src/pages/settings/ShopifyAuthWorkflowPage.vue', 'utf8')
    const omsSource = readFileSync('src/pages/settings/OmsRestSourceWorkflowPage.vue', 'utf8')
    const schemaEditorSource = readFileSync('src/pages/jsonschema/JsonSchemaEditorPage.vue', 'utf8')

    expect(sharedSelectSource).toContain('app-select-option--selected')
    expect(sharedSelectSource).not.toContain('var(--accent)')
    expect(runsWorkflowSource).toContain('<AppSelect')
    expect(runsWorkflowSource).not.toContain('<select')
    expect(sftpWorkflowSource).toContain('<WorkflowSelect')
    expect(sftpWorkflowSource).not.toContain('<select')
    expect(tenantSettingsSource).toContain('<AppSelect')
    expect(tenantSettingsSource).toContain('<WorkflowSelect')
    expect(tenantSettingsSource).not.toContain('<select')
    expect(authSource).toContain('<AppSelect')
    expect(authSource).not.toContain('<select')
    expect(endpointsSource).toContain('<AppSelect')
    expect(endpointsSource).not.toContain('<select')
    expect(shopifySource).toContain('<AppSelect')
    expect(shopifySource).toContain('class="app-table__checkbox"')
    expect(shopifySource).not.toContain('<select')
    expect(omsSource).toContain('<AppSelect')
    expect(omsSource).toContain('<WorkflowShortcutChoiceCards')
    expect(omsSource).not.toContain('<select')
    expect(schemaEditorSource).toContain('<AppSelect')
    expect(schemaEditorSource).not.toContain('<select')
  })

  it('routes current save actions through the shared icon-only save control', () => {
    const saveActionSource = readFileSync('src/components/ui/AppSaveAction.vue', 'utf8')
    const workflowStepFormSource = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const runsWorkflowSource = readFileSync('src/pages/settings/RunsSettingsWorkflowPage.vue', 'utf8')
    const tenantSettingsSource = readFileSync('src/pages/settings/TenantSettingsPage.vue', 'utf8')
    const authSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')
    const endpointsSource = readFileSync('src/pages/settings/NetSuiteEndpointWorkflowPage.vue', 'utf8')
    const shopifySource = readFileSync('src/pages/settings/ShopifyAuthWorkflowPage.vue', 'utf8')
    const omsSource = readFileSync('src/pages/settings/OmsRestSourceWorkflowPage.vue', 'utf8')
    const schemaEditorSource = readFileSync('src/pages/jsonschema/JsonSchemaEditorPage.vue', 'utf8')
    const stepMachineSource = readFileSync('src/composables/useWorkflowStepMachine.ts', 'utf8')

    expect(saveActionSource).toContain('app-icon-action app-icon-action--large app-icon-action--primary')
    expect(saveActionSource).toContain('aria-label')
    expect(workflowStepFormSource).toContain('<AppSaveAction')
    expect(workflowStepFormSource).toContain("primaryActionVariant === 'save'")
    expect(stepMachineSource).toContain("? 'Save'")
    expect(runsWorkflowSource).toContain('<WorkflowStepForm')
    expect(runsWorkflowSource).toContain('primary-action-variant="save"')
    expect(tenantSettingsSource).toContain('<WorkflowStepForm')
    expect(tenantSettingsSource).toContain(':primary-label="aiPrimaryLabel"')
    expect(tenantSettingsSource).toContain(':primary-action-variant="aiPrimaryActionVariant"')
    expect(tenantSettingsSource).toContain("aiWorkflowSaving.value ? 'Saving' : 'Save'")
    expect(authSource).toContain('<WorkflowStepForm')
    expect(authSource).toContain(':primary-label="primaryLabel"')
    expect(authSource).toContain(':primary-action-variant="primaryActionVariant"')
    expect(authSource).toContain('useWorkflowStepMachine')
    expect(endpointsSource).toContain('<WorkflowStepForm')
    expect(endpointsSource).toContain(':primary-label="primaryLabel"')
    expect(endpointsSource).toContain(':primary-action-variant="primaryActionVariant"')
    expect(endpointsSource).toContain('useWorkflowStepMachine')
    expect(shopifySource).toContain('<WorkflowStepForm')
    expect(shopifySource).toContain(':primary-label="primaryLabel"')
    expect(shopifySource).toContain(':primary-action-variant="primaryActionVariant"')
    expect(shopifySource).toContain('useWorkflowStepMachine')
    expect(omsSource).toContain('<WorkflowStepForm')
    expect(omsSource).toContain(':primary-label="primaryLabel"')
    expect(omsSource).toContain(':primary-action-variant="primaryActionVariant"')
    expect(omsSource).toContain('useWorkflowStepMachine')
    expect(schemaEditorSource).toContain('<AppSaveAction')
  })

  it('routes edit-workflow cancel actions through the shared icon-only X control', () => {
    const cancelActionSource = readFileSync('src/components/ui/AppCancelAction.vue', 'utf8')
    const workflowStepFormSource = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const runsWorkflowSource = readFileSync('src/pages/settings/RunsSettingsWorkflowPage.vue', 'utf8')
    const sftpWorkflowSource = readFileSync('src/pages/settings/SftpServerWorkflowPage.vue', 'utf8')
    const authSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')
    const endpointsSource = readFileSync('src/pages/settings/NetSuiteEndpointWorkflowPage.vue', 'utf8')
    const shopifySource = readFileSync('src/pages/settings/ShopifyAuthWorkflowPage.vue', 'utf8')
    const omsSource = readFileSync('src/pages/settings/OmsRestSourceWorkflowPage.vue', 'utf8')

    expect(cancelActionSource).toContain('class="app-icon-action app-icon-action--large"')
    expect(cancelActionSource).toContain('<line x1="5" y1="5" x2="15" y2="15"')
    expect(cancelActionSource).toContain('<line x1="15" y1="5" x2="5" y2="15"')
    expect(workflowStepFormSource).toContain('<AppCancelAction')
    expect(workflowStepFormSource).toContain("showCancelAction: false")
    expect(runsWorkflowSource).toContain(':show-cancel-action="true"')
    expect(sftpWorkflowSource).toContain(':show-cancel-action="isEditing"')
    expect(authSource).toContain(':show-cancel-action="isEditing"')
    expect(endpointsSource).toContain(':show-cancel-action="isEditing"')
    expect(shopifySource).toContain(':show-cancel-action="isEditing"')
    expect(omsSource).toContain(':show-cancel-action="isEditing"')
  })

  it('provides shared settings-dashboard layout utilities while static pages inherit dynamic board height globally', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const staticFrameSource = readFileSync('src/components/ui/StaticPageFrame.vue', 'utf8')
    const sftpPageSource = readFileSync('src/pages/settings/SftpServersPage.vue', 'utf8')
    const netsuiteSource = readFileSync('src/pages/settings/NetSuiteSettingsPage.vue', 'utf8')
    const recordListSource = readFileSync('src/pages/settings/SettingsRecordListSection.vue', 'utf8')

    expect(source).toContain('--static-board-min-height: 0;')
    expect(staticFrameSource).toContain('<div v-if="$slots.actions" class="static-page-actions">')
    expect(source).toContain('.static-page-actions {')
    expect(source).toMatch(/\.static-page-actions\s*\{[^}]*width: min\(var\(--static-frame-width\), 100%\);/)
    expect(source).toMatch(/\.static-page-actions\s*\{[^}]*justify-content: center;/)
    expect(source).toContain('.static-page-record-grid {')
    expect(source).toContain('.static-page-record-grid--fixed {')
    expect(source).toContain('.static-page-record-tile {')
    expect(source).toContain('min-height: var(--static-tile-min-height);')
    expect(source).toContain('.static-page-create-action {')
    expect(source).toContain('width: calc((100% - (var(--static-tile-gap) * 2)) / 3);')
    expect(sftpPageSource).not.toContain('static-page-frame--records')
    expect(sftpPageSource).not.toContain('<style scoped>')
    expect(netsuiteSource).toContain('<SettingsRecordListSection')
    expect(recordListSource).toContain('static-page-record-grid')
    expect(recordListSource).toContain('static-page-record-tile')
  })

  it('provides a shared compact workflow-form contract for multi-input settings workflows', () => {
    const styleSource = readFileSync('src/style.css', 'utf8')
    const workflowSource = readFileSync('src/components/workflow/WorkflowStepForm.vue', 'utf8')
    const runsWorkflowSource = readFileSync('src/pages/settings/RunsSettingsWorkflowPage.vue', 'utf8')
    const sftpWorkflowSource = readFileSync('src/pages/settings/SftpServerWorkflowPage.vue', 'utf8')
    const tenantSettingsSource = readFileSync('src/pages/settings/TenantSettingsPage.vue', 'utf8')
    const authWorkflowSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')
    const endpointWorkflowSource = readFileSync('src/pages/settings/NetSuiteEndpointWorkflowPage.vue', 'utf8')
    const shopifyWorkflowSource = readFileSync('src/pages/settings/ShopifyAuthWorkflowPage.vue', 'utf8')
    const omsWorkflowSource = readFileSync('src/pages/settings/OmsRestSourceWorkflowPage.vue', 'utf8')

    expect(styleSource).toContain('.workflow-form--compact {')
    expect(styleSource).toContain('.workflow-form-grid {')
    expect(styleSource).toContain('.workflow-form-grid--two {')
    expect(styleSource).toContain('.workflow-form-grid--compact {')
    expect(styleSource).toContain('.workflow-form-grid--shopify-compact {')
    expect(styleSource).toContain('grid-template-rows: auto 2.2rem;')
    expect(styleSource).toContain('.workflow-form-textarea {')
    expect(workflowSource).toContain('--workflow-form-answer-size: var(--workflow-answer-size);')
    expect(workflowSource).toContain('--workflow-form-select-size: var(--workflow-select-size);')
    expect(workflowSource).toContain('font-size: var(--workflow-form-answer-size);')
    expect(workflowSource).toContain('font-size: var(--workflow-form-select-size);')
    expect(runsWorkflowSource).toContain("'workflow-form--compact'")
    expect(runsWorkflowSource).toContain("'workflow-form--edit-single-page'")
    expect(runsWorkflowSource).toContain('edit-surface')
    expect(runsWorkflowSource).toContain(':show-enter-hint="false"')
    expect(sftpWorkflowSource).toContain("'workflow-form--compact'")
    expect(sftpWorkflowSource).toContain("'workflow-form--edit-single-page': isEditing")
    expect(sftpWorkflowSource).toContain(':edit-surface="isEditing"')
    expect(sftpWorkflowSource).toContain(':show-enter-hint="!isEditing"')
    expect(tenantSettingsSource).toContain("'workflow-form--edit-single-page': isAiEditing")
    expect(authWorkflowSource).toContain(':edit-surface="isEditing"')
    expect(authWorkflowSource).toContain(':show-enter-hint="!isEditing"')
    expect(endpointWorkflowSource).toContain(':edit-surface="isEditing"')
    expect(endpointWorkflowSource).toContain(':show-enter-hint="!isEditing"')
    expect(shopifyWorkflowSource).toContain(':edit-surface="isEditing"')
    expect(shopifyWorkflowSource).toContain(':show-enter-hint="!isEditing"')
    expect(omsWorkflowSource).toContain(':edit-surface="isEditing"')
    expect(omsWorkflowSource).toContain(':show-enter-hint="!isEditing && !isCreateChoiceStep"')
    expect(omsWorkflowSource).toContain('<WorkflowShortcutChoiceCards')
    expect(sftpWorkflowSource).not.toContain('settings-workflow-form')
  })

  it('left-aligns checkbox-only table controls in the shared table system', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const schemaEditorSource = readFileSync('src/pages/jsonschema/JsonSchemaEditorPage.vue', 'utf8')

    expect(source).toContain('.checkbox-inline--control-only')
    expect(source).toContain('justify-content: flex-start;')
    expect(source).toContain('.checkbox-inline input:not(.app-table__checkbox)')
    expect(source).toContain('.app-table__checkbox')
    expect(source).toMatch(/\.app-table__checkbox\s*\{[^}]*appearance: none;/)
    expect(source).toMatch(/\.app-table__checkbox\s*\{[^}]*width: 2.2rem;/)
    expect(source).toMatch(/\.app-table__checkbox\s*\{[^}]*height: 2.2rem;/)
    expect(source).toMatch(/\.app-table__checkbox\s*\{[^}]*padding: 0;/)
    expect(source).toMatch(/\.app-table__checkbox\s*\{[^}]*border-radius: var\(--icon-container-radius\);/)
    expect(source).toContain('.app-table__checkbox::after')
    expect(schemaEditorSource).toContain('class="app-table__checkbox"')
  })

  it('vertically centers shared table action cells for icon-only row actions', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toMatch(/\.app-table td\.app-table__action-cell\s*\{[^}]*vertical-align: middle;/)
    expect(source).toMatch(/\.app-table td\.app-table__action-cell\s*\{[^}]*line-height: 0;/)
  })

  it('provides a shared control-cell contract for vertically centering boxed controls within table rows', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const schemaEditorSource = readFileSync('src/pages/jsonschema/JsonSchemaEditorPage.vue', 'utf8')

    expect(source).toContain('.app-table__control-cell')
    expect(source).toMatch(/\.app-table td\.app-table__control-cell\s*\{[^}]*vertical-align: middle;/)
    expect(source).toContain('.app-table__control-wrap')
    expect(source).toContain('align-items: center;')
    expect(source).toContain('min-height: 2.2rem;')
    expect(source).toMatch(/\.app-table__control-wrap\s*\{[^}]*line-height: 0;/)
    expect(source).toContain('.app-table__control-wrap--start')
    expect(source).toContain('.app-table__control-wrap--end')
    expect(schemaEditorSource).toContain("cellClass: 'app-table__control-cell'")
    expect(schemaEditorSource).toContain('app-table__control-wrap app-table__control-wrap--start')
    expect(schemaEditorSource).toContain('app-table__control-wrap app-table__control-wrap--end')
    expect(schemaEditorSource).not.toContain('transform: translateY(2px);')
  })

  it('provides shared static-page list, module, summary, and pager contracts for future settings migrations', () => {
    const styleSource = readFileSync('src/style.css', 'utf8')
    const sftpPageSource = readFileSync('src/pages/settings/SftpServersPage.vue', 'utf8')
    const netsuiteSource = readFileSync('src/pages/settings/NetSuiteSettingsPage.vue', 'utf8')
    const recordListSource = readFileSync('src/pages/settings/SettingsRecordListSection.vue', 'utf8')
    const browseSource = readFileSync('src/pages/jsonschema/JsonSchemaBrowsePage.vue', 'utf8')
    const editorSource = readFileSync('src/pages/jsonschema/JsonSchemaEditorPage.vue', 'utf8')

    expect(styleSource).toContain('.static-page-list-toolbar')
    expect(styleSource).toContain('.static-page-pager')
    expect(styleSource).toContain('.static-page-list-tile')
    expect(styleSource).toContain('.static-page-list-tile__meta')
    expect(styleSource).toContain('.static-page-module-grid')
    expect(styleSource).toContain('.static-page-module-tile')
    expect(styleSource).toContain('.static-page-summary-grid')
    expect(styleSource).toMatch(/\.static-page-summary-grid\s*\{[^}]*align-items: start;/)
    expect(styleSource).toContain('.static-page-summary-card')
    expect(styleSource).toContain('.static-page-summary-label')
    expect(recordListSource).toContain('<AppListPager')
    expect(sftpPageSource).toContain('pager-aria-label="SFTP server pages"')
    expect(netsuiteSource).toContain('pager-aria-label="NetSuite auth pages"')
    expect(recordListSource).toContain('static-page-record-grid--fixed')
    expect(netsuiteSource).not.toContain('class="static-page-list-toolbar"')
    expect(browseSource).toContain('static-page-list-tile')
    expect(browseSource).not.toContain('<style scoped>')
    expect(editorSource).toContain('static-page-summary-grid')
    expect(editorSource).toContain('static-page-summary-card')
    expect(editorSource).toContain('static-page-summary-label')
  })

  it('centers shared append-row actions inside the table frame', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('.app-table__append-action')
    expect(source).toContain('justify-content: center;')
  })

  it('uses a shared rectangular radius token for shared icon containers without changing floating FABs', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('--icon-container-radius: var(--radius-sm);')
    expect(source).toMatch(/\.app-table__header-action\s*\{[^}]*border-radius: var\(--icon-container-radius\);/)
    expect(source).toMatch(
      /\.app-table__header-action\s*\{[^}]*color: color-mix\(in oklab, var\(--danger\) 82%, var\(--text\)\);/,
    )
    expect(source).toMatch(/\.app-icon-action,\s*\.app-table__icon-action\s*\{[^}]*border-radius: var\(--icon-container-radius\);/)
    expect(source).toMatch(
      /\.app-icon-action,\s*\.app-table__icon-action\s*\{[^}]*color: color-mix\(in oklab, var\(--danger\) 82%, var\(--text\)\);/,
    )
    // The FABs stay pill-shaped rather than taking the rectangular icon-container radius. That was
    // pinned as a literal 999px; --radius-pill is the same value and names the intent, so the guard
    // now reads as "pill, not icon-container" instead of "this magic number".
    expect(source).toContain('--radius-pill: 999px;')
    expect(source).toMatch(/\.user-fab,\s*\.home-fab\s*\{[^}]*border-radius: var\(--radius-pill\);/)
  })

  it('keeps the semantic primary save-action class without dedicated icon-action overrides', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const saveActionSource = readFileSync('src/components/ui/AppSaveAction.vue', 'utf8')

    expect(saveActionSource).toContain('app-icon-action--primary')
    expect(source).not.toContain('.app-icon-action--primary')
    expect(source).not.toContain('.app-icon-action--primary:hover')
    expect(source).not.toContain('.app-icon-action--primary:disabled')
  })

  it('provides a shared large icon action variant for oversized footer controls', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('.app-icon-action--large')
    expect(source).toContain('width: 2.8rem;')
    expect(source).toContain('min-height: 2.8rem;')
    expect(source).toContain('.app-icon-action--large svg')
    expect(source).toContain('width: 1.35rem;')
    expect(source).toContain('height: 1.35rem;')
  })

  it('provides a shared danger icon action variant for destructive icon-only controls', () => {
    const source = readFileSync('src/style.css', 'utf8')

    expect(source).toContain('.app-icon-action--danger')
    expect(source).toContain('.app-table__icon-action--danger')
    expect(source).toContain('color: color-mix(in oklab, var(--danger) 82%, var(--text));')
  })

  it('keeps the shared theme palette strictly grayscale in both light and dark modes', () => {
    const source = readFileSync('src/style.css', 'utf8')
    const grayscaleTokens = [
      '--bg',
      '--bg-soft',
      '--surface',
      '--surface-2',
      '--surface-3',
      '--border',
      '--border-soft',
      '--text',
      '--text-soft',
      '--text-muted',
      '--text-dim',
      '--accent',
      '--accent-ink',
      '--success',
      '--warning',
      '--danger',
    ]
    const themeBlocks = [
      source.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1],
      source.match(/:root\[data-theme='light']\s*\{([\s\S]*?)\n\}/)?.[1],
    ]

    themeBlocks.forEach((block) => {
      expect(block).toBeTruthy()

      grayscaleTokens.forEach((token) => {
        const match = block?.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`))
        expect(match).toBeTruthy()

        const value = match?.[1] ?? ''
        const channels = value.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/)

        expect(channels).toBeTruthy()
        expect(channels?.[1]).toBe(channels?.[2])
        expect(channels?.[2]).toBe(channels?.[3])
      })
    })

    expect(source).toContain('border: 1px solid color-mix(in oklab, var(--accent) 34%, var(--border));')
    expect(source).toContain('background: color-mix(in oklab, var(--accent) 92%, var(--surface));')
    expect(source).not.toContain('#d7a7a7')
    expect(source).not.toContain('#8d4a4a')
    expect(source).not.toContain('#c6ced8')
    expect(source).not.toContain('#dbe1e8')
    expect(source).not.toContain('#5f6b79')
  })

  it('keeps extra helper copy out of the user menu when no tenant switcher is available', async () => {
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.user-fab').trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('User details')
    expect(wrapper.text()).not.toContain('Theme')
    expect(wrapper.text()).not.toContain('Signed in')
    expect(wrapper.text()).not.toContain('Ask Darpan shortcut: Cmd/Ctrl+K')
    expect(wrapper.find('.user-menu-tenant').exists()).toBe(false)

    const themeToggle = wrapper.get('.user-menu-actions .app-icon-action[aria-label="Switch to dark mode"]')
    await themeToggle.trigger('click')

    expect(toggleTheme).toHaveBeenCalledTimes(1)
  })

  it('shows the active tenant below the user name in the user menu', async () => {
    authState.sessionInfo = {
      ...authState.sessionInfo!,
      activeTenantUserGroupId: 'GORJANA',
      activeTenantLabel: 'Gorjana',
      availableTenants: [{ userGroupId: 'GORJANA', label: 'Gorjana' }],
    }

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.user-fab').trigger('click')
    await flushPromises()

    expect(wrapper.get('.user-menu-name').text()).toBe('test.customer')
    expect(wrapper.get('.user-menu-tenant').text()).toBe('Gorjana')
  })

  it('does not render authenticated action errors inside the user menu', async () => {
    authState.error = 'The name [metaClass] is not a valid field name or relationship name for entity moqui.security.UserAccount'

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.user-fab').trigger('click')
    await flushPromises()

    expect(wrapper.get('.user-menu-name').text()).toBe('test.customer')
    expect(wrapper.find('.user-menu-card').text()).not.toContain('metaClass')
  })

  it('routes user settings from the user menu gear action', async () => {
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.user-fab').trigger('click')
    await flushPromises()

    await wrapper.get('.user-menu-actions .app-icon-action[aria-label="Open user settings"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/settings/user')
    expect(wrapper.find('.user-menu-card').exists()).toBe(false)
  })

  it('keeps the page visible by avoiding a full-screen user-menu backdrop', async () => {
    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.user-fab').trigger('click')
    await flushPromises()

    expect(wrapper.find('.user-menu-backdrop').exists()).toBe(false)
    expect(wrapper.find('.user-menu-visual-backdrop').exists()).toBe(false)
    expect(wrapper.find('.app-shell').classes()).toContain('app-shell--popup-open')
    expect(wrapper.find('.user-menu-card').exists()).toBe(true)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flushPromises()

    expect(wrapper.find('.user-menu-card').exists()).toBe(false)
    expect(wrapper.find('.app-shell').classes()).not.toContain('app-shell--popup-open')
  })

  it('switches the shell into workflow mode for workflow routes', async () => {
    route.name = 'reconciliation-create'
    route.path = '/reconciliation/create'
    route.fullPath = '/reconciliation/create'
    route.meta = { surfaceMode: 'workflow' }

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.find('.app-shell').classes()).toContain('app-shell--workflow')
    expect(wrapper.find('.content-shell').classes()).toContain('content-shell--workflow')
    expect(document.body.classList.contains('surface-mode-workflow')).toBe(true)
  })

  it('routes the floating home action back to the hub on non-hub routes', async () => {
    route.name = 'settings-tenant'
    route.path = '/settings/tenant'
    route.fullPath = '/settings/tenant'
    route.meta = {}

    const wrapper = mountApp()
    await flushPromises()

    await wrapper.get('.home-fab').trigger('click')

    expect(push).toHaveBeenCalledWith('/')
  })

  it('ignores keydown events that carry no key instead of throwing', async () => {
    mountApp()
    await flushPromises()

    // Browsers and extensions can dispatch keydown events with no `key` (synthetic events,
    // some IME/autofill paths). The global handler must not blow up on them — it used to
    // call event.key.toLowerCase() unguarded, which threw TypeError into the error reporter
    // on every such event.
    const keyless = new KeyboardEvent('keydown', { bubbles: true, cancelable: true })
    Object.defineProperty(keyless, 'key', { value: undefined })

    expect(() => window.dispatchEvent(keyless)).not.toThrow()
    await flushPromises()
  })

  it('uses Escape to abort workflow routes back to the hub when no static origin is available', async () => {
    route.name = 'reconciliation-create'
    route.path = '/reconciliation/create'
    route.fullPath = '/reconciliation/create'
    route.meta = { surfaceMode: 'workflow' }

    mountApp()
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/')
  })

  it('shows a temporary Escape hint when a workflow route has static origin state', async () => {
    vi.useFakeTimers()
    route.name = 'reconciliation-create'
    route.path = '/reconciliation/create'
    route.fullPath = '/reconciliation/create'
    route.meta = { surfaceMode: 'workflow' }
    draftStoreState.workflowOrigin = { label: 'Dashboard', path: '/' }

    const wrapper = mountApp()
    await flushPromises()

    expect(wrapper.text()).toContain('Press Esc to go back to Dashboard')

    vi.advanceTimersByTime(2000)
    await flushPromises()

    expect(wrapper.text()).not.toContain('Press Esc to go back to Dashboard')
  })

  it('shows workflow warning hints for five seconds in the Escape hint position', async () => {
    vi.useFakeTimers()

    const wrapper = mountApp()
    await flushPromises()

    document.dispatchEvent(new CustomEvent(WORKFLOW_HINT_REQUEST_EVENT, {
      detail: {
        message: 'Password incorrect.',
        tone: 'warning',
        durationMs: 5000,
      },
    }))
    await flushPromises()

    const hint = wrapper.get('.workflow-escape-hint')
    expect(hint.text()).toBe('Password incorrect.')
    expect(hint.classes()).toContain('workflow-escape-hint--warning')

    vi.advanceTimersByTime(4999)
    await flushPromises()
    expect(wrapper.text()).toContain('Password incorrect.')

    vi.advanceTimersByTime(1)
    await flushPromises()
    expect(wrapper.text()).not.toContain('Password incorrect.')
  })

  it('uses Escape to return workflow routes to the static origin when provided', async () => {
    route.name = 'reconciliation-create'
    route.path = '/reconciliation/create'
    route.fullPath = '/reconciliation/create'
    route.meta = { surfaceMode: 'workflow' }
    draftStoreState.workflowOrigin = { label: 'Schema Library', path: '/schemas/library' }

    mountApp()
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/schemas/library')
  })

  it('lets workflow pages handle Escape through the shared cancel request before shell fallback', async () => {
    route.name = 'reconciliation-ruleset-editor'
    route.path = '/reconciliation/ruleset-manager/rules'
    route.fullPath = '/reconciliation/ruleset-manager/rules'
    route.meta = { surfaceMode: 'workflow' }
    const handleCancelRequest = vi.fn((event: Event) => {
      event.preventDefault()
    })
    document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)

    try {
      mountApp()
      await flushPromises()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()

      expect(handleCancelRequest).toHaveBeenCalledTimes(1)
      expect(push).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
    }
  })

  it('lets static-page popup workflows handle Escape through the shared cancel request', async () => {
    route.name = 'settings-user'
    route.path = '/settings/user'
    route.fullPath = '/settings/user'
    route.meta = {}
    const handleCancelRequest = vi.fn((event: Event) => {
      event.preventDefault()
    })
    document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)

    try {
      mountApp()
      await flushPromises()

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await flushPromises()

      expect(handleCancelRequest).toHaveBeenCalledTimes(1)
      expect(push).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
    }
  })

  it('carries workflow origin route state when Escape aborts a nested workflow', async () => {
    route.name = 'reconciliation-ruleset-editor'
    route.path = '/reconciliation/ruleset-manager/rules'
    route.fullPath = '/reconciliation/ruleset-manager/rules'
    route.meta = { surfaceMode: 'workflow' }
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager' }

    mountApp()
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/reconciliation/ruleset-manager')
  })

  it('clears retained focus after Escape aborts a workflow route', async () => {
    route.name = 'reconciliation-create'
    route.path = '/reconciliation/create'
    route.fullPath = '/reconciliation/create'
    route.meta = { surfaceMode: 'workflow' }

    const wrapper = mountApp()
    await flushPromises()

    const homeButton = wrapper.get('.home-fab').element as HTMLButtonElement
    homeButton.focus()
    expect(document.activeElement).toBe(homeButton)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(document.activeElement).not.toBe(homeButton)
  })

  it('does not navigate home on Escape for non-workflow routes', async () => {
    route.name = 'settings-tenant'
    route.path = '/settings/tenant'
    route.fullPath = '/settings/tenant'
    route.meta = {}

    mountApp()
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await flushPromises()

    expect(push).not.toHaveBeenCalled()
  })

  it('re-checks auth via the registered auth-required handler and routes verification failures to login', async () => {
    ensureAuthenticated.mockResolvedValue(false)
    authState.error = 'Unable to verify authentication'
    authState.status = 'verification-failed'
    authState.sessionInfo = null

    mountApp()
    await flushPromises()

    expect(setAuthRequiredHandler).toHaveBeenCalled()
    expect(authRequiredHandlerRef.current).toBeTypeOf('function')
    authRequiredHandlerRef.current?.({ message: 'unauthorized', method: 'facade.X', candidateUrl: '/rpc/json', status: 401 })
    await flushPromises()

    expect(ensureAuthenticated).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ name: 'login' })
  })

  it('removes the standalone auth-required fallback route and page from the active app shell', () => {
    const routerSource = readFileSync('src/router/index.ts', 'utf8')
    const appSource = readFileSync('src/App.vue', 'utf8')

    expect(routerSource).not.toContain("path: '/auth-required'")
    expect(routerSource).not.toContain("name: 'auth-required'")
    expect(appSource).not.toContain("route.name === 'auth-required'")
    expect(existsSync('src/pages/AuthRequiredPage.vue')).toBe(false)
  })
})
