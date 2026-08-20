<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="Reconciliation setup progress" center-stage>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />

    <WorkflowStepForm
      ref="stepForm"
      :class="['workflow-step-shell', { 'workflow-form--board-stage': isRuleSetRulesStep }]"
      :question="currentQuestion"
      :primary-label="isCreateStep ? 'Save run' : 'OK'"
      :submit-disabled="isCreateStep ? !canCreateRun || loadingSelections : !canProceed || loadingSelections"
      :show-back="currentStepIndex > 0"
      :show-primary-action="!isShortcutChoiceStep"
      :show-enter-hint="!isShortcutChoiceStep && !isRuleSetRulesStep"
      :allow-select-enter="true"
      :primary-test-id="isCreateStep ? 'create-run-submit' : 'wizard-next'"
      @submit="handlePrimarySubmit"
      @back="goBack"
    >
      <template v-if="isShortcutChoiceStep">
        <WorkflowShortcutChoiceCards
          :options="activeShortcutChoiceOptions"
          :selected-value="activeSelectValue"
          :test-id-prefix="activeShortcutChoiceTestPrefix"
          @choose="advanceFromShortcutChoice"
        />
      </template>

      <template v-else-if="isSelectStep">
        <label class="wizard-input-shell">
          <WorkflowSelect
            v-if="isPrimaryIdSelectStep"
            v-model="activeSelectValues"
            multiple
            :test-id="activeSelectTestId"
            :disabled="loadingSelections"
            :options="activePrimaryIdSelectOptions"
            :placeholder="loadingSelections ? 'Loading...' : currentPlaceholder"
          />
          <WorkflowSelect
            v-else
            v-model="activeSelectValue"
            :test-id="activeSelectTestId"
            :disabled="loadingSelections"
            :options="activeSelectOptions"
            :placeholder="loadingSelections ? 'Loading...' : currentPlaceholder"
          />
        </label>

        <InlineValidation v-if="activeStepError" tone="error" :message="activeStepError" />

        <div v-if="activeConfigCreateTarget" class="reconciliation-create-schema-choice">
          <p class="wizard-or" data-testid="create-config-divider">Or</p>
          <button
            type="button"
            class="wizard-secondary-link reconciliation-create-schema-link"
            data-testid="create-config-from-reconciliation"
            @click="openConfigCreateWorkflow"
          >
            Add a {{ activeConfigCreateTarget.label }} config
          </button>
        </div>

        <div v-if="isSchemaSelectionStep" class="reconciliation-create-schema-choice">
          <p class="wizard-or" data-testid="create-schema-divider">Or</p>
          <button
            type="button"
            class="wizard-secondary-link reconciliation-create-schema-link"
            data-testid="create-schema-from-reconciliation"
            @click="openSchemaCreateWorkflow"
          >
            Create New Schema
          </button>
        </div>
      </template>

      <template v-else-if="isChipTextStep">
        <WorkflowChipTextInput
          ref="chipTextInputRef"
          v-model="activeChipTextValue"
          data-testid="workflow-chip-text"
          :placeholder="currentPlaceholder"
          @update:pending="chipPendingValue = $event"
        />
      </template>

      <template v-else-if="isRuleSetRulesStep">
        <RuleSetBoard />
      </template>

      <template v-else>
        <label class="wizard-input-shell">
          <input
            :name="activeTextName"
            v-model="activeTextValue"
            :class="['wizard-answer-control', { empty: showEmptyState && !activeTextValue.trim() }]"
            :placeholder="currentPlaceholder"
          />
        </label>
      </template>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch, type ComponentPublicInstance } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards, {
  type WorkflowShortcutChoiceOption,
} from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowChipTextInput from '../../components/workflow/WorkflowChipTextInput.vue'
import RuleSetBoard from '../../components/reconciliation/RuleSetBoard.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, reconciliationFacade } from '../../lib/api/facade'
import type {
  AutomationNsRestletOption,
  AutomationPrimaryIdOption,
  AutomationSourceConfigOption,
  AutomationSystemRemoteOption,
  JsonSchemaField,
  JsonSchemaSummary,
} from '../../lib/api/types'
import {
  buildDefaultAutomationName,
} from '../../lib/reconciliationAutomationDraft'
import {
  buildCreateRuleSetRunPayload,
  fieldSharesRecordRoot,
  type ReconciliationCreateFlowStepId,
  type ReconciliationRuleSetDraft,
  type ReconciliationRuleSetDraftStepId,
} from '../../lib/reconciliationRuleSetDraft'
import {
  canonicalDarpanSystemEnumId,
  darpanSystemEndpointOptions,
  darpanSystemHasEndpointOptions,
  darpanSystemIdsMatch,
  darpanSystemParentOptions,
  excludeApiOnlyEndpointOptions,
  deduplicateDarpanSystemOptions,
  resolveDarpanSystemParentEnumId,
  type DarpanSystemValueOption,
} from '../../lib/utils/darpanSystems'
import { resolveSchemaLabel } from '../../lib/utils/schemaLabel'
import { rankPrimaryIdCandidates } from '../../lib/reconciliation/primaryIdCandidates'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

type StepId = ReconciliationCreateFlowStepId

interface WizardStep {
  id: StepId
}

/**
 * The four things the wizard asks about, in order. Progress is measured against these rather than
 * against the card count: the card list grows and shrinks as answers come in (an API source costs
 * more cards than a file upload), so a card-count denominator moves under the operator and the bar
 * slides backwards without anything being undone. Stages never change, so the bar only ever builds.
 */
const STAGES = ['name', 'file1', 'file2', 'rules'] as const
// The most cards a stage can ever cost, used as that stage's denominator so the fraction within a
// stage is computed against a constant. A stage that finishes in fewer cards jumps to the next
// stage's floor, which is forwards -- never backwards.
const STAGE_MAX_CARDS: Record<(typeof STAGES)[number], number> = {
  name: 2,
  file1: 6,
  file2: 6,
  rules: 1,
}

const FILE_TYPE_JSON = 'DftJson'
const FILE_TYPE_CSV = 'DftCsv'
const SOURCE_TYPE_API = 'AUT_SRC_API'
const SOURCE_MODE_FILE = 'file'
const SOURCE_MODE_API = 'api'
const SHORTCUT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F']
// Where an operator goes to create the API credentials a source needs, keyed by canonical parent
// system. Used only by the escape hatch on the API cards: reaching one of those with an empty list
// is a dead end, and Back is not an answer to "you have no config yet".
const CONFIG_CREATE_TARGETS: Record<string, { path: string, label: string }> = {
  OMS: { path: '/settings/hotwax/create', label: 'HotWax' },
  SHOPIFY: { path: '/settings/shopify/create', label: 'Shopify' },
  NETSUITE: { path: '/settings/netsuite/auth/create', label: 'NetSuite' },
}
const SYSTEM_LABEL_OVERRIDES: Record<string, string> = {
  HOTWAX: 'HotWax',
  NETSUITE: 'NetSuite',
  OMS: 'HotWax',
  SHOPIFY: 'Shopify',
}

const router = useRouter()
const route = useRoute()
const draftStore = useReconciliationDraftStore()
const stepForm = ref<ComponentPublicInstance | null>(null)

const loadingOptions = ref(false)
const pendingSchemaFieldLoads = ref(0)
const loadingSchemaFields = computed(() => pendingSchemaFieldLoads.value > 0)
const pageError = ref<string | null>(null)
const currentStepIndex = ref(0)
// Full flat systems list from the backend (parentEnumId included). systemOptions below filters it
// down to top-level systems only — the step 1 "which system" picker; step 2's endpoint options and
// concrete-value label lookups (resolveSystemLabel) read allSystemOptions directly so endpoint rows
// (e.g. OMS_RETURNS) keep resolving to their own distinct label everywhere else in the wizard.
const allSystemOptions = ref<Array<WorkflowSelectOption & DarpanSystemValueOption>>([])
const systemOptions = computed<WorkflowSelectOption[]>(() => darpanSystemParentOptions(allSystemOptions.value))
// Tracks the system chosen at step 1 independent of the concrete endpoint value: when the chosen
// system has endpoints, file{n}SystemEnumId stays blank until step 2 resolves it.
const file1SystemParentEnumId = ref('')
const file2SystemParentEnumId = ref('')
const fileTypeOptions = ref<WorkflowSelectOption[]>([])
const sourceConfigs = ref<AutomationSourceConfigOption[]>([])
const nsRestletConfigs = ref<AutomationNsRestletOption[]>([])
const systemRemotes = ref<AutomationSystemRemoteOption[]>([])
const jsonSchemas = ref<JsonSchemaSummary[]>([])
const flattenedFields = ref<Record<string, JsonSchemaField[]>>({})
const runName = ref('')
const description = ref('')
const file1SystemEnumId = ref('')
const file1SourceMode = ref(SOURCE_MODE_FILE)
const file1FileTypeEnumId = ref(FILE_TYPE_CSV)
const file1JsonSchemaId = ref('')
const file1PrimaryIdExpression = ref<string[]>([])
const file1SourceConfigId = ref('')
const file1SourceConfigType = ref('')
const file1NsRestletConfigId = ref('')
const file1SystemMessageRemoteId = ref('')
const file2SystemEnumId = ref('')
const file2SourceMode = ref(SOURCE_MODE_FILE)
const file2FileTypeEnumId = ref(FILE_TYPE_CSV)
const file2JsonSchemaId = ref('')
const file2PrimaryIdExpression = ref<string[]>([])
const file2SourceConfigId = ref('')
const file2SourceConfigType = ref('')
const file2NsRestletConfigId = ref('')
const file2SystemMessageRemoteId = ref('')

