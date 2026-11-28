import type { Directive } from 'vue'

/**
 * `v-dialog-focus` on a popup's dialog element (DAR-OPS-029 U16a). A popup that never takes focus hears an Esc bound on
 * itself only after the person tabs in, and closing it drops focus onto the page body.
 *
 * On open it focuses the control marked `autofocus`, else the dialog itself (made focusable outside the tab order),
 * never the first button, which is usually Close or Delete. A screen reader then announces the dialog's label. On close
 * it hands focus back to whatever opened the popup, unless the person has already moved focus elsewhere on the page.
 * Import it in the component (`import { vDialogFocus } from '…/directives/vDialogFocus'`); `<script setup>` exposes it.
 */
const openers = new WeakMap<HTMLElement, HTMLElement>()

export const vDialogFocus: Directive<HTMLElement> = {
  mounted(el) {
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body) openers.set(el, active)
    const marked = el.querySelector<HTMLElement>('[autofocus]')
    if (marked) {
      marked.focus()
      return
    }
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    // style.css draws no ring on a dialog focused this way: it is never a tab stop, and a ring would frame the screen.
    el.setAttribute('data-dialog-focus', '')
    el.focus()
  },
  unmounted(el) {
    const opener = openers.get(el)
    openers.delete(el)
    const active = document.activeElement
    // The dialog is already out of the document here, so focus that was inside it now reads as the body (or null).
    if (opener?.isConnected && (!active || active === document.body)) opener.focus()
  },
}
