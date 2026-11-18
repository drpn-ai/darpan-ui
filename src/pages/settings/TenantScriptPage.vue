<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': activePopup !== null }">
    <template #hero>
      <StaticRecordTitle
        v-if="draft"
        :model-value="draft.scriptName"
        :editable="canEdit"
        aria-label="Script name"
        test-id="script-name"
        explain="scriptName"
        toggle-label="On schedule"
        :on="schedule?.isActive ?? false"
        toggle-test-id="script-on-schedule"
        :toggle-disabled="!schedule || !canEdit || busy"
        @update:model-value="renameDraft"
        @update:on="setOnSchedule"
      >
        <span v-if="dirty" class="script-edited-mark" data-testid="script-edited">• edited</span>
      </StaticRecordTitle>
      <h1 v-else>Script</h1>
    </template>

    <LoadingState v-if="loading" noun="script" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="script-page-error" />

    <template v-if="draft">
      <StaticFactStrip :facts="facts" test-id="script-facts" @open="openFact" />

      <div class="script-bench">
        <section class="script-column">
          <div class="script-column__head">
            <h2 v-explain="'scriptBody'" class="static-page-section-heading">Code</h2>
            <span class="script-column__hint">⌘↵ runs</span>
          </div>
          <div class="script-code" :class="{ 'script-code--disabled': !canEdit }">
            <ol class="script-code__gutter" aria-hidden="true">
              <li
                v-for="line in lineCount"
                :key="line"
                :class="{ 'script-code__line--error': line === errorLine }"
                data-testid="script-gutter-line"
              >
                {{ line }}
              </li>
            </ol>
            <textarea
              v-model="draft.scriptBody"
              class="script-code__text"
              :rows="lineCount"
              spellcheck="false"
              autocomplete="off"
              aria-label="Script"
              data-testid="script-body"
              :disabled="!canEdit || saving"
              @keydown.enter.meta.prevent="runDraft"
              @keydown.enter.ctrl.prevent="runDraft"
            />
          </div>
          <p class="section-note">
            Functions you can call:
            <a
              class="script-docs-link"
              :href="FUNCTIONS_DOCS_URL"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="script-functions-link"
            >d: functions <span aria-hidden="true">↗</span></a>
          </p>
        </section>

        <section class="script-column">
          <div class="script-column__head">
            <h2 v-explain="'scriptRuns'" class="static-page-section-heading">Runs</h2>
            <span class="script-column__actions">
              <button
                v-if="deployment && canEdit"
                type="button"
                class="user-settings-control"
                data-testid="script-preview"
                :disabled="busy"
                @click="openPreview"
              >
                Preview message
              </button>
              <button
                type="button"
                class="app-icon-action app-icon-action--large"
                aria-label="Run"
                title="Run (⌘↵)"
                data-testid="script-run"
                :aria-busy="running ? 'true' : undefined"
                :disabled="!canEdit || busy || !draft.scriptBody.trim()"
                @click="runDraft"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path :d="playIconPath" :transform="playIconTransform" fill="currentColor" />
                </svg>
              </button>
            </span>
          </div>

          <InlineValidation v-if="runError" tone="error" :message="runError" data-testid="script-run-error-message" />

          <ol class="script-runs">
            <li
              v-for="(cell, index) in runs"
              :key="cell.n"
              class="script-run"
              :class="{ 'script-run--failed': Boolean(cell.run.error), 'script-run--latest': index === 0 }"
              data-testid="script-run-cell"
            >
              <span class="script-run__head">
                <span>Run {{ cell.n }}<template v-if="index === 0"> · latest</template></span>
                <span>{{ cell.time }}</span>
              </span>
              <pre v-if="cell.run.error" class="script-run__out" data-testid="script-run-error">{{ errorText(cell.run.error) }}</pre>
              <pre v-else class="script-run__out" data-testid="script-run-result">{{ resultText(cell.run.result) }}</pre>
              <ul v-if="cell.run.logs.length" class="script-run__logs" data-testid="script-run-logs">
                <li v-for="(line, lineIndex) in cell.run.logs" :key="lineIndex">{{ line }}</li>
              </ul>
              <span class="script-run__meta" data-testid="script-run-meta">{{ cell.meta }}</span>
            </li>
            <li
              v-if="deployment?.lastRunDate"
              class="script-run script-run--scheduled"
              :class="{ 'script-run--failed': lastRunFailed }"
              data-testid="script-scheduled-cell"
            >
              <span class="script-run__head">
                <span>Scheduled run</span>
                <span>{{ formatDateTime(deployment.lastRunDate, { timeZone }) }}</span>
              </span>
              <pre class="script-run__out">{{ deployment.lastRunMessage || statusWords(deployment.lastRunStatus) }}</pre>
            </li>
            <li v-if="!runs.length && !deployment?.lastRunDate" class="script-run script-run--empty">No runs yet.</li>
          </ol>
        </section>
      </div>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant-scripts' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to scripts"
          title="Back to scripts"
          data-testid="script-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
        <AppSaveAction
          v-if="canEdit && draft"
          label="Save script"
          test-id="script-save"
          :disabled="busy || !draft.scriptName.trim()"
          @click="save"
        />
        <button
          v-if="canEdit && draft?.tenantScriptId"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger"
          aria-label="Delete script"
          data-testid="script-delete"
          :disabled="busy"
          @click="openPopup('delete')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
          </svg>
        </button>
      </div>
    </template>
  </StaticPageFrame>

  <div
    v-if="activePopup && draft"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="script-popup-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="script-popup-title">{{ popupTitle }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          v-if="activePopup === 'reads'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="What should it read?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="script-reads-save"
          :submit-disabled="!readsForm.choice"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="script-reads-cancel"
          @cancel="closePopup"
          @submit="saveReads"
        >
          <label class="wizard-input-shell">
            <span v-explain="'scriptInputRun'" class="workflow-context-label">Reads</span>
            <AppSelect
              v-model="readsForm.choice"
              :options="readsOptions"
              placeholder="Select saved run"
              test-id="script-reads-select"
              searchable
              search-placeholder="Search saved runs"
            />
          </label>
          <label v-if="readsForm.choice === SAMPLE_CHOICE" class="wizard-input-shell">
            <span v-explain="'scriptSample'" class="workflow-context-label">Sample JSON</span>
            <textarea
              v-model="readsForm.sample"
              class="wizard-answer-control workflow-form-textarea script-sample"
              rows="8"
              spellcheck="false"
              data-testid="script-sample"
            />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'schedule'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          :question="schedule ? 'Change the schedule.' : 'Set up the schedule.'"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="script-schedule-save"
          :submit-disabled="!scheduleForm.chatSpaceId || (!scheduleForm.time && !schedule)"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="script-schedule-cancel"
          @cancel="closePopup"
          @submit="saveSchedule"
        >
          <div class="script-popup-pair">
            <label class="wizard-input-shell">
              <span v-explain="'scriptSchedule'" class="workflow-context-label">Daily at · {{ timeZone || 'tenant zone' }}</span>
              <WorkflowTimeSelect v-model="scheduleForm.time" test-id="script-schedule-time" aria-label="Daily at" />
            </label>
            <label class="wizard-input-shell">
              <span v-explain="'scriptPostTo'" class="workflow-context-label">Posts to</span>
              <AppSelect
                v-model="scheduleForm.chatSpaceId"
                :options="chatSpaceOptions"
                placeholder="Select chat space"
                test-id="script-schedule-space"
              />
            </label>
          </div>
          <div class="script-popup-toggle">
            <AppToggleSwitch v-model="scheduleForm.isActive" label="On schedule" test-id="script-schedule-active" />
            <span>On schedule</span>
          </div>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'preview'"
          class="workflow-form--popup-compact"
          question="What it would post."
          primary-label="Send now"
          primary-test-id="script-send-now"
          :submit-disabled="popupBusy || !preview"
          :show-enter-hint="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="script-preview-close"
          @cancel="closePopup"
          @submit="sendNow"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <LoadingState v-if="popupBusy && !preview" noun="message" />
          <template v-if="preview">
            <p class="section-note" data-testid="script-preview-message">{{ preview.message }}</p>
            <pre v-if="preview.text" class="script-preview-text" data-testid="script-preview-text">{{ preview.text }}</pre>
          </template>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'delete'"
          class="workflow-form--popup-compact"
          :question="`Delete ${draft.scriptName}?`"
          :show-primary-action="false"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <p class="section-note">Its schedule stops and it leaves the Notifications grid.</p>
          <div class="wizard-actions">
            <button
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger"
              aria-label="Confirm delete"
              data-testid="script-delete-confirm"
              :disabled="popupBusy"
              @click="deleteScript"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path :d="trashIconPath" :transform="trashIconTransform" fill="currentColor" />
              </svg>
            </button>
            <AppCancelAction test-id="script-delete-cancel" :disabled="popupBusy" @click="closePopup" />
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// DAR-UI-124. One tenant script on a page of its own: its name, what it reads, when it posts and where, its code, and
// this visit's runs. Run reads exactly what the schedule reads. One Save keeps the script and its schedule together;
// the popups and the toggle only change this page until then. The backend validates every save and runs every script
// in its sandbox (DAR-BE-164, DAR-BE-167).
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AppCancelAction from '../../components/ui/AppCancelAction.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowTimeSelect from '../../components/workflow/WorkflowTimeSelect.vue'
import { reconciliationFacade, scriptFacade, settingsFacade } from '../../lib/api/facade'
import type {
  ScriptDeploymentOutcome,
  ScriptError,
  ScriptInputSource,
  ScriptProfile,
  ScriptRun,
  TenantScript,
  TenantScriptDeployment,
} from '../../lib/api/scriptTypes'
import type { GeneratedOutput, TenantChatSpace } from '../../lib/api/types'
import { backIconPath, playIconPath, playIconTransform, trashIconPath, trashIconTransform } from '../../lib/iconPaths'
import {
  cronFromTime,
  isFailedStatus,
  newestResultFileName,
  scheduleWords,
  statusWords,
  timeFromCron,
} from '../../lib/scriptDeployment'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { formatDateTime } from '../../lib/utils/date'
import { usePermissionsStore } from '../../stores/permissions'

