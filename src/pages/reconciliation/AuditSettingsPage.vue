<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': popup !== null }">
    <template #hero>
      <StaticRecordTitle
        v-if="settings"
        v-model="nameDraft"
        aria-label="Audit name"
        test-id="audit-settings-name"
        explain="auditName"
        toggle-label="Daily schedule"
        :on="settings.schedule.active"
        toggle-test-id="audit-settings-schedule-active"
        :toggle-disabled="saving"
        @commit="void commitName($event)"
        @update:on="void setScheduleActive($event)"
      />
      <h1 v-else>Audit settings</h1>
    </template>

    <InlineValidation v-if="error" tone="error" :message="error" data-testid="audit-settings-error" />

    <template v-if="settings">
      <StaticFactStrip :facts="facts" test-id="audit-settings-facts" @open="openFact" />
      <InlineValidation
        v-if="savedSpaceProblem"
        tone="warning"
        :message="savedSpaceProblem"
        data-testid="audit-settings-chat-space-problem"
      />

      <StaticPageSection>
        <template #header>
          <h2 v-explain="'auditStatements'" class="static-page-section-heading">Statements</h2>
        </template>
        <ul v-if="settings.statements.length" class="audit-statements">
          <li
            v-for="statement in settings.statements"
            :key="statement.id"
            class="audit-statement"
            :class="{ 'audit-statement--off': !statement.active }"
            :data-testid="`audit-settings-statement-${statement.id}`"
          >
            <button
              type="button"
              class="audit-statement__open"
              :aria-label="`Open statement ${statement.code}`"
              :data-testid="`audit-settings-statement-open-${statement.id}`"
              :disabled="saving"
              @click="openStatement(statement)"
            >
              <span class="audit-statement__code">{{ statement.code }}</span>
              <span class="audit-statement__text">{{ statement.text }}</span>
              <span class="audit-statement__count">{{ checksWords(statement.checks.length) }}</span>
            </button>
            <!-- DAR-UI-140: the level cell is itself the button, as a changeable fact is. -->
            <button
              type="button"
              class="audit-statement__priority audit-level"
              :aria-label="`${statement.code} priority: ${levelWords(levelOf(statement))}`"
              :data-testid="`audit-settings-priority-${statement.id}`"
              :disabled="saving"
              @click="openPriority(statement)"
            >
              <AuditPriorityMark :level="levelOf(statement)" />
              <span class="audit-level__word">{{ LEVEL_WORD[levelOf(statement)] }}</span>
            </button>
            <AppToggleSwitch
              class="audit-statement__toggle"
              :model-value="statement.active"
              :label="`Check statement ${statement.code}`"
              :test-id="`audit-settings-statement-active-${statement.id}`"
              :disabled="saving"
              @update:model-value="void setStatementActive(statement, $event)"
            />
          </li>
        </ul>
        <button
          type="button"
          class="static-page-action-tile static-page-create-action"
          data-testid="audit-settings-new-open"
          :disabled="saving"
          @click="openNewStatement"
        >
          New statement
        </button>
      </StaticPageSection>
    </template>

    <template #actions>
      <div class="action-row">
        <RouterLink
          :to="auditRoute"
          class="app-icon-action app-icon-action--large"
          aria-label="Back to the audit"
          title="Back to the audit"
          data-testid="audit-settings-back"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="backIconPath" fill="currentColor" />
          </svg>
        </RouterLink>
      </div>
    </template>
  </StaticPageFrame>

  <div
    v-if="popup && settings"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="audit-settings-popup-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="audit-settings-popup-title">{{ popupTitle }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          v-if="popup === 'schedule'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Change the schedule."
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="audit-settings-schedule-save"
          :submit-disabled="saving || !scheduleForm.time"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          cancel-test-id="audit-settings-schedule-cancel"
          @cancel="closePopup"
          @submit="void saveSchedule()"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="audit-settings-popup-error" />
          <div class="audit-popup-pair">
            <div class="wizard-input-shell">
              <span v-explain="'auditScheduleTime'" class="workflow-context-label">Daily at</span>
              <WorkflowTimeSelect v-model="scheduleForm.time" test-id="audit-settings-schedule-time" aria-label="Daily at" :disabled="saving" />
            </div>
            <label class="wizard-input-shell">
              <span class="workflow-context-label">Timezone</span>
              <AppSelect
                v-model="scheduleForm.timeZone"
                test-id="audit-settings-schedule-zone"
                :options="timezoneOptions"
                :disabled="saving"
                searchable
                search-placeholder="Search timezones"
              />
            </label>
          </div>
          <p v-if="settings.schedule.mixed" class="section-note" data-testid="audit-settings-schedule-mixed">
            Checks run at different times; a change here sets them all.
          </p>
        </WorkflowStepForm>

        <!-- DAR-BE-207: the update after each run, by email to the tenant's members and any extra addresses. One switch
             turns the email and the chat card off together. -->
        <WorkflowStepForm
          v-else-if="popup === 'email' && settings.runEmail"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          data-testid="audit-settings-run-email"
          question="Who gets the update?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="audit-settings-run-email-save"
          :submit-disabled="saving"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          cancel-test-id="audit-settings-run-email-cancel"
          @cancel="closePopup"
          @submit="void saveEmail()"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="audit-settings-popup-error" />
          <div class="audit-popup-toggle">
            <AppToggleSwitch
              v-model="emailForm.active"
              label="After each run"
              test-id="audit-settings-run-email-active"
              :disabled="saving"
            />
            <span data-testid="audit-settings-run-email-members">{{ membersLine }}</span>
          </div>
          <label class="wizard-input-shell">
            <span v-explain="'auditRunEmailExtra'" class="workflow-context-label">Also send to</span>
            <WorkflowChipTextInput
              ref="alsoSendToInput"
              v-model="emailForm.alsoSendTo"
              placeholder="name@company.com"
              :accept="isEmail"
              :disabled="saving"
              @reject="addressError = `${$event} is not an email address.`"
              @update:pending="addressError = null"
            />
          </label>
          <InlineValidation v-if="addressError" tone="error" :message="addressError" data-testid="audit-settings-address-error" />
        </WorkflowStepForm>

        <!-- DAR-UI-111: the chat space that gets the run's summary card; None sends none. -->
        <WorkflowStepForm
          v-else-if="popup === 'space'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="Where does the card post?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="audit-settings-chat-space-save"
          :submit-disabled="saving"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          cancel-test-id="audit-settings-chat-space-cancel"
          @cancel="closePopup"
          @submit="void saveSpace()"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="audit-settings-popup-error" />
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Chat space</span>
            <AppSelect
              v-model="spaceForm"
              test-id="audit-settings-chat-space"
              :options="chatSpaceOptions"
              :disabled="saving"
              searchable
              search-placeholder="Search chat spaces"
            />
          </label>
          <InlineValidation
            v-if="pickedSpaceProblem"
            tone="warning"
            :message="pickedSpaceProblem"
            data-testid="audit-settings-picked-space-problem"
          />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="popup === 'statement' && editingStatement"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          question="What must be true?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="audit-settings-statement-save"
          :submit-disabled="saving || !statementText.trim()"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          cancel-test-id="audit-settings-statement-cancel"
          @cancel="closePopup"
          @submit="void saveStatement()"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="audit-settings-popup-error" />
          <textarea
            v-model="statementText"
            class="wizard-answer-control workflow-form-textarea"
            rows="3"
            :aria-label="`${editingStatement.code} statement`"
            data-testid="audit-settings-statement-text"
            :disabled="saving"
            @keydown.enter.exact.prevent="void saveStatement()"
          />
          <div class="audit-popup-checks">
            <span v-explain="'auditCheck'" class="workflow-context-label">Checks</span>
            <ul class="audit-checks">
              <li
                v-for="check in editingStatement.checks"
                :key="check.id"
                class="audit-check"
                :data-testid="`audit-settings-check-${check.id}`"
              >
                <span class="audit-check__name">
                  {{ check.label }}<span v-if="check.runName" class="audit-check__run"> · {{ check.runName }}</span>
                </span>
                <button
                  v-if="check.savedRunId"
                  type="button"
                  class="audit-check__rules"
                  :aria-label="`Open rules for ${check.label}`"
                  :data-testid="`audit-settings-check-rules-${check.id}`"
                  :disabled="opening"
                  @click="void openRules(check)"
                >
                  Rules <span aria-hidden="true">→</span>
                </button>
              </li>
              <li v-if="!editingStatement.checks.length" class="audit-check audit-check--none">No checks yet.</li>
              <li class="audit-check audit-check--add">
                <button
                  type="button"
                  class="user-settings-control"
                  data-testid="audit-settings-add-check"
                  :disabled="saving"
                  @click="popup = 'check'"
                >
                  Add check
                </button>
              </li>
            </ul>
          </div>
          <!-- DAR-UI-140: each reason's own level. One that closes on every check closes the finding and takes none. -->
          <div v-if="editingStatement.reasons?.length" class="audit-popup-checks">
            <span class="workflow-context-label">Reasons</span>
            <ul class="audit-checks">
              <li
                v-for="reason in editingStatement.reasons"
                :key="reason.conclusion"
                class="audit-check audit-reason"
                :data-testid="`audit-settings-reason-${reason.conclusion}`"
              >
                <span class="audit-check__name">{{ reason.label }}</span>
                <span v-if="reason.closes === 'all'" class="audit-reason__closes">Closes</span>
                <span v-else class="audit-reason__level">
                  <span
                    v-if="reason.closes === 'some'"
                    class="audit-reason__closes"
                    :data-testid="`audit-settings-reason-closes-${reason.conclusion}`"
                  >Closes on {{ reason.closesOn }} of {{ reason.checks }} checks</span>
                  <button
                    type="button"
                    class="audit-reason__priority audit-level"
                    :aria-label="`${reason.label} priority: ${reason.priority ? levelWords(reason.priority) : sameAs(editingStatement)}`"
                    :data-testid="`audit-settings-reason-priority-${reason.conclusion}`"
                    :disabled="saving"
                    @click="openReasonPriority(reason)"
                  >
                    <template v-if="reason.priority">
                      <AuditPriorityMark :level="reason.priority" />
                      <span class="audit-level__word">{{ LEVEL_WORD[reason.priority] }}</span>
                    </template>
                    <span v-else class="audit-level__word">{{ sameAs(editingStatement) }}</span>
                  </button>
                </span>
              </li>
            </ul>
          </div>
        </WorkflowStepForm>

        <!-- DAR-UI-140: how soon a broken statement must be fixed, or (from its popup) one reason's own level. -->
        <WorkflowStepForm
          v-else-if="(popup === 'priority' || (popup === 'reasonPriority' && editingReason)) && editingStatement"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          :question="`How soon must a broken ${editingStatement.code} be fixed?`"
          primary-label="Save"
          primary-action-variant="save"
          :primary-test-id="popup === 'priority' ? 'audit-settings-priority-save' : 'audit-settings-reason-priority-save'"
          :submit-disabled="saving"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          :cancel-test-id="popup === 'priority' ? 'audit-settings-priority-cancel' : 'audit-settings-reason-priority-cancel'"
          @cancel="closePopup"
          @submit="void saveLevel()"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="audit-settings-popup-error" />
          <ul class="audit-levels" role="radiogroup" :aria-label="popupTitle">
            <li v-for="option in levelOptions" :key="option.key">
              <button
                type="button"
                role="radio"
                class="audit-levels__option audit-level"
                :aria-checked="levelDraft === option.level ? 'true' : 'false'"
                :data-testid="`audit-settings-level-${option.key}`"
                :disabled="saving"
                @click="levelDraft = option.level"
              >
                <template v-if="option.level">
                  <AuditPriorityMark :level="option.level" />
                  <span class="audit-level__word">{{ LEVEL_WORD[option.level] }}</span>
                </template>
                <span v-else class="audit-level__word">{{ sameAs(editingStatement) }}</span>
              </button>
            </li>
          </ul>
        </WorkflowStepForm>

        <!-- DAR-UI-064: a check added to this statement, in today's editor; saving or cancelling returns to the statement. -->
        <WorkflowStepForm
          v-else-if="popup === 'check' && editingStatement"
          class="workflow-form--popup-compact workflow-form--edit-single-page"
          question="Which run checks it?"
          :show-primary-action="false"
        >
          <AuditCheckEditor
            :audit="auditCode"
            :statement="editingStatement.code"
            @saved="void checkAdded()"
            @cancel="popup = 'statement'"
          />
        </WorkflowStepForm>

        <!-- DAR-UI-078: a new statement, saved on its own so a check can be added to it. -->
        <WorkflowStepForm
          v-else-if="popup === 'newStatement'"
          class="workflow-form--popup-compact workflow-form--edit-single-page workflow-form--dense-popup"
          data-testid="audit-settings-new-statement"
          question="What must be true?"
          primary-label="Save"
          primary-action-variant="save"
          primary-test-id="audit-settings-new-save"
          :submit-disabled="saving || !newForm.text.trim()"
          :show-enter-hint="false"
          show-cancel-action
          :cancel-disabled="saving"
          cancel-test-id="audit-settings-new-cancel"
          @cancel="closePopup"
          @submit="void addStatement()"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" data-testid="audit-settings-popup-error" />
          <textarea
            v-model="newForm.text"
            class="wizard-answer-control workflow-form-textarea"
            rows="3"
            aria-label="New statement"
            data-testid="audit-settings-new-text"
            :disabled="saving"
            @keydown.enter.exact.prevent="void addStatement()"
          />
          <div class="audit-popup-pair">
            <label class="wizard-input-shell">
              <span v-explain="'auditStatementCategory'" class="workflow-context-label">Category</span>
              <AppSelect v-model="newForm.category" test-id="audit-settings-new-category" :options="categoryOptions" :disabled="saving" />
            </label>
            <label class="wizard-input-shell">
              <span v-explain="'auditStatementWeight'" class="workflow-context-label">Weight</span>
              <AppSelect v-model="newForm.weight" test-id="audit-settings-new-weight" :options="weightOptions" :disabled="saving" />
            </label>
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import AuditCheckEditor from '../../components/audit/AuditCheckEditor.vue'
import AuditPriorityMark from '../../components/audit/AuditPriorityMark.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import StaticFactStrip, { type StaticFact } from '../../components/ui/StaticFactStrip.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticRecordTitle from '../../components/ui/StaticRecordTitle.vue'
import WorkflowChipTextInput from '../../components/workflow/WorkflowChipTextInput.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowTimeSelect from '../../components/workflow/WorkflowTimeSelect.vue'
import { auditFacade, settingsFacade } from '../../lib/api/facade'
import type { TenantChatSpace } from '../../lib/api/types'
import { auditMorningQuery } from '../../lib/auditReport'
import {
  AUDIT_LEVELS, LEVEL_LABEL, LEVEL_WORD,
  type AuditLevel, type AuditSettings, type AuditSettingsCheck, type AuditSettingsReason, type AuditSettingsStatement, type SaveAuditSettingsPayload,
} from '../../lib/api/auditTypes'
import { backIconPath } from '../../lib/iconPaths'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../lib/savedRunEditorRoute'
import { twelveHourTime } from '../../lib/scriptDeployment'
import { buildTimezoneOptions } from '../../lib/timezones'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { useAuthStore } from '../../stores/auth'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

