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
            <span class="workflow-context-label">Source 1 API Config</span>
            <AppSelect
              v-model="source1ApiConfigValue"
              :disabled="!canEditTenantSettings || loading"
              :options="source1ApiConfigOptions"
              placeholder="Select source 1 API config"
              test-id="run-api-config-1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 1 Endpoint</span>
            <AppSelect
              v-model="source1ApiEndpointValue"
              :disabled="!canEditTenantSettings || loading || source1ApiEndpointOptions.length === 0"
              :options="source1ApiEndpointOptions"
              :placeholder="form.source1.sourceConfigId ? 'Select source 1 endpoint' : 'Choose an API config first'"
              test-id="run-api-endpoint-1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 1 Primary ID</span>
            <WorkflowSelect
              v-model="form.source1.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeSource1ApiFieldOptions.length === 0"
              :options="activeSource1ApiFieldOptions"
              :placeholder="source1ApiEndpointValue ? 'Select source 1 primary ID' : 'Choose an endpoint first'"
              test-id="run-api-field-1"
            />
          </label>
        </template>

        <template v-else>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 1 Schema</span>
            <AppSelect
              v-model="form.source1.schemaId"
              :disabled="!canEditTenantSettings || loading"
              :options="schemaOptions"
              placeholder="Select source 1 schema"
              test-id="run-schema-1"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 1 Field</span>
            <WorkflowSelect
              v-model="form.source1.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeFieldOptions1.length === 0"
              :options="activeFieldOptions1"
              :placeholder="form.source1.schemaId ? 'Select source 1 field' : 'Choose a schema first'"
              test-id="run-field-1"
            />
          </label>
        </template>
      </div>

      <div class="workflow-form-grid workflow-form-grid--two" data-testid="run-source-2-row">
        <template v-if="source2UsesApi">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 2 API Config</span>
            <AppSelect
              v-model="source2ApiConfigValue"
              :disabled="!canEditTenantSettings || loading"
              :options="source2ApiConfigOptions"
              placeholder="Select source 2 API config"
              test-id="run-api-config-2"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 2 Endpoint</span>
            <AppSelect
              v-model="source2ApiEndpointValue"
              :disabled="!canEditTenantSettings || loading || source2ApiEndpointOptions.length === 0"
              :options="source2ApiEndpointOptions"
              :placeholder="form.source2.sourceConfigId ? 'Select source 2 endpoint' : 'Choose an API config first'"
              test-id="run-api-endpoint-2"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 2 Primary ID</span>
            <WorkflowSelect
              v-model="form.source2.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeSource2ApiFieldOptions.length === 0"
              :options="activeSource2ApiFieldOptions"
              :placeholder="source2ApiEndpointValue ? 'Select source 2 primary ID' : 'Choose an endpoint first'"
              test-id="run-api-field-2"
            />
          </label>
        </template>

        <template v-else>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 2 Schema</span>
            <AppSelect
              v-model="form.source2.schemaId"
              :disabled="!canEditTenantSettings || loading"
              :options="schemaOptions"
              placeholder="Select source 2 schema"
              test-id="run-schema-2"
            />
          </label>

          <label class="wizard-input-shell">
            <span class="workflow-context-label">Source 2 Field</span>
            <WorkflowSelect
              v-model="form.source2.fieldPaths"
              multiple
              :disabled="!canEditTenantSettings || loading || activeFieldOptions2.length === 0"
              :options="activeFieldOptions2"
              :placeholder="form.source2.schemaId ? 'Select source 2 field' : 'Choose a schema first'"
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
  primaryIdExpressionPayloadFields,
  type ReconciliationRuleSetDraft,
} from '../../lib/reconciliationRuleSetDraft'
import { darpanSystemIdsMatch } from '../../lib/utils/darpanSystems'
import { resolveRecordLabel } from '../../lib/utils/recordLabel'
import { resolveSchemaLabel } from '../../lib/utils/schemaLabel'

