<template>
  <div class="flowchart-scroll" data-testid="run-flowchart-board">
    <div class="flowchart-canvas" :style="{ width: `${layout.width}px`, height: `${layout.height + 40}px` }">
      <svg
        class="flowchart-edges"
        data-testid="flowchart-edges"
        :viewBox="`0 0 ${layout.width} ${layout.height + 40}`"
        :width="layout.width"
        :height="layout.height + 40"
        aria-hidden="true"
      >
        <g v-for="edge in layout.edges" :key="edge.id">
          <path
            :class="['flowchart-edge', `flowchart-edge--${edge.kind}`]"
            :data-testid="`flowchart-edge-${edge.id}`"
            :d="edge.d"
          />
          <text class="flowchart-edge-label" :x="edge.labelX" :y="edge.labelY">{{ edgeLabel(edge) }}</text>
        </g>
      </svg>

      <template v-for="box in layout.boxes" :key="box.id">
        <button
          v-if="box.kind !== 'finding'"
          type="button"
          :class="['flowchart-box', `flowchart-box--${box.kind}`, { 'flowchart-box--selected': box.questionId === selectedId }]"
          :style="boxStyle(box)"
          :data-testid="`flowchart-box-${box.questionId}`"
          @click="emit('select', box.questionId)"
        >
          <span class="flowchart-box-label">{{ questionLabel(box.questionId) }}</span>
          <span
            v-if="states?.[box.questionId]"
            class="flowchart-box-state"
            :data-testid="`flowchart-state-${box.questionId}`"
          >{{ stateLabel(box.questionId) }}</span>
        </button>
        <div
          v-else
          class="flowchart-finding"
          :style="boxStyle(box)"
          :data-testid="`flowchart-finding-${box.questionId}`"
        >
          {{ findingLabel(box.questionId) }}<template v-if="noCount(box.questionId) !== null"> · {{ formatCount(noCount(box.questionId)!) }}</template>
        </div>
        <button
          v-if="editable && box.kind !== 'finding' && canAddNext(box.questionId)"
          type="button"
          class="flowchart-add"
          :style="addNextStyle(box)"
          :data-testid="`flowchart-add-next-${box.questionId}`"
          @click="emit('add-next', box.questionId)"
        >
          + next question
        </button>
        <button
          v-if="editable && box.kind === 'finding'"
          type="button"
          class="flowchart-add"
          :style="addWhyStyle(box)"
          :data-testid="`flowchart-add-why-${box.questionId}`"
          @click="emit('add-why', box.questionId)"
        >
          + ask why
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FlowchartExecutionRow, FlowchartQuestion } from '../../lib/api/flowchartTypes'
import { layoutFlowchart, type FlowchartBox, type FlowchartEdge } from '../../lib/flowchart/flowchartLayout'
import type { QuestionRunState } from '../../lib/flowchart/flowchartRunState'

// DAR-UI-048. Renders a layout from flowchartLayout; owns no geometry of its own (spec D3, top to bottom).
const props = defineProps<{
  questions: FlowchartQuestion[]
  ruleNames: Record<string, string>
  editable: boolean
  narrow: boolean
  selectedId?: string | null
  states?: Record<string, { state: QuestionRunState; row?: FlowchartExecutionRow }>
}>()

const emit = defineEmits<{
  select: [questionId: string]
  'add-next': [questionId: string]
  'add-why': [questionId: string]
}>()

const layout = computed(() => layoutFlowchart(props.questions, { narrow: props.narrow }))
const byId = computed(() => new Map(props.questions.map((q) => [q.reconciliationRunId, q])))
const countFormat = new Intl.NumberFormat('en-US')

function formatCount(n: number): string { return countFormat.format(n) }
function boxStyle(box: FlowchartBox) {
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` }
}
// Right-aligned under the question, ending left of the narrow yes lane: off the "no" arrow at the left edge.
function addNextStyle(box: FlowchartBox) {
  return { left: `${box.x + box.width - 24}px`, top: `${box.y + box.height + 4}px`, transform: 'translateX(-100%)' }
}
const hasStart = computed(() => props.questions.some((q) => q.questionRole === 'START'))
// A top-level one-source question in a run with no start has no list of records that passed (spec A2),
// so the server refuses a yes child under it; do not offer one.
function canAddNext(id: string): boolean {
  const q = byId.value.get(id)
  return !(q && !hasStart.value && !q.parentReconciliationRunId && q.questionRole !== 'START' && q.scopeMode === 'EVALUATE')
}
function addWhyStyle(box: FlowchartBox) { return { left: `${box.x}px`, top: `${box.y + box.height + 4}px` } }
function questionLabel(id: string): string {
  const q = byId.value.get(id)
  return q?.runName?.trim() || props.ruleNames[q?.ruleSetId ?? ''] || q?.ruleSetId || id
}
function findingLabel(id: string): string { return byId.value.get(id)?.noOutcomeLabel?.trim() || 'No' }
function noCount(id: string): number | null {
  const n = props.states?.[id]?.row?.noCount
  return typeof n === 'number' ? n : null
}
function stateLabel(id: string): string {
  const s = props.states?.[id]
  if (!s) return ''
  const yes = s.row?.yesCount
  if (s.state === 'done' && typeof yes === 'number') return `yes · ${formatCount(yes)}`
  const why = s.row?.errorMessage?.trim()
  // A question that failed, did not run or was cancelled says why (review I6); the row carries the sentence.
  return why && ['failed', 'not-run', 'cancelled'].includes(s.state) ? `${s.state.replace('-', ' ')}: ${why}` : s.state.replace('-', ' ')
}
function edgeLabel(edge: FlowchartEdge): string {
  if (edge.kind === 'no') return 'no'
  if (edge.kind === 'why') return 'why'
  const parentYes = props.states?.[edge.fromId]?.row?.yesCount
  return typeof parentYes === 'number' ? `yes ${formatCount(parentYes)}` : 'yes'
}
</script>

<style scoped>
.flowchart-scroll { overflow-x: auto; max-width: 100%; }
.flowchart-canvas { position: relative; }
.flowchart-edges { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
.flowchart-edge { fill: none; stroke: color-mix(in oklab, var(--text) 58%, transparent); stroke-width: 2; }
.flowchart-edge--no, .flowchart-edge--why { stroke-dasharray: 6 5; }
.flowchart-edge-label { fill: var(--text-muted); font-size: var(--type-eyebrow-size); }
.flowchart-box, .flowchart-finding {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  font: inherit;
  font-weight: 400;
}
.flowchart-box { cursor: pointer; }
.flowchart-box--start { border-radius: var(--radius-pill); }
.flowchart-box--selected { border-color: var(--text); }
.flowchart-finding { background: var(--surface-2); color: var(--text-muted); border-style: dashed; }
.flowchart-box-state { color: var(--text-muted); font-size: var(--type-eyebrow-size); }
.flowchart-add {
  position: absolute;
  padding: 0 var(--space-1);
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font: inherit;
  font-size: var(--type-eyebrow-size);
  cursor: pointer;
}
.flowchart-add:hover { color: var(--text); }
</style>
