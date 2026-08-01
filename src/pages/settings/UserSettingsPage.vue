<template>
  <StaticPageFrame :class="{ 'user-settings-page--popup-open': isPasswordWorkflowOpen || isNotificationDefaultWorkflowOpen || isTimezoneWorkflowOpen }">
    <template #hero>
      <h1>User Settings</h1>
    </template>

    <StaticPageSection>
      <template #header>
        <h2 class="static-page-section-heading">Account</h2>
      </template>

      <div class="static-page-summary-grid">
        <div class="user-settings-account-action-stack">
          <article class="static-page-summary-card">
            <span class="static-page-summary-label">User ID</span>
            <span>{{ userId }}</span>
          </article>
          <button class="user-settings-control user-settings-password-trigger" type="button" @click="openPasswordWorkflow">
            Change password
          </button>
        </div>
        <article class="static-page-summary-card">
          <span class="static-page-summary-label">Username</span>
          <span>{{ username }}</span>
        </article>
        <label class="static-page-summary-card user-settings-summary-field" for="user-display-name">
          <span class="static-page-summary-label">Display name</span>
          <input
            id="user-display-name"
            v-model="displayNameInput"
            class="user-settings-summary-input"
            name="displayName"
            autocomplete="name"
            placeholder="Display name"
            maxlength="80"
          />
        </label>
        <article class="static-page-summary-card">
          <span class="static-page-summary-label">Permissions</span>
          <span>{{ permissionSummary }}</span>
        </article>
      </div>

      <p v-if="passwordMessage" class="section-note">{{ passwordMessage }}</p>
    </StaticPageSection>

    <StaticPageSection title="Tenant Context">
      <div class="static-page-tile-grid static-page-record-grid">
        <button
          v-for="tenant in availableTenants"
          :key="tenant.userGroupId"
          type="button"
          class="static-page-tile static-page-record-tile"
          :class="{ 'static-page-module-tile--active': tenant.userGroupId === activeTenantUserGroupId }"
          :disabled="isSwitchingTenant || tenant.userGroupId === activeTenantUserGroupId"
          @click="switchTenant(tenant.userGroupId)"
        >
          <span class="static-page-tile-title">{{ tenant.label || tenant.userGroupId }}</span>
        </button>
      </div>
      <p v-if="tenantMessage" class="section-note">{{ tenantMessage }}</p>
    </StaticPageSection>

    <StaticPageSection title="Preferences">
      <div class="static-page-summary-grid user-settings-card-grid">
        <button
          type="button"
          class="static-page-summary-card user-settings-stretch-card user-settings-notification-default-card"
          data-testid="user-timezone-card"
          @click="openTimezoneWorkflow"
        >
          <span class="static-page-summary-label">Timezone</span>
          <span>{{ userTimezoneSummary }}</span>
        </button>
        <button
          type="button"
          class="static-page-summary-card user-settings-stretch-card user-settings-notification-default-card"
          data-testid="user-notification-default-card"
          @click="openNotificationDefaultWorkflow"
        >
          <span class="static-page-summary-label">Notifications</span>
          <span>{{ notificationDefaultSummary }}</span>
        </button>
      </div>
      <p v-if="settingsMessage" class="section-note" role="status">{{ settingsMessage }}</p>
    </StaticPageSection>

    <StaticPageSection v-if="lastLoginLabel || lastRunLabel" title="Activity">
      <div class="static-page-summary-grid user-settings-card-grid">
        <article v-if="lastLoginLabel" class="static-page-summary-card user-settings-stretch-card">
          <span class="static-page-summary-label">Last Login</span>
          <span>{{ lastLoginLabel }}</span>
        </article>
        <article v-if="lastRunLabel" class="static-page-summary-card user-settings-stretch-card">
          <span class="static-page-summary-label">Last Run</span>
          <span>{{ lastRunLabel }}</span>
        </article>
      </div>
    </StaticPageSection>

    <template #actions>
      <AppSaveAction :label="saveActionLabel" :disabled="isSavingUserSettings" @click="saveUserSettingsForm" />
    </template>
  </StaticPageFrame>

  <div
    v-if="isPasswordWorkflowOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="password-workflow-title"
    @click.self="closePasswordWorkflow"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="password-workflow-title">Change Password</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          :question="passwordStepQuestion"
          :primary-label="passwordPrimaryLabel"
          :submit-disabled="isPasswordStepBlocked"
          :show-back="passwordStepIndex > 0"
          :show-cancel-action="false"
          :show-enter-hint="true"
          primary-test-id="password-workflow-next"
          @back="goBackPasswordStep"
          @submit="submitPasswordStep"
        >
          <label class="workflow-context-block" :aria-label="passwordStepLabel">
            <input
              v-model="passwordStepValue"
              class="wizard-answer-control"
              :name="passwordStepName"
              type="password"
              :autocomplete="passwordStepAutocomplete"
              required
            />
          </label>
        </WorkflowStepForm>
      </div>
    </section>
  </div>

  <div
    v-if="isNotificationDefaultWorkflowOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="notification-default-workflow-title"
    @click.self="closeNotificationDefaultWorkflow"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="notification-default-workflow-title">Notifications</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          question="Which Google Chat space should get your notifications?"
          :show-primary-action="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="user-notification-default-workflow-close"
          @cancel="closeNotificationDefaultWorkflow"
        >
          <InlineValidation v-if="notificationDefaultSaveError" tone="error" :message="notificationDefaultSaveError" />
          <p v-if="chatSpacesLoading" class="section-note">Loading chat spaces...</p>
          <p v-else-if="chatSpacesLoadError" class="section-note" role="status">{{ settingsMessage }}</p>
          <WorkflowShortcutChoiceCards
            v-else
            :options="chatSpaceChoiceOptions"
            test-id-prefix="user-chat-space-choice"
            @choose="handleChatSpaceChoice"
          />
        </WorkflowStepForm>
      </div>
    </section>
  </div>

  <div
    v-if="isTimezoneWorkflowOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="user-timezone-workflow-title"
    @click.self="closeTimezoneWorkflow"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="user-timezone-workflow-title">Timezone</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          question="Which timezone should times display in?"
          :primary-label="timezonePrimaryLabel"
          primary-action-variant="save"
          :submit-disabled="isSavingUserTimezone"
          primary-test-id="save-user-timezone"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="user-timezone-workflow-close"
          @cancel="closeTimezoneWorkflow"
          @submit="saveUserTimezone"
        >
          <InlineValidation v-if="userTimezoneSaveError" tone="error" :message="userTimezoneSaveError" />
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Timezone</span>
            <AppSelect
              v-model="timezoneForm.timeZone"
              :options="userTimezoneOptions"
              :disabled="isSavingUserTimezone"
              searchable
              search-placeholder="Search timezones"
              test-id="user-timezone-select"
            />
          </label>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppSaveAction from '../../components/ui/AppSaveAction.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { TenantChatSpace, UserNotificationDefault } from '../../lib/api/types'
