export interface EnterSubmitOptions {
  allowSelect?: boolean
  allowFile?: boolean
  allowCheckbox?: boolean
  disabled?: boolean
}

export interface WorkflowEscapeOptions {
  workflowActive?: boolean
}

function isSupportedHtmlTarget(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement
}

export function shouldTriggerPrimaryEnterAction(
  event: KeyboardEvent,
  { allowSelect = false, allowFile = false, allowCheckbox = false, disabled = false }: EnterSubmitOptions = {},
): boolean {
  if (disabled || event.defaultPrevented || event.repeat || event.isComposing) return false
  if (event.key.toLowerCase() !== 'enter') return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false

  if (!isSupportedHtmlTarget(event.target)) return true

  const target = event.target
  if (target.isContentEditable || target.closest('[data-enter-submit="off"]')) return false
  if (target instanceof HTMLTextAreaElement) return false
  if (target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement) return false
  if (target instanceof HTMLSelectElement) return allowSelect

  if (target instanceof HTMLInputElement) {
    const blockedTypes = new Set(['button', 'checkbox', 'radio', 'reset', 'submit'])
    if (target.type === 'file') return allowFile
    if (target.type === 'checkbox') return allowCheckbox
    return !blockedTypes.has(target.type)
  }

  return true
}

export function requestSubmitOnEnter(event: KeyboardEvent, options: EnterSubmitOptions = {}): void {
  if (!shouldTriggerPrimaryEnterAction(event, options)) return

  const form = event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null
  if (!form) return

  event.preventDefault()
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit()
    return
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

export function invokePrimaryActionOnEnter(
  event: KeyboardEvent,
  action: () => void | Promise<void>,
  options: EnterSubmitOptions = {},
): void {
  if (!shouldTriggerPrimaryEnterAction(event, options)) return

  event.preventDefault()
  void action()
}

export function shouldAbortWorkflowOnEscape(
  event: KeyboardEvent,
  { workflowActive = false }: WorkflowEscapeOptions = {},
): boolean {
  if (!workflowActive || event.defaultPrevented || event.repeat || event.isComposing) return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false

  return event.key.toLowerCase() === 'escape'
}

/**
 * DAR-OPS-029 S99-102. True while the user is typing (an input, text area, select or editable content), where a letter
 * key is a letter: the command palette's search keeps its letters.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

export interface ChoiceShortcut<T> {
  shortcutKey: string
  value: T
}

/**
 * The choice a plain key press picks (its shortcutKey, either case), or null: a held, composing or Alt/Ctrl/Meta key is
 * no choice, and neither is Shift where a page blocks it. The typing check is the caller's (it depends on the target).
 */
export function matchChoiceShortcut<T>(
  event: KeyboardEvent,
  choices: ReadonlyArray<ChoiceShortcut<T>>,
  { blockShift = false }: { blockShift?: boolean } = {},
): T | null {
  if (typeof event.key !== 'string' || event.key.length !== 1) return null
  if (event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return null
  if (blockShift && event.shiftKey) return null
  const key = event.key.toUpperCase()
  return choices.find((choice) => choice.shortcutKey.toUpperCase() === key)?.value ?? null
}

/** Enter with focus outside any form: a letter picks a card but leaves focus on the page, so the form never sees it. */
export function isEnterOutsideForm(event: KeyboardEvent): boolean {
  return event.key === 'Enter' && !event.repeat && !event.altKey && !event.ctrlKey && !event.metaKey
    && !(event.target instanceof Element && event.target.closest('form'))
}
