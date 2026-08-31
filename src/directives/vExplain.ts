import type { Directive, DirectiveBinding } from 'vue'
import { createDwellController, type DwellController } from '../composables/useMascotDwell'
import { useMascotStore } from '../stores/mascot'

/**
 * `v-explain="'differenceCount'"` marks one value as something the mascot can explain.
 *
 * Scope it to things that repeat — a column header names two hundred rows and is worth
 * one phrase; a data cell is a phrase you would write two hundred times and nobody
 * would read once. Forty cells sit between the pointer and the scrollbar, so a dwell
 * on cells is a help storm rather than help.
 */
interface ExplainElement extends HTMLElement {
  __explainController?: DwellController
  __explainTeardown?: () => void
}

/* Hover is a fine-pointer affordance. Without this guard :hover latches after a tap
   on a touch device and the answer has no way to be dismissed. */
function hasFinePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function bind(el: ExplainElement, binding: DirectiveBinding<string>): void {
  const term = binding.value
  if (!term) return

  const mascot = useMascotStore()
  const controller = createDwellController({
    onListen: () => mascot.listen(),
    onSpeak: () => mascot.explain(term),
    onRelease: () => mascot.clear(),
  })

  const enter = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse' || !hasFinePointer()) return
    controller.enter()
  }
  const leave = (): void => controller.leave()
  // A Tab already spent getting here is intent enough; making a keyboard user hold
  // still for a second would be a tax rather than a filter.
  const focus = (): void => {
    mascot.explain(term)
    controller.focus()
  }
  const blur = (): void => {
    controller.cancel()
    mascot.clear()
  }

  el.addEventListener('pointerenter', enter)
  el.addEventListener('pointerleave', leave)
  el.addEventListener('focus', focus)
  el.addEventListener('blur', blur)

  el.classList.add('is-explainable')
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0')

  el.__explainController = controller
  el.__explainTeardown = () => {
    el.removeEventListener('pointerenter', enter)
    el.removeEventListener('pointerleave', leave)
    el.removeEventListener('focus', focus)
    el.removeEventListener('blur', blur)
    controller.cancel()
  }
}

function unbind(el: ExplainElement): void {
  el.__explainTeardown?.()
  delete el.__explainController
  delete el.__explainTeardown
}

export const vExplain: Directive<ExplainElement, string> = {
  mounted: bind,
  updated(el, binding) {
    if (binding.value === binding.oldValue) return
    unbind(el)
    bind(el, binding)
  },
  beforeUnmount: unbind,
}
