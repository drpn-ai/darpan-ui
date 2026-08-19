<template>
  <WorkflowPage :progress-percent="progressPercent" aria-label="Schema setup progress" center-stage>
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />

    <WorkflowStepForm
      :question="currentQuestion"
      :primary-label="currentStep.id === 'name' ? 'Save' : 'OK'"
      :primary-action-variant="currentStep.id === 'name' ? 'save' : 'default'"
      :submit-disabled="submitDisabled"
      :show-back="currentStepIndex > 0"
      :show-primary-action="canEditTenantSettings && currentStep.id !== 'upload-intent'"
      :show-enter-hint="currentStep.id !== 'upload-intent'"
      :allow-file-enter="currentStep.id === 'upload'"
      :primary-test-id="currentStep.id === 'name' ? 'save-schema' : 'wizard-next'"
      @submit="handlePrimarySubmit"
      @back="goBack"
    >
      <template v-if="currentStep.id === 'upload-intent'">
        <WorkflowShortcutChoiceCards
          :options="uploadIntentOptions"
          :selected-value="selectedUploadIntent"
          test-id-prefix="upload-intent"
          @choose="handleUploadIntentChoice"
        />
      </template>

      <template v-else-if="currentStep.id === 'upload'">
        <label class="wizard-input-shell wizard-file-shell">
          <input
            class="wizard-file-input"
            type="file"
            :accept="uploadAccept"
            @change="onFileChange"
          />
          <span :class="['wizard-answer-control', 'wizard-file-answer', { empty: !selectedFileName }]">
            {{ selectedFileName || uploadPlaceholder }}
          </span>
        </label>
      </template>

      <template v-else-if="currentStep.id === 'verify'">
        <div class="wizard-input-shell">
          <EmptyState
            v-if="fieldRows.length === 0"
            title="No refined fields available"
            description="Upload a sample JSON file to preview the inferred field list."
          />

          <AppTableFrame v-else :columns="fieldColumns" :rows="fieldRowsAsRows">
            <template #cell-fieldPath="{ row, index }">
              <span
                class="schema-wizard-field-path"
                :title="String(row.fieldPath ?? '')"
                :data-testid="`schema-verify-field-path-${index}`"
              >
                {{ row.fieldPath }}
              </span>
            </template>
            <template #cell-required="{ row, index }">
              <div class="app-table__control-wrap app-table__control-wrap--start">
                <label class="checkbox-inline checkbox-inline--control-only">
                  <input
                    v-model="row.required"
                    class="app-table__checkbox"
                    type="checkbox"
                    aria-label="Required field"
                    :data-testid="`schema-verify-required-${index}`"
                  />
                </label>
              </div>
            </template>
          </AppTableFrame>
        </div>
      </template>

      <template v-else-if="currentStep.id === 'system'">
        <div class="workflow-form-grid">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">System</span>
            <AppSelect
              v-model="systemEnumId"
              :options="systemOptions"
              placeholder="Select system"
              test-id="schema-wizard-system"
              submit-on-enter
            />
          </label>
          <p
            v-if="showEmptySystemNotice"
            class="section-note"
            data-testid="schema-wizard-system-empty"
          >
            No systems are configured on this instance, so a schema cannot be assigned to one yet.
            Systems come from Darpan's reference data — load the component's seed data, then reopen
            this step.
          </p>
        </div>
      </template>

      <template v-else-if="currentStep.id === 'name'">
        <div class="workflow-form-grid">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Schema Name</span>
            <input
              name="schemaName"
              v-model="schemaName"
              :class="['wizard-answer-control', { empty: !schemaName.trim() }]"
              placeholder="Type your answer here..."
              @keydown.enter.stop="handleNameInputEnter"
            />
          </label>
        </div>
      </template>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards, {
  type WorkflowShortcutChoiceOption,
} from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import AppTableFrame from '../../components/ui/AppTableFrame.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import EmptyState from '../../components/ui/EmptyState.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import { ApiCallError } from '../../lib/api/client'
import { jsonSchemaFacade, settingsFacade } from '../../lib/api/facade'
import { invokePrimaryActionOnEnter } from '../../lib/keyboard'
import type { EnumOption, JsonSchemaField } from '../../lib/api/types'
import { isRecord } from '../../lib/utils/objects'
import { usePermissionsStore } from '../../stores/permissions'

