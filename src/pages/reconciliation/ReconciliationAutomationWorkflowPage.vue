<template>
  <WorkflowPage
    :class="{ 'static-page-frame--popup-open': addSpaceOpen }"
    :progress-percent="progressPercent"
    aria-label="Automation setup progress"
    center-stage
    :edit-surface="isEditMode"
  >
    <InlineValidation v-if="pageError" tone="error" :message="pageError" />

    <WorkflowStepForm
      :class="[
        'workflow-step-shell',
        {
          'workflow-form--compact': isEditMode,
          'workflow-form--edit-single-page': isEditMode,
        },
      ]"
      :question="workflowQuestion"
      :primary-label="isEditMode || isSaveStep ? savePrimaryLabel : 'OK'"
      :primary-action-variant="isEditMode || isSaveStep ? 'save' : 'default'"
      :submit-disabled="submitDisabled"
      :show-back="!isEditMode && currentStepIndex > 0"
      :show-primary-action="showPrimaryAction"
      :show-enter-hint="!isEditMode && !isChoiceOnlyStep"
      :show-cancel-action="isEditMode"
      :cancel-disabled="saving || loadingOptions"
      cancel-test-id="cancel-automation-edit"
      :allow-select-enter="true"
      :primary-test-id="isEditMode || isSaveStep ? savePrimaryTestId : 'wizard-next'"
      @submit="handlePrimarySubmit"
      @back="goBack"
      @cancel="cancelEdit"
    >
      <div
        v-if="isEditMode"
        class="automation-edit-primary-fields"
        data-testid="automation-edit-primary-fields"
      >
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Automation Name</span>
          <input
            v-model="automationName"
            name="automationName"
            class="wizard-answer-control"
            data-testid="automation-edit-name"
            placeholder="Daily order sync"
            :disabled="fieldsDisabled"
          />
        </label>

        <!-- Read-only by design: the automation holds a SNAPSHOT of this run's config, so
             re-pointing it would leave a snapshot derived from a different run. Sync re-derives
             from the run instead. -->
        <div class="wizard-input-shell automation-edit-saved-run">
          <span class="workflow-context-label">Saved Run</span>
          <div class="automation-edit-saved-run__row">
            <span
              class="automation-edit-saved-run__name"
              data-testid="automation-edit-saved-run-name"
            >{{ selectedSavedRun?.runName ?? '—' }}</span>
            <button
              type="button"
              class="automation-edit-saved-run__sync"
              data-testid="automation-edit-sync"
              :disabled="fieldsDisabled || syncing || automationSyncStatus?.savedRunMissing"
              @click="openSyncWarning"
            >
              {{ syncing ? 'Syncing…' : 'Sync' }}
            </button>
          </div>
        </div>
      </div>

      <template v-else-if="isChoiceStep">
        <WorkflowShortcutChoiceCards
          :options="activeChoiceOptions"
          :selected-value="activeChoiceValue"
          :test-id-prefix="activeChoiceTestPrefix"
          @choose="handleChoice"
        />
      </template>

      <template v-else-if="isSelectStep">
        <label class="wizard-input-shell">
          <WorkflowSelect
            v-model="activeSelectValue"
            :test-id="activeSelectTestId"
            :disabled="loadingOptions"
            :options="activeSelectOptions"
            :placeholder="loadingOptions ? 'Loading...' : currentPlaceholder"
          />
        </label>
        <InlineValidation v-if="activeSelectError" tone="error" :message="activeSelectError" />
      </template>

      <label v-else-if="isTextStep" class="wizard-input-shell">
        <input
          :name="activeTextName"
          v-model="activeTextValue"
          :class="['wizard-answer-control', { empty: !activeTextValue.trim() }]"
          :placeholder="currentPlaceholder"
        />
      </label>

      <!-- One copy for both surfaces: the edit form shows the window while the automation reads by
           API, the wizard on its own step. The edit form labels each field; the wizard's question
           is the label there. -->
      <div
        v-if="showDateWindowFields"
        :class="['automation-date-window-fields', { 'automation-edit-date-window-fields': isEditMode }]"
        :data-testid="isEditMode ? 'automation-edit-window-fields' : undefined"
      >
        <label class="wizard-input-shell">
          <span v-if="isEditMode" class="workflow-context-label">Date Window</span>
          <WorkflowSelect
            v-model="relativeWindowTypeEnumId"
            test-id="automation-window-select"
            :disabled="fieldsDisabled"
            :options="relativeWindowOptions"
            placeholder="Select date window..."
          />
        </label>
        <label v-if="dateWindowNeedsCount" class="wizard-input-shell">
          <span v-if="isEditMode" v-explain="'automationWindowCount'" class="workflow-context-label">Count</span>
          <input
            v-model.number="relativeWindowCount"
            name="relativeWindowCount"
            class="wizard-answer-control"
            data-testid="automation-window-count-input"
            inputmode="numeric"
            :placeholder="isEditMode ? '1' : 'Count'"
            :disabled="fieldsDisabled"
          />
        </label>
        <template v-if="dateWindowUsesCustomRange">
          <label class="wizard-input-shell">
            <span v-if="isEditMode" class="workflow-context-label">Start Date</span>
            <input
              v-model="customWindowStartDate"
              name="customWindowStartDate"
              class="wizard-answer-control"
              data-testid="automation-custom-window-start"
              type="date"
              :disabled="fieldsDisabled"
            />
          </label>
          <label class="wizard-input-shell">
            <span v-if="isEditMode" class="workflow-context-label">End Date</span>
            <input
              v-model="customWindowEndDate"
              name="customWindowEndDate"
              class="wizard-answer-control"
              data-testid="automation-custom-window-end"
              type="date"
              :disabled="fieldsDisabled"
            />
          </label>
        </template>
      </div>

      <div v-if="isEditMode && usesSftp" class="workflow-form-grid workflow-form-grid--two">
        <label class="wizard-input-shell">
          <span v-explain="'automationSftpServer'" class="workflow-context-label">{{ systemLabelForSide('FILE_1') }} SFTP Server</span>
          <WorkflowSelect
            v-model="editFile1SftpServerId"
            test-id="automation-edit-file1-sftp-select"
            :disabled="fieldsDisabled"
            :options="sftpServerSelectOptions"
            placeholder="Select first SFTP server..."
          />
        </label>

        <label class="wizard-input-shell">
          <span v-explain="'automationRemotePath'" class="workflow-context-label">{{ systemLabelForSide('FILE_1') }} Remote Path</span>
          <input
            v-model="editFile1RemotePath"
            name="file1RemotePathTemplate"
            class="wizard-answer-control"
            data-testid="automation-edit-file1-remote-path"
            placeholder="/remote/source-1/orders"
            :disabled="fieldsDisabled"
          />
        </label>

        <label class="wizard-input-shell">
          <span v-explain="'automationSftpServer'" class="workflow-context-label">{{ systemLabelForSide('FILE_2') }} SFTP Server</span>
          <WorkflowSelect
            v-model="editFile2SftpServerId"
            test-id="automation-edit-file2-sftp-select"
            :disabled="fieldsDisabled"
            :options="sftpServerSelectOptions"
            placeholder="Select second SFTP server..."
          />
        </label>

        <label class="wizard-input-shell">
          <span v-explain="'automationRemotePath'" class="workflow-context-label">{{ systemLabelForSide('FILE_2') }} Remote Path</span>
          <input
            v-model="editFile2RemotePath"
            name="file2RemotePathTemplate"
            class="wizard-answer-control"
            data-testid="automation-edit-file2-remote-path"
            placeholder="/remote/source-2/orders"
            :disabled="fieldsDisabled"
          />
        </label>
      </div>

      <div
        v-if="isEditMode"
        class="automation-edit-chat-space-fields"
        data-testid="automation-edit-chat-space-fields"
      >
        <label
          class="wizard-input-shell automation-edit-active-field"
          data-testid="automation-edit-active-field"
        >
          <span v-explain="'activeFlag'" class="workflow-context-label">Status</span>
          <WorkflowSelect
            v-model="editActiveStatus"
            test-id="automation-edit-active"
            :disabled="fieldsDisabled"
            :options="activeStatusOptions"
            placeholder="Select status..."
          />
        </label>

        <div class="automation-edit-chat-space-field">
          <label class="wizard-input-shell">
            <span v-explain="'automationChatSpace'" class="workflow-context-label">Chat Space</span>
            <WorkflowSelect
              v-model="editChatSpaceValue"
              test-id="automation-chat-space-select"
              :disabled="fieldsDisabled"
              :options="editChatSpaceSelectOptions"
              placeholder="Select chat space..."
            />
          </label>
        </div>
      </div>

      <!-- One copy for both surfaces, as with the date window above. -->
      <div
        v-if="showScheduleFields"
        :class="['automation-schedule-helper', { 'automation-edit-schedule-helper': isEditMode }]"
        :data-testid="isEditMode ? 'automation-edit-schedule-fields' : undefined"
      >
        <label class="automation-schedule-field">
          <span v-explain="'automationSchedule'" class="automation-schedule-label">Run</span>
          <WorkflowSelect
            v-model="schedulePreset"
            class="automation-schedule-select"
            test-id="automation-schedule-preset"
            :disabled="fieldsDisabled"
            :options="schedulePresetOptions"
            placeholder="Select schedule..."
          />
        </label>

        <label v-if="schedulePreset === 'hourly'" class="automation-schedule-field">
          <span v-explain="'automationScheduleMinute'" class="automation-schedule-label">Minute</span>
          <input
            v-model.number="scheduleMinute"
            class="automation-schedule-control"
            data-testid="automation-schedule-minute"
            inputmode="numeric"
            max="59"
            min="0"
            type="number"
            :disabled="fieldsDisabled"
          />
        </label>

        <label v-if="schedulePreset === 'weekly'" class="automation-schedule-field">
          <span v-explain="'automationScheduleWeekday'" class="automation-schedule-label">Day</span>
          <WorkflowSelect
            v-model="scheduleWeekday"
            class="automation-schedule-select"
            test-id="automation-schedule-weekday"
            :disabled="fieldsDisabled"
            :options="scheduleWeekdayOptions"
            placeholder="Select day..."
          />
        </label>

        <label v-if="schedulePreset === 'monthly'" class="automation-schedule-field">
          <span v-explain="'automationScheduleMonthDay'" class="automation-schedule-label">Date</span>
          <input
            v-model.number="scheduleMonthDay"
            class="automation-schedule-control"
            data-testid="automation-schedule-month-day"
            inputmode="numeric"
            max="31"
            min="1"
            type="number"
            :disabled="fieldsDisabled"
          />
        </label>

        <div v-if="scheduleUsesTime" class="automation-schedule-field">
          <span v-explain="'automationScheduleTime'" class="automation-schedule-label">Time</span>
          <WorkflowTimeSelect
            v-model="scheduleTime"
            class="automation-schedule-select"
            test-id="automation-schedule-time"
            aria-label="Time"
            :disabled="fieldsDisabled"
          />
        </div>

        <label class="automation-schedule-field">
          <span class="automation-schedule-label">Timezone</span>
          <AppSelect
            v-model="scheduleTimeZone"
            class="automation-schedule-select"
            test-id="automation-schedule-timezone"
            :options="timezoneOptions"
            :disabled="fieldsDisabled"
            searchable
            search-placeholder="Search timezones"
          />
        </label>
      </div>
    </WorkflowStepForm>
  </WorkflowPage>

  <!-- DAR-UI-123. "Set up a new space" is the Notifications page's Add space flow; the space it adds comes back
       selected. Outside the page, which blurs, as the static pages render their popups. -->
  <AddChatSpaceFlow
    v-if="addSpaceOpen"
    :spaces="tenantChatSpaces"
    :allow-oauth="false"
    @added="onChatSpaceAdded"
    @close="closeAddSpace"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import WorkflowSelect, { type WorkflowSelectOption } from '../../components/workflow/WorkflowSelect.vue'
