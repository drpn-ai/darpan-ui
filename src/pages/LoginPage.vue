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
      <!-- No heading in change mode: the step's own question ("Enter your new password.") is the
           instruction, and a title above it only restated that in larger type. -->
      <h1 v-if="isSignInForm">Sign In</h1>

      <!-- DAR-UI-120: username first, then the passkey (for a username this browser saw sign in with one) or the
           password. id/name stay on the fields for the password managers that key off them, not the autocomplete tokens. -->
      <template v-if="isSignInForm">
        <WorkflowStepForm
          v-if="signInStep === 'username'"
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
          <button type="button" class="login-text-link" data-testid="login-use-password" @click="usePasswordInstead">
            Use password instead
          </button>
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
          <!-- Scoped to the username: a security key that holds no discoverable passkey, or a passkey on a phone. -->
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
        </WorkflowStepForm>
      </template>

      <!-- DAR-BE-264: the password was right; the session waits for a code, or for a required first setup. -->
      <TwoFactorCodeSteps
        v-else-if="twoFactorMode === 'code'"
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
        @done="finishTwoFactorSignIn(null)"
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
          <ul v-if="resetStep.name === 'newPassword'" class="password-rules" aria-label="Password requirements">
            <li v-for="rule in resetPasswordRules" :key="rule.id" :data-met="String(rule.met)" :class="{ met: rule.met }">
              <span aria-hidden="true" class="password-rule-mark">{{ rule.met ? '✓' : '·' }}</span>
              <span>{{ rule.label }}</span>
            </li>
          </ul>
        </WorkflowStepForm>
      </template>

      <template v-else>
        <WorkflowStepForm
          :question="passwordStepQuestion"
          :primary-label="passwordPrimaryLabel"
          :submit-disabled="isPasswordStepBlocked"
          :show-back="true"
          :show-cancel-action="false"
          :show-enter-hint="true"
          primary-test-id="login-password-next"
          @back="goBackPasswordStep"
          @submit="submitPasswordStep"
        >
          <label class="workflow-context-block" :aria-label="passwordStepLabel">
            <input
              v-model="passwordStepValue"
              class="wizard-answer-control"
              :name="passwordStepName"
              type="password"
              autocomplete="new-password"
              required
            />
          </label>

          <!-- Stated up front and checked as the user types. Without this the only way to discover
               the backend's policy was to be rejected by it after submitting. -->
          <ul v-if="isChoosingNewPassword" class="password-rules" aria-label="Password requirements">
            <li
              v-for="rule in passwordRules"
              :key="rule.id"
              :data-testid="`password-rule-${rule.id}`"
              :data-met="String(rule.met)"
              :class="{ met: rule.met }"
            >
              <span aria-hidden="true" class="password-rule-mark">{{ rule.met ? '✓' : '·' }}</span>
              <span>{{ rule.label }}</span>
            </li>
          </ul>
        </WorkflowStepForm>
      </template>

      <InlineValidation v-if="errorText" tone="error" :message="errorText" />
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
import { formatShortDate } from '../lib/utils/date'
import { authFacade } from '../lib/api/facade'
import type { TwoFactorChallengePurpose } from '../stores/auth'
import type { PasswordResetRequestOutcome } from '../lib/api/types'
import WorkflowStepForm from '../components/workflow/WorkflowStepForm.vue'
import { useAuthStore } from '../stores/auth'
import { conditionalMediationAvailable, getPasskeyAssertion, passkeysSupported } from '../lib/passkeys'
import { forgetPasskey, hasRememberedPasskey, rememberPasskey } from '../lib/passkeyHint'
import { resolveInternalRedirectTarget } from '../lib/navigation'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const localError = ref<string | null>(null)
// DAR-UI-120: the sign-in card asks one thing at a time. The two-factor steps, the forced change and the reset all
// return to the password step they left from.
const signInStep = ref<'username' | 'passkey' | 'password'>('username')

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
const passwordStepQuestion = computed(() => passwordStep.value.question)
const passwordStepLabel = computed(() => passwordStep.value.label)
const passwordStepName = computed(() => passwordStep.value.name)
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
// Mirrors the backend policy: darpan's MoquiConf <password min-length="12"/> (DAR-BE-268) over
// MoquiDefaultConf's min-digits="1" min-others="1". Kept in one place so the helper text, the live
// checks and the submit gate can never drift apart. history-limit="5" is deliberately not listed:
// only the server can know a user's previous passwords, so it stays a server-side rejection.
const PASSWORD_MIN_LENGTH = 12

const isChoosingNewPassword = computed(() => passwordStep.value.name === 'newPassword')

function passwordRulesFor(value: string) {
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH },
    { id: 'digit', label: 'At least one number', met: /\d/.test(value) },
    { id: 'other', label: 'At least one symbol (not a letter or number)', met: /[^\p{L}\p{N}]/u.test(value) },
  ]
}

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
  !isChangingPasswordMode.value
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