// DAR-UI-063. The audit page's settings gear: the audit's name, the daily schedule of every check it runs, the update
// after each run, and each statement's text and on/off, with a way from each check to its run's rules. DAR-UI-078: also
// where a new audit gets its statements. DAR-UI-127: a static page with the settings-page header (DAR-UI-126); the name
// saves on Enter or blur, each toggle at once, and each popup saves what it holds, all through save#AuditSettings.
// DAR-UI-140: a statement's level from its row, and a reason's own level from the statement's popup.
type Popup = 'schedule' | 'email' | 'space' | 'statement' | 'check' | 'newStatement' | 'priority' | 'reasonPriority'

const route = useRoute()
const router = useRouter()
const draftStore = useReconciliationDraftStore()
const authStore = useAuthStore()
const auditCode = computed(() => String(route.params.audit ?? ''))

const settings = ref<AuditSettings | null>(null)
const nameDraft = ref('')
const chatSpaces = ref<TenantChatSpace[]>([])
// Only a list that loaded can say a space is gone; a failed load says nothing about it.
const chatSpacesLoaded = ref(false)
const saving = ref(false)
const opening = ref(false)
const error = ref<string | null>(null)

const popup = ref<Popup | null>(null)
const popupError = ref<string | null>(null)
const scheduleForm = ref({ time: '', timeZone: '' })
const emailForm = ref<{ active: boolean; alsoSendTo: string[] }>({ active: false, alsoSendTo: [] })
const addressError = ref<string | null>(null)
const alsoSendToInput = ref<InstanceType<typeof WorkflowChipTextInput> | null>(null)
// DAR-UI-111. The space that gets the run's summary card; '' is none.
const spaceForm = ref('')
const editingStatementId = ref<string | null>(null)
const statementText = ref('')
const editingReasonConclusion = ref<string | null>(null)
// The level picked in the priority popups; null is a reason's "Same as" its statement.
const levelDraft = ref<AuditLevel | null>(null)
const newForm = ref({ text: '', category: 'orders', weight: 'derived' })

