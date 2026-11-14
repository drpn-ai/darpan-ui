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
        <dd>{{ shown.before }}</dd>
      </div>
      <div data-testid="proposal-after">
        <dt>After the change</dt>
        <dd>{{ shown.after }}</dd>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import LoadingState from '../ui/LoadingState.vue'
import { agentFacade } from '../../lib/api/facade'
import { ApiCallError } from '../../lib/api/client'
import type { AgentProposal, AuditChangeKind, PlanAuditChangeResponse } from '../../lib/api/agentTypes'
import { statementChanges } from '../../lib/agentDrafts'

// DAR-UI-105. A change the agent drafted (DAR-BE-159). It changes nothing until a person who may save the audit's checks
// approves the plan they see; the plan's hash goes with the approval, and a plan the audit has moved past is planned
// again. A viewer sees the card without buttons. An applied change can be reverted, which drafts its undo as a new card.

const props = defineProps<{
  proposal: AgentProposal
  canApprove: boolean
  /** The panel points at this card when someone types an approval instead of pressing Approve. */
  highlighted?: boolean
  /** DAR-UI-117. Bumped by the panel when another card's change was applied: an open card plans again, so its Approve
   * matches the audit as it now is instead of first answering "the config changed". */
  replanKey?: number
}>()

const emit = defineEmits<{
  changed: [{ proposalId: string; status: string }]
  reverted: [AgentProposal]
  /** DAR-UI-109. The plan this card shows, so the board can mark what it would change. */
  planned: [{ proposalId: string; plan: PlanAuditChangeResponse }]
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
  STATEMENT_EDIT: 'Statement change',
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
// A backtest that does not apply to this kind of change (a new statement, a schedule) has nothing to show.
const backtest = computed(() => {
  const value = plan.value?.backtest ?? props.proposal.backtest
  return value && value.supported === false && value.reason === 'NOT_APPLICABLE' ? null : value
})
const provenance = computed(() => {
  const blocked = props.proposal.blockedIds ?? []
  if (blocked.length) return `Nothing said or read supports ${blocked.join(', ')}.`
  const from = props.proposal.provenanceStatus
  return from ? PROVENANCE_LABELS[from] ?? from : ''
})

// DAR-UI-109. A statement draft's plan carries every statement of the audit; the card shows only the ones it changes.
const shown = computed(() => {
  const current = plan.value
  if (!current) return { before: '', after: '' }
  // DAR-UI-117. A new check and a schedule read as what they mean, not as the plan's whole state map.
  if (props.proposal.kind === 'ADD_CHECK') {
    const add = (current.after?.add ?? {}) as Record<string, unknown>
    const reads = add.savedRunId && add.savedRunId !== add.label ? ` (reads ${String(add.savedRunId)})` : ''
    return { before: 'Nothing', after: `${String(add.statementCode ?? '')}: ${String(add.label ?? add.savedRunId ?? '')}${reads}` }
  }
  if (props.proposal.kind === 'AUDIT_SETTINGS') return { before: schedule(current.before), after: schedule(current.after) }
  const { before, after } = statementChanges({ kind: props.proposal.kind, before: current.before, after: current.after })
  if (!after.length) return { before: describe(current.before), after: describe(current.after) }
  // A new statement's code is only known once it is approved (drafts are numbered in approval order), so it shows the sentence alone.
  const line = (statement: { id: string; text: string; active: boolean }) =>
    `${props.proposal.kind === 'ADD_STATEMENT' ? '' : `${statement.id}: `}${statement.text}${statement.active ? '' : ' (off)'}`
  return { before: before.map(line).join('\n') || 'Nothing', after: after.map(line).join('\n') }
})

function schedule(state: Record<string, unknown> | null | undefined): string {
  const value = state?.schedule as { active?: boolean; time?: string; timeZone?: string } | undefined
  if (!value) return 'Nothing'
  if (value.active === false) return value.time ? `Off (${value.time}, ${value.timeZone ?? ''})`.replace(', )', ')') : 'Off'
  return `Every day at ${value.time ?? '—'}${value.timeZone ? `, ${value.timeZone}` : ''}`
}

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
    emit('planned', { proposalId: props.proposal.proposalId, plan: planned })
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

watch(() => props.replanKey, () => {
  if (isOpen.value && !busy.value) void planAgain()
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