import { buildTimezoneOptions } from '../../lib/timezones'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import { WORKFLOW_CANCEL_REQUEST_EVENT, WORKFLOW_HINT_REQUEST_EVENT } from '../../lib/uiEvents'
import { formatDateTime } from '../../lib/utils/date'

const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

const displayNameInput = ref('')
const settingsMessage = ref<string | null>(null)
const tenantMessage = ref<string | null>(null)
const passwordMessage = ref<string | null>(null)
const isPasswordWorkflowOpen = ref(false)
const passwordStepIndex = ref(0)
const isSavingUserSettings = ref(false)
const isVerifyingCurrentPassword = ref(false)
const isChangingPassword = ref(false)
const isSwitchingTenant = ref(false)
const notificationDefault = ref<UserNotificationDefault | null>(null)
const isNotificationDefaultWorkflowOpen = ref(false)
const isSavingNotificationDefault = ref(false)
const chatSpaces = ref<TenantChatSpace[]>([])
const chatSpacesLoading = ref(false)
const chatSpacesLoadError = ref(false)
// Dedicated, popup-scoped error (mirrors ReconciliationRunResultPage.vue's notifyError):
// settingsMessage renders page-level, behind the popup's z-95 scrim, so a save failure
// written there was invisible while the dialog stayed open.
const notificationDefaultSaveError = ref<string | null>(null)
const isTimezoneWorkflowOpen = ref(false)
const isSavingUserTimezone = ref(false)
const userTimezoneSaveError = ref<string | null>(null)
const timezoneForm = ref({ timeZone: '' })
// Confirmed/displayed value, updated directly on a successful save (mirrors
// savedDisplayNameInput below) rather than re-derived from sessionInfo -- keeps the summary
// in lockstep with what was actually persisted without depending on session refresh timing.
const savedUserTimeZone = ref('')
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  newPasswordVerify: '',
})
const passwordSteps = [
  {
    name: 'currentPassword',
    label: 'Current Password',
    question: 'Enter your current password.',
    autocomplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: 'New Password',
    question: 'Enter your new password.',
    autocomplete: 'new-password',
  },
  {
    name: 'newPasswordVerify',
    label: 'Verify Password',
    question: 'Enter your new password again.',
    autocomplete: 'new-password',
  },
] as const
let displayNameSaveTimer: ReturnType<typeof globalThis.setTimeout> | null = null
let savedDisplayNameInput = ''

