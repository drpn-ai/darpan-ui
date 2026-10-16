import { nextTick, onBeforeUnmount, ref, watch, type CSSProperties, type Ref } from 'vue'

/** The gap between a trigger and its menu (0.45rem), and the least room a menu is opened into before it flips. */
const GAP_PX = 7
const EDGE_PX = 8
const MIN_ROOM_PX = 160

/**
 * A dropdown menu that stays on screen: it opens below its trigger and ends no lower than the mascot's bottom edge
 * (the screen's, less a margin, when there is no mascot), scrolling inside itself when that is too short. With more
 * room above than below and too little below for it, it opens above instead.
 */
export function useScreenAwareMenu(
  trigger: Ref<HTMLElement | null>,
  menu: Ref<HTMLElement | null>,
  isOpen: Ref<boolean>,
): { menuStyle: Ref<CSSProperties>; place: () => void } {
  const menuStyle = ref<CSSProperties>({})

  function place() {
    const t = trigger.value?.getBoundingClientRect()
    if (!t) return
    const mascot = document.querySelector('.mascot-dock')?.getBoundingClientRect()
    const floor = Math.min(window.innerHeight - EDGE_PX, mascot && mascot.height > 0 ? mascot.bottom : window.innerHeight - EDGE_PX)
    const below = Math.floor(floor - t.bottom - GAP_PX)
    const above = Math.floor(t.top - GAP_PX - EDGE_PX)
    const wanted = menu.value?.scrollHeight ?? 0
    if (below < Math.min(wanted, MIN_ROOM_PX) && above > below) {
      menuStyle.value = { top: 'auto', bottom: `calc(100% + ${GAP_PX}px)`, maxHeight: `${above}px` }
    } else {
      menuStyle.value = { maxHeight: `${Math.max(below, 0)}px` }
    }
  }

  const onViewportChange = () => { if (isOpen.value) place() }
  function listen(on: boolean) {
    const method = on ? 'addEventListener' : 'removeEventListener'
    window[method]('resize', onViewportChange)
    window[method]('scroll', onViewportChange, true)
  }

  watch(isOpen, async (open) => {
    listen(open)
    if (!open) { menuStyle.value = {}; return }
    await nextTick()
    place()
  })
  onBeforeUnmount(() => listen(false))

  return { menuStyle, place }
}