import WorkflowTimeSelect from '../../components/workflow/WorkflowTimeSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import AddChatSpaceFlow from '../../components/settings/AddChatSpaceFlow.vue'
import { reconciliationFacade, settingsFacade } from '../../lib/api/facade'
import type {
  AutomationNsRestletOption,
  AutomationRecord,
  AutomationSourceRecord,
  AutomationSyncStatus,
  AutomationSftpServerOption,
  AutomationSystemRemoteOption,
  EnumOption,
  SavedRunSummary,
  TenantChatSpace,
  UserNotificationDefault,
} from '../../lib/api/types'
import {
  AUTOMATION_WINDOW_CUSTOM,
  AUTOMATION_WINDOW_LAST_DAYS,
  AUTOMATION_WINDOW_LAST_MONTHS,
  AUTOMATION_WINDOW_LAST_WEEKS,
  AUTOMATION_WINDOW_PREVIOUS_DAY,
  AUTOMATION_WINDOW_PREVIOUS_MONTH,
  AUTOMATION_WINDOW_PREVIOUS_WEEK,
  AUTOMATION_INPUT_MODE_API_RANGE,
  AUTOMATION_INPUT_MODE_SFTP_FILES,
  automationWindowNeedsCount,
  automationWindowUsesCustomRange,
  buildDefaultAutomationName,
  buildSaveAutomationPayload,
  type ReconciliationAutomationChatSpaceChoice,
  type ReconciliationAutomationDraft,
  type ReconciliationAutomationFileSide,
  type ReconciliationAutomationIntent,
  type ReconciliationAutomationSourceDraft,
  type ReconciliationAutomationStepId,
} from '../../lib/reconciliationAutomationDraft'
import { useAuthStore } from '../../stores/auth'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'
import { useMascotStore } from '../../stores/mascot'
import { buildTimezoneOptions, normalizeTimezoneId } from '../../lib/timezones'
import { useCronExpression, SCHEDULE_WEEKDAY_OPTIONS, type SchedulePreset } from '../../composables/useCronExpression'
import { useAutomationSourceDraft, type ApiSourceSelectOption } from '../../composables/useAutomationSourceDraft'

interface WizardStep {
  id: ReconciliationAutomationStepId
}