// The rules board (final step) reads and writes these directly off the shared draft store — it
// takes no props and emits nothing, so this is the only channel back to the wizard's own payload
// build. Not modeled as scalar refs like the rest of the draft above because the board owns their
// entire editing UI; the wizard only ever needs to carry the latest known value forward.
const ruleSetDraftExtras = ref<Pick<ReconciliationRuleSetDraft, 'rules' | 'file1ExcludeFilters' | 'file2ExcludeFilters'>>({})

const loadingSelections = computed(() => loadingOptions.value || loadingSchemaFields.value)
const file1UsesApi = computed(() => file1SourceMode.value === SOURCE_MODE_API)
const file2UsesApi = computed(() => file2SourceMode.value === SOURCE_MODE_API)
const file1UsesJson = computed(() => file1FileTypeEnumId.value === FILE_TYPE_JSON)
const file2UsesJson = computed(() => file2FileTypeEnumId.value === FILE_TYPE_JSON)
const selectedFile1Schema = computed(() => jsonSchemas.value.find((schema) => schema.jsonSchemaId === file1JsonSchemaId.value) ?? null)
const selectedFile2Schema = computed(() => jsonSchemas.value.find((schema) => schema.jsonSchemaId === file2JsonSchemaId.value) ?? null)
const file1SchemaLabel = computed(() => (selectedFile1Schema.value ? formatSchemaLabel(selectedFile1Schema.value) : 'source 1'))
const file2SchemaLabel = computed(() => (selectedFile2Schema.value ? formatSchemaLabel(selectedFile2Schema.value) : 'source 2'))

// A source config now maps 1:1 to a single API endpoint for OMS/Shopify (option rows are one per
// config x endpoint), so "which API endpoint" is redundant once the config narrows it to exactly
// one option -- skip the card and auto-select that option instead (see updateApiSourceConfig /
// autoSelectSoleApiSource). Zero options still show the card: that is a real "no endpoint
// configured" problem the operator needs to see (apiSourceSelectionError), not something to skip
// past silently. NetSuite still offers several restlet configs per auth config, so the card stays
// meaningful (and visible) there.
const file1ApiSourceOptions = computed(() => apiSourceOptionsForSide('file1'))
const file2ApiSourceOptions = computed(() => apiSourceOptionsForSide('file2'))
const file1ApiSourceStepNeeded = computed(() => file1ApiSourceOptions.value.length !== 1)
const file2ApiSourceStepNeeded = computed(() => file2ApiSourceOptions.value.length !== 1)

/**
 * One source arm, built once and called twice. Order matters and is the whole point of the shape:
 * "how does this source deliver data" comes BEFORE "which endpoint", because an endpoint is an API
 * concept and asking for one first presumes an answer the operator has not given yet.
 */
function sourceArmSteps(side: SourceSide): WizardStep[] {
  const armSteps: WizardStep[] = [
    { id: `${side}-system` as StepId },
    { id: `${side}-source` as StepId },
  ]
  if (armUsesApi(side)) {
    // Parent before child. A config is an account on the system, and which endpoints exist is
    // stored PER CONFIG (SourceConfigEndpointAccess), so the config has to be answered before the
    // endpoint list can be honest. Asking the other way round offers endpoints the operator's
    // config may not have enabled -- the dead end that used to surface two cards later.
    armSteps.push({ id: `${side}-api-config` as StepId })
    if (armHasEndpointStep(side)) armSteps.push({ id: `${side}-endpoint` as StepId })
    if (armNeedsApiSourceStep(side)) armSteps.push({ id: `${side}-api` as StepId })
  } else {
    // No config in a file upload, so the system is the endpoint's only parent and is already
    // answered. A system that groups nothing under it (SAPI, Database, NetSuite today), or whose
    // every endpoint is an API-only one this branch drops, resolves to itself in
    // syncFileEndpointSelection and never sees this card.
    if (armHasEndpointStep(side)) armSteps.push({ id: `${side}-endpoint` as StepId })
    armSteps.push({ id: `${side}-filetype` as StepId })
    // Both file types get the step now. For JSON it is required; for CSV it is skippable, and a
    // skip falls through to typing column names, so no existing CSV run is forced to acquire one.
    armSteps.push({ id: `${side}-schema` as StepId })
  }

  armSteps.push({ id: `${side}-primary-id` as StepId })
  return armSteps
}

const steps = computed<WizardStep[]>(() => [
  { id: 'run-name' },
  { id: 'description' },
  ...sourceArmSteps('file1'),
  ...sourceArmSteps('file2'),
  // Final step regardless of source shape: the rules board, so comparison rules and exclusions
  // are set before the run is saved instead of in a second trip through the Ruleset Manager.
  { id: 'ruleset-rules' },
])

function armUsesApi(side: SourceSide): boolean {
  return side === 'file1' ? file1UsesApi.value : file2UsesApi.value
}


/**
 * Whether this arm's endpoint card is worth showing: one answer is not a question. Same rule on
 * both branches -- the API side narrows the list by the chosen config, the file side by dropping
 * endpoints only an API pull can produce. Both can collapse it to a single answer, which
 * syncSoleApiEndpoint / syncFileEndpointSelection then resolve without a card.
 */
function armHasEndpointStep(side: SourceSide): boolean {
  return armEndpointOptions(side).length > 1
}

function armNeedsApiSourceStep(side: SourceSide): boolean {
  return side === 'file1' ? file1ApiSourceStepNeeded.value : file2ApiSourceStepNeeded.value
}

function armParentEnumId(side: SourceSide): string {
  return side === 'file1' ? file1SystemParentEnumId.value : file2SystemParentEnumId.value
}

/**
 * The endpoints this arm may pick from. On a file upload that is every endpoint grouped under the
 * system MINUS the ones only an API pull can produce: the card asks which data is in the file, and
 * "HotWax Returns (Reconciliation API)" is not an answer a file can give. On an API source it is
 * only the endpoints the chosen config actually carries a row for, which is why the config card
 * runs first.
 */
function armEndpointOptions(side: SourceSide): WorkflowSelectOption[] {
  const allEndpoints = endpointOptionsForParent(armParentEnumId(side))
  if (!armUsesApi(side)) return excludeApiOnlyEndpointOptions(allEndpoints)

  const sourceConfigId = selectedSourceConfigId(side)
  if (!sourceConfigId) return []
  return allEndpoints.filter((option) => configCoversEndpoint(sourceConfigId, option.value))
}

/** True when list#AutomationSourceOptions returned a (config x endpoint) row for this pair. */
function configCoversEndpoint(sourceConfigId: string, endpointEnumId: string): boolean {
  return sourceConfigs.value.some((config) =>
    sourceConfigMatches(config.sourceConfigId, sourceConfigId) &&
    (!config.systemEnumId || endpointMatchesSystem(config.systemEnumId, endpointEnumId)),
  )
}

/** The (config x endpoint) row's own config type -- the payload field that pins the extractor. */
function resolveSourceConfigType(sourceConfigId: string, endpointEnumId: string): string {
  const row = sourceConfigs.value.find((config) =>
    sourceConfigMatches(config.sourceConfigId, sourceConfigId) &&
    (!config.systemEnumId || endpointMatchesSystem(config.systemEnumId, endpointEnumId)),
  )
  return row?.sourceConfigType ?? ''
}

// The endpoint card is skipped when the config leaves exactly one, so resolve it here or the run
// would be saved with a blank systemEnumId and no config type.
function syncSoleApiEndpoint(side: SourceSide): void {
  const options = armEndpointOptions(side)
  if (options.length !== 1) return
  applyApiEndpointSelection(side, options[0]!.value)
}

/**
 * The file branch's counterpart to syncSoleApiEndpoint, run whenever the arm's shape changes.
 * Two jobs, both invisible otherwise:
 *   - the card is skipped when one endpoint is left, and nothing else would ever set the value;
 *   - a value the file branch no longer offers (an API-only endpoint picked before the arm was
 *     switched to file, or carried by an older draft) must not survive into a file run.
 * No-op on the API branch, which resolves its own value through applyApiEndpointSelection.
 */
function syncFileEndpointSelection(side: SourceSide): void {
  if (armUsesApi(side) || !armParentEnumId(side)) return

  const options = armEndpointOptions(side)
  const currentEnumId = selectedSystemEnumId(side)
  const resolvedEnumId = options.length === 1
    ? options[0]!.value
    : (options.some((option) => option.value === currentEnumId) ? currentEnumId : '')

  if (side === 'file1') {
    file1SystemEnumId.value = resolvedEnumId
  } else {
    file2SystemEnumId.value = resolvedEnumId
  }
}

function applyApiEndpointSelection(side: SourceSide, endpointEnumId: string): void {
  const sourceConfigType = resolveSourceConfigType(selectedSourceConfigId(side), endpointEnumId)
  if (side === 'file1') {
    file1SystemEnumId.value = endpointEnumId
    file1SourceConfigType.value = sourceConfigType
  } else {
    file2SystemEnumId.value = endpointEnumId
    file2SourceConfigType.value = sourceConfigType
  }
  autoSelectSoleApiSource(side)
}

/** Which of the four STAGES a card belongs to. Drives the progress bar; see STAGE_MAX_CARDS. */
function stageOfStep(stepId: StepId): number {
  if (stepId === 'run-name' || stepId === 'description') return 0
  if (stepId.startsWith('file1-')) return 1
  if (stepId.startsWith('file2-')) return 2
  return 3
}

