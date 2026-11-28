<template>
  <StaticPageFrame :class="{ 'user-settings-page--popup-open': isPopupOpen }">
    <template #hero>
      <h1>User Settings</h1>
    </template>

    <!-- DAR-UI-121 "Profile first": who you are and where you are, before anything you can change. -->
    <StaticPageSection>
      <section class="static-page-summary-card user-settings-badge" data-testid="user-badge">
        <span class="user-settings-badge-initial" aria-hidden="true">{{ userInitial }}</span>
        <div class="user-settings-card-main">
          <StaticEditableTitle
            ref="displayNameTitle"
            :key="displayNameRevision"
            tag="span"
            class="user-settings-badge-name"
            :model-value="displayName"
            aria-label="Display name"
            test-id="user-display-name"
            @commit="saveDisplayName"
          />
          <span class="user-settings-meta" data-testid="user-badge-meta">
            <span v-explain="'accountUsername'">{{ username }}</span> · {{ permissionSummary }}<template v-if="availableTenants.length > 0 && activeTenantName"> in {{ activeTenantName }}</template>
          </span>
          <!-- No membership is a dead end everywhere else in the app: tenant-scoped writes refuse with
               "An active tenant is required", and this is the one screen that can explain why.
               Membership is granted server-side on purpose, so the honest answer is what is missing
               and who can grant it, not a button that cannot work. -->
          <span v-if="availableTenants.length === 0" class="user-settings-meta" data-testid="user-settings-no-tenant">
            {{ noTenantMessage }}
          </span>
        </div>
        <div class="user-settings-card-actions">
          <button
            class="app-icon-action"
            type="button"
            aria-label="Rename display name"
            title="Rename display name"
            data-testid="user-rename"
            @click="startRename"
          >
            <AppIcon name="edit" />
          </button>
          <button
            v-if="availableTenants.length > 1"
            class="user-settings-control"
            type="button"
            aria-label="Switch tenant"
            data-testid="user-switch-tenant"
            @click="openSwitchTenant"
          >
            Switch
          </button>
        </div>
      </section>
      <p v-if="displayNameMessage" class="section-note" role="alert" data-testid="user-display-name-error">{{ displayNameMessage }}</p>
    </StaticPageSection>

    <StaticPageSection title="Preferences">
      <div class="static-page-summary-grid user-settings-card-grid">
        <article class="static-page-summary-card user-settings-stretch-card user-settings-row-card" data-testid="user-timezone-card">
          <div class="user-settings-card-main">
            <span class="static-page-summary-label">Timezone</span>
            <span>{{ userTimezoneSummary }}</span>
          </div>
          <div class="user-settings-card-actions">
            <button
              class="app-icon-action"
              type="button"
              aria-label="Change timezone"
              title="Change timezone"
              data-testid="user-timezone-change"
              @click="openTimezoneWorkflow"
            >
              <AppIcon name="edit" />
            </button>
          </div>
        </article>
        <article class="static-page-summary-card user-settings-stretch-card user-settings-row-card" data-testid="user-notification-default-card">
          <div class="user-settings-card-main">
            <span v-explain="'userNotificationDefault'" class="static-page-summary-label">Notifications</span>
            <span>{{ notificationDefaultSummary }}</span>
          </div>
          <div class="user-settings-card-actions">
            <button
              class="app-icon-action"
              type="button"
              aria-label="Change notifications"
              title="Change notifications"
              data-testid="user-notification-default-change"
              @click="openNotificationDefaultWorkflow"
            >
              <AppIcon name="edit" />
            </button>
          </div>
        </article>
      </div>
      <p v-if="settingsMessage" class="section-note" role="status">{{ settingsMessage }}</p>
    </StaticPageSection>

    <!-- DAR-BE-264. Each two-factor action asks for proof in its popup: the password while nothing is on, then a
         current code or (DAR-BE-270) a passkey. No Off for someone whose role requires it; the backend refuses
         removing their last factor and the popup says so. The cards that depend on the two-factor status wait for it. -->
    <StaticPageSection title="Sign-in">
      <div class="static-page-summary-grid user-settings-card-grid">
        <article
          v-if="signInCards.includes('passkeys')"
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="oddLastClass(signInCards, 'passkeys')"
          data-testid="passkeys-card"
        >
          <div class="user-settings-card-main">
            <span v-explain="'twoFactorPasskeys'" class="static-page-summary-label">Passkeys</span>
            <span data-testid="passkeys-count">{{ passkeys.length === 0 ? 'None' : passkeys.length }}</span>
          </div>
          <div class="user-settings-card-actions">
            <button
              v-if="canAddPasskey"
              class="user-settings-control"
              type="button"
              aria-label="Add a passkey"
              data-testid="passkey-add"
              @click="openTwoFactor('add-passkey')"
            >
              Add
            </button>
            <button
              v-if="hasPasskeys"
              class="user-settings-control"
              type="button"
              aria-label="Manage passkeys"
              data-testid="passkeys-manage"
              @click="openManagePasskeys"
            >
              Manage
            </button>
          </div>
        </article>
        <article
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="oddLastClass(signInCards, 'password')"
          data-testid="password-card"
        >
          <div class="user-settings-card-main">
            <span v-explain="'accountPassword'" class="static-page-summary-label">Password</span>
            <span aria-hidden="true">••••••••</span>
          </div>
          <div class="user-settings-card-actions">
            <button
              class="app-icon-action user-settings-password-trigger"
              type="button"
              aria-label="Change password"
              title="Change password"
              data-testid="user-password-change"
              @click="passwordFlow.open"
            >
              <AppIcon name="edit" />
            </button>
          </div>
        </article>
        <article
          v-if="signInCards.includes('app')"
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="oddLastClass(signInCards, 'app')"
          data-testid="two-factor-card"
        >
          <div class="user-settings-card-main">
            <span v-explain="'twoFactor'" class="static-page-summary-label">Authenticator app</span>
            <span data-testid="two-factor-state">{{ twoFactorSummary }}</span>
          </div>
          <div class="user-settings-card-actions">
            <button
              v-if="!appOn"
              class="user-settings-control"
              type="button"
              data-testid="two-factor-setup"
              @click="openTwoFactor('setup')"
            >
              Set up
            </button>
            <template v-else>
              <button class="user-settings-control" type="button" data-testid="two-factor-replace" @click="openTwoFactor('replace')">
                New app
              </button>
              <button
                v-if="hasPasskeys || !twoFactorStatus?.required"
                class="user-settings-control"
                type="button"
                data-testid="two-factor-off"
                @click="openTwoFactor(hasPasskeys ? 'app-off' : 'off')"
              >
                Turn off
              </button>
            </template>
          </div>
        </article>
        <article
          v-if="signInCards.includes('codes')"
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="oddLastClass(signInCards, 'codes')"
          data-testid="two-factor-recovery-card"
        >
          <div class="user-settings-card-main">
            <span v-explain="'twoFactorRecoveryCodes'" class="static-page-summary-label">Recovery codes</span>
            <span data-testid="two-factor-codes-left">{{ recoveryCodesLeftLabel }}</span>
          </div>
          <div class="user-settings-card-actions">
            <button class="user-settings-control" type="button" data-testid="two-factor-new-codes" @click="openTwoFactor('codes')">
              New codes
            </button>
          </div>
        </article>
        <!-- DAR-BE-028: where password reset codes go. Masked: the page never needs the whole address. -->
        <article
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="oddLastClass(signInCards, 'email')"
          data-testid="recovery-email-card"
        >
          <div class="user-settings-card-main">
            <span class="static-page-summary-label">Recovery email</span>
            <span>{{ authStore.emailAddressMasked ?? 'None' }}</span>
          </div>
          <div class="user-settings-card-actions">
            <button
              class="app-icon-action"
              type="button"
              :aria-label="authStore.emailAddressMasked ? 'Change recovery email' : 'Add recovery email'"
              :title="authStore.emailAddressMasked ? 'Change recovery email' : 'Add recovery email'"
              data-testid="recovery-email-change"
              @click="recoveryFlow.open"
            >
              <AppIcon :name="authStore.emailAddressMasked ? 'edit' : 'plus'" />
            </button>
          </div>
        </article>
        <article
          v-if="signInCards.includes('last-sign-in')"
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="oddLastClass(signInCards, 'last-sign-in')"
          data-testid="last-sign-in-card"
        >
          <div class="user-settings-card-main">
            <span class="static-page-summary-label">Last sign-in</span>
            <span>{{ lastLoginLabel }}</span>
          </div>
        </article>
      </div>
      <p v-if="twoFactorLoadError" class="section-note" role="alert" data-testid="two-factor-load-error">{{ twoFactorLoadError }}</p>
      <p v-if="twoFactorStatus?.codesLocked" class="section-note" role="alert" data-testid="two-factor-locked">
        Codes are locked after too many wrong tries. A password reset unlocks them.
      </p>
      <p v-if="passkeyError && !isManagePasskeysOpen" class="section-note" role="alert" data-testid="passkey-error">{{ passkeyError }}</p>
      <p v-if="twoFactorMessage" class="section-note" role="status" data-testid="two-factor-message">{{ twoFactorMessage }}</p>
    </StaticPageSection>

    <StaticPageSection title="CLI sessions">
      <CliAccessRequestCard v-if="myCliAccess" :key="myCliAccess.tenantUserGroupId" :access="myCliAccess" />
      <p v-if="cliSessions.length === 0 && !cliSessionsLoadFailed" class="section-note" data-testid="cli-sessions-empty">No CLI signed in.</p>
      <div v-else-if="cliSessions.length > 0" class="static-page-summary-grid user-settings-card-grid">
        <article
          v-for="(session, index) in cliSessions"
          :key="session.cliSessionId"
          class="static-page-summary-card user-settings-stretch-card user-settings-row-card"
          :class="{ 'static-page-summary-card--full': isOddLast(index, cliSessions.length) }"
          data-testid="cli-session-row"
        >
          <div class="user-settings-card-main">
            <span v-explain="'cliSessionHost'" class="static-page-summary-label">Host</span>
            <span>{{ session.hostLabel }}</span>
            <span class="user-settings-meta">
              <span v-explain="'cliSessionSignedIn'">Signed in</span> {{ formatDateTime(session.createdDate) }} ·
              <span v-explain="'cliSessionExpires'">Expires</span> {{ formatDateTime(session.expiresDate) }}
            </span>
          </div>
          <div class="user-settings-card-actions">
            <button
              type="button"
              class="user-settings-control"
              data-testid="cli-session-revoke"
              :aria-label="`Revoke ${session.hostLabel}`"
              :disabled="revokingCliSessionId === session.cliSessionId"
              @click="revokeCliSession(session.cliSessionId)"
            >
              Revoke
            </button>
          </div>
        </article>
      </div>
      <p v-if="cliSessionsError" class="section-note" role="alert" data-testid="cli-sessions-error">{{ cliSessionsError }}</p>
    </StaticPageSection>
  </StaticPageFrame>

  <div
    v-if="isManagePasskeysOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="manage-passkeys-title"
    data-testid="passkeys-manage-popup"
    @click.self="closeManagePasskeys"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 v-explain="'twoFactorPasskeys'" id="manage-passkeys-title">Passkeys</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          question="Rename or remove a passkey."
          :show-primary-action="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="passkeys-manage-close"
          @cancel="closeManagePasskeys"
        >
          <div class="user-settings-passkey-list">
            <article
              v-for="passkey in passkeys"
              :key="passkey.passkeyId"
              class="static-page-summary-card user-settings-row-card"
              data-testid="passkey-row"
            >
              <div class="user-settings-card-main">
                <StaticEditableTitle
                  :key="`${passkey.passkeyId}-${passkeyNameRevision}`"
                  tag="span"
                  :model-value="passkey.name || 'Passkey'"
                  :aria-label="`Rename ${passkey.name || 'passkey'}`"
                  test-id="passkey-name"
                  @commit="(name) => renamePasskey(passkey, name)"
                />
                <span class="user-settings-meta">
                  <span v-explain="'twoFactorPasskeyAdded'">Added</span> <span data-testid="passkey-added">{{ formatShortDate(passkey.createdDate) }}</span> ·
                  <span v-explain="'twoFactorPasskeyLastUsed'">Last used</span> <span data-testid="passkey-last-used">{{ formatShortDate(passkey.lastUsedDate) || 'Never' }}</span>
                </span>
              </div>
              <div class="user-settings-card-actions">
                <button
                  class="user-settings-control"
                  type="button"
                  data-testid="passkey-remove"
                  :aria-label="`Remove passkey ${passkey.name || ''}`.trim()"
                  @click="removeFromManage(passkey)"
                >
                  Remove
                </button>
              </div>
            </article>
          </div>
          <p v-if="passkeyError" class="section-note" role="alert" data-testid="passkey-error">{{ passkeyError }}</p>
        </WorkflowStepForm>
      </div>
    </section>
  </div>

  <div
    v-if="passwordFlow.isOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="password-workflow-title"
    @click.self="passwordFlow.close"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="password-workflow-title">Change Password</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          :question="passwordFlow.step.question"
          :primary-label="passwordFlow.primaryLabel"
          :submit-disabled="passwordFlow.isStepBlocked"
          :show-back="passwordFlow.stepIndex > 0"
          :show-cancel-action="false"
          :show-enter-hint="true"
          primary-test-id="password-workflow-next"
          @back="passwordFlow.back"
          @submit="passwordFlow.submit"
        >
          <label class="workflow-context-block" :aria-label="passwordFlow.step.label">
            <input
              v-model="passwordFlow.stepValue"
              class="wizard-answer-control"
              :name="passwordFlow.step.name"
              type="password"
              :autocomplete="passwordFlow.step.autocomplete"
              required
            />
          </label>
          <PasswordRules v-if="passwordFlow.showsRules" :rules="passwordFlow.rules" />
        </WorkflowStepForm>
      </div>
    </section>
  </div>

  <TwoFactorSettingsPopup
    v-if="twoFactorAction"
    :action="twoFactorAction"
    :username="username"
    :two-factor-on="twoFactorOn"
    :app-enabled="appOn"
    :has-passkeys="hasPasskeys"
    :passkey="removingPasskey"
    @changed="handleTwoFactorChanged"
    @close="twoFactorAction = null"
  />

  <div
    v-if="recoveryFlow.isOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="recovery-email-workflow-title"
    @click.self="recoveryFlow.close"
  >
    <section class="popup-workflow-modal workflow-panel" data-testid="recovery-email-workflow">
      <header class="workflow-panel-header">
        <h2 id="recovery-email-workflow-title">Recovery Email</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          :question="recoveryFlow.step.question"
          :primary-label="recoveryFlow.primaryLabel"
          :submit-disabled="recoveryFlow.isStepBlocked"
          :show-back="recoveryFlow.stepIndex > 0"
          :show-cancel-action="false"
          :show-enter-hint="true"
          primary-test-id="recovery-email-next"
          @back="recoveryFlow.back"
          @submit="recoveryFlow.submit"
        >
          <label class="workflow-context-block" :aria-label="recoveryFlow.step.label">
            <input
              v-model="recoveryFlow.stepValue"
              class="wizard-answer-control"
              :name="recoveryFlow.step.name"
              :type="recoveryFlow.step.type"
              :autocomplete="recoveryFlow.step.autocomplete"
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
        <h2 v-explain="'userNotificationDefault'" id="notification-default-workflow-title">Notifications</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact"
          question="Which chat space should get your notifications?"
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
// DAR-UI-121 and the items named on each section. DAR-OPS-029 U09: the password and recovery-email step popups
// (useOwnPasswordFlows), two-factor and passkeys (useTwoFactorSettings) and the CLI section (useCliSessions) live in
// their own composables; the page keeps the badge, the preferences and the popups' chrome.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import AppIcon from '../../components/ui/AppIcon.vue'
import PasswordRules from '../../components/auth/PasswordRules.vue'
import AppSelect, { type AppSelectOption } from '../../components/ui/AppSelect.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import CliAccessRequestCard from '../../components/settings/CliAccessRequestCard.vue'
import TwoFactorSettingsPopup from '../../components/settings/TwoFactorSettingsPopup.vue'
import { useCliSessions } from '../../composables/useCliSessions'
import { usePasswordChange, useRecoveryEmail } from '../../composables/useOwnPasswordFlows'
import { useTwoFactorSettings } from '../../composables/useTwoFactorSettings'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import { cachedRead } from '../../lib/api/readCache'
import type { TenantChatSpace, UserNotificationDefault } from '../../lib/api/types'
import { buildTimezoneOptions, resolveBrowserTimeZone } from '../../lib/timezones'
import { useAuthStore } from '../../stores/auth'
import { usePermissionsStore } from '../../stores/permissions'
import {
  COMMAND_PALETTE_OPEN_REQUEST_EVENT,
  WORKFLOW_CANCEL_REQUEST_EVENT,
  type CommandPaletteOpenRequestDetail,
} from '../../lib/uiEvents'
import { formatDateTime, formatShortDate } from '../../lib/utils/date'

