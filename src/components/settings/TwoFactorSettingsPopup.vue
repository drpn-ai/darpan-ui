<template>
  <!-- DAR-BE-264: every two-factor change asks for proof first. A first setup takes the password; replacing the
       app, new recovery codes and turning it off take a current code. Rendered outside StaticPageFrame, which the
       page blurs while this is open (the popup contract every User Settings popup follows). -->
  <div
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="two-factor-workflow-title"
    @click.self="emit('close')"
  >
    <section class="popup-workflow-modal workflow-panel" data-testid="two-factor-workflow">
      <header class="workflow-panel-header">
        <h2 id="two-factor-workflow-title">{{ title }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <TwoFactorSetupSteps
          v-if="setup"
          :setup="setup"
          :username="username"
          form-class="workflow-form--popup-compact"
          @back="setup = null"
          @ended="restart"
          @confirmed="emit('changed', 'on')"
          @done="emit('close')"
        />

        <WorkflowStepForm
          v-else-if="recoveryCodes"
          class="workflow-form--popup-compact"
          question="Save your recovery codes."
          primary-label="I saved them"
          :show-enter-hint="false"
          primary-test-id="two-factor-codes-saved"
          @submit="emit('close')"
        >
          <TwoFactorRecoveryCodes :codes="recoveryCodes" :username="username" />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else
          class="workflow-form--popup-compact"
          :question="proofQuestion"
          :primary-label="primaryLabel"
          :submit-disabled="isProofBlocked"
          :show-enter-hint="true"
          primary-test-id="two-factor-proof-next"
          @submit="submitProof"
        >
          <label v-if="action === 'setup'" class="workflow-context-block" aria-label="Current Password">
            <input
              v-model="currentPassword"
              class="wizard-answer-control"
              data-testid="two-factor-password"
              name="currentPassword"
              type="password"
              autocomplete="current-password"
              required
            />
          </label>
          <!-- Turning it off waits for the button: the code is the confirmation, so the sixth digit does not act. -->
          <WorkflowCodeInput
            v-else
            v-model="code"
            label="Authenticator code"
            test-id="two-factor-proof-code"
            @complete="action === 'off' ? undefined : submitProof()"
          />
        </WorkflowStepForm>

        <InlineValidation v-if="error" tone="error" :message="error" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowCodeInput from '../workflow/WorkflowCodeInput.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import TwoFactorRecoveryCodes from '../auth/TwoFactorRecoveryCodes.vue'
import TwoFactorSetupSteps from '../auth/TwoFactorSetupSteps.vue'
import { ApiCallError } from '../../lib/api/client'
import { authFacade } from '../../lib/api/facade'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { useAuthStore, type TwoFactorSetupStart } from '../../stores/auth'

export type TwoFactorSettingsAction = 'setup' | 'replace' | 'codes' | 'off'
export type TwoFactorSettingsChange = 'on' | 'codes' | 'off'

const props = defineProps<{
  action: TwoFactorSettingsAction
  username?: string | null
}>()

const emit = defineEmits<{
  close: []
  /** The server side changed. Emitted as soon as it does, so closing early still refreshes the page. */
  changed: [change: TwoFactorSettingsChange]
}>()

const authStore = useAuthStore()
const currentPassword = ref('')
const code = ref('')
const busy = ref(false)
const error = ref<string | null>(null)
const setup = ref<TwoFactorSetupStart | null>(null)
const recoveryCodes = ref<string[] | null>(null)

const TITLES: Record<TwoFactorSettingsAction, string> = {
  setup: 'Two-factor',
  replace: 'New authenticator app',
  codes: 'Recovery codes',
  off: 'Turn off two-factor',
}
const title = computed(() => TITLES[props.action])

const proofQuestion = computed(() => {
  if (props.action === 'setup') return 'Enter your current password.'
  if (props.action === 'replace') return 'Enter the code from your current app.'
  return 'Enter the code from your app.'
})

const primaryLabel = computed(() => {
  if (busy.value) return 'Checking'
  return props.action === 'off' ? 'Turn off' : 'OK'
})

const isProofBlocked = computed(() => {
  if (busy.value) return true
  if (props.action === 'setup') return currentPassword.value.length === 0
  return code.value.length < 6
})

function messageOf(err: unknown, fallback: string): string {
  return err instanceof ApiCallError ? err.message : fallback
}

async function submitProof(): Promise<void> {
  if (isProofBlocked.value) return
  busy.value = true
  error.value = null
  try {
    if (props.action === 'setup' || props.action === 'replace') {
      const proof = props.action === 'setup' ? { currentPassword: currentPassword.value } : { code: code.value }
      const result = await authStore.beginTwoFactorSetup(proof)
      if (result.outcome === 'begun') {
        setup.value = result.setup
      } else {
        error.value = result.message
      }
      return
    }
    if (props.action === 'codes') {
      const response = await authFacade.createRecoveryCodes({ code: code.value })
      recoveryCodes.value = response.recoveryCodes ?? []
      emit('changed', 'codes')
      return
    }
    await authFacade.disableTwoFactor({ code: code.value })
    emit('changed', 'off')
    emit('close')
  } catch (err) {
    error.value = messageOf(err, "That didn't go through. Try again.")
  } finally {
    // The password is held only as long as the step that asked for it.
    currentPassword.value = ''
    code.value = ''
    busy.value = false
  }
}

function restart(message: string): void {
  setup.value = null
  error.value = message
}

function handleCancelRequest(event: Event): void {
  event.preventDefault()
  emit('close')
}

onMounted(() => document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest))
onBeforeUnmount(() => document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest))
</script>
