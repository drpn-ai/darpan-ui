import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { lookupGlossary, type GlossaryEntry } from '../lib/mascotGlossary'

/**
 * What the mascot is currently doing. There are deliberately only three modes: a
 * fourth is a fourth thing to draw, test and keep consistent across every surface.
 */
/**
 * `hint` is the mascot's own label when you look at it. `explain` is an answer you asked
 * for by resting on something. `tip` is the only one it offers unprompted, after a page
 * has sat untouched — kept separate because an offer must never outrank an answer.
 */
export type MascotMode = 'idle' | 'hint' | 'explain' | 'tip'

/**
 * A warning-level condition a page has raised.
 *
 * Deliberately NOT a MascotMode. The modes are mutually exclusive by construction — explain()
 * clears the tip, offerTip() refuses while explaining, showHint() the same — and a warning is
 * exclusive with none of them: while a warning is held, resting on a value must still explain
 * it. Modelling it as a mode would force either "a warning suppresses explanations" or a new
 * precedence rule in every branch that reads `mode`.
 *
 * See docs/superpowers/specs/2026-09-28-mascot-warning-channel-design.md D1.
 */
export interface MascotWarningAction {
  /** Reads as the button. */
  label: string
  testId: string
  run: () => void | Promise<void>
}

export interface MascotWarning {
  /** Stable per condition, so a page re-raising on reload replaces rather than stacks. */
  id: string
  /** Also the hover line while this warning stands — it announces where the click goes. */
  title: string
  /**
   * The popup's focal line, set at --popup-workflow-prompt-size. Short: it is a question where the
   * warning has an action to offer ("Sync this automation with its run?") and a statement where it
   * can only be acknowledged, because there is nothing to ask.
   */
  prompt: string
  /** The detail beneath the prompt, at answer size. Mascot voice, not page voice. */
  body: string
  /** Empty is legal and load-bearing: some warnings can only be acknowledged. */
  actions: MascotWarningAction[]
}

