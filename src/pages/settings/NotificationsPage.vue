<template>
  <StaticPageFrame :class="{ 'static-page-frame--popup-open': isPopupOpen }">
    <template #hero>
      <h1 v-explain="'notificationRoutes'">Notifications</h1>
    </template>

    <LoadingState v-if="loading" noun="notifications" />
    <!-- On the page, not in a popup: the Slack callback returns here with none open. -->
    <InlineValidation v-if="pageError" tone="error" :message="pageError" data-testid="notifications-page-error" />
    <p v-if="statusMessage" class="section-note" role="status" data-testid="notifications-status">{{ statusMessage }}</p>

    <StaticPageSection v-if="loaded" data-testid="notifications-section-grid">
      <div class="app-table-shell notifications-grid-shell">
        <table class="app-table notifications-grid" data-testid="notifications-grid">
          <thead>
            <tr>
              <th v-explain="'notificationSource'" scope="col" class="notifications-grid__source-head">Posts</th>
              <th
                v-for="space in spaces"
                :key="space.chatSpaceId"
                v-explain="'chatSpace'"
                scope="col"
                :class="['notifications-grid__space-head', { 'notifications-grid__space-head--off': isOff(space) }]"
                data-testid="notifications-space-column"
                :data-space-id="space.chatSpaceId"
              >
                <span class="notifications-grid__space">
                  <StaticEditableTitle
                    :ref="(component) => setTitleRef(space.chatSpaceId, component)"
                    :key="`${space.chatSpaceId}-${titleRedraw}`"
                    tag="span"
                    class="notifications-grid__space-name"
                    :model-value="space.spaceName"
                    :editable="canEdit"
                    :aria-label="`Rename ${space.spaceName}`"
                    :test-id="`notifications-space-name-${space.chatSpaceId}`"
                    @commit="(name) => renameSpace(space, name)"
                  />
                  <span class="notifications-grid__product">{{ productLine(space) }}</span>
                  <span class="notifications-grid__space-actions">
                    <button
                      type="button"
                      :aria-label="`Send test to ${space.spaceName}`"
                      data-testid="notifications-send-test"
                      :disabled="!canEdit || testingSpaceId !== null"
                      @click="sendTest(space)"
                    >
                      Send test
                    </button>
                    <button
                      type="button"
                      class="app-icon-action"
                      :aria-label="`Edit chat space ${space.spaceName}`"
                      :title="`Edit chat space ${space.spaceName}`"
                      data-testid="notifications-space-edit"
                      :disabled="!canEdit"
                      @click="openSpaceMenu(space.chatSpaceId)"
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                        <path :d="editIconPath" fill="currentColor" />
                      </svg>
                    </button>
                  </span>
                </span>
              </th>
              <th v-explain="'notificationNowhere'" scope="col" class="notifications-grid__nowhere-head">Nowhere</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="source in routes"
              :key="routeKey(source)"
              data-testid="notifications-route-row"
              :data-route-key="routeKey(source)"
            >
              <th scope="row" class="notifications-grid__source">
                <span class="notifications-grid__source-name">{{ source.label }}</span>
                <span v-if="source.when || source.paused" class="notifications-grid__when">
                  {{ source.when }}<span v-if="source.paused" v-explain="'notificationPaused'" data-testid="notifications-paused"> · paused</span>
                </span>
              </th>
              <td v-for="space in spaces" :key="space.chatSpaceId" class="notifications-grid__cell">
                <button
                  type="button"
                  role="radio"
                  class="notifications-grid__dot"
                  :aria-checked="source.chatSpaceId === space.chatSpaceId ? 'true' : 'false'"
                  :aria-label="`Post ${source.label} in ${space.spaceName}`"
                  data-testid="notifications-dot"
                  :data-space-id="space.chatSpaceId"
                  :disabled="!canEdit || isOff(space) || savingKey !== null"
                  @click="setRoute(source, space.chatSpaceId)"
                  @keydown.left.prevent="moveFocus($event, -1)"
                  @keydown.right.prevent="moveFocus($event, 1)"
                >
                  <span class="notifications-grid__mark" aria-hidden="true" />
                </button>
              </td>
              <td class="notifications-grid__cell">
                <!-- A deployed script always posts somewhere: set#NotificationRoute refuses it no space. -->
                <button
                  v-if="source.sourceType !== 'SCRIPT'"
                  type="button"
                  role="radio"
                  class="notifications-grid__dot"
                  :aria-checked="source.chatSpaceId ? 'false' : 'true'"
                  :aria-label="`Post ${source.label} nowhere`"
                  data-testid="notifications-dot"
                  data-space-id=""
                  :disabled="!canEdit || savingKey !== null"
                  @click="setRoute(source, null)"
                  @keydown.left.prevent="moveFocus($event, -1)"
                  @keydown.right.prevent="moveFocus($event, 1)"
                >
                  <span class="notifications-grid__mark" aria-hidden="true" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="routes.length === 0" class="section-note">Nothing posts yet.</p>
    </StaticPageSection>

    <!-- DAR-UI-123. The Slack workspace's upkeep, out of the add-space flow. -->
    <StaticPageSection v-if="connected || slackLoadError" data-testid="notifications-section-slack">
      <InlineValidation v-if="slackLoadError" tone="warning" :message="slackLoadError" data-testid="notifications-slack-error" />
      <ul v-if="connected" class="notifications-rows" data-testid="notifications-slack-line">
        <li class="notifications-row">
          <span v-explain="'slackWorkspace'" class="notifications-row__name">Slack</span>
          <span class="notifications-row__value">{{ connected.teamName || 'Connected' }}</span>
          <span class="notifications-row__actions">
            <button
              v-if="oauthAvailable"
              type="button"
              aria-label="Reconnect Slack"
              data-testid="notifications-slack-reconnect"
              :disabled="!canEdit || slackBusy"
              @click="reconnectSlack"
            >
              Reconnect
            </button>
            <button
              type="button"
              aria-label="Replace Slack token"
              data-testid="notifications-slack-token"
              :disabled="!canEdit || slackBusy"
              @click="openSlackToken"
            >
              Replace token
            </button>
            <button
              type="button"
              aria-label="Disconnect Slack"
              data-testid="notifications-slack-disconnect"
              :disabled="!canEdit || slackBusy"
              @click="disconnectSlack"
            >
              Disconnect
            </button>
          </span>
        </li>
      </ul>
    </StaticPageSection>

    <template #actions>
      <div class="action-row">
        <button
          v-if="canEdit"
          type="button"
          class="app-icon-action app-icon-action--large"
          aria-label="Add space"
          title="Add space"
          data-testid="notifications-add-space"
          @click="openAdd('where')"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path :d="plusIconPath" fill="currentColor" />
          </svg>
        </button>
      </div>
    </template>
  </StaticPageFrame>

  <AddChatSpaceFlow
    v-if="activePopup?.type === 'add'"
    :spaces="chatSpaces"
    :routes="routes"
    :start-at="activePopup.startAt"
    @added="onSpaceAdded"
    @routed="applyRoute"
    @close="closePopup"
  />

  <div
    v-else-if="isPopupOpen"
    class="popup-workflow-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="notifications-popup-title"
    @click.self="closePopup"
  >
    <section class="popup-workflow-modal workflow-panel">
      <header class="workflow-panel-header">
        <h2 id="notifications-popup-title">{{ popupTitle }}</h2>
      </header>

      <div class="workflow-step-wrapper">
        <WorkflowStepForm
          v-if="activePopup?.type === 'space-menu'"
          class="workflow-form--popup-compact"
          :question="`What do you want to do with ${menuSpace?.spaceName ?? 'this space'}?`"
          :show-primary-action="false"
          show-cancel-action
          cancel-label="Close"
          cancel-test-id="notifications-space-menu-close"
          @cancel="closePopup"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <WorkflowShortcutChoiceCards
            :options="spaceMenuOptions"
            test-id-prefix="notifications-space-menu"
            @choose="chooseSpaceMenu"
          />
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'space-webhook'"
          class="workflow-form--popup-compact workflow-form--dense-popup"
          question="Paste the new webhook."
          :primary-label="popupSaving ? 'Saving' : 'Save'"
          primary-action-variant="save"
          primary-test-id="notifications-save-webhook"
          :submit-disabled="popupSaving || !webhookInput.trim()"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="notifications-webhook-cancel"
          @cancel="closePopup"
          @submit="saveWebhook"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Webhook URL</span>
            <input
              v-model="webhookInput"
              class="wizard-answer-control"
              name="webhookUrl"
              type="text"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              :placeholder="menuFullSpace?.webhookUrl || 'https://chat.googleapis.com/v1/spaces/...'"
              data-testid="notifications-webhook-input"
              :disabled="popupSaving"
            />
          </label>
          <p class="section-note">Open the space ▸ Apps &amp; integrations ▸ Webhooks.</p>
        </WorkflowStepForm>

        <WorkflowStepForm
          v-else-if="activePopup?.type === 'slack-token'"
          class="workflow-form--popup-compact workflow-form--dense-popup"
          question="Paste the bot token."
          :primary-label="popupSaving ? 'Checking' : 'Connect'"
          primary-test-id="notifications-save-slack-token"
          :submit-disabled="popupSaving || !tokenInput.trim()"
          :show-enter-hint="false"
          show-cancel-action
          cancel-test-id="notifications-slack-token-cancel"
          @cancel="closePopup"
          @submit="saveSlackToken"
        >
          <InlineValidation v-if="popupError" tone="error" :message="popupError" />
          <label class="wizard-input-shell">
            <span class="workflow-context-label">Bot user OAuth token</span>
            <input
              v-model="tokenInput"
              class="wizard-answer-control"
              name="slackBotToken"
              type="password"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
              placeholder="xoxb-..."
              data-testid="notifications-slack-token-input"
              :disabled="popupSaving"
            />
          </label>
          <p class="section-note">Slack app ▸ OAuth &amp; Permissions ▸ Bot User OAuth Token.</p>
        </WorkflowStepForm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AddChatSpaceFlow from '../../components/settings/AddChatSpaceFlow.vue'
