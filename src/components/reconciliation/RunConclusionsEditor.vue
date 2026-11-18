<template>
  <!-- DAR-UI-128. One conclusion in a popup: the page renders this outside its frame, which blurs while it is open.
       Its order among its siblings is a pick: the save numbers the tree in the order it is sent.
       Save sends the whole tree (with any child added from here), the trash deletes this node and its children at
       once, and Cancel puts the tree back as it was when the popup opened. -->
  <div
    v-if="node && row"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="run-conclusion-popup-title"
    data-testid="run-conclusion-popup"
    @click.self="cancelEditing"
  >
    <section class="popup-workflow-modal workflow-panel run-conclusion-popup">
      <header class="workflow-panel-header section-header-row">
        <h2 id="run-conclusion-popup-title">{{ conclusionLabel(node) || 'New conclusion' }}</h2>
        <div class="run-conclusion-popup-tools">
          <button
            type="button"
            class="app-icon-action"
            aria-label="Add child conclusion"
            :disabled="saving || row.depth >= MAX_CONCLUSION_DEPTH"
            data-testid="run-conclusions-add-child"
            @click="addChild"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path :d="PLUS_ICON_PATH" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            class="app-icon-action app-icon-action--danger"
            aria-label="Delete conclusion"
            :disabled="saving"
            data-testid="run-conclusions-delete"
            @click="void deleteEditing()"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          :question="editingIsNew ? 'What is the row concluded to be?' : 'Change this conclusion.'"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="run-conclusions-save"
          :submit-disabled="saving || creating"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          cancel-test-id="run-conclusions-cancel"
          @cancel="cancelEditing"
          @submit="void saveEditing()"
        >
          <InlineValidation
            v-for="(message, index) in popupErrors"
            :key="`${index}-${message}`"
            tone="error"
            :message="message"
            data-testid="run-conclusions-error"
          />

          <div class="run-conclusion-popup-pair">
            <div class="wizard-input-shell">
              <span v-explain="'runConclusion'" class="workflow-context-label">Conclusion</span>
              <div class="run-conclusion-picker">
                <AppSelect
                  v-model="node.conclusion"
                  :options="catalogOptions"
                  placeholder="Select conclusion"
                  searchable
                  search-placeholder="Search conclusions"
                  :disabled="saving"
                  test-id="run-conclusions-conclusion"
                />
                <button
                  type="button"
                  class="app-icon-action"
                  aria-label="New conclusion code"
                  :aria-expanded="newCodeOpen ? 'true' : 'false'"
                  :disabled="saving || creating"
                  data-testid="run-conclusions-new-code"
                  @click="toggleNewCode"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                    <path :d="PLUS_ICON_PATH" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="wizard-input-shell">
              <span v-explain="'conclusionOrder'" class="workflow-context-label">Order</span>
              <AppSelect
                :model-value="editingPosition"
                :options="orderOptions"
                :disabled="saving || orderOptions.length < 2"
                test-id="run-conclusions-order"
                @update:model-value="setEditingPosition(String($event))"
              />
            </div>
          </div>

          <div class="run-conclusion-popup-pair">
            <div v-if="row.depth === 1" class="wizard-input-shell">
              <span v-explain="'conclusionBucket'" class="workflow-context-label">Applies to</span>
              <AppSelect v-model="node.bucket" :options="bucketOptions" :disabled="saving" test-id="run-conclusions-bucket" />
            </div>
            <div class="wizard-input-shell">
              <span v-explain="'conclusionOutcome'" class="workflow-context-label">Outcome</span>
              <AppSelect v-model="node.outcome" :options="outcomeOptions" :disabled="saving" test-id="run-conclusions-outcome" />
            </div>
          </div>

          <div
            v-if="newCodeOpen"
            class="run-conclusion-new-code"
            data-enter-submit="off"
            data-testid="run-conclusions-new-code-row"
          >
            <input
              v-model="newCodeLabel"
              class="wizard-answer-control"
              type="text"
              name="newConclusionLabel"
              placeholder="new conclusion"
              aria-label="New conclusion code"
              maxlength="255"
              :disabled="creating"
              data-testid="run-conclusions-new-code-label"
              @keydown.enter.prevent="void createCode()"
            />
            <button
              type="button"
              class="app-icon-action"
              aria-label="Add conclusion code"
              :disabled="creating || !newCodeLabel.trim()"
              data-testid="run-conclusions-new-code-add"
              @click="void createCode()"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="PLUS_ICON_PATH" fill="currentColor" />
              </svg>
            </button>
            <InlineValidation
              v-for="(message, index) in newCodeErrors"
              :key="`${index}-${message}`"
              tone="error"
              :message="message"
              data-testid="run-conclusions-new-code-error"
            />
          </div>

          <label class="wizard-input-shell">
            <span v-explain="'conclusionQuestion'" class="workflow-context-label">Question</span>
            <input
              v-model="node.question"
              class="wizard-answer-control"
              type="text"
              name="conclusionQuestion"
              maxlength="255"
              :disabled="saving"
              data-testid="run-conclusions-question"
            />
          </label>

          <div class="run-conclusion-conditions">
            <span v-explain="'conclusionConditions'" class="workflow-context-label">Conditions</span>
            <div
              v-for="condition in node.conditions"
              :key="condition.uid"
              class="run-conclusion-condition"
              data-testid="run-conclusions-condition"
            >
              <AppSelect
                v-if="!isEvaluate"
                v-model="condition.subject"
                :options="subjectOptions"
                :disabled="saving"
                test-id="run-conclusions-subject"
              />
              <AppSelect v-model="condition.presence" :options="presenceOptions" :disabled="saving" test-id="run-conclusions-presence" />
              <AppSelect
                v-if="condition.presence !== 'ANY'"
                v-model="condition.keyScope"
                :options="keyScopeOptions"
                :disabled="saving"
                test-id="run-conclusions-key-scope"
              />
              <input
                v-model="condition.field"
                class="wizard-answer-control"
                type="text"
                name="conditionField"
                placeholder="field"
                aria-label="Field"
                :disabled="saving"
                data-testid="run-conclusions-field"
              />
              <AppSelect v-model="condition.operator" :options="operatorOptions" :disabled="saving" test-id="run-conclusions-operator" />
              <AppSelect
                v-if="condition.field.trim()"
                v-model="condition.quantifier"
                :options="quantifierOptions"
                :disabled="saving"
                test-id="run-conclusions-quantifier"
              />
              <input
                v-if="takesOneNumber(condition.operator)"
                v-model="condition.valuesText"
                class="wizard-answer-control"
                type="text"
                inputmode="decimal"
                name="conditionAmount"
                :placeholder="condition.operator === 'GT' ? 'number' : 'hours'"
                :aria-label="condition.operator === 'GT' ? 'More than' : 'Within hours'"
                :disabled="saving"
                data-testid="run-conclusions-amount"
              />
              <input
                v-else-if="takesValues(condition.operator)"
                v-model="condition.valuesText"
                class="wizard-answer-control"
                type="text"
                name="conditionValues"
                placeholder="values, comma separated"
                aria-label="Values"
                :disabled="saving"
                data-testid="run-conclusions-values"
              />
              <input
                v-model="condition.checkLabel"
                class="wizard-answer-control run-conclusion-check"
                type="text"
                name="conditionCheckLabel"
                placeholder="what it checks"
                aria-label="What it checks"
                :disabled="saving"
                data-testid="run-conclusions-check-label"
              />
              <button
                type="button"
                class="app-icon-action app-icon-action--danger"
                aria-label="Remove condition"
                :disabled="saving || node.conditions.length < 2"
                data-testid="run-conclusions-remove-condition"
                @click="removeCondition(condition)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
                </svg>
              </button>
            </div>
            <button
              type="button"
              class="app-icon-action run-conclusion-add-condition"
              aria-label="Add condition"
              :disabled="saving"
              data-testid="run-conclusions-add-condition"
              @click="addCondition"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="PLUS_ICON_PATH" fill="currentColor" />
              </svg>
            </button>
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { MAX_CONCLUSION_DEPTH, injectRunConclusions, takesOneNumber, takesValues } from '../../composables/useRunConclusions'
import { vExplain } from '../../directives/vExplain'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import AppSelect from '../ui/AppSelect.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'

