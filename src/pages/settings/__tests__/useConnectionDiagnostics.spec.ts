import { beforeEach, describe, expect, it, vi } from 'vitest'

const testSourceConnection = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: { testSourceConnection },
}))

import { ApiCallError } from '../../../lib/api/client'
import { useConnectionDiagnostics } from '../useConnectionDiagnostics'

function row(key: string, status: 'PASS' | 'FAIL' | 'SKIP') {
  return { key, label: key, status }
}

function stageResponse(checks: ReturnType<typeof row>[], nextStage: string | null) {
  return { ok: true, messages: [], errors: [], available: true, connectionOk: true, nextStage, checks }
}

describe('useConnectionDiagnostics', () => {
  beforeEach(() => {
    testSourceConnection.mockReset()
  })

  it('opens immediately and reports running before the probe resolves', async () => {
    let resolveProbe: (value: unknown) => void = () => {}
    testSourceConnection.mockReturnValue(new Promise((resolve) => { resolveProbe = resolve }))

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    const pending = diagnostics.run('cfg-1')

    // The popup must appear at once — a probe can take a second or two.
    expect(diagnostics.open.value).toBe(true)
    expect(diagnostics.running.value).toBe(true)

    resolveProbe(stageResponse([], null))
    await pending

    expect(diagnostics.running.value).toBe(false)
  })

  it('walks the stages the server names and accumulates their rows', async () => {
    // The server owns the sequence; this must not hardcode any connector's stage names.
    testSourceConnection
      .mockResolvedValueOnce(stageResponse([row('credential', 'PASS')], 'connect'))
      .mockResolvedValueOnce(stageResponse([row('reachable', 'PASS'), row('apiVersion', 'PASS')], 'orders'))
      .mockResolvedValueOnce(stageResponse([row('ordersRead', 'PASS')], null))

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    await diagnostics.run('cfg-2')

    expect(testSourceConnection).toHaveBeenCalledTimes(3)
    // First call opts into staging; later calls pass the stage the server asked for.
    const payloads = testSourceConnection.mock.calls.map((call: unknown[]) => call[0])
    expect(payloads).toEqual([
      { systemEnumId: 'SHOPIFY', configId: 'cfg-2', staged: true },
      { systemEnumId: 'SHOPIFY', configId: 'cfg-2', stage: 'connect' },
      { systemEnumId: 'SHOPIFY', configId: 'cfg-2', stage: 'orders' },
    ])

    expect(diagnostics.checks.value.map((c) => c.key)).toEqual([
      'credential', 'reachable', 'apiVersion', 'ordersRead',
    ])
    expect(diagnostics.connectionOk.value).toBe(true)
    expect(diagnostics.error.value).toBeNull()
  })

  it('stops walking when the server ends the run early', async () => {
    // A terminal failure returns its skip rows and no next stage — asking again would be wrong.
    testSourceConnection.mockResolvedValueOnce(
      stageResponse([row('credential', 'FAIL'), row('reachable', 'SKIP')], null),
    )

    const diagnostics = useConnectionDiagnostics('OMS')
    await diagnostics.run('cfg-3')

    expect(testSourceConnection).toHaveBeenCalledTimes(1)
    expect(diagnostics.connectionOk.value).toBe(false)
    expect(diagnostics.checks.value).toHaveLength(2)
  })

  it('exposes rows from finished stages while later ones are still running', async () => {
    let releaseSecond: (value: unknown) => void = () => {}
    testSourceConnection
      .mockResolvedValueOnce(stageResponse([row('credential', 'PASS')], 'connect'))
      .mockReturnValueOnce(new Promise((resolve) => { releaseSecond = resolve }))

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    const pending = diagnostics.run('cfg-4')
    await Promise.resolve()
    await Promise.resolve()

    // The point of staging: stage one is on screen before stage two answers.
    expect(diagnostics.checks.value.map((c) => c.key)).toEqual(['credential'])
    expect(diagnostics.running.value).toBe(true)

    releaseSecond(stageResponse([row('reachable', 'PASS')], null))
    await pending
    expect(diagnostics.checks.value).toHaveLength(2)
    expect(diagnostics.running.value).toBe(false)
  })

  it('reports a connector without diagnostics as unavailable', async () => {
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: false,
      connectionOk: false,
      nextStage: null,
      checks: [],
    })

    const diagnostics = useConnectionDiagnostics('NETSUITE')
    await diagnostics.run('cfg-3')

    expect(diagnostics.available.value).toBe(false)
    expect(diagnostics.error.value).toBeNull()
  })

  it('surfaces a refused call as an error', async () => {
    testSourceConnection.mockRejectedValue(new ApiCallError('Your active tenant is read-only for this action.', 200))

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    await diagnostics.run('cfg-4')

    expect(diagnostics.error.value).toBe('Your active tenant is read-only for this action.')
    expect(diagnostics.running.value).toBe(false)
  })

  it('aborts an in-flight probe when the popup is closed', async () => {
    let capturedSignal: AbortSignal | undefined
    testSourceConnection.mockImplementation((_payload: unknown, signal: AbortSignal) => {
      capturedSignal = signal
      return new Promise(() => {})
    })

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    void diagnostics.run('cfg-5')
    expect(capturedSignal?.aborted).toBe(false)

    diagnostics.close()

    expect(capturedSignal?.aborted).toBe(true)
    expect(diagnostics.open.value).toBe(false)
    expect(diagnostics.running.value).toBe(false)
  })

  it('aborts an in-flight probe on dispose, so navigating away cancels it', async () => {
    let capturedSignal: AbortSignal | undefined
    testSourceConnection.mockImplementation((_payload: unknown, signal: AbortSignal) => {
      capturedSignal = signal
      return new Promise(() => {})
    })

    const diagnostics = useConnectionDiagnostics('OMS')
    void diagnostics.run('cfg-6')
    diagnostics.dispose()

    expect(capturedSignal?.aborted).toBe(true)
  })

  it('does not surface an abort as an error', async () => {
    testSourceConnection.mockRejectedValue(
      Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }),
    )

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    await diagnostics.run('cfg-7')

    // A cancelled probe is not a failed one — showing an error here would be a phantom failure.
    expect(diagnostics.error.value).toBeNull()
  })

  it('ignores a second run while one is already in flight', async () => {
    testSourceConnection.mockImplementation(() => new Promise(() => {}))

    const diagnostics = useConnectionDiagnostics('SHOPIFY')
    void diagnostics.run('cfg-8')
    void diagnostics.run('cfg-8')

    expect(testSourceConnection).toHaveBeenCalledTimes(1)
  })
})
