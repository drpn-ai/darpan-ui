<template>
  <!-- DAR-UI-135. A run's conclusions on their own edit page, like Filters and Rules: ranked rows that open in place,
       one at a time. An open conclusion reads as plain labelled lines; clicking one turns only that line into its
       control. The page holds a draft and the footer save sends the whole list once, all or nothing. -->
  <WorkflowPage
    :progress-percent="'100'"
    aria-label="Conclusions edit progress"
    class="workflow-page--conclusions-editor"
    center-stage
    edit-surface
  >
    <div v-if="draft" ref="root" class="conclusions-editor" data-testid="conclusions-editor">
      <header class="conclusions-editor__head">
        <p class="micro-label">Conclusions</p>
        <h1 class="conclusions-editor__title" data-testid="conclusions-editor-title">{{ runName }}</h1>
        <p class="conclusions-editor__note">First match wins.</p>
      </header>

      <p v-if="loading && !loaded" class="conclusions-editor__note" data-testid="conclusions-editor-loading">Loading...</p>

      <InlineValidation
        v-for="(message, index) in errors"
        :key="`${index}-${message}`"
        tone="error"
        :message="message"
        data-testid="conclusions-editor-error"
      />

      <div v-if="loaded" class="conclusions-editor__list" data-testid="conclusions-editor-list">
        <section
          v-for="(node, index) in list"
          :key="node.uid"
          class="concl"
          :class="{ 'concl--open': open === index, 'concl--hidden': node.outcome === 'HIDE' }"
          data-testid="conclusions-editor-row"
        >
          <button
            type="button"
            class="concl__row"
            :aria-expanded="open === index ? 'true' : 'false'"
            :aria-label="`Open conclusion ${rowName(node)}`"
            :disabled="saving"
            data-testid="conclusions-editor-toggle"
            @click="toggle(index)"
          >
            <span class="concl__rank" data-testid="conclusions-editor-rank">{{ index + 1 }}</span>
            <span class="concl__heading">
              <span
                class="concl__name"
                :class="{ 'concl__name--blank': !node.conclusion }"
                data-testid="conclusions-editor-name"
              >{{ conclusionLabel(node) || 'New conclusion' }}</span>
              <span class="concl__when" data-testid="conclusions-editor-when">when {{ describeLines(node) }}</span>
            </span>
            <span class="concl__explains" data-testid="conclusions-editor-explains">explains {{ explainsLabel(node.bucket, lineContext) }}</span>
            <span class="concl__outcome" data-testid="conclusions-editor-outcome">{{ outcomeLabel(node.outcome) }}</span>
          </button>

          <div v-if="open === index" class="concl__body" data-testid="conclusions-editor-open">
            <!-- Name: picked from the tenant's names, never a free rename, since one name can serve several runs. -->
            <div v-if="isEditing('name')" class="concl-part concl-part--edit" data-testid="conclusions-editor-edit-name">
              <span class="concl-part__key">Name</span>
              <div class="concl-part__control">
                <div class="concl-part__picker">
                  <AppSelect
                    class="concl-part__grow"
                    :model-value="node.conclusion"
                    :options="catalogOptions"
                    placeholder="Pick a name"
                    searchable
                    search-placeholder="Search conclusions"
                    :disabled="saving"
                    test-id="conclusions-editor-name-select"
                    @update:model-value="updateConclusion(node.uid, { conclusion: $event })"
                  />
                  <button
                    type="button"
                    class="app-icon-action"
                    aria-label="New conclusion code"
                    :aria-expanded="newCodeOpen ? 'true' : 'false'"
                    :disabled="saving || creating"
                    data-testid="conclusions-editor-new-code"
                    @click="toggleNewCode"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path :d="plusIconPath" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                <div v-if="newCodeOpen" class="concl-part__picker" data-testid="conclusions-editor-new-code-row">
                  <input
                    v-model="newCodeLabel"
                    class="concl-part__input"
                    type="text"
                    placeholder="new conclusion"
                    aria-label="New conclusion code"
                    maxlength="255"
                    data-autofocus
                    :disabled="saving || creating"
                    data-testid="conclusions-editor-new-code-label"
                    @keydown.enter.prevent="void addCode(node.uid)"
                  />
                  <button
                    type="button"
                    class="app-icon-action"
                    aria-label="Add conclusion code"
                    :disabled="saving || creating || !newCodeLabel.trim()"
                    data-testid="conclusions-editor-new-code-add"
                    @click="void addCode(node.uid)"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path :d="plusIconPath" fill="currentColor" />
                    </svg>
                  </button>
                </div>
                <InlineValidation
                  v-for="(message, codeIndex) in newCodeErrors"
                  :key="`${codeIndex}-${message}`"
                  tone="error"
                  :message="message"
                  data-testid="conclusions-editor-new-code-error"
                />
              </div>
              <button
                type="button"
                class="app-icon-action concl-part__done"
                aria-label="Done with this line"
                title="Done with this line"
                :disabled="saving"
                @click="done"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="concl-part"
              :aria-label="`Change name: ${rowName(node)}`"
              :disabled="saving"
              data-testid="conclusions-editor-field-name"
              @click="edit('name')"
            >
              <span class="concl-part__key">Name</span>
              <span class="concl-part__value" :class="{ 'concl-part__value--blank': !node.conclusion }">
                {{ conclusionLabel(node) || 'pick a name' }}
              </span>
            </button>

            <!-- Explains: which failed check it is tried on. -->
            <div v-if="isEditing('bucket')" class="concl-part concl-part--edit" data-testid="conclusions-editor-edit-bucket">
              <span class="concl-part__key">Explains</span>
              <div class="concl-part__control">
                <AppSelect
                  :model-value="node.bucket"
                  :options="bucketOptions"
                  :disabled="saving"
                  test-id="conclusions-editor-bucket-select"
                  @update:model-value="updateConclusion(node.uid, { bucket: $event })"
                />
              </div>
              <button
                type="button"
                class="app-icon-action concl-part__done"
                aria-label="Done with this line"
                title="Done with this line"
                :disabled="saving"
                @click="done"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="concl-part"
              :aria-label="`Change what it explains: ${explainsLabel(node.bucket, lineContext)}`"
              :disabled="saving"
              data-testid="conclusions-editor-field-bucket"
              @click="edit('bucket')"
            >
              <span class="concl-part__key">Explains</span>
              <span class="concl-part__value">{{ explainsLabel(node.bucket, lineContext) }}</span>
            </button>

            <!-- When: one plain sentence per line, joined by "and"; only the clicked line becomes a row. -->
            <div class="concl-part concl-part--lines">
              <span class="concl-part__key concl-part__key--lines">When</span>
              <div class="concl-part__lines">
                <ConclusionLine
                  v-for="(line, lineIndex) in node.lines"
                  :key="line.uid"
                  :condition="line.condition"
                  :context="lineContext"
                  :fields="fields"
                  :connector="lineIndex === 0 ? 'when' : 'and'"
                  :editing="isEditingLine(lineIndex)"
                  :disabled="saving"
                  @edit="editLine(lineIndex)"
                  @done="done"
                  @update="updateLine(node.uid, line.uid, $event)"
                  @remove="removeLineAt(node, lineIndex)"
                />
                <p v-if="!node.lines.length" class="concl-part__always">always</p>
                <div>
                  <button
                    type="button"
                    class="app-icon-action"
                    aria-label="Add a line"
                    title="Add a line"
                    :disabled="saving"
                    data-testid="conclusions-editor-add-line"
                    @click="addLineTo(node)"
                  >
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path :d="plusIconPath" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Asks: the question it answers, one line. -->
            <div v-if="isEditing('question')" class="concl-part concl-part--edit" data-testid="conclusions-editor-edit-question">
              <span class="concl-part__key">Asks</span>
              <div class="concl-part__control">
                <input
                  :value="node.question"
                  class="concl-part__input"
                  type="text"
                  placeholder="the question this answers"
                  aria-label="Question"
                  data-autofocus
                  :disabled="saving"
                  data-testid="conclusions-editor-question-input"
                  @input="updateConclusion(node.uid, { question: inputValue($event) })"
                  @keydown.enter.prevent="done"
                />
              </div>
              <button
                type="button"
                class="app-icon-action concl-part__done"
                aria-label="Done with this line"
                title="Done with this line"
                :disabled="saving"
                @click="done"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="concl-part"
              :aria-label="`Change the question: ${node.question.trim() || 'none'}`"
              :disabled="saving"
              data-testid="conclusions-editor-field-question"
              @click="edit('question')"
            >
              <span class="concl-part__key">Asks</span>
              <span class="concl-part__value" :class="{ 'concl-part__value--blank': !node.question.trim() }">
                {{ node.question.trim() || 'the question this answers' }}
              </span>
            </button>

            <!-- Shows as: what it does to a row it names. -->
            <div v-if="isEditing('outcome')" class="concl-part concl-part--edit" data-testid="conclusions-editor-edit-outcome">
              <span class="concl-part__key">Shows as</span>
              <div class="concl-part__control concl-part__picker">
                <AppSelect
                  class="concl-part__outcome-select"
                  :model-value="node.outcome"
                  :options="OUTCOME_OPTIONS"
                  :disabled="saving"
                  test-id="conclusions-editor-outcome-select"
                  @update:model-value="updateConclusion(node.uid, { outcome: toOutcome($event) })"
                />
                <span class="concl-part__gloss">{{ OUTCOME_GLOSS[node.outcome] }}</span>
              </div>
              <button
                type="button"
                class="app-icon-action concl-part__done"
                aria-label="Done with this line"
                title="Done with this line"
                :disabled="saving"
                @click="done"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="concl-part"
              :aria-label="`Change how it shows: ${outcomeLabel(node.outcome)}`"
              :disabled="saving"
              data-testid="conclusions-editor-field-outcome"
              @click="edit('outcome')"
            >
              <span class="concl-part__key">Shows as</span>
              <span class="concl-part__value">
                {{ outcomeLabel(node.outcome) }} <span class="concl-part__gloss">{{ OUTCOME_GLOSS[node.outcome] }}</span>
              </span>
            </button>

            <!-- Fix: the user's own words; Darpan never writes them. -->
            <div v-if="isEditing('fix')" class="concl-part concl-part--edit" data-testid="conclusions-editor-edit-fix">
              <span class="concl-part__key">Fix</span>
              <div class="concl-part__control">
                <textarea
                  :value="node.fix ?? ''"
                  class="concl-part__input concl-part__textarea"
                  rows="2"
                  :placeholder="FIX_PLACEHOLDER"
                  aria-label="Fix"
                  data-autofocus
                  :disabled="saving"
                  data-testid="conclusions-editor-fix-input"
                  @input="updateConclusion(node.uid, { fix: inputValue($event) || null })"
                />
              </div>
              <button
                type="button"
                class="app-icon-action concl-part__done"
                aria-label="Done with this line"
                title="Done with this line"
                :disabled="saving"
                @click="done"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="concl-part"
              :aria-label="`Change the fix: ${node.fix?.trim() || 'none'}`"
              :disabled="saving"
              data-testid="conclusions-editor-field-fix"
              @click="edit('fix')"
            >
              <span class="concl-part__key">Fix</span>
              <span class="concl-part__value concl-part__value--fix" :class="{ 'concl-part__value--blank': !node.fix?.trim() }">
                {{ node.fix?.trim() || FIX_PLACEHOLDER }}
              </span>
            </button>

            <div class="concl__tools">
              <button
                type="button"
                class="app-icon-action"
                aria-label="Move conclusion up"
                title="Move conclusion up"
                :disabled="saving || index === 0"
                data-testid="conclusions-editor-move-up"
                @click="moveOpen(node, -1)"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M10 15V5M5 10l5-5 5 5" />
                </svg>
              </button>
              <button
                type="button"
                class="app-icon-action"
                aria-label="Move conclusion down"
                title="Move conclusion down"
                :disabled="saving || index === list.length - 1"
                data-testid="conclusions-editor-move-down"
                @click="moveOpen(node, 1)"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M10 5v10M5 10l5 5 5-5" />
                </svg>
              </button>
              <button
                type="button"
                class="app-icon-action app-icon-action--danger"
                aria-label="Delete conclusion"
                title="Delete conclusion"
                :disabled="saving"
                data-testid="conclusions-editor-delete"
                @click="removeOpen(node)"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        <!-- Unexplained: always last, never moved or deleted; only its outcome changes, and never to Hidden. -->
        <section
          class="concl concl--fixed"
          :class="{ 'concl--open': open === UNEXPLAINED }"
          data-testid="conclusions-editor-unexplained"
        >
          <button
            type="button"
            class="concl__row"
            :aria-expanded="open === UNEXPLAINED ? 'true' : 'false'"
            aria-label="Open conclusion Unexplained"
            :disabled="saving"
            data-testid="conclusions-editor-toggle"
            @click="toggle(UNEXPLAINED)"
          >
            <span class="concl__rank">–</span>
            <span class="concl__heading">
              <span class="concl__name">Unexplained</span>
              <span class="concl__when">when nothing above matches</span>
            </span>
            <span class="concl__explains">explains {{ explainsLabel('', lineContext) }}</span>
            <span class="concl__outcome">{{ outcomeLabel(unexplained) }}</span>
          </button>

          <div v-if="open === UNEXPLAINED" class="concl__body" data-testid="conclusions-editor-open">
            <div v-if="isEditing('outcome')" class="concl-part concl-part--edit" data-testid="conclusions-editor-edit-outcome">
              <span class="concl-part__key">Shows as</span>
              <div class="concl-part__control concl-part__picker">
                <AppSelect
                  class="concl-part__outcome-select"
                  :model-value="unexplained"
                  :options="UNEXPLAINED_OPTIONS"
                  :disabled="saving"
                  test-id="conclusions-editor-outcome-select"
                  @update:model-value="setUnexplained"
                />
                <span class="concl-part__gloss">{{ OUTCOME_GLOSS[unexplained] }}</span>
              </div>
              <button
                type="button"
                class="app-icon-action concl-part__done"
                aria-label="Done with this line"
                title="Done with this line"
                :disabled="saving"
                @click="done"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true" focusable="false">
                  <path d="M4 10l4 4 8-8" />
                </svg>
              </button>
            </div>
            <button
              v-else
              type="button"
              class="concl-part"
              :aria-label="`Change how it shows: ${outcomeLabel(unexplained)}`"
              :disabled="saving"
              data-testid="conclusions-editor-field-outcome"
              @click="edit('outcome')"
            >
              <span class="concl-part__key">Shows as</span>
              <span class="concl-part__value">
                {{ outcomeLabel(unexplained) }} <span class="concl-part__gloss">{{ OUTCOME_GLOSS[unexplained] }}</span>
              </span>
            </button>
          </div>
        </section>
      </div>

      <div v-if="loaded">
        <button
          type="button"
          class="app-icon-action app-icon-action--large"
          aria-label="Add conclusion"
          title="Add conclusion"
          :disabled="saving"
          data-testid="conclusions-editor-add"
          @click="addAndOpen"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="plusIconPath" fill="currentColor" />
          </svg>
        </button>
      </div>

      <footer class="action-row conclusions-editor__footer">
        <span class="conclusions-editor__save" :data-testid="incomplete ? 'conclusions-save-blocked' : undefined">
          <AppSaveAction
            label="Save conclusions"
            test-id="conclusions-editor-save"
            :dirty="dirty"
            :disabled="saveDisabled"
            @click="void saveAndReturn()"
          />
        </span>
        <AppCancelAction
          label="Cancel changes"
          test-id="conclusions-editor-cancel"
          :disabled="saving || !dirty"
          @click="cancelChanges"
        />
        <button
          type="button"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to the run"
          title="Back to the run"
          :disabled="saving"
          data-testid="conclusions-editor-back"
          @click="void back()"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </button>
      </footer>
    </div>

    <template v-else>
      <EmptyState title="No run basics defined yet" />
      <RouterLink
        class="static-page-action-tile static-page-action-tile--inline"
        :to="{ name: 'reconciliation-create' }"
      >
        Go to Run Setup
      </RouterLink>
    </template>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppCancelAction from '../../components/ui/AppCancelAction.vue'
