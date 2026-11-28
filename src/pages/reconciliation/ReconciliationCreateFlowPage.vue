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
      :show-primary-action="!isShortcutChoiceStep || isCreateStep"
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
            v-model="activePrimaryIdValues"
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

        <a
          v-if="newQueryHref"
          class="wizard-secondary-link reconciliation-create-schema-link"
          data-testid="new-suiteql-query"
          :href="newQueryHref"
          @click.prevent="openNewQueryWorkflow"
        >New query</a>

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

      <template v-else-if="isOptionsStep">
        <div class="workflow-choice-grid" :data-testid="`${activeOptionsSide}-options`">
          <label
            v-for="option in activeBooleanExtractOptions"
            :key="option.name"
            :class="[
              'workflow-choice-option',
              'workflow-choice-option--filter',
              { 'workflow-choice-option--active': extractOptionChecked(option.name) },
            ]"
          >
            <input
              type="checkbox"
              :name="option.name"
              :data-testid="`${activeOptionsSide}-option-${option.name}`"
              :checked="extractOptionChecked(option.name)"
              @change="setExtractOption(option.name, ($event.target as HTMLInputElement).checked)"
            />
            <span class="workflow-choice-label">{{ option.label }}</span>
          </label>
        </div>
        <label v-for="option in activeTextExtractOptions" :key="option.name" class="wizard-input-shell">
          <span class="workflow-context-label">{{ option.label }}</span>
          <input
            :name="option.name"
            :data-testid="`${activeOptionsSide}-option-${option.name}`"
            class="wizard-answer-control"
            :value="extractOptionText(option.name)"
            @input="setExtractOption(option.name, ($event.target as HTMLInputElement).value)"
          />
        </label>
      </template>

      <template v-else-if="isChipTextStep">
        <WorkflowChipTextInput
          ref="chipTextInputRef"
          v-model="activePrimaryIdValues"
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
import { useChoiceShortcuts } from '../../composables/useChoiceShortcuts'
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
import { netSuiteQueryFacade } from '../../lib/api/authoringFacade'
import type { SourceExtractOption, SourceExtractOptions } from '../../lib/api/authoringTypes'
import type {
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
  SOURCE_TYPE_API,
} from '../../lib/reconciliationRuleSetDraft'
import {
  canonicalDarpanSystemEnumId,
  darpanSystemEndpointOptions,
  darpanSystemFamily,
  darpanSystemHasEndpointOptions,
  darpanSystemIdsMatch,
  darpanSystemParentOptions,
  darpanSystemsInOneFamily,
  deduplicateDarpanSystemOptions,
  excludeApiOnlyEndpointOptions,
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
  // Name and description (the run-kind card is gone: Create a run asks the kind first, DAR-UI-054). This is the
  // hardcoded-count half of the pattern: adding a card to a stage without raising its ceiling is silent, because
  // Math.min caps the fraction at 1 — the bar simply stops moving for the last card of the stage instead of failing.
  name: 2,
  // 7: an API side's system, source, endpoint, config, API, key and extract options.
  file1: 7,
  file2: 7,
  rules: 1,
}

const FILE_TYPE_JSON = 'DftJson'
const FILE_TYPE_CSV = 'DftCsv'
const SOURCE_MODE_FILE = 'file'
const SOURCE_MODE_API = 'api'
const SHORTCUT_KEYS = ['A', 'B', 'C', 'D', 'E', 'F']
// A run side over a saved NetSuite SuiteQL query: the config IS the query, and there is no endpoint card after it.
const SOURCE_CONFIG_TYPE_SUITEQL = 'NETSUITE_SUITEQL'
const SUITEQL_RECORD_ROOT = '$.records[*].'
const NEW_QUERY_PATH = '/reconciliation/queries/new'
const CREATE_FLOW_PATH = '/reconciliation/create'
// DAR-UI-064. /reconciliation/create?scope=EVALUATE builds one source and no second side: every record it
// returns is a finding (the gorjana month-close checks). Create a run still asks the kind of run once.
const SCOPE_EVALUATE = 'EVALUATE'
const SCOPE_COMPARE = 'COMPARE'
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
// (e.g. OMS_RETURNS_GQL) keep resolving to their own distinct label everywhere else in the wizard.
const allSystemOptions = ref<Array<WorkflowSelectOption & DarpanSystemValueOption>>([])
const systemOptions = computed<WorkflowSelectOption[]>(() => darpanSystemParentOptions(allSystemOptions.value))
// Tracks the system chosen at step 1 independent of the concrete endpoint value: when the chosen
// system has endpoints, file{n}SystemEnumId stays blank until step 2 resolves it.
const file1SystemParentEnumId = ref('')
const file2SystemParentEnumId = ref('')
const fileTypeOptions = ref<WorkflowSelectOption[]>([])
const sourceConfigs = ref<AutomationSourceConfigOption[]>([])
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
const file1SystemMessageRemoteId = ref('')
const file2SystemEnumId = ref('')
const file2SourceMode = ref(SOURCE_MODE_FILE)
const file2FileTypeEnumId = ref(FILE_TYPE_CSV)
const file2JsonSchemaId = ref('')
const file2PrimaryIdExpression = ref<string[]>([])
const file2SourceConfigId = ref('')
const file2SourceConfigType = ref('')
const file2SystemMessageRemoteId = ref('')
const scopeMode = ref(readQueryValue('scope').toUpperCase() === SCOPE_EVALUATE ? SCOPE_EVALUATE : SCOPE_COMPARE)
const isSingleSided = computed(() => scopeMode.value === SCOPE_EVALUATE)
const file1ExtractOptions = ref<SourceExtractOptions>({})
const file2ExtractOptions = ref<SourceExtractOptions>({})
// A SuiteQL query's record field names, by query id: undefined while loading, null when the read failed.
const suiteQlQueryFields = ref<Record<string, string[] | null>>({})
const pendingQueryFieldLoads = ref(0)

type SourceSide = 'file1' | 'file2'
const SIDES: readonly SourceSide[] = ['file1', 'file2']

// One side's answers, by side, so each card's question, options and checks are written once. The refs stay
// named as well: activeDraft and the draft restore read them field by field, as the save contract names them.
const arms = {
  file1: {
    parentEnumId: file1SystemParentEnumId,
    systemEnumId: file1SystemEnumId,
    sourceMode: file1SourceMode,
    fileTypeEnumId: file1FileTypeEnumId,
    jsonSchemaId: file1JsonSchemaId,
    primaryIdExpression: file1PrimaryIdExpression,
    sourceConfigId: file1SourceConfigId,
    sourceConfigType: file1SourceConfigType,
    systemMessageRemoteId: file1SystemMessageRemoteId,
    extractOptions: file1ExtractOptions,
  },
  file2: {
    parentEnumId: file2SystemParentEnumId,
    systemEnumId: file2SystemEnumId,
    sourceMode: file2SourceMode,
    fileTypeEnumId: file2FileTypeEnumId,
    jsonSchemaId: file2JsonSchemaId,
    primaryIdExpression: file2PrimaryIdExpression,
    sourceConfigId: file2SourceConfigId,
    sourceConfigType: file2SourceConfigType,
    systemMessageRemoteId: file2SystemMessageRemoteId,
    extractOptions: file2ExtractOptions,
  },
}

