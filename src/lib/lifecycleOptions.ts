import type { LifecycleStageOption } from './api/flowchartTypes'

// DAR-UI-050. The lifecycle builder's dropdown options, from get#LifecycleOptions. The evidence rides in the
// label, because a dropdown is the only control the builder has.

function dayWord(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

export function stageOptionLabel(stage: LifecycleStageOption): string {
  const when = stage.typicalDays === 0 ? 'usually the same day' : `usually ${dayWord(stage.typicalDays)} later`
  return `${stage.label} · ${stage.rate}% · ${when}`
}

/** The chosen stages in the data's order (soonest first), whatever order they were clicked in. */
export function orderedStages(stages: LifecycleStageOption[], chosen: string[]): LifecycleStageOption[] {
  return stages.filter((s) => chosen.includes(s.recordType))
}

/** "Late after" is measured to the last stage, from the start record. */
export function lateAfterOptions(ordered: LifecycleStageOption[]): { value: string; label: string }[] {
  const last = ordered[ordered.length - 1]
  return (last?.coverage ?? []).map((c) => ({
    value: String(c.days),
    label: `${c.days === 0 ? 'Same day' : dayWord(c.days)} · ${c.percent}% done by then`,
  }))
}

export function defaultLateAfter(ordered: LifecycleStageOption[]): string {
  const coverage = ordered[ordered.length - 1]?.coverage ?? []
  const pick = coverage.find((c) => c.percent >= 90) ?? coverage[coverage.length - 1]
  return pick ? String(pick.days) : ''
}