import ConclusionLine from '../../components/reconciliation/ConclusionLine.vue'
import { outcomeLabel, useRunConclusions, type ConclusionDraft } from '../../composables/useRunConclusions'
import { loadConclusionFields, lookupFields, type CatalogResult } from '../../lib/conclusionFieldCatalog'
import { OUTCOME_GLOSS, explainsLabel } from '../../lib/conclusionLines'
import { backIconPath, plusIconPath, trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import {
  formatReconciliationFieldKey,
  reconciliationSystemTitle,
  type ReconciliationRuleSetDraft,
} from '../../lib/reconciliationRuleSetDraft'
import { hintsFor } from '../../lib/mascotHints'
import { useMascotStore } from '../../stores/mascot'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

type Part = 'name' | 'bucket' | 'question' | 'outcome' | 'fix'
/** What is open for editing: one part of the open conclusion, or one of its lines by place. Never a uid, since a save
 *  that returns the stored list gives every row a new one. */
type Editing = { part: Part } | { part: 'line'; index: number } | null

const ROUTE_NAME = 'reconciliation-conclusions-editor'
const UNEXPLAINED = 'unexplained' as const
const FIX_PLACEHOLDER = 'how you fix it (only you write this)'
const OUTCOME_OPTIONS: AppSelectOption[] = [
  { value: '', label: outcomeLabel('') },
  { value: 'EXPECTED', label: outcomeLabel('EXPECTED') },
  { value: 'HIDE', label: outcomeLabel('HIDE') },
]
const UNEXPLAINED_OPTIONS: AppSelectOption[] = OUTCOME_OPTIONS.filter((option) => option.value !== 'HIDE')

const router = useRouter()
const draftStore = useReconciliationDraftStore()
const mascot = useMascotStore()

const draft = computed<ReconciliationRuleSetDraft | null>(() => draftStore.ruleSetDraftState?.draft ?? null)
const savedRunId = computed(() => draft.value?.savedRunId?.trim() ?? '')
const runName = computed(() => draft.value?.runName?.trim() || 'Run')
const file1Label = computed(() => reconciliationSystemTitle(draft.value, 'file1'))
const file2Label = computed(() => reconciliationSystemTitle(draft.value, 'file2'))
// FIRST_FIELD lines name the parent record only when the key has two or more fields (as on the run page).
const firstKeyField = computed(() => {
  const keyFields = draft.value?.file1PrimaryIdExpression ?? []
  return keyFields.length >= 2 ? formatReconciliationFieldKey(keyFields[0]) : null
})

const schemaCatalog = shallowRef<CatalogResult>({ fields: [], listPaths: new Set() })
const listPaths = shallowRef<ReadonlySet<string>>(new Set())

const conclusions = useRunConclusions({ savedRunId, file1Label, file2Label, firstKeyField, listPaths })
const {
  loading,
  loaded,
  saving,
  errors,
  list,
  unexplained,
  dirty,
  incomplete,
  lineContext,
  catalogOptions,
  bucketOptions,
  creating,
  newCodeErrors,
  conclusionLabel,
  describeLines,
  updateConclusion,
  updateLine,
} = conclusions

// The fields a line can check: both schemas, then the run's lookups; list paths from both.
const lookupCatalog = computed(() => lookupFields(conclusions.lookups.value, { file1: file1Label.value, file2: file2Label.value }))
const fields = computed(() => [...schemaCatalog.value.fields, ...lookupCatalog.value.fields])
watchEffect(() => {
  listPaths.value = new Set([...schemaCatalog.value.listPaths, ...lookupCatalog.value.listPaths])
})

const root = ref<HTMLElement | null>(null)
const open = ref<number | typeof UNEXPLAINED | null>(null)
const editing = ref<Editing>(null)
const newCodeOpen = ref(false)
const newCodeLabel = ref('')

let fieldsController: AbortController | null = null

// Off while a conclusion is unfinished, except while a part is open: a value typed there but not yet entered is
// only committed by the save press itself (its blur), so that press must reach saveAndReturn.
const saveDisabled = computed(() => saving.value || !loaded.value || (incomplete.value && editing.value === null))

function rowName(node: ConclusionDraft): string {
  return conclusionLabel(node) || 'new'
}

function toOutcome(value: string): ConclusionDraft['outcome'] {
  return value === 'HIDE' || value === 'EXPECTED' ? value : ''
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function isEditing(part: Part): boolean {
  return editing.value?.part === part
}

function isEditingLine(index: number): boolean {
  const current = editing.value
  return current?.part === 'line' && current.index === index
}

function closeNewCode(): void {
  newCodeOpen.value = false
  newCodeLabel.value = ''
}

/** Puts the caret in the control a part just opened into, when it is one you type in. */
function focusOpened(): void {
  void nextTick(() => root.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus())
}

function toggle(target: number | typeof UNEXPLAINED): void {
  open.value = open.value === target ? null : target
  editing.value = null
  closeNewCode()
}

function edit(part: Part): void {
  editing.value = { part }
  closeNewCode()
  focusOpened()
}

function editLine(index: number): void {
  editing.value = { part: 'line', index }
  closeNewCode()
}

function done(): void {
  editing.value = null
  closeNewCode()
}

function toggleNewCode(): void {
  newCodeOpen.value = !newCodeOpen.value
  newCodeLabel.value = ''
  if (newCodeOpen.value) focusOpened()
}

async function addCode(uid: string): Promise<void> {
  const id = await conclusions.createCode(newCodeLabel.value)
  if (!id) return
  updateConclusion(uid, { conclusion: id })
  closeNewCode()
}

function setUnexplained(value: string): void {
  if (saving.value) return
  unexplained.value = value === 'EXPECTED' ? 'EXPECTED' : ''
}

/** A new conclusion goes last and opens with its first line ready to fill. */
function addAndOpen(): void {
  if (!conclusions.addConclusion()) return
  open.value = list.value.length - 1
  editing.value = { part: 'line', index: 0 }
  closeNewCode()
}

function addLineTo(node: ConclusionDraft): void {
  if (!conclusions.addLine(node.uid)) return
  editing.value = { part: 'line', index: node.lines.length - 1 }
  closeNewCode()
}

function removeLineAt(node: ConclusionDraft, index: number): void {
  const line = node.lines[index]
  if (!line || saving.value) return
  conclusions.removeLine(node.uid, line.uid)
  const current = editing.value
  if (current?.part !== 'line') return
  if (current.index === index) editing.value = null
  else if (current.index > index) editing.value = { part: 'line', index: current.index - 1 }
}

/** The open conclusion travels with its arrows and stays open. */
function moveOpen(node: ConclusionDraft, direction: -1 | 1): void {
  conclusions.move(node.uid, direction)
  const at = list.value.findIndex((entry) => entry.uid === node.uid)
  if (at >= 0) open.value = at
}

function removeOpen(node: ConclusionDraft): void {
  if (saving.value) return
  conclusions.removeConclusion(node.uid)
  open.value = null
  editing.value = null
  closeNewCode()
}

function cancelChanges(): void {
  conclusions.cancel()
  open.value = null
  editing.value = null
  closeNewCode()
}

async function returnToRun(): Promise<void> {
  await router.push({ path: draftStore.workflowOrigin?.path ?? '/reconciliation/ruleset-manager' })
}

async function saveAndReturn(): Promise<void> {
  if (saving.value) return
  // A value typed into a line but never entered is kept on blur; take focus off it so the save carries it.
  const active = document.activeElement
  if (active instanceof HTMLElement && root.value?.contains(active)) active.blur()
  await nextTick()
  if (incomplete.value) {
    // Still unfinished after the flush: the mascot says why (the save-blocked hint leads while it applies).
    const [why] = hintsFor(ROUTE_NAME, document)
    if (why) mascot.offerTip(why)
    return
  }
  if (await conclusions.save()) await returnToRun()
}

async function back(): Promise<void> {
  if (dirty.value && !window.confirm('Discard unsaved conclusion changes?')) return
  await returnToRun()
}

onMounted(() => {
  const current = draft.value
  if (!current) return
  fieldsController = new AbortController()
  const signal = fieldsController.signal
  void loadConclusionFields(current, signal, { file1: file1Label.value, file2: file2Label.value }).then((result) => {
    if (!signal.aborted) schemaCatalog.value = result
  })
})

onBeforeUnmount(() => {
  fieldsController?.abort()
})
</script>

<style scoped>
.workflow-page--conclusions-editor.workflow-page--edit :deep(.workflow-shell) {
  padding-top: 0;
}

.conclusions-editor {
  display: grid;
  gap: var(--space-3);
  width: min(100%, 64rem);
  margin: 0 auto;
}

.conclusions-editor__head {
  display: grid;
  gap: var(--space-1);
}

.conclusions-editor__title {
  margin: 0;
  font-weight: 400;
}

.conclusions-editor__note {
  margin: 0;
  color: var(--text-muted);
}

.conclusions-editor__list {
  display: grid;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
  font-size: var(--static-tile-text-size);
}

.concl + .concl {
  border-top: 1px solid var(--static-tile-border);
}

.concl--open {
  background: color-mix(in oklab, var(--text) 3%, transparent);
}

/* Every collapsed row the same height, the columns lined up (as on the run page). */
.concl__row {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr) minmax(0, 13rem) 6.5rem;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 4rem;
  padding: var(--space-1-5) var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--motion-base) var(--ease-out);
}