/** The cards a source side can show; a side's step id is `<side>-<card>`. */
type ArmCard = 'system' | 'endpoint' | 'source' | 'filetype' | 'schema' | 'primary-id' | 'api-config' | 'api' | 'options'

function armStep(stepId: StepId): { side: SourceSide, card: ArmCard } | null {
  const match = /^(file[12])-(.+)$/.exec(stepId)
  return match ? { side: match[1] as SourceSide, card: match[2] as ArmCard } : null
}

function sourceNumberLabel(side: SourceSide): string {
  return side === 'file1' ? 'source 1' : 'source 2'
}

// The rules board (final step) reads and writes these directly off the shared draft store — it
// takes no props and emits nothing, so this is the only channel back to the wizard's own payload
// build. Not modeled as scalar refs like the rest of the draft above because the board owns their
// entire editing UI; the wizard only ever needs to carry the latest known value forward.
const ruleSetDraftExtras = ref<Pick<ReconciliationRuleSetDraft, 'rules' | 'file1ExcludeFilters' | 'file2ExcludeFilters'>>({})

const loadingSelections = computed(() => loadingOptions.value || loadingSchemaFields.value || pendingQueryFieldLoads.value > 0)
const file1UsesApi = computed(() => armUsesApi('file1'))
const file2UsesApi = computed(() => armUsesApi('file2'))

function armUsesJson(side: SourceSide): boolean {
  return arms[side].fileTypeEnumId.value === FILE_TYPE_JSON
}

function schemaLabel(side: SourceSide): string {
  return resolveSelectedSchemaLabel(arms[side].jsonSchemaId.value) ?? sourceNumberLabel(side)
}

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
  if (armExtractOptions(side).length) armSteps.push({ id: `${side}-options` as StepId })
  return armSteps
}

const steps = computed<WizardStep[]>(() => (isSingleSided.value
  // A single-sided run has no second source and no field pairs to draw, so it saves from its last source card.
  ? [{ id: 'run-name' }, { id: 'description' }, ...sourceArmSteps('file1')]
  : [
      { id: 'run-name' },
      { id: 'description' },
      ...sourceArmSteps('file1'),
      ...sourceArmSteps('file2'),
      // Final step regardless of source shape: the rules board, so comparison rules and exclusions
      // are set before the run is saved instead of in a second trip through the Ruleset Manager.
      { id: 'ruleset-rules' },
    ]))

function armUsesApi(side: SourceSide): boolean {
  return arms[side].sourceMode.value === SOURCE_MODE_API
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

/**
 * A source config now maps 1:1 to a single API endpoint for OMS/Shopify (option rows are one per
 * config x endpoint), so "which API endpoint" is redundant once the config narrows it to exactly
 * one option -- skip the card and auto-select that option instead (see updateApiSourceConfig /
 * autoSelectSoleApiSource). Zero options still show the card: that is a real "no endpoint
 * configured" problem the operator needs to see (apiSourceSelectionError), not something to skip
 * past silently.
 */
function armNeedsApiSourceStep(side: SourceSide): boolean {
  // A SuiteQL query is read by its connector directly; no remote sits behind it.
  if (armUsesSuiteQl(side)) return false
  return apiSourceOptionsForSide(side).length !== 1
}

function armUsesSuiteQl(side: SourceSide): boolean {
  return armUsesApi(side) && arms[side].sourceConfigType.value === SOURCE_CONFIG_TYPE_SUITEQL
}

/** The (config x endpoint) row list#AutomationSourceOptions returned for this pair; a row with no system is unscoped. */
function findSourceConfigRow(sourceConfigId: string, endpointEnumId: string): AutomationSourceConfigOption | null {
  return sourceConfigs.value.find((config) =>
    sourceConfigMatches(config.sourceConfigId, sourceConfigId) &&
    (!config.systemEnumId || darpanSystemIdsMatch(config.systemEnumId, endpointEnumId)),
  ) ?? null
}

/** The (config x endpoint) row this API side resolved to, which is what declares its extract options. */
function selectedSourceConfigRow(side: SourceSide): AutomationSourceConfigOption | null {
  const sourceConfigId = selectedSourceConfigId(side)
  const endpointEnumId = selectedSystemEnumId(side)
  if (!armUsesApi(side) || !sourceConfigId || !endpointEnumId) return null
  return findSourceConfigRow(sourceConfigId, endpointEnumId)
}

function armExtractOptions(side: SourceSide): SourceExtractOption[] {
  return (selectedSourceConfigRow(side)?.extractOptions ?? [])
    .filter((option) => Boolean(option?.name?.trim()) && (option.type === 'boolean' || option.type === 'text'))
}

/** Only the names this side's row declares, and only a checked box or a non-blank text. */
function declaredExtractOptionValues(side: SourceSide): SourceExtractOptions | undefined {
  const values = arms[side].extractOptions.value
  const chosen = armExtractOptions(side).flatMap((option): Array<[string, boolean | string]> => {
    const value = values[option.name]
    if (option.type === 'boolean') return value === true ? [[option.name, true]] : []
    return typeof value === 'string' && value.trim() ? [[option.name, value.trim()]] : []
  })
  return chosen.length ? Object.fromEntries(chosen) : undefined
}

function clearExtractOptions(side: SourceSide): void {
  arms[side].extractOptions.value = {}
}

/** The query's fields as key options; a typed bare name gets the records root its extract returns. */
function primaryIdExpressionForDraft(side: SourceSide): string[] {
  const values = arms[side].primaryIdExpression.value
  if (!armUsesSuiteQl(side)) return values
  return values.map((value) => (value.trim().startsWith('$') ? value : `${SUITEQL_RECORD_ROOT}${value.trim()}`))
}

function suiteQlFieldsForSide(side: SourceSide): string[] | null | undefined {
  if (!armUsesSuiteQl(side)) return undefined
  return suiteQlQueryFields.value[selectedSourceConfigId(side)]
}

// The query's fields could not be read (or it has none): the key is typed, as on a CSV side.
function suiteQlKeyIsTyped(side: SourceSide): boolean {
  if (!armUsesSuiteQl(side)) return false
  const fields = suiteQlFieldsForSide(side)
  return fields === null || (Array.isArray(fields) && fields.length === 0)
}

function armParentEnumId(side: SourceSide): string {
  return arms[side].parentEnumId.value
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
  return allEndpoints.filter((option) => findSourceConfigRow(sourceConfigId, option.value) !== null)
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
  arms[side].systemEnumId.value = resolvedEnumId
}

function applyApiEndpointSelection(side: SourceSide, endpointEnumId: string): void {
  // The (config x endpoint) row's own config type is the payload field that pins the extractor.
  const sourceConfigType = findSourceConfigRow(selectedSourceConfigId(side), endpointEnumId)?.sourceConfigType ?? ''
  // Another endpoint is another connector row, with its own declared options.
  clearExtractOptions(side)
  arms[side].systemEnumId.value = endpointEnumId
  arms[side].sourceConfigType.value = sourceConfigType
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
  // A single-sided run saves from its last source card, which is therefore the end of the bar.
  if (isSingleSided.value && isCreateStep.value) return (100).toFixed(2)
  const stageCount = isSingleSided.value ? 2 : STAGES.length
  const stage = stageOfStep(currentStep.value.id)
  const stageName = STAGES[stage]!
  const cardsInStage = steps.value.filter((step) => stageOfStep(step.id) === stage)
  const positionInStage = Math.max(0, cardsInStage.findIndex((step) => step.id === currentStep.value.id))
  // Denominator is the stage's constant ceiling, never its live card count, so answering a
  // question that adds cards can only ever move the bar forwards.
  const withinStage = Math.min((positionInStage + 1) / STAGE_MAX_CARDS[stageName], 1)
  return (((stage + withinStage) / stageCount) * 100).toFixed(2)
})
const trimmedRunName = computed(() => runName.value.trim())
const file1SystemLabel = computed(() => resolveSystemLabel(file1SystemEnumId.value))
const file2SystemLabel = computed(() => resolveSystemLabel(file2SystemEnumId.value))
// The family name behind an endpoint-level pick (OMS_RETURNS_GQL -> "HotWax"). Blank for a family
// system, which IS its own system, so the draft carries undefined and consumers fall back to the
// side label. The rule set board titles its columns from this.
const file1SystemParentLabel = computed(() =>
  (file1SystemParentEnumId.value ? resolveSystemLabel(file1SystemParentEnumId.value) : '') || undefined)