const currentStep = computed<WizardStep>(() => steps.value[currentStepIndex.value] ?? steps.value[steps.value.length - 1]!)
const isCreateStep = computed(() => currentStepIndex.value === steps.value.length - 1)
const progressPercent = computed(() => {
  const stage = stageOfStep(currentStep.value.id)
  const stageName = STAGES[stage]!
  const cardsInStage = steps.value.filter((step) => stageOfStep(step.id) === stage)
  const positionInStage = Math.max(0, cardsInStage.findIndex((step) => step.id === currentStep.value.id))
  // Denominator is the stage's constant ceiling, never its live card count, so answering a
  // question that adds cards can only ever move the bar forwards.
  const withinStage = Math.min((positionInStage + 1) / STAGE_MAX_CARDS[stageName], 1)
  return (((stage + withinStage) / STAGES.length) * 100).toFixed(2)
})
const trimmedRunName = computed(() => runName.value.trim())
const file1SystemLabel = computed(() => resolveSystemLabel(file1SystemEnumId.value))
const file2SystemLabel = computed(() => resolveSystemLabel(file2SystemEnumId.value))
const activeDraft = computed<ReconciliationRuleSetDraft>(() => ({
  runName: trimmedRunName.value,
  description: description.value.trim() || undefined,
  file1SystemEnumId: file1SystemEnumId.value,
  file1SystemLabel: file1SystemLabel.value || undefined,
  file1SourceTypeEnumId: file1UsesApi.value ? SOURCE_TYPE_API : undefined,
  file1SystemMessageRemoteId: file1UsesApi.value ? file1SystemMessageRemoteId.value || undefined : undefined,
  file1SystemMessageRemoteLabel: file1UsesApi.value && file1SystemMessageRemoteId.value ? selectedApiSourceLabel('file1') || undefined : undefined,
  file1NsRestletConfigId: file1UsesApi.value ? file1NsRestletConfigId.value || undefined : undefined,
  file1NsRestletConfigLabel: file1UsesApi.value && file1NsRestletConfigId.value ? selectedApiSourceLabel('file1') || undefined : undefined,
  file1SourceConfigId: file1UsesApi.value ? file1SourceConfigId.value || undefined : undefined,
  file1SourceConfigType: file1UsesApi.value ? file1SourceConfigType.value || undefined : undefined,
  file1FileTypeEnumId: file1UsesApi.value ? '' : file1FileTypeEnumId.value,
  file1JsonSchemaId: !file1UsesApi.value ? file1JsonSchemaId.value || undefined : undefined,
  file1SchemaLabel: !file1UsesApi.value ? resolveSelectedSchemaLabel(file1JsonSchemaId.value) : undefined,
  file1SchemaFileName: !file1UsesApi.value ? resolveSchemaFileName(file1JsonSchemaId.value) : undefined,
  file1PrimaryIdExpression: file1PrimaryIdExpression.value,
  file2SystemEnumId: file2SystemEnumId.value,
  file2SystemLabel: file2SystemLabel.value || undefined,
  file2SourceTypeEnumId: file2UsesApi.value ? SOURCE_TYPE_API : undefined,
  file2SystemMessageRemoteId: file2UsesApi.value ? file2SystemMessageRemoteId.value || undefined : undefined,
  file2SystemMessageRemoteLabel: file2UsesApi.value && file2SystemMessageRemoteId.value ? selectedApiSourceLabel('file2') || undefined : undefined,
  file2NsRestletConfigId: file2UsesApi.value ? file2NsRestletConfigId.value || undefined : undefined,
  file2NsRestletConfigLabel: file2UsesApi.value && file2NsRestletConfigId.value ? selectedApiSourceLabel('file2') || undefined : undefined,
  file2SourceConfigId: file2UsesApi.value ? file2SourceConfigId.value || undefined : undefined,
  file2SourceConfigType: file2UsesApi.value ? file2SourceConfigType.value || undefined : undefined,
  file2FileTypeEnumId: file2UsesApi.value ? '' : file2FileTypeEnumId.value,
  file2JsonSchemaId: !file2UsesApi.value ? file2JsonSchemaId.value || undefined : undefined,
  file2SchemaLabel: !file2UsesApi.value ? resolveSelectedSchemaLabel(file2JsonSchemaId.value) : undefined,
  file2SchemaFileName: !file2UsesApi.value ? resolveSchemaFileName(file2JsonSchemaId.value) : undefined,
  file2PrimaryIdExpression: file2PrimaryIdExpression.value,
}))

const currentQuestion = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return 'What should this run be called?'
    case 'description':
      return 'What description should this run use?'
    case 'file1-system':
      return 'Which system provides the first source?'
    case 'file1-endpoint':
      // Worded for the branch the operator already chose one card earlier. "Endpoint" is
      // API vocabulary and reads as nonsense to someone about to upload a CSV.
      return file1UsesApi.value
        ? `Which ${resolveSystemLabel(file1SystemParentEnumId.value)} endpoint provides the first source?`
        : `Which ${resolveSystemLabel(file1SystemParentEnumId.value)} data is in the first source file?`
    case 'file1-source':
      return `How should ${sourceSystemLabel('file1')} provide data?`
    case 'file1-filetype':
      return `What file type does ${sourceSystemLabel('file1')} upload use?`
    case 'file1-schema':
      return file1UsesJson.value
        ? `Which saved schema describes the ${sourceSystemLabel('file1')} JSON?`
        : `Which column list describes the ${sourceSystemLabel('file1')} CSV?`
    case 'file1-primary-id':
      return file1UsesApi.value
        ? `Which field identifies each record from ${apiRecordSourceLabel('file1')}?`
        : (file1UsesJson.value
            ? `Which field identifies each record in ${file1SchemaLabel.value}?`
            : `What primary ID expression identifies each record in ${sourceSystemLabel('file1')}?`)
    case 'file1-api-config':
      return `Which ${sourceSystemLabel('file1')} config should this source use?`
    case 'file1-api':
      return `Which API endpoint should ${sourceSystemLabel('file1')} use?`
    case 'file2-system':
      return 'Which system provides the second source?'
    case 'file2-endpoint':
      // Worded for the branch the operator already chose one card earlier. "Endpoint" is
      // API vocabulary and reads as nonsense to someone about to upload a CSV.
      return file2UsesApi.value
        ? `Which ${resolveSystemLabel(file2SystemParentEnumId.value)} endpoint provides the second source?`
        : `Which ${resolveSystemLabel(file2SystemParentEnumId.value)} data is in the second source file?`
    case 'file2-source':
      return `How should ${sourceSystemLabel('file2')} provide data?`
    case 'file2-filetype':
      return `What file type does ${sourceSystemLabel('file2')} upload use?`
    case 'file2-schema':
      return file2UsesJson.value
        ? `Which saved schema describes the ${sourceSystemLabel('file2')} JSON?`
        : `Which column list describes the ${sourceSystemLabel('file2')} CSV?`
    case 'file2-primary-id':
      return file2UsesApi.value
        ? `Which field identifies each record from ${apiRecordSourceLabel('file2')}?`
        : (file2UsesJson.value
            ? `Which field identifies each record in ${file2SchemaLabel.value}?`
            : `What primary ID expression identifies each record in ${sourceSystemLabel('file2')}?`)
    case 'file2-api-config':
      return `Which ${sourceSystemLabel('file2')} config should this source use?`
    case 'file2-api':
      return `Which API endpoint should ${sourceSystemLabel('file2')} use?`
    case 'ruleset-rules':
      return 'How should Darpan compare these two systems?'
    default:
      return ''
  }
})

const isRuleSetRulesStep = computed(() => currentStep.value.id === 'ruleset-rules')

const isSelectStep = computed(() => {
  switch (currentStep.value.id) {
    case 'file1-system':
    case 'file1-endpoint':
    case 'file1-filetype':
    case 'file1-schema':
    case 'file1-api-config':
    case 'file1-api':
    case 'file2-system':
    case 'file2-endpoint':
    case 'file2-filetype':
    case 'file2-schema':
    case 'file2-api-config':
    case 'file2-api':
      return true
    case 'file1-primary-id':
      return file1UsesJson.value || file1UsesApi.value || file1JsonSchemaId.value.length > 0
    case 'file2-primary-id':
      return file2UsesJson.value || file2UsesApi.value || file2JsonSchemaId.value.length > 0
    default:
      return false
  }
})

const isChipTextStep = computed(() => {
  switch (currentStep.value.id) {
    case 'file1-primary-id':
      // A CSV side that skipped the schema step still types its column names.
      return !file1UsesJson.value && !file1UsesApi.value && file1JsonSchemaId.value.length === 0
    case 'file2-primary-id':
      return !file2UsesJson.value && !file2UsesApi.value && file2JsonSchemaId.value.length === 0
    default:
      return false
  }
})

