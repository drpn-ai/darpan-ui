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
            <span class="static-page-summary-label">Started</span>
            <span data-testid="cli-login-started">{{ startedLabel }}</span>
          </template>
          <span class="static-page-summary-label">Expires</span>
          <span data-testid="cli-login-expires">{{ expiresLabel }}</span>
        </article>
        <p class="section-note">Approve only a code you just started in your own terminal.</p>
        <div class="cli-login-actions">
          <button class="btn-primary" type="button" data-testid="cli-login-approve" :disabled="busy" @click="answer('approved')">
            Approve
          </button>
          <button class="btn-primary" type="button" data-testid="cli-login-deny" :disabled="busy" @click="answer('denied')">
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
          <button type="submit" data-testid="cli-login-lookup" :disabled="busy">Continue</button>
        </div>
      </form>
    </StaticPageSection>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import StaticPageFrame from '../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../components/ui/StaticPageSection.vue'
import CliAccessRequestCard from '../components/settings/CliAccessRequestCard.vue'
import { authFacade } from '../lib/api/facade'
import type { MyCliAccess } from '../lib/api/types'
import { formatDateTime } from '../lib/utils/date'

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
// refusal text is not matched: the person's own CLI access says which, and a person without it is offered the request.
async function refused() {
  confirmedCode = ''
  try {
    const access = (await authFacade.getMyCliAccess(controller.signal)).access ?? null
    if (controller.signal.aborted) return
    if (access && access.state !== 'LIVE' && access.state !== 'DARPAN_ADMIN') {
      myAccess.value = access
      phase.value = 'noaccess'
      return
    }
  } catch {
    // The access check failed too: fall back to the code message.
  }
  if (!controller.signal.aborted) phase.value = 'notfound'
}

async function answer(choice: 'approved' | 'denied') {
  if (busy.value || !confirmedCode) return
  busy.value = true
  try {
    const payload = { userCode: confirmedCode }
    const response = choice === 'approved'
      ? await authFacade.approveCliLogin(payload, controller.signal)
      : await authFacade.denyCliLogin(payload, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok) {
      await refused()
      return
    }
    outcome.value = choice
    phase.value = 'done'
  } catch {
    if (!controller.signal.aborted) await refused()
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.cli-login-actions { display: flex; gap: var(--space-2); }
</style>