interface Draft {
  tenantScriptId: string
  scriptName: string
  scriptProfile: ScriptProfile
  inputSource: ScriptInputSource
  scriptBody: string
  sampleInputJson: string
}

/** The deployment as this page holds it until Save. */
interface Schedule {
  scheduleExpr: string
  chatSpaceId: string
  isActive: boolean
}

interface RunCell {
  n: number
  time: string
  body: string
  run: ScriptRun
  meta: string
}

type Popup = 'reads' | 'schedule' | 'preview' | 'delete'

const FUNCTIONS_DOCS_URL = 'https://developers.drpn.ai/tenant-scripts/functions'
const SAMPLE_CHOICE = '__sample__'
const MAX_RUNS = 3

const STARTER_BODY = `// input is the sample. Sum each order's payments by tender.
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
{ 'total': input.totalDifferences, 'read': size(input.differences) }`

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)

const routeScriptId = computed(() => String(route.params.tenantScriptId ?? ''))

const saved = ref<TenantScript | null>(null)
const deployment = ref<TenantScriptDeployment | null>(null)
const timeZone = ref('')
const chatSpaces = ref<TenantChatSpace[]>([])
const runResults = ref<GeneratedOutput[]>([])
const loading = ref(false)
const pageError = ref('')

const draft = ref<Draft | null>(null)
const readsSavedRunId = ref('')
const schedule = ref<Schedule | null>(null)
const baseline = ref('')

