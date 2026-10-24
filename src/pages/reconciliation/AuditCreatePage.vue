<template>
  <WorkflowPage :progress-percent="step === 'name' ? 0 : 50" aria-label="Create an audit" center-stage>
    <div class="workflow-step-wrapper">
      <WorkflowStepForm
        v-if="step === 'name'"
        question="What is the audit called?"
        :submit-disabled="!name.trim()"
        :show-back="true"
        @back="backToTypeChoice"
        @submit="step = 'period'"
      >
        <div class="wizard-input-shell">
          <input
            v-model="name"
            name="auditName"
            class="wizard-answer-control"
            placeholder="Month close"
            data-testid="audit-create-name"
            @input="error = null"
          />
        </div>
        <InlineValidation v-if="error" tone="error" :message="error" data-testid="audit-create-error" />
      </WorkflowStepForm>

      <WorkflowStepForm
        v-else
        question="What does one report cover?"
        primary-action-variant="save"
        primary-label="Create audit"
        :submit-disabled="saving || !period"
        :allow-select-enter="true"
        :show-back="true"
        :show-cancel-action="true"
        @back="step = 'name'"
        @cancel="cancel"
        @submit="create"
      >
        <div class="wizard-input-shell">
          <WorkflowSelect v-model="period" :options="periodOptions" placeholder="pick a period" test-id="audit-create-period" />
        </div>
      </WorkflowStepForm>
    </div>
  </WorkflowPage>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import WorkflowPage from '../../components/workflow/WorkflowPage.vue'
import WorkflowSelect from '../../components/workflow/WorkflowSelect.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { auditFacade } from '../../lib/api/facade'
import type { CreateAuditPayload } from '../../lib/api/auditTypes'

// DAR-UI-078. An audit in two steps, one question each: its name, then the period one report covers. It is made on the
// second, and its settings open, where statements and their checks are added. The period is picked from a list, so a
// refusal is about the name (taken, or no letters): it is said on the name's step.
const router = useRouter()
const step = ref<'name' | 'period'>('name')
const name = ref('')
const period = ref<CreateAuditPayload['period'] | ''>('month')
const saving = ref(false)
const error = ref<string | null>(null)

const periodOptions = [
  { value: 'day', label: 'A day' },
  { value: 'month', label: 'A month' },
  { value: 'quarter', label: 'A quarter' },
]

function backToTypeChoice() { void router.push({ name: 'run-create' }) }
function cancel() { void router.push({ name: 'hub' }) }

function refused(message: string) {
  error.value = message
  step.value = 'name'
}

async function create() {
  if (saving.value || !period.value || !name.value.trim()) return
  saving.value = true
  error.value = null
  try {
    const response = await auditFacade.createAudit({ name: name.value.trim(), period: period.value })
    const audit = response.audit?.id
    if (!audit) {
      refused(response.errors?.[0] || 'The audit was not made.')
      return
    }
    await router.push({ name: 'audit-settings', params: { audit } })
  } catch (caught) {
    refused(caught instanceof Error ? caught.message : String(caught))
  } finally {
    saving.value = false
  }
}
</script>
