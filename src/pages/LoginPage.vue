<template>
  <main class="login-page">
    <!-- Page-level, above the panel: the account is refused sign-in entirely, so the notice belongs
         to the whole screen rather than sitting inside the box as if it described one field. -->
    <InlineValidation
      v-if="passwordChangeNotice"
      class="login-page-banner"
      data-testid="password-change-notice"
      tone="warning"
      :message="passwordChangeNotice"
    />
    <InlineValidation
      v-else-if="twoFactorMode === 'setup'"
      class="login-page-banner"
      data-testid="two-factor-required-notice"
      tone="warning"
      message="Your role needs two-factor. Set it up to sign in."
    />

    <section class="login-panel">
      <p class="eyebrow">Darpan</p>

      <!-- DAR-UI-120/132: no heading on any step: the question is the heading. A browser with a device note opens on
           its one kept account; otherwise username first, then the passkey (only where the note says a passkey proved
           that username on this browser) or the password. id/name stay on the fields for the password managers that key
           off them, not the autocomplete tokens. -->
      <template v-if="isSignInForm">
        <WorkflowStepForm
          v-if="signInStep === 'welcome' && kept"
          question="Welcome back."
          :show-primary-action="false"
        >
          <!-- The row is the button: no arrow, no Continue. Named by what it does; the account is its description. -->
          <button
            id="login-welcome-row"
            type="button"
            class="login-account-row"
            data-testid="login-welcome-row"
            :aria-label="welcomeByPasskey ? 'Sign in with your passkey' : 'Sign in with your password'"
            aria-describedby="login-welcome-username"
            :disabled="loading"
            @click="continueAsKept"
          >
            <span class="login-account-badge" aria-hidden="true">{{ kept.username.trim().charAt(0).toUpperCase() }}</span>
            <span class="login-account-name">
              <span id="login-welcome-username" data-testid="login-welcome-username">{{ kept.username }}</span>
              <span data-testid="login-welcome-method">{{ welcomeByPasskey ? 'Passkey' : 'Password' }}</span>
            </span>
          </button>
          <template #links>
            <button type="button" class="login-text-link" data-testid="login-another-account" @click="useAnotherAccount">
              Another account
            </button>
          </template>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="signInStep === 'username'"
          question="Username?"
          primary-label="Next"
          :submit-disabled="loading"
          :show-enter-hint="true"
          primary-test-id="login-username-next"
          @submit="submitUsername"
        >
          <!-- "webauthn" lets the browser offer this site's passkeys in the field's own autofill. -->
          <label class="workflow-context-block" aria-label="Username">
            <input
              id="login-username"
              v-model="username"
              class="wizard-answer-control"
              name="username"
              type="text"
              autocomplete="username webauthn"
              autocapitalize="none"
              spellcheck="false"
              @blur="prebeginTyped"
            />
          </label>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="signInStep === 'passkey'"
          question="Use your passkey."
          :primary-label="loading ? 'Waiting' : 'Try again'"
          :submit-disabled="loading"
          :show-back="true"
          :show-enter-hint="true"
          primary-test-id="login-passkey-try-again"
          @back="backToUsername"
          @submit="signInWithPasskey"
        >
          <p class="section-note" data-testid="login-passkey-username">{{ username }}</p>
          <template #links>
            <button type="button" class="login-text-link" data-testid="login-use-password" @click="usePasswordInstead">
              Use password instead
            </button>
          </template>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else
          :question="`Password for ${username}?`"
          primary-label="Next"
          :submit-disabled="loading"
          :show-back="true"
          :show-enter-hint="true"
          primary-test-id="login-current-password-next"
          @back="backToUsername"
          @submit="submitPassword"
        >
          <!-- The name was asked on the step before; it rides here unseen so a password manager saves and fills the pair. -->
          <input
            class="sr-only"
            name="username"
            type="text"
            autocomplete="username"
            :value="username"
            readonly
            tabindex="-1"
            aria-hidden="true"
          />
          <label class="workflow-context-block" aria-label="Password">
            <input
              id="login-password"
              v-model="password"
              class="wizard-answer-control"
              name="password"
              type="password"
              autocomplete="current-password"
            />
          </label>
          <template #links>
            <!-- The browser lists this site's passkeys (D16: discoverable-only): a security key, or a passkey on a phone. -->
            <button
              v-if="passkeysOffered"
              type="button"
              class="login-text-link"
              data-testid="login-use-passkey"
              :disabled="loading"
              @click="signInWithPasskey"
            >
              Use a passkey or security key
            </button>
            <button
              v-if="passwordResetAvailable"
              type="button"
              class="login-text-link"
              data-testid="login-forgot-password"
              @click="enterResetMode"
            >
              Forgot password?
            </button>
          </template>
        </WorkflowStepForm>
      </template>

      <!-- DAR-BE-264: the password was right; the session waits for a code, or for a required first setup. -->
      <!-- DAR-UI-132: the passkey first only where this browser's note says one proved them here. -->
      <TwoFactorCodeSteps
        v-else-if="twoFactorMode === 'code'"
        :prefer="passkeyKeptFor(username) ? 'passkey' : 'code'"
        @back="leaveTwoFactorStep"
        @ended="endTwoFactorStep"
        @signed-in="finishTwoFactorSignIn"
      />
      <TwoFactorEnrolSteps
        v-else-if="twoFactorMode === 'setup'"
        :passkeys-available="authStore.twoFactorPasskeysAvailable"
        :username="username"
        @back="leaveTwoFactorStep"
        @ended="endTwoFactorStep"
        @done="finishTwoFactorSetup"
      />

      <!-- DAR-BE-264: signed in with a recovery code and few are left. Said once, then on to where they were going. -->
      <WorkflowStepForm
        v-else-if="recoveryCodesLeft !== null"
        :question="recoveryCodesLeftQuestion"
        :show-back="false"
        :show-enter-hint="true"
        primary-test-id="login-recovery-codes-left-ok"
        @submit="acknowledgeRecoveryCodesLeft"
      >
        <p class="section-note">New ones are in User Settings.</p>
      </WorkflowStepForm>

      <!-- DAR-BE-264 grace: two-factor will be required from a date and is not set up. Asked at every sign-in until
           then (the recovery-email step's pattern). -->
      <template v-else-if="isAskingTwoFactorDue">
        <TwoFactorEnrolSteps
          v-if="gracePasskeysAvailable !== null"
          :proof="{ currentPassword: signInPassword }"
          :passkeys-available="gracePasskeysAvailable"
          :username="username"
          @back="gracePasskeysAvailable = null"
          @done="leaveSignIn"
        />
        <WorkflowStepForm
          v-else
          :question="twoFactorDueQuestion"
          :primary-label="isStartingGraceSetup ? 'Starting' : 'Set up'"
          :submit-disabled="isStartingGraceSetup"
          :show-back="false"
          :show-cancel-action="true"
          cancel-label="Not now"
          cancel-test-id="login-two-factor-due-skip"
          :show-enter-hint="true"
          primary-test-id="login-two-factor-due-setup"
          @submit="startGraceSetup"
          @cancel="leaveSignIn"
        />
      </template>

      <!-- DAR-BE-028: signed in, but no email on file, so a forgotten password would be a dead end. Asked at
           every sign-in until one is saved; Not now is never remembered. -->
      <template v-else-if="isAskingRecoveryEmail">
        <WorkflowStepForm
          question="Where should password reset codes go?"
          :primary-label="isSavingRecoveryEmail ? 'Saving' : 'Save'"
          :submit-disabled="isSavingRecoveryEmail || recoveryEmail.trim().length === 0"
          :show-back="false"
          :show-cancel-action="true"
          cancel-label="Not now"
          cancel-test-id="login-recovery-skip"
          :show-enter-hint="true"
          primary-test-id="login-recovery-save"
          @submit="saveRecoveryEmailAndContinue"
          @cancel="continueAfterSignIn"
        >
          <label class="workflow-context-block" aria-label="Recovery email">
            <input
              v-model="recoveryEmail"
              class="wizard-answer-control"
              data-testid="login-recovery-input"
              name="email"
              type="email"
              autocomplete="email"
              required
            />
          </label>
        </WorkflowStepForm>
      </template>

      <!-- DAR-UI-132: the last step after a password and a code from the app (or a recovery code), on a browser that can
           make a passkey. Its registration was begun before it showed (the sign-in just finished two-factor, so it needs
           no proof for 5 minutes), so Add opens the browser's sheet straight from the click. -->
      <template v-else-if="passkeyOffer !== null">
        <WorkflowStepForm
          v-if="passkeyAdded"
          question="Passkey added."
          primary-label="Continue"
          :show-enter-hint="true"
          primary-test-id="login-passkey-added-continue"
          @submit="leaveSignIn"
        >
          <p class="section-note">Darpan asks for it next time on this device.</p>
        </WorkflowStepForm>
        <PasskeyAddSteps
          v-else
          :options="passkeyOffer"
          :rebegin="beginPasskeyOffer"
          :username="signedInName()"
          question="Add a passkey on this device?"
          primary-label="Add passkey"
          :show-back="false"
          @done="passkeyAdded = true"
          @ended="leaveSignIn"
        >
          <p class="section-note">Next time on this device, Touch ID signs you in.</p>
          <template #links>
            <button type="button" class="login-text-link" data-testid="login-passkey-not-now" @click="leaveSignIn">Not now</button>
          </template>
        </PasskeyAddSteps>
      </template>

      <!-- DAR-BE-028: one question per step, as the expired-password change below. -->
      <template v-else-if="isResettingMode">
        <WorkflowStepForm
          :question="resetStep.question"
          :primary-label="resetPrimaryLabel"
          :submit-disabled="isResetStepBlocked"
          :show-back="true"
          :show-cancel-action="false"
          :show-enter-hint="true"
          primary-test-id="login-reset-next"
          @back="goBackResetStep"
          @submit="submitResetStep"
        >
          <p v-if="resetStep.name === 'code'" class="section-note" data-testid="login-reset-note">
            {{ resetSentTo ? `Sent to ${resetSentTo}.` : 'Sent.' }} It expires in 15 minutes.
          </p>
          <!-- The code completes itself: the sixth digit verifies it, with no OK to press. -->
          <WorkflowCodeInput
            v-if="resetStep.name === 'code'"
            v-model="resetStepValue"
            :label="resetStep.label"
            test-id="login-reset-code"
            @complete="submitResetStep"
          />
          <label v-else class="workflow-context-block" :aria-label="resetStep.label">
            <input
              v-model="resetStepValue"
              class="wizard-answer-control"
              data-testid="login-reset-input"
              :name="resetStep.name"
              :type="resetStep.type"
              :autocomplete="resetStep.autocomplete"
              required
            />
          </label>
          <button
            v-if="resetStep.name === 'code'"
            type="button"
            class="login-text-link"
            data-testid="login-reset-resend"
            @click="resendResetCode"
          >
            Send a new code
          </button>
          <PasswordRules v-if="resetStep.name === 'newPassword'" :rules="resetPasswordRules" />
        </WorkflowStepForm>
      </template>

      <template v-else-if="isChangingPasswordMode">
        <WorkflowStepForm
          :question="passwordStep.question"
          :primary-label="passwordPrimaryLabel"
          :submit-disabled="isPasswordStepBlocked"
          :show-back="true"
          :show-cancel-action="false"
          :show-enter-hint="true"
          primary-test-id="login-password-next"
          @back="goBackPasswordStep"
          @submit="submitPasswordStep"
        >
          <label class="workflow-context-block" :aria-label="passwordStep.label">
            <input
              v-model="passwordStepValue"
              class="wizard-answer-control"
              :name="passwordStep.name"
              type="password"
              autocomplete="new-password"
              required
            />
          </label>
          <PasswordRules v-if="isChoosingNewPassword" :rules="passwordRules" />
        </WorkflowStepForm>
      </template>

      <InlineValidation v-if="errorText" :tone="errorTone" :message="errorText" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InlineValidation from '../components/ui/InlineValidation.vue'
import WorkflowCodeInput from '../components/workflow/WorkflowCodeInput.vue'
import TwoFactorCodeSteps from '../components/auth/TwoFactorCodeSteps.vue'
import TwoFactorEnrolSteps from '../components/auth/TwoFactorEnrolSteps.vue'
import PasskeyAddSteps from '../components/auth/PasskeyAddSteps.vue'
import PasswordRules from '../components/auth/PasswordRules.vue'
import { passwordRulesFor } from '../lib/passwordPolicy'
import { formatShortDate } from '../lib/utils/date'
import { authFacade } from '../lib/api/facade'
import { AUTH_REQUIRED_MESSAGE } from '../lib/api/client'
import type { PasswordResetRequestOutcome } from '../lib/api/types'
import WorkflowStepForm from '../components/workflow/WorkflowStepForm.vue'
import {
  PASSWORD_CHANGED_SIGN_IN_AGAIN,
  useAuthStore,
  type PasskeyFirstBeginOutcome,
  type TwoFactorChallengePurpose,
} from '../stores/auth'
import { conditionalMediationAvailable, getPasskeyAssertion, passkeysSupported } from '../lib/passkeys'
import { keepAccount, keptAccount, passkeyKeptFor } from '../lib/passkeyHint'
import { resolveInternalRedirectTarget } from '../lib/navigation'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const localError = ref<string | null>(null)
// DAR-UI-120. Read once: a browser does not gain WebAuthn while the page is open. Without it the steps are username,
// then password, and no passkey is offered anywhere.
const passkeysOffered = passkeysSupported()
// DAR-UI-132: this browser's device note, read once. With one, the card opens on "Welcome back." for that account,
// and its row goes to the passkey only when the note says a passkey proved them here (and this browser has WebAuthn).
const kept = keptAccount()
const welcomeByPasskey = kept?.method === 'passkey' && passkeysOffered
// DAR-UI-120: the sign-in card asks one thing at a time. The two-factor steps, the forced change and the reset all
// return to the password step they left from.
const signInStep = ref<'welcome' | 'username' | 'passkey' | 'password'>(kept ? 'welcome' : 'username')

const INITIAL_UNAUTHENTICATED_MESSAGE = 'No active authenticated session detected.'
const FALLBACK_PASSWORD_CHANGE_NOTICE = 'Your password must be changed before you can sign in.'

// Login can reject a correct username/password pair because the account is flagged to change its password
// — which every admin-created and admin-reset account is. The change surface in User Settings needs a
// session, so for exactly those users it is unreachable; this panel is the way through.
const isChangingPasswordMode = ref(false)
const passwordChangeNotice = ref<string | null>(null)
// The password the user just typed, kept because login already proved it correct. Asking for it a second
// time would be theatre.
const acceptedCurrentPassword = ref('')
const passwordStepIndex = ref(0)
const isSubmittingPasswordChange = ref(false)
const passwordForm = ref({
  newPassword: '',
  newPasswordVerify: '',
})

// DAR-BE-028 recovery email. The backend requires the current password to save one (a session token alone
// must not redirect reset codes).
const isAskingRecoveryEmail = ref(false)
const isSavingRecoveryEmail = ref(false)
const recoveryEmail = ref('')
// The password the person signed in with, out of the form the moment it is accepted and held only until the
// after-sign-in steps end: the recovery email and a grace-period two-factor setup both need it (a session token alone
// must not do either), and with two-factor neither is known to be needed until the code step has signed in.
const signInPassword = ref('')

// DAR-BE-264. Local, not read live from the store: a required setup clears the store's challenge when it signs in,
// and the recovery codes it returns still have to be shown.
const twoFactorMode = ref<TwoFactorChallengePurpose | null>(null)
const recoveryCodesLeft = ref<number | null>(null)
const isAskingTwoFactorDue = ref(false)
// Grace-period setup: whether this instance offers passkeys, read from get#TwoFactorStatus when Set up is chosen (a
// sign-in without a challenge does not say). Null while the prompt is showing.
const gracePasskeysAvailable = ref<boolean | null>(null)
const isStartingGraceSetup = ref(false)
// DAR-UI-132: set by a sign-in whose second factor was a recovery code, on a passkey browser, for an account with no
// authenticator app (DAR-UI-137: the app is enough, so it is never asked a passkey); leaveSignIn then offers a passkey
// for this device last, after every other after-sign-in step.
let offerPasskeyAfterSignIn = false
// Whether the code step's account has the authenticator app, read when the step opens: signing in clears the challenge.
let hasAuthenticatorApp = false
// The begun registration's options while "Add a passkey on this device?" shows, and whether one was added.
const passkeyOffer = ref<string | null>(null)
const passkeyAdded = ref(false)
// Signed in and on the way out: the card shows no step while the passkey offer is begun and the route changes.
const isLeaving = ref(false)
// Fewest recovery codes left before the sign-in says so (the backend's own threshold for asking for new ones).
const LOW_RECOVERY_CODES = 3

// The backend's one reply for every code failure (PasswordResetSupport.CODE_FAILURE_MESSAGE).
const CODE_FAILURE_TEXT = "That code didn't work. Request a new one."

// DAR-UI-084: the request says what happened, so the page says it too rather than leaving the person guessing.
const RESET_REQUEST_TEXT: Record<Exclude<PasswordResetRequestOutcome, 'sent'>, string> = {
  noAccount: 'No account with that username or email.',
  locked: 'That account is locked. Ask your Darpan administrator.',
  noEmail: 'That account has no email on file. Ask your Darpan administrator to add one.',
  overLimit: "That's 3 codes this hour. Use the newest one in your inbox, or try again in an hour.",
  sendFailed: "The email didn't send. Try again in a few minutes.",
}

// DAR-BE-028 forgot password. Hidden where the environment cannot send mail (no SMTP configured), so nobody
// is sent to wait for a code that never comes.
const passwordResetAvailable = ref(false)
const isResettingMode = ref(false)
const resetStepIndex = ref(0)
const isSubmittingReset = ref(false)
const resetForm = ref({ usernameOrEmail: '', code: '', newPassword: '', newPasswordVerify: '' })
// The masked address the last code went to, for the code step's note.
const resetSentTo = ref<string | null>(null)

interface ResetStep {
  name: keyof typeof resetForm.value
  label: string
  question: string
  type: 'text' | 'password'
  autocomplete: string
}
const resetSteps: readonly [ResetStep, ResetStep, ResetStep, ResetStep] = [
  { name: 'usernameOrEmail', label: 'Username or email', question: 'Username or email?', type: 'text', autocomplete: 'username' },
  { name: 'code', label: 'Reset code', question: 'Enter the code we emailed.', type: 'text', autocomplete: 'one-time-code' },
  { name: 'newPassword', label: 'New password', question: 'Enter your new password.', type: 'password', autocomplete: 'new-password' },
  { name: 'newPasswordVerify', label: 'Verify password', question: 'Enter it again.', type: 'password', autocomplete: 'new-password' },
]

const passwordSteps = [
  {
    name: 'newPassword',
    label: 'New Password',
    question: 'Enter your new password.',
  },
  {
    name: 'newPasswordVerify',
    label: 'Verify Password',
    question: 'Enter your new password again.',
  },
] as const

const passwordStep = computed(() => passwordSteps[passwordStepIndex.value] ?? passwordSteps[0])
const passwordPrimaryLabel = computed(() => {
  if (passwordStepIndex.value < passwordSteps.length - 1) return 'OK'
  return isSubmittingPasswordChange.value ? 'Changing' : 'Change'
})
const passwordStepValue = computed({
  get(): string {
    return passwordForm.value[passwordStep.value.name]
  },
  set(value: string): void {
    passwordForm.value = {
      ...passwordForm.value,
      [passwordStep.value.name]: value,
    }
  },
})
const isChoosingNewPassword = computed(() => passwordStep.value.name === 'newPassword')

const passwordRules = computed(() => passwordRulesFor(passwordForm.value.newPassword))

const newPasswordSatisfiesPolicy = computed(() => passwordRules.value.every((rule) => rule.met))

const isPasswordStepBlocked = computed(() => {
  if (isSubmittingPasswordChange.value) return true
  if (passwordStepValue.value.trim().length === 0) return true
  // Block the first step on the policy itself rather than letting the user submit and be refused by
  // the server — the rules are known here, so the round trip teaches nothing.
  if (isChoosingNewPassword.value) return !newPasswordSatisfiesPolicy.value
  return false
})

const isSignInForm = computed(() => (
  !isLeaving.value
  && passkeyOffer.value === null
  && !isChangingPasswordMode.value
  && !isResettingMode.value
  && !isAskingRecoveryEmail.value
  && twoFactorMode.value === null
  && recoveryCodesLeft.value === null
  && !isAskingTwoFactorDue.value
))

const recoveryCodesLeftQuestion = computed(() => (
  recoveryCodesLeft.value === 1 ? '1 recovery code left.' : `${recoveryCodesLeft.value ?? 0} recovery codes left.`
))

const twoFactorDueQuestion = computed(() => {
  const due = formatShortDate(authStore.twoFactorDueDate)
  return due ? `Set up two-factor by ${due}.` : 'Set up two-factor.'
})

const errorText = computed(() => {
  if (localError.value) return localError.value
  // In change mode the standing notice already explains why sign-in was refused; only a fresh failure from
  // the change itself belongs here. The two-factor steps carry their own errors.
  if (!isSignInForm.value) return null
  if (authStore.status === 'unauthenticated' && authStore.error === INITIAL_UNAUTHENTICATED_MESSAGE) return null
  return authStore.error
})

// D17 (OC90): a session ended on purpose (a changed password, an ended session) is a notice, not a refusal.
const SIGNED_OUT_NOTICES: ReadonlySet<string> = new Set([PASSWORD_CHANGED_SIGN_IN_AGAIN, AUTH_REQUIRED_MESSAGE])
const errorTone = computed(() => (errorText.value && SIGNED_OUT_NOTICES.has(errorText.value) ? 'info' : 'error'))

function hasRedirectQuery(): boolean {
  return Object.prototype.hasOwnProperty.call(route.query, 'redirect')
}

function cleanupLoginSelfRedirect(): void {
  if (!hasRedirectQuery()) return

  const redirectTarget = resolveInternalRedirectTarget(route.query.redirect)
  if (redirectTarget !== '/') return

  void router.replace({ name: 'login' })
}

onMounted(cleanupLoginSelfRedirect)
onMounted(async () => {
  passwordResetAvailable.value = await authStore.getPasswordResetAvailable()
})
watch(() => route.query.redirect, cleanupLoginSelfRedirect)

const USERNAME_NEEDED_TEXT = 'Enter your username.'
const PASSWORD_NEEDED_TEXT = 'Enter your password.'

const showsUsernameStep = computed(() => isSignInForm.value && signInStep.value === 'username')

/** The account just signed in, as the server names it, else as typed. */
function signedInName(): string {
  return authStore.username || username.value
}

/** Next on the username step. Whether the account has a passkey is never asked of the server (begin#PasskeyFirstSignIn
 *  takes no username, D16): only this browser's note opens the prompt (DAR-UI-132), so a new device, or another person
 *  on this one, gets the password. */
function submitUsername(): void {
  if (loading.value) return
  localError.value = null
  const who = username.value.trim()
  if (!who) {
    localError.value = USERNAME_NEEDED_TEXT
    return
  }
  username.value = who
  stopAutofill()
  if (passkeysOffered && passkeyKeptFor(who)) {
    signInStep.value = 'passkey'
    void signInWithPasskey()
    return
  }
  signInStep.value = 'password'
}

/** The Welcome back row: that account's passkey, or its password, by what the note says. */
function continueAsKept(): void {
  if (!kept || loading.value) return
  localError.value = null
  username.value = kept.username
  if (welcomeByPasskey) {
    signInStep.value = 'passkey'
    void signInWithPasskey()
    return
  }
  signInStep.value = 'password'
  void focusPasswordField()
}

function useAnotherAccount(): void {
  localError.value = null
  username.value = ''
  signInStep.value = 'username'
}

async function submitPassword(): Promise<void> {
  if (loading.value) return
  localError.value = null
  if (!password.value) {
    localError.value = PASSWORD_NEEDED_TEXT
    return
  }
  loading.value = true
  try {
    await signIn(username.value, password.value, 'Invalid username or password.')
  } finally {
    loading.value = false
  }
}

/** Back from the passkey or password step: the name typed stays, the password does not. */
function backToUsername(): void {
  leavePasskeyPrompt()
  localError.value = null
  password.value = ''
  signInStep.value = 'username'
}

function usePasswordInstead(): void {
  leavePasskeyPrompt()
  localError.value = null
  signInStep.value = 'password'
}

/** DAR-UI-132: the passkey is not on this device (an empty sheet, a closed one, a refusal): straight to the password,
 *  with nothing said. Its link still offers the passkey again. */
function passkeyUnavailable(): void {
  localError.value = null
  signInStep.value = 'password'
  void focusPasswordField()
}

// The open passkey prompt, so leaving its step closes it.
let passkeyPrompt: AbortController | null = null

function leavePasskeyPrompt(): void {
  if (!passkeyPrompt) return
  passkeyPrompt.abort()
  passkeyPrompt = null
  loading.value = false
}

// DAR-UI-132: Safari opens the passkey prompt only inside a click, and a click that first waits on begin#PasskeyFirstSignIn
// has spent it. So options are begun ahead where the note says a passkey proved that name here (as Welcome back shows,
// and as the username field is left holding that name), held, and begun again before their 300 s run out. The options
// name no account (D16: discoverable-only), so one set serves any name; begins are rate-limited (10 a minute an
// address), so a set held or on its way is not begun again.
const PREBEGIN_MARGIN_MS = 30_000
type HeldOptions = { pending: Promise<PasskeyFirstBeginOutcome>; begun: PasskeyFirstBeginOutcome | null }
let prebegun: HeldOptions | null = null
let prebeginRenewal: ReturnType<typeof setTimeout> | null = null

function prebegin(): void {
  if (!passkeysOffered || prebegun) return
  const pending = authStore.beginPasskeyFirstSignIn()
  const held: HeldOptions = { pending, begun: null }
  prebegun = held
  void pending.then((begun) => {
    if (prebegun !== held) return
    if (begun.outcome !== 'begun') {
      prebegun = null
      return
    }
    held.begun = begun
    const lifeMs = (begun.expiresInSeconds ?? 300) * 1000
    prebeginRenewal = setTimeout(() => {
      dropPrebegun()
      prebegin()
    }, Math.max(0, lifeMs - PREBEGIN_MARGIN_MS))
  })
}

/** The options begun ahead, taken (each challenge is used once): in hand, on their way, or null. */
function takePrebegun(): HeldOptions | null {
  const held = prebegun
  dropPrebegun()
  return held
}

function dropPrebegun(): void {
  if (prebeginRenewal !== null) clearTimeout(prebeginRenewal)
  prebeginRenewal = null
  prebegun = null
}

function prebeginTyped(): void {
  if (passkeyKeptFor(username.value)) prebegin()
}

/** The browser's passkey prompt over this site's passkeys (D16: discoverable-only; the browser lists what it holds).
 *  The password is never read. From the passkey step any way it fails goes to the password quietly; from the password
 *  step's link a failure says why. Either way the note now says password: the passkey did not prove them here. */
async function signInWithPasskey(): Promise<void> {
  if (loading.value) return
  // One WebAuthn request at a time: the autofill's waiting one goes first.
  stopAutofill()
  const who = username.value
  const step = signInStep.value
  const fromPasskeyStep = step === 'passkey'
  const controller = new AbortController()
  passkeyPrompt = controller
  // Left by Back or Use password instead while it ran: however it ends is not said.
  const left = () => controller.signal.aborted || signInStep.value !== step
  loading.value = true
  localError.value = null
  try {
    // Options in hand open the prompt with no wait between the click and it.
    const held = takePrebegun()
    const begun = held?.begun ?? (await (held?.pending ?? authStore.beginPasskeyFirstSignIn()))
    if (left()) return
    if (begun.outcome !== 'begun') {
      // Nothing was asked of the passkey, so the note stays.
      if (fromPasskeyStep) passkeyUnavailable()
      else localError.value = begun.message
      return
    }
    const asserted = await getPasskeyAssertion(begun.publicKeyOptions, controller.signal)
    if (left()) return
    if (asserted.outcome !== 'ok') {
      keepAccount(who, 'password')
      if (fromPasskeyStep) passkeyUnavailable()
      else if (asserted.outcome === 'failed') localError.value = asserted.message
      return
    }
    await finishPasskeySignIn(begun.challengeToken, asserted.json, who, fromPasskeyStep)
  } finally {
    if (passkeyPrompt === controller) {
      passkeyPrompt = null
      loading.value = false
    }
  }
}

/** Every passkey-first sign-in ends here. `typed` is the username on the card when the prompt opened; the autofill has
 *  none. True when signed in. */
async function finishPasskeySignIn(challengeToken: string, assertion: string, typed: string | null, fromPasskeyStep = false): Promise<boolean> {
  const finished = await authStore.finishPasskeyFirstSignIn(challengeToken, assertion)
  if (finished.outcome === 'signedIn') {
    const who = authStore.username || typed
    if (who) keepAccount(who, 'passkey')
    // No password was typed, so the steps that need one (a recovery email) are not asked here.
    await leaveSignIn()
    return true
  }
  if (typed && finished.reason === 'PASSWORD_CHANGE_REQUIRED') {
    // The password leads to setting a new one.
    localError.value = finished.message
    signInStep.value = 'password'
    await focusPasswordField()
    return false
  }
  if (typed && finished.reason === 'PASSKEY_REFUSED') {
    // Not that account's passkey (or not one at all): the password, here and next time.
    keepAccount(typed, 'password')
    if (fromPasskeyStep) {
      passkeyUnavailable()
      return false
    }
  }
  localError.value = finished.message
  return false
}

// The username field's autofill offers this site's passkeys while the username step shows (conditional mediation).
// Challenges live 300 s, so a fresh one is begun before then. Begins are rate-limited and the browser may say no: any
// failure here just leaves the autofill without passkeys, and says nothing.
const AUTOFILL_RENEW_MS = 270_000
let autofill: AbortController | null = null
let autofillRenewal: ReturnType<typeof setTimeout> | null = null

function stopAutofill(): void {
  if (autofillRenewal !== null) clearTimeout(autofillRenewal)
  autofillRenewal = null
  autofill?.abort()
  autofill = null
}

async function startAutofill(): Promise<void> {
  stopAutofill()
  if (!passkeysOffered) return
  const controller = new AbortController()
  autofill = controller
  if (!(await conditionalMediationAvailable()) || controller.signal.aborted) return
  autofillRenewal = setTimeout(() => { void startAutofill() }, AUTOFILL_RENEW_MS)
  const begun = await authStore.beginPasskeyFirstSignIn()
  if (begun.outcome !== 'begun' || controller.signal.aborted) return
  const asserted = await getPasskeyAssertion(begun.publicKeyOptions, controller.signal, 'conditional')
  if (asserted.outcome !== 'ok' || controller.signal.aborted) return
  stopAutofill()
  loading.value = true
  let signedIn = false
  try {
    signedIn = await finishPasskeySignIn(begun.challengeToken, asserted.json, null)
  } finally {
    loading.value = false
  }
  // Refused: that challenge is spent, so the autofill gets a fresh one.
  if (!signedIn && showsUsernameStep.value && autofill === null) void startAutofill()
}

watch(showsUsernameStep, (shown) => {
  if (shown) void startAutofill()
  else stopAutofill()
})
// Options begun ahead serve only the first card and the username step; leaving them drops what is held.
watch(
  () => isSignInForm.value && (signInStep.value === 'welcome' || signInStep.value === 'username'),
  (shown) => {
    if (!shown) dropPrebegun()
  },
)
onMounted(() => {
  if (showsUsernameStep.value) void startAutofill()
  if (signInStep.value === 'welcome' && kept && welcomeByPasskey) prebegin()
})
onBeforeUnmount(() => {
  stopAutofill()
  leavePasskeyPrompt()
  dropPrebegun()
})

async function focusPasswordField(): Promise<void> {
  await nextTick()
  document.getElementById('login-password')?.focus()
}

/** Every password sign-in (the form, after a forced change, after a reset) goes through here, so each reaches the
 *  two-factor step, the forced change and the after-sign-in steps the same way. */
async function signIn(who: string, typedPassword: string, refusedText: string): Promise<void> {
  const authenticated = await authStore.loginWithCredentials(who, typedPassword)
  if (authenticated) {
    // DAR-UI-132: a password with no second factor: this browser leads with the password next time.
    keepAccount(signedInName(), 'password')
    await finishSignIn(typedPassword)
    return
  }
  if (authStore.passwordChangeReason) {
    enterPasswordChangeMode(typedPassword)
    return
  }
  if (authStore.twoFactorChallengePurpose) {
    holdSignInPassword(typedPassword)
    hasAuthenticatorApp = authStore.twoFactorMethods.includes('app')
    twoFactorMode.value = authStore.twoFactorChallengePurpose
    return
  }
  localError.value = authStore.error ?? refusedText
}

function holdSignInPassword(typedPassword: string): void {
  signInPassword.value = typedPassword
  password.value = ''
}

function enterPasswordChangeMode(acceptedPassword: string): void {
  acceptedCurrentPassword.value = acceptedPassword
  // Prefer the backend's own wording so the reason (must change vs. expired) stays server-driven.
  passwordChangeNotice.value = authStore.error ?? FALLBACK_PASSWORD_CHANGE_NOTICE
  passwordForm.value = { newPassword: '', newPasswordVerify: '' }
  passwordStepIndex.value = 0
  isChangingPasswordMode.value = true
}

function leavePasswordChangeMode(): void {
  isChangingPasswordMode.value = false
  passwordChangeNotice.value = null
  acceptedCurrentPassword.value = ''
  passwordForm.value = { newPassword: '', newPasswordVerify: '' }
  passwordStepIndex.value = 0
}

/** Back on the first step returns to the credential form — the user may have signed in as the wrong
 *  account, and stranding them in a change flow for it would be its own dead end. */
function goBackPasswordStep(): void {
  localError.value = null
  if (passwordStepIndex.value === 0) {
    leavePasswordChangeMode()
    return
  }
  passwordStepIndex.value -= 1
}

async function submitPasswordStep(): Promise<void> {
  localError.value = null
  if (passwordStepIndex.value < passwordSteps.length - 1) {
    passwordStepIndex.value += 1
    return
  }
  await submitPasswordChange()
}

async function submitPasswordChange(): Promise<void> {
  if (isSubmittingPasswordChange.value) return
  if (passwordForm.value.newPassword !== passwordForm.value.newPasswordVerify) {
    localError.value = 'New passwords do not match.'
    return
  }

  isSubmittingPasswordChange.value = true
  try {
    const changed = await authStore.changeExpiredPassword({
      username: username.value,
      currentPassword: acceptedCurrentPassword.value,
      newPassword: passwordForm.value.newPassword,
      newPasswordVerify: passwordForm.value.newPasswordVerify,
    })
    if (!changed) {
      localError.value = authStore.error ?? 'Unable to change password.'
      return
    }

    // Sign in with the new password rather than handing back an empty form: the user came here trying to
    // reach somewhere, and the change is the only thing that was standing in the way.
    const nextPassword = passwordForm.value.newPassword
    leavePasswordChangeMode()
    await signIn(username.value, nextPassword, 'Password changed. Sign in with your new password.')
  } finally {
    isSubmittingPasswordChange.value = false
  }
}

/** Every successful sign-in ends here, so no path (plain, after a forced change, after a reset, after a code)
 *  skips the recovery-email question or the two-factor grace prompt. */
async function finishSignIn(passwordJustUsed: string): Promise<void> {
  holdSignInPassword(passwordJustUsed)
  if (authStore.recoveryEmailMissing) {
    recoveryEmail.value = ''
    isAskingRecoveryEmail.value = true
    return
  }
  await continueAfterSignIn()
}

async function continueAfterSignIn(): Promise<void> {
  isAskingRecoveryEmail.value = false
  localError.value = null
  if (authStore.twoFactorDueDate) {
    // Said here, so the shell's pill does not say it again on arrival.
    authStore.noteTwoFactorDueAnnounced()
    gracePasskeysAvailable.value = null
    isAskingTwoFactorDue.value = true
    return
  }
  await leaveSignIn()
}

async function leaveSignIn(): Promise<void> {
  isLeaving.value = true
  isAskingRecoveryEmail.value = false
  isAskingTwoFactorDue.value = false
  gracePasskeysAvailable.value = null
  signInPassword.value = ''
  localError.value = null
  if (offerPasskeyAfterSignIn) {
    offerPasskeyAfterSignIn = false
    // Refused (the 5 minutes after two-factor have passed, passkeys are off here, or anything else): no question, on in.
    if (await beginPasskeyOffer().then((begun) => begun.outcome === 'begun')) return
  }
  passkeyOffer.value = null
  passkeyAdded.value = false
  await router.replace(resolveInternalRedirectTarget(route.query.redirect))
}

/** begin#PasskeyRegistration with no proof: the sign-in that just finished two-factor is the proof, on this session,
 *  for 5 minutes. Holds the options for the offer step; PasskeyAddSteps calls it again after a refused finish. */
async function beginPasskeyOffer() {
  const begun = await authStore.beginPasskeyRegistration()
  if (begun.outcome === 'begun') {
    passkeyOffer.value = begun.publicKeyOptions
    isLeaving.value = false
  }
  return begun
}

/** Back to the password step, by choice: the person types the password again. */
function leaveTwoFactorStep(): void {
  authStore.abandonTwoFactorChallenge()
  twoFactorMode.value = null
  signInPassword.value = ''
  localError.value = null
}

function endTwoFactorStep(message: string): void {
  twoFactorMode.value = null
  signInPassword.value = ''
  localError.value = message
}

async function finishTwoFactorSignIn(codesLeft: number | null, byPasskey: boolean): Promise<void> {
  // DAR-UI-120/132: a passkey that answered the second step can be the whole sign-in on this browser next time. A code
  // from the app or a recovery code leaves it on the password; only an account without the app is asked (last) whether
  // to add a passkey here (DAR-UI-137).
  keepAccount(signedInName(), byPasskey ? 'passkey' : 'password')
  offerPasskeyAfterSignIn = !byPasskey && !hasAuthenticatorApp && passkeysOffered
  await afterTwoFactor(codesLeft)
}

/** A required first setup at sign-in. A passkey made there kept the note on the passkey already; an app leaves the
 *  password. */
async function finishTwoFactorSetup(): Promise<void> {
  if (!passkeyKeptFor(signedInName())) keepAccount(signedInName(), 'password')
  await afterTwoFactor(null)
}

async function afterTwoFactor(codesLeft: number | null): Promise<void> {
  twoFactorMode.value = null
  localError.value = null
  if (codesLeft !== null && codesLeft <= LOW_RECOVERY_CODES) {
    recoveryCodesLeft.value = codesLeft
    return
  }
  await finishSignIn(signInPassword.value)
}

async function startGraceSetup(): Promise<void> {
  if (isStartingGraceSetup.value) return
  isStartingGraceSetup.value = true
  try {
    gracePasskeysAvailable.value = (await authFacade.getTwoFactorStatus()).passkeysAvailable === true
  } catch {
    // Unread, the app is still offered: it works on every instance.
    gracePasskeysAvailable.value = false
  } finally {
    isStartingGraceSetup.value = false
  }
}

async function acknowledgeRecoveryCodesLeft(): Promise<void> {
  recoveryCodesLeft.value = null
  await finishSignIn(signInPassword.value)
}

async function saveRecoveryEmailAndContinue(): Promise<void> {
  if (isSavingRecoveryEmail.value) return
  localError.value = null
  isSavingRecoveryEmail.value = true
  try {
    const saved = await authStore.saveRecoveryEmail(recoveryEmail.value.trim(), signInPassword.value)
    if (!saved) {
      localError.value = authStore.error ?? 'Unable to save the recovery email.'
      return
    }
    await continueAfterSignIn()
  } finally {
    isSavingRecoveryEmail.value = false
  }
}

const resetStep = computed(() => resetSteps[resetStepIndex.value] ?? resetSteps[0])
const resetStepValue = computed({
  get(): string {
    return resetForm.value[resetStep.value.name]
  },
  set(value: string): void {
    resetForm.value = { ...resetForm.value, [resetStep.value.name]: value }
  },
})
const resetPasswordRules = computed(() => passwordRulesFor(resetForm.value.newPassword))
const resetPrimaryLabel = computed(() => {
  if (resetStep.value.name === 'usernameOrEmail') return 'Send code'
  if (resetStepIndex.value < resetSteps.length - 1) return 'OK'
  return isSubmittingReset.value ? 'Resetting' : 'Reset'
})
const isResetStepBlocked = computed(() => {
  if (isSubmittingReset.value) return true
  if (resetStepValue.value.trim().length === 0) return true
  if (resetStep.value.name === 'code') return resetStepValue.value.length < 6
  if (resetStep.value.name === 'newPassword') return !resetPasswordRules.value.every((rule) => rule.met)
  return false
})

function enterResetMode(): void {
  localError.value = null
  resetForm.value = { usernameOrEmail: username.value.trim(), code: '', newPassword: '', newPasswordVerify: '' }
  resetSentTo.value = null
  resetStepIndex.value = 0
  isResettingMode.value = true
}

function leaveResetMode(): void {
  isResettingMode.value = false
  resetForm.value = { usernameOrEmail: '', code: '', newPassword: '', newPasswordVerify: '' }
  resetStepIndex.value = 0
}

function goBackResetStep(): void {
  localError.value = null
  if (resetStepIndex.value === 0) {
    leaveResetMode()
    return
  }
  resetStepIndex.value -= 1
}

async function resendResetCode(): Promise<void> {
  if (isSubmittingReset.value) return
  localError.value = null
  resetForm.value = { ...resetForm.value, code: '' }
  await requestResetCode(resetForm.value.usernameOrEmail.trim())
}

/** Ask for a code and show what happened. True when there is a code to enter: one was just sent, or the
 *  hourly limit says the newest one already in the inbox is the one to use. */
async function requestResetCode(who: string): Promise<boolean> {
  const result = await authStore.requestPasswordReset(who)
  if (!result) {
    localError.value = authStore.error ?? RESET_REQUEST_TEXT.sendFailed
    return false
  }
  if (result.outcome === 'sent') {
    resetSentTo.value = result.emailAddressMasked
    return true
  }
  localError.value = RESET_REQUEST_TEXT[result.outcome]
  return result.outcome === 'overLimit'
}

async function submitResetStep(): Promise<void> {
  // One step at a time: every step awaits the backend (the request reply alone is held to 400ms), and a
  // second Enter or click in that window would advance twice and land on a later step with this one unanswered.
  if (isSubmittingReset.value) return
  isSubmittingReset.value = true
  try {
    await runResetStep()
  } finally {
    isSubmittingReset.value = false
  }
}

async function runResetStep(): Promise<void> {
  localError.value = null
  const stepName = resetStep.value.name
  const who = resetForm.value.usernameOrEmail.trim()
  if (stepName === 'usernameOrEmail') {
    if (await requestResetCode(who)) resetStepIndex.value += 1
    return
  }
  if (stepName === 'code') {
    if (!(await authStore.verifyPasswordResetCode(who, resetForm.value.code))) {
      localError.value = authStore.error ?? CODE_FAILURE_TEXT
      return
    }
    resetStepIndex.value += 1
    return
  }
  if (stepName === 'newPassword') {
    resetStepIndex.value += 1
    return
  }
  await submitPasswordReset(who)
}

async function submitPasswordReset(who: string): Promise<void> {
  if (resetForm.value.newPassword !== resetForm.value.newPasswordVerify) {
    localError.value = 'New passwords do not match.'
    return
  }
  const reset = await authStore.completePasswordReset({
    usernameOrEmail: who,
    code: resetForm.value.code,
    newPassword: resetForm.value.newPassword,
    newPasswordVerify: resetForm.value.newPasswordVerify,
  })
  if (!reset) {
    localError.value = authStore.error ?? 'Unable to reset the password.'
    // A dead code (expired, replaced, used up) is fixed on the code step, where Send a new code is; a refused
    // password is fixed on the step that chose it.
    const codeDied = authStore.error === CODE_FAILURE_TEXT
    if (codeDied) resetForm.value = { ...resetForm.value, code: '' }
    resetStepIndex.value = resetSteps.findIndex((step) => step.name === (codeDied ? 'code' : 'newPassword'))
    return
  }

  const nextPassword = resetForm.value.newPassword
  leaveResetMode()
  username.value = who
  await signIn(who, nextPassword, 'Password reset. Sign in with your new password.')
}
</script>

<style scoped>
/* DAR-UI-132: Welcome back's one account, an even row the width of the card; the whole row is the button. */
.login-account-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: center;
  min-height: var(--static-tile-min-height);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
  color: var(--text);
  text-align: left;
}

.login-account-row:hover:not(:disabled) {
  border-color: color-mix(in oklab, var(--static-tile-border) 64%, var(--accent));
  background: color-mix(in oklab, var(--static-tile-bg) 88%, var(--accent));
}

.login-account-badge {
  width: 2.4rem;
  height: 2.4rem;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font-size: var(--type-tile-size);
}

.login-account-name {
  min-width: 0;
  display: grid;
  gap: var(--space-00);
}

.login-account-name > :first-child {
  overflow-wrap: anywhere;
}

.login-account-name > :last-child {
  color: var(--text-dim);
  font-size: var(--type-note-size);
}
</style>