const activeSelectValue = computed({
  get: () => {
    switch (currentStep.value.id) {
      case 'file1-system':
        return file1SystemParentEnumId.value
      case 'file1-endpoint':
        return file1SystemEnumId.value
      case 'file1-source':
        return file1SourceMode.value
      case 'file1-filetype':
        return file1FileTypeEnumId.value
      case 'file1-schema':
        return file1JsonSchemaId.value
      case 'file1-api-config':
        return file1SourceConfigId.value
      case 'file1-api':
        return selectedApiSourceValue('file1')
      case 'file2-system':
        return file2SystemParentEnumId.value
      case 'file2-endpoint':
        return file2SystemEnumId.value
      case 'file2-source':
        return file2SourceMode.value
      case 'file2-filetype':
        return file2FileTypeEnumId.value
      case 'file2-schema':
        return file2JsonSchemaId.value
      case 'file2-api-config':
        return file2SourceConfigId.value
      case 'file2-api':
        return selectedApiSourceValue('file2')
      default:
        return ''
    }
  },
  set: (value: string) => {
    switch (currentStep.value.id) {
      case 'file1-system':
        file1SystemParentEnumId.value = value
        // A system with no endpoints resolves straight to its own value (no file1-endpoint step
        // will be inserted); a system with endpoints leaves file1SystemEnumId blank until step 2
        // answers it, so canProceed correctly blocks advancing past an unresolved endpoint.
        file1SystemEnumId.value = darpanSystemHasEndpointOptions(value, allSystemOptions.value) ? '' : value
        file1JsonSchemaId.value = ''
        file1PrimaryIdExpression.value = []
        clearApiSourceConfig('file1')
        syncFileEndpointSelection('file1')
        break
      case 'file1-endpoint':
        file1JsonSchemaId.value = ''
        file1PrimaryIdExpression.value = []
        // On the API branch the config is this card's PARENT and must survive it; only
        // the endpoint-derived half of the selection is re-resolved here.
        if (file1UsesApi.value) {
          applyApiEndpointSelection('file1', value)
        } else {
          file1SystemEnumId.value = value
        }
        break
      case 'file1-source':
        setSourceMode('file1', value)
        break
      case 'file1-filetype':
        file1FileTypeEnumId.value = value
        file1JsonSchemaId.value = ''
        file1PrimaryIdExpression.value = []
        break
      case 'file1-schema':
        file1JsonSchemaId.value = value
        file1PrimaryIdExpression.value = []
        break
      case 'file1-api-config':
        updateApiSourceConfig('file1', value)
        break
      case 'file1-api':
        updateApiSource('file1', value)
        break
      case 'file2-system':
        file2SystemParentEnumId.value = value
        file2SystemEnumId.value = darpanSystemHasEndpointOptions(value, allSystemOptions.value) ? '' : value
        file2JsonSchemaId.value = ''
        file2PrimaryIdExpression.value = []
        clearApiSourceConfig('file2')
        syncFileEndpointSelection('file2')
        break
      case 'file2-endpoint':
        file2JsonSchemaId.value = ''
        file2PrimaryIdExpression.value = []
        // On the API branch the config is this card's PARENT and must survive it; only
        // the endpoint-derived half of the selection is re-resolved here.
        if (file2UsesApi.value) {
          applyApiEndpointSelection('file2', value)
        } else {
          file2SystemEnumId.value = value
        }
        break
      case 'file2-source':
        setSourceMode('file2', value)
        break
      case 'file2-filetype':
        file2FileTypeEnumId.value = value
        file2JsonSchemaId.value = ''
        file2PrimaryIdExpression.value = []
        break
      case 'file2-schema':
        file2JsonSchemaId.value = value
        file2PrimaryIdExpression.value = []
        break
      case 'file2-api-config':
        updateApiSourceConfig('file2', value)
        break
      case 'file2-api':
        updateApiSource('file2', value)
        break
    }
  },
})

const activeSelectOptions = computed(() => {
  switch (currentStep.value.id) {
    case 'file1-system':
    case 'file2-system':
      return systemOptions.value
    case 'file1-endpoint':
      return armEndpointOptions('file1')
    case 'file2-endpoint':
      return armEndpointOptions('file2')
    case 'file1-filetype':
    case 'file2-filetype':
      return fileTypeOptions.value
    case 'file1-api-config':
      return apiSourceConfigOptionsForSide('file1')
    case 'file2-api-config':
      return apiSourceConfigOptionsForSide('file2')
    case 'file1-api':
      return apiSourceOptionsForSide('file1')
    case 'file2-api':
      return apiSourceOptionsForSide('file2')
    case 'file1-schema':
      return buildSchemaOptions(file1SystemEnumId.value, !file1UsesJson.value)
    case 'file1-primary-id':
      return file1UsesApi.value
        ? apiPrimaryIdOptions('file1')
        : buildRankedFieldOptions(file1JsonSchemaId.value, file1UsesJson.value)
    case 'file2-schema':
      return buildSchemaOptions(file2SystemEnumId.value, !file2UsesJson.value)
    case 'file2-primary-id':
      return file2UsesApi.value
        ? apiPrimaryIdOptions('file2')
        : buildRankedFieldOptions(file2JsonSchemaId.value, file2UsesJson.value)
    default:
      return []
  }
})

const isPrimaryIdSelectStep = computed(() =>
  (currentStep.value.id === 'file1-primary-id' || currentStep.value.id === 'file2-primary-id') && isSelectStep.value,
)

const activeSelectValues = computed<string[]>({
  get: () => {
    if (currentStep.value.id === 'file1-primary-id') return file1PrimaryIdExpression.value
    if (currentStep.value.id === 'file2-primary-id') return file2PrimaryIdExpression.value
    return []
  },
  set: (values: string[]) => {
    if (currentStep.value.id === 'file1-primary-id') file1PrimaryIdExpression.value = values
    if (currentStep.value.id === 'file2-primary-id') file2PrimaryIdExpression.value = values
  },
})

const chipTextInputRef = ref<InstanceType<typeof WorkflowChipTextInput> | null>(null)
const chipPendingValue = ref('')

// Text typed into the chip input but not yet Entered still counts as an answer for this step.
// Otherwise canProceed is false, the OK button renders disabled, and the operator has no way to
// commit the value they can plainly see in the box.
const hasPendingChipText = computed(() => isChipTextStep.value && chipPendingValue.value.trim().length > 0)

// The chip input is remounted per step and starts empty, but a fresh empty ref emits nothing --
// so without this reset an abandoned value (operator typed, then hit Back) would linger and
// wrongly satisfy the NEXT chip step.
watch(currentStepIndex, () => { chipPendingValue.value = '' })

const activeChipTextValue = computed<string[]>({
  get: () => {
    if (currentStep.value.id === 'file1-primary-id') return file1PrimaryIdExpression.value
    if (currentStep.value.id === 'file2-primary-id') return file2PrimaryIdExpression.value
    return []
  },
  set: (values: string[]) => {
    if (currentStep.value.id === 'file1-primary-id') file1PrimaryIdExpression.value = values
    if (currentStep.value.id === 'file2-primary-id') file2PrimaryIdExpression.value = values
  },
})

// Once at least one field is chosen, further options are restricted to fields sharing the same
// JSON record root — composite key fields must all resolve at the same array-explosion level so
// the backend's shared-record-root validation (RuleSetCompareScopeAdapter) never rejects the save.
const activePrimaryIdSelectOptions = computed(() => {
  const baseOptions = activeSelectOptions.value
  const chosen = activeSelectValues.value
  if (!chosen.length) return baseOptions
  return baseOptions.filter((option) => fieldSharesRecordRoot(option.value, chosen[0]!))
})

const activeSelectTestId = computed(() => {
  switch (currentStep.value.id) {
    case 'file1-system':
      return 'file1-system-select'
    case 'file1-endpoint':
      return 'file1-endpoint-select'
    case 'file1-api-config':
      return 'file1-api-config-select'
    case 'file1-api':
      return 'file1-api-select'
    case 'file1-filetype':
      return 'file1-filetype-select'
    case 'file1-schema':
      return 'file1-schema-select'
    case 'file1-primary-id':
      return 'file1-field-select'
    case 'file2-system':
      return 'file2-system-select'
    case 'file2-endpoint':
      return 'file2-endpoint-select'
    case 'file2-api-config':
      return 'file2-api-config-select'
    case 'file2-api':
      return 'file2-api-select'
    case 'file2-filetype':
      return 'file2-filetype-select'
    case 'file2-schema':
      return 'file2-schema-select'
    case 'file2-primary-id':
      return 'file2-field-select'
    default:
      return 'workflow-select'
  }
})

const activeTextValue = computed({
  get: () => {
    switch (currentStep.value.id) {
      case 'run-name':
        return runName.value
      case 'description':
        return description.value
      default:
        return ''
    }
  },
  set: (value: string) => {
    switch (currentStep.value.id) {
      case 'run-name':
        runName.value = value
        break
      case 'description':
        description.value = value
        break
    }
  },
})

const activeTextName = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return 'runName'
    case 'description':
      return 'description'
    case 'file1-primary-id':
      return 'file1PrimaryIdExpression'
    case 'file2-primary-id':
      return 'file2PrimaryIdExpression'
    default:
      return 'workflowInput'
  }
})

const currentPlaceholder = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return 'Orders vs Shopify'
    case 'description':
      return 'Optional context for this run...'
    case 'file1-system':
    case 'file2-system':
      return 'Select system...'
    case 'file1-endpoint':
      return file1UsesApi.value ? 'Select endpoint...' : 'Select data...'
    case 'file2-endpoint':
      return file2UsesApi.value ? 'Select endpoint...' : 'Select data...'
    case 'file1-api':
    case 'file2-api':
      return 'Select API endpoint...'
    case 'file1-api-config':
    case 'file2-api-config':
      return 'Select config...'
    case 'file1-filetype':
    case 'file2-filetype':
      return 'Select file type...'
    case 'file1-schema':
      return file1UsesJson.value ? 'Select schema...' : 'Select a column list, or continue to type them'
    case 'file2-schema':
      return file2UsesJson.value ? 'Select schema...' : 'Select a column list, or continue to type them'
    case 'file1-primary-id':
      return file1UsesJson.value
        ? (file1JsonSchemaId.value ? 'Select ID field...' : 'Choose a schema first')
        : file1UsesApi.value
          ? 'Select ID field...'
          : 'order_id'
    case 'file2-primary-id':
      return file2UsesJson.value
        ? (file2JsonSchemaId.value ? 'Select ID field...' : 'Choose a schema first')
        : file2UsesApi.value
          ? 'Select ID field...'
          : 'order_id'
    default:
      return ''
  }
})

const showEmptyState = computed(() =>
  ['run-name', 'file1-primary-id', 'file2-primary-id'].includes(currentStep.value.id) &&
  !isSelectStep.value,
)

