<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Approve CLI</h1>
    </template>

    <StaticPageSection>
      <p v-if="phase === 'done'" class="section-note" role="status" data-testid="cli-login-done">
        {{ outcome === 'approved' ? 'CLI approved. Return to your terminal.' : 'CLI denied.' }}
      </p>

      <template v-else-if="phase === 'noaccess' && myAccess">
        <p class="section-note" role="alert" data-testid="cli-login-noaccess">
          The Darpan CLI is not turned on for you in {{ myAccess.tenantLabel }}.
        </p>
        <CliAccessRequestCard :access="myAccess" />
      </template>

      <template v-else-if="phase === 'ready'">
        <article class="static-page-summary-card">
          <span class="static-page-summary-label">Sign-in request</span>
          <span data-testid="cli-login-host">Darpan CLI on {{ hostLabel }}</span>
          <span class="section-note">That is the name the CLI gave. Darpan has not checked it.</span>
          <template v-if="startedLabel">
            <span v-explain="'cliCodeStarted'" class="static-page-summary-label">Started</span>
            <span data-testid="cli-login-started">{{ startedLabel }}</span>
          </template>
          <span v-explain="'cliCodeExpires'" class="static-page-summary-label">Expires</span>
          <span data-testid="cli-login-expires">{{ expiresLabel }}</span>
        </article>
        <p class="section-note">Approve only a code you just started in your own terminal.</p>
        <!-- DAR-BE-264: approving mints a 7-day key, so a two-factor account proves it with a fresh code. A code
             already used to sign in is refused for 30 s, so the label asks for a current one. DAR-BE-270: or a passkey,
             whose prompt opens from Approve. -->
        <label v-if="needsTwoFactorCode && proofChoice === 'code'" for="cli-login-two-factor">
          <span>Current code from your app</span>
          <input
            id="cli-login-two-factor"
            v-model="twoFactorCode"
            name="twoFactorCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            spellcheck="false"
            data-testid="cli-login-two-factor-code"
          />
        </label>
        <p v-if="needsTwoFactorCode && proofChoice === 'passkey'" class="section-note" data-testid="cli-login-passkey-note">
          Approve opens your passkey prompt.
        </p>
        <button
          v-if="needsTwoFactorCode && proofChoice === 'code' && proofMethods?.passkey"
          type="button"
          class="login-text-link"
          data-testid="cli-login-use-passkey"
          @click="useProof('passkey')"
        >
          Use a passkey
        </button>
        <button
          v-if="needsTwoFactorCode && proofChoice === 'passkey' && proofMethods?.app"
          type="button"
          class="login-text-link"
          data-testid="cli-login-use-app"
          @click="useProof('code')"
        >
          Use the app code
        </button>
        <p v-if="codeError" class="section-note" role="alert" data-testid="cli-login-code-error">{{ codeError }}</p>
        <div class="cli-login-actions">
          <button class="btn-primary" type="button" data-testid="cli-login-approve" aria-label="Approve CLI sign-in" :disabled="busy || approveBlocked" @click="answer('approved')">
            Approve
          </button>
          <button class="btn-primary" type="button" data-testid="cli-login-deny" aria-label="Deny CLI sign-in" :disabled="busy" @click="answer('denied')">
            Deny
          </button>
        </div>
      </template>

      <form v-else class="stack-md" @submit.prevent="lookUp">
        <label for="cli-login-code">
          <span>Code from your terminal</span>
          <input
            id="cli-login-code"
            v-model="typedCode"
            name="code"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            placeholder="XXXX-XXXX"
            data-testid="cli-login-code"
          />
        </label>
        <p v-if="phase === 'notfound'" class="section-note" role="alert" data-testid="cli-login-notfound">
          Code not found or expired. Check your terminal, or run darpan login again.
        </p>
        <div class="action-row">
          <button type="submit" data-testid="cli-login-lookup" aria-label="Continue with this code" :disabled="busy">Continue</button>
        </div>
      </form>
    </StaticPageSection>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import StaticPageFrame from '../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../components/ui/StaticPageSection.vue'
import CliAccessRequestCard from '../components/settings/CliAccessRequestCard.vue'
import { authFacade } from '../lib/api/facade'
import type { MyCliAccess } from '../lib/api/types'
import { formatDateTime } from '../lib/utils/date'
import { refusalReason } from '../lib/twoFactor'
import { passkeysSupported } from '../lib/passkeys'
import { usePasskeyProof } from '../composables/usePasskeyProof'
import { useAuthStore } from '../stores/auth'

type Phase = 'enter' | 'ready' | 'done' | 'notfound' | 'noaccess'

// A ?code= in the link is deliberately never read: a link someone else sends must not be able to
// pre-load a request. The person types the code their own terminal shows.
const phase = ref<Phase>('enter')
const typedCode = ref('')
const hostLabel = ref('')
const startedLabel = ref('')
const expiresLabel = ref('')
const outcome = ref<'approved' | 'denied'>('approved')
const busy = ref(false)
const myAccess = ref<MyCliAccess | null>(null)
const controller = new AbortController()
let confirmedCode = ''

const authStore = useAuthStore()
const twoFactorCode = ref('')
const codeError = ref<string | null>(null)
// The session's flag, or the backend asking for a code (two-factor turned on in another tab since this one loaded).
const codeDemanded = ref(false)
const needsTwoFactorCode = computed(() => authStore.twoFactorEnabled || codeDemanded.value)
const typedTwoFactorCode = computed(() => twoFactorCode.value.replace(/\D/g, ''))