type SchemaWorkflowStep = 'upload-intent' | 'upload' | 'verify' | 'system' | 'name'
type SchemaUploadIntent = 'schema' | 'sample'

interface WorkflowStep {
  id: SchemaWorkflowStep
  title: string
}

interface UploadIntentOption extends WorkflowShortcutChoiceOption {
  value: SchemaUploadIntent
}

const uploadIntentOptions: UploadIntentOption[] = [
  {
    value: 'schema',
    label: 'Schema file',
    shortcutKey: 'A',
  },
  {
    value: 'sample',
    label: 'Sample file',
    shortcutKey: 'B',
  },
]

const fieldColumns = [
  { key: 'fieldPath', label: 'Field Path', colStyle: { width: 'calc(100% - 15rem)' } },
  { key: 'type', label: 'Type', colStyle: { width: '8.5rem' } },
  { key: 'required', label: 'Required', colStyle: { width: '6.5rem' }, cellClass: 'app-table__control-cell' },
]

const router = useRouter()
const permissionsStore = usePermissionsStore()

const currentStepIndex = ref(0)
const selectedUploadIntent = ref<SchemaUploadIntent | ''>('')
const selectedFile = ref<File | null>(null)
const selectedFileName = ref('')
const schemaName = ref('')
const systemEnumId = ref('')
const schemaTextToSave = ref('')
const fieldRows = ref<JsonSchemaField[]>([])
const loading = ref(false)
const saving = ref(false)
const pageError = ref<string | null>(null)
const systemOptions = ref<AppSelectOption[]>([])
const systemOptionsLoaded = ref(false)
const canEditTenantSettings = computed(() => permissionsStore.canEditTenantSettings)
// An install whose DarpanSystemSource seed data never loaded reaches this step with an empty list, a
// permanently disabled OK and nothing on screen saying why. The list is reference data, not something
// the wizard can create, so say what is missing rather than offering an action that cannot work.
const showEmptySystemNotice = computed(() => systemOptionsLoaded.value && systemOptions.value.length === 0)

function buildWorkflowSteps(uploadIntent: SchemaUploadIntent | ''): WorkflowStep[] {
  const steps: WorkflowStep[] = [
    { id: 'upload-intent', title: 'Are you uploading a schema file or a sample file?' },
    {
      id: 'upload',
      title: uploadIntent === 'schema' ? 'Upload the schema file' : uploadIntent === 'sample' ? 'Upload the sample file' : 'Upload the file',
    },
  ]

  steps.push({ id: 'system', title: 'Assign the system' })

  if (uploadIntent !== 'schema') {
    steps.push({ id: 'verify', title: 'Review the interpreted schema' })
  }

  steps.push({ id: 'name', title: 'Name the schema' })
  return steps
}

function resolveUploadIntentByKey(key: string): SchemaUploadIntent | null {
  const normalizedKey = key.trim().toLowerCase()
  if (!normalizedKey) return null

  const matchedOption = uploadIntentOptions.find((option) => option.shortcutKey.toLowerCase() === normalizedKey)
  return matchedOption?.value ?? null
}

