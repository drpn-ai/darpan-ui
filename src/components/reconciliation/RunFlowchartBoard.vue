<template>
  <div class="flowchart-scroll" data-testid="run-flowchart-board">
    <div class="flowchart-canvas" :style="{ width: `${layout.width}px`, height: `${layout.height}px` }">
      <svg
        class="flowchart-edges"
        data-testid="flowchart-edges"
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :width="layout.width"
        :height="layout.height"
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
          :class="['flowchart-node', { 'flowchart-node--selected': box.questionId === selectedId }]"
          :style="boxStyle(box)"
          :title="nodeTitle(box.questionId)"
          :data-testid="`flowchart-box-${box.questionId}`"
          @click="emit('select', box.questionId)"
        >
          <span class="flowchart-node-label">
            <span v-if="box.kind === 'start'" class="flowchart-node-role">Start</span>
            {{ questionLabel(box.questionId) }}
          </span>
          <span v-if="states?.[box.questionId]" class="flowchart-node-state" :data-testid="`flowchart-state-${box.questionId}`">
            <StatusBadge :label="stateBadge(box.questionId).label" :tone="stateBadge(box.questionId).tone" />
          </span>
        </button>
        <div
          v-else
          class="flowchart-finding"
          :style="boxStyle(box)"
          :title="findingLabel(box.questionId)"
          :data-testid="`flowchart-finding-${box.questionId}`"
        >
          <span class="flowchart-finding-label">{{ findingLabel(box.questionId) }}</span>
          <span v-if="noCount(box.questionId) !== null" class="flowchart-finding-count">{{ formatCount(noCount(box.questionId)!) }}</span>
        </div>
      </template>

      <template v-if="editable">
        <button
          v-for="add in layout.affordances.filter(canOffer)"
          :key="`${add.kind}:${add.questionId}`"
          type="button"
          class="app-icon-action flowchart-add"
          :style="{ left: `${add.x}px`, top: `${add.y}px` }"
          :aria-label="add.kind === 'next' ? 'Add next question' : 'Ask why'"
          :title="add.kind === 'next' ? 'Add next question' : 'Ask why'"
          :data-testid="`flowchart-add-${add.kind === 'next' ? 'next' : 'why'}-${add.questionId}`"
          @click="onAdd(add)"
        >
          +
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '../ui/StatusBadge.vue'
import type { FlowchartExecutionRow, FlowchartQuestion } from '../../lib/api/flowchartTypes'
import { layoutFlowchart, type FlowchartAffordance, type FlowchartBox, type FlowchartEdge } from '../../lib/flowchart/flowchartLayout'
import type { QuestionRunState } from '../../lib/flowchart/flowchartRunState'

// DAR-UI-048. Renders a layout from flowchartLayout; owns no geometry of its own (spec D3, top to bottom).
// Nodes follow the rules board's field pill, findings its small operator box, "+" its app-icon-action.
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
const hasStart = computed(() => props.questions.some((q) => q.questionRole === 'START'))
const countFormat = new Intl.NumberFormat('en-US')

type Tone = 'neutral' | 'success' | 'warning' | 'danger'
const BADGES: Record<QuestionRunState, { label: string; tone: Tone }> = {
  waiting: { label: 'Waiting', tone: 'neutral' },
  running: { label: 'Running', tone: 'neutral' },
  done: { label: 'Done', tone: 'success' },
  nothing: { label: 'Nothing to ask', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  'not-run': { label: 'Not run', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'warning' },
}

function formatCount(n: number): string { return countFormat.format(n) }
function boxStyle(box: FlowchartBox) {
  return { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` }
}
function questionLabel(id: string): string {
  const q = byId.value.get(id)
  return q?.runName?.trim() || props.ruleNames[q?.ruleSetId ?? ''] || q?.ruleSetId || id
}
function findingLabel(id: string): string { return byId.value.get(id)?.noOutcomeLabel?.trim() || 'No' }
function noCount(id: string): number | null {
  const n = props.states?.[id]?.row?.noCount
  return typeof n === 'number' ? n : null
}
function stateBadge(id: string) { return BADGES[props.states?.[id]?.state ?? 'waiting'] }
// The pill holds one line, so the full name and any failure reason ride on its title (review I6).
function nodeTitle(id: string): string {
  const reason = props.states?.[id]?.row?.errorMessage?.trim()
  return reason ? `${questionLabel(id)}\n${reason}` : questionLabel(id)
}
// A top-level one-source question in a run with no start has no list of records that passed (spec A2),
// so the server refuses a yes child under it; do not offer one.
function canOffer(add: FlowchartAffordance): boolean {
  if (add.kind === 'why') return true
  const q = byId.value.get(add.questionId)
  return !(q && !hasStart.value && !q.parentReconciliationRunId && q.questionRole !== 'START' && q.scopeMode === 'EVALUATE')
}
function onAdd(add: FlowchartAffordance) {
  if (add.kind === 'next') emit('add-next', add.questionId)
  else emit('add-why', add.questionId)
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
/* The rules board's connector line, and its dashed draft treatment for the no / why branches. */
.flowchart-edge { fill: none; stroke: color-mix(in oklab, var(--text) 58%, transparent); stroke-width: 2; }
.flowchart-edge--no, .flowchart-edge--why { stroke-dasharray: 7 7; }
.flowchart-edge-label { fill: var(--text-muted); font-size: var(--type-table-head-size); font-variant-numeric: tabular-nums; }

/* Question node: the rules board's field pill (.ruleset-field-item), one line, ellipsis. */
.flowchart-node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 0;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid color-mix(in oklab, var(--border) 80%, var(--text) 20%);
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, var(--surface-2) 88%, var(--surface));
  color: var(--text);
  text-align: left;
}
.flowchart-node:hover {
  border-color: color-mix(in oklab, var(--border) 64%, var(--text) 36%);
  background: color-mix(in oklab, var(--surface-2) 80%, var(--text) 20%);
}
.flowchart-node--selected {
  border-color: color-mix(in oklab, var(--accent) 42%, var(--text));
  background: color-mix(in oklab, var(--surface-2) 78%, var(--accent) 22%);
}
.flowchart-node-label {
  min-width: 0;
  overflow: hidden;
  font-size: var(--type-heading-size);
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flowchart-node-role {
  margin-right: var(--space-1);
  color: var(--text-dim);
  font-size: var(--type-eyebrow-size);
  letter-spacing: var(--type-eyebrow-tracking);
  text-transform: uppercase;
}
.flowchart-node-state { flex: none; }

/* Finding: the rules board's small operator box (--radius-sm, muted, tabular numbers). */
.flowchart-finding {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0 var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-muted);
  font-size: var(--type-table-head-size);
}
.flowchart-finding-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.flowchart-finding-count { flex: none; color: var(--text); font-variant-numeric: tabular-nums; }

.flowchart-add { position: absolute; }
</style>
