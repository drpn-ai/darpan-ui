import { beforeEach, describe, expect, it, vi } from 'vitest'

const testSourceConnection = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: { testSourceConnection },
}))

import { ApiCallError } from '../../../lib/api/client'
import { useConnectionDiagnostics } from '../useConnectionDiagnostics'

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

    resolveProbe({ ok: true, messages: [], errors: [], available: true, connectionOk: true, checks: [] })
    await pending

    expect(diagnostics.running.value).toBe(false)
  })

  it('carries the verdict and rows through from a successful call', async () => {
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: true,
      connectionOk: false,
      checks: [{ key: 'auth', label: 'Credentials accepted', status: 'FAIL', detail: '401' }],
    })

    const diagnostics = useConnectionDiagnostics('OMS')
    await diagnostics.run('cfg-2')

    expect(testSourceConnection).toHaveBeenCalledWith(
      { systemEnumId: 'OMS', configId: 'cfg-2' },
      expect.any(AbortSignal),
    )
    expect(diagnostics.available.value).toBe(true)
    expect(diagnostics.connectionOk.value).toBe(false)
    expect(diagnostics.checks.value).toHaveLength(1)
    expect(diagnostics.error.value).toBeNull()
  })

  it('reports a connector without diagnostics as unavailable', async () => {
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: false,
      connectionOk: false,
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
