<template>
  <!-- DAR-BE-264: every two-factor change asks for proof first. With nothing on yet that is the password; after that a
       current code from the app or (DAR-BE-270) a passkey. Rendered outside StaticPageFrame, which the page blurs while
       this is open (the popup contract every User Settings popup follows). -->
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
          @confirmed="emit('changed', twoFactorOn ? 'app-on' : 'on')"
          @done="emit('close')"
        />

        <PasskeyAddSteps
          v-else-if="passkeyOptions"
          :options="passkeyOptions"
          :username="username"
          form-class="workflow-form--popup-compact"
          @back="passkeyOptions = null"
          @refused="restart"
          @added="(firstFactor) => emit('changed', firstFactor ? 'on' : 'passkey-added')"
          @done="emit('close')"
        />

        <TwoFactorRecoveryCodes
          v-else-if="recoveryCodes"
          class="workflow-form--popup-compact"
          :codes="recoveryCodes"
          :username="username"
          @done="emit('close')"
        />

        <!-- Their only factor is a passkey and this browser cannot use one: there is no proof to ask for here. -->
        <WorkflowStepForm
          v-else-if="!proofKind"
          class="workflow-form--popup-compact"
          :question="PASSKEYS_UNSUPPORTED_TEXT"
          primary-label="OK"
          :show-enter-hint="true"
          primary-test-id="two-factor-no-proof-ok"
          @submit="emit('close')"
        >
          <p class="section-note" data-testid="two-factor-no-proof">{{ PASSKEY_BROWSER_NEEDED_TEXT }}</p>
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
          <label v-if="proofKind === 'password'" class="workflow-context-block" aria-label="Current Password">
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
          <!-- Turning off and removing wait for the button: the code is the confirmation, so the sixth digit does
               not act. -->
          <WorkflowCodeInput
            v-else-if="proofKind === 'code'"
            v-model="code"
            label="Authenticator code"
            test-id="two-factor-proof-code"
            @complete="actsOnSixthDigit ? submitProof() : undefined"
          />
          <button
            v-if="proofKind === 'code' && proof.offers('passkey')"
            type="button"
            class="login-text-link"
            data-testid="two-factor-proof-use-passkey"
            :disabled="busy"
            @click="useProof('passkey')"
          >
            Use a passkey
          </button>
          <button
            v-if="proofKind === 'passkey' && proof.offers('code')"
            type="button"
            class="login-text-link"
            data-testid="two-factor-proof-use-app"
            :disabled="busy"
            @click="useProof('code')"
          >
            Use the app code
          </button>
        </WorkflowStepForm>

        <InlineValidation tone="error" :message="error" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowCodeInput from '../workflow/WorkflowCodeInput.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import PasskeyAddSteps from '../auth/PasskeyAddSteps.vue'
import TwoFactorRecoveryCodes from '../auth/TwoFactorRecoveryCodes.vue'
import TwoFactorSetupSteps from '../auth/TwoFactorSetupSteps.vue'
import { beginPasskeyProof, useTwoFactorProof } from '../../composables/useTwoFactorProof'
import { authFacade } from '../../lib/api/facade'
import { PASSKEY_BROWSER_NEEDED_TEXT, PASSKEYS_UNSUPPORTED_TEXT } from '../../lib/passkeys'
import { callFailure } from '../../lib/twoFactor'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../lib/uiEvents'
import { useAuthStore, type TwoFactorProof, type TwoFactorSetupStart } from '../../stores/auth'

export type TwoFactorSettingsAction = 'setup' | 'replace' | 'codes' | 'off' | 'app-off' | 'add-passkey' | 'remove-passkey'
export type TwoFactorSettingsChange = 'on' | 'app-on' | 'codes' | 'off' | 'app-off' | 'passkey-added' | 'passkey-removed'