import InlineValidation from '../../components/ui/InlineValidation.vue'
import LoadingState from '../../components/ui/LoadingState.vue'
import StaticEditableTitle from '../../components/ui/StaticEditableTitle.vue'
import StaticPageFrame from '../../components/ui/StaticPageFrame.vue'
import StaticPageSection from '../../components/ui/StaticPageSection.vue'
import WorkflowShortcutChoiceCards, { type WorkflowShortcutChoiceOption } from '../../components/workflow/WorkflowShortcutChoiceCards.vue'
import WorkflowStepForm from '../../components/workflow/WorkflowStepForm.vue'
import { useActivePopup } from '../../composables/useActivePopup'
import { forgetPendingAddSpace, takePendingAddSpace, useSlackWorkspace } from '../../composables/useSlackWorkspace'
import { ApiCallError } from '../../lib/api/client'
import { settingsFacade } from '../../lib/api/facade'
import type { NotificationRoute, NotificationRouteSpace, TenantChatSpace } from '../../lib/api/types'
import { editIconPath, plusIconPath } from '../../lib/iconPaths'
import { normalizeStringOrEmpty } from '../../lib/utils/strings'
import { usePermissionsStore } from '../../stores/permissions'

type NotificationsPopup =
  | { type: 'add'; startAt: 'where' | 'channel' }
  | { type: 'space-menu'; chatSpaceId: string }
  | { type: 'space-webhook'; chatSpaceId: string }
  | { type: 'slack-token' }

