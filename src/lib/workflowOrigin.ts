import type { HistoryState } from 'vue-router'

// The workflow origin itself lives in stores/reconciliationDraft.ts. These are the pure helpers: the payload a
// route's history state carries (state cannot hold reactive store refs) and a static page's label.

// Keys used when embedding workflow-origin data in Vue Router history state.
export const WORKFLOW_ORIGIN_LABEL_KEY = 'workflowOriginLabel'
export const WORKFLOW_ORIGIN_PATH_KEY = 'workflowOriginPath'
export const WORKFLOW_ORIGIN_ROUTE_STATE_KEY = 'workflowOriginRouteState'

/**
 * Build a plain-object payload suitable for spreading into a Vue Router `state`
 * option.  The caller may include additional route state keys via `routeState`.
 */
export function buildWorkflowOriginState(
  label: string,
  path: string,
  routeState?: HistoryState,
): HistoryState {
  const payload: HistoryState = {
    [WORKFLOW_ORIGIN_LABEL_KEY]: label,
    [WORKFLOW_ORIGIN_PATH_KEY]: path,
  }
  if (routeState !== undefined) {
    payload[WORKFLOW_ORIGIN_ROUTE_STATE_KEY] = routeState
  }
  return payload
}

export function resolveStaticPageLabel(routeLike: { meta?: { surfaceMode?: unknown; staticPageLabel?: unknown } | null }): string | null {
  if (routeLike?.meta?.surfaceMode === 'workflow') return null
  const label = routeLike?.meta?.staticPageLabel
  return typeof label === 'string' && label.trim().length > 0 ? label.trim() : null
}
