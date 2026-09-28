<template>
  <!--
    Replaces the "Ask Darpan" command bubble. One object in the corner: the mascot is
    the launcher AND the help, so there is one place to look and one thing to learn.

    The bubble beside the face does two jobs from the same slot — the mascot's own
    label when you hover it, and an explanation when you rest on a value elsewhere on
    the page. Nothing else ever appears here.
  -->
  <div ref="dockEl" class="mascot-dock">
    <p
      v-if="bubbleText"
      class="mascot-say"
      :class="{ 'mascot-say--going': mascot.releasing, 'mascot-say--hint': mascot.mode === 'hint' }"
      role="status"
      @pointerenter="onBubbleEnter"
      @pointerleave="onBubbleLeave"
    >
      <!-- A warning's prose and its actions live in MascotWarningPopup, not here. This bubble is
           for labels and explanations, and a condition you must act on is neither — sharing the
           surface made the two look identical. What a warning gets here is ONE LINE naming it,
           which is exactly what this bubble is sized and styled for. -->
      <template v-if="mascot.mode === 'hint'">
        <template v-if="warningHintLine">{{ warningHintLine }}</template>
        <template v-else>Click me, or <span class="mascot-key">&#8984;K</span> if you’re in a hurry.</template>
      </template>
      <template v-else-if="mascot.mode === 'tip'">
        {{ mascot.tipText }}
      </template>
      <template v-else>
        <span class="mascot-say-lead">{{ leadText }}</span> {{ bodyText }}
      </template>
    </p>

    <MascotWarningPopup />

    <button
      type="button"
      class="mascot-fab"
      :aria-label="fabLabel"
      @click="onFaceClick"
      @pointerenter="onFaceEnter"
      @pointerleave="onFaceLeave"
      @focus="mascot.showHint()"
      @blur="mascot.hideHint()"
    >
      <!-- Full detail. The reduction schedule exists for marks under 24px; this one renders at
           ~82px, where dropping the mouth is not a simplification, just a face missing a feature.
           It also had a side effect worth naming: .mascot--speaking animates the mouth, so while
           the dock rendered detail 2 the speaking state had nothing to move. -->
      <DarpanMascot
        :detail="3"
        :listening="mascot.listening"
        :speaking="mascot.isSpeaking"
        :alerting="bursting"
        :alerted="mascot.hasWarnings"
      />
    </button>

    <!-- The jump is the signal for people who can see it. This is the same signal for people
         who cannot: without it a warning would be announced by nothing at all. -->
    <p class="sr-only" role="status" aria-live="polite">{{ liveAnnouncement }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DarpanMascot from './DarpanMascot.vue'
import MascotWarningPopup from './MascotWarningPopup.vue'
import { useMascotStore } from '../../stores/mascot'
import { createDwellController, type DwellController } from '../../composables/useMascotDwell'
import { createIdleHintController } from '../../composables/useIdleHints'
import { resolveExplainTarget } from '../../lib/mascotTargets'
import { hintsFor } from '../../lib/mascotHints'

/**
 * The route arrives as a prop rather than through useRoute(): the dock is shell furniture
 * that its own tests mount on their own, and reaching for the router from in here made
 * every one of them depend on a router they have no reason to build.
 */
const props = withDefaults(defineProps<{ routeName?: string | null, routeKey?: string | null }>(), {
  routeName: null,
  routeKey: null,
})

const emit = defineEmits<{ (event: 'open'): void }>()

const mascot = useMascotStore()
const dockEl = ref<HTMLElement | null>(null)

/* The announced destination has to be true for a screen reader too, not only on hover. */
const fabLabel = computed(() =>
  mascot.hasWarnings
    ? `${mascot.warnings[0]?.title} — open the warning`
    : 'Ask Darpan: search, or rest on a value to have it explained',
)

const liveAnnouncement = computed(() =>
  mascot.hasWarnings ? `${mascot.warnings[0]?.title}. ${mascot.warnings[0]?.body}` : '',
)

/* ── Warnings ──────────────────────────────────────────────────────────────────
   Three hops at 500ms; held a little past the last frame so the class outlives it. */
const BURST_MS = 1600
const bursting = ref(false)
let burstTimer: ReturnType<typeof setTimeout> | null = null

/** No matchMedia (jsdom, SSR) reads as "motion is fine", matching DarpanMascot's own blink. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* Fires on the EDGE into "some warning stands", not per warning: a page raising two
   conditions at once is one event to the reader, and hopping twice reads as a stutter. */
watch(() => mascot.hasWarnings, (standing, wasStanding) => {
  if (!standing) {
    bursting.value = false
    return
  }
  if (wasStanding || prefersReducedMotion()) return
  bursting.value = true
  if (burstTimer) clearTimeout(burstTimer)
  burstTimer = setTimeout(() => { bursting.value = false }, BURST_MS)
})

/* One target, mode-dependent. The posture and the hover line have already announced the
   change of destination, which is how a button that changed its label differentiates itself
   rather than how two buttons do. CMD-K is untouched in App.vue, so navigation is never
   actually removed -- only the pointer route to it is occupied while a warning stands. */
function onFaceClick(): void {
  if (mascot.hasWarnings) {
    mascot.openWarnings()
    return
  }
  emit('open')
}

/* The one line a warning gets in the bubble: what it is, and where the rest of it lives. It
   names the first warning rather than counting them, because "2 warnings" says nothing a person
   can act on and the posture already said that something stands. */
const warningHintLine = computed(() =>
  mascot.hasWarnings ? `${mascot.warnings[0]?.title} — click to see` : '',
)

/* The bubble is only ever a label or an explanation now, so it follows `mode` alone. A standing
   warning shows nothing here until hovered — the burst and the held posture are its announcement. */
const bubbleText = computed(() => mascot.mode !== 'idle')

const leadText = computed(() => (mascot.isStumped ? 'Drawing a blank' : (mascot.entry?.title ?? '')))
const bodyText = computed(() =>
  mascot.isStumped ? '— nobody has taught me this one yet.' : `— ${mascot.entry?.body ?? ''}`,
)

function onFaceEnter(event: PointerEvent): void {
  // Touch has no hover, and a tap would otherwise latch the label open with no way
  // to dismiss it. The tap still opens the launcher through @click.
  if (event.pointerType !== 'mouse') return
  mascot.showHint()
}

function onFaceLeave(): void {
  mascot.hideHint()
}

/* Moving onto the bubble cancels the release: otherwise a three-line answer starts
   dissolving the moment you reach toward it to read. */
function onBubbleEnter(): void {
  if (mascot.mode === 'explain') mascot.releasing = false
}

function onBubbleLeave(): void {
  if (mascot.mode === 'explain') mascot.clear()
}

/**
 * The glints follow the pointer. One listener, two CSS custom properties, no
 * per-frame DOM writes — the transform lives in the mascot's own stylesheet.
 */
function trackGaze(event: PointerEvent): void {
  const el = dockEl.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
  const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
  const magnitude = Math.max(1, Math.hypot(dx, dy))
  el.style.setProperty('--mascot-gaze-x', (dx / magnitude).toFixed(2))
  el.style.setProperty('--mascot-gaze-y', (dy / magnitude).toFixed(2))
}

function onEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  // The popup outranks the bubble and owns its own Escape — it closes without acknowledging,
  // which the dock cannot express. Leave it alone entirely rather than racing it.
  if (mascot.popupOpen) return
  if (mascot.mode !== 'idle') mascot.clear()
}

