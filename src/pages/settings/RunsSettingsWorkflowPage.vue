<template>
  <WorkflowPage :progress-percent="'100'" aria-label="Run settings edit progress" center-stage edit-surface>
    <InlineValidation v-if="error" tone="error" :message="error" />
    <InlineValidation v-else-if="!loading && validationMessage" tone="error" :message="validationMessage" />
    <p v-if="success" class="success-copy">{{ success }}</p>

    <WorkflowStepForm
      :class="['workflow-form--compact', 'workflow-form--edit-single-page']"
      question="Update the run configuration."
      primary-label="Save"
      primary-action-variant="save"
      :show-enter-hint="false"
      :show-back="false"
      :show-cancel-action="true"
      :cancel-disabled="loading"
      cancel-test-id="cancel-run-settings"
      :submit-disabled="submitDisabled"
      :show-primary-action="canEditTenantSettings"
      primary-test-id="save-run-settings"
      @submit="save"
      @cancel="cancelEdit"
    >
      <label class="wizard-input-shell">
        <span class="workflow-context-label">Run Name</span>
        <input
          name="mappingName"
          v-model="form.mappingName"
          class="wizard-answer-control"
          type="text"
          placeholder="Returns vs Shopify"
          :disabled="!canEditTenantSettings || loading"
        />
      </label>

      <div class="workflow-form-grid workflow-form-grid--two" data-testid="run-source-1-row">
        <template v-if="source1UsesApi">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source1 }} API Config</span>
            <AppSelect
              v-model="source1ApiConfigValue"
              :disabled="!canEditTenantSettings || loading"
              :options="source1ApiConfigOptions"
              :placeholder="`Select ${sourceNames.source1} API config`"
              test-id="run-api-config-1"
            />
          </label>

          <label v-if="!source1UsesSuiteQl" class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source1 }} Endpoint</span>
            <AppSelect
              v-model="source1ApiEndpointValue"
              :disabled="!canEditTenantSettings || loading || source1ApiEndpointOptions.length === 0"
              :options="source1ApiEndpointOptions"
              :placeholder="form.source1.sourceConfigId ? `Select ${sourceNames.source1} endpoint` : 'Choose an API config first'"
              test-id="run-api-endpoint-1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source1 }} Primary ID</span>
            <WorkflowSelect
              v-model="form.source1.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeSource1ApiFieldOptions.length === 0"
              :options="activeSource1ApiFieldOptions"
              :placeholder="apiPrimaryIdPlaceholder('source1')"
              test-id="run-api-field-1"
            />
          </label>
        </template>

        <template v-else>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source1 }} Schema</span>
            <AppSelect
              v-model="form.source1.schemaId"
              :disabled="!canEditTenantSettings || loading"
              :options="schemaOptions"
              :placeholder="`Select ${sourceNames.source1} schema`"
              test-id="run-schema-1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source1 }} Field</span>
            <WorkflowSelect
              v-model="form.source1.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeFieldOptions1.length === 0"
              :options="activeFieldOptions1"
              :placeholder="form.source1.schemaId ? `Select ${sourceNames.source1} field` : 'Choose a schema first'"
              test-id="run-field-1"
            />
          </label>
        </template>
      </div>

      <div v-if="!isSingleSided" class="workflow-form-grid workflow-form-grid--two" data-testid="run-source-2-row">
        <template v-if="source2UsesApi">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source2 }} API Config</span>
            <AppSelect
              v-model="source2ApiConfigValue"
              :disabled="!canEditTenantSettings || loading"
              :options="source2ApiConfigOptions"
              :placeholder="`Select ${sourceNames.source2} API config`"
              test-id="run-api-config-2"
            />
          </label>

          <label v-if="!source2UsesSuiteQl" class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source2 }} Endpoint</span>
            <AppSelect
              v-model="source2ApiEndpointValue"
              :disabled="!canEditTenantSettings || loading || source2ApiEndpointOptions.length === 0"
              :options="source2ApiEndpointOptions"
              :placeholder="form.source2.sourceConfigId ? `Select ${sourceNames.source2} endpoint` : 'Choose an API config first'"
              test-id="run-api-endpoint-2"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source2 }} Primary ID</span>
            <WorkflowSelect
              v-model="form.source2.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeSource2ApiFieldOptions.length === 0"
              :options="activeSource2ApiFieldOptions"
              :placeholder="apiPrimaryIdPlaceholder('source2')"
              test-id="run-api-field-2"
            />
          </label>
        </template>

        <template v-else>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source2 }} Schema</span>
            <AppSelect
              v-model="form.source2.schemaId"
              :disabled="!canEditTenantSettings || loading"
              :options="schemaOptions"
              :placeholder="`Select ${sourceNames.source2} schema`"
              test-id="run-schema-2"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">{{ sourceNames.source2 }} Field</span>
            <WorkflowSelect
              v-model="form.source2.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeFieldOptions2.length === 0"
              :options="activeFieldOptions2"
              :placeholder="form.source2.schemaId ? `Select ${sourceNames.source2} field` : 'Choose a schema first'"
              test-id="run-field-2"
            />
          </label>
        </template>
      </div>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
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
import type { SaveRuleSetRunPayload } from '../../lib/api/facadeTypes'
import { usePermissionsStore } from '../../stores/permissions'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import {
  fieldSharesRecordRoot,
  fieldsReferenceSamePath,
  primaryIdExpressionPayloadFields,
  reconciliationSystemTitle,
  type ReconciliationRuleSetDraft,
} from '../../lib/reconciliationRuleSetDraft'
import {
  darpanSystemDisplayLabel,
  darpanSystemIdsMatch,
  darpanSystemNamePair,
  deduplicateDarpanSystemOptions,
  resolveDarpanSystemParentEnumId,
  type DarpanSystemValueOption,
} from '../../lib/utils/darpanSystems'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { resolveSchemaLabel } from '../../lib/utils/schemaLabel'