const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()
const pageAbortController = new AbortController()

const passwordFlow = reactive(usePasswordChange())
const recoveryFlow = reactive(useRecoveryEmail())
const {
  cliSessions, cliSessionsError, cliSessionsLoadFailed, revokingCliSessionId, myCliAccess,
  loadCliSessions, loadMyCliAccess, revokeCliSession,
} = useCliSessions(pageAbortController.signal)
const {
  twoFactorStatus, twoFactorLoadError, twoFactorAction, twoFactorMessage, removingPasskey, passkeyError,
  passkeyNameRevision, isManagePasskeysOpen, twoFactorOn, appOn, passkeys, hasPasskeys, passkeysShown, canAddPasskey,
  twoFactorSummary, recoveryCodesLeftLabel, loadTwoFactorStatus, openTwoFactor, openManagePasskeys,
  closeManagePasskeys, removeFromManage, renamePasskey, handleTwoFactorChanged,
} = useTwoFactorSettings({ signal: pageAbortController.signal, onSessionsEnded: () => { void loadCliSessions() } })

const settingsMessage = ref<string | null>(null)
const isSavingDisplayName = ref(false)
const displayNameMessage = ref<string | null>(null)
// Bumped to redraw the name when a save is refused or left empty (the field shows what was typed until then).
const displayNameRevision = ref(0)
const displayNameTitle = ref<InstanceType<typeof StaticEditableTitle> | null>(null)
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
// Confirmed/displayed value, updated directly on a successful save rather than re-derived from sessionInfo: keeps the
// summary in lockstep with what was persisted without depending on session refresh timing.
const savedUserTimeZone = ref('')
const sessionInfo = computed(() => authStore.sessionInfo)
const userId = computed(() => sessionInfo.value?.userId ?? '')
const username = computed(() => sessionInfo.value?.username ?? sessionInfo.value?.userId ?? '')
const displayName = computed(() => sessionInfo.value?.displayName?.toString().trim() || username.value)
const availableTenants = computed(() => sessionInfo.value?.availableTenants ?? [])
const activeTenantUserGroupId = computed(() => sessionInfo.value?.activeTenantUserGroupId ?? null)
const noTenantMessage = computed(() => (
  permissionsStore.canManageGlobalSettings || sessionInfo.value?.isSuperAdmin === true
    ? 'This account is not a member of any company yet, so tenant-scoped screens stay read-only and saving a schema or run will be refused. Add it to a company permission group to continue.'
    : 'This account is not a member of any company yet, so tenant-scoped screens stay read-only and saving a schema or run will be refused. Ask a Darpan admin to add you to a company.'
))
const lastLoginLabel = computed(() => formatDateTime(sessionInfo.value?.lastLoginDate, { fallback: '' }))
const userInitial = computed(() => (Array.from(displayName.value)[0] ?? '').toUpperCase())
// The admin app's names for a tenant role (darpan-admin-ui TenantDetailPage roleOptions), widest first:
// the summary names the widest role held in the active tenant.
const TENANT_ROLE_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['DARPAN_TENANT_ADMIN', 'Tenant admin'],
  ['DARPAN_COMPANY_EDITOR', 'Company editor'],
  ['DARPAN_TENANT_USER', 'Tenant user'],
  ['DARPAN_COMPANY_VIEW_ONLY', 'Company view only'],
]
const permissionSummary = computed(() => {
  // A super admin also holds canManageDarpanCore, so the widest role is named first.
  if (sessionInfo.value?.isSuperAdmin === true) return 'Super admin'
  if (permissionsStore.canManageGlobalSettings) return 'Darpan admin'
  const groupIds = sessionInfo.value?.activeTenantPermissionGroupIds ?? []
  return TENANT_ROLE_LABELS.find(([groupId]) => groupIds.includes(groupId))?.[1] ?? 'No membership'
})
const notificationDefaultSummary = computed(() => notificationDefault.value?.spaceName || 'No default space')
const userTimeZone = computed(() => sessionInfo.value?.userTimeZone?.toString().trim() || '')
const tenantTimeZone = computed(() => sessionInfo.value?.tenantTimeZone?.toString().trim() || '')
const activeTenantName = computed(() => (
  sessionInfo.value?.activeTenantLabel?.toString().trim() || activeTenantUserGroupId.value || ''
))
// "Tenant default" named neither the company nor the zone, so it told the user nothing about what
// times they would actually see. Display resolution is userTimeZone -> tenantTimeZone -> browser
// (resolveEffectiveTimeZone in stores/auth), so name whichever of the last two actually applies and
// always show the zone id.
const clearedTimezoneLabel = computed(() => {
  if (tenantTimeZone.value) {
    return `${activeTenantName.value || 'Tenant'} default (${tenantTimeZone.value})`
  }

  const browserTimeZone = resolveBrowserTimeZone()
  return browserTimeZone ? `This browser (${browserTimeZone})` : 'This browser'
})
const userTimezoneSummary = computed(() => savedUserTimeZone.value || clearedTimezoneLabel.value)
const userTimezoneOptions = computed<AppSelectOption[]>(() => [
  { value: '', label: clearedTimezoneLabel.value },
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

watch(
  userTimeZone,
  (nextUserTimeZone) => {
    savedUserTimeZone.value = nextUserTimeZone
  },
  { immediate: true },
)

// The display name is the only thing this saves; Enter or leaving the name commits it, Esc keeps the old one.
async function saveDisplayName(typed: string): Promise<void> {
  const name = typed.trim()
  if (isSavingDisplayName.value || !userId.value || name === displayName.value) return
  if (!name) {
    displayNameRevision.value += 1
    return
  }

  isSavingDisplayName.value = true
  displayNameMessage.value = null
  try {
    const saved = await authStore.saveUserSettings({ displayName: name })
    if (!saved) {
      displayNameMessage.value = authStore.error ?? 'Your settings had second thoughts. Not saved.'
      displayNameRevision.value += 1
    }
  } finally {
    isSavingDisplayName.value = false
  }
}

function startRename(): void {
  displayNameTitle.value?.focus()
}

// DAR-UI-119's bow and this button open the same palette at the same command; there is one tenant picker.
function openSwitchTenant(): void {
  document.dispatchEvent(new CustomEvent<CommandPaletteOpenRequestDetail>(COMMAND_PALETTE_OPEN_REQUEST_EVENT, {
    detail: { initialQuery: '/switch-tenant ' },
  }))
}

// Esc on the two step popups, which show no cancel of WorkflowStepForm's own; the others close through theirs.
function handleCancelRequest(event: Event): void {
  if (recoveryFlow.isOpen) {
    event.preventDefault()
    recoveryFlow.close()
    return
  }
  if (!passwordFlow.isOpen) return

  event.preventDefault()
  passwordFlow.close()
}

async function loadNotificationDefault(): Promise<void> {
  try {
    await cachedRead(
      'userSettings.notificationDefault',
      () => settingsFacade.getUserNotificationDefault(pageAbortController.signal),
      (response) => { notificationDefault.value = response.userNotificationDefault ?? null },
    )
  } catch (loadError) {
    if ((loadError as { name?: string })?.name === 'AbortError') return
    settingsMessage.value = loadError instanceof ApiCallError ? loadError.message : 'Notification settings never got the notification.'
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
    settingsMessage.value = loadError instanceof ApiCallError ? loadError.message : 'The chat spaces drifted into outer space.'
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
    notificationDefaultSaveError.value = saveError instanceof ApiCallError ? saveError.message : 'The notification default did not get the memo. Not saved.'
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
      userTimezoneSaveError.value = authStore.error ?? 'Your timezone is stuck in yesterday. Not saved.'
      return
    }

    savedUserTimeZone.value = submittedTimeZone
    closeTimezoneWorkflow()
  } finally {
    isSavingUserTimezone.value = false
  }
}

// Even pairs (DAR-UI-121): cards sit two to a row at one height; an odd last card spans the row rather than
// leaving a hole or taking a filler beside it.
function isOddLast(index: number, count: number): boolean {
  return count % 2 === 1 && index === count - 1
}

function oddLastClass<T>(cards: readonly T[], card: T): Record<string, boolean> {
  return { 'static-page-summary-card--full': isOddLast(cards.indexOf(card), cards.length) }
}

// Sign-in cards in page order. The ones that depend on the two-factor status wait for it.
type SignInCard = 'passkeys' | 'password' | 'app' | 'codes' | 'email' | 'last-sign-in'
const signInCards = computed<SignInCard[]>(() => {
  const loaded = twoFactorStatus.value !== null
  const cards: Array<SignInCard | false> = [
    loaded && passkeysShown.value && 'passkeys',
    'password',
    loaded && 'app',
    loaded && twoFactorOn.value && 'codes',
    'email',
    Boolean(lastLoginLabel.value) && 'last-sign-in',
  ]
  return cards.filter((card): card is SignInCard => card !== false)
})
const isPopupOpen = computed(() => (
  passwordFlow.isOpen
  || isNotificationDefaultWorkflowOpen.value
  || isTimezoneWorkflowOpen.value
  || recoveryFlow.isOpen
  || isManagePasskeysOpen.value
  || twoFactorAction.value !== null
))

onMounted(() => {
  document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  void loadTwoFactorStatus()
  void loadNotificationDefault()
  void loadCliSessions()
  void loadMyCliAccess()
})

onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  pageAbortController.abort()
})
</script>