const props = defineProps<{
  action: TwoFactorSettingsAction
  username?: string | null
  /** Two-factor is on (any factor): proof is a code or a passkey, not the password. */
  twoFactorOn: boolean
  appEnabled: boolean
  hasPasskeys: boolean
  /** remove-passkey: the one being removed. */
  passkey?: { passkeyId: string; name?: string } | null
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
const passkeyOptions = ref<string | null>(null)
const recoveryCodes = ref<string[] | null>(null)

const proof = useTwoFactorProof({ begin: beginPasskeyProof, onRefused: (refusal) => { error.value = refusal.message } })
const usesPassword = !props.twoFactorOn && (props.action === 'setup' || props.action === 'add-passkey')
if (!usesPassword) proof.start({ app: props.appEnabled, passkey: props.hasPasskeys })
/** The proof asked for; null when none can be given in this browser. */
const proofKind = computed(() => (usesPassword ? 'password' : proof.mode.value))
const actsOnSixthDigit = computed(() => props.action !== 'off' && props.action !== 'app-off' && props.action !== 'remove-passkey')

const TITLES: Record<TwoFactorSettingsAction, string> = {
  setup: 'Authenticator app',
  replace: 'New authenticator app',
  codes: 'Recovery codes',
  off: 'Turn off two-factor',
  'app-off': 'Remove authenticator app',
  'add-passkey': 'Add a passkey',
  'remove-passkey': 'Remove passkey',
}
const title = computed(() => (props.action === 'setup' && !props.twoFactorOn ? 'Two-factor' : TITLES[props.action]))

const proofQuestion = computed(() => {
  if (proofKind.value === 'password') return 'Enter your current password.'
  if (proofKind.value === 'passkey') return 'Confirm with your passkey.'
  if (props.action === 'replace') return 'Enter the code from your current app.'
  return 'Enter the code from your app.'
})

const DESTRUCTIVE_LABELS: Partial<Record<TwoFactorSettingsAction, string>> = {
  off: 'Turn off',
  'app-off': 'Remove',
  'remove-passkey': 'Remove',
}
const primaryLabel = computed(() => {
  if (busy.value) return proofKind.value === 'passkey' ? 'Waiting' : 'Checking'
  return DESTRUCTIVE_LABELS[props.action] ?? (proofKind.value === 'passkey' ? 'Continue' : 'OK')
})

const isProofBlocked = computed(() => {
  if (busy.value) return true
  if (proofKind.value === 'password') return currentPassword.value.length === 0
  if (proofKind.value === 'passkey') return proof.preparing.value
  return code.value.length < 6
})

function useProof(choice: 'code' | 'passkey'): void {
  error.value = null
  code.value = ''
  proof.choose(choice)
}

/** The proof for the action, or null when there is none to send (a closed passkey prompt, or its failure shown). */
async function collectProof(): Promise<TwoFactorProof | null> {
  if (proofKind.value === 'password') return { currentPassword: currentPassword.value }
  if (proofKind.value === 'code') return { code: code.value }
  const proved = await proof.prove()
  if (proved.outcome === 'ok') return { passkeyAssertion: proved.passkeyAssertion }
  // A closed prompt is not a refusal: stay here and say nothing.
  if (proved.outcome === 'failed') error.value = proved.message
  return null
}

async function submitProof(): Promise<void> {
  if (isProofBlocked.value) return
  busy.value = true
  error.value = null
  try {
    const given = await collectProof()
    if (given) await act(given)
  } catch (err) {
    error.value = callFailure(err).message
  } finally {
    // The password is held only as long as the step that asked for it.
    currentPassword.value = ''
    code.value = ''
    busy.value = false
    // A refused assertion used its options up: the next set now, so a retry opens the prompt straight from its click.
    if (error.value && proofKind.value === 'passkey') void proof.prepare()
  }
}

async function act(given: TwoFactorProof): Promise<void> {
  if (props.action === 'setup' || props.action === 'replace') {
    const result = await authStore.beginTwoFactorSetup(given)
    if (result.outcome === 'begun') setup.value = result.setup
    else error.value = result.message
    return
  }
  if (props.action === 'add-passkey') {
    const result = await authStore.beginPasskeyRegistration(given)
    if (result.outcome === 'begun') passkeyOptions.value = result.publicKeyOptions
    else error.value = result.message
    return
  }
  if (props.action === 'codes') {
    const response = await authFacade.createRecoveryCodes(given)
    recoveryCodes.value = response.recoveryCodes ?? []
    emit('changed', 'codes')
    return
  }
  if (props.action === 'remove-passkey') {
    if (!props.passkey) return
    // The backend refuses a required person's last factor; its reason shows here. Removing the last one turns
    // two-factor off: every key ends, this tab's too, and the reply carries the new one.
    const response = await authFacade.deletePasskey({ passkeyId: props.passkey.passkeyId, ...given })
    authStore.adoptReissuedKey(response)
    emit('changed', response.twoFactorEnabled === false ? 'off' : 'passkey-removed')
    emit('close')
    return
  }
  // Turning it off ends every key, this tab's too, and answers with the new one; removing only the app reissues none.
  const appOnly = props.action === 'app-off'
  authStore.adoptReissuedKey(await authFacade.disableTwoFactor(appOnly ? { ...given, appOnly: true } : given))
  emit('changed', appOnly ? 'app-off' : 'off')
  emit('close')
}

function restart(message: string): void {
  setup.value = null
  passkeyOptions.value = null
  error.value = message
  if (proofKind.value === 'passkey') void proof.prepare()
}

function handleCancelRequest(event: Event): void {
  event.preventDefault()
  emit('close')
}

// Focus goes back to the button that opened this.
const opener = typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)

onMounted(() => document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest))
onBeforeUnmount(() => {
  document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, handleCancelRequest)
  opener?.focus?.()
})
</script>
