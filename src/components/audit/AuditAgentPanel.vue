<template>
  <section v-if="visible" class="card audit-agent" aria-label="Agent" data-testid="agent-panel">
    <ol v-if="shownMessages.length" class="audit-agent-thread">
      <li
        v-for="message in shownMessages"
        :key="message.id"
        class="audit-agent-message"
        :class="`audit-agent-message--${message.kind.toLowerCase()}`"
        data-testid="agent-message"
        :data-kind="message.kind"
        :data-outcome="message.outcome"
        v-text="message.text"
      />
    </ol>

    <div v-if="openQuestion" class="audit-agent-question" data-testid="agent-question">
      <p>{{ openQuestion.text }}</p>
      <div v-if="openQuestion.options?.length" class="audit-agent-options">
        <button
          v-for="option in openQuestion.options"
          :key="option"
          type="button"
          class="ghost-btn"
          data-testid="agent-question-option"
          :disabled="sending"
          @click="void send(option)"
        >
          {{ option }}
        </button>
      </div>
    </div>

    <div v-if="proposals.length" class="audit-agent-proposals">
      <ProposalCard
        v-for="proposal in proposals"
        :key="proposal.proposalId"
        :proposal="proposal"
        :can-approve="status?.canApprove === true"
        :highlighted="highlightedId === proposal.proposalId"
        @changed="onProposalChanged"
        @reverted="(next) => mergeProposals([next])"
      />
    </div>

    <p v-if="approveHint" class="audit-agent-note" data-testid="agent-approve-hint">{{ approveHint }}</p>
    <p v-if="maskedNotice" class="audit-agent-note" data-testid="agent-masked">{{ maskedNotice }}</p>
    <p v-if="sending" class="audit-agent-note" data-testid="agent-thinking">Thinking.</p>
    <InlineValidation v-if="error" tone="error" :message="error" data-testid="agent-error" />

    <form class="audit-agent-form" data-testid="agent-send" @submit.prevent="void send(draft, true)">
      <label class="wizard-input-shell">
        <span class="workflow-context-label">Ask the agent</span>
        <textarea
          v-model="draft"
          name="agentMessage"
          class="wizard-answer-control workflow-form-textarea"
          rows="2"
          data-testid="agent-input"
          :disabled="sending"
          @keydown.enter.exact.prevent="void send(draft, true)"
        />
      </label>
      <button type="submit" class="ghost-btn" data-testid="agent-submit" aria-label="Send to agent" :disabled="sending || !draft.trim()">
        Send
      </button>
    </form>
  </section>
</template>

<script lang="ts">
// DAR-UI-104. One conversation per tenant and audit, kept by id in this browser and reloaded with get#AgentConversation.
// main.ts forgets them all on login, logout and tenant switch, as it does every other per-user store.
const CONVERSATION_KEY_PREFIX = 'darpan.agentConversation:'

export function agentConversationKey(tenantId: string, auditCode: string): string {
  return `${CONVERSATION_KEY_PREFIX}${tenantId}:${auditCode}`
}

