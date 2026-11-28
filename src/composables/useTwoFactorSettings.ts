// DAR-BE-264, DAR-BE-270, DAR-OPS-029 U09. The User Settings page's two-factor state: the status (the cards and their
// actions wait for it), the authenticator app, passkeys (list, rename in place, Manage popup), the popup action in
// progress, and the line said after a change. Each action asks for its own proof in TwoFactorSettingsPopup.
import { computed, ref } from 'vue'
import type {
  TwoFactorSettingsAction,
  TwoFactorSettingsChange,
} from '../components/settings/TwoFactorSettingsPopup.vue'
import { ApiCallError } from '../lib/api/client'
import { authFacade } from '../lib/api/facade'
import type { GetTwoFactorStatusResponse, TwoFactorPasskey } from '../lib/api/types'
import { passkeysSupported } from '../lib/passkeys'
import { formatShortDate } from '../lib/utils/date'
import { useAuthStore } from '../stores/auth'

/** The backend's cap on passkeys per person. */
const MAX_PASSKEYS = 10

const CHANGE_TEXT: Record<TwoFactorSettingsChange, string> = {
  on: 'Two-factor on. Other sessions and CLI sign-ins ended.',
  codes: 'New recovery codes made. The old ones stopped working.',
  off: 'Two-factor off. Other sessions and CLI sign-ins ended.',
  'app-on': 'Authenticator app on. Other sessions and CLI sign-ins ended.',
  'app-off': 'Authenticator app removed.',
  'passkey-added': 'Passkey added.',
  'passkey-removed': 'Passkey removed.',
}

export interface TwoFactorSettingsOptions {
  signal: AbortSignal
  /** Turning two-factor on or off ended the other sessions and CLI sign-ins: the CLI list is read again. */
  onSessionsEnded: () => void
}

export function useTwoFactorSettings(options: TwoFactorSettingsOptions) {
  const { signal } = options
  const authStore = useAuthStore()

  const twoFactorStatus = ref<GetTwoFactorStatusResponse | null>(null)
  const twoFactorLoadError = ref<string | null>(null)
  const twoFactorAction = ref<TwoFactorSettingsAction | null>(null)
  const twoFactorMessage = ref<string | null>(null)
  const removingPasskey = ref<TwoFactorPasskey | null>(null)
  const passkeyError = ref<string | null>(null)
  // Bumped to redraw the names when a rename is refused or left empty (the field shows what was typed until then).
  const passkeyNameRevision = ref(0)
  const isManagePasskeysOpen = ref(false)

  const twoFactorOn = computed(() => twoFactorStatus.value?.enabled === true)
  const appOn = computed(() => twoFactorStatus.value?.appEnabled === true)
  const passkeys = computed<TwoFactorPasskey[]>(() => twoFactorStatus.value?.passkeys ?? [])
  const hasPasskeys = computed(() => passkeys.value.length > 0)
  const passkeysShown = computed(() => twoFactorStatus.value?.passkeysAvailable === true || hasPasskeys.value)
  // This browser must be able to make one, and the person must be under the cap.
  const canAddPasskey = computed(() => twoFactorStatus.value?.passkeysAvailable === true && passkeysSupported()
    && passkeys.value.length < MAX_PASSKEYS)
  const twoFactorSummary = computed(() => {
    if (appOn.value) {
      // confirmedDate is when two-factor first went on: the app's own date only while it is the only factor.
      const since = hasPasskeys.value ? '' : formatShortDate(twoFactorStatus.value?.confirmedDate)
      return since ? `On since ${since}` : 'On'
    }
    if (twoFactorOn.value) return 'Off'
    const due = formatShortDate(twoFactorStatus.value?.requiredFromDate)
    if (twoFactorStatus.value?.required) return 'Off. Required now'
    return due ? `Off. Due ${due}` : 'Off'
  })
  const recoveryCodesLeftLabel = computed(() => `${twoFactorStatus.value?.recoveryCodesLeft ?? 0} left`)

  async function loadTwoFactorStatus(): Promise<void> {
    try {
      const response = await authFacade.getTwoFactorStatus(signal)
      if (signal.aborted) return
      twoFactorStatus.value = response
      twoFactorLoadError.value = null
    } catch {
      if (signal.aborted) return
      twoFactorStatus.value = null
      twoFactorLoadError.value = 'Could not load two-factor.'
    }
  }

  function openTwoFactor(action: TwoFactorSettingsAction): void {
    twoFactorMessage.value = null
    passkeyError.value = null
    removingPasskey.value = null
    twoFactorAction.value = action
  }

  function openManagePasskeys(): void {
    passkeyError.value = null
    twoFactorMessage.value = null
    isManagePasskeysOpen.value = true
  }

  function closeManagePasskeys(): void {
    isManagePasskeysOpen.value = false
  }

  // Remove keeps its own proof step: Manage closes and the remove popup takes over.
  function removeFromManage(passkey: TwoFactorPasskey): void {
    closeManagePasskeys()
    openTwoFactor('remove-passkey')
    removingPasskey.value = passkey
  }

  // rename#Passkey: no proof (a label weakens nothing). Enter or leaving the field saves.
  async function renamePasskey(passkey: TwoFactorPasskey, typed: string): Promise<void> {
    const name = typed.trim()
    if (name === (passkey.name ?? '')) return
    if (!name) {
      passkeyNameRevision.value += 1
      return
    }
    passkeyError.value = null
    twoFactorMessage.value = null
    try {
      await authFacade.renamePasskey({ passkeyId: passkey.passkeyId, name }, signal)
      passkey.name = name
    } catch (err) {
      if (signal.aborted) return
      passkeyError.value = err instanceof ApiCallError ? err.message : 'Not renamed.'
      passkeyNameRevision.value += 1
    }
  }

  async function handleTwoFactorChanged(change: TwoFactorSettingsChange): Promise<void> {
    twoFactorMessage.value = CHANGE_TEXT[change]
    await loadTwoFactorStatus()
    // Turning it on swapped this tab's key and session already (confirm#TwoFactorSetup). Turning it off reissues
    // nothing, so the session's flag and due date are set from the fresh status.
    if (change === 'off') {
      authStore.applyTwoFactorState({ enabled: false, dueDate: twoFactorStatus.value?.requiredFromDate ?? null })
    }
    if (change === 'on' || change === 'app-on' || change === 'off') options.onSessionsEnded()
  }

  return {
    twoFactorStatus, twoFactorLoadError, twoFactorAction, twoFactorMessage, removingPasskey, passkeyError,
    passkeyNameRevision, isManagePasskeysOpen, twoFactorOn, appOn, passkeys, hasPasskeys, passkeysShown, canAddPasskey,
    twoFactorSummary, recoveryCodesLeftLabel, loadTwoFactorStatus, openTwoFactor, openManagePasskeys,
    closeManagePasskeys, removeFromManage, renamePasskey, handleTwoFactorChanged,
  }
}