const categoryOptions = [
  { value: 'orders', label: 'Orders' },
  { value: 'refundsAndCredits', label: 'Refunds and credits' },
  { value: 'returns', label: 'Returns' },
  { value: 'exchangesAndWarranty', label: 'Exchanges and warranty' },
]
const weightOptions = [
  { value: 'derived', label: 'Derived' },
  { value: 'firm', label: 'Firm' },
]

const timezoneOptions = computed(() => buildTimezoneOptions(scheduleForm.value.timeZone))
const editingStatement = computed(() => settings.value?.statements.find((statement) => statement.id === editingStatementId.value) ?? null)
const editingReason = computed(() => editingStatement.value?.reasons?.find((reason) => reason.conclusion === editingReasonConclusion.value) ?? null)

// DAR-UI-140. A statement with no level reads P2, as the backend reads it.
function levelOf(statement: AuditSettingsStatement): AuditLevel {
  return statement.priority ?? 'P2'
}
function levelWords(level: AuditLevel): string {
  return `${LEVEL_LABEL[level]} ${LEVEL_WORD[level]}`
}
function sameAs(statement: AuditSettingsStatement): string {
  return `Same as ${statement.code}`
}
const levelOptions = computed(() => {
  const levels = AUDIT_LEVELS.map((level) => ({ key: level as string, level: level as AuditLevel | null }))
  return popup.value === 'reasonPriority' ? [{ key: 'same', level: null }, ...levels] : levels
})

