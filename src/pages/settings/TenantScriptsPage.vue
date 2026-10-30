<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Scripts</h1>
    </template>

    <p class="section-note">JEXL kept as data: reads <code>input</code> and the d: functions, nothing else.</p>
    <LoadingState v-if="loading" noun="scripts" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />
    <p v-if="statusMessage" class="section-note" role="status" data-testid="scripts-status">{{ statusMessage }}</p>

    <StaticPageSection title="Saved">
      <div class="static-page-tile-grid static-page-record-grid tenant-settings-list-grid">
        <button
          v-if="canEdit"
          type="button"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="script-new"
          @click="startNew"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">New script</span>
            </span>
            <span class="tenant-settings-list-status">Write</span>
          </span>
        </button>
        <button
          v-for="script in scripts"
          :key="script.tenantScriptId"
          type="button"
          class="static-page-tile static-page-record-tile static-page-list-tile"
          data-testid="script-tile"
          @click="openScript(script)"
        >
          <span class="tenant-settings-list-row">
            <span class="tenant-settings-list-main">
              <span class="static-page-tile-title static-page-list-tile__title">{{ script.scriptName }}</span>
              <span class="static-page-list-tile__meta">{{ profileLabel(script.scriptProfile) }} · {{ sourceLabel(script.inputSource) }}</span>
            </span>
            <span class="tenant-settings-list-status">{{ script.isActive ? 'On' : 'Off' }}</span>
          </span>
        </button>
      </div>
      <p v-if="!loading && !pageError && scripts.length === 0" class="section-note">No scripts yet.</p>
    </StaticPageSection>

    <StaticPageSection v-if="draft" :title="draft.tenantScriptId ? draft.scriptName || 'Script' : 'New script'">
      <div class="tenant-script-editor" data-testid="script-editor">
        <div class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Name</span>
            <input v-model="draft.scriptName" class="wizard-answer-control" type="text" data-testid="script-name" :disabled="!canEdit || busy" />
          </label>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Profile</span>
            <AppSelect v-model="draft.scriptProfile" :options="profileOptions" test-id="script-profile" :disabled="!canEdit || busy" />
          </label>
        </div>

        <label class="wizard-input-shell">
          <span class="workflow-context-label">Script</span>
          <textarea
            v-model="draft.scriptBody"
            class="wizard-answer-control workflow-form-textarea tenant-script-code"
            rows="14"
            spellcheck="false"
            autocomplete="off"
            data-testid="script-body"
            :disabled="!canEdit || busy"
            @keydown.enter.meta.prevent="runDraft"
            @keydown.enter.ctrl.prevent="runDraft"
          />
        </label>
        <p class="section-note">{{ limitLine }}</p>

        <div class="workflow-form-grid workflow-form-grid--two">
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Input</span>
            <AppSelect v-model="draft.inputSource" :options="sourceOptions" test-id="script-input-source" :disabled="!canEdit || busy" />
          </label>
          <label v-if="draft.inputSource === 'RUN_RESULT'" class="wizard-input-shell">
            <span class="workflow-context-label">Run result</span>
            <AppSelect
              v-model="runFileName"
              :options="runResultOptions"
              placeholder="Select run result"
              test-id="script-run-result"
              searchable
              search-placeholder="Search run results"
              :disabled="!canEdit || busy"
            />
          </label>
        </div>
        <label v-if="draft.inputSource === 'SAMPLE'" class="wizard-input-shell">
          <span class="workflow-context-label">Sample input (JSON)</span>
          <textarea
            v-model="draft.sampleInputJson"
            class="wizard-answer-control workflow-form-textarea tenant-script-code"
            rows="6"
            spellcheck="false"
            data-testid="script-sample"
            :disabled="!canEdit || busy"
          />
        </label>

        <InlineValidation v-if="editorError" tone="error" :message="editorError" />

        <div class="wizard-actions">
          <button type="button" class="wizard-next" data-testid="script-run" :disabled="!canEdit || busy || !draft.scriptBody.trim()" @click="runDraft">
            {{ running ? 'Running…' : 'Run' }}
          </button>
          <AppSaveAction v-if="canEdit" label="Save script" test-id="script-save" :disabled="busy || !draft.scriptName.trim()" @click="saveDraft" />
          <button
            v-if="canEdit && draft.tenantScriptId"
            type="button"
            class="wizard-back"
            data-testid="script-delete"
            :disabled="busy"
            @click="deleteDraft"
          >
            {{ confirmDelete ? 'Confirm delete' : 'Delete' }}
          </button>
          <AppCancelAction label="Close" test-id="script-close" :disabled="busy" @click="closeEditor" />
        </div>

        <div v-if="runOut" class="tenant-script-result" data-testid="script-result">
          <span class="workflow-context-label">Result</span>
          <p class="section-note" data-testid="script-result-status">{{ runStatus }}</p>
          <InlineValidation v-if="runOut.run.error" tone="error" :message="errorLine(runOut.run.error)" />
          <pre v-else class="tenant-script-output" data-testid="script-output">{{ resultText }}</pre>
          <template v-if="runOut.run.logs.length">
            <span class="workflow-context-label">Log</span>
            <ul class="workflow-list" data-testid="script-logs">
              <li v-for="(line, index) in runOut.run.logs" :key="index">{{ line }}</li>
            </ul>
          </template>
        </div>
      </div>
    </StaticPageSection>

    <StaticPageSection v-if="savedScript" title="Deploy">
      <ScriptDeploymentPanel
        :script="savedScript"
        :chat-spaces="chatSpaces"
        :saved-run-options="savedRunOptions"
        :can-edit="canEdit"
      />
    </StaticPageSection>

    <StaticPageSection v-if="library.length" title="d: functions">
      <dl class="tenant-script-library" data-testid="script-library">
        <template v-for="fn in library" :key="fn.name">
          <dt><code>d:{{ fn.name }}</code></dt>
          <dd>{{ fn.help }}</dd>
        </template>
      </dl>
    </StaticPageSection>
  </StaticPageFrame>
