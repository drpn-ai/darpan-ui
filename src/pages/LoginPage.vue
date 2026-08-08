<template>
  <main class="login-page">
    <section class="login-panel">
      <p class="eyebrow">Darpan</p>
      <h1>{{ isChangingPasswordMode ? 'Change Password' : 'Sign In' }}</h1>

      <form v-if="!isChangingPasswordMode" class="stack-md" @submit.prevent="submit" @keydown.enter="requestSubmitOnEnter">
        <label>
          <span>Username</span>
          <input v-model="username" type="text" autocomplete="username" required />
        </label>

        <label>
          <span>Password</span>
          <input v-model="password" type="password" autocomplete="current-password" required />
        </label>

        <div class="action-row">
          <button type="submit" :disabled="loading">Sign In</button>
        </div>
      </form>

      <template v-else>
        <p class="section-note">{{ passwordChangeNotice }}</p>

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
const isPasswordStepBlocked = computed(() => {
  if (isSubmittingPasswordChange.value) return true
  return passwordStepValue.value.trim().length === 0
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
