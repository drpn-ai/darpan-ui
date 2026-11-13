<template>
  <!-- DAR-BE-264: the second sign-in step. The challenge token never leaves the auth store's memory; this panel
       only asks for the code (or a recovery code), or walks a required first setup. -->
  <template v-if="purpose === 'code'">
    <WorkflowStepForm
      v-if="!usingRecoveryCode"
      question="Enter the code from your app."
      :primary-label="busy ? 'Checking' : 'OK'"
      :submit-disabled="busy || code.length < 6"
      :show-back="true"
      :show-enter-hint="true"
      primary-test-id="login-two-factor-next"
      @back="emit('back')"
      @submit="submitCode"
    >
      <!-- Like the reset code: the sixth digit submits. -->
      <WorkflowCodeInput v-model="code" label="Authenticator code" test-id="login-two-factor-code" @complete="submitCode" />
      <button type="button" class="login-text-link" data-testid="login-two-factor-use-recovery" @click="switchToRecoveryCode">
        Use a recovery code
      </button>
    </WorkflowStepForm>

    <WorkflowStepForm
      v-else
      question="Enter a recovery code."
      :primary-label="busy ? 'Checking' : 'OK'"
      :submit-disabled="busy || recoveryCode.trim().length === 0"
      :show-back="true"
      :show-enter-hint="true"
      primary-test-id="login-two-factor-recovery-next"
      @back="switchToAppCode"
      @submit="submitRecoveryCode"
    >
      <label class="workflow-context-block" aria-label="Recovery code">
        <input
          v-model="recoveryCode"
          class="wizard-answer-control"
          data-testid="login-two-factor-recovery-input"
          name="recoveryCode"
          type="text"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="xxxx-xxxx-xxxx-xxxx"
          required
        />
      </label>
      <button type="button" class="login-text-link" data-testid="login-two-factor-use-app" @click="switchToAppCode">
        Use the app code
      </button>
    </WorkflowStepForm>

    <InlineValidation v-if="error" tone="error" :message="error" />
  </template>

  <template v-else>
    <TwoFactorSetupSteps
      v-if="setup"
      :setup="setup"
      :username="username"
      @back="emit('back')"
      @ended="(message) => emit('ended', message)"
      @done="emit('signed-in', null)"
    />
    <p v-else-if="!error" class="section-note" role="status">Starting setup</p>
    <InlineValidation v-if="error" tone="error" :message="error" />
    <button v-if="!setup && error" type="button" class="login-text-link" data-testid="login-two-factor-setup-back" @click="emit('back')">
      Back to sign in
    </button>
  </template>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowCodeInput from '../workflow/WorkflowCodeInput.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import TwoFactorSetupSteps from './TwoFactorSetupSteps.vue'
import { useAuthStore, type TwoFactorChallengePurpose, type TwoFactorSetupStart, type TwoFactorVerifyOutcome } from '../../stores/auth'

const props = defineProps<{
  purpose: TwoFactorChallengePurpose
  username?: string | null
}>()

const emit = defineEmits<{
  /** Signed in. recoveryCodesLeft is set only after a recovery code. */
  'signed-in': [recoveryCodesLeft: number | null]
  /** Back to the password step by choice. */
  back: []
  /** The challenge is spent (expired, used, 5 wrong codes): back to the password with this message. */
  ended: [message: string]
}>()

const authStore = useAuthStore()
const code = ref('')
const recoveryCode = ref('')
const usingRecoveryCode = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
const setup = ref<TwoFactorSetupStart | null>(null)
onMounted(async () => {
  if (props.purpose !== 'setup') return
  const result = await authStore.beginTwoFactorSetup()
  if (result.outcome === 'begun') {
    setup.value = result.setup
    return
  }
  if (result.outcome === 'ended') {
    emit('ended', result.message)
    return
  }
  error.value = result.message
})

function switchToRecoveryCode(): void {
  error.value = null
  code.value = ''
  usingRecoveryCode.value = true
}

function switchToAppCode(): void {
  error.value = null
  recoveryCode.value = ''
  usingRecoveryCode.value = false
}

function settle(result: TwoFactorVerifyOutcome): void {
  if (result.outcome === 'signedIn') {
    emit('signed-in', result.recoveryCodesLeft)
    return
  }
  if (result.outcome === 'ended') {
    emit('ended', result.message)
    return
  }
  error.value = result.message
}

async function submitCode(): Promise<void> {
  if (busy.value || code.value.length < 6) return
  busy.value = true
  error.value = null
  try {
    const result = await authStore.verifySignInCode({ code: code.value })
    if (result.outcome !== 'signedIn') code.value = ''
    settle(result)
  } finally {
    busy.value = false
  }
}

async function submitRecoveryCode(): Promise<void> {
  const typed = recoveryCode.value.trim()
  if (busy.value || !typed) return
  busy.value = true
  error.value = null
  try {
    const result = await authStore.verifySignInCode({ recoveryCode: typed })
    if (result.outcome !== 'signedIn') recoveryCode.value = ''
    settle(result)
  } finally {
    busy.value = false
  }
}
</script>
