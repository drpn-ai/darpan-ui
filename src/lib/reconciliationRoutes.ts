import type { HistoryState, LocationQuery, RouteLocationRaw } from 'vue-router'

export interface ReconciliationRunRouteContext {
  savedRunId: string
  runName: string
  file1SystemLabel: string
  file2SystemLabel: string
}

interface ReconciliationRouteObject {
  name: string
  params?: Record<string, string>
  query?: Record<string, string>
  state?: HistoryState
}

function buildReconciliationRunQuery(context: ReconciliationRunRouteContext): Record<string, string> {
  return {
    savedRunId: context.savedRunId,
    runName: context.runName,
    file1SystemLabel: context.file1SystemLabel,
    file2SystemLabel: context.file2SystemLabel,
  }
}

function withRouteState(route: ReconciliationRouteObject, state?: HistoryState): RouteLocationRaw {
  if (!state) return route
  return { ...route, state }
}

export function buildReconciliationDiffRoute(
  context: ReconciliationRunRouteContext,
  state?: HistoryState,
): RouteLocationRaw {
  return withRouteState(
    {
      name: 'reconciliation-diff',
      query: buildReconciliationRunQuery(context),
    },
    state,
  )
}

export function buildReconciliationRunHistoryRoute(context: ReconciliationRunRouteContext): RouteLocationRaw {
  return {
    name: 'reconciliation-run-history',
    params: {
      savedRunId: context.savedRunId,
    },
    query: {
      runName: context.runName,
      file1SystemLabel: context.file1SystemLabel,
      file2SystemLabel: context.file2SystemLabel,
    },
  }
}

export function buildReconciliationRunResultRoute(
  context: ReconciliationRunRouteContext,
  outputFileName: string,
): RouteLocationRaw {
  return {
    name: 'reconciliation-run-result',
    params: {
      savedRunId: context.savedRunId,
      outputFileName,
    },
    query: {
      runName: context.runName,
      file1SystemLabel: context.file1SystemLabel,
      file2SystemLabel: context.file2SystemLabel,
    },
  }
}

/**
 * DAR-UI-157 (Aditi: make the run-result URL short). A run's one address, live or finished: /runs/<savedRunId>/<runId>.
 * What the opener knows (the name, the systems, the result file when it has one) goes in history state, never the
 * address; the page reads a shared link's from the saved run and the run's status.
 */
export function buildReconciliationRunLiveRoute(
  context: ReconciliationRunRouteContext,
  reconciliationRunResultId: string,
  resultFileName = '',
): RouteLocationRaw {
  return {
    name: 'reconciliation-run-live',
    params: {
      savedRunId: context.savedRunId,
      runResultId: reconciliationRunResultId,
    },
    state: {
      runName: context.runName,
      file1SystemLabel: context.file1SystemLabel,
      file2SystemLabel: context.file2SystemLabel,
      ...(resultFileName ? { resultFileName } : {}),
    },
  }
}

/** A finished run's page: its short address when the run's id is known, else the long one (the page shortens it). */
export function buildReconciliationOutputRoute(
  context: ReconciliationRunRouteContext,
  output: { fileName: string, reconciliationRunResultId?: string | null },
): RouteLocationRaw {
  const runId = output.reconciliationRunResultId?.trim()
  return runId
    ? buildReconciliationRunLiveRoute(context, runId, output.fileName)
    : buildReconciliationRunResultRoute(context, output.fileName)
}

/** The query a run's short address keeps: the tenant and the way back, not what the page reads from the run. */
export function shortRunQuery(query: LocationQuery): Record<string, string> {
  return Object.fromEntries(['tenantId', 'fromLifecycle', 'fromLifecycleRun']
    .filter((key) => typeof query[key] === 'string' && query[key])
    .map((key) => [key, query[key] as string]))
}

/** DAR-UI-156. The Starting page of a run just submitted, before its run id is known. */
export function buildReconciliationRunStartingRoute(
  context: ReconciliationRunRouteContext,
  pendingRunId: string,
): RouteLocationRaw {
  return {
    name: 'reconciliation-run-starting',
    params: {
      savedRunId: context.savedRunId,
      pendingRunId,
    },
    query: {
      runName: context.runName,
      file1SystemLabel: context.file1SystemLabel,
      file2SystemLabel: context.file2SystemLabel,
    },
  }
}
