<template>
  <article class="static-page-summary-card" data-testid="cli-access-card">
    <span class="static-page-summary-label">CLI in {{ access.tenantLabel }}</span>
    <span data-testid="cli-access-state">{{ stateLine }}</span>

    <template v-if="canAsk">
      <p v-if="request?.statusId === 'PENDING'" class="section-note" role="status" data-testid="cli-access-pending">
        Requested {{ formatDateTime(request.requestedDate) }}. A Darpan admin will turn it on.
      </p>
      <template v-else>
        <p v-if="request?.statusId === 'DECLINED'" class="section-note" data-testid="cli-access-declined">
          Declined {{ formatDateTime(request.decidedDate) }}{{ request.decisionNote ? `: ${request.decisionNote}` : '.' }}
        </p>
        <label>
          <span>What it is for (optional)</span>
          <input v-model="reason" type="text" maxlength="500" data-testid="cli-access-reason" />
        </label>
        <div class="action-row">
          <button type="button" class="btn-primary" :disabled="busy" data-testid="cli-access-request" @click="ask">
            Request access in {{ access.tenantLabel }}
          </button>
        </div>
      </template>
    </template>

    <p v-if="error" class="section-note" role="alert" data-testid="cli-access-error">{{ error }}</p>
  </article>
</template>

<script setup lang="ts">
// DAR-BE-209: the signed-in person's CLI access in the active tenant, and the button that asks a Darpan admin for it.
// Shown on Approve CLI when an approve is refused for want of access, and on User settings.
import { computed, ref } from 'vue'
import { authFacade } from '../../lib/api/facade'
import { ApiCallError } from '../../lib/api/client'
import type { CliAccessRequest, MyCliAccess } from '../../lib/api/types'
import { formatDateTime } from '../../lib/utils/date'

const props = defineProps<{ access: MyCliAccess }>()

const request = ref<CliAccessRequest | null>(props.access.request ?? null)
const reason = ref('')
const busy = ref(false)
const error = ref('')

const canAsk = computed(() => props.access.state !== 'LIVE' && props.access.state !== 'DARPAN_ADMIN')

const stateLine = computed(() => {
  const a = props.access
  switch (a.state) {
    case 'DARPAN_ADMIN':
      return 'On in every tenant (Darpan admin).'
    case 'LIVE':
      return `On${a.thruDate ? ` until ${formatDateTime(a.thruDate)}` : ''}. A sign-in lasts ${a.lifetimeDays} days.`
    case 'PAUSED':
      return 'Paused by a Darpan admin.'
    case 'ENDED':
      return 'Ended.'
    default:
      return 'Not on for you.'
  }
})

async function ask() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const response = await authFacade.requestCliAccess(reason.value)
    request.value = response.request ?? null
  } catch (err) {
    error.value = err instanceof ApiCallError ? err.message : 'Could not send the request.'
  } finally {
    busy.value = false
  }
}
</script>