const file2SystemParentLabel = computed(() =>
  (file2SystemParentEnumId.value ? resolveSystemLabel(file2SystemParentEnumId.value) : '') || undefined)
// DAR-UI-054: a Sync run compares two systems, and Create a run already asked which kind of run this
// is, so the wizard never asks again. DAR-UI-064: ?scope=EVALUATE (set by the caller, not asked here)
// builds a single-sided run over one source.
const activeDraft = computed<ReconciliationRuleSetDraft>(() => ({
  scopeMode: scopeMode.value,
  runName: trimmedRunName.value,
  description: description.value.trim() || undefined,
  file1SystemEnumId: file1SystemEnumId.value,
  file1SystemLabel: file1SystemLabel.value || undefined,
  file1SystemParentLabel: file1SystemParentLabel.value,
  file1SystemParentEnumId: file1SystemParentEnumId.value || undefined,
  file1SourceTypeEnumId: file1UsesApi.value ? SOURCE_TYPE_API : undefined,
  file1SystemMessageRemoteId: file1UsesApi.value ? file1SystemMessageRemoteId.value || undefined : undefined,
  file1SystemMessageRemoteLabel: file1UsesApi.value && file1SystemMessageRemoteId.value ? selectedApiSourceLabel('file1') || undefined : undefined,
  file1SourceConfigId: file1UsesApi.value ? file1SourceConfigId.value || undefined : undefined,
  file1SourceConfigType: file1UsesApi.value ? file1SourceConfigType.value || undefined : undefined,
  file1FileTypeEnumId: file1UsesApi.value ? '' : file1FileTypeEnumId.value,
  file1JsonSchemaId: !file1UsesApi.value ? file1JsonSchemaId.value || undefined : undefined,
  file1SchemaLabel: !file1UsesApi.value ? resolveSelectedSchemaLabel(file1JsonSchemaId.value) : undefined,
  file1SchemaFileName: !file1UsesApi.value ? resolveSchemaFileName(file1JsonSchemaId.value) : undefined,
  file1PrimaryIdExpression: primaryIdExpressionForDraft('file1'),
  file1ExtractOptions: declaredExtractOptionValues('file1'),
  file2SystemEnumId: file2SystemEnumId.value,
  file2SystemLabel: file2SystemLabel.value || undefined,
  file2SystemParentLabel: file2SystemParentLabel.value,
  file2SystemParentEnumId: file2SystemParentEnumId.value || undefined,
  file2SourceTypeEnumId: file2UsesApi.value ? SOURCE_TYPE_API : undefined,
  file2SystemMessageRemoteId: file2UsesApi.value ? file2SystemMessageRemoteId.value || undefined : undefined,
  file2SystemMessageRemoteLabel: file2UsesApi.value && file2SystemMessageRemoteId.value ? selectedApiSourceLabel('file2') || undefined : undefined,
  file2SourceConfigId: file2UsesApi.value ? file2SourceConfigId.value || undefined : undefined,
  file2SourceConfigType: file2UsesApi.value ? file2SourceConfigType.value || undefined : undefined,
  file2FileTypeEnumId: file2UsesApi.value ? '' : file2FileTypeEnumId.value,
  file2JsonSchemaId: !file2UsesApi.value ? file2JsonSchemaId.value || undefined : undefined,
  file2SchemaLabel: !file2UsesApi.value ? resolveSelectedSchemaLabel(file2JsonSchemaId.value) : undefined,
  file2SchemaFileName: !file2UsesApi.value ? resolveSchemaFileName(file2JsonSchemaId.value) : undefined,
  file2PrimaryIdExpression: primaryIdExpressionForDraft('file2'),
  file2ExtractOptions: declaredExtractOptionValues('file2'),
}))

const currentArmStep = computed(() => armStep(currentStep.value.id))

const currentQuestion = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return 'What should this run be called?'
    case 'description':
      return 'What description should this run use?'
    case 'ruleset-rules':
      return 'How should Darpan compare these two systems?'
  }
  const step = currentArmStep.value
  return step ? armQuestion(step.side, step.card) : ''
})

function armQuestion(side: SourceSide, card: ArmCard): string {
  const ordinal = side === 'file1' ? 'first' : 'second'
  const system = sourceSystemLabel(side)
  switch (card) {
    case 'system':
      return side === 'file1' && isSingleSided.value
        ? 'Which system should this run check?'
        : `Which system provides the ${ordinal} source?`
    case 'endpoint':
      // Worded for the branch the operator already chose one card earlier. "Endpoint" is
      // API vocabulary and reads as nonsense to someone about to upload a CSV.
      return armUsesApi(side)
        ? `Which ${resolveSystemLabel(armParentEnumId(side))} endpoint provides the ${ordinal} source?`
        : `Which ${resolveSystemLabel(armParentEnumId(side))} data is in the ${ordinal} source file?`
    case 'source':
      return `How should ${system} provide data?`
    case 'filetype':
      return `What file type does ${system} upload use?`
    case 'schema':
      return armUsesJson(side)
        ? `Which saved schema describes the ${system} JSON?`
        : `Which column list describes the ${system} CSV?`
    case 'primary-id':
      if (armUsesApi(side)) return `Which field identifies each record from ${apiRecordSourceLabel(side)}?`
      return armUsesJson(side)
        ? `Which field identifies each record in ${schemaLabel(side)}?`
        : `What primary ID expression identifies each record in ${system}?`
    case 'api-config':
      return `Which ${system} config should this source use?`
    case 'api':
      return `Which API endpoint should ${system} use?`
    case 'options':
      return `Which options should ${apiRecordSourceLabel(side)} use?`
  }
}