interface RunSourceForm {
  schemaId: string
  fieldPaths: string[]
  sourceConfigId: string
  sourceConfigType: string
  nsRestletConfigId: string
  systemMessageRemoteId: string
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

const schemas = ref<JsonSchemaSummary[]>([])
const sourceConfigs = ref<AutomationSourceConfigOption[]>([])
const nsRestletConfigs = ref<AutomationNsRestletOption[]>([])
const systemRemotes = ref<AutomationSystemRemoteOption[]>([])
const flattenedFields = ref<Record<string, JsonSchemaField[]>>({})
const ruleSetDraft = ref<ReconciliationRuleSetDraft | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

const form = reactive<RunForm>({
  mappingName: '',
  source1: { schemaId: '', fieldPaths: [], sourceConfigId: '', sourceConfigType: '', nsRestletConfigId: '', systemMessageRemoteId: '' },
  source2: { schemaId: '', fieldPaths: [], sourceConfigId: '', sourceConfigType: '', nsRestletConfigId: '', systemMessageRemoteId: '' },
})

const activeMappingId = computed(() => String(route.params.reconciliationMappingId ?? '').trim())
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
const source1Schema = computed(() => schemas.value.find((schema) => schema.jsonSchemaId === form.source1.schemaId) ?? null)
const source2Schema = computed(() => schemas.value.find((schema) => schema.jsonSchemaId === form.source2.schemaId) ?? null)
const source1UsesApi = computed(() => sourceUsesApi('source1'))
const source2UsesApi = computed(() => sourceUsesApi('source2'))
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
  const source2Validation = validateSource('source2')
  if (source2Validation) return source2Validation
  if (!sourceSystemEnumId('source1') || !sourceSystemEnumId('source2')) return 'Both sources need an assigned reconciliation system.'
  if (darpanSystemIdsMatch(sourceSystemEnumId('source1'), sourceSystemEnumId('source2'))) return 'Source 2 must use a different system than source 1.'
  return null
})
const submitDisabled = computed(() => !canEditTenantSettings.value || loading.value || !!validationMessage.value)

type SourceKey = 'source1' | 'source2'

function formatSchemaLabel(schema: JsonSchemaSummary): string {
  const schemaLabel = resolveRecordLabel({
    description: schema.description,
    primary: schema.schemaName,
  })
  const systemLabel = schema.systemLabel?.trim() || schema.systemEnumId?.trim() || ''

  return systemLabel ? `${schemaLabel} - ${systemLabel}` : schemaLabel
}

function sourceUsesApi(sourceKey: SourceKey): boolean {
  const sourceTypeEnumId = sourceKey === 'source1'
    ? ruleSetDraft.value?.file1SourceTypeEnumId
    : ruleSetDraft.value?.file2SourceTypeEnumId
  return sourceTypeEnumId?.trim() === SOURCE_TYPE_API
}

function sourceForm(sourceKey: SourceKey): RunSourceForm {
  return sourceKey === 'source1' ? form.source1 : form.source2
}

function sourceSystemEnumId(sourceKey: SourceKey): string {
  if (sourceUsesApi(sourceKey)) {
    return sourceKey === 'source1'
      ? ruleSetDraft.value?.file1SystemEnumId ?? ''
      : ruleSetDraft.value?.file2SystemEnumId ?? ''
  }

  return sourceKey === 'source1'
    ? source1Schema.value?.systemEnumId ?? ''
    : source2Schema.value?.systemEnumId ?? ''
}

function endpointMatchesSystem(endpointSystemEnumId: string | undefined, selectedSystemEnumId: string): boolean {
  return darpanSystemIdsMatch(endpointSystemEnumId, selectedSystemEnumId)
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
      .filter((remote) => endpointMatchesSystem(remote.systemEnumId, systemEnumId))
      .filter((remote) => sourceConfigMatches(remote.sourceConfigId || remote.optionKey, source.sourceConfigId))
      .map((remote) => ({
        value: remoteSelectValue(remote),
        label: remote.label || remote.description || remote.systemMessageRemoteId,
      })),
  ]
}

function remoteSelectValue(remote: AutomationSystemRemoteOption): string {
  const optionKey = remote.optionKey || remote.sourceConfigId
  return optionKey ? `remote:${remote.systemMessageRemoteId}:${optionKey}` : `remote:${remote.systemMessageRemoteId}`
}

