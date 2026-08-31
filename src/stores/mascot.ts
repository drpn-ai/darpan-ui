import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { lookupGlossary, type GlossaryEntry } from '../lib/mascotGlossary'

/**
 * What the mascot is currently doing. There are deliberately only three modes: a
 * fourth is a fourth thing to draw, test and keep consistent across every surface.
 */
export type MascotMode = 'idle' | 'hint' | 'explain'

export const useMascotStore = defineStore('mascot', () => {
  const mode = ref<MascotMode>('idle')
  const term = ref<string | null>(null)
  const listening = ref(false)
  const releasing = ref(false)

  const entry = computed<GlossaryEntry | null>(() => lookupGlossary(term.value))
  /** A term with no phrase written for it: say so rather than open an empty bubble. */
  const isStumped = computed(() => mode.value === 'explain' && entry.value === null)
  const isSpeaking = computed(() => mode.value === 'explain')

  /** Hovering the face itself only ever shows its own label, never an explanation. */
  function showHint(): void {
    if (mode.value === 'explain') return
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

  function explain(nextTerm: string): void {
    listening.value = false
    releasing.value = false
    term.value = nextTerm
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
    mode.value = 'idle'
  }

  return {
    mode,
    term,
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