/* ── App-wide hover help ───────────────────────────────────────────────────────
   One delegated listener rather than a directive on every element. Hand-wiring did
   not scale past the page being edited, which is why the first cut covered a single
   column header and read as broken. Anything the label index or the timestamp shape
   recognises is explainable, on every page, with no markup changes. */
let hovered: HTMLElement | null = null
let controller: DwellController | null = null

/* Hover is a fine-pointer affordance. Without the guard, :hover latches after a tap
   on touch and the answer has no way to be dismissed. */
function hasFinePointer(): boolean {
  if (typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function stopWatching(): void {
  controller?.cancel()
  controller = null
  hovered = null
}

function onPointerOver(event: PointerEvent): void {
  if (event.pointerType !== 'mouse' || !hasFinePointer()) return
  const target = resolveExplainTarget(event.target as Element | null)

  if (!target) {
    // Left everything explainable: release whatever is on screen, if anything.
    if (hovered) {
      controller?.leave()
      hovered = null
      controller = null
    }
    return
  }

  // An element already marked by v-explain owns its own dwell; do not double-drive it.
  if (target.el.classList.contains('is-explainable')) return
  if (target.el === hovered) return

  stopWatching()
  hovered = target.el
  // No standing mark is applied any more. When only a few counts answered, a help cursor
  // was a useful signal; now that every value, heading and control does, it would follow
  // the reader across the whole page and read as hesitancy rather than help. The bubble
  // itself is the affordance.
  controller = createDwellController({
    onListen: () => mascot.listen(),
    onSpeak: () => mascot.explain(target.term, target.detail),
    onRelease: () => mascot.clear(),
  })
  controller.enter()
}

function onPointerOut(event: PointerEvent): void {
  if (!hovered || !controller) return
  // relatedTarget still inside the same element is a move between its children.
  const to = event.relatedTarget as Node | null
  if (to && hovered.contains(to)) return
  controller.leave()
  hovered = null
  controller = null
}

/* ── Unprompted hints ──────────────────────────────────────────────────────────
   If a page sits untouched, offer something it can do. Activity means acting —
   clicking, typing, editing — not moving the pointer while reading; counting movement
   would mean the hint only ever reached someone who had left the screen. */
const idle = createIdleHintController({
  // Evaluated when the offer is due, not on arrival: a hint is filtered by what is on
  // screen at that moment, so a page that finished loading meanwhile is read correctly.
  getHints: () => hintsFor(props.routeName, document),
  // Never talk over an answer somebody asked for.
  canOffer: () => mascot.mode === 'idle',
  onOffer: (hint) => { mascot.offerTip(hint) },
  onExpire: () => { mascot.clearTip() },
})

function noteActivity(): void {
  // Nothing here reads the event any more: an outside click is handled by the popup's own
  // backdrop, which CLOSES without acknowledging. Dismissing here would have cleared a warning
  // nobody acted on, turning "I looked away" into "done".
  // Acting is how you dismiss the offer — it has been answered by doing.
  mascot.clearTip()
  idle.noteActivity()
}

watch(() => props.routeKey, () => {
  mascot.clearTip()
  // Per-visit lifetime, for free: the page raises again on its next mount, so nothing
  // anywhere has to remember that this was dismissed.
  mascot.dismiss()
  idle.enter()
})

onMounted(() => {
  window.addEventListener('pointermove', trackGaze, { passive: true })
  window.addEventListener('keydown', onEscape)
  document.addEventListener('pointerover', onPointerOver, { passive: true })
  document.addEventListener('pointerout', onPointerOut, { passive: true })
  document.addEventListener('pointerdown', noteActivity, { passive: true })
  document.addEventListener('keydown', noteActivity, { passive: true })
  document.addEventListener('input', noteActivity, { passive: true })
  idle.enter()
})

onBeforeUnmount(() => {
  if (burstTimer) clearTimeout(burstTimer)
  window.removeEventListener('pointermove', trackGaze)
  window.removeEventListener('keydown', onEscape)
  document.removeEventListener('pointerover', onPointerOver)
  document.removeEventListener('pointerout', onPointerOut)
  document.removeEventListener('pointerdown', noteActivity)
  document.removeEventListener('keydown', noteActivity)
  document.removeEventListener('input', noteActivity)
  idle.stop()
  stopWatching()
  mascot.clear()
})
</script>
