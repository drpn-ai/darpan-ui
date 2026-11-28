import { onBeforeUnmount, onMounted } from 'vue'
import { isEnterOutsideForm, isTypingTarget, matchChoiceShortcut, type ChoiceShortcut } from '../lib/keyboard'

export interface ChoiceShortcutOptions<T> {
  /** Whether the choice step is showing now. */
  active: () => boolean
  /** The cards on screen, each with the letter its badge draws. */
  choices: () => ReadonlyArray<ChoiceShortcut<T>>
  choose: (value: T) => void
  /** Enter with focus outside any form (a letter leaves focus on the page): the step's own action, as its hint says. */
  onEnterOutsideForm?: () => void
  /** Shift+letter is not a choice, on pages where Shift has a meaning of its own. */
  blockShift?: boolean
}

/**
 * DAR-OPS-029 S99-102. The letter keys of a choice-card step (WorkflowShortcutChoiceCards draws the badges; each page wires
 * the keys here). Listens on window while mounted; skipped while typing, so the command palette keeps its letters.
 */
export function useChoiceShortcuts<T>(options: ChoiceShortcutOptions<T>): void {
  function onKeydown(event: KeyboardEvent): void {
    if (!options.active() || event.defaultPrevented || event.isComposing) return
    if (isTypingTarget(event.target)) return
    if (options.onEnterOutsideForm && isEnterOutsideForm(event)) {
      event.preventDefault()
      options.onEnterOutsideForm()
      return
    }
    const value = matchChoiceShortcut(event, options.choices(), { blockShift: options.blockShift })
    if (value === null) return
    event.preventDefault()
    options.choose(value)
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
