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

    <section class="login-panel">
      <p class="eyebrow">Darpan</p>
      <!-- No heading in change mode: the step's own question ("Enter your new password.") is the
           instruction, and a title above it only restated that in larger type. -->
      <h1 v-if="!isChangingPasswordMode">Sign In</h1>

      <form v-if="!isChangingPasswordMode" class="stack-md" @submit.prevent="submit" @keydown.enter="requestSubmitOnEnter">
        <!-- The wrapping label already names each field for assistive tech; id/name are here for the
             password managers that still key off them rather than the autocomplete tokens. -->
        <label for="login-username">
          <span>Username</span>
          <input id="login-username" v-model="username" name="username" type="text" autocomplete="username" required />
        </label>

        <label for="login-password">
          <span>Password</span>
          <input id="login-password" v-model="password" name="password" type="password" autocomplete="current-password" required />
        </label>

        <div class="action-row">
          <button type="submit" :disabled="loading">Sign In</button>
        </div>
      </form>

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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import InlineValidation from '../components/ui/InlineValidation.vue'
import WorkflowStepForm from '../components/workflow/WorkflowStepForm.vue'
import { useAuthStore } from '../stores/auth'
import { requestSubmitOnEnter } from '../lib/keyboard'
import { resolveInternalRedirectTarget } from '../lib/navigation'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const localError = ref<string | null>(null)

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
// Mirrors the backend policy in MoquiDefaultConf's <user-facade><password ...>:
// min-length="8" min-digits="1" min-others="1". Kept in one place so the helper text, the live
// checks and the submit gate can never drift apart. history-limit="5" is deliberately not listed:
// only the server can know a user's previous passwords, so it stays a server-side rejection.
const PASSWORD_MIN_LENGTH = 8

const isChoosingNewPassword = computed(() => passwordStep.value.name === 'newPassword')

const passwordRules = computed(() => {
  const value = passwordForm.value.newPassword
  return [
    { id: 'length', label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH },
    { id: 'digit', label: 'At least one number', met: /\d/.test(value) },
    { id: 'other', label: 'At least one symbol (not a letter or number)', met: /[^\p{L}\p{N}]/u.test(value) },
  ]
})

const newPasswordSatisfiesPolicy = computed(() => passwordRules.value.every((rule) => rule.met))

const isPasswordStepBlocked = computed(() => {
  if (isSubmittingPasswordChange.value) return true
  if (passwordStepValue.value.trim().length === 0) return true
  // Block the first step on the policy itself rather than letting the user submit and be refused by
  // the server — the rules are known here, so the round trip teaches nothing.
  if (isChoosingNewPassword.value) return !newPasswordSatisfiesPolicy.value
  return false
})

const errorText = computed(() => {
  if (localError.value) return localError.value
  // In change mode the standing notice already explains why sign-in was refused; only a fresh failure from
  // the change itself belongs here.
  if (isChangingPasswordMode.value) return null
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
watch(() => route.query.redirect, cleanupLoginSelfRedirect)

async function submit(): Promise<void> {
  loading.value = true
  localError.value = null
  try {
    const authenticated = await authStore.loginWithCredentials(username.value, password.value)
    if (!authenticated) {
      if (authStore.passwordChangeReason) {
        enterPasswordChangeMode()
        return
      }
      localError.value = authStore.error ?? 'Invalid username or password.'
      return
    }

    await router.replace(resolveInternalRedirectTarget(route.query.redirect))
  } finally {
    loading.value = false
  }
}

function enterPasswordChangeMode(): void {
  acceptedCurrentPassword.value = password.value
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
    password.value = nextPassword

    const authenticated = await authStore.loginWithCredentials(username.value, nextPassword)
    if (!authenticated) {
      localError.value = authStore.error ?? 'Password changed. Sign in with your new password.'
      return
    }

    await router.replace(resolveInternalRedirectTarget(route.query.redirect))
  } finally {
    isSubmittingPasswordChange.value = false
  }
}
</script>