const saving = ref(false)
const running = ref(false)
const runError = ref('')
const runs = ref<RunCell[]>([])
let runCount = 0

const activePopup = ref<Popup | null>(null)
const popupBusy = ref(false)
const popupError = ref('')
const readsForm = ref({ choice: '', sample: '' })
const scheduleForm = ref({ time: '', chatSpaceId: '', isActive: false })
const preview = ref<ScriptDeploymentOutcome | null>(null)

const busy = computed(() => saving.value || running.value || popupBusy.value)

function snapshot(): string {
  return JSON.stringify({ draft: draft.value, readsSavedRunId: readsSavedRunId.value, schedule: schedule.value })
}
const dirty = computed(() => Boolean(draft.value) && snapshot() !== baseline.value)

const savedRunOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const out of runResults.value) {
    if (out.savedRunId && !seen.has(out.savedRunId)) seen.set(out.savedRunId, out.savedRunName || out.savedRunId)
  }
  return [...seen].map(([value, label]) => ({ value, label }))
})
const readsOptions = computed(() => [...savedRunOptions.value, { value: SAMPLE_CHOICE, label: 'Sample JSON' }])
const chatSpaceOptions = computed(() =>
  chatSpaces.value
    .filter((space) => space.isActive !== 'N')
    .map((space) => ({ value: space.chatSpaceId, label: `${space.spaceName} · ${space.chatProviderLabel}` })))

