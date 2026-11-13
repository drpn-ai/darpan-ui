import { onBeforeUnmount, readonly, ref } from 'vue'

/** How long "Copied." stays beside the button. */
const COPIED_NOTE_MS = 2000

/**
 * Copy for something shown once (DAR-BE-264: the setup key, the recovery codes), with a note beside the button:
 * "Copied." for a moment; or, where the browser refuses every way to copy, the shown text selected and how to copy it,
 * since the person's own Ctrl+C or ⌘C still works.
 */
export function useCopy() {
  const note = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer) clearTimeout(timer)
    timer = null
  }

  async function copy(text: string, shown: HTMLElement | null): Promise<void> {
    clearTimer()
    if (await copyText(text)) {
      note.value = 'Copied.'
      timer = setTimeout(() => { note.value = '' }, COPIED_NOTE_MS)
      return
    }
    select(shown)
    note.value = 'Selected. Press Ctrl+C or ⌘C.'
  }

  onBeforeUnmount(clearTimer)

  return { note: readonly(note), copy }
}

/** The async clipboard, else a hidden textarea and execCommand (insecure origin, permissions policy, an older
 *  browser). False when neither worked. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the textarea copy
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  try {
    area.select()
    return typeof document.execCommand === 'function' && document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

function select(element: HTMLElement | null): void {
  const selection = window.getSelection()
  if (!element || !selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
}