const workflowSteps = computed<WorkflowStep[]>(() => buildWorkflowSteps(selectedUploadIntent.value))
const currentStep = computed<WorkflowStep>(() => {
  const lastStepIndex = Math.max(0, workflowSteps.value.length - 1)
  return workflowSteps.value[Math.min(currentStepIndex.value, lastStepIndex)] ?? workflowSteps.value[0]!
})
const currentQuestion = computed(() => currentStep.value.title)
const progressPercent = computed(() => ((Math.max(1, currentStepIndex.value + 1) / workflowSteps.value.length) * 100).toFixed(2))
const fieldRowsAsRows = computed(() => fieldRows.value as Array<Record<string, unknown>>)
const uploadPlaceholder = computed(() => {
  if (selectedUploadIntent.value === 'schema') return 'Choose a schema file to upload...'
  if (selectedUploadIntent.value === 'sample') return 'Choose a sample file to upload...'
  return 'Choose a file to upload...'
})
const submitDisabled = computed(() => {
  if (!canEditTenantSettings.value) return true
  switch (currentStep.value.id) {
    case 'upload-intent':
      return !selectedUploadIntent.value
    case 'upload':
      return !selectedFile.value || loading.value
    case 'verify':
      return fieldRows.value.length === 0
    case 'system':
      return !systemEnumId.value || loading.value
    case 'name':
      return !schemaName.value.trim() || !schemaTextToSave.value.trim() || saving.value
    default:
      return true
  }
})
// Head slice sent to the backend for CSV samples. Mirrors CsvHeaderSchemaInferrer.HEADER_SLICE_LIMIT;
// the two must move together or a truncated header stops being detectable.
const CSV_HEADER_SLICE_LIMIT = 65536

// CSV belongs to the sample intent only -- there is no such thing as a CSV *schema* file.
const uploadAccept = computed(() =>
  selectedUploadIntent.value === 'sample'
    ? '.json,application/json,application/schema+json,.csv,text/csv'
    : '.json,application/json,application/schema+json',
)

function looksLikeCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsText(blob)
  })
}

function deriveSchemaName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  return baseName.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'schema'
}

function parseFieldPathTokens(fieldPath: string): string[] | null {
  let remaining = fieldPath.trim()
  if (!remaining) return null

  if (remaining === '$') return []
  if (remaining.startsWith('$.')) remaining = remaining.slice(2)
  else if (remaining.startsWith('$[')) remaining = remaining.slice(1)
  else if (remaining.startsWith('$')) remaining = remaining.slice(1)

  if (!remaining) return []
  if (remaining.startsWith('.') || remaining.endsWith('.') || remaining.includes('..')) return null

  const tokens: string[] = []
  while (remaining) {
    if (remaining.startsWith('[')) {
      const match = remaining.match(/^\[(\d+)\](.*)$/)
      if (!match) return null
      tokens.push(`[${match[1]}]`)
      remaining = match[2] ?? ''
    } else {
      const match = remaining.match(/^([^.[\]]+)(.*)$/)
      if (!match) return null
      tokens.push(match[1] ?? '')
      remaining = match[2] ?? ''
    }

    if (remaining.startsWith('.')) remaining = remaining.slice(1)
  }

  return tokens
}

function resolvePropertyContainer(node: Record<string, unknown>): Record<string, unknown> | null {
  if (isRecord(node.properties)) return node

  for (const key of ['anyOf', 'oneOf', 'allOf']) {
    const options = node[key]
    if (!Array.isArray(options)) continue

    const matchedOption = options.find((option) => isRecord(option) && isRecord(option.properties))
    if (isRecord(matchedOption)) return matchedOption
  }

  return null
}

function getChildSchemaNode(node: Record<string, unknown>, token: string): Record<string, unknown> | null {
  if (token.startsWith('[')) {
    if (isRecord(node.items)) return node.items
    if (Array.isArray(node.items)) {
      const matchedItem = node.items.find((item) => isRecord(item))
      return isRecord(matchedItem) ? matchedItem : null
    }
    return null
  }

  const propertyContainer = resolvePropertyContainer(node)
  if (!propertyContainer || !isRecord(propertyContainer.properties)) return null

  const childNode = propertyContainer.properties[token]
  return isRecord(childNode) ? childNode : null
}

