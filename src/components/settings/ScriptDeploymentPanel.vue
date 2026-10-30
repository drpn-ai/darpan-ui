<template>
  <div class="script-deploy" data-testid="script-deploy">
    <p class="section-note" data-testid="script-deploy-summary">{{ summary }}</p>

    <div class="workflow-form-grid workflow-form-grid--two">
      <label v-if="!customCron" class="wizard-input-shell">
        <span class="workflow-context-label">Every day at ({{ timeZone || 'tenant zone' }})</span>
        <input v-model="form.time" class="wizard-answer-control" type="time" data-testid="script-deploy-time" :disabled="!canEdit || busy" />
      </label>
      <label v-else class="wizard-input-shell">
        <span class="workflow-context-label">Schedule (cron, {{ timeZone || 'tenant zone' }})</span>
        <input v-model="form.cron" class="wizard-answer-control" type="text" data-testid="script-deploy-cron" :disabled="!canEdit || busy" />
      </label>
      <label class="wizard-input-shell">
        <span class="workflow-context-label">Post to</span>
        <AppSelect
          v-model="form.chatSpaceId"
          :options="chatSpaceOptions"
          placeholder="Select chat space"
          test-id="script-deploy-space"
          :disabled="!canEdit || busy"
        />
      </label>
    </div>
    <label v-if="readsRunResult" class="wizard-input-shell">
      <span class="workflow-context-label">Reads the newest result of</span>
      <AppSelect
        v-model="form.inputSavedRunId"
        :options="savedRunOptions"
        placeholder="Select saved run"
        test-id="script-deploy-run"
        searchable
        search-placeholder="Search saved runs"
        :disabled="!canEdit || busy"
      />
    </label>
    <div class="script-deploy-toggle">
      <AppToggleSwitch v-model="form.isActive" label="Run on schedule" test-id="script-deploy-active" :disabled="!canEdit || busy" />
      <span>{{ form.isActive ? 'On schedule' : 'Off' }}</span>
    </div>

    <InlineValidation v-if="error" tone="error" :message="error" />

    <div v-if="canEdit" class="wizard-actions">
      <AppSaveAction label="Save deployment" test-id="script-deploy-save" :disabled="busy || !form.chatSpaceId" @click="save" />
      <button type="button" class="wizard-back" data-testid="script-deploy-preview" :disabled="busy || !deployment" @click="run(false)">
        Preview message
      </button>
      <button type="button" class="wizard-back" data-testid="script-deploy-send" :disabled="busy || !deployment" @click="run(true)">
        {{ confirmSend ? `Confirm send to ${spaceName(deployment?.chatSpaceId)}` : 'Send now' }}
      </button>
      <button v-if="deployment" type="button" class="wizard-back" data-testid="script-deploy-delete" :disabled="busy" @click="remove">
        {{ confirmDelete ? 'Confirm delete' : 'Delete deployment' }}
      </button>
    </div>

    <div v-if="outcome" class="script-deploy-outcome" data-testid="script-deploy-outcome">
      <span class="workflow-context-label">{{ statusWords(outcome.status) }}</span>
      <p class="section-note" data-testid="script-deploy-outcome-message">{{ outcome.message }}</p>
      <pre v-if="outcome.text" class="script-deploy-text" data-testid="script-deploy-text">{{ outcome.text }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
// DAR-BE-167. Deploy one saved script: every day at a time (or a cron), read its input, post the text it returns to a
// chat space. Preview runs it without posting; Send now posts once (two clicks). One deployment per script here; the
// backend allows more.
import { computed, onMounted, ref, watch } from 'vue'
import AppSaveAction from '../ui/AppSaveAction.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppToggleSwitch from '../ui/AppToggleSwitch.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import { scriptFacade } from '../../lib/api/facade'
import type { ScriptDeploymentOutcome, TenantScript, TenantScriptDeployment } from '../../lib/api/scriptTypes'
import type { TenantChatSpace } from '../../lib/api/types'
import { cronFromTime, statusWords, timeFromCron } from '../../lib/scriptDeployment'

const props = defineProps<{
  script: TenantScript
  chatSpaces: TenantChatSpace[]
  savedRunOptions: { value: string; label: string }[]
  canEdit: boolean
}>()

const deployment = ref<TenantScriptDeployment | null>(null)
const timeZone = ref('')
const form = ref({ time: '09:00', cron: '', chatSpaceId: '', inputSavedRunId: '', isActive: false })
const customCron = ref(false)
const busy = ref(false)
const error = ref('')
const outcome = ref<ScriptDeploymentOutcome | null>(null)
const confirmSend = ref(false)
const confirmDelete = ref(false)

const readsRunResult = computed(() => props.script.inputSource === 'RUN_RESULT')
const chatSpaceOptions = computed(() =>
  props.chatSpaces
    .filter((space) => space.isActive !== 'N')
    .map((space) => ({ value: space.chatSpaceId, label: `${space.spaceName} · ${space.chatProviderLabel}` })))

const summary = computed(() => {
  const current = deployment.value
  if (!current) return 'Not deployed. Pick a time and a chat space, then save.'
  const when = timeFromCron(current.scheduleExpr)
  const schedule = when ? `Every day at ${when}` : `Cron ${current.scheduleExpr}`
  const parts = [`${schedule} (${timeZone.value || 'tenant zone'})`, current.isActive ? `next ${formatDate(current.nextRunDate)}` : 'off']
  if (current.lastRunStatus) {
    parts.push(`last: ${statusWords(current.lastRunStatus)}, ${formatDate(current.lastRunDate)}`)
  }
  return parts.join(' · ')
})

function formatDate(value: string | number | null): string {
  if (value == null || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timeZone.value || undefined,
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

function spaceName(chatSpaceId: string | undefined): string {
  return props.chatSpaces.find((space) => space.chatSpaceId === chatSpaceId)?.spaceName ?? 'the chat space'
}

function messageOf(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback
}

function fillForm(current: TenantScriptDeployment | null): void {
  const time = timeFromCron(current?.scheduleExpr)
  customCron.value = Boolean(current && !time)
  form.value = {
    time: time ?? '09:00',
    cron: current?.scheduleExpr ?? '',
    chatSpaceId: current?.chatSpaceId ?? '',
    inputSavedRunId: current?.inputSavedRunId ?? '',
    isActive: current?.isActive ?? false,
  }
}

async function load(): Promise<void> {
  error.value = ''
  outcome.value = null
  try {
    const out = await scriptFacade.listTenantScriptDeployments({ tenantScriptId: props.script.tenantScriptId })
    timeZone.value = out.timeZone ?? ''
    deployment.value = (out.deployments ?? [])[0] ?? null
    fillForm(deployment.value)
  } catch (caught) {
    error.value = messageOf(caught, 'Could not load the deployment.')
  }
}

async function save(): Promise<void> {
  if (busy.value || !props.canEdit) return
  const scheduleExpr = customCron.value ? form.value.cron.trim() : cronFromTime(form.value.time)
  if (!scheduleExpr) {
    error.value = 'Pick a time like 09:00.'
    return
  }
  busy.value = true
  error.value = ''
  confirmSend.value = false
  try {
    const out = await scriptFacade.saveTenantScriptDeployment({
      tenantScriptDeploymentId: deployment.value?.tenantScriptDeploymentId,
      tenantScriptId: props.script.tenantScriptId,
      scheduleExpr,
      inputSavedRunId: readsRunResult.value ? form.value.inputSavedRunId || undefined : undefined,
      chatSpaceId: form.value.chatSpaceId,
      isActive: form.value.isActive,
    })
    deployment.value = out.deployment
    fillForm(out.deployment)
  } catch (caught) {
    error.value = messageOf(caught, 'Could not save the deployment.')
  } finally {
    busy.value = false
  }
}

async function run(send: boolean): Promise<void> {
  const current = deployment.value
  if (!current || busy.value) return
  if (send && !confirmSend.value) {
    confirmSend.value = true
    return
  }
  busy.value = true
  error.value = ''
  try {
    const out = await scriptFacade.runTenantScriptDeployment({ tenantScriptDeploymentId: current.tenantScriptDeploymentId, send })
    outcome.value = out.outcome
    if (out.deployment) deployment.value = out.deployment
  } catch (caught) {
    error.value = messageOf(caught, send ? 'Could not send.' : 'Could not preview.')
  } finally {
    busy.value = false
    confirmSend.value = false
  }
}

async function remove(): Promise<void> {
  const current = deployment.value
  if (!current || busy.value) return
  if (!confirmDelete.value) {
    confirmDelete.value = true
    return
  }
  busy.value = true
  try {
    await scriptFacade.deleteTenantScriptDeployment({ tenantScriptDeploymentId: current.tenantScriptDeploymentId })
    deployment.value = null
    outcome.value = null
    fillForm(null)
  } catch (caught) {
    error.value = messageOf(caught, 'Could not delete the deployment.')
  } finally {
    busy.value = false
    confirmDelete.value = false
  }
}

watch(() => props.script.tenantScriptId, () => { void load() })
onMounted(load)
</script>

<style scoped>
.script-deploy,
.script-deploy-outcome {
  display: grid;
  gap: var(--space-3);
}

.script-deploy-text {
  margin: 0;
  padding: var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
}

.script-deploy-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