</template>

<script setup lang="ts">
// DAR-BE-164. The active tenant's JEXL scripts: write one, run it against sample JSON or a finished run's differences,
// save it. Nothing here is a code change; the backend validates every save and runs every script in its sandbox.
import { computed, onMounted, ref, watch } from 'vue'
import AppCancelAction from '../../components/ui/AppCancelAction.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import ScriptDeploymentPanel from '../../components/settings/ScriptDeploymentPanel.vue'
import { reconciliationFacade, scriptFacade, settingsFacade } from '../../lib/api/facade'
import type {
  RunTenantScriptResponse,
  ScriptError,
  ScriptInputSource,
  ScriptLibraryFunction,
  ScriptProfile,
  ScriptProfileLimits,
  TenantScript,
} from '../../lib/api/scriptTypes'
import type { GeneratedOutput, TenantChatSpace } from '../../lib/api/types'
import { usePermissionsStore } from '../../stores/permissions'

interface Draft {
  tenantScriptId: string
  scriptName: string
  scriptProfile: ScriptProfile
  inputSource: ScriptInputSource
  scriptBody: string
  sampleInputJson: string
}

const STARTER_BODY = `// input is the sample below. Sum each order's payments by tender.
var byTender = {:};
for (var p : input.payments) {
  byTender[p.tender] = d:dec(byTender[p.tender] ?? 0) + d:dec(p.amount);
}
{ 'orderId': input.orderId, 'paid': d:sum(input.payments, 'amount'), 'byTender': byTender }`
const STARTER_SAMPLE = `{
  "orderId": "1001",
  "payments": [
    { "tender": "CARD", "amount": "40.00" },
    { "tender": "GIFT_CARD", "amount": "10.00" }
  ]
}`
const RUN_RESULT_STARTER = `// input.differences holds up to 2,000 of the run's differences.
{ 'total': input.totalDifferences, 'read': d:len(input.differences) }`

const profileOptions = [
  { value: 'SCRIPT', label: 'Script (loops, variables)' },
  { value: 'EXPRESSION', label: 'Expression (one line)' },
]
const sourceOptions = [
  { value: 'SAMPLE', label: 'Sample JSON' },
  { value: 'RUN_RESULT', label: 'A run result' },
]