function savedRunName(savedRunId: string): string {
  return savedRunOptions.value.find((option) => option.value === savedRunId)?.label ?? savedRunId
}

function spaceName(chatSpaceId: string): string {
  return chatSpaces.value.find((space) => space.chatSpaceId === chatSpaceId)?.spaceName ?? chatSpaceId
}

const readsText = computed(() => {
  if (draft.value?.inputSource === 'SAMPLE') return 'Sample JSON'
  return readsSavedRunId.value ? savedRunName(readsSavedRunId.value) : '—'
})
const readsSubText = computed(() => (draft.value?.inputSource === 'RUN_RESULT' && readsSavedRunId.value ? 'newest result' : ''))
const scheduleText = computed(() => {
  if (!schedule.value) return 'Not scheduled'
  return schedule.value.isActive ? scheduleWords(schedule.value.scheduleExpr) : 'Off'
})
const postsToText = computed(() => (schedule.value ? spaceName(schedule.value.chatSpaceId) : '—'))
const lastRunFailed = computed(() => isFailedStatus(deployment.value?.lastRunStatus))
const lastRunText = computed(() => {
  const current = deployment.value
  if (!current?.lastRunDate) return 'Never'
  const when = formatDateTime(current.lastRunDate, { timeZone: timeZone.value })
  return lastRunFailed.value ? `Failed · ${when}` : `${when} · ${statusWords(current.lastRunStatus).toLowerCase()}`
})

// The header strip (DAR-UI-126): the three that change open their popup; Last run only reads.
const facts = computed<StaticFact[]>(() => {
  const changeable = { interactive: canEdit.value, disabled: busy.value }
  return [
    { key: 'reads', label: 'Reads', value: readsText.value, sub: readsSubText.value, explain: 'scriptInputRun',
      testId: 'script-fact-reads', ...changeable },
    { key: 'schedule', label: 'Schedule', value: scheduleText.value, explain: 'scriptSchedule', testId: 'script-fact-schedule', ...changeable },
    { key: 'postsTo', label: 'Posts to', value: postsToText.value, explain: 'scriptPostTo', testId: 'script-fact-posts-to', ...changeable },
    { key: 'lastRun', label: 'Last run', value: lastRunText.value, explain: 'scriptLastRun', testId: 'script-fact-last-run' },
  ]
})

function openFact(key: string): void {
  if (key === 'reads') openReads()
  else openSchedule()
}

const lineCount = computed(() => Math.max((draft.value?.scriptBody ?? '').split('\n').length, 12))
const errorLine = computed(() => runs.value[0]?.run.error?.line ?? null)

const popupTitle = computed(() => {
  switch (activePopup.value) {
    case 'reads': return 'Reads'
    case 'schedule': return 'Schedule'
    case 'preview': return 'Preview message'
    case 'delete': return 'Delete script'
    default: return ''
  }
})

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function errorText(error: ScriptError): string {
  return `${error.line ? `Line ${error.line}: ` : ''}${error.message}`
}

function resultText(result: unknown): string {
  return JSON.stringify(result ?? null, null, 2)
}

function resetDraft(): void {
  const script = saved.value
  draft.value = script
    ? {
        tenantScriptId: script.tenantScriptId,
        scriptName: script.scriptName,
        scriptProfile: script.scriptProfile,
        inputSource: script.inputSource,
        scriptBody: script.scriptBody,
        sampleInputJson: script.sampleInputJson ?? '',
      }
    : { tenantScriptId: '', scriptName: 'New script', scriptProfile: 'SCRIPT', inputSource: 'SAMPLE',
        scriptBody: STARTER_BODY, sampleInputJson: STARTER_SAMPLE }
  const current = deployment.value
  readsSavedRunId.value = current?.inputSavedRunId ?? ''
  schedule.value = current
    ? { scheduleExpr: current.scheduleExpr, chatSpaceId: current.chatSpaceId, isActive: current.isActive }
    : null
  baseline.value = snapshot()
}

