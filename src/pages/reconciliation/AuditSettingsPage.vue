<template>
  <WorkflowPage :progress-percent="'100'" aria-label="Audit settings" center-stage edit-surface>
    <InlineValidation v-if="error" tone="error" :message="error" data-testid="audit-settings-error" />

    <WorkflowStepForm
      :class="['workflow-form--compact', 'workflow-form--edit-single-page']"
      question="Update the audit."
      primary-label="Save"
      primary-action-variant="save"
      :show-enter-hint="false"
      :show-back="false"
      :show-cancel-action="true"
      :cancel-disabled="saving"
      cancel-test-id="audit-settings-cancel"
      :submit-disabled="saving || !original"
      primary-test-id="audit-settings-save"
      @submit="save"
      @cancel="back"
    >
      <div v-if="original" class="audit-settings">
        <label class="wizard-input-shell">
          <span class="workflow-context-label">Name</span>
          <input
            v-model="name"
            name="auditName"
            class="wizard-answer-control"
            data-testid="audit-settings-name"
            :disabled="saving"
          />
        </label>

        <div class="audit-settings-group">
          <span class="workflow-context-label">Schedule</span>
          <div class="audit-settings-schedule">
            <div class="audit-settings-field">
              <span class="audit-settings-label">Daily</span>
              <AppToggleSwitch
                v-model="scheduleActive"
                label="Daily schedule"
                test-id="audit-settings-schedule-active"
                :disabled="saving"
              />
            </div>
            <div class="audit-settings-field">
              <span class="audit-settings-label">Time</span>
              <WorkflowTimeSelect v-model="scheduleTime" test-id="audit-settings-schedule-time" aria-label="Time" :disabled="saving" />
            </div>
            <label class="audit-settings-field">
              <span class="audit-settings-label">Timezone</span>
              <AppSelect
                v-model="scheduleTimeZone"
                test-id="audit-settings-schedule-zone"
                :options="timezoneOptions"
                :disabled="saving"
                searchable
                search-placeholder="Search timezones"
              />
            </label>
          </div>
          <p v-if="original.schedule.mixed" class="section-note" data-testid="audit-settings-schedule-mixed">
            Checks run at different times; a change here sets them all.
          </p>
        </div>

        <div class="audit-settings-group">
          <span class="workflow-context-label">Statements</span>
          <div
            v-for="statement in statements"
            :key="statement.id"
            class="audit-settings-statement"
            :data-testid="`audit-settings-statement-${statement.id}`"
          >
            <div class="audit-settings-statement-row">
              <span class="audit-settings-code">{{ statement.code }}</span>
              <textarea
                v-model="statement.text"
                class="wizard-answer-control audit-settings-text"
                rows="2"
                :aria-label="`${statement.code} statement`"
                :disabled="saving"
              />
              <AppToggleSwitch
                v-model="statement.active"
                :label="`Check statement ${statement.code}`"
                :test-id="`audit-settings-statement-active-${statement.id}`"
                :disabled="saving"
              />
            </div>
            <ul v-if="statement.checks.length" class="audit-settings-checks">
              <li v-for="check in statement.checks" :key="check.id">
                <button
                  v-if="check.savedRunId"
                  type="button"
                  class="audit-settings-check"
                  :aria-label="`Open rules for ${check.label}`"
                  :data-testid="`audit-settings-check-${check.id}`"
                  :disabled="opening"
                  @click="void openRules(check)"
                >
                  {{ check.label }}<span v-if="check.runName" class="audit-settings-run"> · {{ check.runName }}</span>
                </button>
                <span v-else :data-testid="`audit-settings-check-${check.id}`">{{ check.label }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </WorkflowStepForm>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSelect from '../../components/ui/AppSelect.vue'
import AppToggleSwitch from '../../components/ui/AppToggleSwitch.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import WorkflowTimeSelect from '../../components/workflow/WorkflowTimeSelect.vue'
import { auditFacade } from '../../lib/api/facade'
import type { AuditSettings, AuditSettingsCheck, AuditSettingsStatement, SaveAuditSettingsPayload } from '../../lib/api/auditTypes'
import { buildRuleSetDraft, buildSavedRunEditorRoute, resolveSavedRunEditorTarget } from '../../lib/savedRunEditorRoute'
import { buildTimezoneOptions } from '../../lib/timezones'
import { useReconciliationDraftStore } from '../../stores/reconciliationDraft'

// DAR-UI-063. The audit page's settings gear: the audit's name, the daily schedule of every check it runs, and each
// statement's text and on/off, with a way from each check to its run's rules. Save sends only what changed.
const route = useRoute()
const router = useRouter()
const draftStore = useReconciliationDraftStore()
const auditCode = computed(() => String(route.params.audit ?? ''))

const original = ref<AuditSettings | null>(null)
const name = ref('')
const scheduleActive = ref(false)
const scheduleTime = ref('')
const scheduleTimeZone = ref('')
const statements = ref<AuditSettingsStatement[]>([])
const saving = ref(false)
const opening = ref(false)
const error = ref<string | null>(null)

const timezoneOptions = computed(() => buildTimezoneOptions(scheduleTimeZone.value))

let abort = new AbortController()
onBeforeUnmount(() => abort.abort())

// Back to the audit, on the morning it was showing.
const auditRoute = computed(() => {
  const query: Record<string, string> = {}
  for (const key of ['period', 'date']) {
    const value = route.query?.[key]
    if (typeof value === 'string' && value) query[key] = value
  }
  return { name: 'audit-report', params: { audit: auditCode.value }, query }
})

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught)
}