const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const scripts = ref<TenantScript[]>([])
const library = ref<ScriptLibraryFunction[]>([])
const limits = ref<Partial<Record<ScriptProfile, ScriptProfileLimits>>>({})
const runResults = ref<GeneratedOutput[]>([])
const chatSpaces = ref<TenantChatSpace[]>([])
const loading = ref(false)
const pageError = ref('')
const statusMessage = ref('')

const draft = ref<Draft | null>(null)
const runFileName = ref('')
const editorError = ref('')
const running = ref(false)
const saving = ref(false)
const confirmDelete = ref(false)
const runOut = ref<RunTenantScriptResponse | null>(null)

const busy = computed(() => running.value || saving.value)
const runResultOptions = computed(() =>
  runResults.value.map((out) => ({
    value: out.fileName,
    label: [out.savedRunName || out.fileName, out.totalDifferences != null ? `${out.totalDifferences} differences` : '']
      .filter(Boolean).join(' · '),
  })))
const limitLine = computed(() => {
  const profile = draft.value?.scriptProfile ?? 'SCRIPT'
  const limit = limits.value[profile]
  return limit ? `Up to ${limit.unitLimit.toLocaleString()} units and ${limit.timeoutMs.toLocaleString()} ms per run.` : ''
})
const resultText = computed(() => JSON.stringify(runOut.value?.run.result ?? null, null, 2))
const runStatus = computed(() => {
  const out = runOut.value
  if (!out) return ''
  const summary = out.inputSummary
  const read = summary?.source === 'RUN_RESULT'
    ? ` · read ${summary.records ?? 0} of ${summary.totalDifferences ?? 0} differences`
    : ''
  return `${out.run.ok ? 'Ran' : 'Stopped'} in ${out.run.elapsedMs} ms · ${out.run.units.toLocaleString()} units${read}`
})

function profileLabel(profile: ScriptProfile): string {
  return profile === 'EXPRESSION' ? 'Expression' : 'Script'
}

function sourceLabel(source: ScriptInputSource): string {
  return source === 'RUN_RESULT' ? 'Run result' : 'Sample'
}

function errorLine(error: ScriptError): string {
  return `${error.line ? `Line ${error.line}: ` : ''}${error.message}`
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function resetEditorState(): void {
  editorError.value = ''
  runOut.value = null
  confirmDelete.value = false
  statusMessage.value = ''
}

function startNew(): void {
  resetEditorState()
  runFileName.value = ''
  draft.value = { tenantScriptId: '', scriptName: '', scriptProfile: 'SCRIPT', inputSource: 'SAMPLE',
    scriptBody: STARTER_BODY, sampleInputJson: STARTER_SAMPLE }
}

function openScript(script: TenantScript): void {
  resetEditorState()
  runFileName.value = ''
  draft.value = {
    tenantScriptId: script.tenantScriptId,
    scriptName: script.scriptName,
    scriptProfile: script.scriptProfile,
    inputSource: script.inputSource,
    scriptBody: script.scriptBody,
    sampleInputJson: script.sampleInputJson ?? '',
  }
}

function closeEditor(): void {
  if (busy.value) return
  draft.value = null
  resetEditorState()
}

async function loadScripts(): Promise<void> {
  loading.value = true
  pageError.value = ''
  try {
    const out = await scriptFacade.listTenantScripts()
    scripts.value = out.scripts ?? []
    library.value = out.library ?? []
    limits.value = out.limits ?? {}
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the scripts.')
  } finally {
    loading.value = false
  }
}

// DAR-BE-167. The Deploy section works on the SAVED script (its saved input source), never an unsaved edit.
const savedScript = computed(() =>
  draft.value?.tenantScriptId ? scripts.value.find((script) => script.tenantScriptId === draft.value?.tenantScriptId) ?? null : null)
// Saved runs that have produced a result, for "reads the newest result of".
const savedRunOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const out of runResults.value) {
    if (out.savedRunId && !seen.has(out.savedRunId)) seen.set(out.savedRunId, out.savedRunName || out.savedRunId)
  }
  return [...seen].map(([value, label]) => ({ value, label }))
})