interface SourceOptions {
  inputModes: EnumOption[]
  relativeWindows: EnumOption[]
  savedRuns: SavedRunSummary[]
  sftpServers: AutomationSftpServerOption[]
  nsRestletConfigs: AutomationNsRestletOption[]
  systemRemotes: AutomationSystemRemoteOption[]
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const draftStore = useReconciliationDraftStore()

const loadingOptions = ref(false)
const saving = ref(false)
const pageError = ref<string | null>(null)
const mascot = useMascotStore()
const automationSyncStatus = ref<AutomationSyncStatus | null>(null)
const syncing = ref(false)
const currentStepIndex = ref(0)
const handoffSavedRun = ref<SavedRunSummary | null>(null)
const automationId = ref('')
const intent = ref<ReconciliationAutomationIntent | ''>('')
const selectedSavedRunId = ref('')
// True only when the run was decided OUTSIDE this wizard: a handoff from a run page, or an
// automation being edited. The step list used to key off selectedSavedRunId itself, which meant
// any value the wizard inferred for itself — a tenant holding exactly one saved run — deleted the
// question before it was ever asked, and nothing downstream named the run either, so the operator
// scheduled a run they were never shown.
const savedRunChosenElsewhere = ref(false)
const savedRunType = ref('ruleset')
const automationName = ref('')
const inputModeEnumId = ref('')
const cron = useCronExpression()
const {
  schedulePreset,
  scheduleExpr,
  scheduleTime,
  scheduleMinute,
  scheduleWeekday,
  scheduleMonthDay,
} = cron
const relativeWindowTypeEnumId = ref('AUT_WIN_LAST_DAYS')
const relativeWindowCount = ref<number | null>(1)
const customWindowStartDate = ref('')
const customWindowEndDate = ref('')
// Blank means the automation has not pinned a zone of its own yet, so it follows the tenant's.
// Resolved through scheduleTimeZone below -- read that, never this, outside the restore paths.
const windowTimeZone = ref('')
const isActive = ref(true)

/**
 * The zone this schedule actually runs in. Deliberately the TENANT's zone and not the viewer's
 * (resolveEffectiveTimeZone prefers the user's): an automation fires once for the whole tenant, so
 * "06:00" has to mean the same moment no matter who opened the card. The backend honours this --
 * AutomationExecutionSupport resolves the stored windowTimeZone when the scanner computes the next
 * fire time -- so this is the scheduled time, not a label on top of a UTC one.
 */
const tenantTimeZone = computed(() => normalizeTimezoneId(authStore.sessionInfo?.tenantTimeZone) || '')

/**
 * Settable, but never on its own. The getter keeps the pin described above -- a stored zone always
 * wins the tenant's -- so nothing moves unless someone picks a new zone here. Read-only was the
 * original shape and it made a wrong zone PERMANENT: an automation saved before the tenant zone was
 * set reads UTC forever, and re-saving rewrote UTC, because a non-empty stored value always won the
 * fallback chain. Pinning a schedule against silent drift and letting an operator correct it are
 * separate guarantees; this keeps the first and restores the second.
 */
const scheduleTimeZone = computed({
  get: () => windowTimeZone.value || tenantTimeZone.value || 'UTC',
  set: (value: string) => {
    windowTimeZone.value = normalizeTimezoneId(value)
  },
})
const timezoneOptions = computed<AppSelectOption[]>(() => buildTimezoneOptions(scheduleTimeZone.value))

const returnLabel = ref('')
const returnPath = ref('')
const chatSpaceChoice = ref<ReconciliationAutomationChatSpaceChoice>('')
const chatSpaceId = ref('')
const addSpaceOpen = ref(false)
const userNotificationDefault = ref<UserNotificationDefault | null>(null)
const tenantChatSpaces = ref<TenantChatSpace[]>([])
// Snapshot of the automation's own linked chat space at load time, for the edit-surface
// summary line -- independent of chatSpaceChoice/chatSpaceId, which change as the user edits.
const automationChatSpaceName = ref('')
const automationChatSpaceInactive = ref(false)
const sourceOptions = ref<SourceOptions>({
  inputModes: [],
  relativeWindows: [],
  savedRuns: [],
  sftpServers: [],
  nsRestletConfigs: [],
  systemRemotes: [],
})
const selectedSavedRun = computed(() => {
  if (!selectedSavedRunId.value) return null
  if (handoffSavedRun.value?.savedRunId === selectedSavedRunId.value) return handoffSavedRun.value
  return sourceOptions.value.savedRuns.find((savedRun) => savedRun.savedRunId === selectedSavedRunId.value) ?? null
})
const savedRunSelectOptions = computed<WorkflowSelectOption[]>(() => {
  return uniqueSavedRuns([
    handoffSavedRun.value,
    ...sourceOptions.value.savedRuns,
  ]).map((savedRun) => ({
      value: savedRun.savedRunId,
      label: savedRun.runName,
  }))
})

const effectiveInputModeEnumId = computed(() => inputModeEnumId.value || deterministicInputModeEnumId())
const usesSftp = computed(() => effectiveInputModeEnumId.value === AUTOMATION_INPUT_MODE_SFTP_FILES)
const usesApi = computed(() => effectiveInputModeEnumId.value === AUTOMATION_INPUT_MODE_API_RANGE)
const sources = useAutomationSourceDraft({
  selectedSavedRunSystemOptions: computed(() => selectedSavedRun.value?.systemOptions),
  defaultFile1SystemEnumId: computed(() => selectedSavedRun.value?.defaultFile1SystemEnumId ?? undefined),
  defaultFile2SystemEnumId: computed(() => selectedSavedRun.value?.defaultFile2SystemEnumId ?? undefined),
  nsRestletConfigs: computed(() => sourceOptions.value.nsRestletConfigs),
  systemRemotes: computed(() => sourceOptions.value.systemRemotes),
  sftpServers: computed(() => sourceOptions.value.sftpServers),
  usesApi,
  usesSftp,
  setInputModeEnumId: (value: string) => {
    inputModeEnumId.value = value
  },
})
const {
  sourceDrafts,
  editFile1SftpServerId,
  editFile2SftpServerId,
  editFile1RemotePath,
  editFile2RemotePath,
  savedRunUsesOnlyApiSources,
  systemLabelForSide,
  apiSourceOptionsForSide,
  selectedApiSourceValue,
  updateSource,
  updateApiSource,
  shouldSkipApiSourceStep,
  shouldSkipSftpServerStep,
  inferApiSourcesFromSavedRun,
  inferSingleApiSourcesFromOptions,
  inferSingleSftpServerFromOptions,
  resetDrafts,
} = sources
const shouldAskInputMode = computed(() => !effectiveInputModeEnumId.value)
const routeAutomationId = computed(() => (typeof route.params.automationId === 'string' ? route.params.automationId.trim() : ''))
const isEditMode = computed(() => Boolean(routeAutomationId.value || automationId.value))
const savePrimaryLabel = computed(() => (isEditMode.value ? 'Save Automation' : 'Create Automation'))
const savePrimaryTestId = computed(() => (isEditMode.value ? 'save-automation' : 'create-automation'))
const isNewRunAutomationSetup = computed(() => intent.value === 'new-run' && Boolean(selectedSavedRunId.value))

const activeChatSpaces = computed(() => tenantChatSpaces.value.filter((space) => space.isActive !== 'N'))
const otherActiveChatSpaces = computed(() => activeChatSpaces.value.filter((space) => space.chatSpaceId !== userNotificationDefault.value?.chatSpaceId))
const chatSpaceChoiceOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const options: Array<{ value: string; label: string }> = []
  if (userNotificationDefault.value) {
    options.push({ value: 'default', label: `My default space (${userNotificationDefault.value.spaceName})` })
  }
  if (otherActiveChatSpaces.value.length > 0) {
    options.push({ value: 'existing', label: 'Choose another space' })
  }
  options.push({ value: 'new', label: 'Set up a new space' })
  options.push({ value: 'none', label: 'No notifications' })
  return options.map((option, index) => ({ ...option, shortcutKey: ['A', 'B', 'C', 'D'][index] ?? String(index + 1) }))
})
const chatSpaceSelectOptions = computed<WorkflowSelectOption[]>(() => activeChatSpaces.value.map((space) => ({
  value: space.chatSpaceId,
  label: space.spaceName,
})))

// Edit surface only: one dropdown replaces the wizard's choice-card stack (per live-review
// feedback -- the card stack read as bulky/redundant on the compact single-page edit form).
// "Set up a new space" is out of scope here; users add spaces from Notifications.
const editChatSpaceSelectOptions = computed<WorkflowSelectOption[]>(() => {
  const options = chatSpaceSelectOptions.value.slice()
  // The currently-linked space won't be in the active list if it has since gone inactive.
  // Inject it so the dropdown still shows its name as the selected value (with the note
  // below) until the user picks something else -- it is never added as a *new*, generally
  // choosable option; it only appears while it is still the live selection.
  if (chatSpaceId.value && !options.some((option) => option.value === chatSpaceId.value)) {
    options.push({ value: chatSpaceId.value, label: automationChatSpaceName.value || chatSpaceId.value })
  }
  options.push({ value: '', label: 'No notifications' })
  return options
})
const editChatSpaceValue = computed({
  get: () => chatSpaceId.value,
  set: (value: string) => {
    if (!value) {
      setChatSpaceChoice('none')
      return
    }
    chatSpaceChoice.value = 'existing'
    chatSpaceId.value = value
  },
})

const chatSpaceSteps = computed<WizardStep[]>(() => {
  const chatSpaceStepList: WizardStep[] = [{ id: 'chat-space' }]
  if (chatSpaceChoice.value === 'existing') chatSpaceStepList.push({ id: 'chat-space-select' })
  return chatSpaceStepList
})

const steps = computed<WizardStep[]>(() => {
  if (intent.value === 'new-run' && !selectedSavedRunId.value) return [{ id: 'purpose' }]

  const apiSourceSteps: WizardStep[] = []
  if (!shouldSkipApiSourceStep('FILE_1')) apiSourceSteps.push({ id: 'file1-api' })
  if (!shouldSkipApiSourceStep('FILE_2')) apiSourceSteps.push({ id: 'file2-api' })
  apiSourceSteps.push({ id: 'date-window' })
  const sftpSteps: WizardStep[] = []
  if (!shouldSkipSftpServerStep('FILE_1')) sftpSteps.push({ id: 'file1-sftp' })
  sftpSteps.push({ id: 'file1-remote-path' })
  if (!shouldSkipSftpServerStep('FILE_2')) sftpSteps.push({ id: 'file2-sftp' })
  sftpSteps.push({ id: 'file2-remote-path' })
  const sourceSteps: WizardStep[] = usesApi.value || savedRunUsesOnlyApiSources.value ? apiSourceSteps : sftpSteps

  const automationSetupSteps: WizardStep[] = [
    ...(shouldAskInputMode.value ? [{ id: 'input-mode' } as WizardStep] : []),
    ...sourceSteps,
    { id: 'schedule' },
    ...chatSpaceSteps.value,
    { id: 'automation-name' },
  ]

  return isNewRunAutomationSetup.value
    ? automationSetupSteps
    : [
        { id: 'purpose' },
        ...(savedRunChosenElsewhere.value ? [] : [{ id: 'saved-run' } as WizardStep]),
        ...automationSetupSteps,
      ]
})

