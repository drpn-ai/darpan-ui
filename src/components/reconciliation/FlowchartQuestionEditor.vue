<template>
  <!-- The design system's static-page popup (patterns: modality is blur, never a scrim): role and
       labelling on the overlay, panel classes on the section, the page frame takes
       static-page-frame--popup-open while this is open (RunFlowchartPage). Same shape as
       ConnectionDiagnosticsPopup. -->
  <div
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="flowchart-editor-title"
    data-testid="flowchart-editor"
    @click.self="emit('cancel')"
    @keydown.esc="emit('cancel')"
  >
    <section class="popup-workflow-modal workflow-panel flowchart-editor-popup">
      <header class="workflow-panel-header section-header-row">
        <h2 id="flowchart-editor-title">{{ heading }}</h2>
        <button
          type="button"
          class="app-icon-action"
          aria-label="Close question editor"
          data-testid="flowchart-editor-cancel"
          @click="emit('cancel')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="CLOSE_ICON_PATH" fill="currentColor" />
          </svg>
        </button>
      </header>

      <label>
        <span>Rule</span>
        <AppSelect v-model="local.ruleSetId" :options="ruleOptions" placeholder="pick a rule" searchable test-id="flowchart-editor-rule" />
      </label>
      <label>
        <span>Question</span>
        <input v-model="local.runName" type="text" placeholder="Does it have an invoice?" data-testid="flowchart-editor-wording" />
      </label>
      <label v-if="!isStart">
        <span>Finding</span>
        <input v-model="local.noOutcomeLabel" type="text" placeholder="Shipped, never billed" data-testid="flowchart-editor-no" />
      </label>

      <InlineValidation v-if="error" tone="error" :message="error" />

      <div class="action-row">
        <AppSaveAction label="Save question" :disabled="!local.ruleSetId || busy" test-id="flowchart-editor-save" @click="emit('save', { ...local })" />
        <button
          v-if="canDelete"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger"
          aria-label="Delete question"
          :disabled="busy"
          data-testid="flowchart-editor-delete"
          @click="emit('delete')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
          </svg>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { SavedRunSummary } from '../../lib/api/types'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import AppSaveAction from '../ui/AppSaveAction.vue'
import AppSelect from '../ui/AppSelect.vue'
import InlineValidation from '../ui/InlineValidation.vue'

// DAR-UI-048. One question's editor. A question uses an existing rule (spec A7): which rule answers it,
// how the question reads, and what its "no" is called. Static-surface controls only (AppSelect, not
// WorkflowSelect): the chart page is a static board, and the design system never blends surfaces.
export interface FlowchartQuestionDraft { ruleSetId: string; runName: string; noOutcomeLabel: string }

const CLOSE_ICON_PATH =
  'M5.28 4.22a.75.75 0 0 0-1.06 1.06L8.94 10l-4.72 4.72a.75.75 0 1 0 1.06 1.06L10 11.06l4.72 4.72a.75.75 0 1 0 1.06-1.06L11.06 10l4.72-4.72a.75.75 0 0 0-1.06-1.06L10 8.94 5.28 4.22Z'

const props = defineProps<{
  rules: SavedRunSummary[]
  draft: FlowchartQuestionDraft
  heading: string
  canDelete: boolean
  error?: string | null
  busy?: boolean
  /** The START question: every record it returns is a yes, so it has no "no", and it must be a one-source rule. */
  isStart?: boolean
}>()

const emit = defineEmits<{ save: [draft: FlowchartQuestionDraft]; delete: []; cancel: [] }>()

const local = reactive<FlowchartQuestionDraft>({ ...props.draft })
// A new draft (another question selected) replaces the local copy; a refused save does not.
watch(() => props.draft, (next) => Object.assign(local, next))

const ruleOptions = computed(() =>
  props.rules.filter((r) => !r.isArchived && (!props.isStart || r.scopeMode === 'EVALUATE'))
    .map((r) => ({ value: r.savedRunId, label: r.runName || r.savedRunId })))
</script>
