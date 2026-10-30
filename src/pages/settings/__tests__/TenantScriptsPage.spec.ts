import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { TenantScript } from '../../../lib/api/scriptTypes'

const listTenantScripts = vi.hoisted(() => vi.fn())
const saveTenantScript = vi.hoisted(() => vi.fn())
const deleteTenantScript = vi.hoisted(() => vi.fn())
const runTenantScript = vi.hoisted(() => vi.fn())
const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

const listTenantScriptDeployments = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: { listTenantScripts, saveTenantScript, deleteTenantScript, runTenantScript, listTenantScriptDeployments },
  reconciliationFacade: { listGeneratedOutputs },
  settingsFacade: { listTenantChatSpaces },
}))
vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ sessionInfo: { userId: 'U1', activeTenantUserGroupId: 'KREWE', activeTenantLabel: 'Krewe' } }),
}))
vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))

import TenantScriptsPage from '../TenantScriptsPage.vue'

const script = (over: Partial<TenantScript> = {}): TenantScript => ({
  tenantScriptId: '100', scriptName: 'Tender mix', description: null, scriptProfile: 'SCRIPT', inputSource: 'SAMPLE',
  scriptBody: 'd:len(input.payments)', sampleInputJson: '{"payments":[1,2]}', isActive: true,
  createdByUserId: 'U1', createdDate: null, lastUpdatedDate: null, ...over,
})

const okRun = (result: unknown, over: Record<string, unknown> = {}) => ({
  run: { ok: true, profile: 'SCRIPT', result, units: 42, elapsedMs: 3, logs: [], error: null, ...over },
  inputSummary: { source: 'SAMPLE', characters: 18 },
})

async function mountPage() {
  const wrapper = mount(TenantScriptsPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('TenantScriptsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    document.body.replaceChildren()
    listTenantScripts.mockResolvedValue({
      scripts: [script()],
      library: [{ name: 'dec(x)', help: 'x as a decimal number' }],
      limits: { SCRIPT: { maxSourceChars: 64000, unitLimit: 2000000, timeoutMs: 2000 } },
    })
    listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [{ fileName: 'runs/r1.json', savedRunName: 'Daily orders', totalDifferences: 7 }] })
    listTenantScriptDeployments.mockResolvedValue({ deployments: [], timeZone: 'UTC' })
    listTenantChatSpaces.mockResolvedValue({ chatSpaces: [] })
  })

  it('shows the Deploy section for a saved script only', async () => {
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-new"]').trigger('click')
    expect(wrapper.find('[data-testid="script-deploy"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="script-deploy"]').exists()).toBe(true)
    expect(listTenantScriptDeployments).toHaveBeenCalledWith({ tenantScriptId: '100' })
  })

  it('lists the saved scripts and the d: library', async () => {
    const wrapper = await mountPage()
    const tiles = wrapper.findAll('[data-testid="script-tile"]')
    expect(tiles).toHaveLength(1)
    expect(tiles[0]!.text()).toContain('Tender mix')
    expect(tiles[0]!.text()).toContain('Script · Sample')
    expect(wrapper.find('[data-testid="script-library"]').text()).toContain('d:dec(x)')
  })

  it('runs an unsaved new script against its sample and shows the result', async () => {
    runTenantScript.mockResolvedValue(okRun({ paid: 50 }, { logs: ['hello'] }))
    const wrapper = await mountPage()
    await wrapper.find('[data-testid="script-new"]').trigger('click')
    expect((wrapper.find('[data-testid="script-body"]').element as HTMLTextAreaElement).value).toContain('input.payments')

    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()

    expect(runTenantScript).toHaveBeenCalledWith(expect.objectContaining({
      tenantScriptId: undefined, scriptProfile: 'SCRIPT', inputSource: 'SAMPLE', fileName: undefined,
    }))
    expect(runTenantScript.mock.calls[0]![0].inputJson).toContain('"orderId"')
    expect(wrapper.find('[data-testid="script-result-status"]').text()).toBe('Ran in 3 ms · 42 units')
    expect(wrapper.find('[data-testid="script-output"]').text()).toContain('"paid": 50')
    expect(wrapper.find('[data-testid="script-logs"]').text()).toContain('hello')
  })

  it('shows a script error with its line instead of a result', async () => {
    runTenantScript.mockResolvedValue(okRun(null, { ok: false, error: { kind: 'UNITS', message: 'The script used more than 2000000 units of work.', line: 3 } }))
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="script-result-status"]').text()).toContain('Stopped')
    expect(wrapper.find('[data-testid="script-result"]').text()).toContain('Line 3: The script used more than 2000000 units of work.')
  })

  it('saves an edit and reloads the list', async () => {
    saveTenantScript.mockResolvedValue({ script: script({ scriptName: 'Tender mix v2' }) })
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="script-name"]').setValue('Tender mix v2')
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(saveTenantScript).toHaveBeenCalledWith(expect.objectContaining({ tenantScriptId: '100', scriptName: 'Tender mix v2' }))
    expect(listTenantScripts).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="scripts-status"]').text()).toBe('Saved Tender mix v2.')
  })

  it('shows the backend refusal of a script that does not parse', async () => {
    saveTenantScript.mockRejectedValue(new ApiCallError('Line 2: parsing error'))
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="script-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="script-editor"]').text()).toContain('Line 2: parsing error')
  })

  it('asks for a run result before running a run-result script', async () => {
    listTenantScripts.mockResolvedValue({ scripts: [script({ inputSource: 'RUN_RESULT' })], library: [], limits: {} })
    const fresh = await mountPage()
    await fresh.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    await fresh.find('[data-testid="script-run"]').trigger('click')
    await flushPromises()
    expect(runTenantScript).not.toHaveBeenCalled()
    expect(fresh.find('[data-testid="script-editor"]').text()).toContain('Choose a run result for the script to read.')
  })

  it('deletes only on the second click', async () => {
    deleteTenantScript.mockResolvedValue({})
    const wrapper = await mountPage()
    await wrapper.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    await wrapper.find('[data-testid="script-delete"]').trigger('click')
    expect(deleteTenantScript).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="script-delete"]').text()).toBe('Confirm delete')
    await wrapper.find('[data-testid="script-delete"]').trigger('click')
    await flushPromises()
    expect(deleteTenantScript).toHaveBeenCalledWith({ tenantScriptId: '100' })
    expect(wrapper.find('[data-testid="script-editor"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="scripts-status"]').text()).toBe('Deleted Tender mix.')
  })

  it('a view-only member can read scripts but not write, run or save them', async () => {
    permissions.canEditTenantSettings = false
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="script-new"]').exists()).toBe(false)
    await wrapper.findAll('[data-testid="script-tile"]')[0]!.trigger('click')
    expect(wrapper.find('[data-testid="script-save"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="script-run"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="script-body"]').attributes('disabled')).toBeDefined()
  })
})