const currentStep = computed<WizardStep>(() => steps.value[currentStepIndex.value] ?? steps.value[0]!)
const isSaveStep = computed(() => currentStep.value.id === 'automation-name')
const isChoiceStep = computed(() => ['purpose', 'input-mode', 'chat-space'].includes(currentStep.value.id))
const isTextStep = computed(() => ['automation-name', 'file1-remote-path', 'file2-remote-path'].includes(currentStep.value.id))
const showDateWindowFields = computed(() => (isEditMode.value ? usesApi.value : currentStep.value.id === 'date-window'))
const showScheduleFields = computed(() => isEditMode.value || currentStep.value.id === 'schedule')
const fieldsDisabled = computed(() => saving.value || loadingOptions.value)
const isChoiceOnlyStep = computed(() => isChoiceStep.value && !isSaveStep.value)
const showPrimaryAction = computed(() => isEditMode.value || !isChoiceOnlyStep.value)
const progressPercent = computed(() => ((Math.max(1, currentStepIndex.value + 1) / steps.value.length) * 100).toFixed(2))
const workflowQuestion = computed(() => (isEditMode.value ? 'Update the automation setup.' : currentQuestion.value))
const submitDisabled = computed(() => (
  isEditMode.value || isSaveStep.value
    ? !canSave.value || saving.value || loadingOptions.value
    : !canProceed.value || loadingOptions.value
))

const purposeOptions: WorkflowShortcutChoiceOption[] = [
  { value: 'existing-run', label: 'Automate an existing reconciliation', shortcutKey: 'A' },
  { value: 'new-run', label: 'Create a new reconciliation and automate it', shortcutKey: 'B' },
]
const supportedInputModeIds = [AUTOMATION_INPUT_MODE_API_RANGE, AUTOMATION_INPUT_MODE_SFTP_FILES]
const schedulePresetOptions = computed<Array<{ value: SchedulePreset; label: string }>>(() => {
  const options: Array<{ value: SchedulePreset; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'hourly', label: 'Hourly' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ]
  return schedulePreset.value === 'custom' ? [...options, { value: 'custom', label: 'Custom schedule' }] : options
})
const scheduleWeekdayOptions = SCHEDULE_WEEKDAY_OPTIONS.map((option) => ({ ...option }))
const activeStatusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]
const editActiveStatus = computed({
  get: () => (isActive.value ? 'active' : 'inactive'),
  set: (value: string) => {
    isActive.value = value !== 'inactive'
  },
})

const scheduleUsesTime = computed(() => ['daily', 'weekly', 'monthly'].includes(schedulePreset.value))

const inputModeOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const options = sourceOptions.value.inputModes.length > 0
    ? sourceOptions.value.inputModes
    : [
        { enumId: AUTOMATION_INPUT_MODE_SFTP_FILES, label: 'SFTP scheduled file pickup' },
        { enumId: AUTOMATION_INPUT_MODE_API_RANGE, label: 'API extraction' },
      ]
  return options.filter((option) => supportedInputModeIds.includes(option.enumId)).map((option, index) => ({
    value: option.enumId,
    label: inputModeLabel(option.enumId, option.label || option.description || option.enumCode || option.enumId),
    shortcutKey: ['A', 'B', 'C', 'D'][index] ?? String(index + 1),
  }))
})
const sftpServerSelectOptions = computed<WorkflowSelectOption[]>(() => sourceOptions.value.sftpServers.map((server) => ({
  value: server.sftpServerId,
  label: server.label || server.description || server.sftpServerId,
})))
function deterministicInputModeEnumId(): string {
  if (savedRunUsesOnlyApiSources.value) return AUTOMATION_INPUT_MODE_API_RANGE
  return inputModeOptions.value.length === 1 ? inputModeOptions.value[0]?.value ?? '' : ''
}

function uniqueSavedRuns(savedRuns: Array<SavedRunSummary | null>): SavedRunSummary[] {
  const seen = new Set<string>()
  return savedRuns.filter((savedRun): savedRun is SavedRunSummary => {
    if (!savedRun || seen.has(savedRun.savedRunId)) return false
    seen.add(savedRun.savedRunId)
    return true
  })
}

const relativeWindowOptions = computed<WorkflowSelectOption[]>(() => {
  const options = sourceOptions.value.relativeWindows.length > 0
    ? sourceOptions.value.relativeWindows
    : [
        { enumId: AUTOMATION_WINDOW_PREVIOUS_DAY, label: 'Previous calendar day' },
        { enumId: AUTOMATION_WINDOW_PREVIOUS_WEEK, label: 'Previous calendar week' },
        { enumId: AUTOMATION_WINDOW_PREVIOUS_MONTH, label: 'Previous month' },
        { enumId: AUTOMATION_WINDOW_LAST_DAYS, label: 'Last N days' },
        { enumId: AUTOMATION_WINDOW_LAST_WEEKS, label: 'Last N weeks' },
        { enumId: AUTOMATION_WINDOW_LAST_MONTHS, label: 'Last N months' },
        { enumId: AUTOMATION_WINDOW_CUSTOM, label: 'Custom date range' },
      ]
  return options.map((option) => ({
    value: option.enumId,
    label: relativeWindowLabel(option.enumId, option.label || option.description || option.enumCode || option.enumId),
  }))
})
const dateWindowNeedsCount = computed(() => automationWindowNeedsCount(relativeWindowTypeEnumId.value))
const dateWindowUsesCustomRange = computed(() => automationWindowUsesCustomRange(relativeWindowTypeEnumId.value))

const activeChoiceOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  switch (currentStep.value.id) {
    case 'purpose':
      return purposeOptions
    case 'input-mode':
      return inputModeOptions.value
    case 'chat-space':
      return chatSpaceChoiceOptions.value
    default:
      return []
  }
})

const activeChoiceValue = computed(() => {
  switch (currentStep.value.id) {
    case 'purpose':
      return intent.value
    case 'input-mode':
      return inputModeEnumId.value
    case 'chat-space':
      return chatSpaceChoice.value
    default:
      return ''
  }
})

const activeChoiceTestPrefix = computed(() => {
  switch (currentStep.value.id) {
    case 'purpose':
      return 'automation-purpose-choice'
    case 'input-mode':
      return 'automation-input-mode-choice'
    case 'chat-space':
      return 'automation-chat-space'
    default:
      return 'automation-choice'
  }
})

const currentQuestion = computed(() => {
  const runName = selectedSavedRun.value?.runName || 'this run'
  switch (currentStep.value.id) {
    case 'purpose':
      return 'What is this automation for?'
    case 'saved-run':
      return 'Which saved run should this automation use?'
    case 'automation-name':
      return 'What should this automation be called?'
    case 'input-mode':
      return `How will Darpan get source data for ${runName}?`
    case 'file1-sftp':
      return 'Which SFTP server provides the first file?'
    case 'file1-remote-path':
      return 'Where is the first remote file?'
    case 'file1-api':
      return `Which ${systemLabelForSide('FILE_1')} API source provides the first file?`
    case 'file2-sftp':
      return 'Which SFTP server provides the second file?'
    case 'file2-remote-path':
      return 'Where is the second remote file?'
    case 'file2-api':
      return `Which ${systemLabelForSide('FILE_2')} API source provides the second file?`
    case 'date-window':
      return 'How far back should each scheduled run reconcile?'
    case 'schedule':
      return 'When should Darpan run this automation?'
    case 'chat-space':
      return 'Where should Darpan send notifications for this automation?'
    case 'chat-space-select':
      return 'Which chat space should get notified?'
    default:
      return ''
  }
})

const isSelectStep = computed(() => ['saved-run', 'file1-sftp', 'file2-sftp', 'file1-api', 'file2-api', 'chat-space-select'].includes(currentStep.value.id))

const activeSelectOptions = computed<WorkflowSelectOption[]>(() => {
  switch (currentStep.value.id) {
    case 'saved-run':
      return savedRunSelectOptions.value
    case 'file1-sftp':
    case 'file2-sftp':
      return sftpServerSelectOptions.value
    case 'file1-api':
    case 'file2-api':
      return apiSourceOptionsForCurrentStep.value
    case 'chat-space-select':
      return chatSpaceSelectOptions.value
    default:
      return []
  }
})

