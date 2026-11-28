import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearRecentCommands, listRecentCommandIds, recordRecentCommand, rankCommandActions } from '../commandSearch'
import type { CommandAction } from '../types/ux'

const storageState = vi.hoisted(() => new Map<string, string>())

const actions: CommandAction[] = [
  {
    id: 'navigate-ai-settings',
    label: 'Open AI Settings',
    description: 'Manage providers, models, and API keys.',
    group: 'Navigate',
    to: '/settings/ai',
    aliases: ['ai', 'llm', 'openai', 'gemini', 'api key', 'model settings', 'change api key'],
  },
  {
    id: 'navigate-schema-library',
    label: 'Open Schema Library',
    description: 'Upload, review, and manage saved schemas.',
    group: 'Navigate',
    to: '/schemas/library',
    aliases: ['schema', 'schemas', 'upload schema', 'json schema', 'field map', 'data shape'],
  },
  {
    id: 'navigate-netsuite-settings',
    label: 'Open NetSuite Settings',
    description: 'Manage NetSuite auth profiles.',
    group: 'Navigate',
    to: '/settings/netsuite',
    aliases: ['netsuite', 'endpoint', 'api url', 'timeout', 'settings', 'auth', 'credentials', 'oauth'],
  },
  {
    id: 'navigate-runs-settings',
    label: 'Open Runs Settings',
    description: 'Review saved runs and reopen one for edit.',
    group: 'Navigate',
    to: '/settings/runs',
    aliases: ['runs', 'run settings', 'saved runs', 'edit run', 'mapping settings', 'reconciliation settings'],
  },
  {
    id: 'navigate-run-reconciliation',
    label: 'Run Reconciliation',
    description: 'Compare two files or datasets and review the result.',
    group: 'Navigate',
    to: '/reconciliation/diff',
    aliases: ['compare files', 'compare data', 'match records', 'reconcile data', 'run comparison', 'execute', 'diff', 'customer'],
  },
]

describe('rankCommandActions', () => {
  it('prefers exact alias matches over weaker field matches', () => {
    const ranked = rankCommandActions(actions, 'openai')

    expect(ranked.map((action) => action.id)).toEqual(['navigate-ai-settings'])
  })

  it('supports natural-language queries by ignoring filler words', () => {
    const ranked = rankCommandActions(actions, 'where do i change my open ai key')

    expect(ranked[0]?.id).toBe('navigate-ai-settings')
  })

  it('tolerates small typos when the intended destination is otherwise clear', () => {
    const ranked = rankCommandActions(actions, 'scheema uplod')

    expect(ranked[0]?.id).toBe('navigate-schema-library')
  })

  it('keeps comparison search discoverable without surfacing legacy wording in the label', () => {
    const ranked = rankCommandActions(actions, 'compare files')

    expect(ranked[0]?.id).toBe('navigate-run-reconciliation')
  })

  it('surfaces the dedicated runs settings page for edit-oriented run queries', () => {
    const ranked = rankCommandActions(actions, 'edit run settings')

    expect(ranked[0]?.id).toBe('navigate-runs-settings')
  })

  it('boosts recently used commands when the textual match is otherwise tied', () => {
    const ranked = rankCommandActions(actions, 'settings', ['navigate-netsuite-settings'])

    expect(ranked[0]?.id).toBe('navigate-netsuite-settings')
    expect(ranked[1]?.id).toBe('navigate-ai-settings')
  })

  it('omits query-only data actions until the user types a query', () => {
    const dataAction: CommandAction = {
      id: 'data-sftp-server-warehouse',
      label: 'Edit SFTP: Warehouse',
      description: 'Open the SFTP server editor.',
      group: 'Data',
      to: '/settings/sftp/edit/warehouse',
      aliases: ['warehouse', 'sftp server', 'edit sftp'],
      requiresQuery: true,
    }

    expect(rankCommandActions([...actions, dataAction], '').map((action) => action.id)).not.toContain(dataAction.id)
    expect(rankCommandActions([...actions, dataAction], 'edit warehouse sftp')[0]?.id).toBe(dataAction.id)
  })
})

describe('recent command storage', () => {
  beforeEach(() => {
    storageState.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storageState.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storageState.set(key, value)
      },
      removeItem: (key: string) => {
        storageState.delete(key)
      },
      clear: () => {
        storageState.clear()
      },
    })
  })

  it('stores the most recent command first without duplicates', () => {
    recordRecentCommand('navigate-ai-settings')
    recordRecentCommand('navigate-run-reconciliation')
    recordRecentCommand('navigate-ai-settings')

    expect(listRecentCommandIds()).toEqual(['navigate-ai-settings', 'navigate-run-reconciliation'])
  })

  // App records a command before it navigates, so a throw here would leave the palette going nowhere.
  it('a storage that refuses writes (quota, private mode) still answers the new order and never throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError') },
      removeItem: () => {},
      clear: () => {},
    })
    expect(() => recordRecentCommand('navigate-hub')).not.toThrow()
    expect(recordRecentCommand('navigate-hub')).toEqual(['navigate-hub'])
  })

  it('clears the history on sign-out and tenant switch', () => {
    recordRecentCommand('navigate-hub')
    clearRecentCommands()
    expect(listRecentCommandIds()).toEqual([])
  })

  it('caps the stored recent history to a small bounded list', () => {
    recordRecentCommand('one')
    recordRecentCommand('two')
    recordRecentCommand('three')
    recordRecentCommand('four')
    recordRecentCommand('five')
    recordRecentCommand('six')

    expect(listRecentCommandIds()).toEqual(['six', 'five', 'four', 'three', 'two'])
  })
})
