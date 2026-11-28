import { describe, expect, it } from 'vitest'
import { rankCommandActions } from '../commandSearch'
import {
  buildGeneratedOutputCommandActions,
  buildSftpServerCommandActions,
} from '../commandDataSearch'
import type { GeneratedOutput, SftpServerRecord } from '../api/types'

describe('command data search actions', () => {
  it('builds SFTP edit actions that stay hidden until the user searches', () => {
    const actions = buildSftpServerCommandActions([
      {
        sftpServerId: 'warehouse/drop-ship',
        description: 'Warehouse Dropship',
        host: 'sftp.example.com',
        port: 22,
        username: 'orders',
        remoteAttributes: 'Y',
        hasPassword: true,
        hasPrivateKey: false,
      } satisfies SftpServerRecord,
    ])

    expect(actions).toEqual([
      expect.objectContaining({
        id: 'data-sftp-server-warehouse-drop-ship',
        label: 'Edit SFTP: Warehouse Dropship',
        group: 'Data',
        to: '/settings/sftp/edit/warehouse%2Fdrop-ship',
        requiresQuery: true,
      }),
    ])
    expect(rankCommandActions(actions, '')).toEqual([])
    expect(rankCommandActions(actions, 'edit dropship sftp')[0]?.id).toBe('data-sftp-server-warehouse-drop-ship')
  })

  it('builds run-result actions with direct result routes and query labels', () => {
    const actions = buildGeneratedOutputCommandActions([
      {
        fileName: 'Order-Match-diff-20260424.json',
        sourceFormat: 'json',
        availableFormats: ['json', 'csv'],
        savedRunId: 'RS_ORDER_MATCH',
        savedRunName: 'Order Match',
        file1Label: 'OMS',
        file2Label: 'Shopify',
        totalDifferences: 12,
      } satisfies GeneratedOutput,
    ])

    expect(actions).toEqual([
      expect.objectContaining({
        id: 'data-run-result-rs-order-match-order-match-diff-20260424-json',
        label: 'Open Result: Order Match',
        description: '12 differences for OMS and Shopify.',
        group: 'Data',
        requiresQuery: true,
      }),
    ])
    // DAR-OPS-029 S99-126: the result route by name, not a hand-built URL; the router encodes it.
    expect(actions[0]?.to).toEqual({
      name: 'reconciliation-run-result',
      params: { savedRunId: 'RS_ORDER_MATCH', outputFileName: 'Order-Match-diff-20260424.json' },
      query: { runName: 'Order Match', file1SystemLabel: 'OMS', file2SystemLabel: 'Shopify' },
    })
    expect(rankCommandActions(actions, 'order result')[0]?.id).toBe(
      'data-run-result-rs-order-match-order-match-diff-20260424-json',
    )
  })
})