const apiSourceOptionsForCurrentStep = computed<ApiSourceSelectOption[]>(() => {
  if (currentStep.value.id === 'file1-api') return apiSourceOptionsForSide('FILE_1')
  if (currentStep.value.id === 'file2-api') return apiSourceOptionsForSide('FILE_2')
  return []
})

const activeSelectTestId = computed(() => {
  switch (currentStep.value.id) {
    case 'saved-run':
      return 'automation-saved-run-select'
    case 'file1-sftp':
      return 'automation-file1-sftp-select'
    case 'file2-sftp':
      return 'automation-file2-sftp-select'
    case 'file1-api':
      return 'automation-file1-api-select'
    case 'file2-api':
      return 'automation-file2-api-select'
    case 'chat-space-select':
      return 'automation-chat-space-select'
    default:
      return 'automation-select'
  }
})

const currentPlaceholder = computed(() => {
  switch (currentStep.value.id) {
    case 'saved-run':
      return 'Select saved run...'
    case 'automation-name':
      return 'JSON Order Compare Automation'
    case 'file1-sftp':
    case 'file2-sftp':
      return 'Select SFTP server...'
    case 'file1-api':
    case 'file2-api':
      return 'Select API source...'
    case 'file1-remote-path':
      return '/remote/source-1/orders'
    case 'file2-remote-path':
      return '/remote/source-2/orders'
    case 'chat-space-select':
      return 'Select chat space...'
    default:
      return ''
  }
})

const activeSelectValue = computed({
  get: () => {
    switch (currentStep.value.id) {
      case 'saved-run':
        return selectedSavedRunId.value
      case 'file1-sftp':
        return sourceDrafts.value.FILE_1.sftpServerId ?? ''
      case 'file2-sftp':
        return sourceDrafts.value.FILE_2.sftpServerId ?? ''
      case 'file1-api':
        return selectedApiSourceValue('FILE_1')
      case 'file2-api':
        return selectedApiSourceValue('FILE_2')
      case 'chat-space-select':
        return chatSpaceId.value
      default:
        return ''
    }
  },
  set: (value: string) => {
    switch (currentStep.value.id) {
      case 'saved-run':
        selectSavedRun(value)
        applyDeterministicDefaults()
        break
      case 'file1-sftp':
        updateSource('FILE_1', { sftpServerId: value })
        break
      case 'file2-sftp':
        updateSource('FILE_2', { sftpServerId: value })
        break
      case 'file1-api':
        updateApiSource('FILE_1', value)
        break
      case 'file2-api':
        updateApiSource('FILE_2', value)
        break
      case 'chat-space-select':
        chatSpaceId.value = value
        break
    }
  },
})

const activeTextName = computed(() => {
  switch (currentStep.value.id) {
    case 'automation-name':
      return 'automationName'
    case 'file1-remote-path':
      return 'file1RemotePathTemplate'
    case 'file2-remote-path':
      return 'file2RemotePathTemplate'
    default:
      return 'automationInput'
  }
})

const activeTextValue = computed({
  get: () => {
    switch (currentStep.value.id) {
      case 'automation-name':
        return automationName.value
      case 'file1-remote-path':
        return sourceDrafts.value.FILE_1.remotePathTemplate ?? ''
      case 'file2-remote-path':
        return sourceDrafts.value.FILE_2.remotePathTemplate ?? ''
      default:
        return ''
    }
  },
  set: (value: string) => {
    switch (currentStep.value.id) {
      case 'automation-name':
        automationName.value = value
        break
      case 'file1-remote-path':
        updateSource('FILE_1', { remotePathTemplate: value })
        break
      case 'file2-remote-path':
        updateSource('FILE_2', { remotePathTemplate: value })
        break
    }
  },
})

watch([schedulePreset, scheduleTime, scheduleMinute, scheduleWeekday, scheduleMonthDay], () => {
  if (schedulePreset.value === 'custom') return
  scheduleExpr.value = cron.buildCronExpression()
}, { immediate: true })

const activeSelectError = computed(() => {
  if ((currentStep.value.id === 'file1-sftp' || currentStep.value.id === 'file2-sftp') && sourceOptions.value.sftpServers.length === 0) {
    return 'No SFTP servers are available for this tenant.'
  }
  if ((currentStep.value.id === 'file1-api' || currentStep.value.id === 'file2-api') && apiSourceOptionsForCurrentStep.value.length === 0) {
    return `No API sources are configured for ${systemLabelForCurrentApiStep()}.`
  }
  return ''
})

const canProceed = computed(() => {
  switch (currentStep.value.id) {
    case 'saved-run':
      return selectedSavedRunId.value.length > 0
    case 'automation-name':
      return automationName.value.trim().length > 0
    case 'file1-sftp':
      return !!sourceDrafts.value.FILE_1.sftpServerId && !activeSelectError.value
    case 'file1-remote-path':
      return !!sourceDrafts.value.FILE_1.remotePathTemplate?.trim()
    case 'file1-api':
      return (!!sourceDrafts.value.FILE_1.nsRestletConfigId || !!sourceDrafts.value.FILE_1.systemMessageRemoteId) && !activeSelectError.value
    case 'file2-sftp':
      return !!sourceDrafts.value.FILE_2.sftpServerId && !activeSelectError.value
    case 'file2-remote-path':
      return !!sourceDrafts.value.FILE_2.remotePathTemplate?.trim()
    case 'file2-api':
      return (!!sourceDrafts.value.FILE_2.nsRestletConfigId || !!sourceDrafts.value.FILE_2.systemMessageRemoteId) && !activeSelectError.value
    case 'date-window':
      if (!relativeWindowTypeEnumId.value) return false
      if (dateWindowNeedsCount.value) return Number(relativeWindowCount.value) > 0
      if (dateWindowUsesCustomRange.value) return Boolean(customWindowStartDate.value && customWindowEndDate.value && customWindowStartDate.value <= customWindowEndDate.value)
      return true
    case 'schedule':
      return scheduleExpr.value.trim().length > 0
    case 'chat-space-select':
      return chatSpaceId.value.length > 0
    default:
      return false
  }
})

const chatSpaceChoiceReady = computed(() => {
  if (chatSpaceChoice.value === 'existing') return Boolean(chatSpaceId.value)
  return true
})

const canSave = computed(() => {
  if (!selectedSavedRun.value || !automationName.value.trim() || !effectiveInputModeEnumId.value || !scheduleExpr.value.trim()) return false
  if (!chatSpaceChoiceReady.value) return false
  if (usesSftp.value) {
    return Boolean(
      sourceDrafts.value.FILE_1.sftpServerId &&
      sourceDrafts.value.FILE_1.remotePathTemplate?.trim() &&
      sourceDrafts.value.FILE_2.sftpServerId &&
      sourceDrafts.value.FILE_2.remotePathTemplate?.trim(),
    )
  }
  if (usesApi.value) {
    return Boolean(
      (sourceDrafts.value.FILE_1.nsRestletConfigId || sourceDrafts.value.FILE_1.systemMessageRemoteId) &&
      (sourceDrafts.value.FILE_2.nsRestletConfigId || sourceDrafts.value.FILE_2.systemMessageRemoteId),
    )
  }
  return false
})

const activeDraft = computed<ReconciliationAutomationDraft>(() => ({
  automationId: automationId.value || routeAutomationId.value || undefined,
  intent: intent.value || undefined,
  automationName: automationName.value.trim() || undefined,
  savedRunId: selectedSavedRunId.value || undefined,
  savedRunType: savedRunType.value || selectedSavedRun.value?.runType || 'ruleset',
  inputModeEnumId: effectiveInputModeEnumId.value || undefined,
  scheduleExpr: scheduleExpr.value.trim() || undefined,
  windowTimeZone: scheduleTimeZone.value,
  relativeWindowTypeEnumId: usesApi.value ? relativeWindowTypeEnumId.value || undefined : undefined,
  relativeWindowCount: usesApi.value && dateWindowNeedsCount.value ? relativeWindowCount.value ?? undefined : undefined,
  customWindowStartDate: usesApi.value && dateWindowUsesCustomRange.value ? dateStartIso(customWindowStartDate.value) : undefined,
  customWindowEndDate: usesApi.value && dateWindowUsesCustomRange.value ? dateEndIso(customWindowEndDate.value) : undefined,
  maxWindowDays: 28,
  splitWindowDays: 28,
  isActive: isActive.value,
  returnLabel: returnLabel.value || undefined,
  returnPath: returnPath.value || undefined,
  chatSpaceChoice: chatSpaceChoice.value || undefined,
  chatSpaceId: chatSpaceId.value || undefined,
  sources: {
    FILE_1: sourceDrafts.value.FILE_1,
    FILE_2: sourceDrafts.value.FILE_2,
  },
}))