function selectedApiEndpointValue(sourceKey: SourceKey): string {
  const source = sourceForm(sourceKey)
  if (source.nsRestletConfigId) return `ns:${source.nsRestletConfigId}`
  if (source.systemMessageRemoteId) {
    const selectedRemote = selectedRemoteOptionForSource(sourceKey)
    return selectedRemote ? remoteSelectValue(selectedRemote) : `remote:${source.systemMessageRemoteId}`
  }
  return ''
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

function selectedRemoteOptionForSource(sourceKey: SourceKey): AutomationSystemRemoteOption | null {
  const source = sourceForm(sourceKey)
  if (!source.systemMessageRemoteId) return null

  return systemRemotes.value.find((remote) =>
    remote.systemMessageRemoteId === source.systemMessageRemoteId &&
    (!source.sourceConfigId || sourceConfigMatches(remote.sourceConfigId || remote.optionKey, source.sourceConfigId)),
  ) ?? null
}

function apiPrimaryIdOptionsForSource(sourceKey: SourceKey): AppSelectOption[] {
  const rawOptions = selectedApiSourceOption(sourceKey)?.primaryIdOptions ?? []
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
    const [, remoteId = ''] = value.split(':')
    source.systemMessageRemoteId = remoteId
    source.nsRestletConfigId = ''
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
    const sourceLabel = sourceKey === 'source1' ? 'Source 1' : 'Source 2'
    if (!source.sourceConfigId) return `${sourceLabel} needs an API config.`
    if (!selectedApiEndpointValue(sourceKey)) return `${sourceLabel} needs an API endpoint.`
    if (!source.fieldPaths.length) return `${sourceLabel} needs a primary ID field.`
    return null
  }

  if (!source.schemaId) return 'Choose schemas for both sources.'
  if (!source.fieldPaths.length) return 'Choose an ID field for both sources.'
  // Legacy mapping runs (no rule-set draft) save through saveMapping, which only
  // carries one field per side — block extra chips instead of silently dropping them.
  if (!ruleSetDraft.value && source.fieldPaths.length > 1) {
    return `${sourceKey === 'source1' ? 'Source 1' : 'Source 2'} supports a single ID field.`
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

function buildRuleSetSavePayload(): SaveRuleSetRunPayload {
  return {
    ...buildSourceKeyFields('source1'),
    ...buildSourceKeyFields('source2'),
    savedRunId: ruleSetDraft.value?.savedRunId ?? activeMappingId.value,
    runName: form.mappingName.trim(),
    description: ruleSetDraft.value?.description,
    file1SystemEnumId: sourceSystemEnumId('source1'),
    file2SystemEnumId: sourceSystemEnumId('source2'),
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
  form.source2.schemaId = sourceUsesApi('source2') ? '' : resolveSchemaId(draft.file2JsonSchemaId, draft.file2SchemaFileName)
  form.source2.fieldPaths = [...(draft.file2PrimaryIdExpression ?? [])]
  form.source2.sourceConfigId = draft.file2SourceConfigId ?? ''
  form.source2.sourceConfigType = draft.file2SourceConfigType ?? resolveSelectedSourceConfigType('source2')
  form.source2.nsRestletConfigId = draft.file2NsRestletConfigId ?? ''
  form.source2.systemMessageRemoteId = draft.file2SystemMessageRemoteId ?? ''
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

  return {
    savedRunId: ruleSetDraft.value?.savedRunId ?? activeMappingId.value,
    runName: savedRunName,
    description: ruleSetDraft.value?.description,
    file1SystemEnumId: source1?.systemEnumId ?? ruleSetDraft.value?.file1SystemEnumId ?? '',
    file1SystemLabel: source1?.systemLabel ?? ruleSetDraft.value?.file1SystemLabel,
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
    file2SystemEnumId: source2?.systemEnumId ?? ruleSetDraft.value?.file2SystemEnumId ?? '',
    file2SystemLabel: source2?.systemLabel ?? ruleSetDraft.value?.file2SystemLabel,
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
    rules: ruleSetDraft.value?.rules,
  }
}

function normalizeFieldPathValue(rawFieldPath: string): string {
  const trimmed = rawFieldPath.trim()
  if (!trimmed) return ''

  const withoutSuffix = trimmed.split('|', 1)[0]?.trim() ?? ''
  if (!withoutSuffix) return ''

  return withoutSuffix
    .replace(/\[(\d+)\]/g, '[*]')
    .replace('.[*]', '[*]')
}

function buildFieldPathAliases(rawFieldPath: string): Set<string> {
  const normalized = normalizeFieldPathValue(rawFieldPath)
  if (!normalized) return new Set()

  const aliases = new Set<string>([normalized])
  if (normalized.startsWith('$.')) aliases.add(normalized.slice(2))
  else if (normalized.startsWith('$[')) aliases.add(normalized.slice(1))
  else if (!normalized.startsWith('$')) aliases.add(normalized.startsWith('[') ? `$${normalized}` : `$.${normalized}`)

  return aliases
}

function resolveSelectedFieldPath(schemaId: string, rawFieldPath: string): string | null {
  if (!schemaId || !rawFieldPath) return null

  const savedAliases = buildFieldPathAliases(rawFieldPath)
  const matchingField = (flattenedFields.value[schemaId] ?? []).find((field) => {
    const fieldAliases = buildFieldPathAliases(field.fieldPath)
    return [...fieldAliases].some((alias) => savedAliases.has(alias))
  })

  return matchingField?.fieldPath ?? null
}

function preserveFieldExpressionSuffix(originalFieldPath: string | undefined, selectedFieldPath: string): string {
  const suffix = originalFieldPath?.split('|').slice(1).join('|').trim()
  if (!originalFieldPath || !suffix) return selectedFieldPath

  const originalAliases = buildFieldPathAliases(originalFieldPath)
  const selectedAliases = buildFieldPathAliases(selectedFieldPath)
  const sameBaseField = [...selectedAliases].some((alias) => originalAliases.has(alias))
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
    const selectedAliases = buildFieldPathAliases(fieldPath)
    const matchingOriginal = originals.find((original) => {
      const originalAliases = buildFieldPathAliases(original)
      return [...selectedAliases].some((alias) => originalAliases.has(alias))
    })
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
  if (!reference) return options
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
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load schema fields.'
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
      error.value = `Unable to find run "${activeMappingId.value}".`
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
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Failed to load run settings.'
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
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Failed to save run settings.'
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
