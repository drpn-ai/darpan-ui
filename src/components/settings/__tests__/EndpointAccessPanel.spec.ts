import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EndpointAccessPanel from '../EndpointAccessPanel.vue'
import { settingsFacade } from '../../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../../lib/sharedConfig'

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listSourceConfigEndpoints: vi.fn(),
    storeSourceConfigEndpointAccess: vi.fn(),
  },
}))

const endpoints = [
  { systemEnumId: 'OMS', endpointLabel: 'Orders API', isEnabled: true },
  { systemEnumId: 'OMS_RECON_ORDERS', endpointLabel: 'Reconciliation Orders API', isEnabled: true },
  { systemEnumId: 'OMS_RETURNS', endpointLabel: 'Reconciliation Returns API', isEnabled: false },
  { systemEnumId: 'OMS_TRANSFER_ORDERS', endpointLabel: 'Orders API (Transfer Orders)', isEnabled: true },
]

describe('EndpointAccessPanel', () => {
  beforeEach(() => {
    vi.mocked(settingsFacade.listSourceConfigEndpoints).mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints,
    })
  })

  it('renders one checkbox per registered endpoint, labelled from the registry', async () => {
    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'gorjana_prod', modelValue: [] },
    })
    await flushPromises()

    const labels = wrapper.findAll('.workflow-choice-label').map((n) => n.text())
    expect(labels).toEqual([
      'Orders API',
      'Reconciliation Orders API',
      'Reconciliation Returns API',
      'Orders API (Transfer Orders)',
    ])
  })

  it('seeds the model from the server state on first load', async () => {
    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'gorjana_prod', modelValue: [] },
    })
    await flushPromises()

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted?.at(-1)?.[0]).toEqual(['OMS', 'OMS_RECON_ORDERS', 'OMS_TRANSFER_ORDERS'])
  })

  it('emits the new set when an endpoint is ticked', async () => {
    const wrapper = mount(EndpointAccessPanel, {
      props: {
        configType: SHARED_CONFIG_TYPES.hotwaxOms,
        configId: 'gorjana_prod',
        modelValue: ['OMS', 'OMS_RECON_ORDERS', 'OMS_TRANSFER_ORDERS'],
      },
    })
    await flushPromises()

    await wrapper.find('input[data-testid="endpoint-OMS_RETURNS"]').setValue(true)

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)?.[0]).toContain('OMS_RETURNS')
    // The panel is read/emit only -- it must never write, even after a toggle. The parent form owns
    // persistence and only calls the write service on explicit Save.
    expect(settingsFacade.storeSourceConfigEndpointAccess).not.toHaveBeenCalled()
  })

  it('never calls the write service on its own', async () => {
    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'gorjana_prod', modelValue: [] },
    })
    await flushPromises()
    await wrapper.find('input[data-testid="endpoint-OMS_RETURNS"]').setValue(true)
    await wrapper.find('input[data-testid="endpoint-OMS"]').setValue(false)

    expect(settingsFacade.storeSourceConfigEndpointAccess).not.toHaveBeenCalled()
  })

  it('does not let a stale click made during an in-flight config switch clobber the new config', async () => {
    // Config A resolves immediately; config B's response is held open so we can act while it's
    // still in flight -- the exact window the clobber bug lived in.
    let resolveB!: (value: unknown) => void
    const pendingB = new Promise((resolve) => {
      resolveB = resolve
    })

    vi.mocked(settingsFacade.listSourceConfigEndpoints)
      .mockResolvedValueOnce({ ok: true, messages: [], errors: [], endpoints })
      .mockReturnValueOnce(pendingB as ReturnType<typeof settingsFacade.listSourceConfigEndpoints>)

    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'config_a', modelValue: [] },
    })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual([
      'OMS',
      'OMS_RECON_ORDERS',
      'OMS_TRANSFER_ORDERS',
    ])

    // Switch to config B while its load is still unresolved -- the instance survives, as it would
    // when a router reuses the same page across two different records' edit URLs.
    await wrapper.setProps({ configId: 'config_b' })

    // Try to click what would be a stale, config-A-scoped checkbox. If A's list is still rendered
    // (the bug), this is a real, clickable control the user could hit during the gap. If the fix
    // clears the rendered list synchronously on the identity change, this control won't exist and
    // the click is a no-op either way.
    const staleCheckbox = wrapper.find('input[data-testid="endpoint-OMS_RETURNS"]')
    if (staleCheckbox.exists()) {
      await staleCheckbox.setValue(true)
    }

    const endpointsB = [{ systemEnumId: 'NS_AUTH', endpointLabel: 'NetSuite Auth', isEnabled: true }]
    resolveB({ ok: true, messages: [], errors: [], endpoints: endpointsB })
    await flushPromises()

    // Whatever happened during the gap, the final state bound to config B must be config B's real
    // server state -- never a value built from config A's stale, in-flight-superseded endpoint list.
    expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual(['NS_AUTH'])
  })

  it('emits loading then ready on a successful load', async () => {
    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'gorjana_prod', modelValue: [] },
    })
    await flushPromises()

    expect(wrapper.emitted('update:loadState')?.map((call) => call[0])).toEqual(['loading', 'ready'])
  })

  it('emits loading then error when the fetch rejects, and never emits ready', async () => {
    vi.mocked(settingsFacade.listSourceConfigEndpoints).mockRejectedValue(new Error('network down'))

    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'gorjana_prod', modelValue: ['OMS'] },
    })
    await flushPromises()

    expect(wrapper.emitted('update:loadState')?.map((call) => call[0])).toEqual(['loading', 'error'])
    // A failed load must not silently discard whatever the parent already had.
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('says the seed data is missing rather than rendering an empty panel', async () => {
    vi.mocked(settingsFacade.listSourceConfigEndpoints).mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [],
    })
    const wrapper = mount(EndpointAccessPanel, {
      props: { configType: SHARED_CONFIG_TYPES.hotwaxOms, configId: 'gorjana_prod', modelValue: [] },
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="endpoint-access-empty"]').exists()).toBe(true)
  })
})