async function loadChatSpaces(): Promise<void> {
  try {
    chatSpaces.value = (await settingsFacade.listTenantChatSpaces()).chatSpaces ?? []
  } catch {
    // Without chat spaces the Deploy section simply has nothing to post to.
    chatSpaces.value = []
  }
}

async function loadRunResults(): Promise<void> {
  try {
    const out = await reconciliationFacade.listGeneratedOutputs({ pageIndex: 0, pageSize: 200 })
    runResults.value = (out.generatedOutputs ?? []).filter((item) => item.fileName && item.resultAvailable !== false)
  } catch {
    // The run-result picker is optional; sample input still works.
    runResults.value = []
  }
}

async function runDraft(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value || !current.scriptBody.trim()) return
  if (current.inputSource === 'RUN_RESULT' && !runFileName.value) {
    editorError.value = 'Choose a run result for the script to read.'
    return
  }
  running.value = true
  editorError.value = ''
  try {
    runOut.value = await scriptFacade.runTenantScript({
      tenantScriptId: current.tenantScriptId || undefined,
      scriptBody: current.scriptBody,
      scriptProfile: current.scriptProfile,
      inputSource: current.inputSource,
      inputJson: current.inputSource === 'SAMPLE' ? current.sampleInputJson : undefined,
      fileName: current.inputSource === 'RUN_RESULT' ? runFileName.value : undefined,
    })
  } catch (error) {
    runOut.value = null
    editorError.value = messageOf(error, 'Could not run the script.')
  } finally {
    running.value = false
  }
}

async function saveDraft(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value) return
  saving.value = true
  editorError.value = ''
  try {
    const out = await scriptFacade.saveTenantScript({
      tenantScriptId: current.tenantScriptId || undefined,
      scriptName: current.scriptName.trim(),
      scriptProfile: current.scriptProfile,
      inputSource: current.inputSource,
      scriptBody: current.scriptBody,
      sampleInputJson: current.sampleInputJson,
    })
    current.tenantScriptId = out.script.tenantScriptId
    statusMessage.value = `Saved ${out.script.scriptName}.`
    await loadScripts()
  } catch (error) {
    editorError.value = messageOf(error, 'Could not save the script.')
  } finally {
    saving.value = false
  }
}

async function deleteDraft(): Promise<void> {
  const current = draft.value
  if (!current?.tenantScriptId || busy.value) return
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  saving.value = true
  try {
    await scriptFacade.deleteTenantScript({ tenantScriptId: current.tenantScriptId })
    const name = current.scriptName
    saving.value = false
    closeEditor()
    statusMessage.value = `Deleted ${name}.`
    await loadScripts()
  } catch (error) {
    editorError.value = messageOf(error, 'Could not delete the script.')
  } finally {
    saving.value = false
    confirmDelete.value = false
  }
}

// An untouched starter follows the input choice, so a new run-result script starts from one that reads differences.
watch(() => draft.value?.inputSource, (source) => {
  if (!draft.value) return
  if (source === 'RUN_RESULT' && draft.value.scriptBody === STARTER_BODY) draft.value.scriptBody = RUN_RESULT_STARTER
  if (source === 'SAMPLE' && draft.value.scriptBody === RUN_RESULT_STARTER) draft.value.scriptBody = STARTER_BODY
})

onMounted(() => {
  void loadScripts()
  void loadRunResults()
  void loadChatSpaces()
})
</script>

<style scoped>
.tenant-script-editor,
.tenant-script-result {
  display: grid;
  gap: var(--space-3);
}

.tenant-script-code {
  white-space: pre;
  tab-size: 2;
  overflow-x: auto;
}

.tenant-script-output {
  margin: 0;
  padding: var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow-x: auto;
  white-space: pre;
}

.tenant-script-library {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-1) var(--space-3);
  margin: 0;
}

.tenant-script-library dd {
  margin: 0;
}
</style>