function inputModeLabel(enumId: string, fallback: string): string {
  if (enumId === AUTOMATION_INPUT_MODE_SFTP_FILES) return 'SFTP scheduled file pickup'
  if (enumId === AUTOMATION_INPUT_MODE_API_RANGE) return 'API extraction'
  return fallback
}

function relativeWindowLabel(enumId: string, fallback: string): string {
  const labels: Record<string, string> = {
    [AUTOMATION_WINDOW_PREVIOUS_DAY]: 'Previous day',
    [AUTOMATION_WINDOW_PREVIOUS_WEEK]: 'Previous week',
    [AUTOMATION_WINDOW_PREVIOUS_MONTH]: 'Previous month',
    [AUTOMATION_WINDOW_LAST_DAYS]: 'Last N days',
    [AUTOMATION_WINDOW_LAST_WEEKS]: 'Last N weeks',
    [AUTOMATION_WINDOW_LAST_MONTHS]: 'Last N months',
    [AUTOMATION_WINDOW_CUSTOM]: 'Custom range',
  }
  return labels[enumId] ?? fallback
}

function systemLabelForCurrentApiStep(): string {
  if (currentStep.value.id === 'file1-api') return systemLabelForSide('FILE_1')
  if (currentStep.value.id === 'file2-api') return systemLabelForSide('FILE_2')
  return 'this system'
}

function selectSavedRun(savedRunId: string): void {
  selectedSavedRunId.value = savedRunId
  savedRunType.value = selectedSavedRun.value?.runType || 'ruleset'
}

/** Pre-fill, not pre-empt: with one saved run the picker is a formality, so it opens already
 *  answered — but the step still shows, because "which run am I automating?" is the one fact the
 *  rest of this wizard is about (see savedRunChosenElsewhere). */
function inferSingleSavedRun(): void {
  if (selectedSavedRunId.value || intent.value !== 'existing-run') return
  const onlySavedRun = sourceOptions.value.savedRuns.length === 1 ? sourceOptions.value.savedRuns[0] : null
  if (!onlySavedRun) return
  selectSavedRun(onlySavedRun.savedRunId)
}

function applyDeterministicDefaults(): void {
  inferSingleSavedRun()
  if (!inputModeEnumId.value && effectiveInputModeEnumId.value) inputModeEnumId.value = effectiveInputModeEnumId.value
  inferApiSourcesFromSavedRun()
  inferSingleApiSourcesFromOptions()
  inferSingleSftpServerFromOptions()
  ensureAutomationName()
}

function dateStartIso(value: string): string | undefined {
  return value ? `${value}T00:00:00.000Z` : undefined
}

function dateEndIso(value: string): string | undefined {
  if (!value) return undefined
  const endDate = new Date(`${value}T00:00:00.000Z`)
  endDate.setUTCDate(endDate.getUTCDate() + 1)
  return endDate.toISOString()
}

function previousDateValue(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  parsed.setUTCDate(parsed.getUTCDate() - 1)
  return parsed.toISOString().slice(0, 10)
}

function dateInputValue(value: string | undefined): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

function ensureAutomationName(): void {
  if (automationName.value.trim() || !selectedSavedRun.value) return
  automationName.value = buildDefaultAutomationName(selectedSavedRun.value.runName)
}

function advance(): void {
  currentStepIndex.value = Math.min(currentStepIndex.value + 1, steps.value.length - 1)
}

function settleOnCurrentIndex(): void {
  currentStepIndex.value = Math.min(currentStepIndex.value, steps.value.length - 1)
}

function moveToStep(stepId: ReconciliationAutomationStepId | null): void {
  if (!stepId) return
  const index = steps.value.findIndex((step) => step.id === stepId)
  currentStepIndex.value = index >= 0 ? index : 0
}

function goBack(): void {
  pageError.value = null
  currentStepIndex.value = Math.max(currentStepIndex.value - 1, 0)
}

function resolveActiveChoiceByKey(key: string): string | null {
  const normalizedKey = key.trim().toLowerCase()
  if (!normalizedKey) return null

  const matchedOption = activeChoiceOptions.value.find((option) => option.shortcutKey.toLowerCase() === normalizedKey)
  return matchedOption?.value ?? null
}

function handleChoiceKeydown(event: KeyboardEvent): void {
  if (!isChoiceStep.value || loadingOptions.value || addSpaceOpen.value) return
  if (event.defaultPrevented || event.repeat || event.isComposing) return
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

  const matchedChoice = resolveActiveChoiceByKey(event.key)
  if (!matchedChoice) return

  event.preventDefault()
  void handleChoice(matchedChoice)
}

function setChatSpaceChoice(value: string): void {
  const choice: ReconciliationAutomationChatSpaceChoice =
    value === 'default' || value === 'existing' || value === 'none' ? value : ''
  chatSpaceChoice.value = choice
  if (choice === 'default') {
    chatSpaceId.value = userNotificationDefault.value?.chatSpaceId ?? ''
  } else if (choice === 'none') {
    chatSpaceId.value = ''
  }
}

async function handleChoice(value: string): Promise<void> {
  pageError.value = null
  if (currentStep.value.id === 'purpose') {
    intent.value = value === 'new-run' ? 'new-run' : 'existing-run'
    if (intent.value === 'new-run') {
      await openReconciliationCreateWorkflow()
      return
    }
    applyDeterministicDefaults()
    advance()
    return
  }

  if (currentStep.value.id === 'input-mode') {
    inputModeEnumId.value = value
    resetDrafts()
    applyDeterministicDefaults()
    settleOnCurrentIndex()
    return
  }

  if (currentStep.value.id === 'chat-space') {
    if (value === 'new') {
      addSpaceOpen.value = true
      return
    }
    setChatSpaceChoice(value)
    advance()
    return
  }
}

/** The added space comes back selected, as though it had been picked from the list. */
function onChatSpaceAdded(space: TenantChatSpace): void {
  tenantChatSpaces.value = [...tenantChatSpaces.value.filter((existing) => existing.chatSpaceId !== space.chatSpaceId), space]
  chatSpaceChoice.value = 'existing'
  chatSpaceId.value = space.chatSpaceId
}

function closeAddSpace(): void {
  addSpaceOpen.value = false
  // Added: past both chat-space cards to the name. Cancelled: still on the chat-space card.
  if (chatSpaceChoice.value === 'existing' && chatSpaceId.value) moveToStep('automation-name')
}

async function handlePrimarySubmit(): Promise<void> {
  if (isEditMode.value || isSaveStep.value) {
    await saveAutomationSetup()
    return
  }
  if (!canProceed.value) return
  if (currentStep.value.id === 'saved-run') {
    // Answering this can delete steps further down (API sources the chosen run already fixes), so
    // settle the index against the new list before stepping forward. This step used to delete
    // ITSELF on answer — hence the bare return — which is no longer true.
    applyDeterministicDefaults()
    settleOnCurrentIndex()
    advance()
    return
  }
  advance()
}

async function openReconciliationCreateWorkflow(): Promise<void> {
  const origin = draftStore.workflowOrigin
  returnLabel.value = origin?.label ?? returnLabel.value
  returnPath.value = origin?.path ?? returnPath.value
  draftStore.setAutomationDraft(activeDraft.value, 'input-mode')
  draftStore.setWorkflowOrigin('Automation Setup', '/reconciliation/automation/create')
  await router.push({
    path: '/reconciliation/create',
    query: { automationFlow: 'new-run' },
  })
}

const pageAbortController = new AbortController()
let submitController: AbortController | null = null

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleChoiceKeydown)
  pageAbortController.abort()
  submitController?.abort()
  // The dock also drops on route change; this covers an unmount that is not a navigation.
  for (const id of [
    'automation-drift',
    'automation-saved-run-missing',
    'automation-chat-space-inactive',
    'automation-sync-confirm',
  ]) mascot.drop(id)
})