type SpaceMenuChoice = 'rename' | 'webhook' | 'activate' | 'deactivate' | 'delete'

const route = useRoute()
const router = useRouter()
const permissionsStore = usePermissionsStore()
const pageAbortController = new AbortController()
const slack = useSlackWorkspace(pageAbortController.signal)
const { connected, oauthAvailable, loadError: slackLoadError } = slack
const { activePopup, isPopupOpen, open: openPopup, close: closeActivePopup } = useActivePopup<NotificationsPopup>()

const loading = ref(true)
const loaded = ref(false)
const pageError = ref<string | null>(null)
const statusMessage = ref<string | null>(null)
const spaces = ref<NotificationRouteSpace[]>([])
const routes = ref<NotificationRoute[]>([])
/** The same spaces as list#TenantChatSpaces gives them: in use or not, and the webhook, for the space menu. */
const chatSpaces = ref<TenantChatSpace[]>([])
const savingKey = ref<string | null>(null)
const testingSpaceId = ref<string | null>(null)
const slackBusy = ref(false)
const popupError = ref<string | null>(null)
const popupSaving = ref(false)
const webhookInput = ref('')
const tokenInput = ref('')
/** Bumped to redraw the names when a rename is refused or left empty. */
const titleRedraw = ref(0)
/** Something changed inside the Add space flow, so the grid reloads when it closes. */
let addFlowChanged = false
const titleRefs = new Map<string, InstanceType<typeof StaticEditableTitle>>()