const PLUS_ICON_PATH =
  'M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z'

const {
  editingRow: row,
  editingNode: node,
  editingIsNew,
  saving,
  creating,
  isEvaluate,
  popupErrors,
  catalogOptions,
  bucketOptions,
  subjectOptions,
  presenceOptions,
  keyScopeOptions,
  quantifierOptions,
  operatorOptions,
  outcomeOptions,
  orderOptions,
  editingPosition,
  newCodeOpen,
  newCodeLabel,
  newCodeErrors,
  conclusionLabel,
  setEditingPosition,
  addChild,
  deleteEditing,
  cancelEditing,
  saveEditing,
  addCondition,
  removeCondition,
  toggleNewCode,
  createCode,
} = injectRunConclusions()
</script>

<style scoped>
.run-conclusion-popup {
  width: min(52rem, calc(100vw - 2rem));
  max-width: min(52rem, calc(100vw - 2rem));
}

.run-conclusion-popup-tools {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.run-conclusion-popup-tools .app-icon-action,
.run-conclusion-picker .app-icon-action,
.run-conclusion-new-code .app-icon-action,
.run-conclusion-condition .app-icon-action,
.run-conclusion-add-condition {
  flex: 0 0 auto;
  width: 2.2rem;
  min-height: 2.2rem;
}

.run-conclusion-popup-pair {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: var(--space-2);
  width: 100%;
}

.run-conclusion-picker,
.run-conclusion-new-code {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  min-width: 0;
}

.run-conclusion-picker > .app-select {
  flex: 1 1 auto;
  min-width: 0;
}

.run-conclusion-new-code {
  flex-wrap: wrap;
  width: 100%;
}

.run-conclusion-new-code > input {
  flex: 1 1 14rem;
  min-width: 0;
}

.run-conclusion-new-code > .inline-validation {
  flex: 1 1 100%;
}

.run-conclusion-conditions {
  display: grid;
  gap: var(--space-1-5);
  width: 100%;
}

.run-conclusion-condition {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  padding-bottom: var(--space-1-5);
  border-bottom: 1px solid var(--border-soft);
}

.run-conclusion-condition > .app-select,
.run-conclusion-condition > input {
  flex: 1 1 7rem;
  width: auto;
  min-width: 7rem;
}

.run-conclusion-condition > .run-conclusion-check {
  flex: 2 1 12rem;
  min-width: 12rem;
}

.run-conclusion-add-condition {
  justify-self: start;
}

@media (max-width: 680px) {
  .run-conclusion-popup-pair {
    grid-template-columns: minmax(0, 1fr);
  }

  .run-conclusion-condition > .app-select,
  .run-conclusion-condition > input,
  .run-conclusion-condition > .run-conclusion-check {
    flex-basis: 100%;
  }
}
</style>
