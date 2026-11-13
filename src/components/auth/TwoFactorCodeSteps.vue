<template>
  <!-- DAR-BE-264: the second sign-in step. The challenge token never leaves the auth store's memory; this step only asks
       for the app's code, (DAR-BE-270) a passkey, or a recovery code. -->
  <WorkflowStepForm
    v-if="proof.mode.value === 'code'"
    question="Enter the code from your app."
    :primary-label="busy ? 'Checking' : 'OK'"
    :submit-disabled="busy || code.length < 6"
    :show-back="true"
    :show-enter-hint="true"
    primary-test-id="login-two-factor-next"
    @back="leave"
    @submit="submitCode"
  >
    <!-- Like the reset code: the sixth digit submits. -->
    <WorkflowCodeInput v-model="code" label="Authenticator code" test-id="login-two-factor-code" @complete="submitCode" />
    <button v-if="proof.offers('passkey')" type="button" class="login-text-link" data-testid="login-two-factor-use-passkey" :disabled="busy" @click="switchTo('passkey')">
      Use a passkey
    </button>
    <button type="button" class="login-text-link" data-testid="login-two-factor-use-recovery" :disabled="busy" @click="switchTo('recovery')">
      Use a recovery code
    </button>
  </WorkflowStepForm>

  <!-- DAR-BE-270: the browser's own prompt does the asking; Continue opens it again after a closed one. -->
  <WorkflowStepForm
    v-else-if="proof.mode.value === 'passkey'"
    question="Confirm with your passkey."
    :primary-label="busy ? 'Waiting' : 'Continue'"
    :submit-disabled="busy || proof.preparing.value"
    :show-back="true"
    :show-enter-hint="true"
    primary-test-id="login-two-factor-passkey-next"
    @back="leave"
    @submit="submitPasskey"
  >
    <button v-if="proof.offers('code')" type="button" class="login-text-link" data-testid="login-two-factor-use-app" :disabled="busy" @click="switchTo('code')">
      Use the app code
    </button>
    <button type="button" class="login-text-link" data-testid="login-two-factor-use-recovery" :disabled="busy" @click="switchTo('recovery')">
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
    @back="leave"
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
    <button v-if="proof.offers('code')" type="button" class="login-text-link" data-testid="login-two-factor-use-app" :disabled="busy" @click="switchTo('code')">
      Use the app code
    </button>
    <button v-if="proof.offers('passkey')" type="button" class="login-text-link" data-testid="login-two-factor-use-passkey" :disabled="busy" @click="switchTo('passkey')">
      Use a passkey
    </button>
  </WorkflowStepForm>

  <InlineValidation tone="error" :message="error" />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowCodeInput from '../workflow/WorkflowCodeInput.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import { useTwoFactorProof, type ProofMode } from '../../composables/useTwoFactorProof'
import type { TwoFactorRefusal } from '../../lib/twoFactor'
import { useAuthStore, type TwoFactorVerifyOutcome } from '../../stores/auth'

const emit = defineEmits<{
  /** Signed in. recoveryCodesLeft is set only after a recovery code. */
  'signed-in': [recoveryCodesLeft: number | null]
  /** Back to the password step by choice. */
  back: []
  /** The challenge is spent (expired, used, 5 wrong answers): back to the password with this message. */
  ended: [message: string]
}>()

const authStore = useAuthStore()
const code = ref('')
const recoveryCode = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const proof = useTwoFactorProof({ begin: authStore.beginPasskeySignIn, onRefused: settle })
// What this person can answer with (login#Session's twoFactorMethods): the app first, else a passkey, else a recovery
// code. Back from the others returns here.
proof.start({ app: authStore.twoFactorMethods.includes('app'), passkey: authStore.twoFactorMethods.includes('passkey') }, 'recovery')
const firstMode: ProofMode = proof.mode.value ?? 'recovery'

onMounted(async () => {
  // Passkey first: open the prompt as soon as its options are in. A browser that wants a click first leaves Continue.
  if (firstMode !== 'passkey') return
  await proof.prepare()
  if (proof.ready.value) await submitPasskey()
})

function switchTo(next: ProofMode): void {
  error.value = null
  code.value = ''
  recoveryCode.value = ''
  proof.choose(next)
}

function leave(): void {
  if (proof.mode.value === firstMode) emit('back')
  else switchTo(firstMode)
}

function settle(result: TwoFactorVerifyOutcome | TwoFactorRefusal): void {
  if (result.outcome === 'signedIn') emit('signed-in', result.recoveryCodesLeft)
  else if (result.outcome === 'ended') emit('ended', result.message)
  else error.value = result.message
}

/** One answer at a time: busy holds the buttons and the switch links until it settles. */
async function answering(task: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    await task()
  } finally {
    busy.value = false
  }
}

/** verify#SignInCode with one answer; a refusal clears what was typed. */
async function send(input: Parameters<typeof authStore.verifySignInCode>[0]): Promise<TwoFactorVerifyOutcome> {
  const result = await authStore.verifySignInCode(input)
  if (result.outcome !== 'signedIn') {
    code.value = ''
    recoveryCode.value = ''
  }
  settle(result)
  return result
}

function submitCode(): Promise<void> {
  return answering(async () => {
    if (code.value.length === 6) await send({ code: code.value })
  })
}

function submitRecoveryCode(): Promise<void> {
  return answering(async () => {
    const typed = recoveryCode.value.trim()
    if (typed) await send({ recoveryCode: typed })
  })
}

function submitPasskey(): Promise<void> {
  return answering(async () => {
    const proved = await proof.prove()
    // A closed prompt is not a refusal: the same options wait for the next Continue, and nothing is said.
    if (proved.outcome === 'failed') error.value = proved.message
    if (proved.outcome !== 'ok') return
    const result = await send({ passkeyAssertion: proved.passkeyAssertion })
    // The assertion used its options up: the next set now, ahead of the retry's click.
    if (result.outcome === 'refused') void proof.prepare()
  })
}
</script>