// DAR-BE-207. A simple shape check; the backend has the last word and names any address it refuses.
function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
// Absent on a backend that does not say: editable, as before.
const canEditRunEmail = computed(() => settings.value?.runEmail?.canEdit !== false)

function people(count: number): string {
  return `${count} ${count === 1 ? 'person' : 'people'}`
}
const membersLine = computed(() => {
  const members = settings.value?.runEmail?.members ?? 0
  const tenant = authStore.sessionInfo?.activeTenantLabel
  return `Sent to the ${people(members)} with access${tenant ? ` to ${tenant}` : ''}`
})

// DAR-UI-111. None and the tenant's active spaces; the saved one stays listed even when it is off or the list did not load.
function chatSpaceLabel(id: string): string {
  if (!id) return 'None'
  return chatSpaces.value.find((space) => space.chatSpaceId === id)?.spaceName || id
}
const chatSpaceOptions = computed(() => {
  const options = [
    { value: '', label: 'None' },
    ...chatSpaces.value.filter((space) => space.isActive !== 'N').map((space) => ({ value: space.chatSpaceId, label: space.spaceName })),
  ]
  const saved = settings.value?.runEmail?.chatSpaceId
  if (saved && !options.some((option) => option.value === saved)) options.push({ value: saved, label: chatSpaceLabel(saved) })
  return options
})

