<template>
  <!-- How the lifecycle works, read only: the line its settings draw. The records it starts from, what it leaves out of
       them and when one is judged; then each stage in order, with what it is not expected of and where records stop
       there, each place marked a Finding or not; the complete place closes the line. -->
  <div class="lifecycle-outline" data-testid="lifecycle-outline">
    <div class="lifecycle-outline-group">
      <div class="lifecycle-outline-node lifecycle-outline-node--start">
        <span class="lifecycle-outline-name">{{ recordLabel }}</span>
        <span v-if="account" class="lifecycle-outline-quiet">{{ account }}</span>
      </div>
      <div class="lifecycle-outline-gap">
        <p v-for="rule in rules" :key="`${rule.fieldId}=${rule.value}`" class="lifecycle-outline-phrase" data-testid="lifecycle-outline-rule">
          <span class="lifecycle-outline-quiet">except</span> {{ rule.fieldLabel }} <span class="lifecycle-outline-quiet">is</span> {{ rule.valueLabel }}
        </p>
        <p class="lifecycle-outline-phrase" data-testid="lifecycle-outline-late">
          <span class="lifecycle-outline-quiet">judged after</span> {{ lateWords }}
        </p>
      </div>
    </div>
    <div v-for="(stage, index) in stages" :key="stage.recordType" class="lifecycle-outline-group">
      <div class="lifecycle-outline-node" :class="{ 'lifecycle-outline-node--last': index === stages.length - 1 }">
        <span class="lifecycle-outline-name">{{ stage.label }}</span>
      </div>
      <div v-if="exceptionsFor(stage.recordType).length || placesAt(stage.label).length" class="lifecycle-outline-gap">
        <p
          v-for="exception in exceptionsFor(stage.recordType)"
          :key="`${exception.fieldId}=${exception.value}`"
          class="lifecycle-outline-phrase"
          data-testid="lifecycle-outline-exception"
        >
          <span class="lifecycle-outline-quiet">not expected for</span> {{ exception.fieldLabel }} <span class="lifecycle-outline-quiet">is</span> {{ exception.value }}
        </p>
        <!-- Where records stop at this stage: a place that is a finding says so; one that is not is quiet. -->
        <div
          v-for="place in placesAt(stage.label)"
          :key="place.label"
          class="lifecycle-outline-place"
          :class="{ 'lifecycle-outline-place--quiet': !place.finding }"
          :data-testid="place.finding ? 'lifecycle-outline-finding' : 'lifecycle-outline-not-finding'"
        >
          <span><span class="lifecycle-outline-quiet">{{ place.kind === 'check' ? 'flags' : 'stops at' }}</span> {{ place.label }}</span>
          <StatusBadge v-if="place.finding" label="Finding" tone="warning" />
          <span v-else class="lifecycle-outline-quiet">not a finding</span>
        </div>
      </div>
    </div>
    <div v-if="complete" class="lifecycle-outline-group">
      <div class="lifecycle-outline-node lifecycle-outline-node--complete" data-testid="lifecycle-outline-complete">
        <span class="lifecycle-outline-name">{{ complete }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LifecycleRule, LifecycleStageException } from '../../lib/api/flowchartTypes'
import StatusBadge from '../ui/StatusBadge.vue'

// DAR-UI-050. A lifecycle's own page shows how it works, as its settings draw it, without the controls: changing it is
// the gear's job, and a run's result shows only results.
const props = defineProps<{
  recordLabel: string
  account?: string | null
  rules: LifecycleRule[]
  stages: { recordType: string; label: string }[]
  exceptions: LifecycleStageException[]
  lateAfterDays: number
  /** Where records stop, by the stage they stop at, and whether each place's records are findings. */
  places: { stageLabel: string; label: string; finding: boolean; kind?: 'check' }[]
  /** The place a record that reached every stage ends at. */
  complete?: string | null
}>()

const lateWords = computed(() => (props.lateAfterDays === 0 ? 'the same day' : props.lateAfterDays === 1 ? '1 day' : `${props.lateAfterDays} days`))
function exceptionsFor(stage: string) { return props.exceptions.filter((e) => e.stageRecordType === stage) }
function placesAt(stageLabel: string) { return props.places.filter((p) => p.stageLabel === stageLabel) }
</script>

<style scoped>
.lifecycle-outline { display: flex; flex-direction: column; max-width: 40rem; }
.lifecycle-outline-group { position: relative; }
.lifecycle-outline-node {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding-left: var(--space-4);
  font-size: var(--type-tile-size);
}
.lifecycle-outline-node::before {
  content: "";
  position: absolute;
  left: 0.2rem;
  top: 0.45rem;
  width: 0.7rem;
  height: 0.7rem;
  border: 1.5px solid var(--text);
  border-radius: var(--radius-pill);
  background: var(--surface);
}
.lifecycle-outline-node--start::before,
.lifecycle-outline-node--complete::before { background: var(--text); }
.lifecycle-outline-name { color: var(--text); }
.lifecycle-outline-quiet { color: var(--text-dim); }
/* The rule line runs down the left between the dots, through each part's phrases. */
.lifecycle-outline-gap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-0);
  padding: var(--space-1-5) 0 var(--space-2) var(--space-4);
}
.lifecycle-outline-gap::before,
.lifecycle-outline-group:not(:last-child) > .lifecycle-outline-node:only-child::after {
  content: "";
  position: absolute;
  left: 0.55rem;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--border);
}
.lifecycle-outline-group:not(:last-child) > .lifecycle-outline-node:only-child { padding-bottom: var(--space-2); }
.lifecycle-outline-group:not(:last-child) > .lifecycle-outline-node:only-child::after { top: 1.3rem; }
.lifecycle-outline-place {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  color: var(--text);
  font-size: var(--type-muted-size);
  line-height: 1.6;
}
.lifecycle-outline-place--quiet { color: var(--text-dim); }
.lifecycle-outline-phrase {
  margin: 0;
  color: var(--text-soft);
  font-size: var(--type-muted-size);
  line-height: 1.6;
}
</style>