// DAR-UI-120. Read once: a browser does not gain WebAuthn while the page is open. Without it the steps are username,
// then password, and no passkey is offered anywhere.
const passkeysOffered = passkeysSupported()
const PASSKEY_CANCELLED_TEXT = 'Passkey sign-in was cancelled.'
const USERNAME_NEEDED_TEXT = 'Enter your username.'
const PASSWORD_NEEDED_TEXT = 'Enter your password.'

const showsUsernameStep = computed(() => isSignInForm.value && signInStep.value === 'username')

/** Next on the username step. Whether the account has a passkey is never asked of the server (begin#PasskeyFirstSignIn
 *  answers a decoy for an unknown username, DAR-BE-301): only this browser's memory of a passkey sign-in opens the
 *  prompt; everyone else gets the password. */
async function submitUsername(): Promise<void> {
  if (loading.value) return
  localError.value = null
  const who = username.value.trim()
  if (!who) {
    localError.value = USERNAME_NEEDED_TEXT
    return
  }
  username.value = who
  stopAutofill()
  loading.value = true
  const remembered = passkeysOffered && (await hasRememberedPasskey(who))
  loading.value = false
  signInStep.value = remembered ? 'passkey' : 'password'
  if (remembered) await signInWithPasskey()
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

// The open passkey prompt, so leaving its step closes it.
let passkeyPrompt: AbortController | null = null

function leavePasskeyPrompt(): void {
  if (!passkeyPrompt) return
  passkeyPrompt.abort()
  passkeyPrompt = null
  loading.value = false
}

/** The browser's passkey prompt, scoped to the username typed (a security key with no discoverable passkey needs that).
 *  The password is never read. */
async function signInWithPasskey(): Promise<void> {
  if (loading.value) return
  // One WebAuthn request at a time: the autofill's waiting one goes first.
  stopAutofill()
  const who = username.value
  const step = signInStep.value
  const controller = new AbortController()
  passkeyPrompt = controller
  // Left by Back or Use password instead while it ran: however it ends is not said.
  const left = () => controller.signal.aborted || signInStep.value !== step
  loading.value = true
  localError.value = null
  try {
    const begun = await authStore.beginPasskeyFirstSignIn(who)
    if (left()) return
    if (begun.outcome !== 'begun') {
      localError.value = begun.message
      return
    }
    const asserted = await getPasskeyAssertion(begun.publicKeyOptions, controller.signal)
    if (left()) return
    if (asserted.outcome === 'cancelled') {
      localError.value = PASSKEY_CANCELLED_TEXT
      return
    }
    if (asserted.outcome === 'failed') {
      localError.value = asserted.message
      await forgetPasskey(who)
      return
    }
    await finishPasskeySignIn(begun.challengeToken, asserted.json, who)
  } finally {
    if (passkeyPrompt === controller) {
      passkeyPrompt = null
      loading.value = false
    }
  }
}

/** Every passkey-first sign-in ends here. `typed` is the username the prompt was scoped to; the autofill has none, so the
 *  signed-in account's own name is remembered instead. True when signed in. */
async function finishPasskeySignIn(challengeToken: string, assertion: string, typed: string | null): Promise<boolean> {
  const finished = await authStore.finishPasskeyFirstSignIn(challengeToken, assertion)
  if (finished.outcome === 'signedIn') {
    const who = typed || authStore.username
    if (who) await rememberPasskey(who)
    // No password was typed, so the steps that need one (a recovery email) are not asked here.
    await leaveSignIn()
    return true
  }
  localError.value = finished.message
  if (!typed) return false
  if (finished.reason === 'PASSWORD_CHANGE_REQUIRED') {
    // The password leads to setting a new one.
    signInStep.value = 'password'
    await focusPasswordField()
  } else if (finished.reason === 'PASSKEY_REFUSED') {
    // Not that account's passkey (or not one at all): Next goes to the password from now on.
    await forgetPasskey(typed)
  }
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
  const begun = await authStore.beginPasskeyFirstSignIn('')
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
onMounted(() => {
  if (showsUsernameStep.value) void startAutofill()
})
onBeforeUnmount(() => {
  stopAutofill()
  leavePasskeyPrompt()
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
    await finishSignIn(typedPassword)
    return
  }
  if (authStore.passwordChangeReason) {
    enterPasswordChangeMode(typedPassword)
    return
  }
  if (authStore.twoFactorChallengePurpose) {
    holdSignInPassword(typedPassword)
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
  isAskingRecoveryEmail.value = false
  isAskingTwoFactorDue.value = false
  gracePasskeysAvailable.value = null
  signInPassword.value = ''
  localError.value = null
  await router.replace(resolveInternalRedirectTarget(route.query.redirect))
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

async function finishTwoFactorSignIn(codesLeft: number | null, byPasskey = false): Promise<void> {
  // DAR-UI-120: a passkey that answered the second step can be the whole sign-in next time.
  if (byPasskey) await rememberPasskey(username.value)
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