// DAR-BE-256. The run's sender drops the card without a word when its space is gone (or another tenant's), off, or
// has nowhere to post, so the page says so: for the saved space on the page, for the picked one in its popup.
function spaceProblem(id: string): string {
  if (!id || !chatSpacesLoaded.value) return ''
  const space = chatSpaces.value.find((candidate) => candidate.chatSpaceId === id)
  if (!space) return 'This chat space no longer exists, so no card is sent.'
  if (space.isActive === 'N') return 'This chat space is turned off, so no card is sent.'
  if (space.webhookConfigured === false) return 'This chat space has no webhook or Slack channel, so no card is sent.'
  return ''
}
const savedSpaceProblem = computed(() => spaceProblem(settings.value?.runEmail?.chatSpaceId ?? ''))
const pickedSpaceProblem = computed(() => spaceProblem(spaceForm.value))

function checksWords(count: number): string {
  if (!count) return 'No checks'
  return `${count} ${count === 1 ? 'check' : 'checks'}`
}

// The header strip (DAR-UI-126). Schedule is anyone's to change here; the update after each run is a tenant admin's.
const facts = computed<StaticFact[]>(() => {
  const current = settings.value
  if (!current) return []
  const { schedule, runEmail, statements } = current
  const time = schedule.time ? twelveHourTime(schedule.time) : ''
  const scheduleText = schedule.active ? `Daily at ${time}` : `Off · ${time}`
  const list: StaticFact[] = [
    { key: 'schedule', label: 'Schedule', value: scheduleText, sub: schedule.timeZone, explain: 'auditScheduleTime',
      interactive: true, disabled: saving.value, ariaLabel: `Audit schedule: ${scheduleText}`, testId: 'audit-settings-fact-schedule' },
  ]
  if (runEmail) {
    const extra = runEmail.alsoSendTo.length
    const emailText = runEmail.active ? `Email to ${people(runEmail.members)}${extra ? ` + ${extra} more` : ''}` : 'Off'
    const spaceText = chatSpaceLabel(runEmail.chatSpaceId ?? '')
    list.push(
      { key: 'email', label: 'After each run', value: emailText, explain: 'auditRunEmail', interactive: canEditRunEmail.value,
        disabled: saving.value, ariaLabel: `After each run: ${emailText}`, testId: 'audit-settings-fact-after-run' },
      { key: 'space', label: 'Posts to', value: spaceText, explain: 'auditPostsTo', interactive: canEditRunEmail.value,
        disabled: saving.value, ariaLabel: `Audit posts to: ${spaceText}`, testId: 'audit-settings-fact-posts-to' },
    )
  }
  const on = statements.filter((statement) => statement.active).length
  list.push({ key: 'statements', label: 'Statements', value: `${on} of ${statements.length} on`, explain: 'auditStatements',
    testId: 'audit-settings-fact-statements' })
  return list
})

const popupTitle = computed(() => {
  switch (popup.value) {
    case 'schedule': return 'Schedule'
    case 'email': return 'After each run'
    case 'space': return 'Posts to'
    case 'statement':
    case 'check': return `Statement ${editingStatement.value?.code ?? ''}`
    case 'priority': return `Priority · ${editingStatement.value?.code ?? ''}`
    case 'reasonPriority': return editingReason.value?.label ?? ''
    case 'newStatement': return 'New statement'
    default: return ''
  }
})

const abort = new AbortController()