async function saveAutomationSetup(): Promise<void> {
  if (!selectedSavedRun.value || !canSave.value || saving.value) return
  saving.value = true
  pageError.value = null

  submitController?.abort()
  submitController = new AbortController()
  const submitSignal = submitController.signal

  try {
    const response = await reconciliationFacade.saveAutomation(buildSaveAutomationPayload(activeDraft.value, selectedSavedRun.value), submitSignal)
    const origin = draftStore.workflowOrigin
    const savedAutomationId = response.automation?.automationId || activeDraft.value.automationId
    const fallbackRoute = savedAutomationId
      ? { name: 'reconciliation-automation-dashboard', params: { automationId: savedAutomationId } }
      : { name: 'hub' }
    await router.push(activeDraft.value.returnPath || origin?.path || fallbackRoute)
  } catch (saveError) {
    if ((saveError as { name?: string })?.name === 'AbortError') return
    pageError.value = 'The automation setup slipped through our fingers. The saved run is still available; adjust the automation settings and retry.'
  } finally {
    saving.value = false
  }
}

async function cancelEdit(): Promise<void> {
  if (!isEditMode.value || saving.value || loadingOptions.value) return

  const origin = draftStore.workflowOrigin
  const selectedAutomationId = activeDraft.value.automationId || routeAutomationId.value
  if (origin?.path) {
    await router.push(origin.path)
    return
  }
  if (selectedAutomationId) {
    await router.push({
      name: 'reconciliation-automation-dashboard',
      params: { automationId: selectedAutomationId },
    })
    return
  }
  await router.push('/reconciliation/automations')
}

function sourceDraftFromRecord(source: AutomationSourceRecord): ReconciliationAutomationSourceDraft {
  return {
    sourceTypeEnumId: source.sourceTypeEnumId,
    sftpServerId: source.sftpServerId,
    nsRestletConfigId: source.nsRestletConfigId,
    systemMessageRemoteId: source.systemMessageRemoteId,
    remotePathTemplate: source.remotePathTemplate,
    fileNamePattern: source.fileNamePattern,
    apiRequestTemplateJson: source.apiRequestTemplateJson,
    apiResponsePathExpression: source.apiResponsePathExpression,
    dateFromParameterName: source.dateFromParameterName,
    dateToParameterName: source.dateToParameterName,
    safeMetadataJson: source.safeMetadataJson,
  }
}

function sourceDraftsFromAutomation(automation: AutomationRecord): Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft> {
  const drafts: Record<ReconciliationAutomationFileSide, ReconciliationAutomationSourceDraft> = {
    FILE_1: {},
    FILE_2: {},
  }
  automation.sources?.forEach((source) => {
    if (source.fileSide === 'FILE_1' || source.fileSide === 'FILE_2') {
      drafts[source.fileSide] = sourceDraftFromRecord(source)
    }
  })
  return drafts
}

function hydrateAutomation(automation: AutomationRecord): void {
  automationId.value = automation.automationId
  intent.value = 'existing-run'
  selectedSavedRunId.value = automation.savedRunId ?? ''
  savedRunChosenElsewhere.value = true
  savedRunType.value = automation.savedRunType ?? automation.savedRun?.runType ?? 'ruleset'
  automationName.value = automation.automationName ?? ''
  inputModeEnumId.value = automation.inputModeEnumId ?? ''
  scheduleExpr.value = automation.scheduleExpr ?? ''
  cron.syncFromExpression(scheduleExpr.value)
  relativeWindowTypeEnumId.value = automation.relativeWindowTypeEnumId ?? relativeWindowTypeEnumId.value
  relativeWindowCount.value = automation.relativeWindowCount ?? relativeWindowCount.value
  customWindowStartDate.value = dateInputValue(automation.customWindowStartDate)
  customWindowEndDate.value = automation.customWindowEndDate ? previousDateValue(automation.customWindowEndDate) : ''
  windowTimeZone.value = normalizeTimezoneId(automation.timezone)
  isActive.value = automation.active !== false
  sourceDrafts.value = sourceDraftsFromAutomation(automation)
  handoffSavedRun.value = automation.savedRun ?? handoffSavedRun.value
  chatSpaceId.value = automation.chatSpaceId ?? ''
  chatSpaceChoice.value = automation.chatSpaceId ? 'existing' : 'none'
  automationChatSpaceName.value = automation.chatSpaceName ?? ''
  // chatSpaceActive is false BOTH when no space is linked and when the linked space is
  // inactive -- only surface the inactive note when a chat space is actually linked.
  automationChatSpaceInactive.value = Boolean(automation.chatSpaceId) && automation.chatSpaceActive === false
}

/**
 * The drift body, promoted out of mascotHints.ts when the line it gated on was removed. It
 * says what the old driftMessage did not: the CONSEQUENCE of leaving it, not merely that
 * something is out of date. The sync consequence follows, because the reader is about to
 * decide between them.
 */
const driftBody = computed<string>(() => {
  // The prompt now asks the question, so this says only what the reader needs to answer it: the
  // state they are in, then what saying yes does. It used to open by naming the condition, which
  // the title above it already does.
  const standing = 'It currently runs the setup it was built with, not the run\u2019s current one.'
  return `${standing} ${syncConfirmMessage.value}`
})

/** Re-derived after every load, so a warning cannot outlive the condition that raised it. */
function syncWarnings(): void {
  const status = automationSyncStatus.value
  // Raised on demand by the Sync button only; a reload must never resurrect one.
  mascot.drop('automation-sync-confirm')

  if (status?.savedRunMissing) {
    mascot.drop('automation-drift')
    mascot.raise({
      id: 'automation-saved-run-missing',
      title: 'Saved run is gone',
      // No action, so nothing to ask: the prompt states the condition and the detail says what
      // follows from it.
      prompt: 'The run this automation was built from no longer exists.',
      body: 'It cannot be synced, and keeps running the setup it already holds.',
      // No action: a deleted run cannot be synced, and a button that always fails is worse
      // than no button at all.
      actions: [],
    })
  } else {
    mascot.drop('automation-saved-run-missing')
    if (status && !status.inSync) {
      mascot.raise({
        id: 'automation-drift',
        title: 'Out of date',
        // The shell is a question shell everywhere else in the product; this uses it as one, and
        // Sync / Dismiss are its answers.
        prompt: 'Sync this automation with its run?',
        body: driftBody.value,
        actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: () => syncFromSavedRun() }],
      })
    } else {
      mascot.drop('automation-drift')
    }
  }

  if (automationChatSpaceInactive.value) {
    mascot.raise({
      id: 'automation-chat-space-inactive',
      title: 'Chat space is inactive',
      prompt: `${automationChatSpaceName.value} is no longer active.`,
      body: 'This automation\u2019s results will not reach anyone there.',
      actions: [],
    })
  } else {
    mascot.drop('automation-chat-space-inactive')
  }
}

/**
 * The row's Sync button and the jumping face lead to the same popup — the popup IS the
 * double-check now, so there is one confirmation path rather than two.
 *
 * The in-sync branch is load-bearing rather than defensive: syncWarnings() drops the drift
 * warning when nothing has drifted, so without raising a confirm here openWarnings() would
 * find an empty set and the button would silently do nothing. Syncing an up-to-date
 * automation is still a real action with a real consequence.
 */
function openSyncWarning(): void {
  syncWarnings()
  const status = automationSyncStatus.value
  if (status && status.inSync && !status.savedRunMissing) {
    mascot.raise({
      id: 'automation-sync-confirm',
      title: 'Sync with the run',
      prompt: 'Sync this automation with its run?',
      body: syncConfirmMessage.value,
      actions: [{ label: 'Sync', testId: 'mascot-warning-action-sync', run: () => syncFromSavedRun() }],
    })
  }
  // Opened deliberately, and only here. This is the Sync BUTTON's handler: the operator asked a
  // question and is owed the answer with its actions, not a mascot to go hunting for. A warning
  // that merely stands (drift found on load) is raised by syncWarnings() and never opened — the
  // burst and the held posture announce it, and the bubble waits to be hovered or clicked.
  mascot.openWarnings()
}

const syncConfirmMessage = computed<string>(() => {
  const base = 'Sync replaces this automation\u2019s source setup and filters with the run\u2019s current ones.'
  return automationSyncStatus.value?.inputModeChanging
    ? `${base} The run now uses a different kind of source, so the schedule shape changes and the current window settings stop applying.`
    : base
})