interface RunSourceForm {
  schemaId: string
  fieldPaths: string[]
  sourceConfigId: string
  sourceConfigType: string
  nsRestletConfigId: string
  systemMessageRemoteId: string
  // An API side's endpoint system (OMS, OMS_GQL, ...): picking another endpoint can change it.
  systemEnumId: string
}

interface RunForm {
  mappingName: string
  source1: RunSourceForm
  source2: RunSourceForm
}

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const draftStore = useReconciliationDraftStore()
const SOURCE_TYPE_API = 'AUT_SRC_API'
// A side over a saved NetSuite SuiteQL query: the config IS the query, with no endpoint behind it (as in the run builder).
const SOURCE_CONFIG_TYPE_SUITEQL = 'NETSUITE_SUITEQL'
// DAR-UI-064. A one-system run reads one side and has no second one to show, validate or send.
const SCOPE_EVALUATE = 'EVALUATE'

const schemas = ref<JsonSchemaSummary[]>([])
const sourceConfigs = ref<AutomationSourceConfigOption[]>([])
const nsRestletConfigs = ref<AutomationNsRestletOption[]>([])
const systemRemotes = ref<AutomationSystemRemoteOption[]>([])
const systemOptions = ref<DarpanSystemValueOption[]>([])
const flattenedFields = ref<Record<string, JsonSchemaField[]>>({})
const ruleSetDraft = ref<ReconciliationRuleSetDraft | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const form = reactive<RunForm>({
  mappingName: '',
  source1: emptySourceForm(),
  source2: emptySourceForm(),
})

function emptySourceForm(): RunSourceForm {
  return {
    schemaId: '',
    fieldPaths: [],
    sourceConfigId: '',
    sourceConfigType: '',
    nsRestletConfigId: '',
    systemMessageRemoteId: '',
    systemEnumId: '',
  }
}