export const useMascotStore = defineStore('mascot', () => {
  const mode = ref<MascotMode>('idle')
  const term = ref<string | null>(null)
  const listening = ref(false)
  const releasing = ref(false)

  /**
   * Filled in by whatever was hovered, for entries whose answer depends on the actual
   * value — a timestamp has to name its own zone, not timezones in general. Bodies opt
   * in with a {detail} token; entries without one ignore it.
   */
  const detail = ref<string | null>(null)

  const entry = computed<GlossaryEntry | null>(() => {
    const found = lookupGlossary(term.value)
    if (!found) return null
    if (!found.body.includes('{detail}')) return found
    return { ...found, body: found.body.replace('{detail}', detail.value ?? 'your local time') }
  })
  /** A term with no phrase written for it: say so rather than open an empty bubble. */
  const isStumped = computed(() => mode.value === 'explain' && entry.value === null)
  const isSpeaking = computed(() => mode.value === 'explain' || mode.value === 'tip')

  /* ── Warnings ──────────────────────────────────────────────────────────────────
     Orthogonal to `mode` on purpose (see MascotWarning). Lifetime is per-visit and
     nothing is persisted anywhere: pages raise on load and the dock drops on route
     change, so returning to a page re-raises whatever is still true. */
  const warnings = ref<MascotWarning[]>([])
  const popupOpen = ref(false)
  const hasWarnings = computed(() => warnings.value.length > 0)

  function raise(warning: MascotWarning): void {
    const at = warnings.value.findIndex((held) => held.id === warning.id)
    if (at === -1) warnings.value = [...warnings.value, warning]
    else warnings.value = warnings.value.map((held, index) => (index === at ? warning : held))
  }

  function drop(id: string): void {
    warnings.value = warnings.value.filter((held) => held.id !== id)
    if (!warnings.value.length) popupOpen.value = false
  }

  /* The popup shows ONE warning at a time, so the store owns which. Reset on open rather than
     remembered: coming back to a page is a fresh look, and resuming at number two would hide the
     first one behind a control nobody knows to press. */
  const warningIndex = ref(0)
  const currentWarning = computed<MascotWarning | null>(() => warnings.value[warningIndex.value] ?? null)

  function openWarnings(): void {
    if (!hasWarnings.value) return
    warningIndex.value = 0
    popupOpen.value = true
  }

  /* Wraps. Two warnings and a Next that stops working reads as broken rather than as finished. */
  function nextWarning(): void {
    if (!warnings.value.length) return
    warningIndex.value = (warningIndex.value + 1) % warnings.value.length
  }

  function prevWarning(): void {
    if (!warnings.value.length) return
    warningIndex.value = (warningIndex.value - 1 + warnings.value.length) % warnings.value.length
  }

  /**
   * Acknowledge the ONE being looked at. dismiss() clears everything, which is right for "I am done
   * with all of this" but wrong as the button under a single warning — it silenced conditions
   * nobody had addressed. The index stays inside the list so dismissing the last one lands on its
   * predecessor rather than past the end.
   */
  function dismissCurrent(): void {
    const at = warningIndex.value
    warnings.value = warnings.value.filter((_, index) => index !== at)
    if (!warnings.value.length) {
      warningIndex.value = 0
      popupOpen.value = false
      return
    }
    warningIndex.value = Math.min(at, warnings.value.length - 1)
  }

  /**
   * Put the dialog away WITHOUT acknowledging anything — Escape, or a click outside it. The
   * condition still stands and the face keeps its posture; only dismiss() clears the warnings.
   * The two were the same action while warnings lived in the speech bubble, and conflating them
   * would turn "I have read this" into "this no longer applies".
   */
  function closeWarnings(): void {
    popupOpen.value = false
  }

  /** The acknowledgement. Per-visit only — nothing is written anywhere, so a return re-raises. */
  function dismiss(): void {
    warnings.value = []
    popupOpen.value = false
  }

  /** The unprompted offer. Never interrupts an answer already on screen. */
  const tipText = ref<string | null>(null)

  function offerTip(text: string): boolean {
    if (mode.value === 'explain') return false
    tipText.value = text
    mode.value = 'tip'
    return true
  }

  function clearTip(): void {
    if (mode.value !== 'tip') return
    tipText.value = null
    mode.value = 'idle'
  }

  /** Hovering the face itself only ever shows its own label, never an explanation. */
  function showHint(): void {
    if (mode.value === 'explain') return
    tipText.value = null
    mode.value = 'hint'
  }

  function hideHint(): void {
    if (mode.value !== 'hint') return
    mode.value = 'idle'
  }

  function listen(): void {
    if (mode.value === 'explain') return
    listening.value = true
  }

  function explain(nextTerm: string, nextDetail?: string | null): void {
    listening.value = false
    releasing.value = false
    // An answer always wins over an offer.
    tipText.value = null
    term.value = nextTerm
    detail.value = nextDetail ?? null
    mode.value = 'explain'
  }

  /** The fade is visible, so the store has to model it — not just the end state. */
  function beginRelease(): void {
    if (mode.value !== 'explain') return
    releasing.value = true
  }

  function clear(): void {
    listening.value = false
    releasing.value = false
    term.value = null
    detail.value = null
    tipText.value = null
    mode.value = 'idle'
  }

  return {
    warnings,
    popupOpen,
    hasWarnings,
    raise,
    drop,
    openWarnings,
    closeWarnings,
    warningIndex,
    currentWarning,
    nextWarning,
    prevWarning,
    dismissCurrent,
    dismiss,
    mode,
    term,
    detail,
    tipText,
    offerTip,
    clearTip,
    listening,
    releasing,
    entry,
    isStumped,
    isSpeaking,
    showHint,
    hideHint,
    listen,
    explain,
    beginRelease,
    clear,
  }
})
