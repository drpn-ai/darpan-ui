import { describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useRunSubmissionsStore, type RunSubmissionInput, type RunSubmissionOutcome } from '../runSubmissions'
import { useMascotStore } from '../mascot'

// DAR-UI-156. The submission behind the Starting page: the look for the run and the call itself race, and the first to
// answer says where the page goes. A late answer never moves it back, and a retried attempt owns the entry.

const context = { savedRunId: 'RS_1', runName: 'Orders', file1SystemLabel: 'HotWax', file2SystemLabel: 'Shopify' }

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

function input(submit: () => Promise<RunSubmissionOutcome>, register: (signal: AbortSignal) => Promise<string>): RunSubmissionInput {
  return { pendingRunId: 'P1', context, backRoute: '/back', backLabel: 'Back to setup', submit, register, reopen: () => {} }
}

describe('runSubmissions', () => {
  it('goes live when the run is found, and the call\'s later answer changes nothing', async () => {
    const store = useRunSubmissionsStore()
    const call = deferred<RunSubmissionOutcome>()
    store.start(input(() => call.promise, async () => '103112'))
    expect(store.get('P1')?.state).toEqual({ phase: 'starting' })
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'live', runResultId: '103112' })
    call.resolve({ error: 'late' })
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'live', runResultId: '103112' })
  })

  it('leads to the result when the call answers first, and stops looking', async () => {
    const store = useRunSubmissionsStore()
    let looked: AbortSignal | null = null
    store.start(input(async () => ({ route: '/result' }), (signal) => { looked = signal; return new Promise(() => {}) }))
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'done', route: '/result' })
    expect(looked!.aborted).toBe(true)
  })

  it('holds a refusal with its details, and Retry sends the same submission again', async () => {
    const store = useRunSubmissionsStore()
    let sent = 0
    const second = deferred<RunSubmissionOutcome>()
    const submit = () => (++sent === 1 ? Promise.resolve({ error: 'Schema validation failed', details: ['OMS: missing order_id'] }) : second.promise)
    store.start(input(submit, async () => ''))
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'failed', error: 'Schema validation failed', details: ['OMS: missing order_id'], retryable: true })

    store.retry('P1')
    expect(sent).toBe(2)
    expect(store.get('P1')?.state).toEqual({ phase: 'starting' })
    second.resolve({ route: '/result' })
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'done', route: '/result' })
  })

  it('lets no answer from an earlier attempt overwrite the retried one', async () => {
    const store = useRunSubmissionsStore()
    const first = deferred<string>()
    let sent = 0
    let looks = 0
    store.start(input(async () => (++sent === 1 ? { error: 'Read timed out' } : new Promise<RunSubmissionOutcome>(() => {})),
      () => (++looks === 1 ? first.promise : new Promise(() => {}))))
    await flushPromises()
    store.retry('P1')
    first.resolve('OLD_RUN')
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'starting' })
    expect(store.get('P1')?.attempt).toBe(2)
  })

  // A request that dropped after the run may have started: the look carries on, and only an empty look says it failed,
  // with no Retry (it could run twice).
  it('keeps looking after a dropped request, and offers no Retry if the run is never found', async () => {
    const store = useRunSubmissionsStore()
    const look = deferred<string>()
    store.start(input(async () => ({ lost: 'Darpan stepped out for chai.' }), () => look.promise))
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'starting' })
    look.resolve('')
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'failed', error: 'Darpan stepped out for chai.', details: [], retryable: false })
    store.retry('P1')
    expect(store.get('P1')?.attempt).toBe(1)
  })

  it('goes live when a dropped request\'s run is found', async () => {
    const store = useRunSubmissionsStore()
    const look = deferred<string>()
    store.start(input(async () => ({ lost: 'Darpan stepped out for chai.' }), () => look.promise))
    await flushPromises()
    look.resolve('103112')
    await flushPromises()
    expect(store.get('P1')?.state).toEqual({ phase: 'live', runResultId: '103112' })
  })

  it('reads a submit that rejects as a refusal, not a run starting forever', async () => {
    const store = useRunSubmissionsStore()
    store.start(input(() => Promise.reject(new Error('Read timed out')), async () => ''))
    await flushPromises()
    expect(store.get('P1')?.state).toMatchObject({ phase: 'failed', error: 'Read timed out' })
  })

  // Nobody is on the Starting page (the person left it): the mascot says so, with the way back to it.
  it('raises a refusal with no Starting page showing, and opens the page from it', async () => {
    const store = useRunSubmissionsStore()
    const call = deferred<RunSubmissionOutcome>()
    let reopened = 0
    store.start({ ...input(() => call.promise, async () => ''), reopen: () => { reopened += 1 } })
    store.watch('P1', false)
    call.resolve({ error: 'Schema validation failed' })
    await flushPromises()
    const [warning] = useMascotStore().warnings
    expect(warning).toMatchObject({ id: 'run-start-P1', prompt: 'Orders did not start.', body: 'Schema validation failed' })
    await warning!.actions[0]!.run()
    expect(reopened).toBe(1)
  })

  it('says nothing by the mascot while its Starting page shows, and finds a submission still starting', async () => {
    const store = useRunSubmissionsStore()
    store.start(input(async () => ({ error: 'Schema validation failed' }), async () => ''))
    expect(store.startingFor('RS_1')).toBe('P1')
    expect(store.startingFor('RS_2')).toBeNull()
    await flushPromises()
    expect(useMascotStore().warnings).toEqual([])
    expect(store.startingFor('RS_1')).toBeNull()
  })

  it('retries only a failed submission, and forgets one on request', async () => {
    const store = useRunSubmissionsStore()
    let sent = 0
    store.start(input(() => { sent += 1; return new Promise(() => {}) }, () => new Promise(() => {})))
    store.retry('P1')
    expect(sent).toBe(1)
    store.forget('P1')
    expect(store.get('P1')).toBeNull()
  })
})