const activeMappingId = computed(() => String(route.params.reconciliationMappingId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const source1Schema = computed(() => schemas.value.find((schema) => schema.jsonSchemaId === form.source1.schemaId) ?? null)
const source2Schema = computed(() => schemas.value.find((schema) => schema.jsonSchemaId === form.source2.schemaId) ?? null)
const source1UsesApi = computed(() => sourceUsesApi('source1'))
const source2UsesApi = computed(() => sourceUsesApi('source2'))
const source1UsesSuiteQl = computed(() => sourceUsesSuiteQl('source1'))
const source2UsesSuiteQl = computed(() => sourceUsesSuiteQl('source2'))
const isSingleSided = computed(() => (ruleSetDraft.value?.scopeMode ?? '').trim().toUpperCase() === SCOPE_EVALUATE)
const schemaOptions = computed<AppSelectOption[]>(() => (
  schemas.value.map((schema) => ({
    value: schema.jsonSchemaId,
    label: formatSchemaLabel(schema),
  }))
))
const fieldOptions1 = computed<AppSelectOption[]>(() => buildFieldOptions(form.source1.schemaId))
const fieldOptions2 = computed<AppSelectOption[]>(() => buildFieldOptions(form.source2.schemaId))
const source1ApiConfigOptions = computed<AppSelectOption[]>(() => apiSourceConfigOptionsForSource('source1'))
const source2ApiConfigOptions = computed<AppSelectOption[]>(() => apiSourceConfigOptionsForSource('source2'))
const source1ApiEndpointOptions = computed<AppSelectOption[]>(() => apiEndpointOptionsForSource('source1'))
const source2ApiEndpointOptions = computed<AppSelectOption[]>(() => apiEndpointOptionsForSource('source2'))
const source1ApiFieldOptions = computed<AppSelectOption[]>(() => apiPrimaryIdOptionsForSource('source1'))
const source2ApiFieldOptions = computed<AppSelectOption[]>(() => apiPrimaryIdOptionsForSource('source2'))
// Once at least one primary-ID field is chosen, further options are restricted to fields sharing the
// same JSON record root — composite key fields must all resolve at the same array-explosion level so
// the backend's shared-record-root validation (RuleSetCompareScopeAdapter) never rejects the save.
const activeFieldOptions1 = computed<AppSelectOption[]>(() => restrictToSharedRecordRoot(fieldOptions1.value, form.source1.fieldPaths))
const activeFieldOptions2 = computed<AppSelectOption[]>(() => restrictToSharedRecordRoot(fieldOptions2.value, form.source2.fieldPaths))
const activeSource1ApiFieldOptions = computed<AppSelectOption[]>(() => restrictToSharedRecordRoot(source1ApiFieldOptions.value, form.source1.fieldPaths))
const activeSource2ApiFieldOptions = computed<AppSelectOption[]>(() => restrictToSharedRecordRoot(source2ApiFieldOptions.value, form.source2.fieldPaths))
const source1ApiConfigValue = computed({
  get: () => form.source1.sourceConfigId,
  set: (value: string) => updateApiSourceConfig('source1', value),
})
const source2ApiConfigValue = computed({
  get: () => form.source2.sourceConfigId,
  set: (value: string) => updateApiSourceConfig('source2', value),
})
const source1ApiEndpointValue = computed({
  get: () => selectedApiEndpointValue('source1'),
  set: (value: string) => updateApiEndpoint('source1', value),
})
const source2ApiEndpointValue = computed({
  get: () => selectedApiEndpointValue('source2'),
  set: (value: string) => updateApiEndpoint('source2', value),
})
const validationMessage = computed(() => {
  if (!activeMappingId.value) return 'Run ID is missing.'
  if (form.mappingName.trim().length === 0) return 'Run name is required.'
  const source1Validation = validateSource('source1')
  if (source1Validation) return source1Validation
  if (isSingleSided.value) return sourceSystemEnumId('source1') ? null : 'The source needs an assigned reconciliation system.'
  const source2Validation = validateSource('source2')
  if (source2Validation) return source2Validation
  if (!sourceSystemEnumId('source1') || !sourceSystemEnumId('source2')) return 'Both sources need an assigned reconciliation system.'
  // Both sides may read one system through different configs (NetSuite claims against NetSuite credit memos);
  // only the very same source twice is refused, as in the run builder.
  if (
    darpanSystemIdsMatch(sourceSystemEnumId('source1'), sourceSystemEnumId('source2')) &&
    form.source1.sourceConfigId.trim() === form.source2.sourceConfigId.trim()
  ) return 'Both sides use the same system.'
  return null
})
const submitDisabled = computed(() => !canEditTenantSettings.value || loading.value || !!validationMessage.value)
// Each side is named by the system it reads ("HotWax" / "Shopify"), as the rules board titles its
// columns. Two endpoints of the same system keep their endpoint labels so the sides stay distinct.
const sourceNames = computed<Record<SourceKey, string>>(() => {
  const names = darpanSystemNamePair(sourceSystemName('source1'), sourceSystemName('source2'))
  return { source1: names.file1 || 'Source 1', source2: names.file2 || 'Source 2' }
})

type SourceKey = 'source1' | 'source2'

function formatSchemaLabel(schema: JsonSchemaSummary): string {
  const schemaLabel = resolveRecordLabel({
    description: schema.description,
    primary: schema.schemaName,
  })
  const systemLabel = schema.systemLabel?.trim() || schema.systemEnumId?.trim() || ''

  return systemLabel ? `${schemaLabel} - ${systemLabel}` : schemaLabel
}

function sourceSystemName(sourceKey: SourceKey): string {
  if (ruleSetDraft.value) return reconciliationSystemTitle(ruleSetDraft.value, sourceKey === 'source1' ? 'file1' : 'file2', 'Source')
  const schema = sourceKey === 'source1' ? source1Schema.value : source2Schema.value
  return schema ? darpanSystemDisplayLabel(schema.systemEnumId, schema.systemLabel) : ''
}

function sourceUsesApi(sourceKey: SourceKey): boolean {
  const sourceTypeEnumId = sourceKey === 'source1'
    ? ruleSetDraft.value?.file1SourceTypeEnumId
    : ruleSetDraft.value?.file2SourceTypeEnumId
  return sourceTypeEnumId?.trim() === SOURCE_TYPE_API
}

function sourceUsesSuiteQl(sourceKey: SourceKey): boolean {
  return sourceUsesApi(sourceKey) && resolveSelectedSourceConfigType(sourceKey) === SOURCE_CONFIG_TYPE_SUITEQL
}

function sourceForm(sourceKey: SourceKey): RunSourceForm {
  return sourceKey === 'source1' ? form.source1 : form.source2
}

function sourceSystemEnumId(sourceKey: SourceKey): string {
  if (sourceUsesApi(sourceKey)) return sourceForm(sourceKey).systemEnumId

  return sourceKey === 'source1'
    ? source1Schema.value?.systemEnumId ?? ''
    : source2Schema.value?.systemEnumId ?? ''
}

function endpointMatchesSystem(endpointSystemEnumId: string | undefined, selectedSystemEnumId: string): boolean {
  return darpanSystemIdsMatch(endpointSystemEnumId, selectedSystemEnumId)
}

// DAR-UI-077. Endpoints are grouped under their parent system (OMS_GQL and OMS_RECON_ORDERS under OMS), as in the run
// builder, so a side can move to a sibling endpoint and not only keep its own.
function endpointInSystemFamily(endpointSystemEnumId: string | undefined, selectedSystemEnumId: string): boolean {
  return darpanSystemIdsMatch(
    resolveDarpanSystemParentEnumId(endpointSystemEnumId, systemOptions.value),
    resolveDarpanSystemParentEnumId(selectedSystemEnumId, systemOptions.value),
  )
}

function sourceConfigMatches(candidate: string | undefined, selected: string): boolean {
  return Boolean(candidate?.trim() && selected.trim() && candidate.trim() === selected.trim())
}

function apiSourceConfigOptionsForSource(sourceKey: SourceKey): AppSelectOption[] {
  const systemEnumId = sourceSystemEnumId(sourceKey)
  return sourceConfigs.value
    .filter((config) => endpointMatchesSystem(config.systemEnumId, systemEnumId))
    .map((config) => ({
      value: config.sourceConfigId,
      label: config.label || config.description || config.sourceConfigId,
    }))
}

function apiEndpointOptionsForSource(sourceKey: SourceKey): AppSelectOption[] {
  const source = sourceForm(sourceKey)
  const systemEnumId = sourceSystemEnumId(sourceKey)
  if (!source.sourceConfigId) return []

  return [
    ...nsRestletConfigs.value
      .filter((config) => endpointMatchesSystem(config.systemEnumId, systemEnumId))
      .filter((config) => sourceConfigMatches(config.sourceConfigId || config.nsAuthConfigId, source.sourceConfigId))
      .map((config) => ({
        value: `ns:${config.nsRestletConfigId}`,
        label: config.label || config.description || config.nsRestletConfigId,
      })),
    ...systemRemotes.value
      .filter((remote) => endpointInSystemFamily(remote.systemEnumId, systemEnumId))
      .filter((remote) => sourceConfigMatches(remote.sourceConfigId || remote.optionKey, source.sourceConfigId))
      .map((remote) => ({
        value: remoteSelectValue(remote),
        label: remote.label || remote.description || remote.systemMessageRemoteId,
      })),
  ]
}

// Keyed by endpoint system too: sibling endpoints share one remote (HOTWAX_ORDERS_API), and OMS_GQL has none.
function remoteSelectValue(remote: AutomationSystemRemoteOption): string {
  const optionKey = remote.optionKey || remote.sourceConfigId || ''
  return `remote:${remote.systemMessageRemoteId ?? ''}:${optionKey}:${remote.systemEnumId ?? ''}`
}

function selectedApiEndpointValue(sourceKey: SourceKey): string {
  const source = sourceForm(sourceKey)
  if (source.nsRestletConfigId) return `ns:${source.nsRestletConfigId}`
  const selectedRemote = selectedRemoteOptionForSource(sourceKey)
  if (selectedRemote) return remoteSelectValue(selectedRemote)
  return source.systemMessageRemoteId ? `remote:${source.systemMessageRemoteId}` : ''
}

function selectedApiSourceOption(sourceKey: SourceKey): AutomationNsRestletOption | AutomationSystemRemoteOption | null {
  const selectedValue = selectedApiEndpointValue(sourceKey)
  if (selectedValue.startsWith('ns:')) {
    const configId = selectedValue.slice(3)
    return nsRestletConfigs.value.find((config) => config.nsRestletConfigId === configId) ?? null
  }
  if (selectedValue.startsWith('remote:')) return selectedRemoteOptionForSource(sourceKey)
  return null
}

function selectedApiSourceLabel(sourceKey: SourceKey): string {
  const option = selectedApiSourceOption(sourceKey)
  return option?.label || option?.description || ''
}

/**
 * The remote option this side actually selected -- the row whose primaryIdOptions become the
 * Primary ID dropdown and whose label is saved as file{n}SystemMessageRemoteLabel.
 *
 * MUST be constrained by systemEnumId. systemMessageRemoteId is deliberately SHARED across a system
 * family (SHOPIFY_RETURN_REFS reuses SHOPIFY's SHOPIFY_REMOTE; OMS_RETURNS, OMS_RECON_ORDERS and
 * OMS_TRANSFER_ORDERS all reuse OMS's HOTWAX_ORDERS_API -- see SourceSystemConnectorSeedData.xml),
 * so remoteId + sourceConfigId does not identify one row. Matching on those alone made .find()
 * return whichever sibling came first -- in practice the PARENT -- and a returns run's Primary ID
 * dropdown offered Shopify's ORDER fields ("Order ID", "Order name") with the endpoint's own
 * refundOrReturnId nowhere in the list. Same defect class as the Schema card's endpoint label.
 *
 * Falls back to the unconstrained match when the side carries no systemEnumId or nothing matches,
 * so bespoke remotes outside the endpoint registry keep resolving as before. A side with no remote
 * (OMS_GQL, DAR-UI-077) resolves only through its own endpoint row.
 */
function selectedRemoteOptionForSource(sourceKey: SourceKey): AutomationSystemRemoteOption | null {
  const source = sourceForm(sourceKey)

  const matchesRemoteAndConfig = (remote: AutomationSystemRemoteOption): boolean => (
    (remote.systemMessageRemoteId ?? '') === source.systemMessageRemoteId &&
    (!source.sourceConfigId || sourceConfigMatches(remote.sourceConfigId || remote.optionKey, source.sourceConfigId))
  )

  const systemEnumId = sourceSystemEnumId(sourceKey)
  if (systemEnumId) {
    const endpointMatch = systemRemotes.value.find((remote) =>
      matchesRemoteAndConfig(remote) && endpointMatchesSystem(remote.systemEnumId, systemEnumId),
    )
    if (endpointMatch) return endpointMatch
  }

  if (!source.systemMessageRemoteId) return null
  return systemRemotes.value.find(matchesRemoteAndConfig) ?? null
}

/** The query's own option row: its primaryIdOptions are the SuiteQL side's key candidates. */
function selectedSuiteQlQueryRow(sourceKey: SourceKey): AutomationSourceConfigOption | null {
  const source = sourceForm(sourceKey)
  const systemEnumId = sourceSystemEnumId(sourceKey)
  if (!source.sourceConfigId) return null
  return sourceConfigs.value.find((config) =>
    sourceConfigMatches(config.sourceConfigId, source.sourceConfigId) &&
    (!config.systemEnumId || !systemEnumId || endpointMatchesSystem(config.systemEnumId, systemEnumId)),
  ) ?? null
}

function apiPrimaryIdPlaceholder(sourceKey: SourceKey): string {
  const ready = sourceUsesSuiteQl(sourceKey) ? Boolean(sourceForm(sourceKey).sourceConfigId) : Boolean(selectedApiEndpointValue(sourceKey))
  if (ready) return `Select ${sourceNames.value[sourceKey]} primary ID`
  return sourceUsesSuiteQl(sourceKey) ? 'Choose an API config first' : 'Choose an endpoint first'
}

function apiPrimaryIdOptionsForSource(sourceKey: SourceKey): AppSelectOption[] {
  const rawOptions = (sourceUsesSuiteQl(sourceKey)
    ? selectedSuiteQlQueryRow(sourceKey)?.primaryIdOptions
    : selectedApiSourceOption(sourceKey)?.primaryIdOptions) ?? []
  return rawOptions.flatMap((option: AutomationPrimaryIdOption) => {
    const fieldPath = option.fieldPath?.trim()
    if (!fieldPath) return []
    return [{
      value: fieldPath,
      label: option.label || fieldPath,
    }]
  })
}

function updateApiSourceConfig(sourceKey: SourceKey, value: string): void {
  const source = sourceForm(sourceKey)
  const selectedConfig = sourceConfigs.value.find((config) => config.sourceConfigId === value) ?? null
  source.sourceConfigId = selectedConfig?.sourceConfigId ?? ''
  source.sourceConfigType = selectedConfig?.sourceConfigType ?? ''
  clearApiEndpoint(sourceKey)
}

function updateApiEndpoint(sourceKey: SourceKey, value: string): void {
  const source = sourceForm(sourceKey)
  source.fieldPaths = []

  if (value.startsWith('ns:')) {
    source.nsRestletConfigId = value.slice(3)
    source.systemMessageRemoteId = ''
    return
  }

  if (value.startsWith('remote:')) {
    const remote = systemRemotes.value.find((candidate) => remoteSelectValue(candidate) === value)
    source.systemMessageRemoteId = remote ? remote.systemMessageRemoteId ?? '' : value.split(':')[1] ?? ''
    source.nsRestletConfigId = ''
    if (remote?.systemEnumId) source.systemEnumId = remote.systemEnumId
    if (remote?.sourceConfigType) source.sourceConfigType = remote.sourceConfigType
    return
  }

  clearApiEndpoint(sourceKey)
}

function clearApiEndpoint(sourceKey: SourceKey): void {
  const source = sourceForm(sourceKey)
  source.nsRestletConfigId = ''
  source.systemMessageRemoteId = ''
  source.fieldPaths = []
}

function resolveSelectedSourceConfigType(sourceKey: SourceKey): string {
  const source = sourceForm(sourceKey)
  if (source.sourceConfigType.trim()) return source.sourceConfigType.trim()
  return sourceConfigs.value.find((config) => config.sourceConfigId === source.sourceConfigId)?.sourceConfigType ?? ''
}

function validateSource(sourceKey: SourceKey): string | null {
  const source = sourceForm(sourceKey)
  if (sourceUsesApi(sourceKey)) {
    const sourceLabel = sourceNames.value[sourceKey]
    if (!source.sourceConfigId) return `${sourceLabel} needs an API config.`
    if (!sourceUsesSuiteQl(sourceKey) && !selectedApiEndpointValue(sourceKey)) return `${sourceLabel} needs an API endpoint.`
    if (!source.fieldPaths.length) return `${sourceLabel} needs a primary ID field.`
    return null
  }

  if (!source.schemaId) return 'Choose schemas for both sources.'
  if (!source.fieldPaths.length) return 'Choose an ID field for both sources.'
  // Legacy mapping runs (no rule-set draft) save through saveMapping, which only
  // carries one field per side — block extra chips instead of silently dropping them.
  if (!ruleSetDraft.value && source.fieldPaths.length > 1) {
    return `${sourceNames.value[sourceKey]} supports a single ID field.`
  }
  return null
}

function buildSourceKeyFields(sourceKey: SourceKey): Partial<SaveRuleSetRunPayload> {
  const source = sourceForm(sourceKey)
  const isSource1 = sourceKey === 'source1'
  const originalPrimaryIdExpressions = isSource1
    ? ruleSetDraft.value?.file1PrimaryIdExpression
    : ruleSetDraft.value?.file2PrimaryIdExpression
  const primaryIdValues = buildPrimaryIdExpressionValues(originalPrimaryIdExpressions, source.fieldPaths)
  const primaryIdFields = primaryIdExpressionPayloadFields(primaryIdValues, isSource1 ? 'file1' : 'file2')

  if (sourceUsesApi(sourceKey)) {
    const sourceConfigType = resolveSelectedSourceConfigType(sourceKey)
    if (isSource1) {
      return {
        file1SourceTypeEnumId: SOURCE_TYPE_API,
        ...(source.systemMessageRemoteId.trim() ? { file1SystemMessageRemoteId: source.systemMessageRemoteId.trim() } : {}),
        ...(source.nsRestletConfigId.trim() ? { file1NsRestletConfigId: source.nsRestletConfigId.trim() } : {}),
        ...(source.sourceConfigId.trim() ? { file1SourceConfigId: source.sourceConfigId.trim() } : {}),
        ...(sourceConfigType ? { file1SourceConfigType: sourceConfigType } : {}),
        ...primaryIdFields,
      }
    }
    return {
      file2SourceTypeEnumId: SOURCE_TYPE_API,
      ...(source.systemMessageRemoteId.trim() ? { file2SystemMessageRemoteId: source.systemMessageRemoteId.trim() } : {}),
      ...(source.nsRestletConfigId.trim() ? { file2NsRestletConfigId: source.nsRestletConfigId.trim() } : {}),
      ...(source.sourceConfigId.trim() ? { file2SourceConfigId: source.sourceConfigId.trim() } : {}),
      ...(sourceConfigType ? { file2SourceConfigType: sourceConfigType } : {}),
      ...primaryIdFields,
    }
  }

  const selectedSchema = isSource1 ? source1Schema.value : source2Schema.value
  if (isSource1) {
    return {
      file1FileTypeEnumId: 'DftJson',
      file1SchemaFileName: selectedSchema?.schemaName,
      ...primaryIdFields,
    }
  }
  return {
    file2FileTypeEnumId: 'DftJson',
    file2SchemaFileName: selectedSchema?.schemaName,
    ...primaryIdFields,
  }
}

/**
 * Rules and exclusion filters are left off on purpose: save#RuleSetRun keeps the stored ones when they
 * are omitted, and this page edits neither. A one-system (EVALUATE) run sends no file2 field at all.
 */
function buildRuleSetSavePayload(): SaveRuleSetRunPayload {
  return {
    ...buildSourceKeyFields('source1'),
    ...(isSingleSided.value ? {} : buildSourceKeyFields('source2')),
    savedRunId: ruleSetDraft.value?.savedRunId ?? activeMappingId.value,
    runName: form.mappingName.trim(),
    description: ruleSetDraft.value?.description,
    file1SystemEnumId: sourceSystemEnumId('source1'),
    ...(isSingleSided.value ? {} : { file2SystemEnumId: sourceSystemEnumId('source2') }),
  }
}

function resolveSchemaId(jsonSchemaId: string | undefined, schemaName: string | undefined): string {
  const normalizedSchemaId = jsonSchemaId?.trim()
  if (normalizedSchemaId && schemas.value.some((schema) => schema.jsonSchemaId === normalizedSchemaId)) {
    return normalizedSchemaId
  }

  const normalizedSchemaName = schemaName?.trim()
  if (!normalizedSchemaName) return ''

  return schemas.value.find((schema) => schema.schemaName === normalizedSchemaName)?.jsonSchemaId ?? ''
}

function hydrateRuleSetDraftForm(draft: ReconciliationRuleSetDraft): void {
  form.mappingName = draft.runName
  form.source1.schemaId = sourceUsesApi('source1') ? '' : resolveSchemaId(draft.file1JsonSchemaId, draft.file1SchemaFileName)
  form.source1.fieldPaths = [...(draft.file1PrimaryIdExpression ?? [])]
  form.source1.sourceConfigId = draft.file1SourceConfigId ?? ''
  form.source1.sourceConfigType = draft.file1SourceConfigType ?? resolveSelectedSourceConfigType('source1')
  form.source1.nsRestletConfigId = draft.file1NsRestletConfigId ?? ''
  form.source1.systemMessageRemoteId = draft.file1SystemMessageRemoteId ?? ''
  form.source1.systemEnumId = draft.file1SystemEnumId ?? ''
  form.source2.schemaId = sourceUsesApi('source2') ? '' : resolveSchemaId(draft.file2JsonSchemaId, draft.file2SchemaFileName)
  form.source2.fieldPaths = [...(draft.file2PrimaryIdExpression ?? [])]
  form.source2.sourceConfigId = draft.file2SourceConfigId ?? ''
  form.source2.sourceConfigType = draft.file2SourceConfigType ?? resolveSelectedSourceConfigType('source2')
  form.source2.nsRestletConfigId = draft.file2NsRestletConfigId ?? ''
  form.source2.systemMessageRemoteId = draft.file2SystemMessageRemoteId ?? ''
  form.source2.systemEnumId = draft.file2SystemEnumId ?? ''
}

/**
 * The system FAMILY label ("Shopify", "HotWax") the manager page's System card reads, carried over
 * from the draft this workflow opened with. Nothing in this form can derive it — a JSON schema row
 * has no parent concept and an API source has no schema row at all — so the only source is the
 * backend-resolved value already on the draft, and dropping it silently reverts that card to the
 * ENDPOINT name after any edit. Carried ONLY while the side stays in the same system family (a move to a
 * sibling endpoint keeps "HotWax"): switch the source system in the workflow and the old family label
 * would be plain wrong, so it is dropped and the card falls back to the endpoint label until the run
 * is reloaded from the backend.
 */
function carriedSystemParentLabel(side: 'file1' | 'file2', resolvedSystemEnumId: string): string | undefined {
  const prior = ruleSetDraft.value
  if (!prior) return undefined
  const priorSystemEnumId = side === 'file1' ? prior.file1SystemEnumId : prior.file2SystemEnumId
  if (!endpointInSystemFamily(priorSystemEnumId, resolvedSystemEnumId)) return undefined
  return side === 'file1' ? prior.file1SystemParentLabel : prior.file2SystemParentLabel
}

function buildRuleSetDraftFromForm(savedRunName: string): ReconciliationRuleSetDraft {
  const source1 = source1Schema.value
  const source2 = source2Schema.value
  const file1PrimaryIdExpression = buildPrimaryIdExpressionValues(
    ruleSetDraft.value?.file1PrimaryIdExpression,
    form.source1.fieldPaths,
  ).map((value) => value.trim()).filter(Boolean)
  const file2PrimaryIdExpression = buildPrimaryIdExpressionValues(
    ruleSetDraft.value?.file2PrimaryIdExpression,
    form.source2.fieldPaths,
  ).map((value) => value.trim()).filter(Boolean)
  const file1SystemEnumId = (source1UsesApi.value ? form.source1.systemEnumId : source1?.systemEnumId) ?? ruleSetDraft.value?.file1SystemEnumId ?? ''
  const file2SystemEnumId = (source2UsesApi.value ? form.source2.systemEnumId : source2?.systemEnumId) ?? ruleSetDraft.value?.file2SystemEnumId ?? ''

  const file2Fields: Partial<ReconciliationRuleSetDraft> = {
    file2SystemEnumId: file2SystemEnumId,
    file2SystemLabel: source2?.systemLabel ?? selectedApiSourceOption('source2')?.systemLabel ?? ruleSetDraft.value?.file2SystemLabel,
    file2SystemParentLabel: carriedSystemParentLabel('file2', file2SystemEnumId),
    ...(source2UsesApi.value
      ? {
          file2SourceTypeEnumId: SOURCE_TYPE_API,
          file2SystemMessageRemoteId: form.source2.systemMessageRemoteId || undefined,
          file2SystemMessageRemoteLabel: form.source2.systemMessageRemoteId ? selectedApiSourceLabel('source2') || undefined : undefined,
          file2NsRestletConfigId: form.source2.nsRestletConfigId || undefined,
          file2NsRestletConfigLabel: form.source2.nsRestletConfigId ? selectedApiSourceLabel('source2') || undefined : undefined,
          file2SourceConfigId: form.source2.sourceConfigId || undefined,
          file2SourceConfigType: form.source2.sourceConfigType || resolveSelectedSourceConfigType('source2') || undefined,
          file2FileTypeEnumId: '',
        }
      : {
          file2FileTypeEnumId: 'DftJson',
          file2JsonSchemaId: source2?.jsonSchemaId,
          file2SchemaLabel: source2 ? resolveSchemaLabel(source2) : ruleSetDraft.value?.file2SchemaLabel,
          file2SchemaFileName: source2?.schemaName,
        }),
    file2PrimaryIdExpression,
  }

  // Spread the draft this page opened with first: scopeMode, exclusion filters and side options are not
  // edited here, and the run details page reads them off this draft (an EVALUATE run keeps its empty file2).
  return {
    ...(ruleSetDraft.value ?? {}),
    savedRunId: ruleSetDraft.value?.savedRunId ?? activeMappingId.value,
    runName: savedRunName,
    description: ruleSetDraft.value?.description,
    file1SystemEnumId: file1SystemEnumId,
    file1SystemLabel: source1?.systemLabel ?? selectedApiSourceOption('source1')?.systemLabel ?? ruleSetDraft.value?.file1SystemLabel,
    file1SystemParentLabel: carriedSystemParentLabel('file1', file1SystemEnumId),
    ...(source1UsesApi.value
      ? {
          file1SourceTypeEnumId: SOURCE_TYPE_API,
          file1SystemMessageRemoteId: form.source1.systemMessageRemoteId || undefined,
          file1SystemMessageRemoteLabel: form.source1.systemMessageRemoteId ? selectedApiSourceLabel('source1') || undefined : undefined,
          file1NsRestletConfigId: form.source1.nsRestletConfigId || undefined,
          file1NsRestletConfigLabel: form.source1.nsRestletConfigId ? selectedApiSourceLabel('source1') || undefined : undefined,
          file1SourceConfigId: form.source1.sourceConfigId || undefined,
          file1SourceConfigType: form.source1.sourceConfigType || resolveSelectedSourceConfigType('source1') || undefined,
          file1FileTypeEnumId: '',
        }
      : {
          file1FileTypeEnumId: 'DftJson',
          file1JsonSchemaId: source1?.jsonSchemaId,
          file1SchemaLabel: source1 ? resolveSchemaLabel(source1) : ruleSetDraft.value?.file1SchemaLabel,
          file1SchemaFileName: source1?.schemaName,
        }),
    file1PrimaryIdExpression,
    file2SystemEnumId: ruleSetDraft.value?.file2SystemEnumId ?? '',
    file2FileTypeEnumId: ruleSetDraft.value?.file2FileTypeEnumId ?? '',
    file2PrimaryIdExpression: ruleSetDraft.value?.file2PrimaryIdExpression ?? [],
    ...(isSingleSided.value ? {} : file2Fields),
    rules: ruleSetDraft.value?.rules,
  }
}

function resolveSelectedFieldPath(schemaId: string, rawFieldPath: string): string | null {
  if (!schemaId || !rawFieldPath) return null

  const matchingField = (flattenedFields.value[schemaId] ?? []).find((field) => fieldsReferenceSamePath(field.fieldPath, rawFieldPath))

  return matchingField?.fieldPath ?? null
}

function preserveFieldExpressionSuffix(originalFieldPath: string | undefined, selectedFieldPath: string): string {
  const suffix = originalFieldPath?.split('|').slice(1).join('|').trim()
  if (!originalFieldPath || !suffix) return selectedFieldPath

  const sameBaseField = fieldsReferenceSamePath(originalFieldPath, selectedFieldPath)
  return sameBaseField ? `${selectedFieldPath}|${suffix}` : selectedFieldPath
}

/**
 * Composite-key form of `preserveFieldExpressionSuffix`: for each currently selected field, find
 * the originally saved expression (if any) that resolves to the same base field and preserve its
 * `|suffix` annotation. Fields with no matching original (e.g. newly added composite members) pass
 * through unchanged.
 */
function buildPrimaryIdExpressionValues(originalExpressions: string[] | undefined, selectedFieldPaths: string[]): string[] {
  const originals = originalExpressions ?? []
  return selectedFieldPaths.map((fieldPath) => {
    const matchingOriginal = originals.find((original) => fieldsReferenceSamePath(original, fieldPath))
    return preserveFieldExpressionSuffix(matchingOriginal, fieldPath)
  })
}

function buildFieldOptions(schemaId: string): AppSelectOption[] {
  return (flattenedFields.value[schemaId] ?? []).map((field) => ({
    value: field.fieldPath,
    label: field.fieldPath,
  }))
}

function restrictToSharedRecordRoot(options: AppSelectOption[], chosenFieldPaths: string[]): AppSelectOption[] {
  const reference = chosenFieldPaths[0]
  // DAR-UI-064: a bare stored key (a seed-loaded run's "tranId") names no record root to share; narrowing by it emptied
  // the list and disabled the picker.
  if (!reference || !reference.trim().startsWith('$')) return options
  return options.filter((option) => fieldSharesRecordRoot(option.value, reference))
}

function resolveOriginPath(): string {
  return draftStore.workflowOrigin?.path ?? '/settings/runs'
}

const pageAbortController = new AbortController()
let loadController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  loadController?.abort()
})