const canEdit = computed(() => permissionsStore.canEditTenantSettings)
const popupTitle = computed(() => (activePopup.value?.type === 'slack-token' ? 'Slack' : 'Notifications'))
const menuSpaceId = computed(() => (
  activePopup.value?.type === 'space-menu' || activePopup.value?.type === 'space-webhook' ? activePopup.value.chatSpaceId : null
))
const menuSpace = computed(() => spaces.value.find((space) => space.chatSpaceId === menuSpaceId.value) ?? null)
const menuFullSpace = computed(() => chatSpaces.value.find((space) => space.chatSpaceId === menuSpaceId.value) ?? null)
const spaceMenuOptions = computed<WorkflowShortcutChoiceOption[]>(() => {
  const space = menuSpace.value
  if (!space) return []
  const options: Array<{ value: SpaceMenuChoice; label: string }> = [{ value: 'rename', label: 'Rename' }]
  if (space.deliveryMode !== 'SLACK_BOT') options.push({ value: 'webhook', label: 'Replace webhook' })
  options.push(isOff(space) ? { value: 'activate', label: 'Activate space' } : { value: 'deactivate', label: 'Deactivate space' })
  // Unknown when the full list did not load: offered, and the service refuses a space still in use.
  if (!menuFullSpace.value?.inUse) options.push({ value: 'delete', label: 'Delete space' })
  return options.map((option, index) => ({ ...option, shortcutKey: String.fromCharCode(65 + index) }))
})

function isOff(space: NotificationRouteSpace): boolean {
  return space.isActive === 'N'
}

function productLine(space: NotificationRouteSpace): string {
  const product = space.chatProviderLabel || (space.chatProviderEnumId === 'CHAT_PROV_SLACK' ? 'Slack' : 'Google Chat')
  return isOff(space) ? `${product} · off` : product
}

function routeKey(candidate: NotificationRoute): string {
  return `${candidate.sourceType}-${candidate.sourceId ?? 'tenant'}`
}

function setTitleRef(chatSpaceId: string, component: unknown): void {
  if (component) titleRefs.set(chatSpaceId, component as InstanceType<typeof StaticEditableTitle>)
  else titleRefs.delete(chatSpaceId)
}

function describeError(error: unknown, fallback: string): string {
  return error instanceof ApiCallError ? error.message : fallback
}

function isAbort(error: unknown): boolean {
  return (error as { name?: string })?.name === 'AbortError'
}

async function loadAll(): Promise<void> {
  const [routesResult, spacesResult] = await Promise.allSettled([
    settingsFacade.getNotificationRoutes(pageAbortController.signal),
    settingsFacade.listTenantChatSpaces(pageAbortController.signal),
  ])
  if (routesResult.status === 'fulfilled') {
    spaces.value = routesResult.value.spaces ?? []
    routes.value = routesResult.value.routes ?? []
    loaded.value = true
  } else if (!isAbort(routesResult.reason)) {
    pageError.value = describeError(routesResult.reason, 'The notifications got lost in the mail.')
  }
  // Only the space menu needs this list; a failure leaves the grid whole.
  if (spacesResult.status === 'fulfilled') chatSpaces.value = spacesResult.value.chatSpaces ?? []
  loading.value = false
}