// DAR-BE-270: which proofs this person has (read once two-factor is known to be on) and which one they are using.
const passkeyProof = usePasskeyProof()
const proofMethods = ref<{ app: boolean; passkey: boolean } | null>(null)
const proofChoice = ref<'code' | 'passkey'>('code')
const approveBlocked = computed(
  () => needsTwoFactorCode.value && proofChoice.value === 'code' && typedTwoFactorCode.value.length !== 6,
)

async function loadProofMethods(): Promise<void> {
  if (proofMethods.value) return
  try {
    const status = await authFacade.getTwoFactorStatus(controller.signal)
    if (controller.signal.aborted) return
    const app = status.appEnabled ?? status.enabled ?? true
    const passkey = (status.passkeys?.length ?? 0) > 0 && passkeysSupported()
    proofMethods.value = { app, passkey }
    if (!app && passkey) useProof('passkey')
  } catch {
    // Unread: the code input stays, as before passkeys.
  }
}

function useProof(choice: 'code' | 'passkey'): void {
  codeError.value = null
  twoFactorCode.value = ''
  proofChoice.value = choice
  if (choice === 'passkey') passkeyProof.prepare()
}

watch(
  () => phase.value === 'ready' && needsTwoFactorCode.value,
  (ready) => {
    if (ready) void loadProofMethods()
  },
)

/** The fresh proof approve#CliLogin takes: a code, a passkey assertion, nothing (no two-factor), or null to stop. */
async function approvalProof(): Promise<{ code?: string; passkeyAssertion?: string } | null> {
  if (!needsTwoFactorCode.value) return {}
  if (proofChoice.value === 'code') return { code: typedTwoFactorCode.value }
  const proved = await passkeyProof.prove()
  if (proved.outcome === 'ok') return { passkeyAssertion: proved.passkeyAssertion }
  // A closed prompt is not a refusal: the request stays on screen and nothing is said.
  if (proved.outcome === 'failed') codeError.value = proved.message
  return null
}

onBeforeUnmount(() => controller.abort())

// XXXX-XXXX, upper case; lower case and a missing dash are accepted. Anything else is not a code.
function normalizeUserCode(raw: string): string | null {
  const compact = raw.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z0-9]{8}$/.test(compact) ? `${compact.slice(0, 4)}-${compact.slice(4)}` : null
}

async function lookUp() {
  if (busy.value) return
  const userCode = normalizeUserCode(typedCode.value)
  if (!userCode) {
    phase.value = 'notfound'
    return
  }
  busy.value = true
  try {
    const response = await authFacade.getCliLoginRequest({ userCode }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok || response.status !== 'PENDING') {
      phase.value = 'notfound'
      return
    }
    confirmedCode = userCode
    hostLabel.value = response.hostLabel ?? 'an unknown computer'
    startedLabel.value = response.createdDate ? formatDateTime(response.createdDate) : ''
    expiresLabel.value = formatDateTime(response.expiresDate)
    phase.value = 'ready'
  } catch {
    if (!controller.signal.aborted) phase.value = 'notfound'
  } finally {
    busy.value = false
  }
}

// DAR-BE-209: an approve can fail because the code expired, or because the CLI is not turned on for this person. The
// refusal text is not matched: approve#CliLogin's own rule (canUseCli: on in any tenant) says which, and a person
// without the CLI is offered the request for the active tenant. A deny never checks access, so it never comes here.
async function refused() {
  confirmedCode = ''
  try {
    const access = (await authFacade.getMyCliAccess(controller.signal)).access ?? null
    if (controller.signal.aborted) return
    if (access && access.canUseCli === false) {
      myAccess.value = access
      phase.value = 'noaccess'
      return
    }
  } catch {
    // The access check failed too: fall back to the code message.
  }
  if (!controller.signal.aborted) phase.value = 'notfound'
}

async function failed(choice: 'approved' | 'denied') {
  if (choice === 'approved') return refused()
  confirmedCode = ''
  phase.value = 'notfound'
}

/** A refused approval a fresh proof fixes keeps the request on screen. */
function proofRefused(message: string): void {
  codeDemanded.value = true
  codeError.value = message
  twoFactorCode.value = ''
  // A refused assertion used its options up: fetch the next set now, ahead of the retry's click.
  if (proofChoice.value === 'passkey') passkeyProof.prepare()
}

async function answer(choice: 'approved' | 'denied') {
  if (busy.value || !confirmedCode) return
  if (choice === 'approved' && approveBlocked.value) return
  busy.value = true
  codeError.value = null
  try {
    const payload = { userCode: confirmedCode }
    let response
    if (choice === 'approved') {
      const proof = await approvalProof()
      if (!proof || controller.signal.aborted) return
      response = await authFacade.approveCliLogin({ ...payload, ...proof }, controller.signal)
    } else {
      response = await authFacade.denyCliLogin(payload, controller.signal)
    }
    if (controller.signal.aborted) return
    // approve#CliLogin answers a refusal as a reply; one a fresh proof fixes keeps the request on screen, anything else
    // is about the request.
    if (!response.ok) {
      if (refusalReason(response) === 'proof') proofRefused(response.errors[0] ?? '')
      else await failed(choice)
      return
    }
    outcome.value = choice
    phase.value = 'done'
  } catch {
    if (!controller.signal.aborted) await failed(choice)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.cli-login-actions { display: flex; gap: var(--space-2); }
</style>
