import { reconciliationFacade } from './api/facade'

// How long to keep looking for the submitted run's backend row before giving up and simply
// awaiting the submission. RESOLVE registers the row in its own committed transaction almost
// immediately, and each look is one indexed read (DAR-BE-146), so looking often is cheap.
const RUN_REGISTRATION_POLL_INTERVAL_MS = 250
const RUN_REGISTRATION_POLL_ATTEMPTS = 40

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

/**
 * Poll for the run a submission just registered and return its run-result id, or '' when
 * none appears in time. Never throws: a failed look just means "not yet", and the caller falls
 * back to awaiting the submission itself. run#SavedRunDiff answers only when its run ends, so
 * this is how Run (and Retry) open the live view of a run that is still going.
 */
export async function pollForRegisteredRunResultId(savedRunId: string, signal: AbortSignal): Promise<string> {
  for (let attempt = 0; attempt < RUN_REGISTRATION_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(RUN_REGISTRATION_POLL_INTERVAL_MS, signal)
    if (signal.aborted) return ''

    try {
      // The server leaves out a run that began before the last two minutes, by its own clock.
      const response = await reconciliationFacade.getActiveRunResult({ savedRunId }, signal)
      if (response.reconciliationRunResultId) return response.reconciliationRunResultId
    } catch {
      // Transient lookup failure — try again on the next tick.
    }
  }
  return ''
}