const sessionInfo = computed(() => authStore.sessionInfo)
const userId = computed(() => sessionInfo.value?.userId ?? '')
const username = computed(() => sessionInfo.value?.username ?? sessionInfo.value?.userId ?? '')
const displayName = computed(() => sessionInfo.value?.displayName?.toString().trim() || username.value)
const availableTenants = computed(() => sessionInfo.value?.availableTenants ?? [])
const activeTenantUserGroupId = computed(() => sessionInfo.value?.activeTenantUserGroupId ?? null)
const lastLoginLabel = computed(() => formatDateTime(sessionInfo.value?.lastLoginDate, { fallback: '' }))
const lastRunLabel = computed(() => {
  const lastRun = sessionInfo.value?.lastRun
  if (!lastRun) return ''
  return lastRun.savedRunId || lastRun.reconciliationRunId || lastRun.reconciliationRunResultId || 'Run available'
})
const permissionSummary = computed(() => {
  if (permissionsStore.canManageGlobalSettings) return 'Darpan admin'
  if (sessionInfo.value?.isSuperAdmin === true) return 'Super admin'
  if (permissionsStore.canEditTenantSettings) return 'Tenant admin'
  if (permissionsStore.canRunActiveTenantReconciliation) return 'Tenant user'
  return 'View only membership'
})
const notificationDefaultSummary = computed(() => notificationDefault.value?.spaceName || 'No default space')
const userTimeZone = computed(() => sessionInfo.value?.userTimeZone?.toString().trim() || '')
const userTimezoneSummary = computed(() => savedUserTimeZone.value || 'Tenant default')
const userTimezoneOptions = computed<AppSelectOption[]>(() => [
  { value: '', label: 'Tenant default' },
  ...buildTimezoneOptions(timezoneForm.value.timeZone),
])
const timezonePrimaryLabel = computed(() => (isSavingUserTimezone.value ? 'Saving timezone' : 'Save Timezone'))
const chatSpaceChoiceOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const options: Array<{ value: string; label: string }> = chatSpaces.value
    .filter((space) => space.isActive !== 'N')
    .map((space) => ({ value: space.chatSpaceId, label: space.spaceName }))
  options.push({ value: 'clear', label: 'No notifications' })

  return options.map((option, index) => ({
    ...option,
    shortcutKey: String.fromCharCode(65 + index),
  }))
})
const passwordStep = computed(() => passwordSteps[passwordStepIndex.value] ?? passwordSteps[0])
const passwordStepQuestion = computed(() => passwordStep.value.question)
const passwordStepLabel = computed(() => passwordStep.value.label)
const passwordStepName = computed(() => passwordStep.value.name)
const passwordStepAutocomplete = computed(() => passwordStep.value.autocomplete)
const saveActionLabel = computed(() => (isSavingUserSettings.value ? 'Saving user settings' : 'Save user settings'))
const passwordPrimaryLabel = computed(() => {
  if (passwordStep.value.name === 'currentPassword' && isVerifyingCurrentPassword.value) return 'Checking'
  return passwordStepIndex.value === passwordSteps.length - 1 ? (isChangingPassword.value ? 'Changing' : 'Change') : 'OK'
})
const passwordStepValue = computed({
  get() {
    return passwordForm.value[passwordStep.value.name]
  },
  set(value: string) {
    passwordForm.value = {
      ...passwordForm.value,
      [passwordStep.value.name]: value,
    }
  },
})
const isPasswordStepBlocked = computed(() => {
  if (isChangingPassword.value || isVerifyingCurrentPassword.value) return true
  return passwordStepValue.value.trim().length === 0
})

