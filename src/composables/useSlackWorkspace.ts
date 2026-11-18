import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ApiCallError } from '../lib/api/client'
import { settingsFacade } from '../lib/api/facade'
import { cachedRead } from '../lib/api/readCache'
import type { SlackChannel, SlackWorkspaceInstall } from '../lib/api/types'
import { normalizeStringOrEmpty } from '../lib/utils/strings'

/**
 * DAR-UI-123. The tenant's Slack workspace: whether one is connected, its channels, and connecting, re-pasting or
 * disconnecting it. Shared by the Notifications page (its Slack line) and the Add space flow (its channel card).
 */
export interface SlackActionResult {
  ok: boolean
  message: string
}

export interface UseSlackWorkspace {
  installs: Ref<SlackWorkspaceInstall[]>
  connected: ComputedRef<SlackWorkspaceInstall | null>
  oauthAvailable: Ref<boolean>
  loading: Ref<boolean>
  loadError: Ref<string | null>
  channels: Ref<SlackChannel[]>
  channelsLoading: Ref<boolean>
  channelsError: Ref<string | null>
  load: () => Promise<void>
  loadChannels: () => Promise<void>
  beginOauth: () => Promise<SlackActionResult>
  saveToken: (token: string) => Promise<SlackActionResult>
  disconnect: () => Promise<SlackActionResult>
}

export function useSlackWorkspace(signal?: AbortSignal): UseSlackWorkspace {
  const installs = ref<SlackWorkspaceInstall[]>([])
  const oauthAvailable = ref(false)
  const loading = ref(false)
  const loadError = ref<string | null>(null)
  const channels = ref<SlackChannel[]>([])
  const channelsLoading = ref(false)
  const channelsError = ref<string | null>(null)
  const connected = computed<SlackWorkspaceInstall | null>(() => installs.value[0] ?? null)

  async function load(): Promise<void> {
    loading.value = true
    try {
      await cachedRead(
        'notifications.slackInstall',
        () => settingsFacade.getSlackInstall(signal),
        (response) => {
          installs.value = response.installs ?? []
          oauthAvailable.value = response.oauthAvailable ?? false
          loadError.value = null
        },
      )
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return
      // Not silent: an empty install list reads exactly like "no workspace connected" and sends the admin to
      // connect one that is still there.
      installs.value = []
      oauthAvailable.value = false
      loadError.value = error instanceof ApiCallError ? error.message : 'The Slack connection would not pick up.'
    } finally {
      loading.value = false
    }
  }

  /** Fetched when a channel card opens, not on load: conversations.list is rate-limit Tier 2. */
  async function loadChannels(): Promise<void> {
    const install = connected.value
    if (!install || channelsLoading.value) return
    channelsLoading.value = true
    channelsError.value = null
    try {
      const response = await settingsFacade.listSlackChannels({ slackInstallId: install.slackInstallId }, signal)
      channels.value = response.channels ?? []
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return
      channels.value = []
      channelsError.value = error instanceof ApiCallError ? error.message : 'The Slack channels are slacking off.'
    } finally {
      channelsLoading.value = false
    }
  }

  async function beginOauth(): Promise<SlackActionResult> {
    try {
      const response = await settingsFacade.beginSlackInstall(signal)
      if (!response.authorizeUrl) return { ok: false, message: response.errors?.[0] ?? 'Slack left us on read. Not connected.' }
      // A full-page navigation: Slack's consent screen refuses to render in a frame, and its callback brings the
      // browser back to this app.
      window.location.assign(response.authorizeUrl)
      return { ok: true, message: '' }
    } catch (error) {
      return { ok: false, message: error instanceof ApiCallError ? error.message : 'Slack left us on read. Not connected.' }
    }
  }

  async function saveToken(token: string): Promise<SlackActionResult> {
    const botAccessToken = normalizeStringOrEmpty(token)
    if (!botAccessToken) return { ok: false, message: 'Paste the bot token.' }
    try {
      const response = await settingsFacade.saveSlackBotToken({ botAccessToken }, signal)
      if (!response.ok) return { ok: false, message: response.errors?.[0] ?? 'Slack rejected that token.' }
      channels.value = []
      await load()
      // Both lines: the second names a missing scope, and a partly scoped token still connects.
      return { ok: true, message: (response.messages ?? []).join(' ') || 'Connected to Slack.' }
    } catch (error) {
      return { ok: false, message: error instanceof ApiCallError ? error.message : 'The Slack token slipped through the cracks. Not saved.' }
    }
  }

  async function disconnect(): Promise<SlackActionResult> {
    const install = connected.value
    if (!install) return { ok: false, message: 'No Slack workspace is connected.' }
    try {
      const response = await settingsFacade.disconnectSlackWorkspace({ slackInstallId: install.slackInstallId }, signal)
      if (!response.ok) return { ok: false, message: response.errors?.[0] ?? 'Slack does not want to break up. Still connected.' }
      channels.value = []
      await load()
      return { ok: true, message: response.messages?.[0] ?? 'Disconnected Slack.' }
    } catch (error) {
      return { ok: false, message: error instanceof ApiCallError ? error.message : 'Slack does not want to break up. Still connected.' }
    }
  }

  return {
    installs,
    connected,
    oauthAvailable,
    loading,
    loadError,
    channels,
    channelsLoading,
    channelsError,
    load,
    loadChannels,
    beginOauth,
    saveToken,
    disconnect,
  }
}

/**
 * An Add space flow left for Slack's consent screen. Kept in this tab's session storage, so the callback landing on
 * the Notifications page can reopen the flow at its channel card. Half an hour is longer than any real consent.
 */
const PENDING_ADD_SPACE_KEY = 'darpan.notifications.pendingAddSpace'
const PENDING_ADD_SPACE_MAX_AGE_MS = 30 * 60 * 1000

export function rememberPendingAddSpace(now = Date.now()): void {
  try {
    window.sessionStorage.setItem(PENDING_ADD_SPACE_KEY, String(now))
  } catch {
    // Storage blocked: the callback still connects; the admin reopens Add space by hand.
  }
}

export function forgetPendingAddSpace(): void {
  try {
    window.sessionStorage.removeItem(PENDING_ADD_SPACE_KEY)
  } catch {
    // Nothing to forget.
  }
}

/** True once, when a flow is waiting to resume; the record is cleared either way. */
export function takePendingAddSpace(now = Date.now()): boolean {
  let savedAt = Number.NaN
  try {
    savedAt = Number(window.sessionStorage.getItem(PENDING_ADD_SPACE_KEY))
  } catch {
    return false
  }
  forgetPendingAddSpace()
  return Number.isFinite(savedAt) && savedAt > 0 && now - savedAt <= PENDING_ADD_SPACE_MAX_AGE_MS
}