const isRuleSetRulesStep = computed(() => currentStep.value.id === 'ruleset-rules')

// The key is picked from a list when the side's fields are known (a JSON schema, a CSV column list, an API's
// declared ID fields, a readable SuiteQL query); otherwise it is typed as chips.
function keyIsPicked(side: SourceSide): boolean {
  return (armUsesJson(side) || armUsesApi(side) || arms[side].jsonSchemaId.value.length > 0) && !suiteQlKeyIsTyped(side)
}

const SELECT_CARDS: ReadonlySet<ArmCard> = new Set<ArmCard>(['system', 'endpoint', 'filetype', 'schema', 'api-config', 'api'])

const isSelectStep = computed(() => {
  const step = currentArmStep.value
  if (!step) return false
  return step.card === 'primary-id' ? keyIsPicked(step.side) : SELECT_CARDS.has(step.card)
})

// A CSV side that skipped the schema step still types its column names, as does a SuiteQL side whose
// query fields could not be read.
const isChipTextStep = computed(() => {
  const step = currentArmStep.value
  return step?.card === 'primary-id' && !keyIsPicked(step.side)
})

const activeSelectValue = computed({
  get: () => {
    const step = currentArmStep.value
    if (!step) return ''
    const arm = arms[step.side]
    switch (step.card) {
      case 'system':
        return arm.parentEnumId.value
      case 'endpoint':
        return arm.systemEnumId.value
      case 'source':
        return arm.sourceMode.value
      case 'filetype':
        return arm.fileTypeEnumId.value
      case 'schema':
        return arm.jsonSchemaId.value
      case 'api-config':
        return arm.sourceConfigId.value
      case 'api':
        return selectedApiSourceValue(step.side)
      default:
        return ''
    }
  },
  set: (value: string) => {
    const step = currentArmStep.value
    if (!step) return
    const { side } = step
    const arm = arms[side]
    switch (step.card) {
      case 'system':
        arm.parentEnumId.value = value
        // A system with no endpoints resolves straight to its own value (no endpoint step will be
        // inserted); a system with endpoints leaves the side's systemEnumId blank until that card
        // answers it, so canProceed correctly blocks advancing past an unresolved endpoint.
        arm.systemEnumId.value = darpanSystemHasEndpointOptions(value, allSystemOptions.value) ? '' : value
        arm.jsonSchemaId.value = ''
        arm.primaryIdExpression.value = []
        clearApiSourceConfig(side)
        syncFileEndpointSelection(side)
        break
      case 'endpoint':
        arm.jsonSchemaId.value = ''
        arm.primaryIdExpression.value = []
        // On the API branch the config is this card's PARENT and must survive it; only
        // the endpoint-derived half of the selection is re-resolved here.
        if (armUsesApi(side)) {
          applyApiEndpointSelection(side, value)
        } else {
          arm.systemEnumId.value = value
        }
        break
      case 'source':
        setSourceMode(side, value)
        break
      case 'filetype':
        arm.fileTypeEnumId.value = value
        arm.jsonSchemaId.value = ''
        arm.primaryIdExpression.value = []
        break
      case 'schema':
        arm.jsonSchemaId.value = value
        arm.primaryIdExpression.value = []
        break
      case 'api-config':
        updateApiSourceConfig(side, value)
        break
      case 'api':
        updateApiSource(side, value)
        break
    }
  },
})

const activeSelectOptions = computed<WorkflowSelectOption[]>(() => {
  const step = currentArmStep.value
  if (!step) return []
  const { side } = step
  switch (step.card) {
    case 'system':
      return systemOptions.value
    case 'endpoint':
      return armEndpointOptions(side)
    case 'filetype':
      return fileTypeOptions.value
    case 'api-config':
      return apiSourceConfigOptionsForSide(side)
    case 'api':
      return apiSourceOptionsForSide(side)
    case 'schema':
      return buildSchemaOptions(arms[side].systemEnumId.value, !armUsesJson(side))
    case 'primary-id':
      return armUsesApi(side)
        ? apiPrimaryIdOptions(side)
        : buildRankedFieldOptions(arms[side].jsonSchemaId.value, armUsesJson(side))
    default:
      return []
  }
})

const isPrimaryIdSelectStep = computed(() => currentArmStep.value?.card === 'primary-id' && isSelectStep.value)

// The key card's answer, whether it is picked from a list or typed as chips.
const activePrimaryIdValues = computed<string[]>({
  get: () => {
    const step = currentArmStep.value
    return step?.card === 'primary-id' ? arms[step.side].primaryIdExpression.value : []
  },
  set: (values: string[]) => {
    const step = currentArmStep.value
    if (step?.card === 'primary-id') arms[step.side].primaryIdExpression.value = values
  },
})

const chipTextInputRef = ref<InstanceType<typeof WorkflowChipTextInput> | null>(null)
const chipPendingValue = ref('')

// Text typed into the chip input but not yet Entered still counts as an answer for this step.
// Otherwise canProceed is false, the OK button renders disabled, and the operator has no way to
// commit the value they can plainly see in the box.
const hasPendingChipText = computed(() => isChipTextStep.value && chipPendingValue.value.trim().length > 0)

// A side's key is answered once it holds a chip, or while its own key card has text typed but not Entered.
// Both OK (canProceed) and Save (canCreateRun) read this: on a single-sided run the key card is the Save card.
function primaryIdAnswered(side: SourceSide): boolean {
  return arms[side].primaryIdExpression.value.length > 0 || (hasPendingChipText.value && currentStep.value.id === `${side}-primary-id`)
}

// The chip input is remounted per step and starts empty, but a fresh empty ref emits nothing --
// so without this reset an abandoned value (operator typed, then hit Back) would linger and
// wrongly satisfy the NEXT chip step.
watch(currentStepIndex, () => { chipPendingValue.value = '' })

// Once at least one field is chosen, further options are restricted to fields sharing the same
// JSON record root — composite key fields must all resolve at the same array-explosion level so
// the backend's shared-record-root validation (RuleSetCompareScopeAdapter) never rejects the save.
const activePrimaryIdSelectOptions = computed(() => {
  const baseOptions = activeSelectOptions.value
  const chosen = activePrimaryIdValues.value
  if (!chosen.length) return baseOptions
  return baseOptions.filter((option) => fieldSharesRecordRoot(option.value, chosen[0]!))
})

const activeSelectTestId = computed(() => {
  const step = currentArmStep.value
  if (!step || !SELECT_CARDS.has(step.card) && step.card !== 'primary-id') return 'workflow-select'
  return step.card === 'primary-id' ? `${step.side}-field-select` : `${step.side}-${step.card}-select`
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

// The free-text card holds only the run's name and description; a side's key has its own chip input.
const activeTextName = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return 'runName'
    case 'description':
      return 'description'
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
  }
  const step = currentArmStep.value
  if (!step) return ''
  const { side } = step
  switch (step.card) {
    case 'system':
      return 'Select system...'
    case 'endpoint':
      return armUsesApi(side) ? 'Select endpoint...' : 'Select data...'
    case 'api':
      return 'Select API endpoint...'
    case 'api-config':
      return 'Select config...'
    case 'filetype':
      return 'Select file type...'
    case 'schema':
      return armUsesJson(side) ? 'Select schema...' : 'Select a column list, or continue to type them'
    case 'primary-id':
      if (armUsesJson(side)) return arms[side].jsonSchemaId.value ? 'Select ID field...' : 'Choose a schema first'
      return armUsesApi(side) ? 'Select ID field...' : 'order_id'
    default:
      return ''
  }
})