async function load(tenantScriptId: string): Promise<void> {
  loading.value = true
  pageError.value = ''
  runError.value = ''
  runs.value = []
  runCount = 0
  draft.value = null
  try {
    const [listed, deployed] = await Promise.all([
      tenantScriptId ? scriptFacade.listTenantScripts() : Promise.resolve(null),
      scriptFacade.listTenantScriptDeployments(tenantScriptId ? { tenantScriptId } : {}),
    ])
    timeZone.value = deployed.timeZone ?? ''
    if (tenantScriptId) {
      const script = (listed?.scripts ?? []).find((item) => item.tenantScriptId === tenantScriptId) ?? null
      if (!script) {
        pageError.value = 'No such script in this tenant.'
        return
      }
      saved.value = script
      // One deployment per script on this page; the backend allows more.
      deployment.value = (deployed.deployments ?? [])[0] ?? null
    } else {
      saved.value = null
      deployment.value = null
    }
    resetDraft()
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the script.')
  } finally {
    loading.value = false
  }
}

// Names and choices only: the page still reads without them, as ids.
async function loadChoices(): Promise<void> {
  const [spaces, outputs] = await Promise.allSettled([
    settingsFacade.listTenantChatSpaces(),
    reconciliationFacade.listGeneratedOutputs({ pageIndex: 0, pageSize: 200 }),
  ])
  if (spaces.status === 'fulfilled') chatSpaces.value = spaces.value.chatSpaces ?? []
  if (outputs.status === 'fulfilled') {
    runResults.value = (outputs.value.generatedOutputs ?? []).filter((item) => item.fileName && item.resultAvailable !== false)
  }
}

function renameDraft(name: string): void {
  if (draft.value) draft.value.scriptName = name
}

function setOnSchedule(on: boolean): void {
  if (schedule.value) schedule.value.isActive = on
}

function openPopup(popup: Popup): void {
  if (!canEdit.value || busy.value) return
  popupError.value = ''
  activePopup.value = popup
}

function closePopup(): void {
  if (popupBusy.value) return
  activePopup.value = null
  popupError.value = ''
  preview.value = null
}

function openReads(): void {
  const current = draft.value
  if (!current) return
  readsForm.value = {
    choice: current.inputSource === 'SAMPLE' ? SAMPLE_CHOICE : readsSavedRunId.value,
    sample: current.sampleInputJson,
  }
  openPopup('reads')
}

function saveReads(): void {
  const current = draft.value
  const choice = readsForm.value.choice
  if (!current || !choice) return
  if (choice === SAMPLE_CHOICE) {
    current.inputSource = 'SAMPLE'
    current.sampleInputJson = readsForm.value.sample
  } else {
    current.inputSource = 'RUN_RESULT'
    readsSavedRunId.value = choice
  }
  closePopup()
}

function openSchedule(): void {
  const current = schedule.value
  scheduleForm.value = current
    ? { time: timeFromCron(current.scheduleExpr) ?? '', chatSpaceId: current.chatSpaceId, isActive: current.isActive }
    : { time: '09:00', chatSpaceId: '', isActive: false }
  openPopup('schedule')
}

function saveSchedule(): void {
  const form = scheduleForm.value
  // A cron that is not once a day shows no time; left untouched, it is kept as it is.
  const scheduleExpr = form.time ? cronFromTime(form.time) : schedule.value?.scheduleExpr ?? null
  if (!scheduleExpr || !form.chatSpaceId) return
  schedule.value = { scheduleExpr, chatSpaceId: form.chatSpaceId, isActive: form.isActive }
  closePopup()
}

async function openPreview(): Promise<void> {
  const current = deployment.value
  if (!current) return
  openPopup('preview')
  if (activePopup.value !== 'preview') return
  popupBusy.value = true
  preview.value = null
  try {
    const out = await scriptFacade.runTenantScriptDeployment({ tenantScriptDeploymentId: current.tenantScriptDeploymentId, send: false })
    preview.value = out.outcome
  } catch (error) {
    popupError.value = messageOf(error, 'Could not preview.')
  } finally {
    popupBusy.value = false
  }
}

