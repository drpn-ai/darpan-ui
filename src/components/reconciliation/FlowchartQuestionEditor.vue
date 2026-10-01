<template>
  <aside class="flowchart-editor" data-testid="flowchart-editor">
    <p class="flowchart-editor-heading">{{ heading }}</p>
    <label class="flowchart-editor-field">
      <span>Rule</span>
      <WorkflowSelect v-model="local.ruleSetId" :options="ruleOptions" placeholder="Choose a rule" test-id="flowchart-editor-rule" />
    </label>
    <label class="flowchart-editor-field">
      <span>Question</span>
      <input v-model="local.runName" type="text" data-testid="flowchart-editor-wording" />
    </label>
    <label class="flowchart-editor-field">
      <span>When the answer is no</span>
      <input v-model="local.noOutcomeLabel" type="text" data-testid="flowchart-editor-no" />
    </label>
    <InlineValidation v-if="error" tone="error" :message="error" />
    <div class="flowchart-editor-actions">
      <button type="button" class="wizard-next" :disabled="!local.ruleSetId || busy" data-testid="flowchart-editor-save" @click="emit('save', { ...local })">Save</button>
      <button v-if="canDelete" type="button" class="wizard-back" :disabled="busy" data-testid="flowchart-editor-delete" @click="emit('delete')">Delete question</button>
      <button type="button" class="wizard-back" data-testid="flowchart-editor-cancel" @click="emit('cancel')">Cancel</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { SavedRunSummary } from '../../lib/api/types'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowSelect from '../workflow/WorkflowSelect.vue'

// DAR-UI-048. One question's editor, opened beside the chart (never over it). A question uses an
// existing rule (spec A7): which rule answers it, how the question reads, and what its "no" is called.
export interface FlowchartQuestionDraft { ruleSetId: string; runName: string; noOutcomeLabel: string }

const props = defineProps<{
  rules: SavedRunSummary[]
  draft: FlowchartQuestionDraft
  heading: string
  canDelete: boolean
  error?: string | null
  busy?: boolean
}>()

const emit = defineEmits<{ save: [draft: FlowchartQuestionDraft]; delete: []; cancel: [] }>()

const local = reactive<FlowchartQuestionDraft>({ ...props.draft })
// A new draft (another question selected) replaces the local copy; a refused save does not.
watch(() => props.draft, (next) => Object.assign(local, next))

const ruleOptions = computed(() =>
  props.rules.filter((r) => !r.isArchived).map((r) => ({ value: r.savedRunId, label: r.runName || r.savedRunId })))
</script>

<style scoped>
.flowchart-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.flowchart-editor-heading { margin: 0; color: var(--text-muted); }
.flowchart-editor-field { display: flex; flex-direction: column; gap: var(--space-1); }
.flowchart-editor-field > span { color: var(--text-muted); font-size: var(--type-eyebrow-size); }
.flowchart-editor-actions { display: flex; gap: var(--space-2); }
</style>
