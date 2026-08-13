import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const inferFromText = vi.hoisted(() => vi.fn())
const saveText = vi.hoisted(() => vi.fn())
const listEnumOptions = vi.hoisted(() => vi.fn())
const inferredSchemaText = JSON.stringify({
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    status: { type: 'string' },
  },
  required: ['orderId'],
})
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'editor',
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  jsonSchemaFacade: {
    inferFromText,
    saveText,
  },
  settingsFacade: {
    listEnumOptions,
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

import JsonSchemaWizardPage from '../JsonSchemaWizardPage.vue'

async function chooseAppSelectOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

function stubFileReader(fileText = '{"orderId":"1001"}'): void {
  class MockFileReader {
    result: string | ArrayBuffer | null = null
    onload: null | (() => void) = null
    onerror: null | (() => void) = null

    readAsText(): void {
      this.result = fileText
      this.onload?.()
    }
  }

  vi.stubGlobal('FileReader', MockFileReader as unknown as typeof FileReader)
}

describe('JsonSchemaWizardPage', () => {
  beforeEach(() => {
    push.mockClear()
    inferFromText.mockReset()
    saveText.mockReset()
    listEnumOptions.mockReset()
    authState.sessionInfo = {
      userId: 'editor',
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }

    stubFileReader()
    listEnumOptions.mockResolvedValue({
      options: [
        { enumId: 'DarSysOms', label: 'OMS' },
        { enumId: 'DarSysShopify', label: 'SHOPIFY' },
      ],
    })
    inferFromText.mockResolvedValue({
      jsonSchemaString: inferredSchemaText,
      fieldList: [
        { fieldPath: '$.orderId', type: 'string', required: true },
        { fieldPath: '$.status', type: 'string', required: false },
      ],
    })
    saveText.mockResolvedValue({
      ok: true,
      messages: ['Saved schema orders.'],
      errors: [],
      savedSchema: {
        jsonSchemaId: 'schema-1',
        schemaName: 'orders',
      },
    })
  })

  it('creates a schema from a sample file by assigning the system before reviewing the interpreted schema', async () => {
    const wrapper = mount(JsonSchemaWizardPage)
    await flushPromises()

    expect(wrapper.find('.workflow-page').exists()).toBe(true)
    expect(wrapper.text()).toContain('Are you uploading a schema file or a sample file?')
    expect(wrapper.text()).toContain('Sample file')
    expect(wrapper.find('[data-testid="wizard-next"]').exists()).toBe(false)
    expect(wrapper.find('.wizard-enter-hint').exists()).toBe(false)
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
    expect(wrapper.text()).not.toContain('Selected upload:')
    expect(wrapper.text()).not.toContain('Uploaded file:')
    expect(wrapper.text()).not.toContain('Upload an existing JSON schema file and save it directly.')
    expect(wrapper.text()).not.toContain('Upload sample JSON and infer a schema before saving.')

    await wrapper.get('[data-testid="upload-intent-sample"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Upload the sample file')
    expect(wrapper.text()).not.toContain('Selected upload:')
    expect(wrapper.text()).not.toContain('Uploaded file:')
    expect(wrapper.get('.wizard-file-answer').classes()).toContain('empty')

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })
    await fileInput.trigger('change')
    expect(wrapper.get('.wizard-file-answer').classes()).not.toContain('empty')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(inferFromText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Assign the system')
    await chooseAppSelectOption(wrapper, 'schema-wizard-system', 'DarSysOms')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(inferFromText).toHaveBeenCalledTimes(1)
    expect(inferFromText).toHaveBeenCalledWith({
      jsonText: '{"orderId":"1001"}',
    })
    expect(wrapper.text()).toContain('Review the interpreted schema')
    expect(wrapper.text()).toContain('$.orderId')
    expect(wrapper.text()).not.toContain('Uploaded file:')
    const tableColumns = wrapper.findAll('.app-table colgroup col')
    expect(tableColumns[0]?.attributes('style')).toContain('width: calc(100% - 15rem);')
    expect(tableColumns[1]?.attributes('style')).toContain('width: 8.5rem;')
    expect(tableColumns[2]?.attributes('style')).toContain('width: 6.5rem;')
    expect(wrapper.get('[data-testid="schema-verify-field-path-0"]').attributes('title')).toBe('$.orderId')
    const requiredCheckboxes = wrapper.findAll('tbody input[type="checkbox"]')
    expect(requiredCheckboxes).toHaveLength(2)
    expect((requiredCheckboxes[0]!.element as HTMLInputElement).checked).toBe(true)
    expect((requiredCheckboxes[1]!.element as HTMLInputElement).checked).toBe(false)
    await requiredCheckboxes[1]!.setValue(true)

    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Name the schema')

    const nameInput = wrapper.get('input[name="schemaName"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('orders')
    await nameInput.trigger('keydown.enter')
    await flushPromises()

    expect(saveText).toHaveBeenCalledWith(expect.objectContaining({
      schemaName: 'orders',
      systemEnumId: 'DarSysOms',
      overwrite: false,
    }))
    const savePayload = saveText.mock.calls[0]?.[0] as Record<string, unknown>
    const savedSchema = JSON.parse(String(savePayload.schemaText))
    expect(savedSchema.required).toEqual(['orderId', 'status'])
    expect(push).toHaveBeenCalledWith({ name: 'schemas-library' })
    wrapper.unmount()
  })

  it('accepts keyboard shortcuts on the choice step and saves an uploaded schema file without running sample-file inference', async () => {
    const wrapper = mount(JsonSchemaWizardPage)
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await flushPromises()

    expect(wrapper.text()).toContain('Upload the schema file')
    expect(wrapper.text()).not.toContain('Selected upload:')
    expect(wrapper.text()).not.toContain('Uploaded file:')
    expect(wrapper.get('.wizard-file-answer').classes()).toContain('empty')

    stubFileReader('{"type":"object","properties":{"orderId":{"type":"string"}}}')

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"type":"object","properties":{"orderId":{"type":"string"}}}'], 'orders-schema.json', { type: 'application/json' })],
      configurable: true,
    })
    await fileInput.trigger('change')
    expect(wrapper.get('.wizard-file-answer').classes()).not.toContain('empty')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(inferFromText).not.toHaveBeenCalled()
    await chooseAppSelectOption(wrapper, 'schema-wizard-system', 'DarSysOms')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Name the schema')
    expect(wrapper.text()).not.toContain('Uploaded file:')

    const nameInput = wrapper.get('input[name="schemaName"]')
    expect((nameInput.element as HTMLInputElement).value).toBe('orders-schema')
    await nameInput.trigger('keydown.enter')
    await flushPromises()

    expect(saveText).toHaveBeenCalledWith({
      schemaName: 'orders-schema',
      systemEnumId: 'DarSysOms',
      schemaText: '{"type":"object","properties":{"orderId":{"type":"string"}}}',
      overwrite: false,
    })
    expect(push).toHaveBeenCalledWith({ name: 'schemas-library' })
    wrapper.unmount()
  })

  it('advances from the upload step when Enter is pressed after selecting a file', async () => {
    const wrapper = mount(JsonSchemaWizardPage, {
      attachTo: document.body,
    })
    await flushPromises()

    await wrapper.get('[data-testid="upload-intent-sample"]').trigger('click')
    await flushPromises()

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })

    await fileInput.trigger('change')
    await fileInput.trigger('keydown.enter')
    await flushPromises()

    expect(inferFromText).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Assign the system')

    wrapper.unmount()
  })

  it('keeps the workflow blocked on the system step until a system is selected', async () => {
    const wrapper = mount(JsonSchemaWizardPage)
    await flushPromises()

    await wrapper.get('[data-testid="upload-intent-sample"]').trigger('click')
    await flushPromises()

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Assign the system')
    expect(wrapper.get('[data-testid="wizard-next"]').attributes('disabled')).toBeDefined()

    await chooseAppSelectOption(wrapper, 'schema-wizard-system', 'DarSysShopify')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(inferFromText).toHaveBeenCalledWith({
      jsonText: '{"orderId":"1001"}',
    })
    expect(wrapper.text()).toContain('Review the interpreted schema')
    expect(wrapper.text()).toContain('$.orderId')
  })

  it('says why the system step is unusable when no systems are configured', async () => {
    // A fresh install without the DarpanSystemSource seed data landed here with an empty dropdown,
    // a permanently disabled OK and no text at all -- indistinguishable from a broken page.
    listEnumOptions.mockResolvedValue({ options: [] })

    const wrapper = mount(JsonSchemaWizardPage)
    await flushPromises()

    await wrapper.get('[data-testid="upload-intent-sample"]').trigger('click')
    await flushPromises()

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Assign the system')
    expect(wrapper.get('[data-testid="wizard-next"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="schema-wizard-system-empty"]').text()).toContain('No systems are configured')
  })

  it('stays quiet about an empty system list while the options are still loading', async () => {
    const wrapper = mount(JsonSchemaWizardPage)

    expect(wrapper.find('[data-testid="schema-wizard-system-empty"]').exists()).toBe(false)

    await flushPromises()
    wrapper.unmount()
  })

  it('advances from the system step when Enter selects a highlighted system option', async () => {
    const wrapper = mount(JsonSchemaWizardPage)
    await flushPromises()

    await wrapper.get('[data-testid="upload-intent-sample"]').trigger('click')
    await flushPromises()

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Assign the system')

    await wrapper.get('[data-testid="schema-wizard-system"]').trigger('click')
    await wrapper
      .get('[data-testid="app-select-option"][data-option-value="DarSysShopify"]')
      .trigger('keydown.enter')
    await flushPromises()

    expect(inferFromText).toHaveBeenCalledWith({
      jsonText: '{"orderId":"1001"}',
    })
    expect(wrapper.text()).toContain('Review the interpreted schema')

    wrapper.unmount()
  })

  it('advances from the verify step when Enter is pressed from a required-field checkbox', async () => {
    const wrapper = mount(JsonSchemaWizardPage, {
      attachTo: document.body,
    })
    await flushPromises()

    await wrapper.get('[data-testid="upload-intent-sample"]').trigger('click')
    await flushPromises()

    const fileInput = wrapper.get('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [new File(['{"orderId":"1001"}'], 'orders.json', { type: 'application/json' })],
      configurable: true,
    })
    await fileInput.trigger('change')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    await chooseAppSelectOption(wrapper, 'schema-wizard-system', 'DarSysOms')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Review the interpreted schema')

    await wrapper.get('[data-testid="schema-verify-required-0"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toContain('Name the schema')

    wrapper.unmount()
  })
})
