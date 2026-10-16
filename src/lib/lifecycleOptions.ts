import type { LifecycleStageOption } from './api/flowchartTypes'

// DAR-UI-050. The lifecycle builder's dropdown options, from get#LifecycleOptions.

function dayWord(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

// Just the name (Aditi, 2026-10-16: "just Sales Order is fine ... same for invoice and fulfillments"). The data
// still decides which stages are offered, which are pre-chosen, and their order.
export function stageOptionLabel(stage: LifecycleStageOption): string {
  return stage.label
}

/** The chosen stages in the data's order (soonest first), whatever order they were clicked in. */
export function orderedStages(stages: LifecycleStageOption[], chosen: string[]): LifecycleStageOption[] {
  return stages.filter((s) => chosen.includes(s.recordType))
}

/** "Late after" is measured to the last stage, from the start record. The data still picks the default. */
export function lateAfterOptions(ordered: LifecycleStageOption[]): { value: string; label: string }[] {
  const last = ordered[ordered.length - 1]
  return (last?.coverage ?? []).map((c) => ({
    value: String(c.days),
    label: c.days === 0 ? 'Same day' : dayWord(c.days),
  }))
}

export function defaultLateAfter(ordered: LifecycleStageOption[]): string {
  const coverage = ordered[ordered.length - 1]?.coverage ?? []
  const pick = coverage.find((c) => c.percent >= 90) ?? coverage[coverage.length - 1]
  return pick ? String(pick.days) : ''
}