// Back to the audit, on the morning it was showing.
const auditRoute = computed(() => ({ name: 'audit-report', params: { audit: auditCode.value }, query: auditMorningQuery(route.query) }))

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught)
}

function show(next: AuditSettings) {
  settings.value = { ...next, statements: next.statements.map((statement) => ({ ...statement, checks: [...statement.checks] })) }
  nameDraft.value = next.audit.name
}

/** What a save changed, applied here when the answer carries no settings. */
function applyLocally(change: Omit<SaveAuditSettingsPayload, 'audit'>) {
  const was = settings.value
  if (!was) return
  const statements = was.statements.map((statement) => {
    const edit = change.statements?.find((candidate) => candidate.id === statement.id)
    const reasonEdits = change.reasons?.filter((candidate) => candidate.statement === statement.id) ?? []
    // DAR-UI-140: a null priority clears a saved level, and a cleared statement reads P2, as the backend reads it.
    const next = edit ? { ...statement, ...edit, priority: 'priority' in edit ? (edit.priority ?? 'P2') : statement.priority } : statement
    if (!reasonEdits.length || !next.reasons) return next
    const reasons = next.reasons.map((reason) => {
      const reasonEdit = reasonEdits.find((candidate) => candidate.conclusion === reason.conclusion)
      return reasonEdit ? { ...reason, priority: reasonEdit.priority } : reason
    })
    return { ...next, reasons }
  })
  show({
    ...was,
    audit: change.name ? { ...was.audit, name: change.name } : was.audit,
    schedule: change.schedule ? { ...was.schedule, ...change.schedule } : was.schedule,
    runEmail: change.runEmail && was.runEmail ? { ...was.runEmail, ...change.runEmail } : was.runEmail,
    statements,
  })
}

/** One save, scoped to what changed. A failure is said where it was made: in the popup, or on the page. */
async function persist(change: Omit<SaveAuditSettingsPayload, 'audit'>, where: 'page' | 'popup'): Promise<boolean> {
  if (saving.value || !settings.value) return false
  saving.value = true
  error.value = null
  popupError.value = null
  const fail = (text: string) => {
    if (where === 'popup') popupError.value = text
    else error.value = text
  }
  try {
    const response = await auditFacade.saveAuditSettings({ audit: auditCode.value, ...change })
    if (response?.ok === false) {
      fail(response.errors?.[0] || 'The audit was not saved.')
      return false
    }
    if (response?.settings) show(response.settings)
    else applyLocally(change)
    return true
  } catch (caught) {
    fail(message(caught))
    return false
  } finally {
    saving.value = false
  }
}

async function commitName(value: string) {
  const was = settings.value?.audit.name ?? ''
  const next = value.trim()
  if (!next || next === was) {
    nameDraft.value = was
    return
  }
  if (!(await persist({ name: next }, 'page'))) nameDraft.value = settings.value?.audit.name ?? was
}

async function setScheduleActive(active: boolean) {
  const schedule = settings.value?.schedule
  if (!schedule) return
  await persist({ schedule: { active, time: schedule.time, timeZone: schedule.timeZone } }, 'page')
}

async function setStatementActive(statement: AuditSettingsStatement, active: boolean) {
  await persist({ statements: [{ id: statement.id, active }] }, 'page')
}

function openPopup(next: Popup) {
  if (saving.value) return
  popupError.value = null
  addressError.value = null
  popup.value = next
}

function closePopup() {
  if (saving.value) return
  // The check editor and a reason's level go back to their statement; every other popup closes.
  if (popup.value === 'check' || popup.value === 'reasonPriority') {
    popup.value = 'statement'
    popupError.value = null
    return
  }
  popup.value = null
  popupError.value = null
  addressError.value = null
}

function openFact(key: string) {
  const current = settings.value
  if (!current) return
  if (key === 'schedule') {
    scheduleForm.value = { time: current.schedule.time, timeZone: current.schedule.timeZone }
    openPopup('schedule')
  } else if (key === 'email' && current.runEmail && canEditRunEmail.value) {
    emailForm.value = { active: current.runEmail.active, alsoSendTo: [...current.runEmail.alsoSendTo] }
    openPopup('email')
  } else if (key === 'space' && current.runEmail && canEditRunEmail.value) {
    spaceForm.value = current.runEmail.chatSpaceId ?? ''
    openPopup('space')
  }
}

async function saveSchedule() {
  const schedule = settings.value?.schedule
  const { time, timeZone } = scheduleForm.value
  if (!schedule || !time) return
  if (time !== schedule.time || timeZone !== schedule.timeZone) {
    if (!(await persist({ schedule: { active: schedule.active, time, timeZone } }, 'popup'))) return
  }
  closePopup()
}