async function sendNow(): Promise<void> {
  const current = deployment.value
  if (!current || popupBusy.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    const out = await scriptFacade.runTenantScriptDeployment({ tenantScriptDeploymentId: current.tenantScriptDeploymentId, send: true })
    preview.value = out.outcome
    if (out.deployment) deployment.value = out.deployment
  } catch (error) {
    popupError.value = messageOf(error, 'Could not send.')
  } finally {
    popupBusy.value = false
  }
}

async function deleteScript(): Promise<void> {
  const id = draft.value?.tenantScriptId
  if (!id || popupBusy.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    await scriptFacade.deleteTenantScript({ tenantScriptId: id })
    popupBusy.value = false
    closePopup()
    void router.push({ name: 'settings-tenant-scripts' })
  } catch (error) {
    popupError.value = messageOf(error, 'Could not delete the script.')
  } finally {
    popupBusy.value = false
  }
}

/** Run reads what the schedule reads: the saved run's newest finished result, or the sample. */
async function runDraft(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value || !current.scriptBody.trim()) return
  runError.value = ''
  const body = current.scriptBody
  const reads = readsText.value
  running.value = true
  try {
    let fileName: string | undefined
    if (current.inputSource === 'RUN_RESULT') {
      const savedRunId = readsSavedRunId.value
      if (!savedRunId) {
        runError.value = 'Choose what it reads.'
        return
      }
      const outputs = await reconciliationFacade.listGeneratedOutputs({ savedRunId, pageIndex: 0, pageSize: 20 })
      fileName = newestResultFileName(outputs.generatedOutputs ?? [], savedRunId) ?? undefined
      if (!fileName) {
        runError.value = `${reads} has no finished result yet.`
        return
      }
    }
    const out = await scriptFacade.runTenantScript({
      tenantScriptId: current.tenantScriptId || undefined,
      scriptBody: body,
      scriptProfile: current.scriptProfile,
      inputSource: current.inputSource,
      inputJson: current.inputSource === 'SAMPLE' ? current.sampleInputJson : undefined,
      fileName,
    })
    const previousBody = runs.value[0]?.body ?? saved.value?.scriptBody ?? body
    runCount += 1
    const meta = [
      `${out.run.units.toLocaleString()} units`,
      `${out.run.elapsedMs} ms`,
      `on ${reads}`,
      ...(previousBody !== body ? ['after an edit'] : []),
    ].join(' · ')
    runs.value = [
      { n: runCount, time: new Date().toLocaleTimeString(), body, run: out.run, meta },
      ...runs.value,
    ].slice(0, MAX_RUNS)
  } catch (error) {
    runError.value = messageOf(error, 'Could not run the script.')
  } finally {
    running.value = false
  }
}

/** One Save: the script, then its schedule when there is one and it changed. */
async function save(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value || !current.scriptName.trim()) return
  saving.value = true
  pageError.value = ''
  try {
    const out = await scriptFacade.saveTenantScript({
      tenantScriptId: current.tenantScriptId || undefined,
      scriptName: current.scriptName.trim(),
      scriptProfile: current.scriptProfile,
      inputSource: current.inputSource,
      scriptBody: current.scriptBody,
      sampleInputJson: current.sampleInputJson,
    })
    const wasNew = !current.tenantScriptId
    saved.value = out.script
    current.tenantScriptId = out.script.tenantScriptId
    current.scriptName = out.script.scriptName
    if (wasNew) void router.replace({ name: 'settings-tenant-script', params: { tenantScriptId: out.script.tenantScriptId } })

    const staged = schedule.value
    const before = deployment.value
    // A sample script's schedule reads no saved run.
    const inputSavedRunId = current.inputSource === 'RUN_RESULT' ? readsSavedRunId.value : ''
    const scheduleChanged = staged && (!before || before.scheduleExpr !== staged.scheduleExpr
      || before.chatSpaceId !== staged.chatSpaceId || before.isActive !== staged.isActive
      || (before.inputSavedRunId ?? '') !== inputSavedRunId)
    if (staged && scheduleChanged) {
      const saveOut = await scriptFacade.saveTenantScriptDeployment({
        tenantScriptDeploymentId: before?.tenantScriptDeploymentId,
        tenantScriptId: out.script.tenantScriptId,
        scheduleExpr: staged.scheduleExpr,
        inputSavedRunId: inputSavedRunId || undefined,
        chatSpaceId: staged.chatSpaceId,
        isActive: staged.isActive,
      })
      deployment.value = saveOut.deployment
    }
    baseline.value = snapshot()
  } catch (error) {
    pageError.value = messageOf(error, 'Could not save the script.')
  } finally {
    saving.value = false
  }
}