const isFileTypeChoiceStep = computed(() => currentStep.value.id === 'file1-filetype' || currentStep.value.id === 'file2-filetype')
const isSourceChoiceStep = computed(() => currentStep.value.id === 'file1-source' || currentStep.value.id === 'file2-source')
const isShortcutChoiceStep = computed(() => isSourceChoiceStep.value || isFileTypeChoiceStep.value)
const isSchemaSelectionStep = computed(() => currentStep.value.id === 'file1-schema' || currentStep.value.id === 'file2-schema')

const activeShortcutChoiceTestPrefix = computed(() => {
  switch (currentStep.value.id) {
    case 'file1-source':
      return 'file1-source-choice'
    case 'file1-filetype':
      return 'file1-filetype-choice'
    case 'file2-source':
      return 'file2-source-choice'
    case 'file2-filetype':
      return 'file2-filetype-choice'
    default:
      return 'workflow-choice'
  }
})

const activeShortcutChoiceOptions = computed<WorkflowShortcutChoiceOption[]>(() =>
  (isSourceChoiceStep.value ? sourceModeOptions.value : activeSelectOptions.value).map((option, index) => ({
    value: option.value,
    label: option.label,
    shortcutKey: SHORTCUT_KEYS[index] ?? String(index + 1),
  })),
)

const sourceModeOptions = computed<WorkflowSelectOption[]>(() => [
  { value: SOURCE_MODE_FILE, label: 'File upload' },
  { value: SOURCE_MODE_API, label: 'API' },
])

const systemSelectionError = computed(() => {
  // The "must differ" check is on the concrete resolved value: for a system with no endpoints
  // that lands on file2-system; for one with endpoints, file2SystemEnumId stays blank there and
  // the check applies once file2-endpoint resolves it instead.
  if (currentStep.value.id !== 'file2-system' && currentStep.value.id !== 'file2-endpoint') return ''
  if (!file2SystemEnumId.value) return ''
  if (file1SystemEnumId.value === file2SystemEnumId.value) {
    return 'Source 2 must use a different system than source 1.'
  }
  return ''
})

const schemaSelectionError = computed(() => {
  switch (currentStep.value.id) {
    // JSON only. On a CSV side the step is optional, so "none available" is not a dead end --
    // and raising it here would set canProceed false and trap the user on a step they are
    // entitled to skip, with the chip-text fallback unreachable behind it.
    case 'file1-schema':
      return file1UsesJson.value && buildSchemaOptions(file1SystemEnumId.value).length === 0
        ? `No saved JSON schemas are available for ${file1SystemLabel.value || 'source 1'}.`
        : ''
    case 'file2-schema':
      return file2UsesJson.value && buildSchemaOptions(file2SystemEnumId.value).length === 0
        ? `No saved JSON schemas are available for ${file2SystemLabel.value || 'source 2'}.`
        : ''
    default:
      return ''
  }
})

const schemaFieldSelectionError = computed(() => {
  switch (currentStep.value.id) {
    case 'file1-primary-id':
      if (file1UsesApi.value) {
        return apiPrimaryIdOptions('file1').length === 0
          ? `No ID fields are available for ${apiRecordSourceLabel('file1')}.`
          : ''
      }
      if (!file1UsesJson.value) return ''
      if (!file1JsonSchemaId.value) return 'Choose a schema first.'
      return buildFieldOptions(file1JsonSchemaId.value).length === 0
        ? `No comparable fields are available in ${file1SchemaLabel.value}.`
        : ''
    case 'file2-primary-id':
      if (file2UsesApi.value) {
        return apiPrimaryIdOptions('file2').length === 0
          ? `No ID fields are available for ${apiRecordSourceLabel('file2')}.`
          : ''
      }
      if (!file2UsesJson.value) return ''
      if (!file2JsonSchemaId.value) return 'Choose a schema first.'
      return buildFieldOptions(file2JsonSchemaId.value).length === 0
        ? `No comparable fields are available in ${file2SchemaLabel.value}.`
        : ''
    default:
      return ''
  }
})

const apiSourceConfigSelectionError = computed(() => {
  if (currentStep.value.id !== 'file1-api-config' && currentStep.value.id !== 'file2-api-config') return ''
  const side = currentStep.value.id === 'file1-api-config' ? 'file1' : 'file2'
  return apiSourceConfigOptionsForSide(side).length === 0
    ? `No API configs are available for ${sourceSystemLabel(side)}.`
    : ''
})

const activeSelectError = computed(() => systemSelectionError.value || schemaSelectionError.value || schemaFieldSelectionError.value || apiSourceConfigSelectionError.value)

const apiSourceSelectionError = computed(() => {
  if (currentStep.value.id !== 'file1-api' && currentStep.value.id !== 'file2-api') return ''
  const side = currentStep.value.id === 'file1-api' ? 'file1' : 'file2'
  return apiSourceOptionsForSide(side).length === 0
    ? `No API endpoints are available for ${sourceSystemLabel(side)}.`
    : ''
})

const activeStepError = computed(() => activeSelectError.value || apiSourceSelectionError.value)

// The API cards are the only ones that can strand an operator with nothing to pick and nowhere to
// go. When one of them has an error, offer the same "Or -> go make one" exit the schema card has.
const activeConfigCreateTarget = computed<{ path: string, label: string } | null>(() => {
  const stepId = currentStep.value.id
  const isApiCard = stepId === 'file1-api-config' || stepId === 'file2-api-config' ||
    stepId === 'file1-api' || stepId === 'file2-api'
  if (!isApiCard || !activeStepError.value) return null

  const side: SourceSide = stepId.startsWith('file1') ? 'file1' : 'file2'
  const parentEnumId = side === 'file1' ? file1SystemParentEnumId.value : file2SystemParentEnumId.value
  return CONFIG_CREATE_TARGETS[canonicalDarpanSystemEnumId(parentEnumId)] ?? null
})

const canProceed = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return trimmedRunName.value.length > 0
    case 'description':
      return true
    case 'file1-system':
      return file1SystemParentEnumId.value.length > 0
    case 'file1-endpoint':
      return file1SystemEnumId.value.length > 0
    case 'file1-source':
      return file1SourceMode.value === SOURCE_MODE_FILE || file1SourceMode.value === SOURCE_MODE_API
    case 'file1-filetype':
      return file1FileTypeEnumId.value.length > 0
    case 'file1-schema':
      // Required for JSON, skippable for CSV -- a skipped CSV schema falls back to chip text.
      return (file1UsesJson.value ? file1JsonSchemaId.value.length > 0 : true) && !schemaSelectionError.value
    case 'file1-primary-id':
      return (file1PrimaryIdExpression.value.length > 0 || hasPendingChipText.value) && !schemaFieldSelectionError.value
    case 'file1-api-config':
      return file1SourceConfigId.value.length > 0 && !apiSourceConfigSelectionError.value
    case 'file1-api':
      return hasApiEndpoint('file1') && !apiSourceSelectionError.value
    case 'file2-system':
      // When the chosen system has endpoints, file2SystemEnumId stays blank until file2-endpoint
      // resolves it — the "must differ from source 1" check applies there instead.
      return file2SystemParentEnumId.value.length > 0 &&
        (armHasEndpointStep('file2') || file2SystemEnumId.value !== file1SystemEnumId.value)
    case 'file2-endpoint':
      return file2SystemEnumId.value.length > 0 && file2SystemEnumId.value !== file1SystemEnumId.value
    case 'file2-source':
      return file2SourceMode.value === SOURCE_MODE_FILE || file2SourceMode.value === SOURCE_MODE_API
    case 'file2-filetype':
      return file2FileTypeEnumId.value.length > 0
    case 'file2-schema':
      return (file2UsesJson.value ? file2JsonSchemaId.value.length > 0 : true) && !schemaSelectionError.value
    case 'file2-primary-id':
      return (file2PrimaryIdExpression.value.length > 0 || hasPendingChipText.value) && !schemaFieldSelectionError.value
    case 'file2-api-config':
      return file2SourceConfigId.value.length > 0 && !apiSourceConfigSelectionError.value
    case 'file2-api':
      return hasApiEndpoint('file2') && !apiSourceSelectionError.value
    default:
      return false
  }
})

const canCreateRun = computed(() => {
  return (
    trimmedRunName.value.length > 0 &&
    file1SystemEnumId.value.length > 0 &&
    (file1UsesApi.value
      ? hasApiSourceConfig('file1') && hasApiEndpoint('file1') && file1PrimaryIdExpression.value.length > 0
      : file1FileTypeEnumId.value.length > 0 &&
        (!file1UsesJson.value || !!resolveSchemaFileName(file1JsonSchemaId.value)) &&
        file1PrimaryIdExpression.value.length > 0) &&
    file2SystemEnumId.value.length > 0 &&
    (file2UsesApi.value
      ? hasApiSourceConfig('file2') && hasApiEndpoint('file2') && file2PrimaryIdExpression.value.length > 0
      : file2FileTypeEnumId.value.length > 0 &&
        (!file2UsesJson.value || !!resolveSchemaFileName(file2JsonSchemaId.value)) &&
        file2PrimaryIdExpression.value.length > 0) &&
    file1SystemEnumId.value !== file2SystemEnumId.value
  )
})

watch(
  () => steps.value.length,
  (nextLength) => {
    if (currentStepIndex.value >= nextLength) {
      currentStepIndex.value = Math.max(0, nextLength - 1)
    }
  },
)

watch(file1JsonSchemaId, async (nextSchemaId) => {
  if (!nextSchemaId) return
  await ensureFieldsLoaded(nextSchemaId)
  if (currentStep.value.id === 'file1-schema' && file1JsonSchemaId.value === nextSchemaId) {
    await focusActiveSelectTrigger()
  }
})

