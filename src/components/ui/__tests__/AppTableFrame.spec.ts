import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AppTableFrame from '../AppTableFrame.vue'

describe('AppTableFrame', () => {
  it('renders shared header slots, colgroup classes, row ids, and append rows', () => {
    const wrapper = mount(AppTableFrame, {
      props: {
        columns: [
          {
            key: 'recordId',
            label: 'Record ID',
            colClass: 'record-id-column',
            colStyle: { width: '16rem' },
            cellClass: 'record-id-cell',
          },
          { key: 'status', label: 'Status', headerAlign: 'end', colClass: 'status-column', cellClass: 'status-cell-wrap' },
        ],
        rows: [
          { recordId: '1001', status: 'Active' },
          { recordId: '1002', status: 'Pending' },
        ],
        rowTestId: 'app-table-row',
      },
      slots: {
        'cell-status': `<template #default="{ row, index }">
          <span class="status-cell">{{ index }}-{{ row.status }}</span>
        </template>`,
        'append-row': `<template #default="{ columnCount }">
          <tr class="append-row">
            <td :colspan="columnCount">Append action</td>
          </tr>
        </template>`,
      },
    })

    const headerSlots = wrapper.findAll('.app-table__header-slot')
    expect(headerSlots).toHaveLength(2)
    expect(headerSlots[0]?.text()).toBe('Record ID')
    expect(headerSlots[1]?.text()).toBe('Status')
    expect(headerSlots[1]?.classes()).toContain('app-table__header-slot--action')
    expect(wrapper.findAll('.app-table colgroup col')).toHaveLength(2)
    expect(wrapper.get('.app-table colgroup col').classes()).toContain('record-id-column')
    expect(wrapper.get('.app-table colgroup col').attributes('style')).toContain('width: 16rem;')
    expect(wrapper.findAll('tbody td')[0]?.classes()).toContain('record-id-cell')
    expect(wrapper.findAll('tbody td')[1]?.classes()).toContain('status-cell-wrap')
    expect(wrapper.findAll('[data-testid="app-table-row"]')).toHaveLength(2)

    const statusCells = wrapper.findAll('.status-cell')
    expect(statusCells[0]?.text()).toBe('0-Active')
    expect(statusCells[1]?.text()).toBe('1-Pending')
    expect(wrapper.get('.append-row td').attributes('colspan')).toBe('2')
    expect(wrapper.get('.append-row').text()).toBe('Append action')
  })

  it('falls back to stable generated row keys when the configured row key is missing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const wrapper = mount(AppTableFrame, {
        props: {
          columns: [{ key: 'name', label: 'Name' }],
          rows: [
            { name: 'Missing key one' },
            { name: 'Missing key two' },
          ],
          rowKey: 'id',
        },
      })

      expect(wrapper.findAll('tbody tr')).toHaveLength(2)
      expect(wrapper.text()).toContain('Missing key one')
      expect(wrapper.text()).toContain('Missing key two')
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Duplicate keys'))
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('emits row actions for labelled rows only', async () => {
    const wrapper = mount(AppTableFrame, {
      props: {
        columns: [{ key: 'name', label: 'Name' }],
        rows: [
          { id: 'linked', name: 'Linked row' },
          { id: 'plain', name: 'Plain row' },
        ],
        rowKey: 'id',
        rowTestId: 'app-table-row',
        rowActionLabel: (row) => (row.id === 'linked' ? 'Open linked row' : null),
      },
    })

    const rows = wrapper.findAll('[data-testid="app-table-row"]')
    expect(rows[0]?.attributes('role')).toBe('link')
    expect(rows[0]?.attributes('tabindex')).toBe('0')
    expect(rows[0]?.attributes('aria-label')).toBe('Open linked row')
    expect(rows[1]?.attributes('role')).toBeUndefined()

    await rows[0]?.trigger('click')
    await rows[1]?.trigger('click')

    expect(wrapper.emitted('rowAction')).toEqual([
      [{ row: { id: 'linked', name: 'Linked row' }, index: 0 }],
    ])
  })

  // DAR-UI-044: a row can expand in place into a full-width detail row directly beneath it.
  describe('row-detail', () => {
    const detailColumns = [{ key: 'id', label: 'Id' }, { key: 'name', label: 'Name' }]
    const detailRows = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }]

    it('renders a detail row only under the listed keys, in order, spanning every column', () => {
      const wrapper = mount(AppTableFrame, {
        props: { columns: detailColumns, rows: detailRows, rowKey: 'id', expandedRowKeys: ['b'] },
        slots: { 'row-detail': '<template #row-detail="{ row }"><p class="detail">detail {{ row.name }}</p></template>' },
      })
      const trs = wrapper.findAll('tbody tr')
      expect(trs.map((tr) => tr.classes().includes('app-table__detail-row'))).toEqual([false, false, true, false])
      const detail = trs.at(2)
      if (!detail) throw new Error('the detail row did not render')
      expect(detail.text()).toBe('detail B')
      expect(detail.get('td').attributes('colspan')).toBe('2')
    })

    it('renders exactly the old markup when nothing is expanded', () => {
      const plain = mount(AppTableFrame, { props: { columns: detailColumns, rows: detailRows, rowKey: 'id' } })
      const empty = mount(AppTableFrame, {
        props: { columns: detailColumns, rows: detailRows, rowKey: 'id', expandedRowKeys: [] },
        slots: { 'row-detail': '<p>x</p>' },
      })
      expect(empty.html()).toBe(plain.html())
    })
  })
})
