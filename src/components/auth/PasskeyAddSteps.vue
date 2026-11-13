<template>
  <!-- DAR-BE-270: the browser's passkey prompt, then (first factor only) the recovery codes. The caller has begun the
       registration, so the prompt opens straight from the Continue click (Safari opens it only inside a click). -->
  <WorkflowStepForm
    v-if="!recoveryCodes"
    :class="formClass"
    question="Add a passkey."
    :primary-label="busy ? 'Waiting' : 'Continue'"
    :submit-disabled="busy"
    :show-back="!busy"
    :show-enter-hint="true"
    primary-test-id="passkey-add-next"
    @back="emit('back')"
    @submit="add"
  />

  <WorkflowStepForm
    v-else
    :class="formClass"
    question="Save your recovery codes."
    primary-label="I saved them"
    :show-enter-hint="false"
    primary-test-id="two-factor-codes-saved"
    @submit="emit('done')"
  >
    <TwoFactorRecoveryCodes :codes="recoveryCodes" :username="username" />
  </WorkflowStepForm>

  <InlineValidation v-if="error" tone="error" :message="error" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import TwoFactorRecoveryCodes from './TwoFactorRecoveryCodes.vue'
import { createPasskey } from '../../lib/passkeys'
import { useAuthStore } from '../../stores/auth'
import type { PasskeyBeginOutcome } from '../../lib/twoFactor'

const props = defineProps<{
  /** begin#PasskeyRegistration's options. */
  options: string
  /** Begins again after a refused finish, when the proof can be used again (a setup challenge, the password). */
  rebegin?: () => Promise<PasskeyBeginOutcome>
  username?: string | null
  /** `workflow-form--popup-compact` inside a settings popup. */
  formClass?: string
}>()

const emit = defineEmits<{
  /** The passkey is saved. firstFactor: two-factor just turned on and this tab holds the new key. */
  added: [firstFactor: boolean]
  /** Finished: "I saved them", or straight after an added passkey that was not the first factor. */
  done: []
  back: []
  /** The sign-in challenge is spent: back to the password. */
  ended: [message: string]
  /** The registration was refused and its options are used up; without rebegin the caller asks for proof again. */
  refused: [message: string]
}>()

const authStore = useAuthStore()
const busy = ref(false)
const error = ref<string | null>(null)
const recoveryCodes = ref<string[] | null>(null)
let current: string | null = props.options

async function add(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = null
  try {
    if (!current && !(await beginAgain())) return
    const ceremony = await createPasskey(current as string)
    // A closed prompt is not a refusal: stay here with the same options and say nothing.
    if (ceremony.outcome === 'cancelled') return
    if (ceremony.outcome === 'failed') {
      error.value = ceremony.message
      return
    }
    const result = await authStore.finishPasskeyRegistration(ceremony.json)
    if (result.outcome === 'added') {
      emit('added', result.recoveryCodes.length > 0)
      if (result.recoveryCodes.length > 0) recoveryCodes.value = result.recoveryCodes
      else emit('done')
      return
    }
    current = null
    if (result.outcome === 'ended') {
      emit('ended', result.message)
      return
    }
    if (!props.rebegin) {
      emit('refused', result.message)
      return
    }
    // Fresh options now, so the next Continue opens the prompt straight from its click.
    if (await beginAgain()) error.value = result.message
  } finally {
    busy.value = false
  }
}

/** Fresh options after a refusal; false when they could not be had (the reason is on screen or emitted). */
async function beginAgain(): Promise<boolean> {
  if (!props.rebegin) return false
  const again = await props.rebegin()
  if (again.outcome === 'begun') {
    current = again.publicKeyOptions
    return true
  }
  if (again.outcome === 'ended') emit('ended', again.message)
  else error.value = again.message
  return false
}
</script>