watch(file2JsonSchemaId, async (nextSchemaId) => {
  if (!nextSchemaId) return
  await ensureFieldsLoaded(nextSchemaId)
  if (currentStep.value.id === 'file2-schema' && file2JsonSchemaId.value === nextSchemaId) {
    await focusActiveSelectTrigger()
  }
})

function resolveSystemLabel(enumId: string): string {
  // Reads the full list (parents + endpoints), not the step 1-only systemOptions, so a concrete
  // endpoint value like OMS_RETURNS still resolves to its own distinct label everywhere downstream
  // (schema labels, "source 1" phrasing, etc.) rather than falling back to the raw enumId.
  const option = allSystemOptions.value.find((systemOption) => systemOption.value === enumId)
  return softenSystemLabel(option?.label || enumId)
}

function endpointOptionsForParent(parentEnumId: string): WorkflowSelectOption[] {
  return darpanSystemEndpointOptions(parentEnumId, resolveSystemLabel(parentEnumId), allSystemOptions.value)
}

function formatSchemaLabel(schema: JsonSchemaSummary): string {
  return resolveSchemaLabel({
    ...schema,
    systemLabel: softenSystemLabel(schema.systemLabel || schema.systemEnumId || ''),
  })
}

function buildSchemaOptions(systemEnumId: string, requireFlat = false): WorkflowSelectOption[] {
  return jsonSchemas.value
    .filter((schema) => !systemEnumId || darpanSystemIdsMatch(schema.systemEnumId, systemEnumId))
    // A CSV side can only carry flat columns. A nested schema here would hand the board dotted
    // paths that no CSV column matches, and the run would match nothing with no error at all.
    // undefined (a backend predating isFlatFieldList) reads as "not proven flat" and is excluded.
    .filter((schema) => !requireFlat || schema.isFlatFieldList === true)
    .map((schema) => ({
      value: schema.jsonSchemaId,
      label: formatSchemaLabel(schema),
    }))
}

function buildFieldOptions(schemaId: string): WorkflowSelectOption[] {
  return (flattenedFields.value[schemaId] ?? []).map((field) => ({
    value: field.fieldPath,
    label: field.fieldPath,
  }))
}

// CSV columns get name-ranked so likely keys surface first. JSON keeps schema order, which is
// meaningful there and is what every existing run and test already expects.
function buildRankedFieldOptions(schemaId: string, usesJson: boolean): WorkflowSelectOption[] {
  const options = buildFieldOptions(schemaId)
  if (usesJson || !schemaId) return options

  const optionsByPath = new Map(options.map((option) => [option.value, option]))
  return rankPrimaryIdCandidates(options.map((option) => option.value))
    .map((fieldPath) => optionsByPath.get(fieldPath))
    .filter((option): option is WorkflowSelectOption => option !== undefined)
}

function resolveSchemaFileName(schemaId: string): string | undefined {
  const schema = jsonSchemas.value.find((candidate) => candidate.jsonSchemaId === schemaId)
  return schema?.schemaName || undefined
}

function resolveSelectedSchemaLabel(schemaId: string): string | undefined {
  const schema = jsonSchemas.value.find((candidate) => candidate.jsonSchemaId === schemaId)
  return schema ? formatSchemaLabel(schema) : undefined
}

type SourceSide = 'file1' | 'file2'

// Falls back to the parent system's label before the generic "source N". The source card now runs
// BEFORE the endpoint card, so file{n}SystemEnumId is still blank there for a system with
// endpoints -- without this fallback that card would read "How should source 1 provide data?".
function sourceSystemLabel(side: SourceSide): string {
  const resolvedLabel = side === 'file1' ? file1SystemLabel.value : file2SystemLabel.value
  if (resolvedLabel) return resolvedLabel

  const parentEnumId = side === 'file1' ? file1SystemParentEnumId.value : file2SystemParentEnumId.value
  return resolveSystemLabel(parentEnumId) || (side === 'file1' ? 'source 1' : 'source 2')
}

function apiRecordSourceLabel(side: SourceSide): string {
  return selectedApiSourceLabel(side) || sourceSystemLabel(side)
}

function selectedSystemEnumId(side: SourceSide): string {
  return side === 'file1' ? file1SystemEnumId.value : file2SystemEnumId.value
}

function endpointMatchesSystem(endpointSystemEnumId: string | undefined, selectedSystemEnumIdValue: string): boolean {
  return darpanSystemIdsMatch(endpointSystemEnumId, selectedSystemEnumIdValue)
}

function selectedSourceConfigId(side: SourceSide): string {
  return side === 'file1' ? file1SourceConfigId.value : file2SourceConfigId.value
}

// Scoped to the PARENT system, not to a chosen endpoint: this card now runs before the endpoint
// one. The backend returns a row per (config x endpoint), so a config with three endpoints enabled
// arrives three times -- collapse to one option each, and let the endpoint card do the narrowing.
function apiSourceConfigOptionsForSide(side: SourceSide): WorkflowSelectOption[] {
  const parentEnumId = armParentEnumId(side)
  const seenConfigIds = new Set<string>()
  return sourceConfigs.value
    .filter((config) => sourceConfigBelongsToParentSystem(config, parentEnumId))
    .filter((config) => {
      const sourceConfigId = config.sourceConfigId?.trim() ?? ''
      if (!sourceConfigId || seenConfigIds.has(sourceConfigId)) return false
      seenConfigIds.add(sourceConfigId)
      return true
    })
    .map((config) => ({
      value: config.sourceConfigId,
      label: config.label || config.description || config.sourceConfigId,
    }))
}

// A config row carries its ENDPOINT's systemEnumId (OMS_RETURNS), so matching it against a parent
// (OMS) means resolving that endpoint back to its parent first. A row with no systemEnumId is
// unscoped and belongs to every system.
function sourceConfigBelongsToParentSystem(config: AutomationSourceConfigOption, parentEnumId: string): boolean {
  if (!config.systemEnumId?.trim()) return true
  if (!parentEnumId) return false
  return darpanSystemIdsMatch(
    resolveDarpanSystemParentEnumId(config.systemEnumId, allSystemOptions.value),
    parentEnumId,
  )
}

function apiSourceOptionsForSide(side: SourceSide): WorkflowSelectOption[] {
  const systemEnumId = selectedSystemEnumId(side)
  const sourceConfigId = selectedSourceConfigId(side)
  if (!sourceConfigId) return []

  return [
    ...nsRestletConfigs.value
      .filter((config) => endpointMatchesSystem(config.systemEnumId, systemEnumId))
      .filter((config) => sourceConfigMatches(config.sourceConfigId || config.nsAuthConfigId, sourceConfigId))
      .map((config) => ({
        value: `ns:${config.nsRestletConfigId}`,
        label: config.label || config.description || config.nsRestletConfigId,
      })),
    ...systemRemotes.value
      .filter((remote) => endpointMatchesSystem(remote.systemEnumId, systemEnumId))
      .filter((remote) => sourceConfigMatches(remote.sourceConfigId || remote.optionKey, sourceConfigId))
      .map((remote) => ({
        value: remoteSelectValue(remote),
        label: remote.label || remote.description || remote.systemMessageRemoteId,
      })),
  ]
}

function sourceConfigMatches(candidate: string | undefined, selected: string): boolean {
  return Boolean(candidate?.trim() && selected.trim() && candidate.trim() === selected.trim())
}

function remoteSelectValue(remote: AutomationSystemRemoteOption): string {
  const optionKey = remote.optionKey || remote.sourceConfigId
  return optionKey ? `remote:${remote.systemMessageRemoteId}:${optionKey}` : `remote:${remote.systemMessageRemoteId}`
}

function hasApiSourceConfig(side: SourceSide): boolean {
  return Boolean(selectedSourceConfigId(side))
}

function hasApiEndpoint(side: SourceSide): boolean {
  return side === 'file1'
    ? Boolean(file1NsRestletConfigId.value || file1SystemMessageRemoteId.value)
    : Boolean(file2NsRestletConfigId.value || file2SystemMessageRemoteId.value)
}

function selectedApiSourceValue(side: SourceSide): string {
  if (side === 'file1') {
    if (file1NsRestletConfigId.value) return `ns:${file1NsRestletConfigId.value}`
    if (file1SystemMessageRemoteId.value) {
      const selectedRemote = selectedRemoteOptionForSide(side)
      return selectedRemote ? remoteSelectValue(selectedRemote) : `remote:${file1SystemMessageRemoteId.value}`
    }
    return ''
  }

  if (file2NsRestletConfigId.value) return `ns:${file2NsRestletConfigId.value}`
  if (file2SystemMessageRemoteId.value) {
    const selectedRemote = selectedRemoteOptionForSide(side)
    return selectedRemote ? remoteSelectValue(selectedRemote) : `remote:${file2SystemMessageRemoteId.value}`
  }
  return ''
}

/**
 * Answer the config card. sourceConfigType is deliberately NOT set here: it belongs to a
 * (config x endpoint) row, and the endpoint is the next card. syncSoleApiEndpoint fills both in
 * when the config leaves exactly one endpoint and that card is skipped.
 */
function updateApiSourceConfig(side: SourceSide, value: string): void {
  if (side === 'file1') {
    file1SourceConfigId.value = value
    file1SourceConfigType.value = ''
    file1SystemEnumId.value = ''
    file1PrimaryIdExpression.value = []
    clearApiEndpoint('file1')
  } else {
    file2SourceConfigId.value = value
    file2SourceConfigType.value = ''
    file2SystemEnumId.value = ''
    file2PrimaryIdExpression.value = []
    clearApiEndpoint('file2')
  }

  syncSoleApiEndpoint(side)
}

