import { describe, expect, it } from 'vitest'
import { useActivePopup } from '../useActivePopup'

describe('useActivePopup', () => {
  it('opens and closes a typed popup', () => {
    const popup = useActivePopup<{ type: 'a' } | { type: 'b'; mode: 'edit' }>()
    expect(popup.isPopupOpen.value).toBe(false)
    popup.open({ type: 'b', mode: 'edit' })
    expect(popup.isPopupOpen.value).toBe(true)
    popup.close()
    expect(popup.activePopup.value).toBeNull()
  })
})
