import { computed, ref, type ComputedRef, type Ref } from 'vue'

export type TenantSettingsAiWorkflowMode = 'create' | 'edit'
export type TenantSettingsChatSpaceFormMode = 'create' | 'edit'

export type TenantSettingsActivePopup =
  | { type: 'timezone' }
  | { type: 'notification-menu' }
  | { type: 'chat-space-menu'; chatSpaceId: string }
  | { type: 'slack-menu' }
  | { type: 'slack-token' }
  | { type: 'chat-space-form'; mode: TenantSettingsChatSpaceFormMode; chatSpaceId?: string }
  | { type: 'ai-menu' }
  | { type: 'ai'; mode: TenantSettingsAiWorkflowMode }

export interface UseActivePopup<TPopup> {
  activePopup: Ref<TPopup | null>
  isPopupOpen: ComputedRef<boolean>
  open: (popup: TPopup) => void
  close: () => void
}

export function useActivePopup<TPopup extends { type: string }>(): UseActivePopup<TPopup> {
  const activePopup = ref(null) as Ref<TPopup | null>
  const isPopupOpen = computed(() => activePopup.value !== null)

  function open(popup: TPopup): void {
    activePopup.value = popup
  }

  function close(): void {
    activePopup.value = null
  }

  return { activePopup, isPopupOpen, open, close }
}

export interface TenantSettingsPopupActions {
  activePopup: Ref<TenantSettingsActivePopup | null>
  isPopupOpen: ComputedRef<boolean>
  isAiEditing: ComputedRef<boolean>
  isChatSpaceEditing: ComputedRef<boolean>
  openTimezone: () => void
  openNotificationMenu: () => void
  openChatSpaceMenu: (chatSpaceId: string) => void
  openSlackMenu: () => void
  openSlackTokenForm: () => void
  openChatSpaceCreate: () => void
  openChatSpaceEdit: (chatSpaceId: string) => void
  openAiMenu: () => void
  openAiCreate: () => void
  openAiEdit: () => void
  close: () => void
}

export function useTenantSettingsPopup(): TenantSettingsPopupActions {
  const { activePopup, isPopupOpen, open, close } = useActivePopup<TenantSettingsActivePopup>()
  const isAiEditing = computed(
    () => activePopup.value?.type === 'ai' && activePopup.value.mode === 'edit',
  )
  const isChatSpaceEditing = computed(
    () => activePopup.value?.type === 'chat-space-form' && activePopup.value.mode === 'edit',
  )

  return {
    activePopup,
    isPopupOpen,
    isAiEditing,
    isChatSpaceEditing,
    openTimezone: () => open({ type: 'timezone' }),
    openNotificationMenu: () => open({ type: 'notification-menu' }),
    openChatSpaceMenu: (chatSpaceId: string) => open({ type: 'chat-space-menu', chatSpaceId }),
    openSlackMenu: () => open({ type: 'slack-menu' }),
    openSlackTokenForm: () => open({ type: 'slack-token' }),
    openChatSpaceCreate: () => open({ type: 'chat-space-form', mode: 'create' }),
    openChatSpaceEdit: (chatSpaceId: string) => open({ type: 'chat-space-form', mode: 'edit', chatSpaceId }),
    openAiMenu: () => open({ type: 'ai-menu' }),
    openAiCreate: () => open({ type: 'ai', mode: 'create' }),
    openAiEdit: () => open({ type: 'ai', mode: 'edit' }),
    close,
  }
}
