<template>
  <!-- DAR-BE-264: scan, enter the code it shows, save the recovery codes. One question per step. The caller has
       already begun the setup (begin#TwoFactorSetup), so a wrong password or old-app code never reaches here. -->
  <WorkflowStepForm
    v-if="step === 'scan'"
    :class="formClass"
    question="Scan this with your authenticator app."
    :show-back="true"
    :show-enter-hint="true"
    primary-test-id="two-factor-scan-next"
    @back="emit('back')"
    @submit="step = 'code'"
  >
    <div class="two-factor-scan" data-testid="two-factor-scan">
      <img v-if="setup.qrDataUri" class="two-factor-qr" :src="setup.qrDataUri" alt="QR code for your authenticator app" data-testid="two-factor-qr" />
      <div class="two-factor-key-block">
        <span class="section-note">Can't scan? Key:</span>
        <span class="two-factor-key" data-testid="two-factor-key">{{ groupedKey }}</span>
        <div class="action-row">
          <button type="button" data-testid="two-factor-key-copy" @click="copyKey">Copy</button>
          <a class="login-text-link" :href="setup.otpauthUri" data-testid="two-factor-otpauth">Open in app</a>
          <span v-if="keyNote" class="section-note" role="status">{{ keyNote }}</span>
        </div>
      </div>
    </div>
  </WorkflowStepForm>

  <WorkflowStepForm
    v-else-if="step === 'code'"
    :class="formClass"
    question="Enter the code it shows."
    :primary-label="confirming ? 'Checking' : 'OK'"
    :submit-disabled="confirming || code.length < 6"
    :show-back="!confirming"
    :show-enter-hint="true"
    primary-test-id="two-factor-setup-confirm"
    @back="backToScan"
    @submit="confirm"
  >
    <WorkflowCodeInput v-model="code" label="Authenticator code" test-id="two-factor-setup-code" @complete="confirm" />
  </WorkflowStepForm>

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
import { computed, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowCodeInput from '../workflow/WorkflowCodeInput.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import TwoFactorRecoveryCodes from './TwoFactorRecoveryCodes.vue'
import { copyText, groupSecret } from '../../lib/twoFactor'
import { useAuthStore, type TwoFactorSetupStart } from '../../stores/auth'

const props = defineProps<{
  setup: TwoFactorSetupStart
  username?: string | null
  /** `workflow-form--popup-compact` inside a settings popup. */
  formClass?: string
}>()

const emit = defineEmits<{
  /** The factor is on and this tab holds the new key; the recovery codes are on screen. */
  confirmed: []
  /** "I saved them". */
  done: []
  /** Back from the first step. */
  back: []
  /** The sign-in challenge or the pending setup is gone; start over. */
  ended: [message: string]
}>()

const authStore = useAuthStore()
const step = ref<'scan' | 'code' | 'codes'>('scan')
const code = ref('')
const confirming = ref(false)
const error = ref<string | null>(null)
const keyNote = ref<string | null>(null)
const recoveryCodes = ref<string[]>([])

const groupedKey = computed(() => groupSecret(props.setup.secret))

async function copyKey(): Promise<void> {
  keyNote.value = (await copyText(props.setup.secret)) ? 'Copied.' : 'Copy blocked. Type the key.'
}

function backToScan(): void {
  error.value = null
  code.value = ''
  step.value = 'scan'
}

async function confirm(): Promise<void> {
  if (confirming.value || code.value.length < 6) return
  confirming.value = true
  error.value = null
  try {
    const result = await authStore.confirmTwoFactorSetup(code.value)
    if (result.outcome === 'confirmed') {
      recoveryCodes.value = result.recoveryCodes
      step.value = 'codes'
      emit('confirmed')
      return
    }
    code.value = ''
    if (result.outcome === 'ended') {
      emit('ended', result.message)
      return
    }
    error.value = result.message
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped>
/* The QR leads; the typed key is the fallback beside it on a wide panel, under it on a narrow one. The QR's own
   white quiet zone is in the SVG, so it reads in dark mode without a frame of its own. */
.two-factor-scan {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.two-factor-qr {
  width: 11rem;
  height: 11rem;
  border-radius: var(--radius-md);
}

.two-factor-key-block {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.two-factor-key {
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}
</style>