watch(
  displayName,
  (nextDisplayName) => {
    const nextDisplayNameInput = nextDisplayName || ''
    savedDisplayNameInput = nextDisplayNameInput
    displayNameInput.value = nextDisplayNameInput
  },
  { immediate: true },
)

watch(displayNameInput, (nextDisplayNameInput) => {
  if (nextDisplayNameInput === savedDisplayNameInput) return
  settingsMessage.value = null
  scheduleDisplayNameSave()
})

watch(
  userTimeZone,
  (nextUserTimeZone) => {
    savedUserTimeZone.value = nextUserTimeZone
  },
  { immediate: true },
)

async function saveUserSettingsForm(): Promise<void> {
  if (isSavingUserSettings.value) return
  clearDisplayNameSaveTimer()
  if (!userId.value) return
  const submittedDisplayNameInput = displayNameInput.value
  const persistedDisplayNameInput = submittedDisplayNameInput.trim() || username.value
  let didSave = false

  isSavingUserSettings.value = true
  settingsMessage.value = 'Saving user settings'
  try {
    const saved = await authStore.saveUserSettings({ displayName: submittedDisplayNameInput })
    if (!saved) {
      settingsMessage.value = authStore.error ?? 'Unable to save user settings.'
      return
    }

    didSave = true
    savedDisplayNameInput = persistedDisplayNameInput
    if (displayNameInput.value === submittedDisplayNameInput && displayNameInput.value !== savedDisplayNameInput) {
      displayNameInput.value = savedDisplayNameInput
    }
    tenantMessage.value = null
    settingsMessage.value = 'User settings saved.'
  } finally {
    isSavingUserSettings.value = false
    if (didSave && displayNameInput.value !== savedDisplayNameInput) {
      settingsMessage.value = null
      scheduleDisplayNameSave()
    }
  }
}

function scheduleDisplayNameSave(): void {
  clearDisplayNameSaveTimer()
  displayNameSaveTimer = globalThis.setTimeout(() => {
    void saveUserSettingsForm()
  }, 1000)
}

function clearDisplayNameSaveTimer(): void {
  if (displayNameSaveTimer === null) return
  globalThis.clearTimeout(displayNameSaveTimer)
  displayNameSaveTimer = null
}

function openPasswordWorkflow(): void {
  isPasswordWorkflowOpen.value = true
  passwordStepIndex.value = 0
  passwordMessage.value = null
}

function closePasswordWorkflow(): void {
  isPasswordWorkflowOpen.value = false
  passwordStepIndex.value = 0
  passwordMessage.value = null
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    newPasswordVerify: '',
  }
}

function handlePasswordWorkflowCancelRequest(event: Event): void {
  if (!isPasswordWorkflowOpen.value) return

  event.preventDefault()
  closePasswordWorkflow()
}

function goBackPasswordStep(): void {
  passwordStepIndex.value = Math.max(0, passwordStepIndex.value - 1)
}

async function submitPasswordStep(): Promise<void> {
  if (passwordStep.value.name === 'currentPassword') {
    const verified = await verifyCurrentPasswordStep()
    if (!verified) return
  }

  if (passwordStepIndex.value < passwordSteps.length - 1) {
    passwordStepIndex.value += 1
    return
  }

  await submitPasswordChange()
}

async function verifyCurrentPasswordStep(): Promise<boolean> {
  if (isVerifyingCurrentPassword.value) return false

  isVerifyingCurrentPassword.value = true
  try {
    const verified = await authStore.verifyOwnPassword(passwordForm.value.currentPassword)
    if (!verified) {
      showPasswordWorkflowWarning(authStore.error || 'Password incorrect.')
      return false
    }

    return true
  } finally {
    isVerifyingCurrentPassword.value = false
  }
}

function showPasswordWorkflowWarning(message: string): void {
  document.dispatchEvent(new CustomEvent(WORKFLOW_HINT_REQUEST_EVENT, {
    detail: {
      message,
      tone: 'warning',
      durationMs: 5000,
    },
  }))
}

