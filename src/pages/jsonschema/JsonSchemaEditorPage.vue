<template>
  <StaticPageFrame>
    <template #hero>
      <div class="stack-sm">
        <StaticEditableTitle
          :model-value="heroTitle"
          :editable="canEditTarget"
          aria-label="Schema name"
          test-id="schema-editor-title"
          fallback="Schema Editor"
          @update:model-value="setEditableTitle"
          @commit="setEditableTitle"
        />
      </div>
    </template>

    <StaticPageSection>
      <LoadingState v-if="loading && !initialLoadCompleted" noun="schema" />

      <template v-else-if="showInitialLoadFailureState">
        <InlineValidation v-if="error" tone="error" :message="error" />
        <EmptyState
          title="This schema is having a moment"
        />

        <div class="action-row">
          <button type="button" :disabled="loading" @click="initializeEditor">Retry Loading Schema</button>
        </div>
      </template>

      <template v-else-if="!hasTarget">
        <EmptyState
          title="No schema selected"
        />

        <RouterLink class="static-page-action-tile static-page-action-tile--inline" :to="{ name: 'schemas-library' }">
          Go to Schema Library
        </RouterLink>
      </template>

      <template v-else>
        <div class="static-page-summary-grid">
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Schema ID</span>
            <strong>{{ currentSchemaId }}</strong>
          </article>
          <article class="static-page-summary-card schema-editor-summary-card--system">
            <span class="static-page-summary-label">System</span>
            <AppSelect
              v-model="systemEnumId"
              class="schema-editor-summary-select"
              :options="systemOptions"
              :disabled="!canEditTarget || loading || systemOptions.length === 0"
              placeholder="Select system"
              test-id="schema-editor-system"
            />
          </article>
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">Updated</span>
            <strong>{{ formatDate(lastUpdatedStamp) }}</strong>
          </article>
        </div>
      </template>
    </StaticPageSection>

    <StaticPageSection v-if="!showInitialLoadFailureState && hasTarget">
      <form id="schema-editor-refined-form" class="stack-md" @submit.prevent="saveRefinedFields">
        <AppTableFrame :columns="refinedFieldColumns" :rows="refinedFieldRows">
          <template #header-actions>
            <button
              type="button"
              class="app-table__header-action"
              data-testid="schema-editor-download"
              aria-label="Download schema JSON"
              :disabled="!schemaText.trim()"
              @click="downloadSchema"
            >
              <AppIcon name="download" />
            </button>
          </template>

          <template #cell-fieldPath="{ row }">
            <input v-model="row.fieldPath" type="text" placeholder="$.order.id" :disabled="!canEditTarget" />
          </template>

          <template #cell-type="{ row }">
            <AppSelect
              :model-value="String(row.type ?? '')"
              :options="fieldTypeOptions"
              :disabled="!canEditTarget"
              @update:model-value="row.type = $event as JsonSchemaField['type']"
            />
          </template>

          <template #cell-required="{ row }">
            <div class="app-table__control-wrap app-table__control-wrap--start">
              <label class="checkbox-inline checkbox-inline--control-only">
                <input v-model="row.required" class="app-table__checkbox" type="checkbox" aria-label="Required field" :disabled="!canEditTarget" />
              </label>
            </div>
          </template>

          <template #cell-actions="{ index }">
            <div class="app-table__control-wrap app-table__control-wrap--end">
              <button
                v-if="canEditTarget"
                type="button"
                :class="rowDeleteActionClass"
                aria-label="Remove field row"
                @click="removeFieldRow(index)"
              >
                <AppIcon name="trash" />
              </button>
            </div>
          </template>

          <template #append-row="{ columnCount }">
            <tr v-if="canEditTarget">
              <td :colspan="columnCount" class="app-table__append-cell">
                <div class="app-table__append-action">
                  <button
                    type="button"
                    class="app-table__icon-action"
                    data-testid="schema-editor-add-row"
                    aria-label="Add field row"
                    @click="addFieldRow"
                  >
                    <AppIcon name="plus" />
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </AppTableFrame>
      </form>
    </StaticPageSection>

    <InlineValidation v-if="error && !showInitialLoadFailureState" tone="error" :message="error" />

    <template v-if="canEditTarget" #actions>
      <div class="action-row schema-editor-footer-row">
        <AppSaveAction
          type="submit"
          form="schema-editor-refined-form"
          class="schema-editor-footer-action"
          test-id="save-refined-fields"
          label="Save refined fields"
          :disabled="footerActionsDisabled"
        />
        <button
          type="button"
          :class="footerDeleteActionClass"
          data-testid="delete-schema"
          aria-label="Delete schema"
          :disabled="footerActionsDisabled"
          @click="deleteSchema"
        >
          <AppIcon name="trash" />
        </button>
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError, isAbortError } from '../../lib/api/client'
import { jsonSchemaFacade, settingsFacade } from '../../lib/api/facade'
import type { JsonSchemaField } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { formatDateTime } from '../../lib/utils/date'
import { downloadTextFile } from '../../lib/utils/download'
import { toEnumSelectOption } from '../../lib/enumOptions'

