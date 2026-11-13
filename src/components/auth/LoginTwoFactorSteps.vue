<template>
  <!-- DAR-BE-264: the second sign-in step. The challenge token never leaves the auth store's memory; this panel
       only asks for the code (or a recovery code, or DAR-BE-270 a passkey), or walks a required first setup. -->
  <template v-if="purpose === 'code'">
    <WorkflowStepForm
      v-if="mode === 'app'"
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
      <button v-if="passkeyOffered" type="button" class="login-text-link" data-testid="login-two-factor-use-passkey" @click="switchTo('passkey')">
        Use a passkey
      </button>
      <button type="button" class="login-text-link" data-testid="login-two-factor-use-recovery" @click="switchTo('recovery')">
        Use a recovery code
      </button>
    </WorkflowStepForm>

    <!-- DAR-BE-270: the browser's own prompt does the asking; Continue opens it again after a closed one. -->
    <WorkflowStepForm
      v-else-if="mode === 'passkey'"
      question="Confirm with your passkey."
      :primary-label="busy ? 'Waiting' : 'Continue'"
      :submit-disabled="busy"
      :show-back="true"
      :show-enter-hint="true"
      primary-test-id="login-two-factor-passkey-next"
      @back="leave('passkey')"
      @submit="submitPasskey"
    >
      <button v-if="hasApp" type="button" class="login-text-link" data-testid="login-two-factor-use-app" @click="switchTo('app')">
        Use the app code
      </button>
      <button type="button" class="login-text-link" data-testid="login-two-factor-use-recovery" @click="switchTo('recovery')">
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
      @back="leave('recovery')"
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
      <button v-if="hasApp" type="button" class="login-text-link" data-testid="login-two-factor-use-app" @click="switchTo('app')">
        Use the app code
      </button>
      <button v-if="passkeyOffered" type="button" class="login-text-link" data-testid="login-two-factor-use-passkey" @click="switchTo('passkey')">
        Use a passkey
      </button>
    </WorkflowStepForm>

    <InlineValidation v-if="error" tone="error" :message="error" />
  </template>

  <template v-else>
    <PasskeyAddSteps
      v-if="passkeySetupOptions"
      :options="passkeySetupOptions"
      :rebegin="authStore.beginPasskeyRegistration"
      :username="username"
      @back="passkeySetupOptions = null"
      @ended="(message) => emit('ended', message)"
      @done="emit('signed-in', null)"
    />
    <TwoFactorSetupSteps
      v-else-if="setup"
      :setup="setup"
      :username="username"
      :offer-passkey="passkeySetupOffered"
      :passkey-busy="startingPasskeySetup"
      @back="emit('back')"
      @ended="(message) => emit('ended', message)"
      @done="emit('signed-in', null)"
      @use-passkey="startPasskeySetup"
    />
    <p v-else-if="!error" class="section-note" role="status">Starting setup</p>
    <InlineValidation v-if="error" tone="error" :message="error" />
    <button v-if="!setup && error" type="button" class="login-text-link" data-testid="login-two-factor-setup-back" @click="emit('back')">
      Back to sign in
    </button>
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowCodeInput from '../workflow/WorkflowCodeInput.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import PasskeyAddSteps from './PasskeyAddSteps.vue'
import TwoFactorSetupSteps from './TwoFactorSetupSteps.vue'
import { getPasskeyAssertion, passkeysSupported, PASSKEYS_UNAVAILABLE_TEXT } from '../../lib/passkeys'
import {
  useAuthStore,
  type PasskeyBeginOutcome,
  type TwoFactorChallengePurpose,
  type TwoFactorSetupStart,
  type TwoFactorVerifyOutcome,
} from '../../stores/auth'

type Mode = 'app' | 'passkey' | 'recovery'

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
const busy = ref(false)
const error = ref<string | null>(null)
const setup = ref<TwoFactorSetupStart | null>(null)

// What this person can answer with (login#Session's twoFactorMethods), and what this browser can do.
const hasApp = computed(() => authStore.twoFactorMethods.includes('app'))
const passkeyOffered = computed(() => authStore.twoFactorMethods.includes('passkey') && passkeysSupported())
/** Where the step starts and where Back from the others returns: the app, else a passkey, else a recovery code. */
const firstMode = computed<Mode>(() => (hasApp.value ? 'app' : passkeyOffered.value ? 'passkey' : 'recovery'))
const mode = ref<Mode>(firstMode.value)

// begin#PasskeySignIn's options, fetched as the passkey step shows so Continue opens the prompt straight from its click.
let passkeyOptions: Promise<PasskeyBeginOutcome> | null = null

function preparePasskey(): void {
  if (!passkeyOptions) passkeyOptions = authStore.beginPasskeySignIn()
}

onMounted(async () => {
  if (props.purpose === 'code') {
    // Passkey only: open the prompt at once. A browser that wants a click first just leaves Continue on screen.
    if (mode.value === 'passkey') await submitPasskey()
    return
  }
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

function switchTo(next: Mode): void {
  error.value = null
  code.value = ''
  recoveryCode.value = ''
  mode.value = next
  if (next === 'passkey') preparePasskey()
}

function leave(from: Mode): void {
  if (firstMode.value === from) emit('back')
  else switchTo(firstMode.value)
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

async function submitPasskey(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    preparePasskey()
    const begun = await (passkeyOptions as Promise<PasskeyBeginOutcome>)
    if (begun.outcome !== 'begun') {
      passkeyOptions = null
      settle(begun)
      return
    }
    const ceremony = await getPasskeyAssertion(begun.publicKeyOptions)
    // A closed prompt is not a refusal: the same options wait for the next Continue, and nothing is said.
    if (ceremony.outcome === 'cancelled') return
    passkeyOptions = null
    if (ceremony.outcome === 'failed') {
      error.value = ceremony.message
      preparePasskey()
      return
    }
    const result = await authStore.verifySignInCode({ passkeyAssertion: ceremony.json })
    settle(result)
    if (result.outcome === 'refused') preparePasskey()
  } finally {
    busy.value = false
  }
}

// ─── Forced setup: a passkey instead of the app (DAR-BE-270) ──────────────────────────────────────────────────────

const passkeySetupOptions = ref<string | null>(null)
const startingPasskeySetup = ref(false)
// login#Session does not say whether this instance has passkeys for a setup challenge; the first refusal does.
const passkeysUnavailableHere = ref(false)
const passkeySetupOffered = computed(() => passkeysSupported() && !passkeysUnavailableHere.value)

async function startPasskeySetup(): Promise<void> {
  if (startingPasskeySetup.value) return
  startingPasskeySetup.value = true
  error.value = null
  try {
    const result = await authStore.beginPasskeyRegistration()
    if (result.outcome === 'begun') {
      passkeySetupOptions.value = result.publicKeyOptions
      return
    }
    if (result.outcome === 'ended') {
      emit('ended', result.message)
      return
    }
    if (result.message === PASSKEYS_UNAVAILABLE_TEXT) passkeysUnavailableHere.value = true
    error.value = result.message
  } finally {
    startingPasskeySetup.value = false
  }
}
</script>
