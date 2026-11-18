<template>
  <!-- DAR-UI-123. One Add space flow ("A · Where first"), one question per card. Rendered by its caller outside its
       frame, which blurs while this is open. -->
  <div
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-chat-space-title"
    data-testid="add-chat-space"
    @click.self="requestClose"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="add-chat-space-title">{{ title }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          class="workflow-form--popup-compact workflow-form--dense-popup"
          :question="question"
          :primary-label="primaryLabel"
          :primary-action-variant="primaryVariant"
          :primary-test-id="primaryTestId"
          :submit-disabled="submitDisabled"
          :show-primary-action="showPrimary"
          :show-back="showBack"
          :show-enter-hint="false"
          :show-cancel-action="step !== 'done'"
          :cancel-disabled="busy"
          cancel-test-id="add-chat-space-cancel"
          @back="goBack"
          @cancel="requestClose"
          @submit="submit"
        >
          <InlineValidation v-if="shownError" tone="error" :message="shownError" data-testid="add-chat-space-error" />

          <WorkflowShortcutChoiceCards
            v-if="step === 'where'"
            :options="whereOptions"
            test-id-prefix="add-chat-space-where"
            @choose="chooseWhere"
          />

          <WorkflowShortcutChoiceCards
            v-else-if="step === 'slack-connect'"
            :options="connectOptions"
            test-id-prefix="add-chat-space-connect"
            @choose="chooseConnect"
          />

          <template v-else-if="step === 'slack-token'">
            <label class="wizard-input-shell">
              <span class="workflow-context-label">Bot user OAuth token</span>
              <input
                v-model="token"
                class="wizard-answer-control"
                name="slackBotToken"
                type="password"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                placeholder="xoxb-..."
                data-testid="add-chat-space-token"
                :disabled="busy"
              />
            </label>
            <p class="section-note">Slack app ▸ OAuth &amp; Permissions ▸ Bot User OAuth Token.</p>
          </template>

          <template v-else-if="step === 'channel'">
            <label class="wizard-input-shell">
              <span class="workflow-context-label">Slack channel</span>
              <AppSelect
                v-model="channelId"
                :options="channelOptions"
                :disabled="busy || channelsLoading"
                placeholder="Pick a channel"
                searchable
                search-placeholder="Search channels"
                test-id="add-chat-space-channel"
              />
            </label>
            <p v-if="channelsLoading" class="section-note">Loading channels...</p>
            <p v-else-if="channelNeedsInvite" class="section-note" data-testid="add-chat-space-invite-note">
              That channel is private: invite the Darpan app to it first.
            </p>
            <p v-if="connectNote" class="section-note" role="status">{{ connectNote }}</p>
          </template>

          <template v-else-if="step === 'webhook'">
            <label class="wizard-input-shell">
              <span class="workflow-context-label">Webhook URL</span>
              <input
                v-model="webhookUrl"
                class="wizard-answer-control"
                name="webhookUrl"
                type="text"
                autocomplete="off"
                autocapitalize="none"
                spellcheck="false"
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                data-testid="add-chat-space-webhook"
                :disabled="busy"
              />
            </label>
            <p class="section-note">Open the space ▸ Apps &amp; integrations ▸ Webhooks.</p>
          </template>

          <label v-else-if="step === 'name'" class="wizard-input-shell">
            <span class="workflow-context-label">Space name</span>
            <input
              v-model="spaceName"
              class="wizard-answer-control"
              name="spaceName"
              type="text"
              autocomplete="off"
              placeholder="Operations"
              data-testid="add-chat-space-name"
              :disabled="busy"
            />
          </label>

          <ul v-else-if="step === 'routes'" class="add-chat-space-routes" data-testid="add-chat-space-routes">
            <li v-for="route in routeChoices" :key="routeKey(route)" class="add-chat-space-route">
              <span class="add-chat-space-route__text">
                <span>{{ route.label }}</span>
                <span class="add-chat-space-route__from">{{ fromLine(route) }}</span>
              </span>
              <AppToggleSwitch
                :model-value="picked.includes(routeKey(route))"
                :label="`Post ${route.label} in ${addedName}`"
                :test-id="`add-chat-space-pick-${routeKey(route)}`"
                :disabled="busy"
                @update:model-value="(on) => togglePick(route, on)"
              />
            </li>
          </ul>

          <div v-else-if="step === 'done'" class="add-chat-space-test">
            <button
              type="button"
              :aria-label="`Send test to ${addedName}`"
              data-testid="add-chat-space-send-test"
              :disabled="busy"
              @click="sendTest"
            >
              Send test
            </button>
            <p v-if="testMessage" class="section-note" role="status" data-testid="add-chat-space-test-message">{{ testMessage }}</p>
          </div>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppSelect, { type AppSelectOption } from '../ui/AppSelect.vue'
import AppToggleSwitch from '../ui/AppToggleSwitch.vue'
import InlineValidation from '../ui/InlineValidation.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../workflow/WorkflowStepForm.vue'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { SaveTenantChatSpacePayload } from '../../lib/api/facadeTypes'
import type { NotificationRoute, TenantChatSpace } from '../../lib/api/types'
import { normalizeStringOrEmpty } from '../../lib/utils/strings'
import { forgetPendingAddSpace, rememberPendingAddSpace, useSlackWorkspace } from '../../composables/useSlackWorkspace'

type Step = 'where' | 'slack-connect' | 'slack-token' | 'channel' | 'webhook' | 'name' | 'routes' | 'done'

const props = withDefaults(defineProps<{
  /** The tenant's spaces: a channel that already has one is not offered again. */
  spaces: TenantChatSpace[]
  /** The things that post. Given, the flow asks which of them move to the new space; absent, it skips that card. */
  routes?: NotificationRoute[] | null
  /** 'channel' resumes at the channel card, after the Slack callback. */
  startAt?: 'where' | 'channel'
  /** Off where leaving the page would lose work (the automation wizard): a workspace is then connected by token. */
  allowOauth?: boolean
}>(), {
  routes: null,
  startAt: 'where',
  allowOauth: true,
})

const emit = defineEmits<{
  added: [space: TenantChatSpace]
  routed: [route: NotificationRoute]
  close: []
}>()

const title = 'Add space'
const abortController = new AbortController()
const slack = useSlackWorkspace(abortController.signal)
const { connected, oauthAvailable, channels, channelsLoading } = slack

const step = ref<Step>(props.startAt === 'channel' ? 'channel' : 'where')
const trail = ref<Step[]>([])
const busy = ref(false)
const error = ref<string | null>(null)
const connectNote = ref<string | null>(null)
const testMessage = ref<string | null>(null)
const token = ref('')
const channelId = ref('')
const webhookUrl = ref('')
const spaceName = ref('')
const added = ref<TenantChatSpace | null>(null)
const picked = ref<string[]>([])

const addedName = computed(() => added.value?.spaceName ?? '')
const offersOauth = computed(() => props.allowOauth && oauthAvailable.value)
const usedChannelIds = computed(() => new Set(
  props.spaces.map((space) => normalizeStringOrEmpty(space.slackChannelId)).filter(Boolean),
))
const channelOptions = computed<AppSelectOption[]>(() => channels.value
  .filter((channel) => !usedChannelIds.value.has(channel.id))
  .map((channel) => ({ value: channel.id, label: channel.isPrivate ? `🔒 ${channel.name}` : `#${channel.name}` })))
const selectedChannel = computed(() => channels.value.find((channel) => channel.id === channelId.value) ?? null)
// chat:write.public covers public channels the bot never joined; only a private one it is not in fails, and it fails
// at the first post, not here.
const channelNeedsInvite = computed(() => !!selectedChannel.value?.isPrivate && !selectedChannel.value.isMember)
const routeChoices = computed(() => props.routes ?? [])

const whereOptions = computed<WorkflowShortcutChoiceOption[]>(() => [
  {
    value: 'slack',
    label: 'A Slack channel',
    description: slack.loading.value && !connected.value
      ? ''
      : connected.value ? (connected.value.teamName || 'Slack is connected') : 'Connect a Slack workspace first',
    shortcutKey: 'A',
  },
  { value: 'google', label: 'A Google Chat space', description: 'Paste its webhook', shortcutKey: 'B' },
])
const connectOptions = computed<WorkflowShortcutChoiceOption[]>(() => [
  { value: 'oauth', label: 'Connect Slack', description: 'Opens Slack to authorise Darpan', shortcutKey: 'A' },
  { value: 'token', label: 'Paste a bot token', description: 'An xoxb- token from your Slack app', shortcutKey: 'B' },
])

const question = computed(() => {
  switch (step.value) {
    case 'where': return 'Where should it post?'
    case 'slack-connect': return 'Connect Slack first.'
    case 'slack-token': return 'Paste the bot token.'
    case 'channel': return 'Which channel?'
    case 'webhook': return 'Paste the webhook.'
    case 'name': return 'Name it.'
    case 'routes': return `What should post in ${addedName.value}?`
    default: return `${addedName.value} is added.`
  }
})
const showPrimary = computed(() => step.value !== 'where' && step.value !== 'slack-connect')
const showBack = computed(() => trail.value.length > 0 && step.value !== 'routes' && step.value !== 'done')
const savesSpace = computed(() => step.value === 'channel' || step.value === 'name')
const primaryVariant = computed<'default' | 'save'>(() => (
  savesSpace.value || (step.value === 'routes' && picked.value.length > 0) ? 'save' : 'default'
))
const primaryLabel = computed(() => {
  if (savesSpace.value) return 'Add space'
  if (step.value === 'slack-token') return 'Connect'
  if (step.value === 'routes') return picked.value.length > 0 ? 'Save' : 'Skip'
  if (step.value === 'done') return 'Done'
  return 'Next'
})
const primaryTestId = computed(() => {
  if (savesSpace.value) return 'add-chat-space-save'
  if (step.value === 'slack-token') return 'add-chat-space-connect'
  if (step.value === 'routes') return 'add-chat-space-routes-apply'
  if (step.value === 'done') return 'add-chat-space-done'
  return 'add-chat-space-next'
})
const submitDisabled = computed(() => {
  if (busy.value) return true
  switch (step.value) {
    case 'slack-token': return !normalizeStringOrEmpty(token.value)
    case 'channel': return !channelId.value || channelsLoading.value
    case 'webhook': return !normalizeStringOrEmpty(webhookUrl.value)
    case 'name': return !normalizeStringOrEmpty(spaceName.value)
    default: return false
  }
})
const shownError = computed(() => {
  if (error.value) return error.value
  if (step.value === 'where') return slack.loadError.value
  if (step.value === 'channel') return slack.channelsError.value
  return null
})

function routeKey(route: NotificationRoute): string {
  return `${route.sourceType}-${route.sourceId ?? 'tenant'}`
}

function fromLine(route: NotificationRoute): string {
  if (!route.chatSpaceId) return 'posts nowhere now'
  const name = props.spaces.find((space) => space.chatSpaceId === route.chatSpaceId)?.spaceName ?? route.chatSpaceId
  return `moves from ${name}`
}

function go(next: Step): void {
  error.value = null
  trail.value = [...trail.value, step.value]
  step.value = next
}

function goBack(): void {
  const previous = trail.value[trail.value.length - 1]
  if (!previous || busy.value) return
  error.value = null
  trail.value = trail.value.slice(0, -1)
  step.value = previous
}

/** Slack with none connected: straight to the token card when it is the only way in. */
function slackConnectStep(): Step {
  return offersOauth.value ? 'slack-connect' : 'slack-token'
}

function chooseWhere(value: string): void {
  if (value === 'google') {
    go('webhook')
    return
  }
  go(connected.value ? 'channel' : slackConnectStep())
}

async function chooseConnect(value: string): Promise<void> {
  if (value === 'token') {
    go('slack-token')
    return
  }
  error.value = null
  busy.value = true
  // Before leaving: the callback lands on the Notifications page, which reopens this flow at the channel card.
  rememberPendingAddSpace()
  const result = await slack.beginOauth()
  if (!result.ok) {
    forgetPendingAddSpace()
    error.value = result.message
    busy.value = false
  }
}

function togglePick(route: NotificationRoute, on: boolean): void {
  const key = routeKey(route)
  picked.value = on ? [...picked.value.filter((value) => value !== key), key] : picked.value.filter((value) => value !== key)
}

async function saveToken(): Promise<void> {
  busy.value = true
  error.value = null
  const result = await slack.saveToken(token.value)
  busy.value = false
  if (!result.ok) {
    error.value = result.message
    return
  }
  token.value = ''
  connectNote.value = result.message
  go('channel')
}

async function saveSpace(payload: SaveTenantChatSpacePayload): Promise<void> {
  busy.value = true
  error.value = null
  try {
    const response = await settingsFacade.saveTenantChatSpace(payload, abortController.signal)
    const space = response.chatSpace
    if (!space?.chatSpaceId) {
      error.value = response.errors?.[0] ?? 'The chat space wandered off mid-sentence. Not saved.'
      return
    }
    added.value = space
    emit('added', space)
    trail.value = []
    step.value = routeChoices.value.length > 0 ? 'routes' : 'done'
  } catch (saveError) {
    if ((saveError as { name?: string })?.name === 'AbortError') return
    error.value = saveError instanceof ApiCallError ? saveError.message : 'The chat space wandered off mid-sentence. Not saved.'
  } finally {
    busy.value = false
  }
}

function saveSlackSpace(): Promise<void> {
  const install = connected.value
  const channel = selectedChannel.value
  if (!install || !channel) return Promise.resolve()
  // Named after its channel; renamed later from its column.
  return saveSpace({
    spaceName: `#${channel.name}`,
    chatProviderEnumId: 'CHAT_PROV_SLACK',
    slackInstallId: install.slackInstallId,
    slackChannelId: channel.id,
    slackChannelName: channel.name,
    isActive: true,
  })
}

function saveGoogleSpace(): Promise<void> {
  return saveSpace({
    spaceName: normalizeStringOrEmpty(spaceName.value),
    chatProviderEnumId: 'CHAT_PROV_GOOGLE',
    webhookUrl: normalizeStringOrEmpty(webhookUrl.value),
    isActive: true,
  })
}

async function applyPicks(): Promise<void> {
  const space = added.value
  if (!space) return
  if (picked.value.length === 0) {
    step.value = 'done'
    return
  }
  busy.value = true
  error.value = null
  const failures: string[] = []
  for (const route of routeChoices.value.filter((candidate) => picked.value.includes(routeKey(candidate)))) {
    try {
      const response = await settingsFacade.setNotificationRoute({
        sourceType: route.sourceType,
        ...(route.sourceId ? { sourceId: route.sourceId } : {}),
        chatSpaceId: space.chatSpaceId,
      }, abortController.signal)
      emit('routed', response.route ?? { ...route, chatSpaceId: space.chatSpaceId })
      picked.value = picked.value.filter((key) => key !== routeKey(route))
    } catch (setError) {
      if ((setError as { name?: string })?.name === 'AbortError') return
      failures.push(setError instanceof ApiCallError ? setError.message : `${route.label} did not move.`)
    }
  }
  busy.value = false
  // What moved has moved; what was refused stays picked, with the service's reason.
  if (failures.length > 0) {
    error.value = failures.join(' ')
    return
  }
  step.value = 'done'
}

async function sendTest(): Promise<void> {
  const space = added.value
  if (!space || busy.value) return
  busy.value = true
  error.value = null
  testMessage.value = null
  try {
    const response = await settingsFacade.sendChatSpaceTest({ chatSpaceId: space.chatSpaceId }, abortController.signal)
    testMessage.value = response.messages?.[0] ?? 'Sent.'
  } catch (testError) {
    if ((testError as { name?: string })?.name === 'AbortError') return
    error.value = testError instanceof ApiCallError ? testError.message : 'The test did not go out.'
  } finally {
    busy.value = false
  }
}

async function submit(): Promise<void> {
  if (submitDisabled.value) return
  switch (step.value) {
    case 'slack-token': return saveToken()
    case 'channel': return saveSlackSpace()
    case 'webhook': return go('name')
    case 'name': return saveGoogleSpace()
    case 'routes': return applyPicks()
    case 'done': return emit('close')
  }
}

function requestClose(): void {
  if (busy.value) return
  emit('close')
}

watch(step, (next) => {
  if (next === 'channel' && connected.value && channels.value.length === 0) void slack.loadChannels()
})

onMounted(async () => {
  await slack.load()
  if (step.value !== 'channel') return
  // Resumed after the callback: a refused or failed connection leaves no workspace, so connect again.
  if (connected.value) void slack.loadChannels()
  else step.value = slackConnectStep()
})

onBeforeUnmount(() => {
  abortController.abort()
})
</script>

<style scoped>
.add-chat-space-routes {
  width: 100%;
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.add-chat-space-route {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 3.25rem;
  padding: var(--space-1) var(--space-2);
  font-size: var(--static-tile-text-size);
}

.add-chat-space-route + .add-chat-space-route {
  border-top: 1px solid var(--static-tile-border);
}

.add-chat-space-route__text {
  display: grid;
  min-width: 0;
  overflow-wrap: anywhere;
}

.add-chat-space-route__from {
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.add-chat-space-test {
  display: grid;
  gap: var(--space-1);
  justify-items: start;
}
</style>
