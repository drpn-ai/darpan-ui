<template>
  <article class="audit-proposal" :class="{ 'audit-proposal--highlighted': highlighted }" data-testid="proposal-card" :data-proposal="proposal.proposalId">
    <header class="audit-proposal-head">
      <span>{{ KIND_LABELS[proposal.kind] ?? proposal.kind }}</span>
      <span class="audit-proposal-status" data-testid="proposal-status">{{ STATUS_LABELS[status] ?? status }}</span>
    </header>

    <p v-if="note" class="audit-proposal-note" data-testid="proposal-note">{{ note }}</p>
    <LoadingState v-if="planning" noun="the plan" />
    <dl v-if="plan" class="audit-proposal-change">
      <div data-testid="proposal-before">
        <dt>Before the change</dt>
        <dd>{{ describe(plan.before) }}</dd>
      </div>
      <div data-testid="proposal-after">
        <dt>After the change</dt>
        <dd>{{ describe(plan.after) }}</dd>
      </div>
      <div v-if="backtest" data-testid="proposal-backtest">
        <dt>Backtest</dt>
        <dd>{{ describe(backtest) }}</dd>
      </div>
    </dl>
    <p v-if="provenance" class="audit-proposal-note" data-testid="proposal-provenance">{{ provenance }}</p>
    <InlineValidation v-if="error" tone="error" :message="error" data-testid="proposal-error" />

    <div v-if="canApprove && (isOpen || status === 'APPLIED')" class="audit-proposal-actions">
      <template v-if="isOpen">
        <button type="button" class="ghost-btn" data-testid="proposal-approve" aria-label="Approve change" :disabled="busy || !plan?.planHash" @click="void approve()">Approve</button>
        <button type="button" class="ghost-btn" data-testid="proposal-reject" aria-label="Reject change" :disabled="busy" @click="void reject()">Reject</button>
      </template>
      <button v-else type="button" class="ghost-btn" data-testid="proposal-revert" aria-label="Revert change" :disabled="busy" @click="void revert()">Revert</button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import LoadingState from '../ui/LoadingState.vue'
import { agentFacade } from '../../lib/api/facade'
import { ApiCallError } from '../../lib/api/client'
import type { AgentProposal, AuditChangeKind, PlanAuditChangeResponse } from '../../lib/api/agentTypes'

// DAR-UI-105. A change the agent drafted (DAR-BE-159). It changes nothing until a person who may save the audit's checks
// approves the plan they see; the plan's hash goes with the approval, and a plan the audit has moved past is planned
// again. A viewer sees the card without buttons. An applied change can be reverted, which drafts its undo as a new card.

const props = defineProps<{
  proposal: AgentProposal
  canApprove: boolean
  /** The panel points at this card when someone types an approval instead of pressing Approve. */
  highlighted?: boolean
}>()

const emit = defineEmits<{
  changed: [{ proposalId: string; status: string }]
  reverted: [AgentProposal]
}>()

const OPEN = new Set(['DRAFT', 'PLANNED', 'STALE'])
const KIND_LABELS: Record<AuditChangeKind, string> = {
  EXCLUSION_FILTER: 'Exclusion',
  STATEMENT_NARROWING: 'Narrower statement',
  EXPECTED_CAUSES: 'Expected causes',
  FIX_TEXT: 'Fix wording',
  CONCLUSION_ROWS: 'Conclusions',
  AUDIT_SETTINGS: 'Audit settings',
  ADD_STATEMENT: 'New statement',
  ADD_CHECK: 'New check',
}
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PLANNED: 'Waiting for approval',
  STALE: 'Planned again',
  APPLIED: 'Applied',
  REJECTED: 'Rejected',
  INVALID: 'Cannot be saved',
  REVERTED: 'Reverted',
}
const PROVENANCE_LABELS: Record<string, string> = {
  SUPPORTED: 'From what was said and read in this conversation.',
}

