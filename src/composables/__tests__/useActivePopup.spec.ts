import { describe, expect, it } from 'vitest'
import { useActivePopup, useTenantSettingsPopup } from '../useActivePopup'

describe('useActivePopup', () => {
  it('opens and closes a typed popup', () => {
    const popup = useActivePopup<{ type: 'a' } | { type: 'b'; mode: 'edit' }>()
    expect(popup.isPopupOpen.value).toBe(false)
    popup.open({ type: 'b', mode: 'edit' })
    expect(popup.isPopupOpen.value).toBe(true)
    expect(popup.is('b')).toBe(true)
    expect(popup.is('a')).toBe(false)
    popup.close()
    expect(popup.activePopup.value).toBeNull()
  })
})

describe('useTenantSettingsPopup', () => {
  it('exposes one open helper per popup variant', () => {
    const popup = useTenantSettingsPopup()
    popup.openTimezone()
    expect(popup.activePopup.value).toEqual({ type: 'timezone' })

    popup.openNotificationMenu()
    expect(popup.activePopup.value).toEqual({ type: 'notification-menu' })

    popup.openChatSpaceMenu('CS1')
    expect(popup.activePopup.value).toEqual({ type: 'chat-space-menu', chatSpaceId: 'CS1' })

    popup.openChatSpaceCreate()
    expect(popup.activePopup.value).toEqual({ type: 'chat-space-form', mode: 'create' })
    expect(popup.isChatSpaceEditing.value).toBe(false)

    popup.openChatSpaceEdit('CS1')
    expect(popup.activePopup.value).toEqual({ type: 'chat-space-form', mode: 'edit', chatSpaceId: 'CS1' })
    expect(popup.isChatSpaceEditing.value).toBe(true)

    popup.openAiMenu()
    expect(popup.activePopup.value).toEqual({ type: 'ai-menu' })

    popup.openAiCreate()
    expect(popup.activePopup.value).toEqual({ type: 'ai', mode: 'create' })
    expect(popup.isAiEditing.value).toBe(false)

    popup.openAiEdit()
    expect(popup.activePopup.value).toEqual({ type: 'ai', mode: 'edit' })
    expect(popup.isAiEditing.value).toBe(true)

    popup.close()
    expect(popup.isPopupOpen.value).toBe(false)
  })
})
