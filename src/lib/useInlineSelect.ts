import {
  computed,
  nextTick,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  ref,
  type ComponentPublicInstance,
} from 'vue'
import { DISMISS_INLINE_MENUS_EVENT, INLINE_MENU_OPEN_EVENT } from './uiEvents'

export interface InlineSelectOption {
  value: string
  label: string
  /** Listed but not choosable: rendered aria-disabled, and neither click nor keyboard selects it. */
  disabled?: boolean
}

interface UseInlineSelectOptions<Option extends InlineSelectOption> {
  idPrefix: string
  options: () => Option[]
  modelValue: () => string
  disabled: () => boolean
  emitValue: (value: string) => void
}

export function useInlineSelect<Option extends InlineSelectOption>({
  idPrefix,
  options,
  modelValue,
  disabled,
  emitValue,
}: UseInlineSelectOptions<Option>) {
  const root = ref<HTMLElement | null>(null)
  const trigger = ref<HTMLElement | null>(null)
  const optionRefs = ref<HTMLButtonElement[]>([])
  const isOpen = ref(false)
  const listboxId = `${idPrefix}-${Math.random().toString(36).slice(2, 10)}`

  const selectedLabel = computed(() => options().find((option) => option.value === modelValue())?.label ?? '')
  const isEmpty = computed(() => modelValue().length === 0)
  const hasSelection = computed(() => options().some((option) => option.value === modelValue()))

  onBeforeUpdate(() => {
    optionRefs.value = []
  })

  function setOptionRef(element: Element | ComponentPublicInstance | null): void {
    if (element instanceof HTMLButtonElement) {
      optionRefs.value.push(element)
    }
  }

  function closeMenu(): void {
    isOpen.value = false
  }

  function openMenu(): void {
    if (isOpen.value) return
    document.dispatchEvent(new CustomEvent<string>(INLINE_MENU_OPEN_EVENT, { detail: listboxId }))
    isOpen.value = true
  }

  function toggleMenu(): void {
    if (disabled() || options().length === 0) return
    if (isOpen.value) {
      closeMenu()
      return
    }
    openMenu()
  }

  function focusOption(index: number): void {
    optionRefs.value[index]?.focus()
  }

  function focusRelative(currentIndex: number, delta: number): void {
    const optionCount = options().length
    if (optionCount === 0) return
    const nextIndex = (currentIndex + delta + optionCount) % optionCount
    focusOption(nextIndex)
  }

  async function openMenuAndFocus(target: 'selected' | 'last'): Promise<void> {
    const currentOptions = options()
    if (disabled() || currentOptions.length === 0) return

    openMenu()
    await nextTick()

    if (target === 'last') {
      focusOption(currentOptions.length - 1)
      return
    }

    const selectedIndex = currentOptions.findIndex((option) => option.value === modelValue())
    focusOption(selectedIndex >= 0 ? selectedIndex : 0)
  }

  function isDisabledOption(value: string): boolean {
    return options().find((option) => option.value === value)?.disabled === true
  }

  async function selectOption(value: string): Promise<void> {
    if (isDisabledOption(value)) return
    emitValue(value)
    closeMenu()
    await nextTick()
    trigger.value?.focus()
  }

  async function selectOptionAndSubmit(value: string): Promise<void> {
    if (isDisabledOption(value)) return
    emitValue(value)
    closeMenu()
    await nextTick()

    if (submitClosestForm()) return

    trigger.value?.focus()
  }

  function submitClosestForm(): boolean {
    const form = root.value?.closest('form')
    if (!(form instanceof HTMLFormElement)) return false

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit()
      return true
    }

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    return true
  }

  function closeAndFocusTrigger(): void {
    closeMenu()
    trigger.value?.focus()
  }

  function handleDocumentPointerDown(event: MouseEvent): void {
    const target = event.target
    if (!(target instanceof Node)) return
    if (root.value?.contains(target)) return
    closeMenu()
  }

  function handlePeerOpen(event: Event): void {
    const openEvent = event as CustomEvent<string>
    if (openEvent.detail === listboxId) return
    closeMenu()
  }

  function handleDismissInlineMenus(): void {
    closeMenu()
  }

  onMounted(() => {
    document.addEventListener('mousedown', handleDocumentPointerDown)
    document.addEventListener(INLINE_MENU_OPEN_EVENT, handlePeerOpen)
    document.addEventListener(DISMISS_INLINE_MENUS_EVENT, handleDismissInlineMenus)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('mousedown', handleDocumentPointerDown)
    document.removeEventListener(INLINE_MENU_OPEN_EVENT, handlePeerOpen)
    document.removeEventListener(DISMISS_INLINE_MENUS_EVENT, handleDismissInlineMenus)
  })

  return {
    root,
    trigger,
    isOpen,
    listboxId,
    selectedLabel,
    isEmpty,
    hasSelection,
    setOptionRef,
    closeMenu,
    toggleMenu,
    focusOption,
    focusRelative,
    openMenuAndFocus,
    selectOption,
    selectOptionAndSubmit,
    submitClosestForm,
    closeAndFocusTrigger,
  }
}