function show(settings: AuditSettings) {
  original.value = settings
  name.value = settings.audit.name
  scheduleActive.value = settings.schedule.active
  scheduleTime.value = settings.schedule.time
  scheduleTimeZone.value = settings.schedule.timeZone
  statements.value = settings.statements.map((statement) => ({ ...statement, checks: [...statement.checks] }))
}

async function load() {
  error.value = null
  try {
    const response = await auditFacade.getAuditSettings({ audit: auditCode.value }, abort.signal)
    if (response.settings) show(response.settings)
    else error.value = response.errors?.[0] || 'Unable to load audit settings.'
  } catch (caught) {
    if (!abort.signal.aborted) error.value = message(caught)
  }
}

function changes(): SaveAuditSettingsPayload | null {
  const was = original.value
  if (!was) return null
  const payload: SaveAuditSettingsPayload = { audit: auditCode.value }
  const nextName = name.value.trim()
  if (nextName && nextName !== was.audit.name) payload.name = nextName

  const changed = statements.value.flatMap((statement) => {
    const before = was.statements.find((s) => s.id === statement.id)
    if (!before) return []
    const change: { id: string; text?: string; active?: boolean } = { id: statement.id }
    if (statement.text.trim() && statement.text.trim() !== before.text) change.text = statement.text.trim()
    if (statement.active !== before.active) change.active = statement.active
    return Object.keys(change).length > 1 ? [change] : []
  })
  if (changed.length) payload.statements = changed

  const schedule = was.schedule
  if (scheduleActive.value !== schedule.active || scheduleTime.value !== schedule.time || scheduleTimeZone.value !== schedule.timeZone) {
    payload.schedule = { active: scheduleActive.value, time: scheduleTime.value, timeZone: scheduleTimeZone.value }
  }
  return Object.keys(payload).length > 1 ? payload : null
}

async function save() {
  if (saving.value || !original.value) return
  const payload = changes()
  if (!payload) {
    back()
    return
  }
  saving.value = true
  error.value = null
  try {
    await auditFacade.saveAuditSettings(payload)
    await router.push(auditRoute.value)
  } catch (caught) {
    error.value = message(caught)
  } finally {
    saving.value = false
  }
}

function back() {
  void router.push(auditRoute.value)
}

// As run history opens a run's settings: find the saved run, hand a rule set its draft, and go to its editor.
async function openRules(check: AuditSettingsCheck) {
  if (!check.savedRunId || opening.value) return
  opening.value = true
  error.value = null
  try {
    const savedRun = await resolveSavedRunEditorTarget(check.savedRunId)
    if (!savedRun) {
      error.value = `Unable to find run "${check.runName || check.savedRunId}".`
      return
    }
    draftStore.setWorkflowOrigin('Audit settings', route.fullPath)
    if (savedRun.runType === 'ruleset') {
      const draft = buildRuleSetDraft(savedRun)
      if (draft) draftStore.setRuleSetDraft(draft, 'ruleset-manager')
    }
    await router.push(buildSavedRunEditorRoute(savedRun))
  } catch (caught) {
    error.value = message(caught)
  } finally {
    opening.value = false
  }
}

onMounted(() => {
  abort.abort()
  abort = new AbortController()
  void load()
})
</script>

<style scoped>
.audit-settings {
  display: grid;
  gap: var(--space-5);
  width: 100%;
  min-width: 0;
}

.audit-settings-group {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
}

.audit-settings-schedule {
  display: grid;
  grid-template-columns: auto minmax(10rem, 1fr) minmax(10rem, 1.4fr);
  gap: var(--space-3);
  align-items: end;
}

.audit-settings-field {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.audit-settings-label {
  color: var(--text-soft);
  font-size: var(--type-summary-label-size);
  line-height: 1;
}

.audit-settings-statement {
  display: grid;
  grid-template-columns: 3.5rem minmax(0, 1fr) auto;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  padding-block: var(--space-2);
  border-bottom: 1px solid var(--workflow-underline);
}

/* The code, text and switch sit on the statement's grid, so its checks line up under the text. */
.audit-settings-statement-row {
  display: contents;
}

.audit-settings-code {
  color: var(--text-soft);
}

.audit-settings-text {
  min-width: 0;
  resize: vertical;
}

.audit-settings-checks {
  grid-column: 2 / -1;
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--text-soft);
}

/* Borderless and underlined, as the automation form's inline actions read. */
.audit-settings-check {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: left;
  text-decoration: underline;
  cursor: pointer;
}

.audit-settings-check:disabled {
  cursor: default;
  opacity: 0.6;
}

.audit-settings-run {
  text-decoration: none;
}

@media (max-width: 768px) {
  .audit-settings-schedule {
    grid-template-columns: 1fr;
  }

  .audit-settings-statement {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .audit-settings-code,
  .audit-settings-checks {
    grid-column: 1 / -1;
  }
}
</style>