.concl__row:hover,
.concl__row:focus-visible {
  background: color-mix(in oklab, var(--text) 5%, transparent);
}

.concl__rank {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.concl__heading {
  display: grid;
  min-width: 0;
}

.concl__name,
.concl__when {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.concl__when,
.concl__explains,
.concl__name--blank {
  color: var(--text-muted);
}

.concl__when {
  font-size: var(--type-note-size);
}

.concl__explains {
  min-width: 0;
  overflow-wrap: anywhere;
}

.concl__outcome {
  justify-self: end;
  white-space: nowrap;
}

/* Hidden rows dim their name and outcome; greys only. */
.concl--hidden .concl__name,
.concl--hidden .concl__outcome {
  color: var(--text-muted);
}

.concl__body {
  display: grid;
  gap: var(--space-1);
  padding: 0 var(--space-3) var(--space-3) calc(2.6rem + var(--space-3) * 2);
}

.concl-part {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  align-items: baseline;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-1-5) var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
}

button.concl-part {
  cursor: pointer;
  /* Read-plain hover is a tint and nothing else (playbook: Motion). */
  transition: background-color var(--motion-base) var(--ease-out);
}

button.concl-part:hover:not(:disabled),
button.concl-part:focus-visible {
  background: color-mix(in oklab, var(--text) 5%, transparent);
}

button.concl-part:disabled {
  cursor: default;
}

.concl-part--edit {
  grid-template-columns: 6.5rem minmax(0, 1fr) 2rem;
  align-items: start;
  border-color: var(--border);
  background: var(--surface);
}

.concl-part--lines {
  align-items: start;
  padding-right: 0;
}

.concl-part__key {
  color: var(--text-muted);
}

.concl-part--edit .concl-part__key,
.concl-part__key--lines {
  padding-top: var(--space-2);
}

.concl-part__value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.concl-part__value--fix {
  white-space: pre-wrap;
}

.concl-part__value--blank,
.concl-part__gloss,
.concl-part__always {
  color: var(--text-muted);
}

.concl-part__always {
  margin: 0;
  padding: var(--space-1-5) var(--space-2);
}

.concl-part__control {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.concl-part__picker {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.concl-part__grow {
  flex: 1 1 auto;
  min-width: 0;
}

.concl-part__outcome-select {
  flex: none;
  width: 10rem;
}

.concl-part__input {
  width: 100%;
  min-width: 0;
  min-height: 2.55rem;
}

.concl-part__textarea {
  resize: vertical;
}

.concl-part__done {
  margin-top: var(--space-1);
}

.concl-part__lines {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.concl__tools {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2) 0 calc(6.5rem + var(--space-3) + var(--space-2));
}

.conclusions-editor__footer {
  padding-top: var(--space-1);
}

/* Carries the "save is waiting on an unfinished line" mark the mascot reads; adds no box of its own. */
.conclusions-editor__save {
  display: inline-flex;
}

@media (max-width: 768px) {
  .concl__row {
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    gap: var(--space-00) var(--space-2);
  }

  .concl__explains {
    grid-column: 2 / -1;
    grid-row: 2;
    font-size: var(--type-note-size);
  }

  .concl__body {
    padding-left: var(--space-2);
  }

  .concl-part,
  .concl-part--edit {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
  }

  .concl-part--edit .concl-part__done {
    justify-self: start;
  }

  .concl__tools {
    padding-left: var(--space-2);
  }
}
</style>
