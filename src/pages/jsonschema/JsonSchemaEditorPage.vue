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
      <p v-if="loading && !initialLoadCompleted" class="section-note" data-testid="schema-editor-loading">Loading schema...</p>

      <template v-else-if="showInitialLoadFailureState">
        <InlineValidation v-if="error" tone="error" :message="error" />
        <EmptyState
          title="Unable to load this schema"
          description="Retry loading before refining any fields."
        />

        <div class="action-row">
          <button type="button" @click="reload" :disabled="loading">Retry Loading Schema</button>
        </div>
      </template>

      <template v-else-if="!hasTarget">
        <EmptyState
          title="No schema selected"
          description="Open a schema from the library to review and refine its fields."
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
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path
                  d="M10 2.5a.75.75 0 0 1 .75.75v7.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V3.25A.75.75 0 0 1 10 2.5Zm-5 11a.75.75 0 0 1 .75.75v1.5c0 .14.11.25.25.25h8c.14 0 .25-.11.25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 14 17.5H6A1.75 1.75 0 0 1 4.25 15.75v-1.5A.75.75 0 0 1 5 13.5Z"
                  fill="currentColor"
                />
              </svg>
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
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="trashIconPath" fill="currentColor" />
                </svg>
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
                    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                      <path
                        d="M10 4.25a.75.75 0 0 1 .75.75v4.25H15a.75.75 0 0 1 0 1.5h-4.25V15a.75.75 0 0 1-1.5 0v-4.25H5a.75.75 0 0 1 0-1.5h4.25V5a.75.75 0 0 1 .75-.75Z"
                        fill="currentColor"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </AppTableFrame>
      </form>
    </StaticPageSection>

    <InlineValidation v-if="error && !showInitialLoadFailureState" tone="error" :message="error" />
    <p v-if="success" class="success-copy">{{ success }}</p>

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
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="footerTrashIconTransform" fill="currentColor" />
          </svg>
        </button>
      </div>
    </template>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, settingsFacade } from '../../lib/api/facade'
import type { EnumOption, JsonSchemaField } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'
import { trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import { formatDateTime } from '../../lib/utils/date'
import { downloadTextFile } from '../../lib/utils/download'

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
const footerTrashIconTransform = trashIconTransform

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
const success = ref<string | null>(null)
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
  success.value = null
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

function toSystemOption(option: EnumOption): AppSelectOption {
  return {
    value: option.enumId,
    label: option.label || option.description || option.enumCode || option.enumId,
  }
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
      error.value = 'Schema not found.'
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
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load schema.'
  } finally {
    initialLoadCompleted.value = true
    loading.value = false
  }
}

async function reload(): Promise<void> {
  initialLoadCompleted.value = false
  initialLoadSucceeded.value = false
  initializeController?.abort()
  initializeController = new AbortController()
  const signal = initializeController.signal
  await loadSchema(signal)
  await loadSystemOptions(signal)
}

async function loadSystemOptions(signal?: AbortSignal): Promise<void> {
  try {
    const response = await settingsFacade.listEnumOptions('DarpanSystemSource', signal)
    const resolvedOptions = (response.options ?? []).map(toSystemOption)
    if (systemEnumId.value && !resolvedOptions.some((option) => option.value === systemEnumId.value)) {
      resolvedOptions.unshift({
        value: systemEnumId.value,
        label: systemLabel.value || systemEnumId.value,
      })
    }
    systemOptions.value = resolvedOptions
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    error.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load reconciliation systems.'
  }
}

async function saveRefinedFields(): Promise<void> {
  if (!canEditTarget.value) return

  savingRefined.value = true
  error.value = null
  success.value = null

  try {
    const response = await jsonSchemaFacade.saveRefined({
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
    success.value = response.messages?.[0] ?? `Saved refined schema ${schemaName.value}.`
    await router.push({ name: 'schemas-library' })
  } catch (saveError) {
    error.value = saveError instanceof ApiCallError ? saveError.message : 'Unable to save refined fields.'
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
  success.value = null

  try {
    await jsonSchemaFacade.delete({ jsonSchemaId: currentSchemaId.value })
    await router.push({ name: 'schemas-library' })
  } catch (deleteError) {
    error.value = deleteError instanceof ApiCallError ? deleteError.message : 'Unable to delete schema.'
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
