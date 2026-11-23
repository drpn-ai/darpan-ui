import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { TenantQuery } from '../../../lib/api/scriptTypes'

const listTenantQueries = vi.hoisted(() => vi.fn())
const saveTenantQueryPins = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('../../../lib/api/facade', () => ({
  scriptFacade: { listTenantQueries, saveTenantQueryPins },
}))
vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))
vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    RouterLink: defineComponent({
      props: { to: { type: [String, Object], required: true } },
      setup(props, { slots }) {
        return () => h('a', { 'data-to': JSON.stringify(props.to) }, slots.default?.())
      },
    }),
  }
})

import TenantScriptsPage from '../TenantScriptsPage.vue'

const read = (source: string) => JSON.stringify({ inputs: [{ name: 'rows', source }] })

const query = (tenantQueryId: string, queryName: string, readSpecJson: string | null): TenantQuery => ({
  tenantQueryId, queryName, description: null, readSpecJson, readText: null, scriptBody: "'x'", sampleInputJson: null,
  isActive: true, ownerUserId: 'U1',
})

const QUERIES = [
  query('100', 'Open findings', read('auditFindings')),
  query('200', 'Unmatched orders', read('runResult')),
  query('300', 'Open backorders', read('dataset')),
  query('400', 'Refund total', null),
  query('500', 'Broken read', '{not json'),
  query('600', 'Late payments', read('dataset')),
]

async function mountPage() {
  const wrapper = mount(TenantScriptsPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const tileNames = (wrapper: VueWrapper, testid: string) =>
  wrapper.find(`[data-testid="${testid}"]`).findAll('.static-page-tile').map((tile) => tile.text())

const sectionTitles = (wrapper: VueWrapper) => wrapper.findAll('.static-page-section-heading').map((title) => title.text())

async function drop(wrapper: VueWrapper, testid: string, tenantQueryId: string) {
  const dataTransfer = { getData: () => tenantQueryId }
  await wrapper.find(`[data-testid="${testid}"]`).trigger('drop', { dataTransfer })
  await flushPromises()
}

describe('TenantScriptsPage (/queries)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    permissions.canEditTenantSettings = true
    document.body.replaceChildren()
    listTenantQueries.mockResolvedValue({ queries: QUERIES, library: [], limits: {}, pinnedQueryIds: ['600', '200'] })
    saveTenantQueryPins.mockImplementation(async ({ pinnedQueryIds }: { pinnedQueryIds: string[] }) => ({ pinnedQueryIds }))
  })

  it('shows the pins in pin order, name only', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('h1').text()).toBe('Queries')
    expect(tileNames(wrapper, 'pinned-queries')).toEqual(['Late payments', 'Unmatched orders'])
    expect(wrapper.find('[data-testid="pinned-empty-state"]').exists()).toBe(false)
  })

  it('offers the drop hint when nothing is pinned, and drops pins of deleted queries', async () => {
    listTenantQueries.mockResolvedValue({ queries: QUERIES, library: [], limits: {}, pinnedQueryIds: ['999'] })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="pinned-empty-state"]').text()).toBe('drag and drop queries to pin')
  })

  it('groups the rest by what they read, script only last, and hides an empty group', async () => {
    const wrapper = await mountPage()
    expect(tileNames(wrapper, 'query-group-audit-findings')).toEqual(['Open findings'])
    expect(tileNames(wrapper, 'query-group-kept-records')).toEqual(['Open backorders'])
    expect(tileNames(wrapper, 'query-group-script-only')).toEqual(['Refund total', 'Broken read'])
    // Unmatched orders is the only run-result query and it is pinned.
    expect(wrapper.find('[data-testid="query-group-run-results"]').exists()).toBe(false)
    expect(sectionTitles(wrapper)).toEqual(['Pinned Queries', 'Audit findings', 'Kept records', 'Script only'])
  })

  it('links each tile to its query', async () => {
    const wrapper = await mountPage()
    const tile = wrapper.find('[data-query-id="100"]')
    expect(JSON.parse(tile.attributes('data-to')!)).toEqual({ name: 'settings-tenant-script', params: { tenantScriptId: '100' } })
    expect(tile.attributes('draggable')).toBe('true')
  })

  it('pins a query dropped on Pinned Queries at the end, and unpins one dropped on a group', async () => {
    const wrapper = await mountPage()
    await drop(wrapper, 'pinned-queries', '100')
    expect(saveTenantQueryPins).toHaveBeenLastCalledWith({ pinnedQueryIds: ['600', '200', '100'] })
    expect(tileNames(wrapper, 'pinned-queries')).toEqual(['Late payments', 'Unmatched orders', 'Open findings'])
    expect(wrapper.find('[data-testid="query-group-audit-findings"]').exists()).toBe(false)

    await drop(wrapper, 'query-group-kept-records', '600')
    expect(saveTenantQueryPins).toHaveBeenLastCalledWith({ pinnedQueryIds: ['200', '100'] })
    expect(tileNames(wrapper, 'query-group-kept-records')).toEqual(['Open backorders', 'Late payments'])
  })

  it('ignores a drop that is not one of the queries', async () => {
    const wrapper = await mountPage()
    await drop(wrapper, 'pinned-queries', 'saved-run:100')
    expect(saveTenantQueryPins).not.toHaveBeenCalled()
  })

  it('puts the pins back when the save fails', async () => {
    saveTenantQueryPins.mockRejectedValue(new Error('down'))
    const wrapper = await mountPage()
    await drop(wrapper, 'pinned-queries', '100')
    expect(saveTenantQueryPins).toHaveBeenCalledWith({ pinnedQueryIds: ['600', '200', '100'] })
    expect(tileNames(wrapper, 'pinned-queries')).toEqual(['Late payments', 'Unmatched orders'])
    expect(tileNames(wrapper, 'query-group-audit-findings')).toEqual(['Open findings'])
  })

  it('offers New Query to editors only; viewers still pin', async () => {
    const wrapper = await mountPage()
    const create = wrapper.find('[data-testid="query-new"]')
    expect(create.text()).toBe('New Query')
    expect(JSON.parse(create.attributes('data-to')!)).toEqual({ name: 'settings-tenant-script-new' })

    permissions.canEditTenantSettings = false
    const viewer = await mountPage()
    expect(viewer.find('[data-testid="query-new"]').exists()).toBe(false)
    await drop(viewer, 'pinned-queries', '100')
    expect(saveTenantQueryPins).toHaveBeenLastCalledWith({ pinnedQueryIds: ['600', '200', '100'] })
  })

  it('says so when there are no queries', async () => {
    listTenantQueries.mockResolvedValue({ queries: [], library: [], limits: {} })
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="queries-empty"]').text()).toBe('No queries yet.')
    expect(wrapper.find('[data-testid="pinned-queries"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="query-new"]').exists()).toBe(true)
  })

  it('shows the load error', async () => {
    listTenantQueries.mockRejectedValue(new Error('Not allowed'))
    const wrapper = await mountPage()
    expect(wrapper.text()).toContain('Not allowed')
    expect(wrapper.find('[data-testid="pinned-queries"]').exists()).toBe(false)
  })
})
