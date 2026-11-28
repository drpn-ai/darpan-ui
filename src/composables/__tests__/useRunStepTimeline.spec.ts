import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import type { GetReconciliationRunStatusResponse, ReconciliationRunStep } from '../../lib/api/types'
import { useRunStepTimeline, type UseRunStepTimeline } from '../useRunStepTimeline'

function mountTimeline(steps: ReconciliationRunStep[], options: { live?: boolean, active?: boolean } = {}) {
  const status = ref<GetReconciliationRunStatusResponse | null>({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', steps } as GetReconciliationRunStatusResponse)
  const liveRunResultId = ref(options.live === false ? '' : 'RR_1')
  const active = ref(options.active ?? true)
  let timeline!: UseRunStepTimeline
  const wrapper = mount(defineComponent({
    setup() {
      timeline = useRunStepTimeline({
        runStatus: computed(() => status.value),
        liveRunResultId: computed(() => liveRunResultId.value),
        liveRunActive: computed(() => active.value),
        file1Label: computed(() => 'HotWax'),
        file2Label: computed(() => 'Shopify'),
      })
      return () => h('div')
    },
  }))
  return { timeline, wrapper, liveRunResultId }
}

const codes = (steps: ReconciliationRunStep[]) => steps.map((step) => step.stageCode)

describe('useRunStepTimeline', () => {
  it('adds the stages a live run has not reached, after the furthest one it has', () => {
    const { timeline } = mountTimeline([
      { stageCode: 'RESOLVE', stageSequence: 1, statusEnumId: 'AUT_STAT_SUCCESS' },
      { stageCode: 'COMPARE', stageSequence: 5, statusEnumId: 'AUT_STAT_RUNNING' },
    ])

    // EXTRACT_* and RECHECK lie behind COMPARE: a stage the run skipped never shows as still to come.
    expect(codes(timeline.displayedRunSteps.value)).toEqual([
      'RESOLVE', 'COMPARE', 'VERIFY_RETURNS', 'VERIFY_MISSING', 'VERIFY_EXCHANGE', 'CONCLUDE', 'WRITE_OUTPUT', 'NOTIFY',
    ])
    expect(timeline.displayedRunSteps.value.at(-1)?.statusEnumId).toBe('AUT_STAT_PENDING')
  })

  // The backend's stageSequence numbers are not read: had it inserted a stage before COMPARE (COMPARE = 6),
  // comparing positions to its numbers would have dropped VERIFY_RETURNS from what is left.
  it('places pending stages by the order of the stage list, whatever numbers the backend persisted', () => {
    const { timeline } = mountTimeline([{ stageCode: 'COMPARE', stageSequence: 6, statusEnumId: 'AUT_STAT_RUNNING' }])

    expect(codes(timeline.displayedRunSteps.value)).toContain('VERIFY_RETURNS')
    expect(codes(timeline.displayedRunSteps.value)).not.toContain('RECHECK')
  })

  it('a stage code the list does not know does not move the frontier', () => {
    const { timeline } = mountTimeline([
      { stageCode: 'EXTRACT_FILE1', stageSequence: 2, statusEnumId: 'AUT_STAT_SUCCESS' },
      { stageCode: 'SOMETHING_NEW', stageSequence: 99, statusEnumId: 'AUT_STAT_RUNNING' },
    ])

    expect(codes(timeline.displayedRunSteps.value).slice(2, 4)).toEqual(['EXTRACT_FILE2', 'RECHECK'])
  })

  it('a run that can no longer move shows only what it recorded', () => {
    const steps = [{ stageCode: 'COMPARE', stageSequence: 5, statusEnumId: 'AUT_STAT_FAILED' }]
    const { timeline } = mountTimeline(steps, { active: false })

    expect(codes(timeline.displayedRunSteps.value)).toEqual(['COMPARE'])
  })

  it('names the stage a run failed at, and nothing when no step failed', () => {
    expect(mountTimeline([{ stageCode: 'COMPARE', statusEnumId: 'AUT_STAT_FAILED' }]).timeline.failedStepStageLabel.value)
      .toBe('Comparing records')
    expect(mountTimeline([{ stageCode: 'COMPARE', statusEnumId: 'AUT_STAT_SUCCESS' }]).timeline.failedStepStageLabel.value).toBe('')
  })

  it('opens expanded on a live run and folds away once the run names its result', async () => {
    const { timeline, liveRunResultId } = mountTimeline([])
    expect(timeline.stepTimelineCollapsed.value).toBe(false)

    liveRunResultId.value = ''
    await Promise.resolve()
    expect(timeline.stepTimelineCollapsed.value).toBe(true)
  })

  it('opens collapsed on a finished result', () => {
    expect(mountTimeline([], { live: false, active: false }).timeline.stepTimelineCollapsed.value).toBe(true)
  })

  it('labels an unknown step status by its id rather than as a known one', () => {
    const { timeline } = mountTimeline([])
    expect(timeline.stepStatusLabel({ statusEnumId: 'AUT_STAT_NOT_RUN' })).toBe('AUT_STAT_NOT_RUN')
    expect(timeline.stepStatusTone({ statusEnumId: 'AUT_STAT_NOT_RUN' })).toBe('neutral')
  })
})
