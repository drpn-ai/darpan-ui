import { computed, ref, type ComputedRef, type Ref } from 'vue'

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
