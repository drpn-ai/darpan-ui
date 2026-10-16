import type { RouteLocationRaw } from 'vue-router'
import { lifecycleIconPath, syncIconPath } from './iconPaths'
import { defaultWindowDays } from './flowchart/flowchartRunState'

/**
 * DAR-UI-049. Everything is a run; the type tells the two apart.
 *
 * Sync — a rule run on its own (`RuleSet`): do two systems hold the same records? Healthy is zero.
 * Lifecycle — a flowchart of questions (`Reconciliation`): where do records stall on their way
 * through? Never zero; the answer is a named finding per stall.
 *
 * The type is read from which entity a run is stored in, never stored on the run, so it cannot
 * drift from what the run actually is. (`SavedRunSummary.runType = 'ruleset'` is the backend's
 * storage kind, not this.)
 */
export type RunTypeId = 'sync' | 'lifecycle'

export interface RunTypeDefinition {
  id: RunTypeId
  label: string
  /** One line for the create flow's choice card. */
  description: string
  /** Stroked, 24-unit viewBox. */
  iconPath: string
  glossaryTerm: string
  createRoute: RouteLocationRaw
}

export const RUN_TYPES: Readonly<Record<RunTypeId, RunTypeDefinition>> = Object.freeze({
  sync: {
    id: 'sync',
    label: 'Sync',
    description: 'Do two systems hold the same records?',
    iconPath: syncIconPath,
    glossaryTerm: 'runTypeSync',
    createRoute: { name: 'reconciliation-create' },
  },
  lifecycle: {
    id: 'lifecycle',
    label: 'Lifecycle',
    description: 'Where do records stall on their way through?',
    iconPath: lifecycleIconPath,
    glossaryTerm: 'runTypeLifecycle',
    createRoute: { name: 'reconciliation-run-flowchart-create' },
  },
})

export const RUN_TYPE_ORDER: readonly RunTypeId[] = ['sync', 'lifecycle']

export function questionCountLabel(n: number): string {
  return n === 1 ? '1 question' : `${n} questions`
}

export function lookBackLabel(defaultTimeWindow?: string | null): string {
  const days = defaultWindowDays(defaultTimeWindow)
  return days === 1 ? 'previous day' : `last ${days} days`
}
