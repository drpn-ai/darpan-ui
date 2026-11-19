<template>
  <!-- DAR-UI-132: the sign-in card, one question per step, so `darpan login` reads as one flow from sign-in to approval. -->
  <main class="login-page">
    <section class="login-panel">
      <p class="eyebrow">Darpan</p>

      <WorkflowStepForm
        v-if="phase === 'done'"
        :question="outcome === 'approved' ? 'Approved.' : 'Denied.'"
        :show-primary-action="false"
      >
        <p class="section-note" role="status" data-testid="cli-login-done">
          {{ outcome === 'approved' ? 'Return to your terminal.' : 'The CLI was not signed in.' }}
        </p>
      </WorkflowStepForm>

      <template v-else-if="phase === 'noaccess' && myAccess">
        <p class="section-note" role="alert" data-testid="cli-login-noaccess">
          The Darpan CLI is not turned on for you in {{ myAccess.tenantLabel }}.
        </p>
        <CliAccessRequestCard :access="myAccess" />
      </template>

      <WorkflowStepForm
        v-else-if="phase === 'ready'"
        :question="approveQuestion"
        primary-label="Approve"
        primary-aria-label="Approve CLI sign-in"
        :show-primary-action="canApprove"
        :submit-disabled="busy || approveBlocked"
        :show-back="true"
        :show-enter-hint="true"
        primary-test-id="cli-login-approve"
        @back="backToCode"
        @submit="answer('approved')"
      >
        <template #question>Approve <span data-testid="cli-login-host">{{ scopeName }} on {{ hostLabel }}</span>?</template>
        <!-- The request as short label lines (the computer's name above is what the CLI gave). -->
        <div class="cli-request-lines">
          <div v-if="startedLabel">
            <span v-explain="'cliCodeStarted'">Started</span>
            <span data-testid="cli-login-started">{{ startedLabel }}</span>
          </div>
          <div>
            <span v-explain="'cliCodeExpires'">Expires</span>
            <span data-testid="cli-login-expires">{{ expiresLabel }}</span>
          </div>
        </div>
        <!-- Device-code phishing guard: a code someone sent you would sign their terminal in as you. -->
        <p v-if="canApprove" class="section-note" data-testid="cli-login-own-code">Approve only a code you just started in your own terminal.</p>
        <p v-if="scope === 'ADMIN'" class="section-note" role="alert" data-testid="cli-login-admin-warning">This sign-in can use the admin app's powers for 12 hours.</p>
        <p v-if="!scopeKnown" class="section-note" role="alert" data-testid="cli-login-unknown-scope">
          This sign-in asks for access Darpan does not recognise. Do not approve it.
        </p>
        <p v-if="notSuperAdminOnAdmin" class="section-note" role="alert" data-testid="cli-login-super-admin-only">
          Only a super admin can approve a darpan-admin sign-in.
        </p>
        <template v-if="canApprove">
          <!-- DAR-BE-264: approving mints a 7-day key, so a two-factor account proves it with a fresh code. A code
             already used to sign in is refused for 30 s, so the note asks for a current one. DAR-BE-270/DAR-UI-132: a
             passkey first when they have one, its prompt opened by Approve. -->
          <template v-if="needsTwoFactorCode && proof.mode.value === 'code'">
            <label class="workflow-context-block" aria-label="Code from your app">
              <input
                id="cli-login-two-factor"
                v-model="twoFactorCode"
                class="wizard-answer-control"
                name="twoFactorCode"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                maxlength="6"
                spellcheck="false"
                data-testid="cli-login-two-factor-code"
              />
            </label>
            <p class="section-note">Current code from your app.</p>
          </template>
          <!-- Their only factor is a passkey and this browser cannot use one: never ask them for an app code. -->
          <p v-if="noProofHere" class="section-note" role="alert" data-testid="cli-login-no-proof">
            {{ PASSKEYS_UNSUPPORTED_TEXT }} {{ PASSKEY_BROWSER_NEEDED_TEXT }}
          </p>
          <p v-if="codeError" class="section-note" role="alert" data-testid="cli-login-code-error">{{ codeError }}</p>
        </template>
        <template #links>
          <button
            v-if="canApprove && needsTwoFactorCode && proof.mode.value === 'passkey' && proof.offers('code')"
            type="button"
            class="login-text-link"
            data-testid="cli-login-use-app"
            :disabled="busy"
            @click="useProof('code')"
          >
            Use the app code
          </button>
          <button
            v-if="canApprove && needsTwoFactorCode && proof.mode.value === 'code' && proof.offers('passkey')"
            type="button"
            class="login-text-link"
            data-testid="cli-login-use-passkey"
            :disabled="busy"
            @click="useProof('passkey')"
          >
            Use a passkey
          </button>
          <button type="button" class="login-text-link" data-testid="cli-login-deny" aria-label="Deny CLI sign-in" :disabled="busy" @click="answer('denied')">
            Deny
          </button>
        </template>
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else
        question="Code from your terminal?"
        primary-label="Continue"
        primary-aria-label="Continue with this code"
        :submit-disabled="busy"
        :show-enter-hint="true"
        primary-test-id="cli-login-lookup"
        @submit="lookUp"
      >
        <label class="workflow-context-block" aria-label="Code from your terminal">
          <input
            id="cli-login-code"
            v-model="typedCode"
            class="wizard-answer-control"
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
      </WorkflowStepForm>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WorkflowStepForm from '../components/workflow/WorkflowStepForm.vue'
import CliAccessRequestCard from '../components/settings/CliAccessRequestCard.vue'
import { authFacade } from '../lib/api/facade'
import type { MyCliAccess } from '../lib/api/types'
import { formatDateTime } from '../lib/utils/date'
import { callFailure } from '../lib/twoFactor'
import { PASSKEY_BROWSER_NEEDED_TEXT, PASSKEYS_UNSUPPORTED_TEXT } from '../lib/passkeys'
import { keepAccount } from '../lib/passkeyHint'
import { beginPasskeyProof, useTwoFactorProof } from '../composables/useTwoFactorProof'
import { useAuthStore } from '../stores/auth'

type Phase = 'enter' | 'ready' | 'done' | 'notfound' | 'noaccess'

// A ?code= in the link is deliberately never read: a link someone else sends must not be able to
// pre-load a request. The person types the code their own terminal shows.
const phase = ref<Phase>('enter')
const typedCode = ref('')
const hostLabel = ref('')
// TENANT or ADMIN; a missing scope (older backend) is TENANT. Anything else is shown as unrecognised, with no approve.
const scope = ref('TENANT')
const scopeKnown = computed(() => scope.value === 'TENANT' || scope.value === 'ADMIN')
const scopeName = computed(() => (scope.value === 'ADMIN' ? 'darpan-admin' : 'Darpan CLI'))
const approveQuestion = computed(() => `Approve ${scopeName.value} on ${hostLabel.value}?`)
const startedLabel = ref('')
const expiresLabel = ref('')
const outcome = ref<'approved' | 'denied'>('approved')
const busy = ref(false)
const myAccess = ref<MyCliAccess | null>(null)
const controller = new AbortController()
let confirmedCode = ''

const authStore = useAuthStore()
// DAR-BE-295: only a super admin may approve a darpan-admin sign-in; anyone else sees why, with Deny, and no proof step.
const notSuperAdminOnAdmin = computed(() => scope.value === 'ADMIN' && authStore.sessionInfo?.isSuperAdmin !== true)
// An unrecognised scope, or darpan-admin for anyone but a super admin: no proof, no Approve; Deny stays.
const canApprove = computed(() => scopeKnown.value && !notSuperAdminOnAdmin.value)
const twoFactorCode = ref('')
const codeError = ref<string | null>(null)
// The session's flag, or the backend asking for a code (two-factor turned on in another tab since this one loaded).
const codeDemanded = ref(false)
const needsTwoFactorCode = computed(() => authStore.twoFactorEnabled || codeDemanded.value)
const typedTwoFactorCode = computed(() => twoFactorCode.value.replace(/\D/g, ''))

// DAR-BE-270: which proofs this person has (read once two-factor is known to be on) and which one they are using.
const proof = useTwoFactorProof({ begin: beginPasskeyProof, onRefused: (refusal) => { codeError.value = refusal.message } })
const methodsRead = ref(false)
const noProofHere = computed(() => needsTwoFactorCode.value && methodsRead.value && proof.mode.value === null)
const approveBlocked = computed(() => {
  if (!needsTwoFactorCode.value) return false
  if (proof.mode.value === 'code') return typedTwoFactorCode.value.length !== 6
  return proof.mode.value !== 'passkey' || proof.preparing.value
})

async function loadProofMethods(): Promise<void> {
  if (methodsRead.value) return
  try {
    const status = await authFacade.getTwoFactorStatus(controller.signal)
    if (controller.signal.aborted) return
    methodsRead.value = true
    proof.start({ app: status.appEnabled === true, passkey: (status.passkeys?.length ?? 0) > 0 })
  } catch (err) {
    // Without the read there is no knowing which proof to ask for; Approve waits, and a reload reads it again.
    if (!controller.signal.aborted) codeError.value = callFailure(err).message
  }
}

function useProof(choice: 'code' | 'passkey'): void {
  codeError.value = null
  twoFactorCode.value = ''
  proof.choose(choice)
}

watch(
  () => phase.value === 'ready' && needsTwoFactorCode.value,
  (ready) => {
    if (ready) void loadProofMethods()
  },
)

/** Back to the code: the request stays unanswered and expires on its own. */
function backToCode(): void {
  confirmedCode = ''
  codeError.value = null
  twoFactorCode.value = ''
  phase.value = 'enter'
}

/** The fresh proof approve#CliLogin takes: a code, a passkey assertion, nothing (no two-factor), or null to stop. */
async function approvalProof(): Promise<{ code?: string; passkeyAssertion?: string } | null> {
  if (!needsTwoFactorCode.value) return {}
  if (proof.mode.value === 'code') return { code: typedTwoFactorCode.value }
  const proved = await proof.prove()
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
    scope.value = response.scope ?? 'TENANT'
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

// approve#CliLogin refuses as a JSON-RPC error with no reason code, so its text is not matched: what the backend still
// holds says why. DAR-BE-209: the CLI not turned on for this person (canUseCli: on in any tenant) offers the request for
// the active tenant. DAR-BE-264/270: a request still waiting was refused for its proof (a wrong, reused or missing code
// or passkey), so it stays on screen with the refusal. Anything else: the request expired or was answered. A deny
// never checks either, so it never comes here.
async function approveRefused(message: string): Promise<void> {
  try {
    const access = (await authFacade.getMyCliAccess(controller.signal)).access ?? null
    if (controller.signal.aborted) return
    if (access && access.canUseCli === false) {
      confirmedCode = ''
      myAccess.value = access
      phase.value = 'noaccess'
      return
    }
    const request = await authFacade.getCliLoginRequest({ userCode: confirmedCode }, controller.signal)
    if (controller.signal.aborted) return
    if (request.ok && request.status === 'PENDING') {
      proofRefused(message)
      return
    }
  } catch {
    // The checks failed too: fall back to the code message.
  }
  if (controller.signal.aborted) return
  confirmedCode = ''
  phase.value = 'notfound'
}

/** A refused approval a fresh proof fixes keeps the request on screen. */
function proofRefused(message: string): void {
  codeDemanded.value = true
  codeError.value = message
  twoFactorCode.value = ''
  // A refused assertion used its options up: fetch the next set now, ahead of the retry's click.
  if (proof.mode.value === 'passkey') void proof.prepare()
}

async function answer(choice: 'approved' | 'denied') {
  if (busy.value || !confirmedCode) return
  if (choice === 'approved' && (!canApprove.value || approveBlocked.value)) return
  busy.value = true
  codeError.value = null
  try {
    const payload = { userCode: confirmedCode }
    if (choice === 'approved') {
      const given = await approvalProof()
      if (!given || controller.signal.aborted) return
      await authFacade.approveCliLogin({ ...payload, ...given }, controller.signal)
      // DAR-UI-132: a passkey proved them on this browser, so sign-in here leads with it next time.
      if (given.passkeyAssertion && authStore.username) keepAccount(authStore.username, 'passkey')
    } else {
      await authFacade.denyCliLogin(payload, controller.signal)
    }
    if (controller.signal.aborted) return
    outcome.value = choice
    phase.value = 'done'
  } catch (err) {
    if (controller.signal.aborted) return
    if (choice === 'approved') {
      await approveRefused(callFailure(err).message)
      return
    }
    confirmedCode = ''
    phase.value = 'notfound'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
/* The request as short label lines: a label column, the value beside it. */
.cli-request-lines {
  width: 100%;
  display: grid;
  gap: var(--space-0);
}

.cli-request-lines > div {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: var(--space-2);
  font-size: var(--type-note-size);
}

.cli-request-lines span:first-child {
  color: var(--text-dim);
  font-size: var(--type-summary-label-size);
  letter-spacing: var(--type-summary-label-tracking);
  text-transform: uppercase;
}

.cli-request-lines span:last-child {
  color: var(--text);
  overflow-wrap: anywhere;
}
</style>