const showEmptyState = computed(() => currentStep.value.id === 'run-name')

const isFileTypeChoiceStep = computed(() => currentArmStep.value?.card === 'filetype')
const isSourceChoiceStep = computed(() => currentArmStep.value?.card === 'source')
const isShortcutChoiceStep = computed(() => isSourceChoiceStep.value || isFileTypeChoiceStep.value)
const isOptionsStep = computed(() => currentArmStep.value?.card === 'options')
const activeOptionsSide = computed<SourceSide>(() => currentArmStep.value?.side ?? 'file1')
const activeBooleanExtractOptions = computed(() =>
  (isOptionsStep.value ? armExtractOptions(activeOptionsSide.value) : []).filter((option) => option.type === 'boolean'))
const activeTextExtractOptions = computed(() =>
  (isOptionsStep.value ? armExtractOptions(activeOptionsSide.value) : []).filter((option) => option.type === 'text'))

function extractOptionChecked(name: string): boolean {
  return arms[activeOptionsSide.value].extractOptions.value[name] === true
}

function extractOptionText(name: string): string {
  const value = arms[activeOptionsSide.value].extractOptions.value[name]
  return typeof value === 'string' ? value : ''
}

function setExtractOption(name: string, value: boolean | string): void {
  const options = arms[activeOptionsSide.value].extractOptions
  options.value = { ...options.value, [name]: value }
}

const isSchemaSelectionStep = computed(() => currentArmStep.value?.card === 'schema')

const activeShortcutChoiceTestPrefix = computed(() => (isShortcutChoiceStep.value ? `${currentStep.value.id}-choice` : 'workflow-choice'))

const SOURCE_MODE_OPTIONS: WorkflowSelectOption[] = [
  { value: SOURCE_MODE_FILE, label: 'File upload' },
  { value: SOURCE_MODE_API, label: 'API' },
]

const activeShortcutChoiceOptions = computed<WorkflowShortcutChoiceOption[]>(() =>
  (isSourceChoiceStep.value ? SOURCE_MODE_OPTIONS : activeSelectOptions.value).map((option, index) => ({
    value: option.value,
    label: option.label,
    shortcutKey: SHORTCUT_KEYS[index] ?? String(index + 1),
  })),
)

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
  const step = currentArmStep.value
  if (step?.card !== 'schema') return ''
  const { side } = step
  // JSON only. On a CSV side the step is optional, so "none available" is not a dead end --
  // and raising it here would set canProceed false and trap the user on a step they are
  // entitled to skip, with the chip-text fallback unreachable behind it.
  return armUsesJson(side) && buildSchemaOptions(arms[side].systemEnumId.value).length === 0
    ? `No saved JSON schemas are available for ${resolveSystemLabel(arms[side].systemEnumId.value) || sourceNumberLabel(side)}.`
    : ''
})

const schemaFieldSelectionError = computed(() => {
  const step = currentArmStep.value
  if (step?.card !== 'primary-id') return ''
  const { side } = step
  if (armUsesSuiteQl(side) && (suiteQlFieldsForSide(side) === undefined || suiteQlKeyIsTyped(side))) return ''
  if (armUsesApi(side)) {
    return apiPrimaryIdOptions(side).length === 0
      ? `No ID fields are available for ${apiRecordSourceLabel(side)}.`
      : ''
  }
  if (!armUsesJson(side)) return ''
  const schemaId = arms[side].jsonSchemaId.value
  if (!schemaId) return 'Choose a schema first.'
  return buildFieldOptions(schemaId).length === 0
    ? `No comparable fields are available in ${schemaLabel(side)}.`
    : ''
})

const apiSourceConfigSelectionError = computed(() => {
  const step = currentArmStep.value
  if (step?.card !== 'api-config') return ''
  return apiSourceConfigOptionsForSide(step.side).length === 0
    ? `No API configs are available for ${sourceSystemLabel(step.side)}.`
    : ''
})

const activeSelectError = computed(() => systemSelectionError.value || schemaSelectionError.value || schemaFieldSelectionError.value || apiSourceConfigSelectionError.value)

const apiSourceSelectionError = computed(() => {
  const step = currentArmStep.value
  if (step?.card !== 'api') return ''
  return apiSourceOptionsForSide(step.side).length === 0
    ? `No API endpoints are available for ${sourceSystemLabel(step.side)}.`
    : ''
})

const activeStepError = computed(() => activeSelectError.value || apiSourceSelectionError.value)

// The API cards are the only ones that can strand an operator with nothing to pick and nowhere to
// go. When one of them has an error, offer the same "Or -> go make one" exit the schema card has.
const activeConfigCreateTarget = computed<{ path: string, label: string } | null>(() => {
  const step = currentArmStep.value
  if ((step?.card !== 'api-config' && step?.card !== 'api') || !activeStepError.value) return null
  return CONFIG_CREATE_TARGETS[canonicalDarpanSystemEnumId(armParentEnumId(step.side))] ?? null
})

// DAR-UI-064. A SuiteQL query is authored from the NetSuite config card; saving it comes back here with
// newQuery=<id>&side=<side>, and the answers so far ride the draft store across the trip.
const newQueryHref = computed(() => {
  const step = currentArmStep.value
  if (step?.card !== 'api-config') return ''
  if (canonicalDarpanSystemEnumId(armParentEnumId(step.side)) !== 'NETSUITE') return ''
  const params = new URLSearchParams({ returnTo: wizardReturnPath(), side: step.side })
  return `${NEW_QUERY_PATH}?${params.toString()}`
})

function readQueryValue(name: string): string {
  const raw = route.query?.[name]
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === 'string' ? value.trim() : ''
}

/** This wizard's own path and query, minus a previous trip's return markers. */
function wizardReturnPath(): string {
  const params = new URLSearchParams()
  Object.entries(route.query ?? {}).forEach(([key, raw]) => {
    if (key === 'newQuery' || key === 'side') return
    const values = Array.isArray(raw) ? raw : [raw]
    values.forEach((value) => { if (typeof value === 'string') params.append(key, value) })
  })
  if (isSingleSided.value && !params.has('scope')) params.set('scope', SCOPE_EVALUATE)
  const query = params.toString()
  const path = (route as { path?: string }).path || CREATE_FLOW_PATH
  return query ? `${path}?${query}` : path
}