function applyRequiredFlagsToSchemaText(rawSchemaText: string): string {
  const parsedSchema = JSON.parse(rawSchemaText) as unknown
  if (!isRecord(parsedSchema)) return rawSchemaText

  for (const row of fieldRows.value) {
    const tokens = parseFieldPathTokens(String(row.fieldPath ?? ''))
    if (!tokens || tokens.length === 0) continue

    let currentNode: Record<string, unknown> | null = parsedSchema

    for (let index = 0; index < tokens.length && currentNode; index += 1) {
      const token = tokens[index]!
      const isLastToken = index === tokens.length - 1

      if (token.startsWith('[')) {
        currentNode = getChildSchemaNode(currentNode, token)
        continue
      }

      const propertyContainer = resolvePropertyContainer(currentNode)
      if (!propertyContainer) break

      if (isLastToken) {
        const requiredList = Array.isArray(propertyContainer.required)
          ? propertyContainer.required.filter((item): item is string => typeof item === 'string')
          : []
        const nextRequired = new Set(requiredList)

        if (row.required) nextRequired.add(token)
        else nextRequired.delete(token)

        if (nextRequired.size > 0) propertyContainer.required = Array.from(nextRequired)
        else delete propertyContainer.required
        break
      }

      currentNode = getChildSchemaNode(currentNode, token)
    }
  }

  return JSON.stringify(parsedSchema)
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsText(file)
  })
}

function selectUploadIntent(uploadIntent: SchemaUploadIntent): void {
  const previousFileName = selectedFileName.value
  const shouldResetDerivedName = previousFileName
    && schemaName.value.trim()
    && schemaName.value.trim() === deriveSchemaName(previousFileName)

  selectedUploadIntent.value = uploadIntent
  selectedFile.value = null
  selectedFileName.value = ''
  schemaTextToSave.value = ''
  fieldRows.value = []
  pageError.value = null

  if (shouldResetDerivedName) {
    schemaName.value = ''
  }
}

function advanceFromUploadIntent(uploadIntent: SchemaUploadIntent): void {
  selectUploadIntent(uploadIntent)
  currentStepIndex.value = Math.min(currentStepIndex.value + 1, workflowSteps.value.length - 1)
}

function handleUploadIntentChoice(value: string): void {
  const matchedOption = uploadIntentOptions.find((option) => option.value === value)
  if (!matchedOption) return

  advanceFromUploadIntent(matchedOption.value)
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  selectedFile.value = file
  selectedFileName.value = file?.name ?? ''
  schemaTextToSave.value = ''
  fieldRows.value = []
  pageError.value = null

  if (file && !schemaName.value.trim()) {
    schemaName.value = deriveSchemaName(file.name)
  }
}

async function prepareSchemaFileUpload(): Promise<boolean> {
  if (!selectedFile.value) return false

  loading.value = true
  pageError.value = null

  try {
    const jsonText = await readFileAsText(selectedFile.value)
    JSON.parse(jsonText)
    schemaTextToSave.value = jsonText
    return true
  } catch (uploadError) {
    pageError.value = uploadError instanceof SyntaxError ? 'Schema file must contain valid JSON.' : 'Unable to read schema file.'
    return false
  } finally {
    loading.value = false
  }
}