async function syncFromSavedRun(): Promise<void> {
  const automationId = routeAutomationId.value
  if (!automationId || syncing.value) return
  syncing.value = true
  try {
    const response = await reconciliationFacade.syncAutomation({ automationId }, pageAbortController.signal)
    if (!response.ok) {
      pageError.value = response.errors?.[0] ?? 'The automation and its saved run are not on speaking terms. Not synced.'
      return
    }
    await loadAutomationForEdit()
  } catch (syncError) {
    if ((syncError as { name?: string })?.name === 'AbortError') return
    pageError.value = 'The automation and its saved run are not on speaking terms. Not synced.'
  } finally {
    syncing.value = false
  }
}

async function loadAutomationForEdit(): Promise<boolean> {
  const editAutomationId = routeAutomationId.value
  if (!editAutomationId) return false
  // No pageError reset here: this always runs right after loadOptions() (which already
  // reset pageError at its own start and may have set a non-fatal chat-space-load note) --
  // clobbering it here would silently hide that note the instant this call succeeds.
  try {
    const response = await reconciliationFacade.getAutomation({ automationId: editAutomationId }, pageAbortController.signal)
    if (!response.automation) {
      pageError.value = `Automation ${editAutomationId} is on an unscheduled break.`
      return false
    }
    hydrateAutomation(response.automation)
    automationSyncStatus.value = response.syncStatus ?? null
    syncWarnings()
    return true
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return false
    pageError.value = 'The automation setup forgot to set itself up.'
    return false
  }
}

function restoreDraftFromHistoryState(): ReconciliationAutomationStepId | null {
  const draftState = draftStore.automationDraftState
  if (!draftState) return null

  const draft = draftState.draft
  automationId.value = draft.automationId ?? automationId.value
  intent.value = draft.intent ?? ''
  selectedSavedRunId.value = draft.savedRunId ?? ''
  // draftState.savedRun is present only when another page handed this wizard a run (the run page's
  // "Automate" action, or the create flow returning with a run it just saved). A draft this wizard
  // stored for itself carries no savedRun, so resuming one still asks the question.
  savedRunChosenElsewhere.value = Boolean(draftState.savedRun)
  savedRunType.value = draft.savedRunType ?? draftState.savedRun?.runType ?? 'ruleset'
  automationName.value = draft.automationName ?? (draftState.savedRun ? buildDefaultAutomationName(draftState.savedRun.runName) : '')
  inputModeEnumId.value = draft.inputModeEnumId ?? ''
  scheduleExpr.value = draft.scheduleExpr ?? ''
  cron.syncFromExpression(scheduleExpr.value)
  relativeWindowTypeEnumId.value = draft.relativeWindowTypeEnumId ?? relativeWindowTypeEnumId.value
  relativeWindowCount.value = draft.relativeWindowCount ?? relativeWindowCount.value
  customWindowStartDate.value = draft.customWindowStartDate?.slice(0, 10) ?? ''
  customWindowEndDate.value = draft.customWindowEndDate ? previousDateValue(draft.customWindowEndDate) : ''
  windowTimeZone.value = normalizeTimezoneId(draft.windowTimeZone)
  isActive.value = draft.isActive ?? true
  returnLabel.value = draft.returnLabel ?? ''
  returnPath.value = draft.returnPath ?? ''
  setChatSpaceChoice(draft.chatSpaceChoice ?? '')
  chatSpaceId.value = draft.chatSpaceId ?? ''
  sourceDrafts.value = {
    FILE_1: { ...(draft.sources?.FILE_1 ?? {}) },
    FILE_2: { ...(draft.sources?.FILE_2 ?? {}) },
  }
  handoffSavedRun.value = draftState.savedRun
  applyDeterministicDefaults()
  return draftState.resumeStepId
}

async function loadChatSpaceOptions(signal: AbortSignal): Promise<void> {
  try {
    const [notificationDefaultResponse, chatSpacesResponse] = await Promise.all([
      settingsFacade.getUserNotificationDefault(signal),
      settingsFacade.listTenantChatSpaces(signal),
    ])
    userNotificationDefault.value = notificationDefaultResponse.userNotificationDefault ?? null
    tenantChatSpaces.value = chatSpacesResponse.chatSpaces ?? []
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    // Non-critical for the wizard: a new space and 'none' remain available even without a
    // resolved default or registry, so a load failure here does not block automation setup --
    // but it must stay visible (pageError renders in both wizard and edit mode), otherwise
    // "My default space" / "Choose another space" just quietly vanish with no explanation.
    userNotificationDefault.value = null
    tenantChatSpaces.value = []
    pageError.value = 'The chat spaces drifted into outer space. You can still set up a new space or skip notifications.'
  }
}

async function loadOptions(): Promise<void> {
  loadingOptions.value = true
  pageError.value = null

  try {
    const chatSpaceOptionsPromise = loadChatSpaceOptions(pageAbortController.signal)
    const response = await reconciliationFacade.listAutomationSourceOptions(pageAbortController.signal)
    sourceOptions.value = {
      inputModes: response.inputModes ?? [],
      relativeWindows: response.relativeWindows ?? [],
      savedRuns: response.savedRuns ?? [],
      sftpServers: response.sftpServers ?? [],
      nsRestletConfigs: response.nsRestletConfigs ?? [],
      systemRemotes: response.systemRemotes ?? [],
    }
    await chatSpaceOptionsPromise
    applyDeterministicDefaults()
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    pageError.value = 'The automation options overslept.'
  } finally {
    loadingOptions.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleChoiceKeydown)
  const resumeStepId = routeAutomationId.value ? null : restoreDraftFromHistoryState()
  await loadOptions()
  if (routeAutomationId.value) {
    await loadAutomationForEdit()
    return
  }
  moveToStep(resumeStepId)
})
</script>

<style scoped>
.automation-date-window-fields {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(14rem, 1fr) repeat(2, minmax(9rem, 0.45fr));
  gap: var(--space-3);
}

.automation-edit-primary-fields {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  align-items: end;
}

.automation-schedule-helper {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(8rem, 1fr));
  gap: var(--space-3);
  align-items: end;
}

.automation-edit-date-window-fields,
.automation-edit-schedule-helper,
.automation-edit-chat-space-fields {
  margin-top: var(--space-00);
}

.automation-edit-chat-space-fields {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: end;
}

.automation-edit-chat-space-field {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.automation-edit-date-window-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.automation-edit-schedule-helper {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.automation-edit-active-field {
  align-content: end;
  min-width: 0;
}

.automation-edit-saved-run {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.automation-edit-saved-run__row {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  min-width: 0;
}

.automation-edit-saved-run__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* Matches the borderless, weight-400 affordances the rest of this form uses; the underline is the
   only signal, exactly as the wizard's own inline actions read. */
.automation-edit-saved-run__sync {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--text-soft);
  text-decoration: underline;
  cursor: pointer;
  white-space: nowrap;
}

.automation-edit-saved-run__sync:disabled {
  cursor: default;
  text-decoration: none;
  opacity: 0.6;
}

.automation-edit-schedule-helper .automation-schedule-control,
.automation-edit-schedule-helper :deep(.workflow-select-trigger),
.automation-edit-schedule-helper :deep(.workflow-select-option) {
  font-size: var(--workflow-form-answer-size);
}

.automation-schedule-field {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.automation-schedule-label {
  color: color-mix(in oklab, var(--text) 58%, transparent);
  font-size: var(--type-summary-label-size);
  line-height: 1;
}

.automation-schedule-control {
  width: 100%;
  min-height: 2.75rem;
  border: 0;
  border-bottom: 1px solid var(--workflow-underline);
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: clamp(1rem, 1.25vw, 1.2rem);
}

.automation-schedule-control:focus {
  border-bottom-color: var(--text);
  outline: none;
}

.automation-schedule-select :deep(.workflow-select-trigger) {
  min-height: 2.75rem;
  /* Contains a value below --space-00 (0.2rem). Under 2.5px these are optical nudges rather than spacing, and the scale deliberately stops above them. */
  /* stylelint-disable-next-line scale-unlimited/declaration-strict-value */
  padding: 0.15rem 0 var(--space-1-5);
  font-size: clamp(1rem, 1.25vw, 1.2rem);
  line-height: 1.2;
  letter-spacing: 0;
}

.automation-schedule-select :deep(.workflow-select-option) {
  font-size: clamp(1rem, 1.25vw, 1.2rem);
  letter-spacing: 0;
}

@media (max-width: 768px) {
  .automation-edit-primary-fields,
  .automation-date-window-fields,
  .automation-edit-chat-space-fields,
  .automation-schedule-helper {
    grid-template-columns: 1fr;
  }
}
</style>
