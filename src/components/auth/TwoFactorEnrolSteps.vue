<template>
  <!-- DAR-BE-264/270: a first two-factor setup at sign-in, required or in the grace period. Which factor first, then that
       factor's own steps; the recovery codes come last either way. -->
  <TwoFactorSetupSteps
    v-if="setup"
    :setup="setup"
    :username="username"
    @back="backToChoice"
    @ended="setupEnded"
    @done="emit('done')"
  />
  <PasskeyAddSteps
    v-else-if="passkeyOptions"
    :options="passkeyOptions"
    :rebegin="beginPasskey"
    :username="username"
    @back="backToChoice"
    @ended="setupEnded"
    @done="emit('done')"
  />
  <WorkflowStepForm
    v-else
    :question="passkeysOffered ? 'Authenticator app or passkey?' : 'Set up an authenticator app.'"
    :primary-label="starting ? 'Starting' : 'OK'"
    :submit-disabled="starting"
    :show-back="true"
    :show-enter-hint="true"
    primary-test-id="two-factor-enrol-next"
    @back="emit('back')"
    @submit="start"
  >
    <WorkflowShortcutChoiceCards
      v-if="passkeysOffered"
      :options="FACTORS"
      :selected-value="factor"
      test-id-prefix="two-factor-enrol"
      @choose="(value) => (factor = value as Factor)"
    />
  </WorkflowStepForm>

  <InlineValidation tone="error" :message="error" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowShortcutChoiceCards from '../workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import PasskeyAddSteps from './PasskeyAddSteps.vue'
import TwoFactorSetupSteps from './TwoFactorSetupSteps.vue'
import { passkeysSupported } from '../../lib/passkeys'
import type { TwoFactorRefusal } from '../../lib/twoFactor'
import { useAuthStore, type TwoFactorProof, type TwoFactorSetupStart } from '../../stores/auth'

type Factor = 'app' | 'passkey'

const FACTORS: { value: Factor; label: string; shortcutKey: string }[] = [
  { value: 'app', label: 'Authenticator app', shortcutKey: 'A' },
  { value: 'passkey', label: 'Passkey', shortcutKey: 'P' },
]

const props = defineProps<{
  /** The password just used, in the grace period. Absent at a required setup: the sign-in challenge is the proof. */
  proof?: TwoFactorProof
  username?: string | null
}>()

const emit = defineEmits<{
  /** Two-factor is on, this tab holds the new key, and the recovery codes were seen. */
  done: []
  back: []
  /** The sign-in challenge is spent: back to the password with this message. */
  ended: [message: string]
}>()

const authStore = useAuthStore()
const factor = ref<Factor>('app')
const starting = ref(false)
const error = ref<string | null>(null)
const setup = ref<TwoFactorSetupStart | null>(null)
const passkeyOptions = ref<string | null>(null)
// Offered where this browser can make one, until the instance says it has none (the refusal is the only way to know).
const passkeysOffered = ref(passkeysSupported())

function beginPasskey() {
  return authStore.beginPasskeyRegistration(props.proof)
}

async function start(): Promise<void> {
  if (starting.value) return
  starting.value = true
  error.value = null
  try {
    if (factor.value === 'passkey') {
      const result = await beginPasskey()
      if (result.outcome === 'begun') passkeyOptions.value = result.publicKeyOptions
      else refused(result)
      return
    }
    const result = await authStore.beginTwoFactorSetup(props.proof)
    if (result.outcome === 'begun') setup.value = result.setup
    else refused(result)
  } finally {
    starting.value = false
  }
}

function refused(result: TwoFactorRefusal): void {
  if (result.outcome === 'ended') {
    setupEnded(result.message)
    return
  }
  if (result.reason === 'passkeysUnavailable') {
    passkeysOffered.value = false
    factor.value = 'app'
  }
  error.value = result.message
}

/** Through a challenge, back to the password. Signed in (the grace period), a setup left too long starts again here. */
function setupEnded(message: string): void {
  if (!props.proof) {
    emit('ended', message)
    return
  }
  setup.value = null
  passkeyOptions.value = null
  error.value = message
}

function backToChoice(): void {
  setup.value = null
  passkeyOptions.value = null
  error.value = null
  // With nothing to choose, the choice step is only a wait: Back goes past it.
  if (!passkeysOffered.value) emit('back')
}

// The cards draw the A and P badges; the keys are wired here, as every page with choice cards does. Skipped while
// typing, and Enter outside the form (a letter leaves focus on the page) starts, as the hint says.
function handleShortcut(event: KeyboardEvent): void {
  if (setup.value || passkeyOptions.value || !passkeysOffered.value) return
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
  if (event.key === 'Enter' && !(target instanceof Element && target.closest('form'))) {
    event.preventDefault()
    void start()
    return
  }
  const option = FACTORS.find((candidate) => candidate.shortcutKey === event.key.toUpperCase())
  if (!option) return
  event.preventDefault()
  factor.value = option.value
}

onMounted(() => {
  window.addEventListener('keydown', handleShortcut)
  // Nothing to choose: begin the app at once.
  if (!passkeysOffered.value) void start()
})
onBeforeUnmount(() => window.removeEventListener('keydown', handleShortcut))
</script>
