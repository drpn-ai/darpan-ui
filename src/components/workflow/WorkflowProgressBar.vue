<template>
  <div
    class="wizard-progress"
    :aria-label="ariaLabel"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="normalizedProgress"
  >
    <span class="wizard-progress-track">
      <span class="wizard-progress-fill" :style="{ width: normalizedWidth }"></span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    progressPercent: number | string
    ariaLabel?: string
  }>(),
  {
    ariaLabel: 'Workflow progress',
  },
)

const normalizedProgress = computed(() => {
  const rawValue = typeof props.progressPercent === 'number' ? props.progressPercent.toString() : props.progressPercent.trim()
  return normalizeProgressValue(rawValue)
})

const normalizedWidth = computed(() => `${normalizedProgress.value}%`)

function normalizeProgressValue(rawValue: string): number {
  const numericValue = Number(rawValue.replace(/%$/, ''))
  if (!Number.isFinite(numericValue)) return 0
  return Math.min(Math.max(numericValue, 0), 100)
}
</script>

<style scoped>
.wizard-progress {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: var(--workflow-progress-width);
  margin-inline: auto;
}

.wizard-progress-track {
  position: relative;
  display: block;
  width: 100%;
  height: 0.28rem;
  background: var(--workflow-progress-track);
  overflow: hidden;
}

.wizard-progress-fill {
  display: block;
  height: 100%;
  background: var(--text);
}
</style>