function applyRoute(saved: NotificationRoute): void {
  const key = routeKey(saved)
  routes.value = routes.value.map((candidate) => (routeKey(candidate) === key ? { ...candidate, ...saved } : candidate))
  addFlowChanged = true
}

async function setRoute(target: NotificationRoute, chatSpaceId: string | null): Promise<void> {
  if (!canEdit.value || savingKey.value !== null) return
  if ((target.chatSpaceId ?? null) === chatSpaceId) return
  savingKey.value = routeKey(target)
  pageError.value = null
  statusMessage.value = null
  try {
    const response = await settingsFacade.setNotificationRoute({
      sourceType: target.sourceType,
      ...(target.sourceId ? { sourceId: target.sourceId } : {}),
      chatSpaceId,
    }, pageAbortController.signal)
    applyRoute(response.route ?? { ...target, chatSpaceId })
    statusMessage.value = response.messages?.[0] ?? 'Saved.'
  } catch (error) {
    if (isAbort(error)) return
    pageError.value = describeError(error, `${target.label} did not move.`)
  } finally {
    savingKey.value = null
  }
}

/** Left and right walk a row's dots; Enter or Space picks one, as for any button. */
function moveFocus(event: KeyboardEvent, step: number): void {
  const current = event.currentTarget as HTMLElement | null
  const dots = Array.from(current?.closest('tr')?.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)') ?? [])
  const index = dots.findIndex((dot) => dot === current)
  dots[index + step]?.focus()
}

async function sendTest(space: NotificationRouteSpace): Promise<void> {
  if (testingSpaceId.value !== null) return
  testingSpaceId.value = space.chatSpaceId
  pageError.value = null
  statusMessage.value = null
  try {
    const response = await settingsFacade.sendChatSpaceTest({ chatSpaceId: space.chatSpaceId }, pageAbortController.signal)
    statusMessage.value = response.messages?.[0] ?? `Sent a test to ${space.spaceName}.`
  } catch (error) {
    if (isAbort(error)) return
    pageError.value = describeError(error, `The test to ${space.spaceName} did not go out.`)
  } finally {
    testingSpaceId.value = null
  }
}

async function saveSpace(space: NotificationRouteSpace, changes: { spaceName?: string; isActive?: boolean; webhookUrl?: string }): Promise<boolean> {
  try {
    const response = await settingsFacade.saveTenantChatSpace({
      chatSpaceId: space.chatSpaceId,
      spaceName: changes.spaceName ?? space.spaceName,
      isActive: changes.isActive ?? !isOff(space),
      ...(changes.webhookUrl ? { webhookUrl: changes.webhookUrl } : {}),
    }, pageAbortController.signal)
    statusMessage.value = response.messages?.[0] ?? 'Saved chat space.'
    await loadAll()
    return true
  } catch (error) {
    if (isAbort(error)) return false
    const message = describeError(error, 'The chat space did not take the hint. Not saved.')
    if (isPopupOpen.value) popupError.value = message
    else pageError.value = message
    return false
  }
}

async function renameSpace(space: NotificationRouteSpace, typed: string): Promise<void> {
  const spaceName = normalizeStringOrEmpty(typed)
  if (!spaceName || spaceName === space.spaceName || !canEdit.value) {
    titleRedraw.value += 1
    return
  }
  pageError.value = null
  statusMessage.value = null
  if (!(await saveSpace(space, { spaceName }))) titleRedraw.value += 1
}

function openAdd(startAt: 'where' | 'channel'): void {
  pageError.value = null
  statusMessage.value = null
  addFlowChanged = false
  openPopup({ type: 'add', startAt })
}

function onSpaceAdded(space: TenantChatSpace): void {
  chatSpaces.value = [...chatSpaces.value.filter((existing) => existing.chatSpaceId !== space.chatSpaceId), space]
  addFlowChanged = true
}

function openSpaceMenu(chatSpaceId: string): void {
  popupError.value = null
  statusMessage.value = null
  openPopup({ type: 'space-menu', chatSpaceId })
}