const canProceed = computed(() => {
  switch (currentStep.value.id) {
    case 'run-name':
      return trimmedRunName.value.length > 0
    case 'description':
      return true
  }
  const step = currentArmStep.value
  if (!step) return false
  const { side } = step
  const arm = arms[side]
  switch (step.card) {
    case 'system':
      // On the second side, when the chosen system has endpoints, file2SystemEnumId stays blank until
      // file2-endpoint resolves it — the "must differ from source 1" check applies there instead.
      return arm.parentEnumId.value.length > 0 &&
        (side === 'file1' || armHasEndpointStep('file2') || file2SystemEnumId.value !== file1SystemEnumId.value)
    case 'endpoint':
      return arm.systemEnumId.value.length > 0 && (side === 'file1' || file2SystemEnumId.value !== file1SystemEnumId.value)
    case 'source':
      return arm.sourceMode.value === SOURCE_MODE_FILE || arm.sourceMode.value === SOURCE_MODE_API
    case 'filetype':
      return arm.fileTypeEnumId.value.length > 0
    case 'schema':
      // Required for JSON, skippable for CSV -- a skipped CSV schema falls back to chip text.
      return (armUsesJson(side) ? arm.jsonSchemaId.value.length > 0 : true) && !schemaSelectionError.value
    case 'primary-id':
      return primaryIdAnswered(side) && !schemaFieldSelectionError.value
    case 'api-config':
      return arm.sourceConfigId.value.length > 0 && !apiSourceConfigSelectionError.value
    case 'api':
      return hasApiEndpoint(side) && !apiSourceSelectionError.value
    case 'options':
      return true
  }
  return false
})

/** Every answer this side's save needs. */
function armReadyToSave(side: SourceSide): boolean {
  const arm = arms[side]
  if (!arm.systemEnumId.value || !primaryIdAnswered(side)) return false
  if (armUsesApi(side)) return Boolean(arm.sourceConfigId.value) && hasApiEndpoint(side)
  return arm.fileTypeEnumId.value.length > 0 && (!armUsesJson(side) || !!resolveSchemaFileName(arm.jsonSchemaId.value))
}

const canCreateRun = computed(() => trimmedRunName.value.length > 0 && armReadyToSave('file1') && (
  isSingleSided.value || (
    armReadyToSave('file2') &&
    // DAR-UI-064: both sides may read the same system through different configs (NetSuite warranty claims against
    // NetSuite credit memos); only the very same source twice is refused, as create#RuleSetRun refuses it.
    (file1SystemEnumId.value !== file2SystemEnumId.value || file1SourceConfigId.value.trim() !== file2SourceConfigId.value.trim())
  )
))

watch(
  () => steps.value.length,
  (nextLength) => {
    if (currentStepIndex.value >= nextLength) {
      currentStepIndex.value = Math.max(0, nextLength - 1)
    }
  },
)

watch(
  () => SIDES.map((side) => (armUsesSuiteQl(side) ? arms[side].sourceConfigId.value : '')),
  (queryIds) => {
    queryIds.forEach((queryId) => {
      if (queryId) void ensureSuiteQlQueryFieldsLoaded(queryId)
    })
  },
)

SIDES.forEach((side) => {
  watch(arms[side].jsonSchemaId, async (nextSchemaId) => {
    if (!nextSchemaId) return
    await ensureFieldsLoaded(nextSchemaId)
    if (currentStep.value.id === `${side}-schema` && arms[side].jsonSchemaId.value === nextSchemaId) {
      await focusActiveSelectTrigger()
    }
  })
})