interface EditableFieldRow {
  fieldPath: string
  type: JsonSchemaField['type']
  required: boolean
}

const fieldTypes: JsonSchemaField['type'][] = ['string', 'integer', 'number', 'boolean', 'object', 'array']
const fieldTypeOptions: AppSelectOption[] = fieldTypes.map((fieldType) => ({ value: fieldType, label: fieldType }))
const rowDeleteActionClass = 'app-table__icon-action app-table__icon-action--danger schema-editor-row-delete-action'
const footerDeleteActionClass =
  'app-icon-action app-icon-action--large app-icon-action--danger schema-editor-footer-action'

const props = defineProps<{
  jsonSchemaId?: string
}>()

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()

const currentSchemaId = ref(props.jsonSchemaId ?? String(route.params.jsonSchemaId ?? '').trim())
const schemaName = ref('')
const description = ref('')
const systemEnumId = ref('')
const systemLabel = ref('')
const systemOptions = ref<AppSelectOption[]>([])
const lastUpdatedStamp = ref('')
const schemaText = ref('')
const fieldRows = ref<EditableFieldRow[]>([])
const editableTitleTarget = ref<'description' | 'schemaName'>('schemaName')
const loading = ref(false)
const savingRefined = ref(false)
const deletingSchema = ref(false)
const error = ref<string | null>(null)
const initialLoadCompleted = ref(false)
const initialLoadSucceeded = ref(false)

const hasTarget = computed(() => currentSchemaId.value.length > 0)
const canEditTarget = computed(() => permissionsStore.canEditTenantSettings && hasTarget.value && initialLoadSucceeded.value)
const showInitialLoadFailureState = computed(() => hasTarget.value && initialLoadCompleted.value && !initialLoadSucceeded.value)
const footerActionsDisabled = computed(() => !canEditTarget.value || savingRefined.value || deletingSchema.value)
const heroTitle = computed(() => {
  if (description.value.trim()) return description.value.trim()
  if (schemaName.value.trim()) return schemaName.value.trim()
  return 'Schema Editor'
})
const refinedFieldColumns = [
  { key: 'fieldPath', label: 'Field Path', cellClass: 'app-table__control-cell' },
  { key: 'type', label: 'Type', colStyle: { width: '10rem' }, cellClass: 'app-table__control-cell' },
  { key: 'required', label: 'Required', colStyle: { width: '6.5rem' }, cellClass: 'app-table__control-cell' },
  {
    key: 'actions',
    label: '',
    headerAlign: 'end' as const,
    colClass: 'app-table__action-column',
    colStyle: { width: '4rem' },
    headerClass: 'app-table__action-header',
    cellClass: 'app-table__action-cell',
  },
]
const refinedFieldRows = computed(() => fieldRows.value as Array<Record<string, unknown>>)

function resolveTargetSchemaId(): string {
  return (props.jsonSchemaId ?? String(route.params.jsonSchemaId ?? '')).trim()
}

function resetEditorState(nextSchemaId: string): void {
  currentSchemaId.value = nextSchemaId
  schemaName.value = ''
  description.value = ''
  systemEnumId.value = ''
  systemLabel.value = ''
  lastUpdatedStamp.value = ''
  schemaText.value = ''
  fieldRows.value = []
  editableTitleTarget.value = 'schemaName'
  error.value = null
  initialLoadCompleted.value = false
  initialLoadSucceeded.value = false
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return ['y', 'yes', 'true', '1'].includes(value.toLowerCase())
  return false
}

function normalizeFieldType(value: unknown): JsonSchemaField['type'] {
  const raw = String(value ?? '').toLowerCase()
  if (fieldTypes.includes(raw as JsonSchemaField['type'])) {
    return raw as JsonSchemaField['type']
  }
  return 'string'
}

function formatDate(value: unknown): string {
  return formatDateTime(value, { locale: 'en-US' })
}

function setEditableTitle(value: string): void {
  if (editableTitleTarget.value === 'description') {
    description.value = value
    return
  }

  schemaName.value = value
}

function addFieldRow(): void {
  fieldRows.value.push({
    fieldPath: '',
    type: 'string',
    required: false,
  })
}

function removeFieldRow(index: number): void {
  fieldRows.value.splice(index, 1)
}