async function inferSchemaFromSampleUpload(): Promise<boolean> {
  if (!selectedFile.value) return false

  loading.value = true
  pageError.value = null

  try {
    const file = selectedFile.value
    const response = looksLikeCsvFile(file)
      ? await jsonSchemaFacade.inferFromCsvText({
        // Only the header row is needed, and these files run to hundreds of megabytes.
        csvText: await readBlobAsText(file.slice(0, CSV_HEADER_SLICE_LIMIT)),
        isCompleteFile: file.size <= CSV_HEADER_SLICE_LIMIT,
      })
      : await jsonSchemaFacade.inferFromText({ jsonText: await readFileAsText(file) })

    schemaTextToSave.value = response.jsonSchemaString ?? ''
    fieldRows.value = response.fieldList ?? []

    if (response.ok === false) {
      // The backend's refusal is written for the person holding the file; show it verbatim.
      pageError.value = response.errors?.[0] ?? 'Unable to read the uploaded sample file.'
      return false
    }

    if (!schemaTextToSave.value.trim() || fieldRows.value.length === 0) {
      pageError.value = 'No refined fields were returned for the uploaded sample file.'
      return false
    }

    return true
  } catch (inferError) {
    pageError.value = inferError instanceof ApiCallError ? inferError.message : 'Unable to infer schema from the sample file.'
    return false
  } finally {
    loading.value = false
  }
}

async function saveSchema(): Promise<void> {
  if (!canEditTenantSettings.value) {
    pageError.value = 'You do not have permission to save schemas for the active tenant.'
    return
  }
  if (!schemaName.value.trim() || !systemEnumId.value || !schemaTextToSave.value.trim()) return

  saving.value = true
  pageError.value = null

  try {
    const schemaTextPayload = selectedUploadIntent.value === 'sample'
      ? applyRequiredFlagsToSchemaText(schemaTextToSave.value)
      : schemaTextToSave.value
    await jsonSchemaFacade.saveText({
      schemaName: schemaName.value.trim(),
      systemEnumId: systemEnumId.value,
      schemaText: schemaTextPayload,
      overwrite: false,
    })
    await router.push({ name: 'schemas-library' })
  } catch (saveError) {
    pageError.value = saveError instanceof ApiCallError ? saveError.message : 'Unable to save schema.'
  } finally {
    saving.value = false
  }
}

async function handlePrimarySubmit(): Promise<void> {
  if (currentStep.value.id === 'name') {
    await saveSchema()
    return
  }

  if (currentStep.value.id === 'upload') {
    if (selectedUploadIntent.value === 'schema') {
      const uploadPrepared = await prepareSchemaFileUpload()
      if (!uploadPrepared) return
    }
  }

  if (currentStep.value.id === 'system' && selectedUploadIntent.value === 'sample') {
    const uploadPrepared = await inferSchemaFromSampleUpload()
    if (!uploadPrepared) return
  }

  currentStepIndex.value = Math.min(currentStepIndex.value + 1, workflowSteps.value.length - 1)
}

function handleUploadIntentKeydown(event: KeyboardEvent): void {
  if (currentStep.value.id !== 'upload-intent') return
  if (event.defaultPrevented || event.repeat || event.isComposing) return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

  const matchedUploadIntent = resolveUploadIntentByKey(event.key)
  if (!matchedUploadIntent) return

  event.preventDefault()
  advanceFromUploadIntent(matchedUploadIntent)
}

function goBack(): void {
  pageError.value = null
  currentStepIndex.value = Math.max(currentStepIndex.value - 1, 0)
}

function handleNameInputEnter(event: KeyboardEvent): void {
  invokePrimaryActionOnEnter(event, handlePrimarySubmit, {
    disabled: submitDisabled.value,
  })
}

function toSystemOption(option: EnumOption): AppSelectOption {
  return {
    value: option.enumId,
    label: option.label || option.description || option.enumCode || option.enumId,
  }
}

const pageAbortController = new AbortController()

onBeforeUnmount(() => {
  pageAbortController.abort()
})

async function loadSystemOptions(): Promise<void> {
  try {
    const response = await settingsFacade.listEnumOptions('DarpanSystemSource', pageAbortController.signal)
    systemOptions.value = (response.options ?? []).map(toSystemOption)
    systemOptionsLoaded.value = true
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    pageError.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load reconciliation systems.'
  }
}

onMounted(() => {
  void loadSystemOptions()
  window.addEventListener('keydown', handleUploadIntentKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleUploadIntentKeydown)
})
</script>

<style scoped>
.schema-wizard-field-path {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