function resolveSystemLabel(enumId: string): string {
  // Reads the full list (parents + endpoints), not the step 1-only systemOptions, so a concrete
  // endpoint value like OMS_RETURNS_GQL still resolves to its own distinct label everywhere downstream
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

// Falls back to the parent system's label before the generic "source N". The source card now runs
// BEFORE the endpoint card, so file{n}SystemEnumId is still blank there for a system with
// endpoints -- without this fallback that card would read "How should source 1 provide data?".
function sourceSystemLabel(side: SourceSide): string {
  return resolveSystemLabel(arms[side].systemEnumId.value) || resolveSystemLabel(armParentEnumId(side)) || sourceNumberLabel(side)
}

function apiRecordSourceLabel(side: SourceSide): string {
  if (armUsesSuiteQl(side)) {
    const queryId = selectedSourceConfigId(side)
    const option = apiSourceConfigOptionsForSide(side).find((candidate) => candidate.value === queryId)
    if (option?.label) return option.label
  }
  return selectedApiSourceLabel(side) || sourceSystemLabel(side)
}

function selectedSystemEnumId(side: SourceSide): string {
  return arms[side].systemEnumId.value
}

function selectedSourceConfigId(side: SourceSide): string {
  return arms[side].sourceConfigId.value
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

// A config row carries its ENDPOINT's systemEnumId (OMS_RETURNS_GQL), so matching it against a parent
// (OMS) means resolving that endpoint back to its parent first. A row with no systemEnumId is
// unscoped and belongs to every system.
function sourceConfigBelongsToParentSystem(config: AutomationSourceConfigOption, parentEnumId: string): boolean {
  if (!config.systemEnumId?.trim()) return true
  if (!parentEnumId) return false
  return darpanSystemsInOneFamily(config.systemEnumId, parentEnumId, allSystemOptions.value)
}

function apiSourceOptionsForSide(side: SourceSide): WorkflowSelectOption[] {
  const systemEnumId = selectedSystemEnumId(side)
  const sourceConfigId = selectedSourceConfigId(side)
  if (!sourceConfigId) return []

  return systemRemotes.value
    .filter((remote) => darpanSystemIdsMatch(remote.systemEnumId, systemEnumId))
    .filter((remote) => sourceConfigMatches(remote.sourceConfigId || remote.optionKey, sourceConfigId))
    .map((remote) => ({
      value: remoteSelectValue(remote),
      label: remote.label || remote.description || remote.systemMessageRemoteId,
    }))
}

function sourceConfigMatches(candidate: string | undefined, selected: string): boolean {
  return Boolean(candidate?.trim() && selected.trim() && candidate.trim() === selected.trim())
}

function remoteSelectValue(remote: AutomationSystemRemoteOption): string {
  const optionKey = remote.optionKey || remote.sourceConfigId
  return optionKey ? `remote:${remote.systemMessageRemoteId}:${optionKey}` : `remote:${remote.systemMessageRemoteId}`
}

function hasApiEndpoint(side: SourceSide): boolean {
  if (armUsesSuiteQl(side)) return true
  return Boolean(arms[side].systemMessageRemoteId.value)
}

function selectedApiSourceValue(side: SourceSide): string {
  const arm = arms[side]
  if (!arm.systemMessageRemoteId.value) return ''
  const selectedRemote = selectedRemoteOptionForSide(side)
  return selectedRemote ? remoteSelectValue(selectedRemote) : `remote:${arm.systemMessageRemoteId.value}`
}

/**
 * Answer the config card. sourceConfigType is deliberately NOT set here: it belongs to a
 * (config x endpoint) row, and the endpoint is the next card. syncSoleApiEndpoint fills both in
 * when the config leaves exactly one endpoint and that card is skipped.
 */
function updateApiSourceConfig(side: SourceSide, value: string): void {
  const arm = arms[side]
  arm.sourceConfigId.value = value
  arm.sourceConfigType.value = ''
  arm.systemEnumId.value = ''
  arm.primaryIdExpression.value = []
  clearApiEndpoint(side)
  clearExtractOptions(side)

  syncSoleApiEndpoint(side)
}

// When apiSourceOptionsForSide narrows to exactly one option, the file{n}-api card is skipped
// (see armNeedsApiSourceStep) -- select that option here so the primary-id step and the saved
// payload end up in the same state they would if the operator had picked it by hand. Zero and 2+
// option counts leave the endpoint refs alone: the card still renders for those, and
// updateApiSource(side, value) drives selection from there instead.
function autoSelectSoleApiSource(side: SourceSide): void {
  const options = apiSourceOptionsForSide(side)
  if (options.length === 1) {
    updateApiSource(side, options[0]!.value)
  }
}

function updateApiSource(side: SourceSide, value: string): void {
  const arm = arms[side]
  arm.primaryIdExpression.value = []

  if (value.startsWith('remote:')) {
    const [, remoteId = ''] = value.split(':')
    arm.systemMessageRemoteId.value = remoteId
  }
}

function clearApiSourceConfig(side: SourceSide): void {
  clearExtractOptions(side)
  arms[side].sourceConfigId.value = ''
  arms[side].sourceConfigType.value = ''
  clearApiEndpoint(side)
}

function clearApiEndpoint(side: SourceSide): void {
  arms[side].systemMessageRemoteId.value = ''
}

function setSourceMode(side: SourceSide, value: string): void {
  const arm = arms[side]
  const sourceMode = value === SOURCE_MODE_API ? SOURCE_MODE_API : SOURCE_MODE_FILE
  arm.sourceMode.value = sourceMode
  arm.primaryIdExpression.value = []
  if (sourceMode === SOURCE_MODE_API) {
    arm.jsonSchemaId.value = ''
  } else {
    clearApiSourceConfig(side)
    syncFileEndpointSelection(side)
  }
}

function selectedApiSourceOption(side: SourceSide): AutomationSystemRemoteOption | null {
  return selectedRemoteOptionForSide(side)
}

function selectedRemoteOptionForSide(side: SourceSide): AutomationSystemRemoteOption | null {
  const remoteId = arms[side].systemMessageRemoteId.value
  const systemEnumId = selectedSystemEnumId(side)
  const sourceConfigId = selectedSourceConfigId(side)
  if (!remoteId) return null
  return systemRemotes.value.find((remote) =>
    remote.systemMessageRemoteId === remoteId &&
    darpanSystemIdsMatch(remote.systemEnumId, systemEnumId) &&
    (!sourceConfigId || sourceConfigMatches(remote.sourceConfigId || remote.optionKey, sourceConfigId)),
  ) ?? null
}

function selectedApiSourceLabel(side: SourceSide): string {
  const option = selectedApiSourceOption(side)
  return option?.label || option?.description || ''
}

function apiPrimaryIdOptions(side: SourceSide): WorkflowSelectOption[] {
  if (armUsesSuiteQl(side)) {
    return (suiteQlFieldsForSide(side) ?? []).map((fieldName) => ({ value: `${SUITEQL_RECORD_ROOT}${fieldName}`, label: fieldName }))
  }
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
    pageError.value = error instanceof ApiCallError ? error.message : 'The schema fields wandered off the schema.'
  } finally {
    pendingSchemaFieldLoads.value = Math.max(0, pendingSchemaFieldLoads.value - 1)
  }
}

async function ensureSuiteQlQueryFieldsLoaded(queryId: string): Promise<void> {
  if (!queryId || queryId in suiteQlQueryFields.value) return
  // The option row already carries the query's fields, including what its template adds (a SALES_LINES query's
  // orderLineId, lineLocation); reading the query itself only knows its projection, so it is the fallback.
  const declared = sourceConfigs.value.find((config) => config.sourceConfigId === queryId)?.primaryIdOptions ?? []
  if (declared.length) {
    suiteQlQueryFields.value = {
      ...suiteQlQueryFields.value,
      [queryId]: declared.map((option) => option.fieldPath.replace(SUITEQL_RECORD_ROOT, '')).filter(Boolean),
    }
    return
  }
  pendingQueryFieldLoads.value += 1
  try {
    const response = await netSuiteQueryFacade.get(queryId, pageAbortController.signal)
    const fieldNames = (response.query?.fields ?? [])
      .map((field) => field.recordFieldName?.trim() ?? '')
      .filter(Boolean)
    suiteQlQueryFields.value = { ...suiteQlQueryFields.value, [queryId]: fieldNames }
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    // Unreadable is not a dead end: the key is typed instead.
    suiteQlQueryFields.value = { ...suiteQlQueryFields.value, [queryId]: null }
  } finally {
    pendingQueryFieldLoads.value = Math.max(0, pendingQueryFieldLoads.value - 1)
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

function advanceFromShortcutChoice(value: string): void {
  if (!isShortcutChoiceStep.value || loadingSelections.value) return

  activeSelectValue.value = value
  if (!canProceed.value) return

  currentStepIndex.value = Math.min(currentStepIndex.value + 1, steps.value.length - 1)
  // DAR-UI-064: a choice card (a side's repeated-key handling) can now be the last card before the rules board, and
  // the board reads only the draft store, so it has to be seeded here exactly as the OK path seeds it.
  if (currentStep.value.id === 'ruleset-rules') {
    publishDraft('ruleset-manager')
  }
}

// A choice step's letters (Shift+letter is no choice here). DAR-OPS-029 S99-102: now also skipped while typing, so the
// command palette keeps its letters over a choice step (this page alone did not skip them).
useChoiceShortcuts({
  active: () => isShortcutChoiceStep.value,
  choices: () => activeShortcutChoiceOptions.value,
  choose: advanceFromShortcutChoice,
  blockShift: true,
})

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
 * Publish the wizard's current answers into the shared draft store. The rules board takes no props and
 * reads only that store, so this runs when the wizard lands on the final step (clicked through or
 * resumed), and before a detour, so the answers survive the trip.
 */
function publishDraft(resumeStepId: ReconciliationRuleSetDraftStepId): void {
  draftStore.setRuleSetDraft({ ...activeDraft.value, ...boardDraftExtras() }, resumeStepId)
}

/**
 * Leave the wizard for a settings/schema workflow and come back to the same card with the same
 * answers. Without the publish the draft store is empty on return and restoreDraftFromHistoryState
 * has nothing to hydrate, so the operator restarts from card one -- which is what the schema
 * detour did before this.
 */
async function openCreateDetour(path: string): Promise<void> {
  continuingFlowElsewhere = true
  publishDraft(currentStep.value.id)
  draftStore.setWorkflowOrigin('Reconciliation Setup', CREATE_FLOW_PATH)
  await router.push({ path })
}

async function restoreDraftFromHistoryState(): Promise<void> {
  const draftState = draftStore.ruleSetDraftState
  if (!draftState) return

  // The draft slot is shared with every EXISTING-run surface -- run settings (list and workflow),
  // the Ruleset Manager, the rules editor, run history, a run result, the automation dashboard --
  // each of which publishes with resumeStepId 'ruleset-manager', the last card here, and none of
  // which clear it on exit. It is sessionStorage-backed, so it outlives the navigation: without
  // this gate, clicking into a saved run's settings makes the next "Create new run" open on the
  // rules board wearing that run's answers. Those drafts carry a savedRunId; this wizard's own
  // activeDraft never sets one, so a populated savedRunId is an exact test for "belongs elsewhere".
  // Discard rather than ignore -- boardDraftExtras() reads the same slot, so a foreign draft left
  // in place would still hand its rules and exclusion filters to the run created here.
  if (draftState.draft.savedRunId) {
    draftStore.clearRuleSetDraft()
    return
  }

  scopeMode.value = (draftState.draft.scopeMode ?? '').toUpperCase() === SCOPE_EVALUATE ? SCOPE_EVALUATE : scopeMode.value
  runName.value = draftState.draft.runName
  description.value = draftState.draft.description ?? ''
  file1SystemEnumId.value = draftState.draft.file1SystemEnumId
  file1SourceMode.value = draftState.draft.file1SourceTypeEnumId === SOURCE_TYPE_API ? SOURCE_MODE_API : SOURCE_MODE_FILE
  file1FileTypeEnumId.value = draftState.draft.file1FileTypeEnumId
  file1JsonSchemaId.value = draftState.draft.file1JsonSchemaId ?? ''
  file1PrimaryIdExpression.value = draftState.draft.file1PrimaryIdExpression
  file1SourceConfigId.value = draftState.draft.file1SourceConfigId ?? ''
  file1SourceConfigType.value = draftState.draft.file1SourceConfigType ?? ''
  file1SystemMessageRemoteId.value = draftState.draft.file1SystemMessageRemoteId ?? ''
  file2SystemEnumId.value = draftState.draft.file2SystemEnumId
  file2SourceMode.value = draftState.draft.file2SourceTypeEnumId === SOURCE_TYPE_API ? SOURCE_MODE_API : SOURCE_MODE_FILE
  file2FileTypeEnumId.value = draftState.draft.file2FileTypeEnumId
  file2JsonSchemaId.value = draftState.draft.file2JsonSchemaId ?? ''
  file2PrimaryIdExpression.value = draftState.draft.file2PrimaryIdExpression
  file2SourceConfigId.value = draftState.draft.file2SourceConfigId ?? ''
  file2SourceConfigType.value = draftState.draft.file2SourceConfigType ?? ''
  file2SystemMessageRemoteId.value = draftState.draft.file2SystemMessageRemoteId ?? ''
  file1ExtractOptions.value = { ...(draftState.draft.file1ExtractOptions ?? {}) }
  file2ExtractOptions.value = { ...(draftState.draft.file2ExtractOptions ?? {}) }
  // Resolve step 1's answer from the resumed concrete value (e.g. OMS_RETURNS_GQL -> OMS) BEFORE
  // steps.value is read below — steps.value only includes file{n}-endpoint when the parent has
  // one, so this must be set first or a resumeStepId targeting that step would not be found.
  // A draft published from a card before the endpoint resolved (the config card, on a system with
  // endpoints) has a blank systemEnumId, so the stored first-card answer wins when present.
  file1SystemParentEnumId.value = draftState.draft.file1SystemParentEnumId ||
    darpanSystemFamily(file1SystemEnumId.value, allSystemOptions.value)
  file2SystemParentEnumId.value = draftState.draft.file2SystemParentEnumId ||
    darpanSystemFamily(file2SystemEnumId.value, allSystemOptions.value)
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
    publishDraft('ruleset-manager')
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
      ...(option.extractable === false ? { extractable: false } : {}),
    }))
    fileTypeOptions.value = (automationSourceOptionsResponse.fileTypes ?? []).map((option) => ({
      value: option.enumId,
      label: option.label || option.description || option.enumCode || option.enumId,
    }))
    jsonSchemas.value = schemasResponse.schemas ?? []
    sourceConfigs.value = automationSourceOptionsResponse.sourceConfigs ?? []
    systemRemotes.value = automationSourceOptionsResponse.systemRemotes ?? []
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof ApiCallError ? error.message : 'The setup options are still deciding what to wear.'
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
    publishDraft('ruleset-manager')
  }
}