function downloadSchema(): void {
  if (!schemaText.value.trim()) return
  downloadTextFile(`${schemaName.value || 'schema'}.json`, schemaText.value, 'application/json')
}

function getSchemaDeleteLabel(): string {
  return description.value.trim() || schemaName.value.trim() || currentSchemaId.value
}

const pageAbortController = new AbortController()
let initializeController: AbortController | null = null

onBeforeUnmount(() => {
  pageAbortController.abort()
  initializeController?.abort()
})

async function loadFlattenedRows(signal?: AbortSignal): Promise<void> {
  const response = await jsonSchemaFacade.flatten({ jsonSchemaId: currentSchemaId.value }, signal)
  fieldRows.value = (response.fieldList ?? []).map((item) => ({
    fieldPath: String(item.fieldPath ?? ''),
    type: normalizeFieldType(item.type),
    required: parseBoolean(item.required),
  }))
}

async function loadSchema(signal?: AbortSignal): Promise<void> {
  if (!hasTarget.value) {
    initialLoadCompleted.value = true
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await jsonSchemaFacade.get({ jsonSchemaId: currentSchemaId.value }, signal)
    const schemaData = response.schemaData

    if (!schemaData) {
      error.value = 'This schema has left the building.'
      return
    }

    currentSchemaId.value = schemaData.jsonSchemaId
    schemaName.value = schemaData.schemaName
    description.value = schemaData.description ?? ''
    editableTitleTarget.value = description.value.trim() ? 'description' : 'schemaName'
    systemEnumId.value = schemaData.systemEnumId ?? ''
    systemLabel.value = schemaData.systemLabel ?? ''
    lastUpdatedStamp.value = schemaData.lastUpdatedStamp ?? ''
    schemaText.value = schemaData.schemaText ?? ''

    await loadFlattenedRows(signal)
    initialLoadSucceeded.value = true
  } catch (loadError) {
    if (isAbortError(loadError)) return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'The schema tripped over its own fields.'
  } finally {
    initialLoadCompleted.value = true
    loading.value = false
  }
}

async function loadSystemOptions(signal?: AbortSignal): Promise<void> {
  try {
    const response = await settingsFacade.listEnumOptions('DarpanSystemSource', signal)
    const resolvedOptions = (response.options ?? []).map(toEnumSelectOption)
    if (systemEnumId.value && !resolvedOptions.some((option) => option.value === systemEnumId.value)) {
      resolvedOptions.unshift({
        value: systemEnumId.value,
        label: systemLabel.value || systemEnumId.value,
      })
    }
    systemOptions.value = resolvedOptions
  } catch (loadError) {
    if (isAbortError(loadError)) return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'The reconciliation systems are not reconciling with us.'
  }
}

async function saveRefinedFields(): Promise<void> {
  if (!canEditTarget.value) return

  savingRefined.value = true
  error.value = null

  try {
    await jsonSchemaFacade.saveRefined({
      jsonSchemaId: currentSchemaId.value,
      schemaName: schemaName.value,
      description: description.value,
      systemEnumId: systemEnumId.value,
      fieldList: fieldRows.value.map((row) => ({
        fieldPath: row.fieldPath.trim(),
        type: row.type,
        required: row.required,
      })),
    })
    // The library is where a saved schema shows, so the save leaves this page at once.
    await router.push({ name: 'schemas-library' })
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'The refined fields need more refining. Not saved.'
  } finally {
    savingRefined.value = false
  }
}

async function deleteSchema(): Promise<void> {
  if (!canEditTarget.value || deletingSchema.value) return

  const confirmed = window.confirm(`Delete schema "${getSchemaDeleteLabel()}"?`)
  if (!confirmed) return

  deletingSchema.value = true
  error.value = null

  try {
    await jsonSchemaFacade.delete({ jsonSchemaId: currentSchemaId.value })
    await router.push({ name: 'schemas-library' })
  } catch (deleteError) {
    error.value = deleteError instanceof ApiCallError ? deleteError.message : 'The schema is clinging on. Still here.'
  } finally {
    deletingSchema.value = false
  }
}

async function initializeEditor(): Promise<void> {
  resetEditorState(resolveTargetSchemaId())
  initializeController?.abort()
  initializeController = new AbortController()
  const signal = initializeController.signal
  await loadSchema(signal)
  await loadSystemOptions(signal)
}

watch(() => [props.jsonSchemaId, route.fullPath], () => {
  void initializeEditor()
}, { immediate: true })
</script>

<style scoped>
.schema-editor-footer-row {
  justify-content: center;
}

.schema-editor-row-delete-action {
  width: 2.2rem;
  min-height: 2.2rem;
}

.schema-editor-summary-card--system {
  align-content: start;
}

.schema-editor-summary-select {
  margin-top: 0.1rem;
}
</style>
