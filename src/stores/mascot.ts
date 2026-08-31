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
