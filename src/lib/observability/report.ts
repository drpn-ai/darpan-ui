export interface ErrorContext {
  source?: string
  method?: string
  [key: string]: unknown
}

export interface ErrorReport {
  message: string
  /** Error class name for Error instances, otherwise the typeof of the thrown value. */
  kind: string
  stack?: string
  /** Route path (location.pathname) at capture time, when a window exists. */
  route?: string
  /** Build version, when the build injects VITE_APP_VERSION; omitted otherwise. */
  appVersion?: string
  context?: ErrorContext
  firstSeenAt: string
  /** How many times this same error signature was reported within the dedupe window. */
  count: number
}

const MAX_STACK_CHARS = 2000
const MAX_BUFFERED_REPORTS = 25
const DEDUPE_WINDOW_MS = 30_000

// Single error sink for the SPA (app.config.errorHandler, window 'error'/'unhandledrejection',
// AppErrorBoundary, and any manual call sites). The backend facade (src/lib/api/facade.ts) exposes
// no client-log service and no beacon target exists, so the sink is deliberately console.error plus
// a small in-memory ring buffer readable via getBufferedErrorReports() for support/debug sessions.
// When a backend log endpoint lands, this module is the one place it plugs in. Never throws.
const buffer: ErrorReport[] = []
const recentBySignature = new Map<string, { report: ErrorReport; lastSeenAtMs: number }>()

function describe(error: unknown): { message: string; kind: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      kind: error.name || 'Error',
      stack: typeof error.stack === 'string' ? error.stack.slice(0, MAX_STACK_CHARS) : undefined,
    }
  }
  if (typeof error === 'string') return { message: error, kind: 'string' }
  let message: string
  try {
    message = JSON.stringify(error) ?? String(error)
  } catch {
    message = String(error)
  }
  return { message, kind: typeof error }
}

function currentRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.location.pathname
  } catch {
    return undefined
  }
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    const { message, kind, stack } = describe(error)
    const route = currentRoute()
    const now = Date.now()

    const signature = `${kind}|${message}|${route ?? ''}`
    const recent = recentBySignature.get(signature)
    if (recent && now - recent.lastSeenAtMs < DEDUPE_WINDOW_MS) {
      // Same error signature inside the dedupe window: bump the buffered report, skip the console
      // so a render-loop crash cannot flood the console or evict older reports from the buffer.
      recent.report.count += 1
      recent.lastSeenAtMs = now
      return
    }

    const report: ErrorReport = {
      message,
      kind,
      ...(stack ? { stack } : {}),
      ...(route ? { route } : {}),
      ...(import.meta.env.VITE_APP_VERSION ? { appVersion: import.meta.env.VITE_APP_VERSION } : {}),
      ...(Object.keys(context).length > 0 ? { context } : {}),
      firstSeenAt: new Date(now).toISOString(),
      count: 1,
    }

    recentBySignature.set(signature, { report, lastSeenAtMs: now })
    buffer.push(report)
    if (buffer.length > MAX_BUFFERED_REPORTS) buffer.shift()

    console.error('[darpan] captured error', { error, ...context }, report)
  } catch {
    /* reporting must never throw */
  }
}

/** Recent error reports (oldest first, capped) for support/debug use. */
export function getBufferedErrorReports(): readonly ErrorReport[] {
  return buffer.slice()
}

/** Clears the buffer and dedupe state; for tests and support sessions. */
export function resetErrorReporting(): void {
  buffer.length = 0
  recentBySignature.clear()
}
