import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  fullPath: '/settings/runs',
}))

const listSavedRuns = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRoute: () => route,
}))

vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    listSavedRuns,
  },
}))

import RunsSettingsPage from '../RunsSettingsPage.vue'

describe('RunsSettingsPage', () => {
  beforeEach(() => {
    route.fullPath = '/settings/runs'
    listSavedRuns.mockReset()
  })

  it('renders saved runs as dashboard tiles and routes mapping and ruleset rows to editor surfaces', async () => {
    listSavedRuns.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      savedRuns: [
        {
          savedRunId: 'OrderIdMap',
          runName: 'Order ID',
          description: 'Order ID',
          runType: 'mapping',
          reconciliationMappingId: 'OrderIdMap',
          requiresSystemSelection: false,
          defaultFile1SystemEnumId: 'OMS',
          defaultFile2SystemEnumId: 'SHOPIFY',
          systemOptions: [],
        },
        {
          savedRunId: 'RS_ORDER_CSV',
          runName: 'CSV Order Compare',
          description: 'CSV Order Compare',
          runType: 'ruleset',
          ruleSetId: 'RS_ORDER_CSV',
          compareScopeId: 'CS_ORDER_CSV',
          requiresSystemSelection: false,
          defaultFile1SystemEnumId: 'OMS',
          defaultFile2SystemEnumId: 'SHOPIFY',
          systemOptions: [
            {
              fileSide: 'FILE_1',
              enumId: 'OMS',
              label: 'OMS',
              fileTypeEnumId: 'DftCsv',
              idFieldExpression: 'order_id',
            },
            {
              fileSide: 'FILE_2',
              enumId: 'SHOPIFY',
              label: 'SHOPIFY',
              fileTypeEnumId: 'DftCsv',
              idFieldExpression: 'id',
            },
          ],
          rules: [
            {
              ruleId: 'RS_ORDER_CSV_RULE_1',
              sequenceNum: 1,
              file1FieldPath: 'total',
              file2FieldPath: 'current_total',
              operator: '=',
            },
          ],
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 2, pageCount: 1 },
    })

    const wrapper = mount(RunsSettingsPage)
    await flushPromises()

    const runTiles = wrapper.findAll('[data-testid="run-tile"]')
    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(runTiles).toHaveLength(2)
    expect(wrapper.get('[data-testid="saved-runs"]').classes()).toContain('static-page-record-grid')
    expect(wrapper.get('[data-testid="saved-runs"]').classes()).toContain('static-page-record-grid--fixed')
    expect(runTiles[0]?.text()).toBe('Order ID')
    expect(runTiles[1]?.text()).toBe('CSV Order Compare')
    expect(wrapper.find('h1').text()).toBe('Run Editor')
    expect(JSON.parse(runTiles[0]?.attributes('data-to') ?? '{}')).toEqual({
      name: 'settings-runs-edit',
      params: { reconciliationMappingId: 'OrderIdMap' }
    })
    expect(JSON.parse(runTiles[1]?.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-ruleset-manager',
    })
    expect(wrapper.find('[data-testid="runs-create-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="runs-empty-create-action"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Create Run')
  })

  it('does not offer creation when no runs exist because Run Editor is edit-only', async () => {
    listSavedRuns.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      savedRuns: [],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 0, pageCount: 1 },
    })

    const wrapper = mount(RunsSettingsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('No runs')
    expect(wrapper.find('[data-testid="runs-create-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="runs-empty-create-action"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Create Run')
  })

  it('does not render tenant labels on saved runs', async () => {
    listSavedRuns.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      savedRuns: [
        {
          savedRunId: 'RS_ORDER_CSV',
          runName: 'CSV Order Compare',
          description: 'CSV Order Compare',
          companyUserGroupId: 'KREWE',
          companyLabel: 'Krewe',
          runType: 'ruleset',
          ruleSetId: 'RS_ORDER_CSV',
          compareScopeId: 'CS_ORDER_CSV',
          requiresSystemSelection: false,
          defaultFile1SystemEnumId: 'OMS',
          defaultFile2SystemEnumId: 'SHOPIFY',
          systemOptions: [],
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(RunsSettingsPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="run-tile"]').text()).toBe('CSV Order Compare')
    expect(wrapper.text()).not.toContain('Krewe')
  })

  it('keeps the runs page on the shared static dashboard contract without page-local styling', () => {
    const pageSource = readFileSync('src/pages/settings/RunsSettingsPage.vue', 'utf8')
    const recordListSource = readFileSync('src/pages/settings/SettingsRecordListSection.vue', 'utf8')

    expect(pageSource).toContain('<StaticPageFrame>')
    expect(pageSource).toContain('<SettingsRecordListSection')
    expect(pageSource).toContain('title="Saved Runs"')
    expect(recordListSource).toContain('static-page-record-grid static-page-record-grid--fixed')
    expect(recordListSource).toContain('class="static-page-tile static-page-record-tile"')
    expect(pageSource).not.toContain('static-page-create-action')
    expect(pageSource).not.toContain('<style scoped>')
  })

  it('shows the last visit\'s list at once on a revisit, before the network answers (DAR-UI-051)', async () => {
    listSavedRuns.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      savedRuns: [{ savedRunId: 'RS_ORDER_CSV', runName: 'CSV Order Compare', description: 'CSV Order Compare', runType: 'ruleset', ruleSetId: 'RS_ORDER_CSV', compareScopeId: 'CS_ORDER_CSV', requiresSystemSelection: false, systemOptions: [] }],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })
    mount(RunsSettingsPage).unmount()
    await flushPromises()

    listSavedRuns.mockReturnValue(new Promise(() => {}))
    const revisit = mount(RunsSettingsPage)
    await flushPromises()

    expect(revisit.get('[data-testid="run-tile"]').text()).toBe('CSV Order Compare')
    expect(revisit.text()).not.toContain('Loading runs')
  })
})