export function clearAgentConversations(): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (key?.startsWith(CONVERSATION_KEY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Storage unavailable: nothing was kept.
  }
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import InlineValidation from '../ui/InlineValidation.vue'
import ProposalCard from './ProposalCard.vue'
import { agentFacade } from '../../lib/api/facade'
import { ApiCallError } from '../../lib/api/client'
import type { AgentProposal, AgentQuestion, AgentTurnOutcome, GetAgentStatusResponse } from '../../lib/api/agentTypes'

// DAR-UI-104. The embedded agent on the audit page (DAR-BE-159). Shown only when the agent is on for the person; every
// reply, a refusal included, is the server's words.

const props = defineProps<{
  auditCode: string
  tenantId: string
  /** The finding open on the page, sent with each message; empty when none is open. */
  findingId: string
}>()

interface PanelMessage {
  id: string
  kind: 'USER' | 'ASSISTANT'
  text: string
  question: AgentQuestion | null
  outcome?: AgentTurnOutcome
}

const status = ref<GetAgentStatusResponse | null>(null)
const messages = ref<PanelMessage[]>([])
const conversationId = ref('')
const draft = ref('')
const sending = ref(false)
const error = ref('')
const masked = ref<string[]>([])
const proposals = ref<AgentProposal[]>([])
const highlightedId = ref('')
const approveHint = ref('')
// DAR-UI-105: typing an approval never applies anything; the card it means is pointed at instead.
const TYPED_APPROVAL = /^\s*(?:yes[\s,.!]*)?(?:approve|apply|accept|go ahead|do it|ok(?:ay)?|yes)\b/i
const OPEN_STATUSES = new Set(['DRAFT', 'PLANNED', 'STALE'])
let sequence = 0
const abort = new AbortController()
onBeforeUnmount(() => abort.abort())

// A turn that only asks a question has no reply text; the question block shows it.
const shownMessages = computed(() => messages.value.filter((message) => message.text))
const visible = computed(() => status.value?.state === 'ON' && status.value.grantState === 'LIVE')
const storageKey = computed(() => agentConversationKey(props.tenantId, props.auditCode))
const openQuestion = computed(() => {
  const last = messages.value[messages.value.length - 1]
  return last?.kind === 'ASSISTANT' ? last.question : null
})
const maskedNotice = computed(() =>
  masked.value.length ? `Masked before sending: ${masked.value.map((kind) => kind.toLowerCase()).join(', ')}.` : '')

function nextId(): string {
  sequence += 1
  return `local-${sequence}`
}

function mergeProposals(next: AgentProposal[] | null | undefined): void {
  if (!next?.length) return
  const merged = [...proposals.value]
  for (const proposal of next) {
    const at = merged.findIndex((existing) => existing.proposalId === proposal.proposalId)
    if (at >= 0) merged[at] = proposal
    else merged.push(proposal)
  }
  proposals.value = merged
}

function onProposalChanged(change: { proposalId: string; status: string }): void {
  proposals.value = proposals.value.map((proposal) =>
    proposal.proposalId === change.proposalId ? { ...proposal, status: change.status } : proposal)
  if (!OPEN_STATUSES.has(change.status) && highlightedId.value === change.proposalId) {
    highlightedId.value = ''
    approveHint.value = ''
  }
}

function readStored(): string {
  try {
    return window.localStorage.getItem(storageKey.value) ?? ''
  } catch {
    return ''
  }
}

function writeStored(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(storageKey.value, id)
    else window.localStorage.removeItem(storageKey.value)
  } catch {
    // Storage unavailable: the conversation lasts as long as the page.
  }
}

async function reload(): Promise<void> {
  const stored = readStored()
  if (!stored) return
  try {
    const conversation = await agentFacade.getAgentConversation({ conversationId: stored }, abort.signal)
    conversationId.value = stored
    messages.value = conversation.messages.map((message) => ({
      id: message.messageId,
      kind: message.kind,
      text: message.text,
      question: message.question,
    }))
    proposals.value = []
    mergeProposals(conversation.proposals)
  } catch {
    if (abort.signal.aborted) return
    // Gone, or not this person's: start a new one on the next message.
    writeStored(null)
  }
}

async function send(text: string, typed = false): Promise<void> {
  const words = text.trim()
  if (!words || sending.value) return
  const waiting = [...proposals.value].reverse().find((proposal) => OPEN_STATUSES.has(proposal.status))
  if (typed && waiting && words.length <= 40 && TYPED_APPROVAL.test(words)) {
    highlightedId.value = waiting.proposalId
    approveHint.value = 'Approve it on the card.'
    draft.value = ''
    return
  }
  approveHint.value = ''
  sending.value = true
  error.value = ''
  try {
    const response = await agentFacade.sendAgentTurn({
      ...(conversationId.value ? { conversationId: conversationId.value } : {}),
      auditCode: props.auditCode,
      ...(props.findingId ? { findingId: props.findingId } : {}),
      text: words,
    }, abort.signal)
    if (response.conversationId) {
      conversationId.value = response.conversationId
      writeStored(response.conversationId)
    }
    messages.value = [
      ...messages.value,
      { id: nextId(), kind: 'USER', text: words, question: null },
      {
        id: nextId(),
        kind: 'ASSISTANT',
        text: response.reply ?? '',
        question: response.question,
        outcome: response.outcome,
      },
    ]
    masked.value = response.masked ?? []
    mergeProposals(response.proposals)
    if (text === draft.value) draft.value = ''
  } catch (sendError) {
    if (abort.signal.aborted) return
    error.value = sendError instanceof ApiCallError ? sendError.message : 'The agent did not answer. Try again.'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  try {
    status.value = await agentFacade.getAgentStatus({}, abort.signal)
  } catch {
    status.value = null
    return
  }
  if (visible.value) await reload()
})
</script>

<style scoped>
.audit-agent {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.audit-agent-thread {
  display: grid;
  gap: var(--space-1-5);
  margin: 0;
  padding: 0;
  list-style: none;
}

.audit-agent-message {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.audit-agent-message--user {
  color: var(--text-soft);
}

.audit-agent-question {
  display: grid;
  gap: var(--space-1-5);
}

.audit-agent-question p {
  margin: 0;
}

.audit-agent-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1-5);
}

.audit-agent-proposals {
  display: grid;
  gap: var(--space-2);
}

.audit-agent-note {
  margin: 0;
  font-size: var(--type-meta-size);
  color: var(--text-dim);
}

.audit-agent-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: end;
}
</style>
