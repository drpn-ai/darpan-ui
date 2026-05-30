import type { HistoryState, RouteLocationRaw } from 'vue-router'

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