async function openNewQueryWorkflow(): Promise<void> {
  const href = newQueryHref.value
  if (!href) return
  continuingFlowElsewhere = true
  publishDraft(currentStep.value.id)
  await router.push(href)
}

/**
 * Back from the query editor: preselect the saved query on the side that asked for it. Options were
 * reloaded on mount, so a query saved a moment ago is in them. Applied only to a side that is still
 * a NetSuite API side, so a stale URL on a fresh wizard changes nothing.
 */
async function applyReturnedQuery(): Promise<void> {
  const queryId = readQueryValue('newQuery')
  const sideValue = readQueryValue('side')
  if (!queryId || (sideValue !== 'file1' && sideValue !== 'file2')) return
  const side: SourceSide = sideValue
  if (!armUsesApi(side) || canonicalDarpanSystemEnumId(armParentEnumId(side)) !== 'NETSUITE') return
  if (!apiSourceConfigOptionsForSide(side).some((option) => option.value === queryId)) return

  updateApiSourceConfig(side, queryId)
  const configStepIndex = steps.value.findIndex((step) => step.id === `${side}-api-config`)
  if (configStepIndex >= 0) currentStepIndex.value = configStepIndex

  // Drop the return markers so a reload does not apply them a second time.
  const rest = Object.fromEntries(Object.entries(route.query ?? {}).filter(([key]) => key !== 'newQuery' && key !== 'side'))
  await router.replace({ query: rest })
}

async function openSchemaCreateWorkflow(): Promise<void> {
  await openCreateDetour('/schemas/create')
}

async function openConfigCreateWorkflow(): Promise<void> {
  const target = activeConfigCreateTarget.value
  if (!target) return
  await openCreateDetour(target.path)
}

/**
 * Where a saved run goes back to. A detour (openCreateDetour) points the origin at this wizard so Esc returns
 * here, and nothing points it elsewhere again, so an origin that is this wizard leads nowhere: null, and Home.
 */
function originOutsideWizard(): string | null {
  const originPath = draftStore.workflowOrigin?.path
  if (!originPath) return null
  const wizardPath = (route as { path?: string }).path || CREATE_FLOW_PATH
  return originPath.split('?')[0] === wizardPath ? null : originPath
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
      // cleanup — it says nothing about the ruleset draft publishDraft() published so
      // the board had something to read/write. That one is unrelated and must not survive a
      // completed create: left in place, a later /reconciliation/create visit would resume
      // straight onto the board with this just-created run's answers and a live "Save run",
      // one click away from creating a duplicate.
      draftStore.clearRuleSetDraft()
      await router.push({ path: '/reconciliation/automation/create' })
      draftStore.clearAutomationDraft()
      return
    }

    await router.push(originOutsideWizard() ?? { name: 'hub' })
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    pageError.value = error instanceof ApiCallError ? error.message : 'The reconciliation flow did not flow. Not created.'
  }
}

onMounted(async () => {
  await loadOptions()
  await restoreDraftFromHistoryState()
  await applyReturnedQuery()
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