async function submitPasswordChange(): Promise<void> {
  if (isChangingPassword.value) return
  if (passwordForm.value.newPassword !== passwordForm.value.newPasswordVerify) {
    passwordMessage.value = 'New passwords do not match.'
    return
  }

  isChangingPassword.value = true
  passwordMessage.value = 'Changing password'
  try {
    const changed = await authStore.changeOwnPassword({
      currentPassword: passwordForm.value.currentPassword,
      newPassword: passwordForm.value.newPassword,
      newPasswordVerify: passwordForm.value.newPasswordVerify,
    })
    if (changed) {
      passwordForm.value = {
        currentPassword: '',
        newPassword: '',
        newPasswordVerify: '',
      }
      isPasswordWorkflowOpen.value = false
      passwordStepIndex.value = 0
      passwordMessage.value = 'Password changed.'
    } else {
      passwordMessage.value = authStore.error ?? 'Unable to change password.'
    }
  } finally {
    isChangingPassword.value = false
  }
}

async function switchTenant(nextTenantUserGroupId: string): Promise<void> {
  if (isSwitchingTenant.value || !nextTenantUserGroupId || nextTenantUserGroupId === activeTenantUserGroupId.value) return
  isSwitchingTenant.value = true
  try {
    const saved = await authStore.saveActiveTenant(nextTenantUserGroupId)
    tenantMessage.value = saved ? null : 'Unable to switch tenant.'
  } finally {
    isSwitchingTenant.value = false
  }
}

async function loadNotificationDefault(): Promise<void> {
  try {
    const response = await settingsFacade.getUserNotificationDefault(pageAbortController.signal)
    notificationDefault.value = response.userNotificationDefault ?? null
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    settingsMessage.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load notification settings.'
  }
}

async function loadChatSpacesForNotificationDefault(): Promise<void> {
  chatSpacesLoading.value = true
  chatSpacesLoadError.value = false
  try {
    const response = await settingsFacade.listTenantChatSpaces(pageAbortController.signal)
    chatSpaces.value = response.chatSpaces ?? []
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    chatSpaces.value = []
    chatSpacesLoadError.value = true
    settingsMessage.value = loadError instanceof ApiCallError ? loadError.message : 'Unable to load chat spaces.'
  } finally {
    chatSpacesLoading.value = false
  }
}

function openNotificationDefaultWorkflow(): void {
  settingsMessage.value = null
  notificationDefaultSaveError.value = null
  chatSpacesLoadError.value = false
  isNotificationDefaultWorkflowOpen.value = true
  void loadChatSpacesForNotificationDefault()
}

function closeNotificationDefaultWorkflow(): void {
  isNotificationDefaultWorkflowOpen.value = false
}

async function handleChatSpaceChoice(value: string): Promise<void> {
  if (isSavingNotificationDefault.value) return

  isSavingNotificationDefault.value = true
  notificationDefaultSaveError.value = null
  try {
    const chatSpaceId = value === 'clear' ? '' : value
    const response = await settingsFacade.saveUserNotificationDefault({ chatSpaceId }, pageAbortController.signal)
    notificationDefault.value = response.userNotificationDefault ?? null
    closeNotificationDefaultWorkflow()
  } catch (saveError) {
    notificationDefaultSaveError.value = saveError instanceof ApiCallError ? saveError.message : 'Unable to save notification default.'
  } finally {
    isSavingNotificationDefault.value = false
  }
}

function openTimezoneWorkflow(): void {
  userTimezoneSaveError.value = null
  timezoneForm.value.timeZone = savedUserTimeZone.value
  isTimezoneWorkflowOpen.value = true
}

function closeTimezoneWorkflow(): void {
  isTimezoneWorkflowOpen.value = false
}

async function saveUserTimezone(): Promise<void> {
  if (isSavingUserTimezone.value) return
  isSavingUserTimezone.value = true
  userTimezoneSaveError.value = null
  try {
    const submittedTimeZone = timezoneForm.value.timeZone
    const saved = await authStore.saveUserSettings({ timeZone: submittedTimeZone })
    if (!saved) {
      userTimezoneSaveError.value = authStore.error ?? 'Unable to save timezone.'
      return
    }

    savedUserTimeZone.value = submittedTimeZone
    closeTimezoneWorkflow()
  } finally {
    isSavingUserTimezone.value = false
  }
}

const pageAbortController = new AbortController()

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handlePasswordWorkflowCancelRequest)
  void loadNotificationDefault()
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handlePasswordWorkflowCancelRequest)
  clearDisplayNameSaveTimer()
  pageAbortController.abort()
})
</script>