async function ensureFieldsLoaded(schemaId: string, signal?: AbortSignal): Promise<void> {
  if (!schemaId || flattenedFields.value[schemaId]) return

  const response = await jsonSchemaFacade.flatten({ jsonSchemaId: schemaId }, signal ?? pageAbortController.signal)
  const comparableFields = (response.fieldList ?? []).filter((field) => field.type !== 'object' && field.type !== 'array')
  flattenedFields.value = {
    ...flattenedFields.value,
    [schemaId]: comparableFields,
  }
}

async function syncFieldOptions(sourceKey: 'source1' | 'source2', signal?: AbortSignal): Promise<void> {
  if (sourceUsesApi(sourceKey)) return

  const source = form[sourceKey]
  if (!source.schemaId) {
    source.fieldPaths = []
    return
  }

  try {
    await ensureFieldsLoaded(source.schemaId, signal)
    if (source.fieldPaths.length) {
      source.fieldPaths = source.fieldPaths
        .map((fieldPath) => resolveSelectedFieldPath(source.schemaId, fieldPath))
        .filter((resolved): resolved is string => Boolean(resolved))
    }
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'The schema fields wandered off the schema.'
  }
}

async function load(): Promise<void> {
  if (!activeMappingId.value) {
    error.value = 'Run ID is missing.'
    return
  }

  loading.value = true
  error.value = null
  success.value = null

  loadController?.abort()
  loadController = new AbortController()
  const signal = loadController.signal

  try {
    const draftState = draftStore.ruleSetDraftState
    const historyDraft = draftState?.draft?.savedRunId === activeMappingId.value ? draftState.draft : null
    const shouldLoadApiOptions = Boolean(historyDraft && (
      historyDraft.file1SourceTypeEnumId?.trim() === SOURCE_TYPE_API ||
      historyDraft.file2SourceTypeEnumId?.trim() === SOURCE_TYPE_API
    ))
    const schemasResponse = await jsonSchemaFacade.list({
      pageIndex: 0,
      pageSize: 200,
      query: '',
    }, signal)
    const automationSourceOptionsResponse = shouldLoadApiOptions
      ? await reconciliationFacade.listAutomationSourceOptions(signal)
      : null

    schemas.value = schemasResponse.schemas ?? []
    sourceConfigs.value = automationSourceOptionsResponse?.sourceConfigs ?? []
    nsRestletConfigs.value = automationSourceOptionsResponse?.nsRestletConfigs ?? []
    systemRemotes.value = automationSourceOptionsResponse?.systemRemotes ?? []
    systemOptions.value = deduplicateDarpanSystemOptions(automationSourceOptionsResponse?.systems ?? []).map((option) => ({
      value: option.enumId,
      parentEnumId: option.parentEnumId || undefined,
    }))

    if (historyDraft) {
      ruleSetDraft.value = historyDraft
      hydrateRuleSetDraftForm(historyDraft)
      await Promise.all([
        syncFieldOptions('source1', signal),
        syncFieldOptions('source2', signal),
      ])
      return
    }

    const mappingResponse = await reconciliationFacade.getMapping({
      reconciliationMappingId: activeMappingId.value,
    }, signal)

    const mapping = mappingResponse.mapping
    if (!mapping) {
      error.value = `Run "${activeMappingId.value}" ran away. Fittingly.`
      return
    }
    if ((mapping.members?.length ?? 0) !== 2) {
      error.value = 'Only two-source runs can be edited in this workflow.'
      return
    }

    form.mappingName = mapping.mappingName ?? ''
    form.source1.schemaId = mapping.members?.[0]?.jsonSchemaId ?? ''
    form.source1.fieldPaths = mapping.members?.[0]?.fieldPath ? [mapping.members[0].fieldPath] : []
    form.source2.schemaId = mapping.members?.[1]?.jsonSchemaId ?? ''
    form.source2.fieldPaths = mapping.members?.[1]?.fieldPath ? [mapping.members[1].fieldPath] : []

    await Promise.all([
      syncFieldOptions('source1', signal),
      syncFieldOptions('source2', signal),
    ])
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Run settings are behind a door marked pull. We pushed.'
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  if (submitDisabled.value) return

  loading.value = true
  error.value = null
  success.value = null

  try {
    if (ruleSetDraft.value) {
      const response = await reconciliationFacade.saveRuleSetRun(buildRuleSetSavePayload())
      const savedRunName = response.savedRun?.runName || form.mappingName.trim()
      success.value = response.messages?.[0] ?? 'Saved run.'
      draftStore.setRuleSetDraft(buildRuleSetDraftFromForm(savedRunName), 'ruleset-manager')
      await router.push({ name: 'reconciliation-ruleset-manager' })
      return
    }

    const response = await reconciliationFacade.saveMapping({
      reconciliationMappingId: activeMappingId.value,
      mappingName: form.mappingName.trim(),
      schema1Id: form.source1.schemaId,
      schema2Id: form.source2.schemaId,
      schema1FieldPath: form.source1.fieldPaths[0] ?? '',
      schema2FieldPath: form.source2.fieldPaths[0] ?? '',
    })
    success.value = response.messages?.[0] ?? 'Saved run.'
    await router.push(resolveOriginPath())
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Run settings ran off before the save. Not saved.'
  } finally {
    loading.value = false
  }
}

async function cancelEdit(): Promise<void> {
  if (loading.value) return
  if (ruleSetDraft.value) {
    draftStore.setRuleSetDraft(ruleSetDraft.value, 'ruleset-manager')
    await router.push({ name: 'reconciliation-ruleset-manager' })
    return
  }
  await router.push(resolveOriginPath())
}

watch(() => form.source1.schemaId, () => {
  void syncFieldOptions('source1')
})

watch(() => form.source2.schemaId, () => {
  void syncFieldOptions('source2')
})

watch(() => route.fullPath, () => {
  void load()
}, { immediate: true })
</script>