async function saveEmail() {
  const email = settings.value?.runEmail
  if (!email || saving.value) return
  // An address still being typed joins the list, not dropped; one that is not an address stops the save.
  if (alsoSendToInput.value && !alsoSendToInput.value.commitPendingValue()) return
  const { active, alsoSendTo } = emailForm.value
  if (active !== email.active || alsoSendTo.join('\n') !== email.alsoSendTo.join('\n')) {
    const runEmail = { active, alsoSendTo: [...alsoSendTo], chatSpaceId: email.chatSpaceId || null }
    if (!(await persist({ runEmail }, 'popup'))) return
  }
  closePopup()
}

async function saveSpace() {
  const email = settings.value?.runEmail
  if (!email) return
  if (spaceForm.value !== (email.chatSpaceId ?? '')) {
    const runEmail = { active: email.active, alsoSendTo: [...email.alsoSendTo], chatSpaceId: spaceForm.value || null }
    if (!(await persist({ runEmail }, 'popup'))) return
  }
  closePopup()
}

function openStatement(statement: AuditSettingsStatement) {
  editingStatementId.value = statement.id
  statementText.value = statement.text
  openPopup('statement')
}

async function saveStatement() {
  const statement = editingStatement.value
  const text = statementText.value.trim()
  if (!statement || !text || saving.value) return
  if (text !== statement.text && !(await persist({ statements: [{ id: statement.id, text }] }, 'popup'))) return
  closePopup()
}

// DAR-UI-140. A statement's level opens from its row; a reason's replaces the statement's popup and returns to it.
function openPriority(statement: AuditSettingsStatement) {
  editingStatementId.value = statement.id
  levelDraft.value = levelOf(statement)
  openPopup('priority')
}

function openReasonPriority(reason: AuditSettingsReason) {
  if (reason.closes === 'all') return
  editingReasonConclusion.value = reason.conclusion
  levelDraft.value = reason.priority
  openPopup('reasonPriority')
}

async function saveLevel() {
  const statement = editingStatement.value
  if (!statement || saving.value) return
  if (popup.value === 'priority') {
    const level = levelDraft.value ?? 'P2'
    if (level !== levelOf(statement) && !(await persist({ statements: [{ id: statement.id, priority: level }] }, 'popup'))) return
  } else {
    const reason = editingReason.value
    if (!reason) return
    const change = { reasons: [{ statement: statement.id, conclusion: reason.conclusion, priority: levelDraft.value }] }
    if (levelDraft.value !== reason.priority && !(await persist(change, 'popup'))) return
  }
  closePopup()
}

// DAR-UI-064: after a check is added, the settings are read again for its statement's list, and the statement's
// popup comes back with whatever was typed in it.
async function checkAdded() {
  popup.value = 'statement'
  try {
    const response = await auditFacade.getAuditSettings({ audit: auditCode.value }, abort.signal)
    if (response.settings) show(response.settings)
  } catch (caught) {
    if (!abort.signal.aborted) popupError.value = message(caught)
  }
}

// DAR-UI-078: a new statement is saved on its own, at once, and joins the list as saved. Enter saves it (Shift+Enter
// is a new line); an audit with no statements opens with this popup ready, as that is its next step.
function openNewStatement() {
  newForm.value = { text: '', category: 'orders', weight: 'derived' }
  openPopup('newStatement')
}

async function addStatement() {
  const current = settings.value
  const text = newForm.value.text.trim()
  if (saving.value || !text || !current) return
  saving.value = true
  popupError.value = null
  try {
    const response = await auditFacade.addAuditStatement({ audit: auditCode.value, text,
      category: newForm.value.category, weight: newForm.value.weight as 'firm' | 'derived' })
    const added = response.statement
    if (!added) {
      popupError.value = response.errors?.[0] || 'The statement was not added.'
      return
    }
    settings.value = { ...current, statements: [...current.statements, { ...added, checks: [] }] }
    saving.value = false
    closePopup()
  } catch (caught) {
    popupError.value = message(caught)
  } finally {
    saving.value = false
  }
}

async function load() {
  error.value = null
  try {
    const response = await auditFacade.getAuditSettings({ audit: auditCode.value }, abort.signal)
    if (response.settings) {
      show(response.settings)
      if (response.settings.runEmail) void loadChatSpaces()
      if (!response.settings.statements.length) openNewStatement()
    } else error.value = response.errors?.[0] || 'Audit settings filed for an extension.'
  } catch (caught) {
    if (!abort.signal.aborted) error.value = message(caught)
  }
}

// DAR-UI-111. Spaces that fail to load leave only None and the saved one (by id); the rest of the page still works.
async function loadChatSpaces() {
  try {
    const response = await settingsFacade.listTenantChatSpaces(abort.signal)
    chatSpaces.value = response.chatSpaces ?? []
    chatSpacesLoaded.value = response.ok !== false && Array.isArray(response.chatSpaces)
  } catch {
    chatSpaces.value = []
    chatSpacesLoaded.value = false
  }
}

