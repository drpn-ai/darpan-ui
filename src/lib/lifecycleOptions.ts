import type { LifecycleStageOption, LifecycleStageReach } from './api/flowchartTypes'

// DAR-UI-050. The lifecycle builder's dropdown options, from get#LifecycleOptions.

function dayWord(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

/** The chosen stages in the data's order (soonest first), whatever order they were clicked in. */
export function orderedStages(stages: LifecycleStageOption[], chosen: string[]): LifecycleStageOption[] {
  return stages.filter((s) => chosen.includes(s.recordType))
}

/** DAR-UI-052. How each chosen stage found by a shared field is reached, as save#Lifecycle takes it; linked stages say nothing. */
export function stageReach(ordered: LifecycleStageOption[]): LifecycleStageReach[] {
  return ordered.flatMap((s) => (s.reach ? [{ recordType: s.recordType, startField: s.reach.startField, stageField: s.reach.stageField }] : []))
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