async function chooseSpaceMenu(value: string): Promise<void> {
  const space = menuSpace.value
  if (!space || popupSaving.value) return
  popupError.value = null
  if (value === 'rename') {
    closePopup()
    // A caret at the end of the column's name: Enter or clicking away saves, Esc keeps the old one.
    titleRefs.get(space.chatSpaceId)?.focus()
    return
  }
  if (value === 'webhook') {
    webhookInput.value = ''
    openPopup({ type: 'space-webhook', chatSpaceId: space.chatSpaceId })
    return
  }
  popupSaving.value = true
  if (value === 'activate' || value === 'deactivate') {
    if (await saveSpace(space, { isActive: value === 'activate' })) closePopup()
  } else if (value === 'delete') {
    try {
      const response = await settingsFacade.deleteTenantChatSpace({ chatSpaceId: space.chatSpaceId }, pageAbortController.signal)
      statusMessage.value = response.messages?.[0] ?? 'Deleted chat space.'
      closePopup()
      await loadAll()
    } catch (error) {
      if (!isAbort(error)) popupError.value = describeError(error, 'The chat space is still talking. Still here.')
    }
  }
  popupSaving.value = false
}

async function saveWebhook(): Promise<void> {
  const space = menuSpace.value
  const webhookUrl = normalizeStringOrEmpty(webhookInput.value)
  if (!space || !webhookUrl || popupSaving.value) return
  popupSaving.value = true
  popupError.value = null
  if (await saveSpace(space, { webhookUrl })) closePopup()
  popupSaving.value = false
}

function openSlackToken(): void {
  popupError.value = null
  statusMessage.value = null
  tokenInput.value = ''
  openPopup({ type: 'slack-token' })
}

async function saveSlackToken(): Promise<void> {
  if (popupSaving.value) return
  popupSaving.value = true
  popupError.value = null
  const result = await slack.saveToken(tokenInput.value)
  popupSaving.value = false
  if (!result.ok) {
    popupError.value = result.message
    return
  }
  tokenInput.value = ''
  statusMessage.value = result.message
  closePopup()
}

async function reconnectSlack(): Promise<void> {
  slackBusy.value = true
  pageError.value = null
  const result = await slack.beginOauth()
  if (!result.ok) {
    pageError.value = result.message
    slackBusy.value = false
  }
}

async function disconnectSlack(): Promise<void> {
  slackBusy.value = true
  pageError.value = null
  statusMessage.value = null
  const result = await slack.disconnect()
  slackBusy.value = false
  if (result.ok) statusMessage.value = result.message
  else pageError.value = result.message
}

function closePopup(): void {
  const wasAdd = activePopup.value?.type === 'add'
  closeActivePopup()
  popupError.value = null
  popupSaving.value = false
  if (wasAdd && addFlowChanged) {
    addFlowChanged = false
    void loadAll()
  }
}

function describeSlackReturnError(reason: string): string {
  switch (reason) {
    case 'declined': return 'The Slack authorisation was cancelled, so nothing was connected.'
    case 'expired': return 'That Slack connection attempt timed out. Start it again.'
    case 'already_used': return 'That Slack connection link had already been used. Start again.'
    case 'not_configured': return 'Slack is not configured on this deployment yet.'
    case 'store_failed': return 'Slack authorised the connection but Darpan could not save it. Try again.'
    default: return 'Slack could not be connected. Try again.'
  }
}

/**
 * The Slack callback returns the browser here (through /settings) with its result in the query: the only channel
 * left, since the admin left the app to authorise. An Add space flow that left for it resumes at its channel card.
 * The params are stripped so a refresh does not replay it.
 */
function consumeSlackReturn(): void {
  const outcome = normalizeStringOrEmpty(route.query.slack as string | undefined)
  if (!outcome) return
  if (outcome === 'connected') {
    const team = normalizeStringOrEmpty(route.query.team as string | undefined)
    if (takePendingAddSpace()) {
      openAdd('channel')
    } else {
      statusMessage.value = team ? `Connected to ${team}. Add a space to pick its channel.` : 'Connected to Slack. Add a space to pick its channel.'
    }
  } else {
    forgetPendingAddSpace()
    pageError.value = describeSlackReturnError(normalizeStringOrEmpty(route.query.reason as string | undefined))
  }
  const query = { ...route.query }
  delete query.slack
  delete query.team
  delete query.reason
  void router.replace({ query })
}