// As run history opens a run's settings: find the saved run, hand a rule set its draft, and go to its editor.
async function openRules(check: AuditSettingsCheck) {
  if (!check.savedRunId || opening.value) return
  opening.value = true
  popupError.value = null
  try {
    const savedRun = await resolveSavedRunEditorTarget(check.savedRunId)
    if (!savedRun) {
      popupError.value = `Run "${check.runName || check.savedRunId}" ran away. Fittingly.`
      return
    }
    draftStore.setWorkflowOrigin('Audit settings', route.fullPath)
    if (savedRun.runType === 'ruleset') {
      const draft = buildRuleSetDraft(savedRun)
      if (draft) draftStore.setRuleSetDraft(draft, 'ruleset-manager')
    }
    await router.push(buildSavedRunEditorRoute(savedRun))
  } catch (caught) {
    popupError.value = message(caught)
  } finally {
    opening.value = false
  }
}

// Esc in the check editor goes back to its statement; that popup has no Cancel of WorkflowStepForm's own to catch it.
function handleCancelRequest(event: Event) {
  if (popup.value !== 'check' || saving.value) return
  event.preventDefault()
  closePopup()
}

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  void load()
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  abort.abort()
})
</script>

<style scoped>
/* The statements as one bordered list of equal rows: the row opens the statement, its level cell opens the level, the
   switch at its end flips it. */
.audit-statements {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  overflow: hidden;
  font-size: var(--static-tile-text-size);
}

.audit-statement {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  min-height: 4.4rem;
}

.audit-statement + .audit-statement {
  border-top: 1px solid var(--static-tile-border);
}

.audit-statement__open {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr) 6rem;
  align-items: center;
  gap: var(--space-3);
  height: 100%;
  margin: 0;
  padding: var(--space-1-5) var(--space-3);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.audit-statement__open:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.audit-statement__open:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

.audit-statement__open:disabled {
  opacity: 1;
  cursor: default;
}

.audit-statement__code,
.audit-statement__count {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.audit-statement__count {
  font-size: var(--type-note-size);
  text-align: right;
}

/* Two lines at most, so every row stays the same height. */
.audit-statement__text {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.audit-statement--off .audit-statement__text {
  color: var(--text-muted);
}

.audit-statement__toggle {
  margin-right: var(--space-3);
}

/* DAR-UI-140. A level: its mark, then its word. As a button it is the whole cell, tinted on hover like a fact. */
.audit-level {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1-5);
  margin: 0;
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.audit-level:hover:not(:disabled) {
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.audit-level:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent) 68%, transparent);
  outline-offset: -2px;
}

.audit-level:disabled {
  opacity: 1;
  cursor: default;
}

.audit-level__word {
  color: var(--text-muted);
  font-size: var(--type-note-size);
}

/* One width for every row's cell, so the marks line up down the list. */
.audit-statement__priority {
  width: 8rem;
  height: 100%;
  padding-inline: var(--space-3);
}

.audit-reason__level {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2);
}

.audit-reason__closes {
  flex: none;
  color: var(--text-dim);
}

.audit-reason__priority {
  min-width: 7rem;
  border-radius: var(--radius-sm);
}

.audit-levels {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.audit-levels > li + li {
  border-top: 1px solid var(--border-soft);
}

.audit-levels__option {
  width: 100%;
  min-height: 2.6rem;
}

.audit-levels__option[aria-checked='true'] {
  background: color-mix(in oklab, var(--static-tile-bg) 80%, var(--accent));
}

.audit-popup-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.audit-popup-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-soft);
}

.audit-popup-checks {
  display: grid;
  gap: var(--space-1);
}

.audit-checks {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
}

.audit-check {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 2.6rem;
  padding: var(--space-1) var(--space-2);
  font-size: var(--type-note-size);
}

.audit-check + .audit-check {
  border-top: 1px solid var(--border-soft);
}

.audit-check__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.audit-check__run,
.audit-check--none {
  color: var(--text-dim);
}

.audit-check--add {
  justify-content: flex-end;
}

/* Borderless and underlined, as the automation form's inline actions read. */
.audit-check__rules {
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text-soft);
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 0.22em;
  cursor: pointer;
}

.audit-check__rules:disabled {
  cursor: default;
  opacity: 0.6;
}

@media (max-width: 768px) {
  .audit-statement__open {
    grid-template-columns: 2.5rem minmax(0, 1fr);
  }

  .audit-statement__count {
    display: none;
  }

  .audit-statement__priority {
    width: 6.5rem;
    padding-inline: var(--space-2);
  }
}

@media (max-width: 560px) {
  .audit-popup-pair {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