// When apiSourceOptionsForSide narrows to exactly one option, the file{n}-api card is skipped
// (see file1ApiSourceStepNeeded/file2ApiSourceStepNeeded) -- select that option here so the
// primary-id step and the saved payload end up in the same state they would if the operator had
// picked it by hand. Zero and 2+ option counts leave the endpoint refs alone: the card still
// renders for those, and updateApiSource(side, value) drives selection from there instead.
function autoSelectSoleApiSource(side: SourceSide): void {
  const options = apiSourceOptionsForSide(side)
  if (options.length === 1) {
    updateApiSource(side, options[0]!.value)
  }
}

function updateApiSource(side: SourceSide, value: string): void {
  if (side === 'file1') {
    file1PrimaryIdExpression.value = []
  } else {
    file2PrimaryIdExpression.value = []
  }

  if (value.startsWith('ns:')) {
    if (side === 'file1') {
      file1NsRestletConfigId.value = value.slice(3)
      file1SystemMessageRemoteId.value = ''
    } else {
      file2NsRestletConfigId.value = value.slice(3)
      file2SystemMessageRemoteId.value = ''
    }
    return
  }

  if (value.startsWith('remote:')) {
    const [, remoteId = ''] = value.split(':')
    if (side === 'file1') {
      file1SystemMessageRemoteId.value = remoteId
      file1NsRestletConfigId.value = ''
    } else {
      file2SystemMessageRemoteId.value = remoteId
      file2NsRestletConfigId.value = ''
    }
  }
}

function clearApiSourceConfig(side: SourceSide): void {
  if (side === 'file1') {
    file1SourceConfigId.value = ''
    file1SourceConfigType.value = ''
    clearApiEndpoint('file1')
    return
  }

  file2SourceConfigId.value = ''
  file2SourceConfigType.value = ''
  clearApiEndpoint('file2')
}

function clearApiEndpoint(side: SourceSide): void {
  if (side === 'file1') {
    file1NsRestletConfigId.value = ''
    file1SystemMessageRemoteId.value = ''
    return
  }

  file2NsRestletConfigId.value = ''
  file2SystemMessageRemoteId.value = ''
}

function setSourceMode(side: SourceSide, value: string): void {
  const sourceMode = value === SOURCE_MODE_API ? SOURCE_MODE_API : SOURCE_MODE_FILE
  if (side === 'file1') {
    file1SourceMode.value = sourceMode
    file1PrimaryIdExpression.value = []
    if (sourceMode === SOURCE_MODE_API) {
      file1JsonSchemaId.value = ''
    } else {
      clearApiSourceConfig('file1')
      syncFileEndpointSelection('file1')
    }
    return
  }

  file2SourceMode.value = sourceMode
  file2PrimaryIdExpression.value = []
  if (sourceMode === SOURCE_MODE_API) {
    file2JsonSchemaId.value = ''
  } else {
    clearApiSourceConfig('file2')
    syncFileEndpointSelection('file2')
  }
}

function selectedApiSourceOption(side: SourceSide): AutomationNsRestletOption | AutomationSystemRemoteOption | null {
  const selectedValue = selectedApiSourceValue(side)
  if (selectedValue.startsWith('ns:')) {
    const configId = selectedValue.slice(3)
    return nsRestletConfigs.value.find((config) => config.nsRestletConfigId === configId) ?? null
  }
  if (selectedValue.startsWith('remote:')) {
    return selectedRemoteOptionForSide(side)
  }
  return null
}

function selectedRemoteOptionForSide(side: SourceSide): AutomationSystemRemoteOption | null {
  const remoteId = side === 'file1' ? file1SystemMessageRemoteId.value : file2SystemMessageRemoteId.value
  const systemEnumId = selectedSystemEnumId(side)
  const sourceConfigId = selectedSourceConfigId(side)
  if (!remoteId) return null
  return systemRemotes.value.find((remote) =>
    remote.systemMessageRemoteId === remoteId &&
    endpointMatchesSystem(remote.systemEnumId, systemEnumId) &&
    (!sourceConfigId || sourceConfigMatches(remote.sourceConfigId || remote.optionKey, sourceConfigId)),
  ) ?? null
}

function selectedApiSourceLabel(side: SourceSide): string {
  const option = selectedApiSourceOption(side)
  return option?.label || option?.description || ''
}

function apiPrimaryIdOptions(side: SourceSide): WorkflowSelectOption[] {
  const rawOptions = selectedApiSourceOption(side)?.primaryIdOptions ?? []
  return rawOptions.flatMap((option: AutomationPrimaryIdOption) => {
    const fieldPath = option.fieldPath?.trim()
    if (!fieldPath) return []
    return [{
      value: fieldPath,
      label: option.label || fieldPath,
    }]
  })
}

function softenSystemLabel(label: string): string {
  const trimmedLabel = label.trim()
  if (!trimmedLabel) return ''

  const override = SYSTEM_LABEL_OVERRIDES[trimmedLabel.toUpperCase()]
  if (override) return override

  if (trimmedLabel === trimmedLabel.toUpperCase() && trimmedLabel.length > 3) {
    return trimmedLabel.toLowerCase().replace(/\b[a-z]/g, (character) => character.toUpperCase())
  }

  return trimmedLabel
}

async function ensureFieldsLoaded(schemaId: string): Promise<void> {
  if (!schemaId || flattenedFields.value[schemaId]) return

  pendingSchemaFieldLoads.value += 1
  pageError.value = null

  try {
    const response = await jsonSchemaFacade.flatten({ jsonSchemaId: schemaId }, pageAbortController.signal)
    const comparableFields = (response.fieldList ?? []).filter((field) => field.type !== 'object' && field.type !== 'array')
    flattenedFields.value = {
      ...flattenedFields.value,
      [schemaId]: comparableFields,
    }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof ApiCallError ? error.message : 'Unable to load schema fields.'
  } finally {
    pendingSchemaFieldLoads.value = Math.max(0, pendingSchemaFieldLoads.value - 1)
  }
}

async function focusActiveSelectTrigger(): Promise<void> {
  await nextTick()

  const formRoot = stepForm.value?.$el
  if (!(formRoot instanceof HTMLElement)) return

  const activeTrigger = formRoot.querySelector<HTMLElement>(`[data-testid="${activeSelectTestId.value}"]`)
  if (!activeTrigger) return

  activeTrigger.focus()
}

function resolveActiveShortcutChoiceByKey(key: string): string | null {
  const normalizedKey = key.trim().toLowerCase()
  if (!normalizedKey) return null

  const matchedOption = activeShortcutChoiceOptions.value.find((option) => option.shortcutKey.toLowerCase() === normalizedKey)
  return matchedOption?.value ?? null
}

function advanceFromShortcutChoice(value: string): void {
  if (!isShortcutChoiceStep.value || loadingSelections.value) return

  activeSelectValue.value = value
  if (!canProceed.value) return

  currentStepIndex.value = Math.min(currentStepIndex.value + 1, steps.value.length - 1)
}

function handleShortcutChoiceKeydown(event: KeyboardEvent): void {
  if (!isShortcutChoiceStep.value) return
  if (event.defaultPrevented || event.repeat || event.isComposing) return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

  const matchedChoice = resolveActiveShortcutChoiceByKey(event.key)
  if (!matchedChoice) return

  event.preventDefault()
  advanceFromShortcutChoice(matchedChoice)
}

function goBack(): void {
  pageError.value = null
  currentStepIndex.value = Math.max(currentStepIndex.value - 1, 0)
}

/**
 * The rules board mutates the shared draft store's rules/exclusions directly (see
 * RuleSetBoard's syncRulesToDraft and applyExclusionEdit) rather than emitting them back here.
 * Prefer whatever the store currently holds — that reflects the board's latest edits — and fall
 * back to the last known values (from a seeded/resumed draft) only before the board has written
 * anything of its own.
 */
function boardDraftExtras(): Pick<ReconciliationRuleSetDraft, 'rules' | 'file1ExcludeFilters' | 'file2ExcludeFilters'> {
  const existing = draftStore.ruleSetDraftState?.draft
  return {
    rules: existing?.rules ?? ruleSetDraftExtras.value.rules,
    file1ExcludeFilters: existing?.file1ExcludeFilters ?? ruleSetDraftExtras.value.file1ExcludeFilters,
    file2ExcludeFilters: existing?.file2ExcludeFilters ?? ruleSetDraftExtras.value.file2ExcludeFilters,
  }
}

/**
 * Publish the wizard's current answers into the shared draft store so the rules board — which
 * takes no props and reads only that store — has something to render and edit. Called once when
 * the wizard lands on the final step, whether by clicking through or by resuming a seeded draft.
 */
function publishDraftForDetour(resumeStepId: ReconciliationRuleSetDraftStepId): void {
  draftStore.setRuleSetDraft({ ...activeDraft.value, ...boardDraftExtras() }, resumeStepId)
}

function seedRuleSetBoardDraft(): void {
  publishDraftForDetour('ruleset-manager')
}

/**
 * Leave the wizard for a settings/schema workflow and come back to the same card with the same
 * answers. Without the publish the draft store is empty on return and restoreDraftFromHistoryState
 * has nothing to hydrate, so the operator restarts from card one -- which is what the schema
 * detour did before this.
 */
async function openCreateDetour(path: string): Promise<void> {
  continuingFlowElsewhere = true
  publishDraftForDetour(currentStep.value.id)
  draftStore.setWorkflowOrigin('Reconciliation Setup', '/reconciliation/create')
  await router.push({ path })
}