onMounted(() => {
  consumeSlackReturn()
  void loadAll()
  void slack.load()
})

onBeforeUnmount(() => {
  pageAbortController.abort()
})
</script>

<style scoped>
/* The grid: a row per thing that posts, a column per space and one for Nowhere, one dot checked per row. Built on
   the shared table; every mark is the text colour. */
.notifications-grid-shell {
  background: var(--static-tile-bg);
}

.notifications-grid {
  min-width: 0;
  table-layout: auto;
}

.notifications-grid th {
  text-transform: none;
  letter-spacing: normal;
}

.notifications-grid thead th {
  padding: var(--space-2) var(--space-2);
  vertical-align: bottom;
}

.notifications-grid__source-head,
.notifications-grid__source {
  position: sticky;
  left: 0;
  z-index: 1;
  min-width: 11rem;
  background: var(--static-tile-bg);
}

.notifications-grid__source-head {
  background: color-mix(in oklab, var(--surface-2) 94%, white);
}

.notifications-grid__source {
  padding: var(--space-2) var(--space-3);
  color: var(--text);
  font-size: var(--static-tile-text-size);
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid var(--border-soft);
}

.notifications-grid__source-name {
  display: block;
  overflow-wrap: anywhere;
}

.notifications-grid__when {
  display: block;
  color: var(--text-dim);
  font-size: var(--type-note-size);
}

.notifications-grid__space-head,
.notifications-grid__nowhere-head,
.notifications-grid__cell {
  text-align: center;
}

.notifications-grid__space {
  display: grid;
  gap: var(--space-0);
  justify-items: center;
  min-width: 8rem;
}

.notifications-grid__space-name {
  color: var(--text);
  font-size: var(--type-label-size);
  overflow-wrap: anywhere;
}

.notifications-grid__product {
  font-size: var(--type-note-size);
}

.notifications-grid__space-head--off .notifications-grid__space-name,
.notifications-grid__space-head--off .notifications-grid__product {
  color: var(--text-dim);
}

.notifications-grid__space-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-1);
  margin-top: var(--space-1);
}

.notifications-grid__space-actions button:not(.app-icon-action) {
  min-height: 2rem;
  padding: var(--space-0) var(--space-1-5);
  font-size: var(--type-label-size);
  white-space: nowrap;
}

.notifications-grid td.notifications-grid__cell {
  padding: var(--space-2);
  vertical-align: middle;
}

.notifications-grid__dot {
  display: inline-grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  min-height: 2.2rem;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
}

.notifications-grid__mark {
  width: 1rem;
  height: 1rem;
  border: 1px solid var(--text-muted);
  border-radius: var(--radius-pill);
}

.notifications-grid__dot[aria-checked='true'] .notifications-grid__mark {
  border-color: var(--text);
  background: var(--text);
}

.notifications-grid__dot:hover:not(:disabled) .notifications-grid__mark {
  border-color: var(--text);
}

.notifications-grid__dot:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--text-soft) 18%, transparent);
}

.notifications-grid__dot:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

/* The Slack line: label | value | actions, as Tenant Settings' rows read. */
.notifications-rows {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--static-tile-border);
  border-radius: var(--static-surface-radius);
  background: var(--static-tile-bg);
}

.notifications-row {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.5rem;
  padding: var(--space-1) var(--space-3);
  font-size: var(--static-tile-text-size);
}

.notifications-row__name,
.notifications-row__value {
  min-width: 0;
  overflow-wrap: anywhere;
}

.notifications-row__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-1);
}

.notifications-row__actions button {
  min-height: 2.2rem;
  padding: var(--space-0) var(--space-2);
  font-size: var(--type-label-size);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .notifications-row {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
  }

  .notifications-row__actions {
    justify-content: flex-start;
  }

  .notifications-grid__source-head,
  .notifications-grid__source {
    min-width: 8rem;
  }
}
</style>