// An untouched starter follows the input choice, so a new run-result script starts from one that reads differences.
watch(() => draft.value?.inputSource, (source) => {
  const current = draft.value
  if (!current) return
  if (source === 'RUN_RESULT' && current.scriptBody === STARTER_BODY) current.scriptBody = RUN_RESULT_STARTER
  if (source === 'SAMPLE' && current.scriptBody === RUN_RESULT_STARTER) current.scriptBody = STARTER_BODY
})

// A first Save on /new moves the URL to the script's own; that is this page already, so it does not reload.
watch(routeScriptId, (id) => {
  if (id && id === draft.value?.tenantScriptId) return
  void load(id)
})

// Esc closes a popup; the delete popup has no cancel of WorkflowStepForm's own to catch it.
function handleCancelRequest(event: Event): void {
  if (!activePopup.value || popupBusy.value) return
  event.preventDefault()
  closePopup()
}

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  void load(routeScriptId.value)
  void loadChoices()
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
})
</script>

<style scoped>
.script-edited-mark {
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.script-bench {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}

.script-column {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.script-column__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 2.8rem;
}

.script-column__head h2 {
  margin: 0;
}

.script-column__hint {
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.script-column__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* The code with a line-number gutter. Both sides share one line height and the textarea is as tall as its lines,
   so the numbers stay beside their lines without syncing a scroll. */
.script-code {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  overflow: hidden;
  font-size: var(--type-mono-copy-size);
  line-height: 1.6;
}

.script-code__gutter {
  margin: 0;
  padding: var(--space-1-5) var(--space-1);
  list-style: none;
  border-right: 1px solid var(--border-soft);
  color: var(--text-dim);
  text-align: right;
  user-select: none;
  font-variant-numeric: tabular-nums;
}

.script-code__gutter li {
  min-width: 2ch;
  padding: 0 var(--space-00);
  border-radius: var(--radius-sm);
}

.script-code__line--error {
  background: var(--accent);
  color: var(--accent-ink);
}

.script-code__text {
  display: block;
  width: 100%;
  min-height: 0;
  margin: 0;
  padding: var(--space-1-5) var(--space-2);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  line-height: inherit;
  white-space: pre;
  tab-size: 2;
  overflow: auto hidden;
  resize: none;
}

.script-code__text:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

.script-docs-link {
  color: var(--text-soft);
  text-underline-offset: 0.22em;
}

.script-docs-link:hover {
  color: var(--text);
}

.script-runs {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.script-run {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.script-run--latest {
  border-color: color-mix(in oklab, var(--accent) 50%, var(--border));
}

.script-run--scheduled,
.script-run--empty {
  background: transparent;
}

.script-run--failed {
  border-style: dashed;
  border-color: var(--text);
}

.script-run--empty {
  border-style: dashed;
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.script-run__head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  color: var(--text-dim);
  font-size: var(--type-badge-size);
  font-variant-numeric: tabular-nums;
}

.script-run__out {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: var(--type-mono-copy-size);
}

.script-run__logs {
  margin: 0;
  padding-left: var(--space-3);
  color: var(--text-soft);
  font-size: var(--type-mono-copy-size);
}

.script-run__meta {
  color: var(--text-dim);
  font-size: var(--type-badge-size);
}

.script-sample {
  white-space: pre;
  tab-size: 2;
  overflow-x: auto;
}

.script-popup-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.script-popup-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-soft);
}

.script-preview-text {
  margin: 0;
  padding: var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@media (max-width: 860px) {
  .script-bench {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 560px) {
  .script-popup-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
