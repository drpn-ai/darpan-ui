<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': activePopup !== null || dataEdit !== null }">
    <template #hero>
      <StaticRecordTitle
        v-if="draft"
        ref="titleRef"
        :model-value="draft.queryName"
        :placeholder="NEW_NAME"
        :editable="canEdit"
        aria-label="Query name"
        test-id="script-name"
        explain="scriptName"
        :toggle-label="toggleLabel"
        :on="schedule?.isActive ?? false"
        toggle-test-id="script-on-schedule"
        :toggle-disabled="!schedule || !canSchedule || busy"
        @update:model-value="renameDraft"
        @update:on="setOnSchedule"
      />
      <h1 v-else>Query</h1>
    </template>

    <LoadingState v-if="loading" noun="query" />
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="script-page-error" />

    <template v-if="draft">
      <StaticFactStrip :facts="facts" test-id="script-facts" @open="openFact" />

      <form v-if="canEdit && agentReady" class="script-ask" @submit.prevent="ask">
        <label class="script-ask__field">
          <span v-explain="'scriptAsk'" class="workflow-context-label">Ask</span>
          <input
            v-model="askText"
            class="wizard-answer-control"
            type="text"
            placeholder="Which orders have been backordered for more than 3 days?"
            aria-label="Ask for a query"
            data-testid="script-ask"
            :disabled="busy"
          >
        </label>
        <button
          type="submit"
          class="user-settings-control"
          data-testid="script-ask-send"
          :aria-busy="asking ? 'true' : undefined"
          :disabled="busy || !askText.trim()"
        >
          Ask
        </button>
      </form>
      <p v-if="askReply" class="section-note" data-testid="script-ask-reply">{{ askReply }}</p>
      <ul v-if="askOptions.length" class="script-ask-options" data-testid="script-ask-options">
        <li v-for="option in askOptions" :key="option">
          <button type="button" class="user-settings-control" :disabled="busy" @click="answer(option)">{{ option }}</button>
        </li>
      </ul>
      <button
        v-if="previousDraft"
        type="button"
        class="user-settings-control"
        data-testid="script-ask-undo"
        :disabled="busy"
        @click="putBackDraft"
      >
        Put back my version
      </button>

      <!-- DAR-UI-138. The query as a notebook: what it reads, the script over it, what it made. -->
      <StaticPageSection class="query-step" data-testid="query-step-data">
        <template #header>
          <div class="query-step__head">
            <h2 class="static-page-section-heading">
              <span class="query-step__n">1</span>
              <span v-explain="'scriptInputRun'">Data</span>
            </h2>
            <span class="query-step__actions">
              <button
                type="button"
                class="app-icon-action"
                :aria-pressed="showReadJson ? 'true' : 'false'"
                aria-label="Read as JSON"
                title="Read as JSON"
                data-testid="script-read-json-toggle"
                @click="showReadJson = !showReadJson"
              >
                <AppIcon name="code" />
              </button>
              <button
                v-if="canEdit"
                type="button"
                class="app-icon-action"
                aria-label="Add data"
                title="Add data"
                data-testid="script-read-add"
                :disabled="busy || !readParse.ok || readInputs.length >= MAX_INPUTS"
                @click="openData(null)"
              >
                <AppIcon name="plus" />
              </button>
            </span>
          </div>
        </template>

        <InlineValidation v-if="!readParse.ok" tone="error" :message="readParse.error" data-testid="script-read-invalid" />
        <ul v-else class="query-reads">
          <li v-for="(row, index) in readRows" :key="index" class="query-read" data-testid="script-read-input">
            <span class="workflow-select-chip query-read__name">{{ row.name || '—' }}</span>
            <p class="query-read__sentence" data-testid="script-read-sentence">
              <template v-for="(part, partIndex) in row.parts" :key="partIndex">
                <span v-if="part.role === 'text' || !row.editable">{{ part.text }}</span>
                <button
                  v-else
                  type="button"
                  class="query-read__part"
                  :class="{ 'workflow-select-chip query-read__part--field': part.role === 'field' }"
                  data-testid="script-read-part"
                  :disabled="busy"
                  @click="openData(index)"
                >
                  {{ part.text }}
                </button>
              </template>
              <span v-if="row.limits.length" class="query-read__limits" data-testid="script-read-limits">
                Change it in the JSON: it has {{ row.limits.join(', ') }}.
              </span>
            </p>
            <button
              v-if="canEdit"
              type="button"
              class="app-icon-action query-read__remove"
              :aria-label="`Remove input ${row.name}`"
              :title="`Remove input ${row.name}`"
              data-testid="script-read-remove"
              :disabled="busy"
              @click="removeInput(index)"
            >
              <AppIcon name="trash" />
            </button>
          </li>
          <li v-if="!readRows.length" class="query-read query-read--empty" data-testid="script-read-empty">Reads nothing: script only</li>
        </ul>
        <textarea
          v-if="showReadJson || !readParse.ok"
          v-model="draft.readSpecJson"
          class="wizard-answer-control workflow-form-textarea script-sample"
          rows="12"
          spellcheck="false"
          aria-label="Read (JSON)"
          data-testid="script-read"
          :disabled="!canEdit || saving"
          @keydown.enter.meta.prevent="runDraft"
          @keydown.enter.ctrl.prevent="runDraft"
        />
      </StaticPageSection>

      <StaticPageSection class="query-step" data-testid="query-step-script">
        <template #header>
          <div class="query-step__head">
            <h2 class="static-page-section-heading">
              <span class="query-step__n">2</span>
              <span v-explain="'scriptBody'">Script</span>
            </h2>
            <span class="query-step__hint">
              ⌘↵ runs ·
              <a
                class="script-docs-link"
                :href="FUNCTIONS_DOCS_URL"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="script-functions-link"
              >fn: functions <span aria-hidden="true">↗</span></a>
            </span>
          </div>
        </template>
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
      </StaticPageSection>

      <StaticPageSection class="query-step" data-testid="query-step-result">
        <template #header>
          <div class="query-step__head">
            <h2 class="static-page-section-heading">
              <span class="query-step__n">3</span>
              <span v-explain="'scriptRuns'">Result</span>
            </h2>
            <span class="query-step__actions">
              <button
                v-if="savedSchedule && canSchedule"
                type="button"
                class="app-icon-action"
                aria-label="Preview send"
                title="Preview send"
                data-testid="script-preview"
                :disabled="busy"
                @click="openPreview"
              >
                <AppIcon name="eye" />
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
                <AppIcon name="play" />
              </button>
            </span>
          </div>
        </template>

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
              <span>{{ cell.label }}<template v-if="index === 0"> · latest</template></span>
              <span>{{ cell.time }}</span>
            </span>
            <pre v-if="cell.run.error" class="script-run__out" data-testid="script-run-error">{{ errorText(cell.run.error) }}</pre>
            <template v-else>
              <p v-if="cell.run.summary" class="script-run__summary" data-testid="script-run-summary">{{ cell.run.summary }}</p>
              <p v-if="cell.run.nothing" class="script-run__summary">Nothing to send.</p>
              <p v-if="cell.run.invalid" class="script-run__summary">{{ cell.run.invalid }}</p>
              <div v-for="file in cell.run.files" :key="file.name" class="script-run__file" data-testid="script-run-file">
                <span class="script-run__file-name">{{ file.name }} · {{ rowsWords(file.rowCount) }}</span>
                <div class="script-run__table-wrap">
                  <table class="script-run__table">
                    <thead>
                      <tr><th v-for="column in file.columns" :key="column" scope="col">{{ column }}</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, rowIndex) in file.previewRows" :key="rowIndex" data-testid="script-run-preview-row">
                        <td v-for="(value, valueIndex) in row" :key="valueIndex">{{ cellText(value) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
            <ul v-if="cell.run.logs?.length" class="script-run__logs" data-testid="script-run-logs">
              <li v-for="(line, lineIndex) in cell.run.logs" :key="lineIndex">{{ line }}</li>
            </ul>
            <span class="script-run__meta" data-testid="script-run-meta">{{ cell.meta }}</span>
          </li>
          <li
            v-if="savedSchedule?.lastRunDate"
            class="script-run script-run--scheduled"
            :class="{ 'script-run--failed': lastRunFailed }"
            data-testid="script-scheduled-cell"
          >
            <span class="script-run__head">
              <span>Scheduled run</span>
              <span>{{ formatDateTime(savedSchedule.lastRunDate, { timeZone }) }}</span>
            </span>
            <pre class="script-run__out">{{ savedSchedule.lastRunMessage || statusWords(savedSchedule.lastRunStatus) }}</pre>
          </li>
          <li v-if="!runs.length && !savedSchedule?.lastRunDate" class="script-run script-run--empty">No runs yet.</li>
        </ol>
      </StaticPageSection>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="{ name: 'settings-tenant-scripts' }"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to queries"
          title="Back to queries"
          data-testid="script-back"
        >
          <AppIcon name="back" />
        </RouterLink>
        <!-- Pressable without a name, so pressing it can say what is missing (the mascot reads this anchor). -->
        <span v-if="canEdit && draft" class="script-save" :data-testid="nameMissing ? 'script-save-blocked' : undefined">
          <AppSaveAction label="Save query" test-id="script-save" :dirty="dirty" :disabled="busy" @click="save" />
        </span>
        <button
          v-if="canEdit && draft?.tenantQueryId"
          type="button"
          class="app-icon-action app-icon-action--large app-icon-action--danger"
          aria-label="Delete query"
          data-testid="script-delete"
          :disabled="busy"
          @click="openPopup('delete')"
        >
          <AppIcon name="trash" />
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
          v-if="activePopup === 'schedule'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          :question="schedule ? 'Change the schedule.' : 'Set up the schedule.'"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="script-schedule-save"
          :submit-disabled="!scheduleForm.time && !schedule"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="script-schedule-cancel"
          @cancel="closePopup"
          @submit="saveSchedule"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="script-schedule-error" />
          <div class="script-popup-pair">
            <label class="wizard-input-shell">
              <span v-explain="'scriptSchedule'" class="workflow-context-label">Daily at · {{ timeZone || 'tenant zone' }}</span>
              <WorkflowTimeSelect v-model="scheduleForm.time" test-id="script-schedule-time" aria-label="Daily at" />
            </label>
            <label class="wizard-input-shell">
              <span v-explain="'scriptPostTo'" class="workflow-context-label">Chat space</span>
              <AppSelect
                v-model="scheduleForm.chatSpaceId"
                :options="chatSpaceOptions"
                placeholder="No chat"
                test-id="script-schedule-space"
              />
            </label>
          </div>
          <label class="wizard-input-shell">
            <span v-explain="'scriptEmailTo'" class="workflow-context-label">Email to</span>
            <input
              v-model="scheduleForm.emailTo"
              class="wizard-answer-control"
              type="text"
              placeholder="ops@example.com, finance@example.com"
              data-testid="script-schedule-email-to"
            >
          </label>
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Cc</span>
            <input v-model="scheduleForm.emailCc" class="wizard-answer-control" type="text" data-testid="script-schedule-email-cc">
          </label>
          <div class="script-popup-toggle">
            <AppToggleSwitch v-model="scheduleForm.isActive" label="On schedule" test-id="script-schedule-active" />
            <span>On schedule</span>
          </div>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'preview'"
          class="workflow-form--popup-compact"
          question="What it would send."
          primary-label="Send now"
          primary-test-id="script-send-now"
          :show-primary-action="isOwner"
          :submit-disabled="popupBusy || !preview"
          :show-enter-hint="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="script-preview-close"
          @cancel="closePopup"
          @submit="sendNow"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <LoadingState v-if="popupBusy && !preview" noun="preview" />
          <template v-if="preview">
            <p class="section-note" data-testid="script-preview-message">
              {{ preview.message || statusWords(preview.status) }}
            </p>
            <pre v-if="preview.result?.summary" class="script-preview-text" data-testid="script-preview-text">{{ preview.result.summary }}</pre>
          </template>
          <p v-if="!isOwner" class="section-note" data-testid="script-preview-owner-note">
            Only {{ savedSchedule?.ownerName || 'its owner' }} can send it now.
          </p>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup === 'delete'"
          class="workflow-form--popup-compact"
          :question="`Delete ${draft.queryName}?`"
          :show-primary-action="false"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <p class="section-note">Its schedule stops with it.</p>
          <div class="wizard-actions">
            <button
              type="button"
              class="app-icon-action app-icon-action--large app-icon-action--danger"
              aria-label="Confirm delete"
              data-testid="script-delete-confirm"
              :disabled="popupBusy"
              @click="deleteQuery"
            >
              <AppIcon name="trash" />
            </button>
            <AppCancelAction test-id="script-delete-cancel" :disabled="popupBusy" @click="closePopup" />
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>

  <QueryDataPopup
    v-if="dataEdit && draft"
    :input="dataEdit.input"
    :catalog="catalog"
    :catalog-error="catalogError"
    :taken-names="dataEdit.takenNames"
    @save="saveData"
    @cancel="dataEdit = null"
  />
</template>

<script setup lang="ts">
import AppIcon from '../../components/ui/AppIcon.vue'
// DAR-BE-334 (was DAR-UI-124's script page), DAR-UI-138. One tenant query on a page of its own, read top to bottom as a
// notebook: its name and schedule facts, the ask box, then 1 Data (each input as a sentence by name; a part opens the
// Data popup; the raw read JSON one icon away), 2 Script, 3 Result (this visit's runs, each file with a 20-row preview).
// The read JSON stays the one source of truth: the popup's changes are written into it. The ask box hands the question to the queries agent, whose proposal has
// already run; it fills this page and saves nothing. One Save keeps the query and its schedule together; the popups
// and the toggle only change this page until then. Scheduling needs tenant admin (it sends the tenant's data out), and
// only the schedule's owner can send it by hand.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import QueryDataPopup from '../../components/settings/QueryDataPopup.vue'
import AppCancelAction from '../../components/ui/AppCancelAction.vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowTimeSelect from '../../components/workflow/WorkflowTimeSelect.vue'
import { agentFacade, scriptFacade, settingsFacade } from '../../lib/api/facade'
import type { QueryError, QueryRun, QueryScheduleOutcome, TenantQuery, TenantQuerySchedule } from '../../lib/api/scriptTypes'
import type { TenantChatSpace } from '../../lib/api/types'
import {
  MAX_INPUTS,
  describeInput,
  editLimits,
  inputName,
  parseRead,
  serializeRead,
  type QueryCatalog,
  type ReadInput,
} from '../../lib/queryRead'
import {
  badRecipient,
  cronFromTime,
  formatRecipients,
  isFailedStatus,
  isOn,
  parseRecipients,
  scheduleWords,
  sendsToWords,
  statusWords,
  timeFromCron,
} from '../../lib/scriptDeployment'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { formatDateTime } from '../../lib/utils/date'
import { hintsFor } from '../../lib/mascotHints'
import { useAuthStore } from '../../stores/auth'
import { useMascotStore } from '../../stores/mascot'
import { usePermissionsStore } from '../../stores/permissions'

interface Draft {
  tenantQueryId: string
  queryName: string
  description: string
  readSpecJson: string
  scriptBody: string
}

/** The schedule as this page holds it until Save. */
interface Schedule {
  cronExpression: string
  isActive: boolean
  emailTo: string
  emailCc: string
  chatSpaceId: string
}

interface RunCell {
  n: number
  label: string
  time: string
  run: QueryRun
  meta: string
}

type Popup = 'schedule' | 'preview' | 'delete'

/** The Data popup: the input it changes (null adds one) at its place in the read. */
interface DataEdit {
  index: number | null
  input: ReadInput | null
  takenNames: string[]
}

const FUNCTIONS_DOCS_URL = 'https://developers.drpn.ai/tenant-queries/functions'
// Stroked on the 20-unit viewBox: angle brackets (the read as JSON) and an eye (preview what it would send).
const MAX_RUNS = 3
/** A new query's name starts blank and shows this, muted, as its placeholder: it still has to be given. */
const NEW_NAME = 'New query'
/** A new query reads the tenant's first audit, so the example runs as it opens; blank only when the tenant has none. */
function starterRead(auditId = ''): string {
  return `{
  "inputs": [
    { "name": "findings", "source": "auditFindings", "auditId": ${JSON.stringify(auditId)}, "fields": ["recordKey", "headline", "firstFoundDate"] }
  ]
}`
}
const STARTER_BODY = `// input.findings is the read's rows. Return a summary and files.
var rows = [...];
for (var f : input.findings) { fn:push(rows, [f.recordKey, f.headline, f.firstFoundDate]); }
{ 'summary': fn:str(size(rows)) + ' open findings',
  'files': [{ 'name': 'findings.csv', 'columns': ['record', 'headline', 'first found'], 'rows': rows }] }`

const route = useRoute()
const mascot = useMascotStore()
const titleRef = ref<InstanceType<typeof StaticRecordTitle> | null>(null)
const router = useRouter()
const permissionsStore = usePermissionsStore()
const authStore = useAuthStore()
const canEdit = computed(() => permissionsStore.canEditTenantSettings)
const canSchedule = computed(() => permissionsStore.canScheduleQueries)

const routeQueryId = computed(() => String(route.params.tenantScriptId ?? ''))

const saved = ref<TenantQuery | null>(null)
const savedSchedule = ref<TenantQuerySchedule | null>(null)
const timeZone = ref('')
const chatSpaces = ref<TenantChatSpace[]>([])
const loading = ref(false)
const pageError = ref('')

const draft = ref<Draft | null>(null)
const schedule = ref<Schedule | null>(null)
const baseline = ref('')
/** The read as raw JSON, for inputs the popup cannot change and for those who would rather type it. */
const showReadJson = ref(false)
/** What a query may read, by name (audits, saved runs, datasets); without it the read shows ids. */
const catalog = ref<QueryCatalog | null>(null)
const catalogError = ref('')
const dataEdit = ref<DataEdit | null>(null)

const saving = ref(false)
const running = ref(false)
const asking = ref(false)
const runError = ref('')
const runs = ref<RunCell[]>([])
let runCount = 0

const askText = ref('')
const askReply = ref('')
const askOptions = ref<string[]>([])
/** The read and script the agent's last proposal replaced, so the person can put them back. */
const previousDraft = ref<{ readSpecJson: string; scriptBody: string } | null>(null)
/** The ask box shows only when the agent is on and this person has live AI access here. */
const agentReady = ref(false)
let conversationId: string | undefined

const activePopup = ref<Popup | null>(null)
const popupBusy = ref(false)
const popupError = ref('')
const scheduleForm = ref({ time: '', emailTo: '', emailCc: '', chatSpaceId: '', isActive: false })
const preview = ref<QueryScheduleOutcome | null>(null)

const busy = computed(() => saving.value || running.value || asking.value || popupBusy.value)
const toggleLabel = computed(() => {
  if (!canSchedule.value) return 'On schedule: scheduling needs tenant admin'
  if (!schedule.value) return 'On schedule: set up a schedule first'
  return 'On schedule'
})
/** The addresses in full, under Sends to, for everyone who can see the query (not only those who can change it). */
const addressesText = computed(() => {
  const current = schedule.value
  if (!current) return ''
  return [current.emailTo, ...(current.emailCc ? [`cc ${current.emailCc}`] : [])].filter(Boolean).join(' · ')
})
const isOwner = computed(() => Boolean(savedSchedule.value?.ownerUserId) && savedSchedule.value?.ownerUserId === authStore.userId)

function snapshot(): string {
  return JSON.stringify({ draft: draft.value, schedule: schedule.value })
}
const nameMissing = computed(() => draft.value !== null && !draft.value.queryName.trim())
const dirty = computed(() => Boolean(draft.value) && snapshot() !== baseline.value)

const chatSpaceOptions = computed(() => [
  { value: '', label: 'No chat' },
  ...chatSpaces.value
    .filter((space) => space.isActive !== 'N')
    .map((space) => ({ value: space.chatSpaceId, label: `${space.spaceName} · ${space.chatProviderLabel}` })),
])

function spaceName(chatSpaceId: string): string {
  return chatSpaces.value.find((space) => space.chatSpaceId === chatSpaceId)?.spaceName ?? chatSpaceId
}

const readParse = computed(() => parseRead(draft.value?.readSpecJson))
const readInputs = computed(() => (readParse.value.ok ? readParse.value.read.inputs : []))
/** Each input as a sentence of parts; one the popup cannot change in full shows as plain words and says why. */
const readRows = computed(() => readInputs.value.map((input) => {
  const limits = editLimits(input)
  return { name: inputName(input), parts: describeInput(input, catalog.value), limits, editable: canEdit.value && !limits.length }
}))

const scheduleText = computed(() => {
  if (!schedule.value) return 'Not scheduled'
  return schedule.value.isActive ? scheduleWords(schedule.value.cronExpression) : 'Off'
})
const sendsToText = computed(() => (schedule.value
  ? sendsToWords(parseRecipients(schedule.value.emailTo).length, schedule.value.chatSpaceId ? spaceName(schedule.value.chatSpaceId) : null)
  : '—'))
const lastRunFailed = computed(() => isFailedStatus(savedSchedule.value?.lastRunStatus))
const lastRunText = computed(() => {
  const current = savedSchedule.value
  if (!current?.lastRunDate) return 'Never'
  const when = formatDateTime(current.lastRunDate, { timeZone: timeZone.value })
  return `${when} · ${statusWords(current.lastRunStatus).toLowerCase()}`
})

// The header strip (DAR-UI-126): the two that change open the schedule popup (tenant admins only); Sends as (the
// schedule's owner) and Last run only read.
const facts = computed<StaticFact[]>(() => {
  const changeable = { interactive: canEdit.value && canSchedule.value, disabled: busy.value }
  const owner = savedSchedule.value?.ownerName
  return [
    { key: 'schedule', label: 'Schedule', value: scheduleText.value, explain: 'scriptSchedule', testId: 'script-fact-schedule', ...changeable },
    { key: 'sendsTo', label: 'Sends to', value: sendsToText.value, sub: addressesText.value || undefined, explain: 'scriptPostTo',
      testId: 'script-fact-sends-to', ...changeable },
    ...(owner ? [{ key: 'sendsAs', label: 'Sends as', value: owner, sub: 'saved the schedule', testId: 'script-fact-sends-as' }] : []),
    { key: 'lastRun', label: 'Last run', value: lastRunText.value, explain: 'scriptLastRun', testId: 'script-fact-last-run' },
  ]
})

function openFact(): void {
  openSchedule()
}

const lineCount = computed(() => Math.max((draft.value?.scriptBody ?? '').split('\n').length, 12))
const errorLine = computed(() => runs.value[0]?.run.error?.line ?? null)

const popupTitle = computed(() => {
  switch (activePopup.value) {
    case 'schedule': return 'Schedule'
    case 'preview': return 'Preview send'
    case 'delete': return 'Delete query'
    default: return ''
  }
})

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const READ_KINDS = new Set(['READ_ERROR', 'READ_NOT_ALLOWED', 'READ_TOO_LARGE'])

function errorText(error: QueryError): string {
  if (READ_KINDS.has(error.kind)) return `${statusWords(error.kind)}: ${error.message}`
  return `${error.line ? `Line ${error.line}: ` : ''}${error.message}`
}

function rowsWords(count: number): string {
  return `${count.toLocaleString()} row${count === 1 ? '' : 's'}`
}

function cellText(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function runMeta(run: QueryRun): string {
  const reads = Object.entries(run.readCounts ?? {}).map(([name, count]) => `read ${name} ${count.toLocaleString()}`)
  return [
    ...(run.units != null ? [`${run.units.toLocaleString()} units`] : []),
    ...(run.elapsedMs != null ? [`${run.elapsedMs} ms`] : []),
    ...reads,
  ].join(' · ')
}

function addRun(label: string, run: QueryRun): void {
  runCount += 1
  runs.value = [
    { n: runCount, label, time: new Date().toLocaleTimeString(), run, meta: runMeta(run) },
    ...runs.value,
  ].slice(0, MAX_RUNS)
}

function toSchedule(current: TenantQuerySchedule | null): Schedule | null {
  return current
    ? { cronExpression: current.cronExpression, isActive: isOn(current.isActive), emailTo: current.emailTo ?? '',
        emailCc: current.emailCc ?? '', chatSpaceId: current.chatSpaceId ?? '' }
    : null
}

function resetDraft(): void {
  const query = saved.value
  draft.value = query
    ? { tenantQueryId: query.tenantQueryId, queryName: query.queryName, description: query.description ?? '',
        readSpecJson: query.readSpecJson ?? '', scriptBody: query.scriptBody }
    : { tenantQueryId: '', queryName: '', description: '', readSpecJson: starterRead(firstAuditId()), scriptBody: STARTER_BODY }
  schedule.value = toSchedule(savedSchedule.value)
  baseline.value = snapshot()
}

function firstAuditId(): string {
  return catalog.value?.audits?.[0]?.auditId ?? ''
}

/** The catalog can land after a new query's draft: an untouched starter read takes the audit then, still unedited. */
function fillStarterAudit(): void {
  const current = draft.value
  if (!current || current.tenantQueryId || current.readSpecJson !== starterRead() || !firstAuditId()) return
  const wasClean = !dirty.value
  current.readSpecJson = starterRead(firstAuditId())
  if (wasClean) baseline.value = snapshot()
}

async function load(tenantQueryId: string): Promise<void> {
  loading.value = true
  pageError.value = ''
  runError.value = ''
  runs.value = []
  runCount = 0
  draft.value = null
  dataEdit.value = null
  try {
    const [listed, scheduled] = await Promise.all([
      tenantQueryId ? scriptFacade.listTenantQueries() : Promise.resolve(null),
      scriptFacade.listTenantQuerySchedules(tenantQueryId ? { tenantQueryId } : {}),
    ])
    timeZone.value = scheduled.timeZone ?? ''
    if (tenantQueryId) {
      const query = (listed?.queries ?? []).find((item) => item.tenantQueryId === tenantQueryId) ?? null
      if (!query) {
        pageError.value = 'No such query in this tenant.'
        return
      }
      saved.value = query
      // One schedule per query on this page; the backend allows more.
      savedSchedule.value = (scheduled.schedules ?? [])[0] ?? null
    } else {
      saved.value = null
      savedSchedule.value = null
    }
    resetDraft()
  } catch (error) {
    pageError.value = messageOf(error, 'Could not load the query.')
  } finally {
    loading.value = false
  }
}

// Names and choices only: the page still reads without them, as ids.
async function loadChoices(): Promise<void> {
  const [spaces, agent, reads] = await Promise.allSettled([settingsFacade.listTenantChatSpaces(), agentFacade.getAgentStatus(),
    scriptFacade.getTenantQueryCatalog()])
  chatSpaces.value = spaces.status === 'fulfilled' ? spaces.value.chatSpaces ?? [] : []
  agentReady.value = agent.status === 'fulfilled' && agent.value.state === 'ON' && agent.value.grantState === 'LIVE'
  catalog.value = reads.status === 'fulfilled' ? reads.value : null
  catalogError.value = reads.status === 'fulfilled' ? '' : messageOf(reads.reason, 'Could not read what queries can read; sources show as ids.')
  fillStarterAudit()
}

/** Open the Data popup on one input of the read, or on a new one (index null). */
function openData(index: number | null): void {
  if (!canEdit.value || busy.value || !readParse.value.ok) return
  const inputs = readInputs.value
  const input = index == null ? null : inputs[index] ?? null
  if (index != null && (!input || editLimits(input).length)) return
  dataEdit.value = {
    index,
    input,
    takenNames: inputs.filter((_, at) => at !== index).map(inputName).filter(Boolean),
  }
}

/** Write the read back with these inputs; the draft's JSON is what Save and Run send. */
function writeInputs(inputs: ReadInput[]): void {
  const current = draft.value
  const parsed = readParse.value
  if (!current || !parsed.ok) return
  current.readSpecJson = serializeRead(parsed.read, inputs)
}

function saveData(input: ReadInput): void {
  const edit = dataEdit.value
  if (!edit) return
  const inputs = [...readInputs.value]
  if (edit.index == null) inputs.push(input)
  else inputs.splice(edit.index, 1, input)
  writeInputs(inputs)
  dataEdit.value = null
}

function removeInput(index: number): void {
  if (!canEdit.value || busy.value) return
  writeInputs(readInputs.value.filter((_, at) => at !== index))
}

function renameDraft(name: string): void {
  if (draft.value) draft.value.queryName = name
}

function setOnSchedule(on: boolean): void {
  if (schedule.value && canSchedule.value) schedule.value.isActive = on
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

function openSchedule(): void {
  if (!canSchedule.value) return
  const current = schedule.value
  scheduleForm.value = current
    ? { time: timeFromCron(current.cronExpression) ?? '', emailTo: current.emailTo, emailCc: current.emailCc,
        chatSpaceId: current.chatSpaceId, isActive: current.isActive }
    : { time: '09:00', emailTo: '', emailCc: '', chatSpaceId: '', isActive: false }
  openPopup('schedule')
}

function saveSchedule(): void {
  const form = scheduleForm.value
  const to = parseRecipients(form.emailTo)
  const cc = parseRecipients(form.emailCc)
  const bad = badRecipient([...to, ...cc])
  if (bad) {
    popupError.value = `${bad} is not an email address.`
    return
  }
  if (!to.length && !form.chatSpaceId) {
    popupError.value = 'Send it somewhere: an email address or a chat space.'
    return
  }
  // A cron that is not once a day shows no time; left untouched, it is kept as it is.
  const cronExpression = form.time ? cronFromTime(form.time) : schedule.value?.cronExpression ?? null
  if (!cronExpression) return
  schedule.value = { cronExpression, isActive: form.isActive, emailTo: formatRecipients(to), emailCc: formatRecipients(cc),
    chatSpaceId: form.chatSpaceId }
  closePopup()
}

async function openPreview(): Promise<void> {
  const current = savedSchedule.value
  if (!current) return
  openPopup('preview')
  if (activePopup.value !== 'preview') return
  popupBusy.value = true
  preview.value = null
  try {
    preview.value = (await scriptFacade.runTenantQuerySchedule({ scheduleId: current.scheduleId, send: false })).outcome
  } catch (error) {
    popupError.value = messageOf(error, 'Could not preview.')
  } finally {
    popupBusy.value = false
  }
}

async function sendNow(): Promise<void> {
  const current = savedSchedule.value
  if (!current || popupBusy.value || !isOwner.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    preview.value = (await scriptFacade.runTenantQuerySchedule({ scheduleId: current.scheduleId, send: true })).outcome
    const listed = await scriptFacade.listTenantQuerySchedules({ tenantQueryId: current.tenantQueryId })
    savedSchedule.value = (listed.schedules ?? [])[0] ?? savedSchedule.value
  } catch (error) {
    popupError.value = messageOf(error, 'Could not send.')
  } finally {
    popupBusy.value = false
  }
}

async function deleteQuery(): Promise<void> {
  const id = draft.value?.tenantQueryId
  if (!id || popupBusy.value) return
  popupBusy.value = true
  popupError.value = ''
  try {
    await scriptFacade.deleteTenantQuery({ tenantQueryId: id })
    popupBusy.value = false
    closePopup()
    void router.push({ name: 'settings-tenant-scripts' })
  } catch (error) {
    popupError.value = messageOf(error, 'Could not delete the query.')
  } finally {
    popupBusy.value = false
  }
}

/** Run the draft (read and script as they are on this page) on the tenant's data; nothing is sent. */
async function runDraft(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value || !current.scriptBody.trim()) return
  runError.value = ''
  running.value = true
  try {
    const out = await scriptFacade.runTenantQuery({
      tenantQueryId: current.tenantQueryId || undefined,
      readSpecJson: current.readSpecJson,
      scriptBody: current.scriptBody,
    })
    addRun(`Run ${runCount + 1}`, out.result)
  } catch (error) {
    runError.value = messageOf(error, 'Could not run the query.')
  } finally {
    running.value = false
  }
}

/** The queries agent: its proposal has already run on the tenant's data; it fills the draft, nothing is saved. */
async function ask(): Promise<void> {
  const current = draft.value
  const text = askText.value.trim()
  if (!current || busy.value || !text) return
  asking.value = true
  askReply.value = ''
  askOptions.value = []
  runError.value = ''
  try {
    const draftNow = { readSpecJson: current.readSpecJson, scriptBody: current.scriptBody }
    const out = await scriptFacade.sendAgentQueryTurn({ ...(conversationId ? { conversationId } : {}), text, ...draftNow })
    conversationId = out.conversationId ?? conversationId
    askReply.value = out.question?.text || out.reply || ''
    askOptions.value = out.question?.options ?? []
    const proposed = out.queryProposal
    if (proposed) {
      previousDraft.value = draftNow
      current.readSpecJson = proposed.proposal.readSpecJson ?? ''
      current.scriptBody = proposed.proposal.scriptBody
      if (!current.queryName.trim() && proposed.proposal.queryName) current.queryName = proposed.proposal.queryName
      if (!current.description && proposed.proposal.description) current.description = proposed.proposal.description
      addRun("Agent's run", proposed.preview)
      askText.value = ''
    }
  } catch (error) {
    // A conversation from another tenant or an earlier visit is not found: start a new one next time.
    if (messageOf(error, '').includes('was not found')) conversationId = undefined
    runError.value = messageOf(error, 'Could not ask the agent.')
  } finally {
    asking.value = false
  }
}

/** A choice the agent offered: sent as the person's answer. */
function answer(option: string): void {
  askText.value = option
  void ask()
}

function putBackDraft(): void {
  const current = draft.value
  const before = previousDraft.value
  if (!current || !before) return
  current.readSpecJson = before.readSpecJson
  current.scriptBody = before.scriptBody
  previousDraft.value = null
}

/** One Save: the query, then its schedule when there is one and it changed. */
async function save(): Promise<void> {
  const current = draft.value
  if (!current || busy.value || !canEdit.value) return
  if (!current.queryName.trim()) {
    // Not saved: the mascot says what is missing (its words are data) and the caret goes where the name is typed.
    const [why] = hintsFor(String(route.name ?? ''), document)
    if (why) mascot.nudge(why)
    titleRef.value?.focus()
    return
  }
  saving.value = true
  pageError.value = ''
  const wasNew = !current.tenantQueryId
  let savedId = ''
  try {
    const out = await scriptFacade.saveTenantQuery({
      tenantQueryId: current.tenantQueryId || undefined,
      queryName: current.queryName.trim(),
      description: current.description || undefined,
      readSpecJson: current.readSpecJson,
      scriptBody: current.scriptBody,
    })
    saved.value = out.query
    savedId = out.query.tenantQueryId
    current.tenantQueryId = out.query.tenantQueryId
    current.queryName = out.query.queryName

    const staged = schedule.value
    const before = toSchedule(savedSchedule.value)
    if (staged && canSchedule.value && JSON.stringify(staged) !== JSON.stringify(before)) {
      const time = timeFromCron(staged.cronExpression)
      const saveOut = await scriptFacade.saveTenantQuerySchedule({
        scheduleId: savedSchedule.value?.scheduleId,
        tenantQueryId: out.query.tenantQueryId,
        ...(time ? { dailyAt: time } : { cronExpression: staged.cronExpression }),
        isActive: staged.isActive,
        emailTo: staged.emailTo || undefined,
        emailCc: staged.emailCc || undefined,
        chatSpaceId: staged.chatSpaceId || undefined,
      })
      savedSchedule.value = saveOut.schedule
      schedule.value = toSchedule(saveOut.schedule)
    } else if (savedSchedule.value) {
      // Changing the script of a schedule makes the saver its owner: read it back so the owner line is right.
      const listed = await scriptFacade.listTenantQuerySchedules({ tenantQueryId: out.query.tenantQueryId })
      savedSchedule.value = (listed.schedules ?? [])[0] ?? savedSchedule.value
    }
    baseline.value = snapshot()
  } catch (error) {
    pageError.value = messageOf(error, 'Could not save the query.')
  } finally {
    saving.value = false
    // Last, even when the schedule failed: /new and /:id are two routes, so the move mounts the page afresh and it
    // reads what was saved (a retry from /new would otherwise create the query again).
    if (wasNew && savedId) void router.replace({ name: 'settings-tenant-script', params: { tenantScriptId: savedId } })
  }
}

// Another query's URL on this same page (its own route record) loads that query.
watch(routeQueryId, (id) => {
  if (id && id === draft.value?.tenantQueryId) return
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
  void load(routeQueryId.value)
  void loadChoices()
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
})
</script>

<style scoped>
/* Only an anchor for the mascot's save-blocked line: it must not add a box to the action row. */
.script-save {
  display: contents;
}


/* The ask box: one line to the queries agent, its Ask beside it. */
.script-ask {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.script-ask__field {
  display: grid;
  flex: 1;
  gap: var(--space-0);
  min-width: 0;
}

.script-ask-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* DAR-UI-138. The three numbered steps: a head with its number, title and its own actions on the right. */
.query-step {
  --surface-section-body-gap: var(--space-2);
}

.query-step__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 2.8rem;
  padding-bottom: var(--space-1);
  border-bottom: 1px solid var(--border-soft);
}

.query-step__head h2 {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.query-step__n {
  color: var(--text-dim);
  font-size: var(--type-note-size);
  font-variant-numeric: tabular-nums;
}

.query-step__hint {
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.query-step__actions {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* One bordered row per input: its name, the sentence, the remove. */
.query-reads {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.query-read {
  display: grid;
  grid-template-columns: minmax(6rem, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.query-read--empty {
  display: block;
  border-style: dashed;
  background: transparent;
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

.query-read__name {
  justify-self: start;
}

.query-read__sentence {
  margin: 0;
  line-height: 2;
  overflow-wrap: anywhere;
}

/* A part of the sentence the Data popup changes: a dashed underline, a tint on hover. */
.query-read__part {
  margin: 0;
  padding: 0 var(--space-00);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-decoration: underline dashed;
  text-decoration-color: var(--text-dim);
  text-underline-offset: 0.3em;
  cursor: pointer;
  transition: background-color var(--motion-fast) var(--ease-out);
}

.query-read__part:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.query-read__part:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: 1px;
}

.query-read__part:disabled {
  cursor: default;
}

.query-read__part--field {
  padding: 0 var(--space-1-5);
  border: 1px solid color-mix(in oklab, var(--text) 14%, transparent);
  border-radius: var(--radius-pill);
  text-decoration: none;
  line-height: 1.6;
}

.query-read__limits {
  display: block;
  color: var(--text-muted);
  font-size: var(--type-note-size);
  line-height: 1.4;
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

.script-run__summary {
  margin: 0;
  overflow-wrap: anywhere;
}

.script-run__file {
  display: grid;
  gap: var(--space-0);
  min-width: 0;
}

.script-run__file-name {
  color: var(--text-soft);
  font-size: var(--type-note-size);
}

/* A file's first 20 rows: the app table's header and rules, small and scrolling sideways. */
.script-run__table-wrap {
  max-height: 16rem;
  overflow: auto;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}

.script-run__table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--type-mono-copy-size);
}

.script-run__table th,
.script-run__table td {
  padding: var(--space-00) var(--space-1);
  border-bottom: 1px solid var(--border-soft);
  text-align: left;
  white-space: nowrap;
}

.script-run__table th {
  position: sticky;
  top: 0;
  color: var(--text-muted);
  font-size: var(--type-table-head-size);
  font-weight: inherit;
  letter-spacing: var(--type-table-head-tracking);
  text-transform: uppercase;
  background: var(--surface-2);
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

@media (max-width: 560px) {
  .script-popup-pair {
    grid-template-columns: minmax(0, 1fr);
  }

  /* An input's row stacks: its name and remove on top, the sentence under them. */
  .query-read {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-1);
  }

  .query-read__sentence {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .query-step__head {
    flex-wrap: wrap;
  }
}
</style>