const status = ref(props.proposal.status)
const plan = ref<PlanAuditChangeResponse | null>(null)
const planning = ref(false)
const busy = ref(false)
const error = ref('')
const note = ref(props.proposal.statusMessage ?? '')
const abort = new AbortController()
onBeforeUnmount(() => abort.abort())

const isOpen = computed(() => OPEN.has(status.value))
const backtest = computed(() => plan.value?.backtest ?? props.proposal.backtest)
const provenance = computed(() => {
  const blocked = props.proposal.blockedIds ?? []
  if (blocked.length) return `Nothing said or read supports ${blocked.join(', ')}.`
  const from = props.proposal.provenanceStatus
  return from ? PROVENANCE_LABELS[from] ?? from : ''
})

function describe(value: Record<string, unknown> | null | undefined): string {
  if (!value || !Object.keys(value).length) return 'Nothing'
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${typeof entry === 'string' ? entry : JSON.stringify(entry)}`)
    .join('\n')
}

function failure(cause: unknown, fallback: string): string {
  return cause instanceof ApiCallError ? cause.message : fallback
}

function setStatus(next: string): void {
  status.value = next
  emit('changed', { proposalId: props.proposal.proposalId, status: next })
}

async function planAgain(): Promise<void> {
  planning.value = true
  error.value = ''
  try {
    const planned = await agentFacade.planAuditChange({ proposalId: props.proposal.proposalId }, abort.signal)
    plan.value = planned
    if (planned.status && planned.status !== status.value) setStatus(planned.status)
    if (planned.statusMessage) note.value = planned.statusMessage
  } catch (cause) {
    if (!abort.signal.aborted) error.value = failure(cause, 'The change could not be planned.')
  } finally {
    planning.value = false
  }
}

async function approve(): Promise<void> {
  const planHash = plan.value?.planHash
  if (!planHash || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const applied = await agentFacade.applyAuditChange({ proposalId: props.proposal.proposalId, planHash }, abort.signal)
    note.value = applied.statusMessage ?? ''
    if (applied.status === 'STALE') {
      // The audit moved since this plan: nothing was written; show the new plan to approve instead.
      await planAgain()
      if (applied.statusMessage) note.value = applied.statusMessage
    } else {
      setStatus(applied.status)
    }
  } catch (cause) {
    if (!abort.signal.aborted) error.value = failure(cause, 'The change was not applied.')
  } finally {
    busy.value = false
  }
}

async function reject(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const rejected = await agentFacade.rejectAuditChange({ proposalId: props.proposal.proposalId }, abort.signal)
    setStatus(rejected.status)
  } catch (cause) {
    if (!abort.signal.aborted) error.value = failure(cause, 'The change was not rejected.')
  } finally {
    busy.value = false
  }
}

async function revert(): Promise<void> {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const reverted = await agentFacade.revertAuditChange({ proposalId: props.proposal.proposalId }, abort.signal)
    if (reverted.newProposalId) {
      emit('reverted', {
        proposalId: reverted.newProposalId,
        kind: props.proposal.kind,
        status: reverted.status,
        statusMessage: reverted.statusMessage,
        provenanceStatus: null,
        blockedIds: null,
        backtest: null,
      })
    } else if (reverted.statusMessage) {
      note.value = reverted.statusMessage
    }
  } catch (cause) {
    if (!abort.signal.aborted) error.value = failure(cause, 'The change was not reverted.')
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  if (isOpen.value) void planAgain()
})
</script>

<style scoped>
.audit-proposal {
  display: grid;
  gap: var(--space-1-5);
  padding: var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
}

.audit-proposal--highlighted {
  border-color: var(--accent);
}

.audit-proposal-head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
}

.audit-proposal-status,
.audit-proposal-note {
  margin: 0;
  font-size: var(--type-meta-size);
  color: var(--text-dim);
}

.audit-proposal-change {
  display: grid;
  gap: var(--space-1);
  margin: 0;
}

.audit-proposal-change dt {
  font-size: var(--type-meta-size);
  color: var(--text-dim);
}

.audit-proposal-change dd {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.audit-proposal-actions {
  display: flex;
  gap: var(--space-1-5);
}
</style>
