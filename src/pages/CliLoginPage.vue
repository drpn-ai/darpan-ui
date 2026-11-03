<template>
  <StaticPageFrame>
    <template #hero>
      <h1>Approve CLI</h1>
    </template>

    <StaticPageSection>
      <p v-if="phase === 'loading'" class="section-note" role="status">Loading...</p>

      <p v-else-if="phase === 'expired'" class="section-note" role="status" data-testid="cli-login-expired">
        This code expired or was already used. Run darpan login again.
      </p>

      <p v-else-if="phase === 'done'" class="section-note" role="status" data-testid="cli-login-done">
        {{ outcome === 'approved' ? 'CLI approved. Return to your terminal.' : 'CLI denied.' }}
      </p>

      <template v-else>
        <article class="static-page-summary-card">
          <span class="static-page-summary-label">Sign-in request</span>
          <span data-testid="cli-login-host">Darpan CLI on {{ hostLabel }}</span>
          <span class="section-note">That is the name the CLI gave. Darpan has not checked it.</span>
        </article>
        <p class="section-note">Approve only if you just ran darpan login.</p>
        <div class="cli-login-actions">
          <button class="btn-primary" type="button" data-testid="cli-login-approve" :disabled="busy" @click="answer('approved')">
            Approve
          </button>
          <button class="btn-primary" type="button" data-testid="cli-login-deny" :disabled="busy" @click="answer('denied')">
            Deny
          </button>
        </div>
      </template>
    </StaticPageSection>
  </StaticPageFrame>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StaticPageFrame from '../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../components/ui/StaticPageSection.vue'
import { authFacade } from '../lib/api/facade'

type Phase = 'loading' | 'ready' | 'done' | 'expired'

const route = useRoute()
const userCode = typeof route.query.code === 'string' ? route.query.code.trim() : ''
const phase = ref<Phase>('loading')
const hostLabel = ref('')
const outcome = ref<'approved' | 'denied'>('approved')
const busy = ref(false)
const controller = new AbortController()

// Only the read runs on mount. Approve and Deny wait for a click: App.vue keys this view on
// route + tenant, so a remount must never send an answer.
onMounted(async () => {
  if (!userCode) {
    phase.value = 'expired'
    return
  }
  try {
    const response = await authFacade.getCliLoginRequest({ userCode }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok || response.status !== 'PENDING') {
      phase.value = 'expired'
      return
    }
    hostLabel.value = response.hostLabel ?? 'an unknown computer'
    phase.value = 'ready'
  } catch {
    if (!controller.signal.aborted) phase.value = 'expired'
  }
})

onBeforeUnmount(() => controller.abort())

async function answer(choice: 'approved' | 'denied') {
  if (busy.value) return
  busy.value = true
  try {
    const response = choice === 'approved'
      ? await authFacade.approveCliLogin({ userCode }, controller.signal)
      : await authFacade.denyCliLogin({ userCode }, controller.signal)
    if (controller.signal.aborted) return
    if (!response.ok) {
      phase.value = 'expired'
      return
    }
    outcome.value = choice
    phase.value = 'done'
  } catch {
    if (!controller.signal.aborted) phase.value = 'expired'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.cli-login-actions { display: flex; gap: var(--space-2); }
</style>
