import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EndpointAccessPanel from '../EndpointAccessPanel.vue'
import { settingsFacade } from '../../../lib/api/facade'
import { SHARED_CONFIG_TYPES } from '../../../lib/sharedConfig'

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: { listSourceConfigEndpoints: vi.fn() },
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