async function restoreDraftFromHistoryState(): Promise<void> {
  const draftState = draftStore.ruleSetDraftState
  if (!draftState) return

  runName.value = draftState.draft.runName
  description.value = draftState.draft.description ?? ''
  file1SystemEnumId.value = draftState.draft.file1SystemEnumId
  file1SourceMode.value = draftState.draft.file1SourceTypeEnumId === SOURCE_TYPE_API ? SOURCE_MODE_API : SOURCE_MODE_FILE
  file1FileTypeEnumId.value = draftState.draft.file1FileTypeEnumId
  file1JsonSchemaId.value = draftState.draft.file1JsonSchemaId ?? ''
  file1PrimaryIdExpression.value = draftState.draft.file1PrimaryIdExpression
  file1SourceConfigId.value = draftState.draft.file1SourceConfigId ?? ''
  file1SourceConfigType.value = draftState.draft.file1SourceConfigType ?? ''
  file1NsRestletConfigId.value = draftState.draft.file1NsRestletConfigId ?? ''
  file1SystemMessageRemoteId.value = draftState.draft.file1SystemMessageRemoteId ?? ''
  file2SystemEnumId.value = draftState.draft.file2SystemEnumId
  file2SourceMode.value = draftState.draft.file2SourceTypeEnumId === SOURCE_TYPE_API ? SOURCE_MODE_API : SOURCE_MODE_FILE
  file2FileTypeEnumId.value = draftState.draft.file2FileTypeEnumId
  file2JsonSchemaId.value = draftState.draft.file2JsonSchemaId ?? ''
  file2PrimaryIdExpression.value = draftState.draft.file2PrimaryIdExpression
  file2SourceConfigId.value = draftState.draft.file2SourceConfigId ?? ''
  file2SourceConfigType.value = draftState.draft.file2SourceConfigType ?? ''
  file2NsRestletConfigId.value = draftState.draft.file2NsRestletConfigId ?? ''
  file2SystemMessageRemoteId.value = draftState.draft.file2SystemMessageRemoteId ?? ''
  // Resolve step 1's answer from the resumed concrete value (e.g. OMS_RETURNS -> OMS) BEFORE
  // steps.value is read below — steps.value only includes file{n}-endpoint when the parent has
  // one, so this must be set first or a resumeStepId targeting that step would not be found.
  file1SystemParentEnumId.value = resolveDarpanSystemParentEnumId(file1SystemEnumId.value, allSystemOptions.value)
  file2SystemParentEnumId.value = resolveDarpanSystemParentEnumId(file2SystemEnumId.value, allSystemOptions.value)
  // A draft written before the file branch dropped API-only endpoints can still name one.
  syncFileEndpointSelection('file1')
  syncFileEndpointSelection('file2')
  ruleSetDraftExtras.value = {
    rules: draftState.draft.rules,
    file1ExcludeFilters: draftState.draft.file1ExcludeFilters,
    file2ExcludeFilters: draftState.draft.file2ExcludeFilters,
  }

  const targetStepId = draftState.resumeStepId ?? steps.value[steps.value.length - 1]?.id
  const targetStepIndex = steps.value.findIndex((step) => step.id === targetStepId)
  currentStepIndex.value = targetStepIndex >= 0 ? targetStepIndex : Math.max(0, steps.value.length - 1)

  // One-shot seed: consume the draft immediately so exiting mid-creation never resumes it
  // on a later visit — a fresh /reconciliation/create must always start clean.
  draftStore.clearRuleSetDraft()

  if (currentStep.value.id === 'ruleset-rules') {
    seedRuleSetBoardDraft()
  }

  await Promise.all([
    file1JsonSchemaId.value ? ensureFieldsLoaded(file1JsonSchemaId.value) : Promise.resolve(),
    file2JsonSchemaId.value ? ensureFieldsLoaded(file2JsonSchemaId.value) : Promise.resolve(),
  ])
}

const pageAbortController = new AbortController()
let submitController: AbortController | null = null

// Exiting the wizard discards all progress: any draft state left in the store would silently
// resume on the next visit. Skipped only when the navigation IS the flow continuing elsewhere
// (schema-create detour, automation new-run handoff), where the draft must survive the hop.
let continuingFlowElsewhere = false

onBeforeUnmount(() => {
  pageAbortController.abort()
  submitController?.abort()
})

onUnmounted(() => {
  if (continuingFlowElsewhere) return
  draftStore.clearRuleSetDraft()
  draftStore.clearAutomationDraft()
})

async function loadOptions(): Promise<void> {
  loadingOptions.value = true
  pageError.value = null

  try {
    const [schemasResponse, automationSourceOptionsResponse] = await Promise.all([
      jsonSchemaFacade.list({
        pageIndex: 0,
        pageSize: 200,
        query: '',
      }, pageAbortController.signal),
      reconciliationFacade.listAutomationSourceOptions(pageAbortController.signal),
    ])

    allSystemOptions.value = deduplicateDarpanSystemOptions(automationSourceOptionsResponse.systems ?? []).map((option) => ({
      value: option.enumId,
      label: option.label || option.enumId,
      parentEnumId: option.parentEnumId || undefined,
    }))
    fileTypeOptions.value = (automationSourceOptionsResponse.fileTypes ?? []).map((option) => ({
      value: option.enumId,
      label: option.label || option.description || option.enumCode || option.enumId,
    }))
    jsonSchemas.value = schemasResponse.schemas ?? []
    sourceConfigs.value = automationSourceOptionsResponse.sourceConfigs ?? []
    nsRestletConfigs.value = automationSourceOptionsResponse.nsRestletConfigs ?? []
    systemRemotes.value = automationSourceOptionsResponse.systemRemotes ?? []
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof ApiCallError ? error.message : 'Unable to load reconciliation setup options.'
  } finally {
    loadingOptions.value = false
  }
}

async function handlePrimarySubmit(): Promise<void> {
  // Commit whatever is still sitting in the chip input before anything reads the draft. Without
  // this, a primary-id typed but never Enter-ed is dropped, canProceed stays false and the step
  // silently refuses to advance -- the same trap that made rule-set exclusions look inert.
  chipTextInputRef.value?.commitPendingValue()

  if (isCreateStep.value) {
    await createRun()
    return
  }

  if (!canProceed.value) return
  currentStepIndex.value = Math.min(currentStepIndex.value + 1, steps.value.length - 1)
  if (currentStep.value.id === 'ruleset-rules') {
    seedRuleSetBoardDraft()
  }
}

async function openSchemaCreateWorkflow(): Promise<void> {
  await openCreateDetour('/schemas/create')
}

async function openConfigCreateWorkflow(): Promise<void> {
  const target = activeConfigCreateTarget.value
  if (!target) return
  await openCreateDetour(target.path)
}

function isAutomationCreateRoute(): boolean {
  const automationFlow = route.query.automationFlow
  return automationFlow === 'new-run' || (Array.isArray(automationFlow) && automationFlow.includes('new-run'))
}

function readAutomationHandoffDraft() {
  const storeDraft = draftStore.automationDraftState
  if (storeDraft?.draft.intent === 'new-run') return storeDraft
  return isAutomationCreateRoute() ? storeDraft : null
}

async function createRun(): Promise<void> {
  if (!canCreateRun.value) return

  pageError.value = null

  submitController?.abort()
  submitController = new AbortController()
  const submitSignal = submitController.signal

  try {
    // rules/exclusions live only on the shared draft store by the time we get here — the board
    // that drew them takes no props and emits nothing (see boardDraftExtras above).
    const draftForPayload: ReconciliationRuleSetDraft = { ...activeDraft.value, ...boardDraftExtras() }
    const response = await reconciliationFacade.createRuleSetRun(buildCreateRuleSetRunPayload(draftForPayload), submitSignal)
    if (!response.savedRun?.savedRunId) {
      throw new Error('Missing saved run identifier.')
    }
    const automationDraftState = readAutomationHandoffDraft()
    if (automationDraftState?.draft.intent === 'new-run') {
      const nextDraft = {
        ...automationDraftState.draft,
        savedRunId: response.savedRun.savedRunId,
        savedRunType: response.savedRun.runType || 'ruleset',
        automationName: automationDraftState.draft.automationName || buildDefaultAutomationName(response.savedRun.runName),
        returnLabel: automationDraftState.draft.returnLabel || 'Automations',
        returnPath: automationDraftState.draft.returnPath || '/reconciliation/automations',
      }
      draftStore.setAutomationDraft(nextDraft, 'input-mode', response.savedRun)
      draftStore.setWorkflowOrigin(nextDraft.returnLabel, nextDraft.returnPath)
      continuingFlowElsewhere = true
      // continuingFlowElsewhere only protects the automation handoff draft from onUnmounted's
      // cleanup — it says nothing about the ruleset draft seedRuleSetBoardDraft() published so
      // the board had something to read/write. That one is unrelated and must not survive a
      // completed create: left in place, a later /reconciliation/create visit would resume
      // straight onto the board with this just-created run's answers and a live "Save run",
      // one click away from creating a duplicate.
      draftStore.clearRuleSetDraft()
      await router.push({ path: '/reconciliation/automation/create' })
      draftStore.clearAutomationDraft()
      return
    }

    const workflowOrigin = draftStore.workflowOrigin
    await router.push(workflowOrigin?.path ?? { name: 'hub' })
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof ApiCallError ? error.message : 'Unable to create reconciliation flow.'
  }
}

onMounted(async () => {
  await loadOptions()
  await restoreDraftFromHistoryState()
})

onMounted(() => {
  window.addEventListener('keydown', handleShortcutChoiceKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleShortcutChoiceKeydown)
})
</script>

<style scoped>
.reconciliation-create-schema-choice {
  display: grid;
  gap: var(--space-1);
  justify-items: start;
}

.reconciliation-create-schema-link {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
</style>
